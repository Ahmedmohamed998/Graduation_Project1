from fastapi import FastAPI, HTTPException, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv
from typing import Optional
from contextlib import asynccontextmanager
import json
import logging
import os

from services.backend_service import build_user_context
from services.llm_service import (
    generate_advice,
    categorize_transaction,
    extract_transaction_info,
    extract_from_ocr_text,
)
from services.speech_service import transcribe_audio
from services.ocr_service import scan_file
from services.memory_service import _ensure_indexes

load_dotenv()

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
#  Lifespan: runs startup/shutdown logic
# ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: create MongoDB indexes.  Shutdown: nothing needed."""
    try:
        await _ensure_indexes()
    except Exception as e:
        logger.warning(f"[startup] Could not create chat memory indexes: {e}")
    yield  # app runs here


limiter = Limiter(key_func=get_remote_address)
app = FastAPI(title="AI Financial Advisor Agent", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS — '*' wildcard is incompatible with allow_credentials=True.
# List explicit origins instead.
_ALLOWED_ORIGINS = [
    os.getenv("HOME_BACKEND_URL", "http://home-backend:5001"),
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",   # Vite dev server
    "http://localhost:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)




# ─────────────────────────────────────────────
#  Pydantic request models
# ─────────────────────────────────────────────
class ChatRequest(BaseModel):
    message: str
    accessToken: str
    userId: Optional[str] = None

class CategorizeRequest(BaseModel):
    text: str

class VoiceExtractRequest(BaseModel):
    transcript: str
    language: str = "ar"

class VoiceFeedbackRequest(BaseModel):
    originalTranscript: str
    originalExtraction: dict
    correctedExtraction: dict
    language: str
    correctedFields: list[str]

class OcrExtractRequest(BaseModel):
    rawText: str
    structuredOcr: Optional[dict] = None
    language: str = "auto"
    fileType: str = "image"

class OcrFeedbackRequest(BaseModel):
    originalRawText: str
    originalExtraction: dict
    correctedExtraction: dict
    language: str
    fileType: str
    correctedFields: list[str]


# ─────────────────────────────────────────────
#  POST /api/ai/chat  — financial advisor chat
# ─────────────────────────────────────────────
@app.post("/api/ai/chat")
@limiter.limit("20/minute")
async def chat_endpoint(request: Request, body: ChatRequest):
    if not body.accessToken:
        raise HTTPException(status_code=401, detail="Access token is required")

    try:
        user_context = await build_user_context(body.accessToken)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch user data: {str(e)}")

    try:
        response_data = await generate_advice(body.message, user_context, user_id=body.userId)
        return response_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to communicate with AI: {str(e)}")


# ─────────────────────────────────────────────
#  POST /api/ai/categorize  — auto-categorizer
# ─────────────────────────────────────────────
@app.post("/api/ai/categorize")
@limiter.limit("60/minute")
async def categorize_endpoint(request: Request, body: CategorizeRequest):
    if not body.text or not body.text.strip():
        raise HTTPException(status_code=400, detail="text field is required and cannot be empty")

    try:
        result = await categorize_transaction(body.text.strip())
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Categorization failed: {str(e)}")


# ═════════════════════════════════════════════
#  🎙️ VOICE PIPELINE
# ═════════════════════════════════════════════

# ─────────────────────────────────────────────
#  POST /api/voice/transcribe
#  Receive audio → Azure STT → transcript
# ─────────────────────────────────────────────
@app.post("/api/voice/transcribe")
@limiter.limit("10/minute")
async def voice_transcribe(
    request: Request,
    audio: UploadFile = File(..., description="Audio file (WAV/MP3/WebM/OGG/M4A)"),
    language_hint: str = Form(default="auto"),
):
    if not audio:
        raise HTTPException(status_code=400, detail="Audio file is required")

    try:
        audio_bytes = await audio.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read audio file: {str(e)}")

    try:
        result = await transcribe_audio(
            audio_bytes=audio_bytes,
            filename=audio.filename or "audio.wav",
            language_hint=language_hint,
        )
    except ValueError as e:
        status = 422 if "format" in str(e).lower() else 400
        raise HTTPException(status_code=status, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

    return result


# ─────────────────────────────────────────────
#  POST /api/voice/extract
#  Transcript → LLM → structured extraction
#  (also calls categorize internally)
# ─────────────────────────────────────────────
@app.post("/api/voice/extract")
@limiter.limit("30/minute")
async def voice_extract(request: Request, body: VoiceExtractRequest):
    if not body.transcript or not body.transcript.strip():
        raise HTTPException(status_code=400, detail="transcript field is required")

    try:
        extraction = await extract_transaction_info(body.transcript.strip(), body.language)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")

    # NEW: Categorize each item individually
    ext = extraction["extracted"]
    items = ext.get("items") or []
    categorized_items = []
    
    # Track breakdown by category group and name
    breakdown_map = {}
    
    for item in items:
        # Use categories already enriched by extract_transaction_info (LLM or fallback)
        cat_group = item.get("categoryGroup") or "Miscellaneous"
        cat_name = item.get("category") or "Uncategorized"
        amount = item.get("total_price") or item.get("unit_price") or 0
        
        # Add to the list of categorized items
        categorized_items.append({
            **item,
            "categoryGroup": cat_group,
            "category": cat_name,
            "confidence": 0.85 if item.get("categoryGroup") else 0.5
        })
        
        # Update breakdown map
        key = (cat_group, cat_name)
        breakdown_map[key] = breakdown_map.get(key, 0) + amount

    # Convert breakdown map to a clean list for the frontend
    category_breakdown = [
        {
            "categoryGroup": g,
            "category": c,
            "amount": round(a, 2),
            "currency": ext.get("currency", "EGP")
        }
        for (g, c), a in breakdown_map.items()
    ]

    # Calculate overall category (legacy support) - use the category with highest total amount
    overall_category = None
    if category_breakdown:
        # Find category with highest aggregate amount
        top_cat = max(category_breakdown, key=lambda x: x["amount"])
        overall_category = {
            "type": "expense",
            "categoryGroup": top_cat["categoryGroup"],
            "category": top_cat["category"],
            "confidence": 0.9,
            "detectedAmount": ext.get("totalAmount"),
            "detectedCurrency": ext.get("currency", "EGP"),
            "suggestedDescription": ", ".join([i.get("name_en") or i.get("name", "") for i in items])[:100],
            "language": "en"
        }

    # Build response
    response = {
        "source": "voice",
        "transcript": body.transcript,
        "language": body.language,
        **extraction,
        "categorizedItems": categorized_items,
        "categoryBreakdown": category_breakdown, # NEW: Grouped breakdown
        "totalAmount": ext.get("totalAmount")
    }
    
    # Optional: keep old "category" field for backward compatibility
    if overall_category:
        response["category"] = overall_category

    return response


# ─────────────────────────────────────────────
#  POST /api/voice/feedback
#  Save user corrections for retraining
# ─────────────────────────────────────────────
@app.post("/api/voice/feedback")
@limiter.limit("60/minute")
async def voice_feedback(request: Request, body: VoiceFeedbackRequest):
    import uuid
    import datetime

    feedback_id = str(uuid.uuid4())[:12]

    # In production this would be saved to MongoDB via home-backend
    # The home-backend proxy will attach userId from JWT + forward here
    # We store an in-memory record (MongoDB write happens via home-backend model)
    feedback_record = {
        "feedbackId": feedback_id,
        "originalTranscript": body.originalTranscript,
        "originalExtraction": body.originalExtraction,
        "correctedExtraction": body.correctedExtraction,
        "language": body.language,
        "correctedFields": body.correctedFields,
        "hadCorrection": bool(body.correctedFields),
        "createdAt": datetime.datetime.utcnow().isoformat(),
    }

    # Log for debugging (in production, home-backend saves to MongoDB)
    print(f"[VoiceFeedback] {json.dumps(feedback_record, ensure_ascii=False)}")

    return {
        "message": "Feedback saved. Thank you for helping improve the system.",
        "feedbackId": feedback_id,
    }


# ═════════════════════════════════════════════
#  📄 OCR PIPELINE
# ═════════════════════════════════════════════

# ─────────────────────────────────────────────
#  POST /api/ocr/scan
#  Receive image/PDF/TXT → OCR → raw text
# ─────────────────────────────────────────────
@app.post("/api/ocr/scan")
@limiter.limit("10/minute")
async def ocr_scan(
    request: Request,
    file: UploadFile = File(..., description="Invoice file (JPG/PNG/WEBP/HEIC/PDF/TXT)"),
    language_hint: str = Form(default="auto"),
):
    if not file:
        raise HTTPException(status_code=400, detail="File is required")

    try:
        file_bytes = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {str(e)}")

    try:
        scan_result = await scan_file(
            file_bytes=file_bytes,
            filename=file.filename or "file.jpg",
            language_hint=language_hint,
        )
    except ValueError as e:
        msg = str(e)
        if "too large" in msg.lower():
            raise HTTPException(status_code=413, detail=msg)
        elif "format" in msg.lower():
            raise HTTPException(status_code=422, detail=msg)
        else:
            raise HTTPException(status_code=400, detail=msg)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")

    return scan_result


# ─────────────────────────────────────────────
#  POST /api/ocr/extract
#  OCR text → LLM → structured invoice data
# ─────────────────────────────────────────────
@app.post("/api/ocr/extract")
@limiter.limit("30/minute")
async def ocr_extract(request: Request, body: OcrExtractRequest):
    if not body.rawText or not body.rawText.strip():
        raise HTTPException(status_code=400, detail="rawText field is required")

    try:
        extraction = await extract_from_ocr_text(
            raw_text=body.rawText.strip(),
            structured_ocr=body.structuredOcr,
            language=body.language,
            file_type=body.fileType,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")

    # Internally call categorize
    try:
        ext = extraction["extracted"]
        cat_text = " ".join(filter(None, [
            ext.get("vendor"),
            ext.get("invoiceType"),
            str(ext.get("totalAmount", "")) if ext.get("totalAmount") else None,
            ext.get("currency"),
        ]))
        category = await categorize_transaction(cat_text or body.rawText[:200])
    except Exception:
        category = None

    response = {
        "source": "ocr",
        "fileType": body.fileType,
        "language": body.language,
        "rawText": body.rawText,
        **extraction,
    }
    if category:
        response["category"] = category

    return response


# ─────────────────────────────────────────────
#  POST /api/ocr/feedback
#  Save OCR corrections for retraining
# ─────────────────────────────────────────────
@app.post("/api/ocr/feedback")
@limiter.limit("60/minute")
async def ocr_feedback(request: Request, body: OcrFeedbackRequest):
    import uuid
    import datetime

    feedback_id = str(uuid.uuid4())[:12]

    feedback_record = {
        "feedbackId": feedback_id,
        "originalRawText": body.originalRawText,
        "originalExtraction": body.originalExtraction,
        "correctedExtraction": body.correctedExtraction,
        "language": body.language,
        "fileType": body.fileType,
        "correctedFields": body.correctedFields,
        "hadCorrection": bool(body.correctedFields),
        "createdAt": datetime.datetime.utcnow().isoformat(),
    }

    print(f"[OcrFeedback] {json.dumps(feedback_record, ensure_ascii=False)}")

    return {
        "message": "Feedback saved. Thank you for helping improve the system.",
        "feedbackId": feedback_id,
    }
