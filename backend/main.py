from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="AI Meeting Assistant Backend")


class ProcessMeetingRequest(BaseModel):
    audio_url: str
    meeting_id: str
    push_token: str


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"ok": True}


@app.post("/process-meeting")
async def process_meeting(request: ProcessMeetingRequest):
    """
    Stub endpoint for processing meeting audio.

    In the full implementation, this would:
    1. Download audio from audio_url
    2. Transcribe using Whisper or similar
    3. Generate summary using LLM
    4. Update database
    5. Send push notification to push_token
    """
    return {
        "status": "queued",
        "meeting_id": request.meeting_id,
        "message": "Meeting processing started (scaffold - not implemented yet)"
    }
