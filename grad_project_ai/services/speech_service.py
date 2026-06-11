import os
import io
import time
import asyncio
import httpx
from pathlib import Path

# ─────────────────────────────────────────────
#  speech_service.py
#  Azure Speech-to-Text via REST API
#  (replaces the SDK which has OpenSSL compat issues in Docker)
#  Supports: Arabic (ar-EG), English (en-US), auto-detect
# ─────────────────────────────────────────────

SUPPORTED_AUDIO_FORMATS = {".wav", ".mp3", ".webm", ".ogg", ".m4a"}

# Map file extension → Content-Type accepted by Azure STT REST API
_CONTENT_TYPE_MAP = {
    ".wav":  "audio/wav",
    ".mp3":  "audio/mpeg",
    ".webm": "audio/webm; codecs=opus",
    ".ogg":  "audio/ogg; codecs=opus",
    ".m4a":  "audio/mp4",
}


def _detect_format(filename: str) -> str:
    return Path(filename).suffix.lower()


async def transcribe_audio(
    audio_bytes: bytes,
    filename: str = "audio.wav",
    language_hint: str = "auto",
) -> dict:
    """
    Transcribe audio bytes using Azure Speech-to-Text REST API.

    Args:
        audio_bytes   : Raw audio file bytes.
        filename      : Original filename — used to detect the audio format.
        language_hint : "auto" | "ar" | "en"

    Returns:
        {
            "transcript"       : str,
            "language"         : "ar" | "en" | "mixed",
            "confidence"       : float (0–1),
            "duration_seconds" : float,
        }

    Raises:
        ValueError  — unsupported format or empty audio.
        RuntimeError — transcription failed (Azure error).
    """
    if not audio_bytes:
        raise ValueError("Audio file is required")

    ext = _detect_format(filename)
    if ext not in SUPPORTED_AUDIO_FORMATS:
        raise ValueError(f"Unsupported audio format '{ext}'. Supported: {SUPPORTED_AUDIO_FORMATS}")

    speech_key    = os.getenv("AZURE_SPEECH_KEY")
    speech_region = os.getenv("AZURE_SPEECH_REGION")

    if not speech_key or not speech_region:
        raise RuntimeError("AZURE_SPEECH_KEY and AZURE_SPEECH_REGION must be set in .env")

    content_type = _CONTENT_TYPE_MAP.get(ext, "audio/wav")

    # Which languages to attempt (in order)
    if language_hint == "ar":
        candidates = ["ar-EG"]
    elif language_hint == "en":
        candidates = ["en-US"]
    else:
        # Auto: try Arabic first (primary user-base), then English
        candidates = ["ar-EG", "en-US"]

    start_time = time.time()
    last_error  = None

    async with httpx.AsyncClient(timeout=60.0) as client:
        for locale in candidates:
            url = (
                f"https://{speech_region}.stt.speech.microsoft.com"
                f"/speech/recognition/conversation/cognitiveservices/v1"
            )
            params  = {"language": locale, "format": "detailed"}
            headers = {
                "Ocp-Apim-Subscription-Key": speech_key,
                "Content-Type": content_type,
            }

            try:
                resp = await client.post(
                    url, params=params, headers=headers, content=audio_bytes
                )
                resp.raise_for_status()
                data = resp.json()
            except httpx.HTTPStatusError as exc:
                last_error = f"HTTP {exc.response.status_code}: {exc.response.text[:200]}"
                continue
            except Exception as exc:
                last_error = str(exc)
                continue

            status = data.get("RecognitionStatus", "")

            if status == "Success":
                transcript = data.get("DisplayText", "").strip()
                confidence = 0.8
                nb = data.get("NBest", [])
                if nb:
                    confidence = round(float(nb[0].get("Confidence", 0.8)), 4)

                lang_code = "ar" if locale.startswith("ar") else "en"
                duration  = round(time.time() - start_time, 2)

                return {
                    "transcript":       transcript,
                    "language":         lang_code,
                    "confidence":       confidence,
                    "duration_seconds": duration,
                }

            elif status == "NoMatch":
                # No speech detected in this locale — try next candidate
                continue

            elif status == "InitialSilenceTimeout":
                # Audio is silent — return empty transcript rather than erroring
                return {
                    "transcript":       "",
                    "language":         "mixed",
                    "confidence":       0.0,
                    "duration_seconds": round(time.time() - start_time, 2),
                }

            else:
                last_error = f"Azure STT status: {status}"
                continue

    # All candidates exhausted — no speech found
    if last_error:
        raise RuntimeError(f"Transcription failed: {last_error}")

    # Soft return: no speech detected in any locale
    return {
        "transcript":       "",
        "language":         "mixed",
        "confidence":       0.0,
        "duration_seconds": round(time.time() - start_time, 2),
    }
