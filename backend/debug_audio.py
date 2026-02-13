#!/usr/bin/env python3
"""
Debug script to check audio file integrity and transcription.
Usage: python backend/debug_audio.py <audio_url>
"""
import sys
import requests
from io import BytesIO
from openai import OpenAI
import os
from dotenv import load_dotenv

load_dotenv()

if len(sys.argv) < 2:
    print("Usage: python backend/debug_audio.py <audio_url>")
    sys.exit(1)

audio_url = sys.argv[1]
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

print(f"Downloading audio from: {audio_url}")
audio_response = requests.get(audio_url, timeout=60)
audio_response.raise_for_status()

audio_bytes = audio_response.content
audio_size_mb = len(audio_bytes) / (1024 * 1024)

print(f"Audio downloaded: {audio_size_mb:.2f} MB ({len(audio_bytes)} bytes)")

# Save to temp file for inspection
temp_file = "/tmp/debug_audio.m4a"
with open(temp_file, "wb") as f:
    f.write(audio_bytes)
print(f"Saved to: {temp_file}")

# Try transcription
print("\nTranscribing with Whisper...")
audio_file = BytesIO(audio_bytes)
audio_file.name = "audio.m4a"

transcription = openai_client.audio.transcriptions.create(
    model="whisper-1",
    file=audio_file,
    response_format="verbose_json"  # Get more details including duration
)

print(f"\nTranscription complete!")
print(f"Duration (from Whisper): {transcription.duration if hasattr(transcription, 'duration') else 'N/A'} seconds")
print(f"Text length: {len(transcription.text)} characters")
print(f"\nFirst 500 chars of transcript:")
print(transcription.text[:500])
print(f"\nLast 500 chars of transcript:")
print(transcription.text[-500:])
