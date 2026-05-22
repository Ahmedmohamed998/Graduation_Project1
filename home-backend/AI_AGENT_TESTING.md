# 🤖 AI Agent Integration — Testing Guide

> Test that the AI agent is fully integrated with the home-backend.
> Follow steps **in order**.

---

## ✅ Pre-flight Checklist

Make sure all 3 servers are running before testing:

| Terminal | Command | Port | Status to confirm |
|---|---|---|---|
| Auth Backend | `npm run dev` in `auth-backend/` | **3210** | `Server running on port 3210` |
| Home Backend | `npm run dev` in `home-backend/` | **5001** | `Home Backend Server running on port 5001` |
| AI Agent | `python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload` in `grad_project_ai/` | **8000** | `Application startup complete` |

---

## STEP 1 — Health Check: AI Agent Direct

Confirm the AI agent is alive **before** testing through the home-backend.

**Endpoint:** `GET http://localhost:8000/docs`

Open this URL in your browser. You should see the **FastAPI Swagger UI** page listing the `/api/ai/chat` endpoint.

---

## STEP 2 — Get a Login Token

You need a valid JWT token for all home-backend requests.

**Endpoint:** `POST http://localhost:3210/api/auth/login`

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "your_registered_email@example.com",
  "password": "YourPassword123"
}
```

**Expected Response:** `200 OK`
```json
{
  "success": true,
  "message": "Login successful.",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "username": "...",
    "email": "..."
  }
}
```

> ⚠️ **Copy the `accessToken`** — you will use it in all the steps below.

---

## STEP 3 — Test Home-Backend AI Route (No Auth)

Test that the auth guard is working on the AI route.

**Endpoint:** `POST http://localhost:5001/api/ai/chat`

**Headers:** *(no Authorization header)*
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "message": "How am I doing financially?"
}
```

**Expected Response:** `401 Unauthorized`
```json
{
  "error": "Access denied. No token provided."
}
```

✅ **Pass** = you get 401. The route is protected correctly.

---

## STEP 4 — Test Empty Message Validation

**Endpoint:** `POST http://localhost:5001/api/ai/chat`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <your_accessToken>
```

**Request Body:**
```json
{
  "message": ""
}
```

**Expected Response:** `400 Bad Request`
```json
{
  "error": "Message is required."
}
```

✅ **Pass** = you get 400. Input validation works.

---

## STEP 5 — Test AI Agent When Agent is Offline

> Temporarily stop the AI agent server (Ctrl+C in its terminal), then run this test.

**Endpoint:** `POST http://localhost:5001/api/ai/chat`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <your_accessToken>
```

**Request Body:**
```json
{
  "message": "Am I saving enough money?"
}
```

**Expected Response:** `503 Service Unavailable`
```json
{
  "error": "AI agent is unavailable. Please try again later.",
  "detail": "..."
}
```

✅ **Pass** = you get 503. Error handling works correctly.

> ▶️ **Restart the AI agent** before continuing: `python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload`

---

## STEP 6 — 🔑 Full Integration Test (Main Test)

This is the real test. The AI agent will:
1. Receive your message
2. Fetch your financial data from home-backend (7 endpoints)
3. Send everything to Azure OpenAI
4. Return personalized advice

**Endpoint:** `POST http://localhost:5001/api/ai/chat`

**Headers:**
```
Content-Type: application/json
Authorization: Bearer <your_accessToken>
```

**Request Body:**
```json
{
  "message": "Am I spending too much on food this month?"
}
```

**Expected Response:** `200 OK`
```json
{
  "reply": "Based on your financial data, your Food & Dining spending is... [personalized analysis]",
  "dataUsed": {
    "savingsRate": 86.48,
    "totalIncome": 8500
  }
}
```

✅ **Pass** = you get a real AI-generated response that references your actual financial data.

> ⏳ This may take **5–15 seconds** — the AI agent fetches 7 endpoints + calls Azure OpenAI.

---

## STEP 7 — More Test Messages

Run each of these to verify the agent gives different, contextual responses:

### Test 7a — Savings Question

**Request Body:**
```json
{
  "message": "How long until I reach my savings goal?"
}
```

Expected: Agent mentions your specific goal name, current progress %, and estimated time.

---

### Test 7b — Debt Question

**Request Body:**
```json
{
  "message": "Should I pay off my debt faster?"
}
```

Expected: Agent references your actual debt amount, remaining balance, and interest rate.

---

### Test 7c — Budget Question

**Request Body:**
```json
{
  "message": "Am I staying within my budget this month?"
}
```

Expected: Agent lists your active budgets and how much % of each limit you've used.

---

### Test 7d — Spending Trends Question

**Request Body:**
```json
{
  "message": "How has my spending changed over the last 6 months?"
}
```

