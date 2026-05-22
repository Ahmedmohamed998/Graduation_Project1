# 🎙️📄 Voice + OCR → Transaction Feature — Full Technical Specification
> **For AI Partner / Developer**  
> Document Version: 2.0 | Date: April 2026  
> Project: Intelligent Personal Budgeting Application

> **This document covers TWO input pipelines:**
> - 🎙️ **Voice** — User speaks a transaction, AI transcribes + extracts + categorizes
> - 📄 **OCR** — User uploads a photo/PDF/text invoice, AI reads + extracts + categorizes
> Both pipelines share the same confirmation → feedback → categorize → save flow.

---

## 📌 IMPORTANT — Read This First

This document gives you **everything you need** to implement both a **voice-based** and an **OCR-based** transaction entry feature for an existing full-stack budgeting app. Before writing a single line of code, read all sections carefully. This system is already partially built — you are **extending** it, not starting from scratch.

---

## 🏗️ 1. Existing Project — Full Architecture Overview

The project is split into **3 independent microservices** that communicate over HTTP:

```
┌──────────────────────────────────────────────────────────────┐
│                   FRONTEND (React / Mobile)                  │
│                  http://localhost:3210                        │
└────────┬──────────────────┬──────────────────────────────────┘
         │                  │                  │
         ▼                  ▼                  ▼
┌─────────────────┐ ┌────────────────┐ ┌──────────────────────┐
│  auth-backend   │ │  home-backend  │ │   grad_project_ai    │
│  Port: 3210     │ │  Port: 5001    │ │   Port: 8000         │
│  Node.js/Express│ │  Node.js/Expr. │ │   Python/FastAPI     │
│  MongoDB        │ │  MongoDB       │ │   Azure OpenAI       │
└────────┬────────┘ └───────┬────────┘ └──────────┬───────────┘
         │                  │                      │
         └──────────────────┴──────────────────────┘
                            │
                     ┌──────▼──────┐
                     │   MongoDB   │
                     │  (shared)   │
                     │ hexaverse-  │
                     │    auth     │
                     └─────────────┘
```

### Directory Layout

```
Graduation_Project1/
├── auth-backend/          ← Authentication service (Node.js, port 3210)
├── home-backend/          ← Financial data service (Node.js, port 5001)
├── grad_project_ai/       ← AI agent service (Python/FastAPI, port 8000)
└── VOICE_FEATURE_SPEC.md  ← This file
```

---

## 🔑 2. Authentication — How It Works (Critical Context)

**You must understand this before writing any endpoint.**

1. User logs in via `auth-backend` → receives an **Access Token (JWT)** + **Refresh Token**
2. Every request to `home-backend` and `grad_project_ai` MUST include:
   ```
   Authorization: Bearer <accessToken>
   ```
3. The `home-backend`'s `verifyToken.js` middleware validates the JWT using the shared `JWT_SECRET` and attaches `req.userId` to the request
4. The `grad_project_ai` receives the raw `accessToken` string from the client and forwards it to `home-backend` endpoints as a Bearer token

**JWT Secret** — same in both `auth-backend` and `home-backend`:
```
JWT_SECRET=supersecret_access_key
```

### Token Middleware (home-backend/middleware/verifyToken.js)
```javascript
// Extracts and verifies JWT, adds req.userId to every protected request
const decoded = jwt.verify(token, process.env.JWT_SECRET);
req.userId = decoded.userId || decoded.id;
```

---

## 📊 3. Existing Database Models (What You Will Write Into)

### Transaction Model (`home-backend/models/Transaction.js`)

```javascript
{
  userId:         ObjectId (ref: 'User'),  // REQUIRED — from JWT
  type:           String,   // REQUIRED — 'income' | 'expense'
  amount:         Number,   // REQUIRED — must be > 0
  category:       String,   // REQUIRED — no enum restriction, any string
  categoryGroup:  String,   // Optional — parent group e.g. "Food & Dining"
  description:    String,   // Optional — defaults to ''
  date:           Date,     // Optional — defaults to now
  paymentMethod:  String,   // Optional — 'cash' | 'credit_card' | 'debit_card' | 'bank_transfer' | 'mobile_wallet' | 'other'
  tags:           [String], // Optional — array
  notes:          String,   // Optional
  // auto-added: createdAt, updatedAt (timestamps: true)
}
```

**Indexes already in place:**
- `{ userId: 1, date: -1 }`
- `{ userId: 1, type: 1 }`
- `{ userId: 1, category: 1 }`

### Category Model (`home-backend/models/Category`) — Already Exists

Categories are managed with a full system:
- **System categories** (`isSystem: true, userId: null`) — predefined, read-only
- **Custom categories** (`isSystem: false, userId: <id>`) — user-created, editable
- Support subcategories as an embedded array
- Can clone system → custom for user customization

### Existing Category Groups (defined in `grad_project_ai/services/llm_service.py`)

| Group | Categories |
|-------|-----------|
| Housing | Rent/Mortgage, Home Maintenance, Utilities, Internet & Phone, Home Insurance |
| Transportation | Fuel/Gas, Car Maintenance/Insurance/Payments, Public Transport/Uber/Taxi, Parking |
| Food & Dining | Groceries, Restaurants/Dining Out, Coffee/Snacks/Fast Food |
| Healthcare & Medicine | Doctor/Hospital, Pharmacy/Medicine, Health Insurance, Vitamins/Supplements |
| Entertainment & Joy | Movies/Streaming, Hobbies/Sports, Concerts/Events, Gaming |
| Shopping | Clothing, Electronics, Home Decor/Furniture |
| Personal Care | Haircuts/Salon, Cosmetics, Gym/Fitness |
| Travel & Vacation | Flights, Hotels, Local Trips |
| Education | Courses, Books, School Fees |
| Gifts & Donations | Gifts, Charity |
| Subscriptions | Streaming, Apps, Gym memberships |
| Debt Repayment | Credit Card Payments, Loan Installments |
| Miscellaneous | Bank Fees, Pet Care, Childcare, Other |

---

## 🤖 4. Existing AI Service — What Is Already Built

### `grad_project_ai/` — Python / FastAPI (Port 8000)

