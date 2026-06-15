"""
test_endpoints.py
Tests the live voice (STT) and OCR endpoints on hasibha.online.

Usage:
    python test_endpoints.py                        # will prompt for email/password
    python test_endpoints.py --image path/to/receipt.jpg  # supply your own image
    python test_endpoints.py --audio path/to/clip.wav     # supply your own audio

Dependencies (already in the project):  httpx  or  requests
"""

import sys, os, json, wave, struct, math, base64, argparse, io

# ── UTF-8 console on Windows ────────────────────────────────────────────────
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# ── Colour helpers ───────────────────────────────────────────────────────────
G = "\033[92m"; R = "\033[91m"; Y = "\033[93m"; C = "\033[96m"; B = "\033[1m"; X = "\033[0m"
def ok(m):   print(f"  {G}[OK]{X}   {m}")
def err(m):  print(f"  {R}[FAIL]{X} {m}")
def info(m): print(f"  {C}[INFO]{X} {m}")
def hdr(m):  print(f"\n{B}{C}{m}{X}")

# ── HTTP client (prefer httpx, fall back to requests) ───────────────────────
try:
    import httpx as _http
    _USE = "httpx"
except ImportError:
    try:
        import requests as _http
        _USE = "requests"
    except ImportError:
        print(f"{R}ERROR: install httpx:  pip install httpx{X}")
        sys.exit(1)

BASE_URL = "https://hasibha.online"

# ═══════════════════════════════════════════════════════════════════════════
#  1. HELPERS
# ═══════════════════════════════════════════════════════════════════════════

def post_json(url: str, payload: dict, token: str = None, timeout: int = 30):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if _USE == "httpx":
        r = _http.post(url, json=payload, headers=headers, timeout=timeout)
    else:
        r = _http.post(url, json=payload, headers=headers, timeout=timeout)
    return r.status_code, r.json()


def post_file(url: str, field: str, filename: str, data: bytes,
              mimetype: str, token: str, timeout: int = 90):
    headers = {"Authorization": f"Bearer {token}"}
    files = {field: (filename, io.BytesIO(data), mimetype)}
    if _USE == "httpx":
        with _http.Client(timeout=timeout) as client:
            r = client.post(url, files=files, headers=headers)
    else:
        r = _http.post(url, files=files, headers=headers, timeout=timeout)
    try:
        return r.status_code, r.json()
    except Exception:
        return r.status_code, {"raw": r.text[:500]}


# ═══════════════════════════════════════════════════════════════════════════
#  2. GENERATORS  (WAV tone + minimal receipt PNG)
# ═══════════════════════════════════════════════════════════════════════════

def make_wav_tone(freq=440, duration=2.0, sample_rate=16000) -> bytes:
    """Generate a pure-tone WAV (good enough to probe the STT pipeline)."""
    n = int(sample_rate * duration)
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)          # 16-bit
        wf.setframerate(sample_rate)
        for i in range(n):
            v = int(32767 * 0.3 * math.sin(2 * math.pi * freq * i / sample_rate))
            wf.writeframesraw(struct.pack("<h", v))
    return buf.getvalue()


def make_receipt_png() -> bytes:
    """
    Generate a tiny receipt PNG using Pillow if available,
    otherwise fall back to a hard-coded valid 1-pixel PNG.
    """
    try:
        from PIL import Image, ImageDraw, ImageFont
        img = Image.new("RGB", (400, 300), color=(255, 255, 255))
        d = ImageDraw.Draw(img)
        receipt = [
            "===== RECEIPT =====",
            "Date:   2024-06-10",
            "Store:  Cairo Market",
            "",
            "Bread        12.50 EGP",
            "Milk         18.00 EGP",
            "Cheese       35.00 EGP",
            "-------------------",
            "TOTAL:       65.50 EGP",
            "===================",
        ]
        try:
            font = ImageFont.truetype("arial.ttf", 18)
        except Exception:
            font = ImageFont.load_default()
        y = 20
        for line in receipt:
            d.text((20, y), line, fill=(0, 0, 0), font=font)
            y += 26
        out = io.BytesIO()
        img.save(out, format="PNG")
        info("Receipt image generated with Pillow")
        return out.getvalue()
    except ImportError:
        # Minimal 1×1 white PNG — still exercises the full pipeline
        info("Pillow not installed — using minimal test PNG (install Pillow for a real receipt image)")
        return base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4"
            "nGP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=="
        )


# ═══════════════════════════════════════════════════════════════════════════
#  3. AUTH — login to get JWT
# ═══════════════════════════════════════════════════════════════════════════

def login(email: str, password: str) -> str:
    hdr("[1/3] Logging in to get JWT token...")
    url = f"{BASE_URL}/api/auth/login"
    code, body = post_json(url, {"email": email, "password": password})
    if code == 200 and body.get("success"):
        token = body.get("accessToken", "")
        ok(f"Login successful  (user: {body.get('username','?')})")
        info(f"Token: {token[:40]}...")
        return token
    else:
        err(f"Login failed  HTTP {code}: {json.dumps(body)[:200]}")
        sys.exit(1)


