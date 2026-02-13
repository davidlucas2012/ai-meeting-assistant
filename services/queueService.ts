import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

// Configuration constants
const MAX_ATTEMPTS = 5;
const QUEUE_POLL_INTERVAL = 15000; // 15 seconds
const CLEANUP_COMPLETED_AFTER = 86400000; // 24 hours
const STORAGE_KEY_JOBS = '@queue/jobs';
const MAX_FILE_SIZE_MB = 50; // Supabase free tier limit (adjust based on your plan)
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// Job types
export type JobType = 'upload_and_process';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface UploadJob {
  id: string;
  type: JobType;
  createdAt: string;
  meetingId: string;
  localUri: string;
  audioPath: string;
  durationMillis: number;
  attempts: number;
  lastError: string | null;
  status: JobStatus;
  nextRunAt: number; // Timestamp when job can be retried
}

// Global state
let isRunning = false;
let pollingInterval: ReturnType<typeof setInterval> | null = null;
const activeUploads = new Set<string>();

/**
 * Calculate exponential backoff delay in milliseconds
 */
function calculateBackoff(attempts: number): number {
  const baseDelay = 1000; // 1 second
  const maxDelay = 60000; // 60 seconds
  return Math.min(Math.pow(2, attempts) * baseDelay, maxDelay);
}

/**
 * Load all jobs from AsyncStorage
 * Resets 'running' jobs to 'pending' (crash recovery)
 */
export async function listJobs(): Promise<UploadJob[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY_JOBS);
    if (!json) {
      return [];
    }

    const jobs: UploadJob[] = JSON.parse(json);

    // Crash recovery: reset stuck 'running' jobs
    let modified = false;
    const recovered = jobs.map((job) => {
      if (job.status === 'running') {
        modified = true;
        return {
          ...job,
          status: 'pending' as JobStatus,
          lastError: 'App restarted during job',
        };
      }
      return job;
    });

    // Save back if we modified any jobs
    if (modified) {
      await AsyncStorage.setItem(STORAGE_KEY_JOBS, JSON.stringify(recovered));
      return recovered;
    }

    return jobs;
  } catch (error) {
    console.error('Failed to load jobs from storage:', error);
    return [];
  }
}

/**
 * Save all jobs to AsyncStorage (atomic write)
 */
async function saveJobs(jobs: UploadJob[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY_JOBS, JSON.stringify(jobs));
  } catch (error) {
    console.error('Failed to save jobs to storage:', error);
    throw error;
  }
}

/**
 * Get a single job by ID
 */
export async function getJob(jobId: string): Promise<UploadJob | null> {
  const jobs = await listJobs();
  return jobs.find((j) => j.id === jobId) || null;
}

/**
 * Update a job with partial updates
 */
export async function updateJob(jobId: string, updates: Partial<UploadJob>): Promise<void> {
  const jobs = await listJobs();
  const index = jobs.findIndex((j) => j.id === jobId);

  if (index === -1) {
    throw new Error(`Job not found: ${jobId}`);
  }

  jobs[index] = { ...jobs[index], ...updates };
  await saveJobs(jobs);
}

/**
 * Remove a job by ID
 */
export async function removeJob(jobId: string): Promise<void> {
  const jobs = await listJobs();
  const filtered = jobs.filter((j) => j.id !== jobId);
  await saveJobs(filtered);
}

/**
 * Enqueue a new upload and process job
 * Returns immediately with job ID and meeting ID
 */
export async function enqueueUploadAndProcess(
  localUri: string,
  durationMillis: number
): Promise<{ jobId: string; meetingId: string }> {
  // Import meetingService functions dynamically to avoid circular dependency
  const { generateMeetingId } = await import('./meetingService');

  // Generate IDs
  const jobId = generateMeetingId();
  const meetingId = generateMeetingId();

  // Get current user ID
  const { supabase } = await import('@/lib/supabase');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    throw new Error('User not authenticated');
  }

  const userId = session.user.id;
  const audioPath = `${userId}/${meetingId}.m4a`;

  // Create meeting row immediately so it appears in the list right away
  await supabase.from('meetings').insert({
    id: meetingId,
    user_id: userId,
    audio_path: audioPath,
    status: 'recorded', // Initial status before upload starts
    duration_millis: durationMillis,
  });

  console.log('Meeting row created immediately:', meetingId);

  // Create job
  const job: UploadJob = {
    id: jobId,
    type: 'upload_and_process',
    createdAt: new Date().toISOString(),
    meetingId,
    localUri,
    audioPath,
    durationMillis,
    attempts: 0,
    lastError: null,
    status: 'pending',
    nextRunAt: Date.now(), // Can run immediately
  };

  // Add to storage
  const jobs = await listJobs();
  jobs.push(job);
  await saveJobs(jobs);

  console.log('Job enqueued:', { jobId, meetingId });

  // Trigger queue processing (don't await)
  runQueueOnce().catch((error) => {
    console.error('Failed to trigger queue:', error);
  });

  return { jobId, meetingId };
}

