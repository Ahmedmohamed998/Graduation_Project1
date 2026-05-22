# 🚀 AI Service — Implemented APIs
> **For:** Backend Partner (home-backend developer)  
> **From:** AI / Data Partner  
> **Date:** April 2026  
> **Service:** `grad_project_ai` — Python / FastAPI on `http://localhost:8000`

---

## ✅ What Has Been Implemented

All **6 new endpoints** specified in `VOICE_FEATURE_SPEC.md` are now implemented and ready.  
The 2 existing endpoints (`/api/ai/chat`, `/api/ai/categorize`) are **untouched**.

---

## 📂 New Files Created

### In `grad_project_ai/` (Python service)

| File | Status | What it does |
|------|--------|--------------|
| `services/speech_service.py` | ✅ NEW | Azure Speech SDK — audio → transcript |
| `services/ocr_service.py` | ✅ NEW | Azure Doc Intelligence + pytesseract fallback |
| `services/llm_service.py` | ✅ MODIFIED | Added `extract_transaction_info()` + `extract_from_ocr_text()` |
| `main.py` | ✅ MODIFIED | 6 new routes added |
| `requirements.txt` | ✅ MODIFIED | 6 new packages added |
| `.env` | ✅ MODIFIED | 4 new env var placeholders added |

### In `home-backend/` (your Node.js service)

| File | Status | What it does |
|------|--------|--------------|
| `routes/voice.js` | ✅ NEW | Proxy for all `/api/voice/*` endpoints |
| `routes/ocr.js` | ✅ NEW | Proxy for all `/api/ocr/*` endpoints |
| `models/VoiceFeedback.js` | ✅ NEW | Mongoose schema for voice corrections |
| `models/OcrFeedback.js` | ✅ NEW | Mongoose schema for OCR corrections |
| `server_additions.js` | ✅ NEW | Snippets to merge into your `server.js` |

---

## 🔧 What You Need To Do (Backend Partner)

### 1. Install npm packages (in `home-backend/`)
```bash
npm install multer form-data node-fetch
```

### 2. Add to your `server.js`
```javascript
app.use('/api/voice', require('./routes/voice'));
app.use('/api/ocr', express.raw({ limit: '10mb', type: '*/*' }));
app.use('/api/ocr', require('./routes/ocr'));
```
See `home-backend/server_additions.js` for the full reference block.

### 3. Fill in `.env` keys in `grad_project_ai/.env`
```env
AZURE_SPEECH_KEY=<your_azure_speech_resource_key>
AZURE_SPEECH_REGION=<region_e.g._eastus>
AZURE_DOC_INTEL_KEY=<your_document_intelligence_key>
AZURE_DOC_INTEL_ENDPOINT=https://<your-resource>.cognitiveservices.azure.com/
```

### 4. Install Python packages
```bash
cd grad_project_ai
pip install -r requirements.txt
```

---

## 🎙️ Voice Endpoints

### `POST /api/voice/transcribe`
> Records speech → returns transcript. Call via the home-backend proxy at port 5001.

**Request:** `multipart/form-data`  
**Auth:** `Authorization: Bearer <accessToken>` *(home-backend validates)*

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `audio` | File | ✅ | WAV / MP3 / WebM / OGG / M4A |
| `language_hint` | string | ❌ | `"auto"` (default) \| `"ar"` \| `"en"` |

**Success Response `200`:**
```json
{
  "transcript": "اشتريت لاتيه من ستاربكس بـ 75 جنيه",
  "language": "ar",
  "confidence": 0.96,
  "duration_seconds": 3.2
}
```

**Error Responses:**

| Status | Detail |
|--------|--------|
| 400 | `"Audio file is required"` |
| 422 | `"Unsupported audio format: .xxx"` |
| 500 | `"Transcription failed: <reason>"` |
| 504 | `"Transcription timed out"` |

**Rate limit:** 10 requests / minute

---

### `POST /api/voice/extract`
> Transcript text → structured financial data + category (chained internally).

**Request:** `application/json`  
**Auth:** `Authorization: Bearer <accessToken>`

```json
{
  "transcript": "اشتريت لاتيه من ستاربكس بـ 75 جنيه",
  "language": "ar"
}
```

**Success Response `200`:**
```json
{
  "source": "voice",
  "transcript": "اشتريت لاتيه من ستاربكس بـ 75 جنيه",
  "language": "ar",
  "extracted": {
    "itemName": "Latte",
    "merchant": "Starbucks",
    "amount": 75.0,
    "currency": "EGP",
    "quantity": 1,
    "date": null,
    "rawTranscript": "اشتريت لاتيه من ستاربكس بـ 75 جنيه"
  },
  "confidence": 0.91,
  "missingFields": [],
  "needsConfirmation": true,
  "category": {
    "type": "expense",
    "categoryGroup": "Food & Dining",
    "category": "Coffee/Snacks/Fast Food",
    "confidence": 0.92
  }
}
```