# ═══════════════════════════════════════════════════════════════════════════
#  4. TEST VOICE TRANSCRIBE
# ═══════════════════════════════════════════════════════════════════════════

def test_voice(token: str, audio_path: str = None):
    hdr("[2/3] Testing POST /api/voice/transcribe ...")

    if audio_path:
        with open(audio_path, "rb") as f:
            audio_bytes = f.read()
        filename = os.path.basename(audio_path)
        mime = "audio/wav" if filename.endswith(".wav") else "audio/mpeg"
        info(f"Using provided audio file: {filename} ({len(audio_bytes)//1024} KB)")
    else:
        audio_bytes = make_wav_tone(freq=440, duration=2.0)
        filename = "test_tone.wav"
        mime = "audio/wav"
        info(f"Generated test WAV tone ({len(audio_bytes)} bytes) — Azure STT will return empty/no transcription for a tone, but this confirms the full pipeline works.")

    url = f"{BASE_URL}/api/voice/transcribe"
    print(f"  Sending to {url} ...\n")
    code, body = post_file(url, "audio", filename, audio_bytes, mime, token)

    if code == 200:
        ok(f"HTTP {code} — pipeline reached Azure STT successfully")
        transcript = body.get("transcript", "")
        if transcript:
            ok(f"Transcript: {transcript}")
        else:
            info("Transcript is empty (expected for a tone; use a real audio clip to test transcription quality)")
        lang = body.get("detectedLanguage") or body.get("language")
        if lang:
            info(f"Detected language: {lang}")
        print(f"\n  Full response:\n  {json.dumps(body, indent=4, ensure_ascii=False)[:800]}")
    else:
        err(f"HTTP {code}: {json.dumps(body)[:400]}")


# ═══════════════════════════════════════════════════════════════════════════
#  5. TEST OCR SCAN
# ═══════════════════════════════════════════════════════════════════════════

def test_ocr(token: str, image_path: str = None):
    hdr("[3/3] Testing POST /api/ocr/scan ...")

    if image_path:
        with open(image_path, "rb") as f:
            img_bytes = f.read()
        filename = os.path.basename(image_path)
        ext = filename.rsplit(".", 1)[-1].lower()
        mime_map = {"jpg": "image/jpeg", "jpeg": "image/jpeg",
                    "png": "image/png", "pdf": "application/pdf"}
        mime = mime_map.get(ext, "image/jpeg")
        info(f"Using provided image: {filename} ({len(img_bytes)//1024} KB)")
    else:
        img_bytes = make_receipt_png()
        filename = "test_receipt.png"
        mime = "image/png"
        info(f"Using generated receipt PNG ({len(img_bytes)} bytes)")

    url = f"{BASE_URL}/api/ocr/scan"
    print(f"  Sending to {url} ...\n")
    code, body = post_file(url, "file", filename, img_bytes, mime, token, timeout=90)

    if code == 200:
        ok(f"HTTP {code} — pipeline reached Azure Document Intelligence successfully")
        raw = body.get("rawText") or body.get("text") or ""
        if raw:
            ok(f"Extracted text:\n\n{raw[:600]}")
        confidence = body.get("confidence") or body.get("ocrConfidence")
        if confidence is not None:
            info(f"OCR confidence: {confidence}")
            
        hdr("[3.5/3] Testing POST /api/ocr/extract (Categorization) ...")
        extract_url = f"{BASE_URL}/api/ocr/extract"
        extract_payload = {
            "rawText": body.get("rawText", ""),
            "structuredOcr": body.get("structuredOcr", {}),
            "language": body.get("language", "auto"),
            "fileType": "image"
        }
        
        ex_code, ex_body = post_json(extract_url, extract_payload, token, timeout=180)
        if ex_code == 200:
            ok(f"HTTP {ex_code} — LLM Categorization successful")
            print(f"\n  Final Categorized Output:\n  {json.dumps(ex_body, indent=4, ensure_ascii=False)}")
        else:
            err(f"LLM Extract failed HTTP {ex_code}: {json.dumps(ex_body)[:400]}")
    else:
        err(f"HTTP {code}: {json.dumps(body)[:400]}")


# ═══════════════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="Test hasibha.online live endpoints")
    parser.add_argument("--email",  default="",  help="Account email")
    parser.add_argument("--password", default="", help="Account password")
    parser.add_argument("--image",  default="",  help="Path to a receipt/bill image for OCR test")
    parser.add_argument("--audio",  default="",  help="Path to a WAV/MP3 audio file for STT test")
    args = parser.parse_args()

    print(f"\n{B}{C}" + "-"*55)
    print("  Hasibha Live Endpoint Tester")
    print(f"  Target: {BASE_URL}")
    print("-"*55 + X)

    email    = args.email    or input("\n  Email:    ").strip()
    password = args.password or input("  Password: ").strip()

    token = login(email, password)
    test_voice(token, args.audio or None)
    test_ocr(token, args.image or None)

    print(f"\n{B}Done.{X}\n")


if __name__ == "__main__":
    main()
