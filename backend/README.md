# Backend API

Python FastAPI backend for processing meeting recordings.

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
- `POST /process-meeting` - Process meeting audio (stub)
