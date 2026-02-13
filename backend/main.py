import os
import json
import time
from io import BytesIO
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from supabase import create_client, Client
import requests
from typing import Optional
from openai import OpenAI

# Load environment variables
load_dotenv()

app = FastAPI(title="AI Meeting Assistant Backend")

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    raise RuntimeError(
        "Missing required environment variables. "
        "Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env"
    )

if not OPENAI_API_KEY:
    raise RuntimeError(
        "Missing OPENAI_API_KEY environment variable. "
        "Please set OPENAI_API_KEY in backend/.env"
    )

# Initialize Supabase client with service role key (bypasses RLS)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Initialize OpenAI client
openai_client = OpenAI(api_key=OPENAI_API_KEY)

# Expo Push Notification endpoint
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


class ProcessMeetingRequest(BaseModel):
    audio_url: str
    meeting_id: str
    push_token: Optional[str] = None


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"ok": True}


@app.post("/meetings/{meeting_id}/diarize")
async def diarize_meeting(meeting_id: str):
    """
    Generate speaker-labeled transcript from existing transcript.

    This endpoint:
    1. Fetches the stored transcript from the database
    2. Uses GPT-4o-mini to infer speaker turns and extract speaker names
    3. Stores structured JSON diarization with speaker labels
    4. Does NOT re-transcribe audio (text-only processing)

    Returns existing diarization if already generated.
    """
    print(f"Diarizing meeting {meeting_id}")

    try:
        # Step 1: Fetch meeting from database
        meeting_result = supabase.table("meetings").select("*").eq("id", meeting_id).execute()

        if not meeting_result.data or len(meeting_result.data) == 0:
            raise HTTPException(status_code=404, detail="Meeting not found")

        meeting = meeting_result.data[0]
        transcript = meeting.get("transcript")
        diarization_json = meeting.get("diarization_json")

        # Step 2: Validate transcript exists
        if not transcript or transcript.strip() == "":
            raise HTTPException(
                status_code=400,
                detail="No transcript available for diarization. Meeting must be processed first."
            )

        # Step 3: Return existing diarization if available (avoid duplicate API calls)
        if diarization_json:
            print(f"Returning existing diarization for meeting {meeting_id}")
            return {
                "status": "success",
                "meeting_id": meeting_id,
                "diarized": True,
                "cached": True,
                "diarization": diarization_json
            }

        # Step 4: Generate structured speaker-labeled transcript with GPT
        print("Generating speaker labels with GPT...")
        diarization_start = time.time()

        system_prompt = "You label meeting transcripts by speaker turns and extract speaker names when introduced."

        user_prompt = f"""You will receive a raw meeting transcript.

Task:
Return JSON only with this schema:

{{
  "speakers": [
    {{ "id": "speaker_1", "label": "Maria" }},
    {{ "id": "speaker_2", "label": "Speaker 2" }}
  ],
  "segments": [
    {{ "speaker_id": "speaker_1", "text": "..." }},
    {{ "speaker_id": "speaker_2", "text": "..." }}
  ]
}}

Rules:
- Use stable speaker ids: speaker_1, speaker_2, speaker_3...
- Infer speaker turns from the transcript text (no audio available).
- If a speaker explicitly introduces themselves by name (e.g., "I'm Maria", "This is John"), set that speaker's label to that name and keep it consistent for their future turns.
- If name is not known, label must be "Speaker N" (matching the id number).
- Do NOT invent names.
- Preserve the transcript wording as much as possible; minor punctuation cleanup is allowed but do not paraphrase.
- Do NOT summarize.
- Keep segments reasonably sized (combine consecutive turns by same speaker).
- Return valid JSON only (no markdown, no extra text).

Transcript:
{transcript}"""

        diarization_response = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.2,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        )

        response_text = diarization_response.choices[0].message.content.strip()
        diarization_time = time.time() - diarization_start

        print(f"Diarization complete in {diarization_time:.2f}s")

        # Step 5: Parse JSON response
        try:
            # Remove markdown code blocks if present
            if response_text.startswith("```"):
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
                response_text = response_text.strip()

            diarization_data = json.loads(response_text)

            # Validate structure
            if "speakers" not in diarization_data or "segments" not in diarization_data:
                raise ValueError("Invalid diarization JSON structure")

            # Generate human-readable transcript_diarized from structured data
            speaker_map = {s["id"]: s["label"] for s in diarization_data["speakers"]}
            formatted_lines = []
            for segment in diarization_data["segments"]:
                speaker_label = speaker_map.get(segment["speaker_id"], "Unknown Speaker")
                formatted_lines.append(f"{speaker_label}: {segment['text']}")

            transcript_diarized = "\n\n".join(formatted_lines)

            # Step 6: Store structured diarization in database
            update_result = supabase.table("meetings").update({
                "diarization_json": diarization_data,
                "transcript_diarized": transcript_diarized
            }).eq("id", meeting_id).execute()

            if not update_result.data:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to save diarization to database"
                )

            print(f"Structured diarization saved for meeting {meeting_id}")

            # Step 7: Return success response with structured data
            return {
                "status": "success",
                "meeting_id": meeting_id,
                "diarized": True,
                "cached": False,
                "diarization": diarization_data
            }

        except (json.JSONDecodeError, ValueError, KeyError) as parse_error:
            print(f"Failed to parse structured diarization: {parse_error}")
            print(f"Raw response: {response_text[:500]}")

            # Fallback: Generate simple plain-text diarization
            fallback_prompt = f"""Rewrite the following meeting transcript with inferred speaker labels.

Rules:
- Use generic labels: Speaker 1, Speaker 2, Speaker 3...
- Preserve exact wording of transcript.
- Do not summarize.
- Do not change content.
- Only reorganize by speaker turns.
- Return plain text only.

Transcript:
{transcript}"""

            fallback_response = openai_client.chat.completions.create(
                model="gpt-4o-mini",
                temperature=0.2,
                messages=[
                    {"role": "system", "content": "You are an assistant that labels meeting transcripts with speaker turns."},
                    {"role": "user", "content": fallback_prompt}
                ]
            )

            diarized_transcript = fallback_response.choices[0].message.content.strip()

            # Store fallback plain-text version only
            update_result = supabase.table("meetings").update({
                "transcript_diarized": diarized_transcript
            }).eq("id", meeting_id).execute()

            if not update_result.data:
                raise HTTPException(
                    status_code=500,
                    detail="Failed to save fallback diarization to database"
                )

            print(f"Fallback diarization saved for meeting {meeting_id}")

            return {
                "status": "success",
                "meeting_id": meeting_id,
                "diarized": False,
                "error": "json_parse_failed",
                "fallback": True
            }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error diarizing meeting {meeting_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Diarization failed: {str(e)}"
        )


