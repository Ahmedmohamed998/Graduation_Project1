import os
import io
import time
import tempfile
import asyncio
from pathlib import Path

# ─────────────────────────────────────────────
#  speech_service.py
#  Azure Cognitive Services Speech SDK wrapper
#  Supports: Arabic (ar-EG), English (en-US)
#  Auto-language detection enabled by default
# ─────────────────────────────────────────────

SUPPORTED_AUDIO_FORMATS = {".wav", ".mp3", ".webm", ".ogg", ".m4a"}


def _detect_format(filename: str) -> str:
    """Return the file extension in lowercase, e.g. '.wav'"""
    return Path(filename).suffix.lower()


async def transcribe_audio(
    audio_bytes: bytes,
    filename: str = "audio.wav",
    language_hint: str = "auto",
) -> dict:
    """
    Transcribe audio bytes using Azure Cognitive Services Speech SDK.

    Args:
        audio_bytes : Raw audio file bytes.
        filename    : Original filename — used to detect format/extension.
        language_hint : "auto" | "ar" | "en"

    Returns:
        {
            "transcript"       : str,
            "language"         : "ar" | "en" | "mixed",
            "confidence"       : float (0‑1),
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
        raise ValueError(f"Unsupported audio format: {ext}")

    try:
        import azure.cognitiveservices.speech as speechsdk  # type: ignore
    except ImportError:
        raise RuntimeError(
            "azure-cognitiveservices-speech is not installed. "
            "Run: pip install azure-cognitiveservices-speech==1.38.0"
        )

    speech_key = os.getenv("AZURE_SPEECH_KEY")
    speech_region = os.getenv("AZURE_SPEECH_REGION")

    if not speech_key or not speech_region:
        raise RuntimeError(
            "AZURE_SPEECH_KEY and AZURE_SPEECH_REGION must be set in .env"
        )

    # Write audio bytes to a temp file (SDK needs a file path for push-stream)
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        result = await asyncio.to_thread(
            _run_recognition_sync, tmp_path, language_hint, speech_key, speech_region
        )
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    return result


def _run_recognition_sync(
    audio_path: str,
    language_hint: str,
    speech_key: str,
    speech_region: str,
) -> dict:
    """Synchronous Azure STT call (run in thread via asyncio.to_thread)."""
    import azure.cognitiveservices.speech as speechsdk  # type: ignore

    speech_config = speechsdk.SpeechConfig(
        subscription=speech_key,
        region=speech_region,
    )
    # Request detailed results so we can read confidence
    speech_config.output_format = speechsdk.OutputFormat.Detailed

    audio_config = speechsdk.audio.AudioConfig(filename=audio_path)

    # ── Language configuration ───────────────────────────────────────────────
    if language_hint == "ar":
        speech_config.speech_recognition_language = "ar-EG"
        recognizer = speechsdk.SpeechRecognizer(
            speech_config=speech_config,
            audio_config=audio_config,
        )
    elif language_hint == "en":
        speech_config.speech_recognition_language = "en-US"
        recognizer = speechsdk.SpeechRecognizer(
            speech_config=speech_config,
            audio_config=audio_config,
        )
    else:
        # Auto-detect: Arabic Egypt + English US
        auto_detect_config = speechsdk.languageconfig.AutoDetectSourceLanguageConfig(
            languages=["ar-EG", "en-US"]
        )
        recognizer = speechsdk.SpeechRecognizer(
            speech_config=speech_config,
            audio_config=audio_config,
            auto_detect_source_language_config=auto_detect_config,
        )

    start_time = time.time()
    result = recognizer.recognize_once_async().get()
    duration_seconds = round(time.time() - start_time, 2)

    # ── Handle result ────────────────────────────────────────────────────────
    if result.reason == speechsdk.ResultReason.RecognizedSpeech:
        transcript = result.text.strip()

        # Detected language code, e.g. "ar-EG" or "en-US"
        detected_lang_tag = ""
        try:
            auto_lang_result = speechsdk.AutoDetectSourceLanguageResult(result)
            detected_lang_tag = auto_lang_result.language or ""
        except Exception:
            detected_lang_tag = speech_config.speech_recognition_language or ""

        lang_code = _normalize_language(detected_lang_tag)

        # Confidence from detailed JSON if available
        confidence = _extract_confidence(result)

        return {
            "transcript": transcript,
            "language": lang_code,
            "confidence": confidence,
            "duration_seconds": duration_seconds,
        }

    elif result.reason == speechsdk.ResultReason.NoMatch:
        raise RuntimeError(
            f"No speech recognized. NoMatchDetails: {result.no_match_details}"
        )
    elif result.reason == speechsdk.ResultReason.Canceled:
        cancellation = speechsdk.CancellationDetails(result)
        raise RuntimeError(
            f"Transcription canceled: {cancellation.reason}. "
            f"Error: {cancellation.error_details}"
        )
    else:
        raise RuntimeError(f"Unexpected recognition result reason: {result.reason}")


def _normalize_language(tag: str) -> str:
    """Map Azure language tags like 'ar-EG' → 'ar', 'en-US' → 'en'."""
    tag = (tag or "").lower()
    if tag.startswith("ar"):
        return "ar"
    if tag.startswith("en"):
        return "en"
    return "mixed"


def _extract_confidence(result) -> float:
    """
    Extract NBest[0].Confidence from the detailed recognition result.
    Falls back to 0.8 if detailed JSON is unavailable.
    """
    import json as _json

    try:
        detail = _json.loads(result.json)
        nb = detail.get("NBest", [])
        if nb:
            return round(float(nb[0].get("Confidence", 0.8)), 4)
    except Exception:
        pass
    return 0.8