/**
 * Process a single job (upload + request processing)
 */
async function processJob(job: UploadJob): Promise<void> {
  console.log('Processing job:', job.id);

  // Import meetingService functions
  const { createMeetingRow, uploadAudio, requestProcessing } = await import('./meetingService');
  const { supabase } = await import('@/lib/supabase');

  // Get current session
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    throw new Error('User not authenticated. Please sign in again.');
  }

  // Check if file exists
  const fileInfo = await FileSystem.getInfoAsync(job.localUri);
  if (!fileInfo.exists) {
    throw new Error('Audio file no longer exists. It may have been deleted.');
  }

  // Check file size
  if (fileInfo.size && fileInfo.size > MAX_FILE_SIZE_BYTES) {
    const actualSizeMB = (fileInfo.size / (1024 * 1024)).toFixed(1);
    throw new Error(
      `Recording too large (${actualSizeMB}MB). Maximum size is ${MAX_FILE_SIZE_MB}MB. Please record shorter meetings.`
    );
  }

  // Step 1: Update meeting status to uploading
  // (Meeting row was already created when job was enqueued)
  await supabase
    .from('meetings')
    .update({ status: 'uploading' as const })
    .eq('id', job.meetingId);

  // Step 2: Upload audio
  await uploadAudio(job.meetingId, job.localUri, job.audioPath);

  // Step 3: Request processing
  await requestProcessing(job.meetingId, job.audioPath);

  console.log('Job completed successfully:', job.id);
}

/**
 * Run queue once - process one pending job
 * Respects nextRunAt and global lock
 */
export async function runQueueOnce(): Promise<void> {
  // Check global lock
  if (isRunning) {
    console.log('Queue already running, skipping');
    return;
  }

  // Lock the queue
  isRunning = true;

  try {
    const jobs = await listJobs();
    const now = Date.now();

    // Find first pending job that's ready to run
    const readyJob = jobs.find(
      (j) => j.status === 'pending' && j.nextRunAt <= now
    );

    if (!readyJob) {
      // No jobs ready to run
      return;
    }

    // Check if this job is already being uploaded (shouldn't happen but be safe)
    if (activeUploads.has(readyJob.id)) {
      console.warn('Job already in activeUploads set:', readyJob.id);
      return;
    }

    // Mark job as running
    activeUploads.add(readyJob.id);
    await updateJob(readyJob.id, {
      status: 'running',
    });

    try {
      // Process the job
      await processJob(readyJob);

      // Success - mark as completed
      await updateJob(readyJob.id, {
        status: 'completed',
      });
    } catch (error) {
      // Job failed
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Job failed:', readyJob.id, errorMessage);

      const newAttempts = readyJob.attempts + 1;
      const backoffDelay = calculateBackoff(newAttempts);

      if (newAttempts >= MAX_ATTEMPTS) {
        // Max attempts reached - mark as failed
        await updateJob(readyJob.id, {
          status: 'failed',
          attempts: newAttempts,
          lastError: errorMessage,
          nextRunAt: Date.now() + backoffDelay,
        });
      } else {
        // Retry with backoff
        await updateJob(readyJob.id, {
          status: 'pending',
          attempts: newAttempts,
          lastError: errorMessage,
          nextRunAt: Date.now() + backoffDelay,
        });
        console.log(`Job will retry in ${backoffDelay}ms (attempt ${newAttempts}/${MAX_ATTEMPTS})`);
      }
    } finally {
      // Always remove from active uploads
      activeUploads.delete(readyJob.id);
    }
  } finally {
    // Always unlock the queue
    isRunning = false;
  }
}

/**
 * Start the queue polling loop
 */
export function startQueueLoop(): void {
  if (pollingInterval) {
    console.warn('Queue loop already running');
    return;
  }

  console.log('Starting queue loop');

  // Run once immediately
  runQueueOnce().catch(console.error);

  // Then poll every QUEUE_POLL_INTERVAL
  pollingInterval = setInterval(() => {
    runQueueOnce().catch(console.error);
  }, QUEUE_POLL_INTERVAL);
}

/**
 * Stop the queue polling loop
 */
export function stopQueueLoop(): void {
  if (pollingInterval) {
    console.log('Stopping queue loop');
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

/**
 * Clean up old completed jobs (> 24 hours)
 */
export async function cleanupOldJobs(): Promise<void> {
  try {
    const jobs = await listJobs();
    const now = Date.now();
    const cutoff = now - CLEANUP_COMPLETED_AFTER;

    const filtered = jobs.filter((job) => {
      if (job.status === 'completed') {
        const createdAt = new Date(job.createdAt).getTime();
        return createdAt > cutoff;
      }
      // Keep all non-completed jobs
      return true;
    });

    if (filtered.length < jobs.length) {
      console.log(`Cleaned up ${jobs.length - filtered.length} old jobs`);
      await saveJobs(filtered);
    }
  } catch (error) {
    console.error('Failed to cleanup old jobs:', error);
  }
}