> ⚠️ If `missingFields` is non-empty or `confidence < 0.9`, show the user a confirmation card with editable fields.

**Rate limit:** 30 requests / minute

---

### `POST /api/voice/feedback`
> Saves user corrections. The home-backend stores these in MongoDB with the `userId` from the JWT.

**Request:** `application/json`  
**Auth:** `Authorization: Bearer <accessToken>`

```json
{
  "originalTranscript": "اشتريت شبشب من البرج بـ 200",
  "originalExtraction": {
    "itemName": "Shoe",
    "merchant": "El-Borg",
    "amount": 200,
    "currency": "EGP"
  },
  "correctedExtraction": {
    "itemName": "Slippers",
    "merchant": "El-Borg Mall",
    "amount": 200,
    "currency": "EGP"
  },
  "language": "ar",
  "correctedFields": ["itemName", "merchant"],

  "finalCategory": "Clothing",
  "finalCategoryGroup": "Shopping",
  "finalType": "expense",
  "transactionId": "<mongodb_objectid>",
  "transcriptionConfidence": 0.96,
  "extractionConfidence": 0.72
}
```

**Success Response `200`:**
```json
{
  "message": "Feedback saved. Thank you for helping improve the system.",
  "feedbackId": "<mongodb_objectid>"
}
```

**Rate limit:** 60 requests / minute

---

## 📄 OCR Endpoints

### `POST /api/ocr/scan`
> Upload invoice/receipt → OCR → raw text + structured fields.

**Request:** `multipart/form-data`  
**Auth:** `Authorization: Bearer <accessToken>`

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `file` | File | ✅ | JPG / PNG / WEBP / HEIC / PDF / TXT (max 10 MB) |
| `language_hint` | string | ❌ | `"auto"` (default) \| `"ar"` \| `"en"` |

**Success Response `200` (image/PDF):**
```json
{
  "fileType": "image",
  "language": "ar",
  "rawText": "مطعم كوشري التحرير\nكوشري كبير × 2 = 50 جنيه\nالإجمالي: 65 جنيه",
  "structuredOcr": {
    "vendor": "كوشري التحرير",
    "date": "2026-04-13",
    "items": [
      { "name": "كوشري كبير", "quantity": 2, "unitPrice": 25, "totalPrice": 50 }
    ],
    "subtotal": 65,
    "tax": 0,
    "total": 65,
    "currency": "EGP"
  },
  "confidence": 0.94
}
```

**Success Response `200` (plain text file):**
```json
{
  "fileType": "text",
  "language": "en",
  "rawText": "Monthly rent invoice\nAmount: 7500 EGP\nPeriod: April 2026",
  "structuredOcr": null,
  "confidence": 1.0
}
```

**Error Responses:**

| Status | Detail |
|--------|--------|
| 400 | `"File is required"` |
| 413 | `"File too large (max 10MB)"` |
| 422 | `"Unsupported file format: .docx"` |
| 500 | `"OCR processing failed: <reason>"` |

**Rate limit:** 10 requests / minute

---

### `POST /api/ocr/extract`
> OCR text → LLM → clean structured invoice + category.

**Request:** `application/json`  
**Auth:** `Authorization: Bearer <accessToken>`

```json
{
  "rawText": "مطعم كوشري التحرير\nالإجمالي: 65 جنيه",
  "structuredOcr": {
    "vendor": "كوشري التحرير",
    "total": 65,
    "currency": "EGP",
    "date": "2026-04-13"
  },
  "language": "ar",
  "fileType": "image"
}
```

> ℹ️ `structuredOcr` is optional — pass `null` for plain text files.

**Success Response `200`:**
```json
{
  "source": "ocr",
  "fileType": "image",
  "language": "ar",
  "rawText": "...",
  "extracted": {
    "vendor": "Koshary El-Tahrir",
    "vendorArabic": "كوشري التحرير",
    "invoiceType": "restaurant",
    "items": [
      { "name": "Large Koshary", "quantity": 2, "unitPrice": 25, "totalPrice": 50 }
    ],
    "totalAmount": 65.0,
    "taxAmount": 0.0,
    "currency": "EGP",
    "date": "2026-04-13",
    "rawText": "..."
  },
  "suggestedTransaction": {
    "type": "expense",
    "amount": 65.0,
    "description": "Koshary El-Tahrir — Large Koshary"
  },
  "confidence": 0.93,
  "missingFields": [],
  "needsConfirmation": true,
  "category": {
    "type": "expense",
    "categoryGroup": "Food & Dining",
    "category": "Restaurants/Dining Out",
    "confidence": 0.95
  }
}
```