**Already implemented endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/ai/chat` | POST | Financial advisor chat using Azure OpenAI (GPT) |
| `/api/ai/categorize` | POST | Categorizes a transaction text → returns JSON with type, category, amount, currency |

**`/api/ai/categorize` — This is the most important existing feature for your work.**

Request:
```json
{ "text": "كافيه لاتيه 45 جنيه" }
```

Response:
```json
{
  "type": "expense",
  "categoryGroup": "Food & Dining",
  "category": "Coffee/Snacks/Fast Food",
  "confidence": 0.92,
  "detectedAmount": 45,
  "detectedCurrency": "EGP",
  "suggestedDescription": "Latte at café",
  "language": "ar"
}
```

The LLM prompt already specifies both English and Arabic support for Egyptian users.

**Stack:**
- `fastapi==0.104.1`
- `uvicorn==0.24.0`
- `pydantic==2.12.5`
- `openai==2.28.0` (Azure OpenAI SDK)
- `httpx==0.28.1` (async HTTP client)
- `slowapi==0.1.9` (rate limiting)
- `python-dotenv==1.0.0`

**Azure OpenAI Config** (already in `.env`):
```env
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=https://quality-project-resource.openai.azure.com/
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-5.2-chat-2
AZURE_OPENAI_API_VERSION=2024-10-21
```

### AI Proxy in home-backend (`home-backend/routes/ai.js`)

The `home-backend` acts as a **proxy** between the frontend and the Python AI service. It:
1. Validates the JWT token
2. Forwards the request to `http://localhost:8000` (the Python service)
3. Returns the result to the frontend

This pattern is already established — **you will add new voice endpoints following this same proxy pattern.**

---

## 🎙️ 5. The New Feature — Voice-to-Transaction

### What Needs to Be Built

A pipeline that:
1. **Records voice** from the user (frontend handles recording)
2. **Converts speech → text** (STT) — supports **Arabic & English**
3. **Extracts key information** from the transcribed text (item name, store/merchant, amount)
4. **Presents a confirmation card** to the user before saving
5. **Allows user to correct** any wrong field
6. **Saves corrections as training data** (feedback loop) for future improvement
7. **Categorizes** the transaction using the existing `/api/ai/categorize` engine
8. **Creates the transaction** in MongoDB via the existing `POST /api/transactions`

### The Full Pipeline Flow

```
User Speaks
    │
    ▼
[STEP 1] Frontend records audio → sends audio blob to:
         POST /api/voice/transcribe
    │
    ▼
[STEP 2] Python (grad_project_ai) receives audio file
         → calls Azure Speech-to-Text (or Whisper)
         → detects language automatically (Arabic / English)
         → returns: { transcript, language, confidence }
    │
    ▼
[STEP 3] Frontend sends transcript to:
         POST /api/voice/extract
         (or this can be chained inside /transcribe)
    │
    ▼
[STEP 4] Python LLM extraction
         → Extracts: { itemName, merchant, amount, currency, quantity, date }
         → Uses GPU Azure OpenAI (same as categorize)
    │
    ▼
[STEP 5] Returns structured extraction to frontend
         Frontend shows CONFIRMATION CARD to user
    │
    ├── User confirms → go to Step 6
    └── User edits fields → send corrected data + original to:
                           POST /api/voice/feedback
                           (saves correction for retraining)
    │
    ▼
[STEP 6] Categorize the confirmed/corrected text
         → Calls existing POST /api/ai/categorize internally
         → Returns: { category, categoryGroup, type, confidence }
    │
    ▼
[STEP 7] Frontend creates transaction:
         POST /api/transactions  (existing endpoint)
         { type, amount, category, categoryGroup, description, ... }
```

---

## 📋 6. New API Endpoints to Build

### New Endpoints in `grad_project_ai` (Python/FastAPI)

---

#### `POST /api/voice/transcribe`

Receives an audio file → returns transcribed text + detected language.

**Request:** `multipart/form-data`
```
audio: <binary audio file>   # Required — WAV/MP3/WebM/OGG/M4A
language_hint: "auto"        # Optional — "ar", "en", or "auto" (default: "auto")
```

**Response:**
```json
{
  "transcript": "اشتريت لاتيه من ستاربكس بـ 75 جنيه",
  "language": "ar",
  "confidence": 0.96,
  "duration_seconds": 3.2
}
```

**Error Responses:**
```json
{ "detail": "Audio file is required" }              // 400
{ "detail": "Unsupported audio format" }            // 422
{ "detail": "Transcription failed: ..." }           // 500
```

**Technology Options (pick one — recommended: Azure Speech or Whisper):**

| Option | Pros | Cons |
|--------|------|------|
| **Azure Speech-to-Text** | Same Azure account as OpenAI, great Arabic support, streaming | Paid per minute |
| **OpenAI Whisper (local)** | Free, offline, excellent multilingual | Needs GPU or slow on CPU |
| **OpenAI Whisper API** | Easy, fast, hosted | Paid per use |
| **Google Speech-to-Text** | Very good Arabic | Different provider |

> **Recommendation:** Use **Azure Cognitive Services Speech SDK** since you already have Azure credentials. It handles Arabic (`ar-EG`, `ar-SA`) and English (`en-US`) natively, with auto-detection.

**Azure Speech Libraries:**
```
azure-cognitiveservices-speech==1.38.0
```

**New env vars needed in `grad_project_ai/.env`:**
```env
AZURE_SPEECH_KEY=<your_speech_resource_key>
AZURE_SPEECH_REGION=<your_region>   # e.g. eastus
```

---

#### `POST /api/voice/extract`

Takes transcribed text → extracts structured financial info using LLM.

**Request:**
```json
{
  "transcript": "اشتريت لاتيه من ستاربكس بـ 75 جنيه",
  "language": "ar"
}
```

**Response:**
```json
{
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
  "needsConfirmation": true
}
```

**Example with missing amount:**
```json
{
  "extracted": {
    "itemName": "Shoes",
    "merchant": "Zara",
    "amount": null,
    "currency": null,
    "quantity": 1,
    "date": null,
    "rawTranscript": "bought shoes from zara"
  },
  "confidence": 0.65,
  "missingFields": ["amount"],
  "needsConfirmation": true
}
```

