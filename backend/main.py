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
  "clean_transcript": "cleaned and formatted version of the transcript",
  "summary": "2-3 sentence high-level summary of the meeting",
  "key_points": ["point 1", "point 2", "point 3"],
  "action_items": ["action 1", "action 2"]
}}

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