@app.post("/process-meeting")
async def process_meeting(request: ProcessMeetingRequest):
    """
    Process meeting audio: transcription, summarization, and send push notification.

    Steps:
    1. Download audio from audio_url
    2. Transcribe audio using OpenAI Whisper
    3. Analyze transcript using OpenAI GPT to generate summary and action items
    4. Update the meeting record in Supabase with transcript and summary
    5. Send Expo push notification to the user's device
    """
    meeting_id = request.meeting_id
    audio_url = request.audio_url
    push_token = request.push_token

    print(f"Processing meeting {meeting_id}")
    print(f"Audio URL: {audio_url}")
    print(f"Push token: {push_token}")

    try:
        # Step 1: Download audio file
        print("Downloading audio file...")
        download_start = time.time()

        audio_response = requests.get(audio_url, timeout=60)
        audio_response.raise_for_status()

        audio_bytes = audio_response.content
        audio_size_mb = len(audio_bytes) / (1024 * 1024)
        download_time = time.time() - download_start

        print(f"Audio downloaded: {audio_size_mb:.2f} MB in {download_time:.2f}s")

        # Step 2: Transcribe audio using OpenAI Whisper
        print("Transcribing audio with OpenAI Whisper...")
        transcription_start = time.time()

        # Create a file-like object from bytes
        audio_file = BytesIO(audio_bytes)
        audio_file.name = "audio.m4a"  # OpenAI needs a filename with extension

        transcription = openai_client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file
        )

        raw_transcript = transcription.text
        transcript_length = len(raw_transcript)
        transcription_time = time.time() - transcription_start

        print(f"Transcription complete: {transcript_length} chars in {transcription_time:.2f}s")

        # Truncate very long transcripts to avoid token limits
        MAX_TRANSCRIPT_LENGTH = 20000
        truncated = False
        if transcript_length > MAX_TRANSCRIPT_LENGTH:
            raw_transcript = raw_transcript[:MAX_TRANSCRIPT_LENGTH]
            truncated = True
            print(f"Transcript truncated from {transcript_length} to {MAX_TRANSCRIPT_LENGTH} chars")

        # Step 3: Analyze transcript with GPT
        print("Analyzing transcript with GPT...")
        analysis_start = time.time()

        system_prompt = "You are an assistant that structures meeting transcripts. Return valid JSON only."

        user_prompt = f"""Analyze the following meeting transcript and return JSON only with this exact structure:

{{
  "title": "Brief descriptive title for the meeting (max 30 characters)",
  "clean_transcript": "cleaned and formatted version of the transcript",
  "summary": "2-3 sentence high-level summary of the meeting",
  "key_points": ["point 1", "point 2", "point 3"],
  "action_items": ["action 1", "action 2"]
}}

The title should capture the main topic/purpose of the meeting in 30 characters or less.
If there are no action items, use an empty array. Keep the response concise.

Transcript:
{raw_transcript}"""

        analysis = openai_client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.2,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        )

        analysis_time = time.time() - analysis_start
        print(f"Analysis complete in {analysis_time:.2f}s")

        # Parse the GPT response
        try:
            response_text = analysis.choices[0].message.content.strip()

            # Remove markdown code blocks if present
            if response_text.startswith("```"):
                response_text = response_text.split("```")[1]
                if response_text.startswith("json"):
                    response_text = response_text[4:]
                response_text = response_text.strip()

            parsed_analysis = json.loads(response_text)

            meeting_title = parsed_analysis.get("title", "")[:30]  # Enforce 30 char limit
            clean_transcript = parsed_analysis.get("clean_transcript", raw_transcript)
            summary_text = parsed_analysis.get("summary", "")
            key_points = parsed_analysis.get("key_points", [])
            action_items = parsed_analysis.get("action_items", [])

            # Format the final summary
            formatted_summary = summary_text

            if key_points:
                formatted_summary += "\n\n**Key Points:**\n"
                for point in key_points:
                    formatted_summary += f"- {point}\n"

            if action_items:
                formatted_summary += "\n**Action Items:**\n"
                for item in action_items:
                    formatted_summary += f"- {item}\n"

            if truncated:
                formatted_summary += "\n\n*(Note: Transcript was truncated for analysis)*"

            final_transcript = clean_transcript
            final_summary = formatted_summary.strip()

            print("Successfully parsed GPT analysis")

        except (json.JSONDecodeError, KeyError) as parse_error:
            print(f"Failed to parse GPT response: {parse_error}")
            print(f"Raw response: {response_text[:500]}")

            # Fallback: use raw transcript and simple summary
            final_transcript = raw_transcript
            final_summary = "Analysis completed but structured parsing failed. Transcript saved successfully."
            if truncated:
                final_summary += "\n\n*(Note: Transcript was truncated for analysis)*"

        # Step 4: Update meeting record in database
        print(f"Updating meeting {meeting_id} in database...")

        update_result = supabase.table("meetings").update({
            "status": "ready",
            "transcript": final_transcript,
            "summary": final_summary,
            "title": meeting_title if 'meeting_title' in locals() else None,
        }).eq("id", meeting_id).execute()

        if not update_result.data:
            raise HTTPException(
                status_code=500,
                detail="Failed to update meeting record in database"
            )

        total_time = time.time() - download_start
        print(f"Meeting {meeting_id} updated successfully")
        print(f"Total processing time: {total_time:.2f}s (download: {download_time:.2f}s, transcription: {transcription_time:.2f}s, analysis: {analysis_time:.2f}s)")

        # Step 5: Send Expo push notification
        if push_token:
            print(f"Sending push notification to {push_token}...")

            notification_payload = {
                "to": push_token,
                "sound": "default",
                "title": "Transcript Ready",
                "body": "Tap to view your meeting notes",
                "data": {
                    "meetingId": meeting_id
                },
                "channelId": "meeting-ready",
            }

            try:
                push_response = requests.post(
                    EXPO_PUSH_URL,
                    json=notification_payload,
                    headers={
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                    },
                    timeout=10,
                )

                push_response.raise_for_status()
                push_result = push_response.json()
                print(f"Push notification sent: {push_result}")

            except Exception as push_error:
                print(f"Failed to send push notification: {push_error}")
                # Don't fail the entire request if push notification fails
        else:
            print("No push token provided, skipping notification")

        return {
            "ok": True,
            "meeting_id": meeting_id,
            "status": "ready",
            "message": "Meeting processed successfully",
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error processing meeting: {e}")

        # Update meeting status to failed
        try:
            supabase.table("meetings").update({
                "status": "processing_failed",
                "transcript": None,
                "summary": "AI processing failed. Please try recording again.",
            }).eq("id", meeting_id).execute()
            print(f"Updated meeting {meeting_id} status to processing_failed")
        except Exception as db_error:
            print(f"Failed to update meeting status: {db_error}")

        # Return 200 even on AI failure (allows queue retry logic upstream)
        return {
            "ok": False,
            "meeting_id": meeting_id,
            "status": "processing_failed",
            "message": f"Processing failed: {str(e)}",
        }