**LLM Extraction Prompt (add to `llm_service.py`):**
```python
EXTRACT_SYSTEM_PROMPT = """You are a financial data extraction engine for a personal budgeting app.
The user speaks in Arabic, English, or a mix of both (Egyptian Arabic is common).

Your task is to extract structured data from voice transcripts about purchases or income.

Always respond with valid JSON only — no explanations, no extra text.

Extract these fields:
- itemName: The name of the item purchased or sold (string or null)
- merchant: Where it was bought / from whom (string or null)
- amount: Numeric value only (number or null)
- currency: Currency code (EGP, USD, EUR, etc.) or null. If 'جنيه' → EGP, '$' → USD
- quantity: How many items (number, default 1)
- date: Date mentioned, ISO format (string or null — e.g. "today", "yesterday" → resolve)
- rawTranscript: The original input text, unchanged

Common Arabic purchase phrases:
- اشتريت / شريت = "I bought"
- دفعت = "I paid"
- من = "from" (merchant)
- بـ / بـ حوالي = "for / for about" (price)
- جنيه / ج.م = EGP

Return:
{
  "itemName": "...",
  "merchant": "...",
  "amount": 75.0,
  "currency": "EGP",
  "quantity": 1,
  "date": null,
  "rawTranscript": "..."
}"""
```

---

#### `POST /api/voice/feedback`

Stores user corrections when the extracted data was wrong. This is the **training data collection** mechanism.

**Request:**
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
  "correctedFields": ["itemName", "merchant"]
}
```

**Response:**
```json
{
  "message": "Feedback saved. Thank you for helping improve the system.",
  "feedbackId": "abc123"
}
```

**Storage:** Save in a `VoiceFeedback` MongoDB collection (see Section 8 for the schema).

---

### New Proxy Endpoints in `home-backend` (Node.js)

Following the existing pattern in `home-backend/routes/ai.js`, add:

**File: `home-backend/routes/voice.js`** (new file)

```javascript
// POST /api/voice/transcribe  → multipart proxy to Python
// POST /api/voice/extract     → JSON proxy to Python
// POST /api/voice/feedback    → JSON proxy to Python (or handle locally)
```

All require `verifyToken` middleware.

**Register in `home-backend/server.js`:**
```javascript
app.use('/api/voice', require('./routes/voice'));
```

**Note on multipart forwarding:** For audio file proxying, use the `form-data` npm package (or `multer` to receive + `axios`/`node-fetch` to forward). The file should NOT be stored on disk in `home-backend` — only forwarded.

---

## 🗄️ 7. New MongoDB Collection — `VoiceFeedback`

**Purpose:** Collect user corrections to improve extraction accuracy over time.

### Schema (add to `grad_project_ai` — or create in `home-backend/models/VoiceFeedback.js`)

```javascript
// home-backend/models/VoiceFeedback.js
const mongoose = require('mongoose');

const voiceFeedbackSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // What the user said
    originalTranscript: {
        type: String,
        required: true
    },

    // Language detected during transcription
    language: {
        type: String,
        enum: ['ar', 'en', 'mixed'],
        required: true
    },

    // What the AI originally extracted (before user correction)
    originalExtraction: {
        itemName:  { type: String, default: null },
        merchant:  { type: String, default: null },
        amount:    { type: Number, default: null },
        currency:  { type: String, default: null },
        quantity:  { type: Number, default: 1 },
        date:      { type: String, default: null }
    },

    // What the user corrected it to
    correctedExtraction: {
        itemName:  { type: String, default: null },
        merchant:  { type: String, default: null },
        amount:    { type: Number, default: null },
        currency:  { type: String, default: null },
        quantity:  { type: Number, default: 1 },
        date:      { type: String, default: null }
    },

    // Which fields the user actually changed
    correctedFields: [{
        type: String
    }],

    // Category that was ultimately used for the transaction
    finalCategory:      { type: String, default: null },
    finalCategoryGroup: { type: String, default: null },
    finalType:          { type: String, enum: ['income', 'expense'], default: null },

    // Link to the transaction created after this voice entry
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
        default: null
    },

    // Confidence scores
    transcriptionConfidence: { type: Number, default: null },
    extractionConfidence:    { type: Number, default: null },

    // Was any correction made? (quick filter for training data)
    hadCorrection: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true  // createdAt, updatedAt auto-managed
});

// Index for fetching training data by language and correction type
voiceFeedbackSchema.index({ language: 1, hadCorrection: 1 });
voiceFeedbackSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('VoiceFeedback', voiceFeedbackSchema);
```

---

## 🔄 8. Full End-to-End Pipeline — Step by Step

### Phase 1 — Voice Recording (Frontend)
```
Frontend records audio using Web Audio API or MediaRecorder
Sends as multipart/form-data to:  POST /api/voice/transcribe
```

### Phase 2 — Transcription (Python Service)
```python
# In grad_project_ai/services/speech_service.py  (NEW FILE)
# Using Azure Speech SDK:

import azure.cognitiveservices.speech as speechsdk

async def transcribe_audio(audio_bytes: bytes, language_hint: str = "auto") -> dict:
    # Configure speech service
    speech_config = speechsdk.SpeechConfig(
        subscription=os.getenv("AZURE_SPEECH_KEY"),
        region=os.getenv("AZURE_SPEECH_REGION")
    )

    # Auto language detection — Arabic Egypt + English US
    if language_hint == "auto":
        auto_detect_config = speechsdk.languageconfig.AutoDetectSourceLanguageConfig(
            languages=["ar-EG", "en-US"]
        )
    
    # Returns: transcript text, detected language, confidence
```

### Phase 3 — Text Extraction (Python Service)
```python
# In grad_project_ai/services/llm_service.py  (add to existing file)
async def extract_transaction_info(transcript: str, language: str) -> dict:
    # Uses Azure OpenAI with EXTRACT_SYSTEM_PROMPT
    # Returns structured extraction dict
