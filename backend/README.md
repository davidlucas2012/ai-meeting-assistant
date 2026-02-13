# Backend API

Python FastAPI backend for processing meeting recordings with real AI transcription and summarization.

## Setup

1. Create a virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add:
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (bypasses RLS)
- `OPENAI_API_KEY` - OpenAI API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

## Running

Start the development server:

**For local testing only:**
```bash
uvicorn main:app --reload --port 8000
```

**For mobile device testing (recommended):**
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API will be available at:
- Local: `http://localhost:8000`
- Network: `http://[your-ip]:8000` (e.g., `http://192.168.18.44:8000`)

API documentation: `http://localhost:8000/docs`

## Endpoints

- `GET /health` - Health check
- `POST /process-meeting` - Process meeting audio with OpenAI Whisper + GPT-4o-mini

## AI Processing

The `/process-meeting` endpoint performs:

1. **Download** - Fetches audio file from Supabase Storage
2. **Transcription** - Uses OpenAI Whisper (`whisper-1`) for speech-to-text
3. **Analysis** - Uses GPT-4o-mini to extract:
   - Cleaned transcript
   - 2-3 sentence summary
   - Key discussion points
   - Action items
4. **Storage** - Saves results to Supabase database
5. **Notification** - Sends push notification when ready

**Performance Safeguards:**
- Automatic transcript truncation at 20,000 characters to avoid token limits
- Comprehensive error handling with fallback to raw transcript
- Detailed logging (download time, transcription time, analysis time)
- Graceful degradation if GPT returns invalid JSON

## Dependencies

- `fastapi` - Modern async web framework
- `uvicorn` - ASGI server
- `supabase` - Database, storage, and auth client
- `openai` - OpenAI API for Whisper + GPT
- `requests` - HTTP client for audio download and push notifications
- `python-dotenv` - Environment variable management