Expected: Agent describes the monthly trend (income vs expense vs net savings per month).

---

### Test 7e — General Financial Advice

**Request Body:**
```json
{
  "message": "Give me a plan to save more money next month."
}
```

Expected: Agent gives a specific plan based on your top spending categories.

---

## STEP 8 — Verify Data Flow (Manual Check)

To confirm the AI is using **your real data** (not fake/generic data), do this:

1. Add a transaction: `POST http://localhost:5001/api/transactions`
   ```json
   {
     "type": "expense",
     "amount": 999,
     "category": "Entertainment",
     "description": "Concert tickets"
   }
   ```

2. Then immediately ask the AI:
   ```json
   {
     "message": "What is my biggest expense category right now?"
   }
   ```

3. The AI should mention **Entertainment** (since you just added 999 EGP to it).

✅ **Pass** = AI reflects your live data correctly. Integration is working end-to-end.

---

## 📊 Test Results Checklist

| # | Test | Expected | Pass? |
|---|---|---|---|
| 1 | AI agent Swagger UI loads | FastAPI docs visible at :8000/docs | ☐ |
| 2 | Login returns accessToken | 200 with token | ☐ |
| 3 | No auth → 401 | 401 Unauthorized | ☐ |
| 4 | Empty message → 400 | 400 Bad Request | ☐ |
| 5 | Agent offline → 503 | 503 Service Unavailable | ☐ |
| 6 | Full AI response | 200 with personalized reply | ☐ |
| 7a | Savings question | Mentions specific goal & progress | ☐ |
| 7b | Debt question | Mentions actual debt amount | ☐ |
| 7c | Budget question | Mentions actual budget % used | ☐ |
| 7d | Trends question | Shows 6-month monthly data | ☐ |
| 7e | General advice | Specific to top spending categories | ☐ |
| 8 | Live data test | New transaction reflected in answer | ☐ |

---

## ❌ Troubleshooting

### Problem: `503` even when agent is running
- Check AI agent terminal — look for startup errors
- Confirm it's running on port **8000** not another port
- Check `home-backend/.env` has: `AI_AGENT_URL=http://localhost:8000`

### Problem: `500` from AI agent
- Check AI agent terminal for Python errors
- Most likely cause: Azure OpenAI credentials issue in `grad_project_ai/.env`
- Verify these values are correct in `.env`:
  ```
  AZURE_OPENAI_API_KEY=...
  AZURE_OPENAI_ENDPOINT=...
  AZURE_OPENAI_DEPLOYMENT_NAME=...
  AZURE_OPENAI_API_VERSION=2024-10-21
  ```

### Problem: AI response is generic (not using my data)
- The AI agent fetches data using your token — make sure you have transactions/budgets/savings added
- Check AI agent terminal for any `401` errors (token mismatch between auth & home backends)
- Confirm both backends share the **same `JWT_SECRET`** in their `.env` files

### Problem: Request times out
- Azure OpenAI can be slow — wait up to 30 seconds
- If consistently timing out, check your Azure OpenAI quota and region

### Problem: AI agent can't fetch home-backend data
- Confirm home-backend is running on port **5001**
- Check `grad_project_ai/services/backend_service.py` line 4: `HOME_BACKEND_URL = "http://localhost:5001"`

---

## 🗂️ File Map (What Was Added)

```
Graduation_Project1/
├── home-backend/
│   ├── routes/
│   │   └── ai.js              ← NEW: proxy route → AI agent
│   ├── server.js              ← UPDATED: registered /api/ai route
│   └── .env                   ← UPDATED: added AI_AGENT_URL=http://localhost:8000
│
└── grad_project_ai/
    ├── main.py                ← AI agent FastAPI app (POST /api/ai/chat)
    ├── services/
    │   ├── backend_service.py ← fetches 7 endpoints from home-backend
    │   └── llm_service.py     ← sends data + question to Azure OpenAI
    ├── mock_home_backend.py   ← fake home-backend for offline testing
    ├── test_agent.py          ← quick Python test script
    ├── requirements.txt       ← UPDATED: pinned working versions
    └── .env                   ← Azure OpenAI credentials
```

---

## 🚀 Quick Start Commands

```bash
# Terminal 1 — Auth Backend
cd D:\Visual_StudioCode\Graduation_Project1\auth-backend
npm run dev

# Terminal 2 — Home Backend
cd D:\Visual_StudioCode\Graduation_Project1\home-backend
npm run dev

# Terminal 3 — AI Agent
cd D:\Visual_StudioCode\Graduation_Project1\grad_project_ai
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Single endpoint the frontend needs:**
```
POST http://localhost:5001/api/ai/chat
Authorization: Bearer <token>
{ "message": "Your question here" }
```

---

*Last Updated: March 16, 2026*