```

### Phase 4 — Confirmation (Frontend/API)

The frontend receives:
```json
{
  "transcript": "...",
  "language": "ar",
  "extracted": {
    "itemName": "Latte",
    "merchant": "Starbucks",
    "amount": 75.0,
    "currency": "EGP"
  },
  "category": {
    "type": "expense",
    "categoryGroup": "Food & Dining",
    "category": "Coffee/Snacks/Fast Food",
    "confidence": 0.92
  },
  "needsConfirmation": true
}
```

The frontend shows a **Confirmation Card** with all fields editable. If the user edits any field, those edits are sent back with `POST /api/voice/feedback` (with `hadCorrection: true`).

### Phase 5 — Categorization (Reuse Existing)

After extraction, call the existing `categorize_transaction()` function from `llm_service.py`:
```python
category_result = await categorize_transaction(
    f"{extracted['itemName']} from {extracted['merchant']} {extracted['amount']} {extracted['currency']}"
)
```

Or call the existing internal endpoint `POST /api/ai/categorize`.

### Phase 6 — Transaction Creation (Use Existing Endpoint)

Final call from frontend to the **already existing** endpoint:
```
POST /api/transactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "expense",
  "amount": 75.0,
  "category": "Coffee/Snacks/Fast Food",
  "categoryGroup": "Food & Dining",
  "description": "Latte at Starbucks",
  "paymentMethod": "cash"
}
```

This hits `home-backend/controllers/transactionController.js → createTransaction()` — **no changes needed here**.

---

## 📁 9. File Structure — What To Create

### New files in `grad_project_ai/`

```
grad_project_ai/
├── main.py                           ← MODIFY: add 6 new routes (3 voice + 3 OCR)
├── requirements.txt                  ← MODIFY: add Speech SDK + OCR libs
├── services/
│   ├── llm_service.py               ← MODIFY: add extract_transaction_info() + ocr_extract()
│   ├── backend_service.py           ← No change
│   ├── speech_service.py            ← CREATE: Azure STT integration
│   └── ocr_service.py               ← CREATE: Azure Document Intelligence / pytesseract
└── .env                             ← MODIFY: add Speech + OCR keys
```

### New files in `home-backend/`

```
home-backend/
├── server.js                         ← MODIFY: register /api/voice + /api/ocr routes
├── routes/
│   ├── voice.js                      ← CREATE: proxy routes for voice endpoints
│   ├── ocr.js                        ← CREATE: proxy routes for OCR endpoints
│   └── ai.js                         ← No change
└── models/
    ├── VoiceFeedback.js              ← CREATE: voice feedback schema
    └── OcrFeedback.js                ← CREATE: OCR feedback schema
```

---

## 🔧 10. Updated `requirements.txt` for `grad_project_ai`

```txt
fastapi==0.104.1
uvicorn==0.24.0
python-dotenv==1.0.0
httpx==0.28.1
slowapi==0.1.9
openai==2.28.0
pydantic==2.12.5
azure-cognitiveservices-speech==1.38.0
python-multipart==0.0.6
azure-ai-documentintelligence==1.0.0
pillow==10.2.0
pdf2image==1.17.0
pytesseract==0.3.10
```

**New additions:**
- `azure-cognitiveservices-speech==1.38.0` — Azure STT SDK (Voice)
- `python-multipart==0.0.6` — Required by FastAPI to accept `multipart/form-data`
- `azure-ai-documentintelligence==1.0.0` — Azure Document Intelligence OCR SDK (invoices/receipts)
- `pillow==10.2.0` — Image processing / format conversion before OCR
- `pdf2image==1.17.0` — Convert PDF pages → images for OCR
- `pytesseract==0.3.10` — Fallback local OCR engine (supports Arabic via `ara` lang pack)

---

## 🔧 11. New `.env` Variables Needed

### `grad_project_ai/.env` — Add These

```env
# Existing (do NOT change):
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_ENDPOINT=...
AZURE_OPENAI_DEPLOYMENT_NAME=gpt-5.2-chat-2
AZURE_OPENAI_API_VERSION=2024-10-21

# NEW — Azure Speech-to-Text (Voice feature):
AZURE_SPEECH_KEY=<your_azure_speech_resource_key>
AZURE_SPEECH_REGION=<region_e.g._eastus>

# NEW — Azure Document Intelligence (OCR feature):
AZURE_DOC_INTEL_KEY=<your_document_intelligence_key>
AZURE_DOC_INTEL_ENDPOINT=https://<your-resource>.cognitiveservices.azure.com/
```

### `home-backend/.env` — Already Has This (no change needed)
```env
AI_AGENT_URL=http://localhost:8000
```

---

## 🧠 12. LLM Prompts Summary

### Existing Prompt — Categorization (already in `llm_service.py`)
Used by `POST /api/ai/categorize`. Accepts EN/AR text, returns JSON with category, group, confidence, amount, currency, language.

**Do NOT modify this prompt.**

### New Prompt — Extraction (add to `llm_service.py`)
Used by `POST /api/voice/extract`. Extracts itemName, merchant, amount, currency, quantity, date from voice transcripts.

Template shown in Section 6 above (`EXTRACT_SYSTEM_PROMPT`).

---

## 🧪 13. Testing Guide — How to Test Each Step

### Step 1: Test Transcription Endpoint
```bash
# Send an Arabic audio file
curl -X POST http://localhost:8000/api/voice/transcribe \
  -F "audio=@test_arabic.wav" \
  -F "language_hint=auto"

# Expected: { transcript, language, confidence, duration_seconds }
```

### Step 2: Test Extraction Endpoint
```bash
curl -X POST http://localhost:8000/api/voice/extract \
  -H "Content-Type: application/json" \
  -d '{"transcript": "bought 2 coffees at Costa for 90 pounds", "language": "en"}'

# Expected: { extracted: { itemName, merchant, amount, ... }, missingFields: [], needsConfirmation: true }
```

### Step 3: Test Arabic Extraction
```bash
curl -X POST http://localhost:8000/api/voice/extract \
  -H "Content-Type: application/json" \
  -d '{"transcript": "اشتريت أدوات مكتب من كارفور بـ 350 جنيه", "language": "ar"}'

# Expected: { extracted: { itemName: "Office supplies", merchant: "Carrefour", amount: 350, currency: "EGP" } }
```

### Step 4: Test Feedback Endpoint
```bash
curl -X POST http://localhost:8000/api/voice/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "originalTranscript": "اشتريت شبشب من البرج",
    "originalExtraction": { "itemName": "Shoe", "merchant": "El-Borg", "amount": null },
    "correctedExtraction": { "itemName": "Slippers", "merchant": "El-Borg Mall", "amount": 200 },
    "language": "ar",
    "correctedFields": ["itemName", "merchant", "amount"]
  }'
