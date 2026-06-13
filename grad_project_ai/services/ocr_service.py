import os
import io
import asyncio
import tempfile
from pathlib import Path

# ─────────────────────────────────────────────
#  ocr_service.py
#  Azure Document Intelligence + pytesseract fallback
#  Supports: JPG, PNG, WEBP, HEIC, PDF, TXT
#  Max file size: 10 MB
# ─────────────────────────────────────────────

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

SUPPORTED_IMAGE_FORMATS = {".jpg", ".jpeg", ".png", ".webp", ".heic", ".tiff"}
SUPPORTED_PDF_FORMATS   = {".pdf"}
SUPPORTED_TEXT_FORMATS  = {".txt"}
ALL_SUPPORTED_FORMATS   = (
    SUPPORTED_IMAGE_FORMATS | SUPPORTED_PDF_FORMATS | SUPPORTED_TEXT_FORMATS
)


def _detect_format(filename: str) -> str:
    return Path(filename).suffix.lower()


def _classify_file(ext: str) -> str:
    if ext in SUPPORTED_IMAGE_FORMATS:
        return "image"
    if ext in SUPPORTED_PDF_FORMATS:
        return "pdf"
    if ext in SUPPORTED_TEXT_FORMATS:
        return "text"
    return "unknown"


async def scan_file(
    file_bytes: bytes,
    filename: str = "file.jpg",
    language_hint: str = "auto",
) -> dict:
    """
    Main entry point.  Routes to the correct reader based on file type.

    Returns:
        {
            "fileType"     : "image" | "pdf" | "text",
            "language"     : "ar" | "en" | "mixed",
            "rawText"      : str,
            "structuredOcr": dict | None,
            "confidence"   : float,
        }
    """
    if not file_bytes:
        raise ValueError("File is required")

    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise ValueError("File too large (max 10MB)")

    ext = _detect_format(filename)
    if ext not in ALL_SUPPORTED_FORMATS:
        raise ValueError(f"Unsupported file format: {ext}")

    file_type = _classify_file(ext)

    if file_type == "text":
        return await _read_txt(file_bytes, language_hint)
    elif file_type == "image":
        return await _read_image(file_bytes, filename, language_hint)
    elif file_type == "pdf":
        return await _read_pdf(file_bytes, language_hint)


# ─────────────────────────────────────────────────────────────────────────────
#  Plain text — no OCR needed
# ─────────────────────────────────────────────────────────────────────────────
async def _read_txt(file_bytes: bytes, language_hint: str) -> dict:
    raw_text = file_bytes.decode("utf-8", errors="replace").strip()
    lang = _infer_language(raw_text, language_hint)
    return {
        "fileType": "text",
        "language": lang,
        "rawText": raw_text,
        "structuredOcr": None,
        "confidence": 1.0,
    }


# ─────────────────────────────────────────────────────────────────────────────
#  Image — Azure Document Intelligence → pytesseract fallback
# ─────────────────────────────────────────────────────────────────────────────
async def _read_image(
    file_bytes: bytes,
    filename: str,
    language_hint: str,
) -> dict:
    # Try Azure Document Intelligence first
    try:
        result = await asyncio.to_thread(
            _azure_doc_intel_sync, file_bytes, filename, "prebuilt-receipt"
        )
        lang = _infer_language(result.get("rawText", ""), language_hint)
        result["fileType"] = "image"
        result["language"] = lang
        return result
    except Exception as azure_err:
        import logging
        logging.getLogger(__name__).warning(
            "Azure Document Intelligence failed, falling back to pytesseract: %s", azure_err
        )
        # fall through to pytesseract

    # Pytesseract fallback
    try:
        result = await asyncio.to_thread(_pytesseract_sync, file_bytes, language_hint)
        lang = _infer_language(result.get("rawText", ""), language_hint)
        result["fileType"] = "image"
        result["language"] = lang
        return result
    except Exception as tess_err:
        raise RuntimeError(f"OCR processing failed: {tess_err}")


# ─────────────────────────────────────────────────────────────────────────────
#  PDF — convert pages to images → Azure Doc Intelligence per page
# ─────────────────────────────────────────────────────────────────────────────
async def _read_pdf(file_bytes: bytes, language_hint: str) -> dict:
    # Try Azure Document Intelligence on the raw PDF directly
    try:
        result = await asyncio.to_thread(
            _azure_doc_intel_sync, file_bytes, "document.pdf", "prebuilt-document"
        )
        lang = _infer_language(result.get("rawText", ""), language_hint)
        result["fileType"] = "pdf"
        result["language"] = lang
        return result
    except Exception:
        pass

    # Fallback: pdf2image → pytesseract per page
    try:
        result = await asyncio.to_thread(
            _pdf_via_images_sync, file_bytes, language_hint
        )
        lang = _infer_language(result.get("rawText", ""), language_hint)
        result["fileType"] = "pdf"
        result["language"] = lang
        return result
    except Exception as err:
        raise RuntimeError(f"OCR processing failed: {err}")