**Rate limit:** 30 requests / minute

---

### `POST /api/ocr/feedback`
> Saves OCR corrections to MongoDB.

**Request:** `application/json`  
**Auth:** `Authorization: Bearer <accessToken>`

```json
{
  "originalRawText": "مطعم كوشري التحرير\nالإجمالي: 65 جنيه",
  "originalExtraction": {
    "vendor": "Koshary El-Tahrir",
    "totalAmount": 65,
    "currency": "EGP",
    "invoiceType": "restaurant"
  },
  "correctedExtraction": {
    "vendor": "Koshary El-Tahrir Restaurant",
    "totalAmount": 65,
    "currency": "EGP",
    "invoiceType": "restaurant"
  },
  "language": "ar",
  "fileType": "image",
  "correctedFields": ["vendor"],
  "finalCategory": "Restaurants/Dining Out",
  "finalCategoryGroup": "Food & Dining",
  "finalType": "expense",
  "transactionId": "<mongodb_objectid>",
  "ocrConfidence": 0.94,
  "extractionConfidence": 0.88
}
```

**Success Response `200`:**
```json
{
  "message": "Feedback saved. Thank you for helping improve the system.",
  "feedbackId": "<mongodb_objectid>"
}
```

**Rate limit:** 60 requests / minute

---

## 🔄 Recommended Frontend Flow

### Voice Pipeline
```
1. Record audio  →  POST /api/voice/transcribe  →  { transcript, language }
2.                  POST /api/voice/extract { transcript, language }
                    ← { extracted, category, missingFields, needsConfirmation }
3. Show Confirmation Card (editable fields)
4a. If user corrected anything → POST /api/voice/feedback
4b. Always → POST /api/transactions  (existing endpoint, unchanged)
```

### OCR Pipeline
```
1. User picks file  →  POST /api/ocr/scan  →  { rawText, structuredOcr, fileType }
2.                     POST /api/ocr/extract { rawText, structuredOcr, language, fileType }
                       ← { extracted, suggestedTransaction, category, missingFields }
3. Show Confirmation Card (editable fields)
4a. If user corrected anything → POST /api/ocr/feedback
4b. Always → POST /api/transactions  (existing endpoint, unchanged)
```

---

## 🗄️ New MongoDB Collections

### `voicefeedbacks`
Stores voice correction data. Auto-created when the first document is inserted.  
Schema: `home-backend/models/VoiceFeedback.js`

**Key fields:**
- `userId` — from JWT (never from client)
- `hadCorrection` — `true` if user changed anything (training signal)
- `correctedFields` — which fields were wrong

### `ocrfeedbacks`
Stores OCR correction data.  
Schema: `home-backend/models/OcrFeedback.js`

---

## ⚠️ Important Notes

> [!IMPORTANT]
> **Azure credentials are required before running.** Add `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION`, `AZURE_DOC_INTEL_KEY`, and `AZURE_DOC_INTEL_ENDPOINT` to `grad_project_ai/.env`.

> [!NOTE]
> `userId` always comes from `req.userId` (set by `verifyToken`) — never trust client-sent userId.

> [!NOTE]
> Audio and image/PDF files are processed **in-memory only** — never written to disk permanently.

> [!NOTE]
> If Azure Document Intelligence is unavailable, **pytesseract runs automatically as fallback**.

> [!NOTE]
> The `/api/transactions` endpoint is completely unchanged — the frontend calls it directly.

---

## 🧪 Quick Test Commands

```bash
# Test voice transcribe (direct to Python)
curl -X POST http://localhost:8000/api/voice/transcribe \
  -F "audio=@test_arabic.wav" \
  -F "language_hint=auto"

# Test voice extract
curl -X POST http://localhost:8000/api/voice/extract \
  -H "Content-Type: application/json" \
  -d '{"transcript": "bought 2 coffees at Costa for 90 pounds", "language": "en"}'

# Test OCR scan
curl -X POST http://localhost:8000/api/ocr/scan \
  -F "file=@receipt.jpg" \
  -F "language_hint=ar"

# Test OCR extract
curl -X POST http://localhost:8000/api/ocr/extract \
  -H "Content-Type: application/json" \
  -d '{"rawText": "Starbucks\nLatte x2 = 150 EGP\nTotal: 150 EGP", "language": "en", "fileType": "image"}'

# Full pipeline test via home-backend (with JWT):
curl -X POST http://localhost:5001/api/voice/transcribe \
  -H "Authorization: Bearer <your_jwt_token>" \
  -F "audio=@test_audio.wav"
```

---

*AI Partner Delivery — April 2026 | Project: Intelligent Personal Budgeting Application*