```

### Step 5: Full Pipeline via home-backend (with JWT)
```bash
# First get a token from auth-backend, then:
curl -X POST http://localhost:5001/api/voice/transcribe \
  -H "Authorization: Bearer <your_jwt_token>" \
  -F "audio=@test_audio.wav"
```

---

## 🔗 14. Integration Points — Exact Existing Code to Reference

### 1 — How home-backend proxies to Python (existing pattern, follow this exactly)

**File:** `home-backend/routes/ai.js` — Lines 7–25

```javascript
async function proxyToAgent(path, body, timeoutMs = 30000) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(`${AI_AGENT_URL}${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal
        });
        clearTimeout(timeout);
        return { ok: response.ok, status: response.status, data: await response.json() };
    } catch (err) {
        clearTimeout(timeout);
        throw err;
    }
}
```

> ⚠️ **For audio file proxying**, you need a different approach since it's `multipart/form-data`, not JSON. Use `multer` (Node) to receive the file, then forward with `form-data` npm package.

### 2 — How existing categorize endpoint works (reuse this)

**File:** `grad_project_ai/services/llm_service.py` — `categorize_transaction(text: str) → dict`

This function already handles EN/AR text, strips markdown fences from the response, has JSON fallback. **Call it directly** inside the voice pipeline — no need to hit the HTTP endpoint.

### 3 — How the Transaction is created (already exists — do NOT touch)

**File:** `home-backend/controllers/transactionController.js` — `createTransaction()`

Voice feature frontend calls this endpoint after the user confirms:
```
POST /api/transactions
Authorization: Bearer <token>
{ type, amount, category, categoryGroup, description, paymentMethod }
```

---

## ⚠️ 15. Important Rules & Constraints

**Applies to BOTH Voice and OCR pipelines:**

1. **Do NOT change `transactionController.js`** — the existing create/update/delete logic is complete and tested.

2. **Do NOT change `llm_service.py`'s `categorize_transaction()`** — just call it from both pipelines.

3. **ALL endpoints in home-backend MUST use `verifyToken` middleware** — voice, OCR, and feedback.

4. **The `userId` must always come from `req.userId`** (set by `verifyToken.js`) — never trust client-sent userId.

5. **Audio and image/PDF files must NOT be stored on disk permanently** — process them in memory, discard immediately.

6. **Rate limits (slowapi):**
   - `POST /api/voice/transcribe` → `10/minute` (Azure STT is expensive)
   - `POST /api/ocr/scan` → `10/minute` (Azure Doc Intelligence is expensive)
   - `POST /api/voice/extract` → `30/minute`
   - `POST /api/ocr/extract` → `30/minute`

7. **Both feedback endpoints save original + corrected extraction** — the *diff* is your training signal.

8. **Confidence threshold:** If `confidence < 0.6`, set `needsConfirmation: true` and flag uncertain fields.

9. **Supported audio formats:** `WAV`, `MP3`, `WebM`, `OGG`, `M4A`

10. **Supported file formats for OCR:** `JPG`, `PNG`, `WEBP`, `HEIC`, `PDF`, `TIFF`, `TXT`

11. **Language codes (Voice):**
    - Arabic Egypt: `ar-EG` | Arabic Modern Standard: `ar-SA` | English: `en-US`
    - Auto-detect: pass `["ar-EG", "en-US"]` to Azure auto-detect config

12. **OCR language hint:** Pass `ar` for Arabic-only invoices, `en` for English, `auto` for mixed.

---

## 📝 16. Data Flow Summary — JSON Contracts

### Complete Voice Transaction Flow (Frontend ↔ Backend)

```
[1] Frontend
    → POST /api/voice/transcribe (multipart audio)
    ← { transcript, language, confidence }

[2] Frontend
    → POST /api/voice/extract { transcript, language }
    ← { extracted: { itemName, merchant, amount, currency }, confidence, missingFields }

[3] Python internally
    → categorize_transaction(f"{itemName} {amount} {currency} {merchant}")
    ← { type, categoryGroup, category, confidence }

[4] Frontend receives combined result:
    {
      transcript: "...",
      extracted: { itemName, merchant, amount, currency },
      category: { type, categoryGroup, category, confidence },
      needsConfirmation: true
    }

[5] User reviews / edits on Confirmation Card

[6a] If user corrected anything:
     → POST /api/voice/feedback { originalExtraction, correctedExtraction, correctedFields }
     ← { message: "Feedback saved", feedbackId }

[6b] Regardless (confirmed or corrected):
     → POST /api/transactions { type, amount, category, categoryGroup, description }
     ← { message: "Transaction created successfully", transaction, newBalance }
```

---

## 🚀 17. Quick Start Checklist for AI Partner

### 🎙️ Voice Pipeline
- [ ] Read `grad_project_ai/services/llm_service.py` — understand `categorize_transaction()`
- [ ] Read `home-backend/routes/ai.js` — understand the proxy pattern
- [ ] Read `home-backend/middleware/verifyToken.js` — understand auth
- [ ] Read `home-backend/models/Transaction.js` — know what fields to send
- [ ] Set up Azure Speech resource → get `AZURE_SPEECH_KEY` + `AZURE_SPEECH_REGION`
- [ ] Add voice env vars to `grad_project_ai/.env`
- [ ] Create `grad_project_ai/services/speech_service.py`
- [ ] Add `extract_transaction_info()` to `grad_project_ai/services/llm_service.py`
- [ ] Add 3 voice routes to `grad_project_ai/main.py`
- [ ] Create `home-backend/models/VoiceFeedback.js`
- [ ] Create `home-backend/routes/voice.js`
- [ ] Register `/api/voice` in `home-backend/server.js`

### 📄 OCR Pipeline
- [ ] Set up Azure Document Intelligence resource → get `AZURE_DOC_INTEL_KEY` + `AZURE_DOC_INTEL_ENDPOINT`
- [ ] Add OCR env vars to `grad_project_ai/.env`
- [ ] Create `grad_project_ai/services/ocr_service.py`
- [ ] Add `extract_from_ocr_text()` to `grad_project_ai/services/llm_service.py`
- [ ] Add 3 OCR routes to `grad_project_ai/main.py`
- [ ] Create `home-backend/models/OcrFeedback.js`
- [ ] Create `home-backend/routes/ocr.js`
- [ ] Register `/api/ocr` in `home-backend/server.js`

### Both
- [ ] Update `requirements.txt` with all new packages
- [ ] Test each endpoint individually (see Sections 13 + 20)
- [ ] Test full voice pipeline end-to-end
- [ ] Test full OCR pipeline end-to-end
- [ ] **Send implemented APIs back** as specified in Section 21

---

*Document Version 2.0 — Updated to include OCR pipeline.*  
*Project: Intelligent Personal Budgeting Application | April 2026*

---

## 📄 18. The New Feature — OCR Invoice Scanner

### What Needs to Be Built

A pipeline that mirrors the voice pipeline but the input is a **file** (photo, PDF, or plain text) instead of audio:

1. **User uploads** an invoice image / PDF / text file (frontend handles file picker)
2. **OCR engine reads** the file → extracts raw text from the document
3. **LLM extracts** structured financial info (vendor, items, total, date, tax)
4. **Presents a confirmation card** — user reviews extracted data
5. **User can correct** any wrong field
6. **Corrections saved** as training data in `OcrFeedback` collection
7. **Categorizes** using the existing `categorize_transaction()` — same as voice
8. **Creates transaction(s)** using the existing `POST /api/transactions`

### Invoice Types Supported

| Invoice Type | Common Fields | Example |
|---|---|---|
| Restaurant receipt | vendor, items[], total, date, tax | Koshary el-Tahrir — 85 EGP |
| Rent invoice | landlord, address, period, amount | Monthly rent — 7500 EGP |
| Supermarket receipt | store, items[], total, date | Carrefour shopping — 430 EGP |
| Utility bill | provider, account, period, amount, due date | Electricity — 210 EGP |
| Pharmacy receipt | pharmacy, items[], total, date | Cairo Pharmacy — 155 EGP |
| Plain text file | any financial text | Copy-pasted invoice text |

### The Full OCR Pipeline Flow

```
User uploads file (JPG / PNG / PDF / TXT)
    │
    ▼
[STEP 1] Frontend → POST /api/ocr/scan (multipart file)
    │
    ▼
[STEP 2] Python (grad_project_ai)
         ─ If image (JPG/PNG/WEBP/HEIC):
             → Azure Document Intelligence "prebuilt-receipt" model
             → Returns: vendor, items[], total, tax, date, currency
         ─ If PDF:
             → pdf2image converts pages → images
             → Azure Document Intelligence processes each page
         ─ If TXT:
             → Read raw text directly (no OCR needed)
             → Pass straight to LLM extraction
         → Returns: { rawText, structuredOcr, fileType, language }
    │
    ▼
[STEP 3] Internally chain to extraction:
         POST /api/ocr/extract { rawText, structuredOcr, language }
    │
    ▼
[STEP 4] LLM extraction (using OCR_EXTRACT_SYSTEM_PROMPT)
         → Parses rawText + structuredOcr
         → Extracts: { vendor, items[], totalAmount, currency, date, taxAmount, invoiceType }
    │
    ▼
[STEP 5] Internally call categorize_transaction()
         → Maps invoice type → category group → category
    │
    ▼
[STEP 6] Returns combined result to frontend:
         { rawText, extracted, category, needsConfirmation }
    │
    ├── User confirms → go to Step 7
    └── User edits → POST /api/ocr/feedback (saves correction)
    │
    ▼
[STEP 7] Frontend → POST /api/transactions (existing endpoint)
         { type, amount, category, categoryGroup, description, date }
```

---

## 📋 19. New OCR API Endpoints to Build

### New Endpoints in `grad_project_ai` (Python/FastAPI)

---

#### `POST /api/ocr/scan`

Receives a file upload → runs OCR → returns raw text + structured invoice data.

**Request:** `multipart/form-data`
```
file: <binary file>           # Required — JPG/PNG/WEBP/HEIC/PDF/TXT
language_hint: "auto"         # Optional — "ar", "en", "auto" (default: "auto")
```

**Response (receipt/invoice image):**
```json
{
  "fileType": "image",
  "language": "ar",
  "rawText": "مطعم كوشري التحرير\nكوشري كبير × 2 = 50 جنيه\nمشروب × 1 = 15 جنيه\nالإجمالي: 65 جنيه",
  "structuredOcr": {
    "vendor": "كوشري التحرير",
    "date": "2026-04-13",
    "items": [
      { "name": "كوشري كبير", "quantity": 2, "unitPrice": 25, "totalPrice": 50 },
      { "name": "مشروب", "quantity": 1, "unitPrice": 15, "totalPrice": 15 }
    ],
    "subtotal": 65,
    "tax": 0,
    "total": 65,
    "currency": "EGP"
  },
  "confidence": 0.94
}
```

**Response (plain text file):**
```json
{
  "fileType": "text",
  "language": "en",
  "rawText": "Monthly rent invoice\nLandlord: Ahmed Hassan\nAmount: 7500 EGP\nPeriod: April 2026",
  "structuredOcr": null,
  "confidence": 1.0
}
```

**Error Responses:**
```json
{ "detail": "File is required" }                    // 400
{ "detail": "Unsupported file format: .docx" }      // 422
{ "detail": "OCR processing failed: ..." }          // 500
{ "detail": "File too large (max 10MB)" }           // 413
```

**Technology — Azure Document Intelligence:**
```python
# grad_project_ai/services/ocr_service.py
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.core.credentials import AzureKeyCredential

client = DocumentIntelligenceClient(
    endpoint=os.getenv("AZURE_DOC_INTEL_ENDPOINT"),
    credential=AzureKeyCredential(os.getenv("AZURE_DOC_INTEL_KEY"))
)
# Use model: "prebuilt-receipt" for receipts/invoices
# Use model: "prebuilt-document" for general documents (rent, utilities)
```

**Fallback strategy if Azure Document Intelligence is unavailable:**
- Use `pytesseract` with `lang="ara+eng"` for local OCR
- Then pass raw text to LLM for structured extraction

---

#### `POST /api/ocr/extract`

Takes raw OCR text + structured OCR data → uses LLM to produce final clean extraction.

**Request:**
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

**Response:**
```json
{
  "extracted": {
    "vendor": "Koshary El-Tahrir",
    "vendorArabic": "كوشري التحرير",
    "invoiceType": "restaurant",
    "items": [
      { "name": "Large Koshary", "quantity": 2, "unitPrice": 25, "totalPrice": 50 },
      { "name": "Drink", "quantity": 1, "unitPrice": 15, "totalPrice": 15 }
    ],
    "totalAmount": 65.0,
    "taxAmount": 0.0,
    "currency": "EGP",
    "date": "2026-04-13",
    "rawText": "مطعم كوشري التحرير\nالإجمالي: 65 جنيه"
  },
  "suggestedTransaction": {
    "type": "expense",
    "amount": 65.0,
    "description": "Koshary El-Tahrir — 2x Large Koshary, 1x Drink"
  },
  "confidence": 0.93,
  "missingFields": [],
  "needsConfirmation": true
}
```

**LLM OCR Extraction Prompt (add to `llm_service.py`):**
```python
OCR_EXTRACT_SYSTEM_PROMPT = """You are an invoice/receipt data extraction engine for a personal finance app.
Users upload invoices from restaurants, rent, utilities, pharmacies, and supermarkets.
Text may be in Arabic, English, or mixed (Egyptian context).

Always respond with valid JSON only — no explanations, no extra text.

Extract:
- vendor: Business name in English (translate if Arabic)
- vendorArabic: Original Arabic name if present (or null)
- invoiceType: "restaurant" | "rent" | "supermarket" | "utility" | "pharmacy" | "transport" | "other"
- items: Array of { name, quantity, unitPrice, totalPrice } — empty array [] if not itemized
- totalAmount: Final total paid (number)
- taxAmount: Tax amount (number or 0)
- currency: EGP, USD, EUR, etc.
- date: ISO date string (YYYY-MM-DD) or null
- rawText: Original OCR text, unchanged

Common Arabic invoice terms:
- الإجمالي / المجموع = Total
- ضريبة / ض.ق.م = Tax / VAT
- الكمية = Quantity
- السعر = Price
- التاريخ = Date
- الفاتورة = Invoice
- إيجار = Rent
- فاتورة كهرباء = Electricity bill
- صيدلية = Pharmacy

Return:
{
  "vendor": "...",
  "vendorArabic": "...",
  "invoiceType": "...",
  "items": [],
  "totalAmount": 0.0,
  "taxAmount": 0.0,
  "currency": "EGP",
  "date": null,
  "rawText": "..."
}"""
```

---

#### `POST /api/ocr/feedback`

Stores user corrections when the OCR extraction was wrong. Same training-data purpose as voice feedback.

**Request:**
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
  "correctedFields": ["vendor"]
}
```

**Response:**
```json
{
  "message": "Feedback saved. Thank you for helping improve the system.",
  "feedbackId": "xyz789"
}
```

---

### New Proxy Endpoints in `home-backend` (Node.js)

**File: `home-backend/routes/ocr.js`** (new file)

```javascript
// POST /api/ocr/scan      → multipart proxy to Python (file upload)
// POST /api/ocr/extract   → JSON proxy to Python
// POST /api/ocr/feedback  → JSON proxy to Python
```

All require `verifyToken` middleware.

**Register in `home-backend/server.js`:**
```javascript
app.use('/api/ocr', require('./routes/ocr'));
```

**Important — File Size Limit:** Add to `home-backend/server.js` or the `ocr.js` route:
```javascript
// Allow up to 10MB for invoice file uploads
app.use('/api/ocr', express.raw({ limit: '10mb' }));
```

---

## 🗄️ OCR MongoDB Collection — `OcrFeedback`

**File: `home-backend/models/OcrFeedback.js`**

```javascript
const mongoose = require('mongoose');

const ocrFeedbackSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Type of file that was uploaded
    fileType: {
        type: String,
        enum: ['image', 'pdf', 'text'],
        required: true
    },

    // Language detected in the document
    language: {
        type: String,
        enum: ['ar', 'en', 'mixed'],
        required: true
    },

    // Raw text extracted by OCR (for retraining)
    originalRawText: {
        type: String,
        required: true
    },

    // What the AI originally extracted (before user correction)
    originalExtraction: {
        vendor:       { type: String, default: null },
        vendorArabic: { type: String, default: null },
        invoiceType:  { type: String, default: null },
        totalAmount:  { type: Number, default: null },
        taxAmount:    { type: Number, default: null },
        currency:     { type: String, default: null },
        date:         { type: String, default: null },
        items: [{
            name:        String,
            quantity:    Number,
            unitPrice:   Number,
            totalPrice:  Number
        }]
    },

    // What the user corrected it to
    correctedExtraction: {
        vendor:       { type: String, default: null },
        vendorArabic: { type: String, default: null },
        invoiceType:  { type: String, default: null },
        totalAmount:  { type: Number, default: null },
        taxAmount:    { type: Number, default: null },
        currency:     { type: String, default: null },
        date:         { type: String, default: null },
        items: [{
            name:        String,
            quantity:    Number,
            unitPrice:   Number,
            totalPrice:  Number
        }]
    },

    // Which fields the user actually changed
    correctedFields: [{ type: String }],

    // Category that was ultimately used for the transaction
    finalCategory:      { type: String, default: null },
    finalCategoryGroup: { type: String, default: null },
    finalType:          { type: String, enum: ['income', 'expense'], default: null },

    // Link to the transaction created after this OCR entry
    transactionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Transaction',
        default: null
    },

    // OCR + extraction confidence scores
    ocrConfidence:       { type: Number, default: null },
    extractionConfidence:{ type: Number, default: null },

    // Was any correction made?
    hadCorrection: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