# ─────────────────────────────────────────────────────────────────────────────
#  Sync helpers (run inside asyncio.to_thread)
# ─────────────────────────────────────────────────────────────────────────────
def _azure_doc_intel_sync(
    file_bytes: bytes, filename: str, model_id: str
) -> dict:
    """Call Azure Document Intelligence synchronously."""
    from azure.ai.documentintelligence import DocumentIntelligenceClient  # type: ignore
    from azure.core.credentials import AzureKeyCredential               # type: ignore

    endpoint = os.getenv("AZURE_DOC_INTEL_ENDPOINT")
    key      = os.getenv("AZURE_DOC_INTEL_KEY")

    if not endpoint or not key:
        raise RuntimeError(
            "AZURE_DOC_INTEL_ENDPOINT and AZURE_DOC_INTEL_KEY must be set in .env"
        )

    client = DocumentIntelligenceClient(
        endpoint=endpoint,
        credential=AzureKeyCredential(key),
    )

    poller = client.begin_analyze_document(
        model_id,
        body=io.BytesIO(file_bytes),
        content_type="application/octet-stream",
    )
    analyze_result = poller.result()

    # ── Extract raw text ────────────────────────────────────────────────────
    raw_text_parts = []
    for page in (analyze_result.pages or []):
        for line in (page.lines or []):
            raw_text_parts.append(line.content)
    raw_text = "\n".join(raw_text_parts)

    # ── Extract structured receipt fields ───────────────────────────────────
    structured = None
    if analyze_result.documents:
        doc = analyze_result.documents[0]
        fields = doc.fields or {}
        structured = _parse_receipt_fields(fields)

    # ── Confidence ──────────────────────────────────────────────────────────
    confidence = 0.9
    if analyze_result.documents:
        conf_vals = [
            f.confidence
            for f in (analyze_result.documents[0].fields or {}).values()
            if hasattr(f, "confidence") and f.confidence is not None
        ]
        if conf_vals:
            confidence = round(sum(conf_vals) / len(conf_vals), 4)

    return {
        "rawText": raw_text,
        "structuredOcr": structured,
        "confidence": confidence,
    }


def _parse_receipt_fields(fields: dict) -> dict:
    """Convert Azure receipt fields dict → our structuredOcr shape."""
    def get_val(key):
        f = fields.get(key)
        if f is None:
            return None
        return getattr(f, "value", None) or getattr(f, "content", None)

    items = []
    items_field = fields.get("Items")
    if items_field and hasattr(items_field, "value"):
        for item in (items_field.value or []):
            item_fields = getattr(item, "value", {}) or {}
            qty = _field_val(item_fields, "Quantity") or 1
            unit_p = _field_val(item_fields, "Price")
            total_p = _field_val(item_fields, "TotalPrice")
            # Compute total_price if missing
            if total_p is None and unit_p is not None:
                try:
                    total_p = round(float(unit_p) * float(qty), 2)
                except (TypeError, ValueError):
                    total_p = None
            items.append({
                "name"        : _field_val(item_fields, "Description"),
                "name_en"     : _field_val(item_fields, "Description"),  # Azure returns English for en receipts
                "quantity"    : qty,
                "unit_price"  : unit_p,
                "total_price" : total_p,
            })

    return {
        "vendor"   : get_val("MerchantName"),
        "date"     : str(get_val("TransactionDate") or "") or None,
        "items"    : items,
        "subtotal" : get_val("Subtotal"),
        "tax"      : get_val("TotalTax"),
        "total"    : get_val("Total"),
        "currency" : "EGP",  # Azure doesn't always return currency for EGP receipts
    }


def _field_val(fields: dict, key: str):
    f = fields.get(key)
    if f is None:
        return None
    return getattr(f, "value", None) or getattr(f, "content", None)


def _pytesseract_sync(file_bytes: bytes, language_hint: str) -> dict:
    """Fallback OCR using pytesseract."""
    try:
        import pytesseract                          # type: ignore
        from PIL import Image                       # type: ignore
    except ImportError:
        raise RuntimeError(
            "pytesseract and Pillow are required for the OCR fallback. "
            "Run: pip install pytesseract pillow"
        )

    image = Image.open(io.BytesIO(file_bytes))

    lang_map = {"ar": "ara", "en": "eng", "auto": "ara+eng"}
    tess_lang = lang_map.get(language_hint, "ara+eng")

    raw_text = pytesseract.image_to_string(image, lang=tess_lang).strip()

    return {
        "rawText": raw_text,
        "structuredOcr": None,
        "confidence": 0.6,
    }


def _pdf_via_images_sync(file_bytes: bytes, language_hint: str) -> dict:
    """Convert PDF pages to images then OCR each page."""
    try:
        from pdf2image import convert_from_bytes    # type: ignore
    except ImportError:
        raise RuntimeError(
            "pdf2image is required. Run: pip install pdf2image"
        )
    try:
        import pytesseract                          # type: ignore
    except ImportError:
        raise RuntimeError(
            "pytesseract is required. Run: pip install pytesseract"
        )

    pages = convert_from_bytes(file_bytes, dpi=200)
    lang_map = {"ar": "ara", "en": "eng", "auto": "ara+eng"}
    tess_lang = lang_map.get(language_hint, "ara+eng")

    all_text = []
    for page_img in pages:
        text = pytesseract.image_to_string(page_img, lang=tess_lang)
        all_text.append(text.strip())

    return {
        "rawText": "\n\n".join(all_text),
        "structuredOcr": None,
        "confidence": 0.6,
    }


# ─────────────────────────────────────────────────────────────────────────────
#  Language detection helper
# ─────────────────────────────────────────────────────────────────────────────
def _infer_language(text: str, hint: str) -> str:
    """
    If hint is explicit ('ar' or 'en') return it.
    Otherwise do a simple heuristic based on Arabic Unicode characters.
    """
    if hint in ("ar", "en"):
        return hint

    if not text:
        return "en"

    arabic_chars = sum(1 for c in text if "\u0600" <= c <= "\u06FF")
    ratio = arabic_chars / max(len(text), 1)

    if ratio > 0.4:
        return "ar"
    if ratio > 0.1:
        return "mixed"
    return "en"