ocrFeedbackSchema.index({ language: 1, hadCorrection: 1 });
ocrFeedbackSchema.index({ fileType: 1, hadCorrection: 1 });
ocrFeedbackSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('OcrFeedback', ocrFeedbackSchema);
```

---

## 🧪 20. OCR Testing Guide

### Test 1: Scan an Arabic Restaurant Receipt Image
```bash
curl -X POST http://localhost:8000/api/ocr/scan \
  -F "file=@restaurant_receipt.jpg" \
  -F "language_hint=ar"

# Expected: { fileType: "image", language: "ar", rawText, structuredOcr, confidence }
```

### Test 2: Scan a Rent Invoice PDF
```bash
curl -X POST http://localhost:8000/api/ocr/scan \
  -F "file=@rent_invoice.pdf" \
  -F "language_hint=ar"

# Expected: { fileType: "pdf", structuredOcr: { vendor: "...", total: 7500, ... } }
```

### Test 3: Upload Plain Text Invoice
```bash
curl -X POST http://localhost:8000/api/ocr/scan \
  -F "file=@invoice.txt" \
  -F "language_hint=en"

# Expected: { fileType: "text", rawText: "...", structuredOcr: null }
```

### Test 4: LLM Extraction from OCR Text
```bash
curl -X POST http://localhost:8000/api/ocr/extract \
  -H "Content-Type: application/json" \
  -d '{
    "rawText": "Starbucks\nLatte x2 = 150 EGP\nTotal: 150 EGP",
    "structuredOcr": null,
    "language": "en",
    "fileType": "image"
  }'

# Expected: { extracted: { vendor: "Starbucks", totalAmount: 150, invoiceType: "restaurant", ... } }
```

### Test 5: OCR Feedback
```bash
curl -X POST http://localhost:8000/api/ocr/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "originalRawText": "Starbucks...",
    "originalExtraction": { "vendor": "Starbucks", "totalAmount": 150, "currency": "EGP" },
    "correctedExtraction": { "vendor": "Starbucks Egypt", "totalAmount": 150, "currency": "EGP" },
    "language": "en",
    "fileType": "image",
    "correctedFields": ["vendor"]
  }'
```

### Test 6: Full OCR Pipeline via home-backend (with JWT)
```bash
curl -X POST http://localhost:5001/api/ocr/scan \
  -H "Authorization: Bearer <your_jwt_token>" \
  -F "file=@receipt.jpg"
```

---

## 🎯 21. APIs for You to Implement in `grad_project_ai` — Final Delivery

> **This section is specifically for the AI partner.**
> After implementing all features, you must deliver the following 12 endpoints
> integrated into the `grad_project_ai` FastAPI service.
> The `home-backend` will proxy ALL of them through its own routes.

### 🎙️ Voice Endpoints (3 total)

| # | Method | Endpoint | Input | Output |
|---|--------|----------|-------|--------|
| 1 | POST | `/api/voice/transcribe` | `multipart: audio file` | `{ transcript, language, confidence, duration_seconds }` |
| 2 | POST | `/api/voice/extract` | `{ transcript, language }` | `{ extracted: {itemName, merchant, amount, currency, quantity, date}, confidence, missingFields, needsConfirmation }` |
| 3 | POST | `/api/voice/feedback` | `{ originalTranscript, originalExtraction, correctedExtraction, language, correctedFields }` | `{ message, feedbackId }` |

### 📄 OCR Endpoints (3 total)

| # | Method | Endpoint | Input | Output |
|---|--------|----------|-------|--------|
| 4 | POST | `/api/ocr/scan` | `multipart: image/pdf/txt file` | `{ fileType, language, rawText, structuredOcr, confidence }` |
| 5 | POST | `/api/ocr/extract` | `{ rawText, structuredOcr, language, fileType }` | `{ extracted: {vendor, items[], totalAmount, taxAmount, currency, date, invoiceType}, suggestedTransaction, confidence, missingFields, needsConfirmation }` |
| 6 | POST | `/api/ocr/feedback` | `{ originalRawText, originalExtraction, correctedExtraction, language, fileType, correctedFields }` | `{ message, feedbackId }` |

### 🤖 Existing AI Endpoints (already built — no changes needed)

| # | Method | Endpoint | Notes |
|---|--------|----------|-------|
| 7 | POST | `/api/ai/chat` | Financial advisor chat — DO NOT TOUCH |
| 8 | POST | `/api/ai/categorize` | Text categorization — DO NOT TOUCH, but CALL from within voice + OCR pipelines |

### Combined Response Format for Frontend Confirmation Card

After calling both `/extract` and `categorize_transaction()` internally, the final combined
response returned to the frontend must follow this shape for **both** voice and OCR:

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
    "date": null
  },
  "category": {
    "type": "expense",
    "categoryGroup": "Food & Dining",
    "category": "Coffee/Snacks/Fast Food",
    "confidence": 0.92
  },
  "confidence": 0.91,
  "missingFields": [],
  "needsConfirmation": true
}
```

```json
{
  "source": "ocr",
  "fileType": "image",
  "language": "ar",
  "rawText": "مطعم كوشري التحرير...",
  "extracted": {
    "vendor": "Koshary El-Tahrir",
    "invoiceType": "restaurant",
    "items": [{ "name": "Large Koshary", "quantity": 2, "unitPrice": 25, "totalPrice": 50 }],
    "totalAmount": 65.0,
    "taxAmount": 0.0,
    "currency": "EGP",
    "date": "2026-04-13"
  },
  "category": {
    "type": "expense",
    "categoryGroup": "Food & Dining",
    "category": "Restaurants/Dining Out",
    "confidence": 0.95
  },
  "confidence": 0.93,
  "missingFields": [],
  "needsConfirmation": true
}
```

### New Files the AI Partner Must Deliver

```
grad_project_ai/
├── main.py                       ← Modified (6 new routes added)
├── requirements.txt              ← Modified (4 new packages)
├── .env                          ← Modified (4 new env vars)
├── services/
│   ├── speech_service.py         ← NEW: transcribe_audio()
│   ├── ocr_service.py            ← NEW: scan_file(), _read_image(), _read_pdf(), _read_txt()
│   └── llm_service.py            ← Modified: + extract_transaction_info(), + extract_from_ocr_text()

home-backend/
├── server.js                     ← Modified (2 new route registrations)
├── routes/
│   ├── voice.js                  ← NEW: proxy for /api/voice/*
│   └── ocr.js                    ← NEW: proxy for /api/ocr/*
└── models/
    ├── VoiceFeedback.js          ← NEW: feedback schema for voice
    └── OcrFeedback.js            ← NEW: feedback schema for OCR
```

---

*Document Version 2.0 — Updated to include OCR pipeline.*  
*Project: Intelligent Personal Budgeting Application | April 2026*
