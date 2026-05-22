# 🤖 AI Agent Integration Guide

> **For the AI Agent team** — How to connect the financial advisor agent to the backend.

---

## 📌 Overview

The AI agent's job:
1. **Receive** a chat message from the user
2. **Fetch** the user's full financial data from the backend
3. **Analyze** purchases, expenses, income, budgets, savings, and debts
4. **Respond** with personalized financial advice

The backend already has all the data. The AI agent just needs to **read it** and **expose a chat endpoint**.

---

## 🌐 Backend Base URL

```
http://localhost:5001   ← Home Backend (all financial data is here)
http://localhost:3210   ← Auth Backend (for token verification)
```

---

## 🔐 Authentication

Every request to the home-backend requires a JWT token passed from the frontend:

```
Authorization: Bearer <accessToken>
```

The AI agent must **forward this token** with each backend call to identify the user.

---

## 📋 Data the Agent Needs to Fetch

Before answering any user query, the agent should pull this data:

### 1️⃣ Analytics Overview (most important)

**Endpoint:** `GET http://localhost:5001/api/analytics/overview?period=monthly`

**Response will give:**
```json
{
  "period": "monthly",
  "summary": {
    "totalIncome": 8500,
    "totalExpense": 1150.5,
    "netSavings": 7349.5,
    "savingsRate": 86.48,
    "transactionCount": 5
  }
}
```

---

### 2️⃣ Category Breakdown (spending habits)

**Endpoint:** `GET http://localhost:5001/api/analytics/categories?type=expense&period=monthly`

**Response will give:**
```json
{
  "totalAmount": 1150.5,
  "breakdown": [
    { "category": "Food & Dining", "amount": 600.5, "count": 2, "percentage": 52.17 },
    { "category": "Transportation", "amount": 300, "count": 1, "percentage": 26.08 },
    { "category": "Entertainment", "amount": 250, "count": 1, "percentage": 21.74 }
  ]
}
```

---

### 3️⃣ Spending Trends (last 6 months)

**Endpoint:** `GET http://localhost:5001/api/analytics/trends?months=6`

**Response will give:**
```json
{
  "trends": [
    { "month": "Sep 2025", "income": 7000, "expense": 900, "net": 6100 },
    { "month": "Oct 2025", "income": 7500, "expense": 1100, "net": 6400 },
    { "month": "Feb 2026", "income": 8500, "expense": 1150, "net": 7350 }
  ]
}
```

---

### 4️⃣ Recent Transactions

**Endpoint:** `GET http://localhost:5001/api/transactions?limit=20&page=1`

**Response will give:**
```json
{
  "transactions": [
    {
      "type": "expense",
      "amount": 150.5,
      "category": "Food & Dining",
      "description": "Grocery shopping",
      "date": "2026-02-25T00:00:00.000Z",
      "paymentMethod": "cash"
    }
  ],
  "pagination": { "total": 45, "page": 1, "limit": 20 }
}
```

---

### 5️⃣ Budgets (to check overspending)

**Endpoint:** `GET http://localhost:5001/api/budgets?isActive=true`

**Response will give:**
```json
{
  "budgets": [
    {
      "name": "Monthly Food Budget",
      "category": "Food & Dining",
      "limitAmount": 2000,
      "spentAmount": 600.5,
      "remainingAmount": 1399.5,
      "percentageSpent": 30.03
    }
  ]
}
```

---

### 6️⃣ Savings Goals (user priorities)

**Endpoint:** `GET http://localhost:5001/api/savings?isCompleted=false`

**Response will give:**
```json
{
  "savingsGoals": [
    {
      "name": "Vacation Fund",
      "targetAmount": 15000,
      "savedAmount": 3000,
      "remainingAmount": 12000,
      "progressPercentage": 20,
      "priority": "high",
      "deadline": "2026-07-01T00:00:00.000Z"
    }
  ]
}
```

---

### 7️⃣ Debts (financial obligations)

**Endpoint:** `GET http://localhost:5001/api/debts?status=active`

**Response will give:**
```json
{
  "debts": [
    {
      "creditorName": "Bank Loan",
      "totalAmount": 50000,
      "paidAmount": 5000,
      "remainingAmount": 45000,
      "paymentProgress": 10,
      "interestRate": 7.5
    }
  ]
}
```

---

## 🧠 How to Build the Agent Context

Before calling the LLM (GPT / Gemini / Claude etc.), build a context object like this:

```javascript
async function buildUserContext(accessToken) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const base = "http://localhost:5001";

  const [overview, categories, trends, transactions, budgets, savings, debts] =
    await Promise.all([
      fetch(`${base}/api/analytics/overview?period=monthly`, { headers }).then(r => r.json()),
      fetch(`${base}/api/analytics/categories?type=expense&period=monthly`, { headers }).then(r => r.json()),
      fetch(`${base}/api/analytics/trends?months=6`, { headers }).then(r => r.json()),
      fetch(`${base}/api/transactions?limit=20`, { headers }).then(r => r.json()),
      fetch(`${base}/api/budgets?isActive=true`, { headers }).then(r => r.json()),
      fetch(`${base}/api/savings?isCompleted=false`, { headers }).then(r => r.json()),
      fetch(`${base}/api/debts?status=active`, { headers }).then(r => r.json()),
    ]);

  return {
    overview: overview.summary,
    topSpendingCategories: categories.breakdown,
    spendingTrends: trends.trends,
    recentTransactions: transactions.transactions,
    activeBudgets: budgets.budgets,
    savingsGoals: savings.savingsGoals,
    activeDebts: debts.debts,
  };
}
```

---

## 💬 System Prompt for the LLM

Use this system prompt when calling your LLM:

```
You are a personal financial advisor AI assistant for a budgeting app.

You have access to the user's complete financial data:
- Monthly income, expenses, and net savings
- Spending breakdown by category
- 6-month spending trends
- Recent transactions
- Active budgets and how close to limit they are
- Savings goals and progress
- Outstanding debts

Your job is to:
1. Analyze the user's financial patterns before every response
2. Provide specific, personalized advice based on THEIR actual data
3. Warn about overspending in specific categories
4. Celebrate progress on savings goals
5. Suggest realistic ways to save more or reduce debt
6. Be encouraging but honest

Always reference specific numbers from the user's data in your response.
Never give generic advice — always tie it to the user's actual numbers.
Keep responses concise and actionable.
```

---

## 🔌 Endpoint the Agent Must Expose

The AI agent should expose **one endpoint** for the frontend to call:

### Chat with AI Agent

**Endpoint:** `POST http://localhost:<AI_PORT>/api/ai/chat`

**Request Body:**
```json
{
  "message": "Should I spend more on entertainment this month?",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Expected Response:**
```json
{
  "reply": "Based on your data, you've already spent 250 EGP on Entertainment this month (21.74% of your total expenses). Your income is 8,500 EGP and your savings rate is 86.48% — which is excellent! You can afford a small increase in entertainment, but I'd suggest keeping it under 500 EGP so you can stay on track for your Vacation Fund goal (currently at 20% progress). You need 12,000 EGP more by July 1st, so every extra saving counts!",
  "dataUsed": {
    "period": "February 2026",
    "entertainmentSpent": 250,
    "savingsRate": 86.48,
    "topGoal": "Vacation Fund"
  }
}
```

---

## 🗂️ Suggested Agent Architecture

```
Frontend
   │
   │  POST /api/ai/chat  { message, accessToken }
   ▼
AI Agent Server (your team's server)
   │
   ├── 1. Fetch user data from home-backend (7 endpoints in parallel)
   ├── 2. Build context object
   ├── 3. Build system prompt + user message
   ├── 4. Call LLM API (GPT / Gemini / Claude)
   └── 5. Return response to frontend
```

---

## 📡 Data Summary the Agent Will Work With

| Data | Endpoint | Key Fields for Analysis |
|---|---|---|
| Financial overview | `/api/analytics/overview` | totalIncome, totalExpense, savingsRate |
| Spending by category | `/api/analytics/categories` | category, amount, percentage |
| 6-month trends | `/api/analytics/trends` | income, expense, net per month |
| Recent transactions | `/api/transactions?limit=20` | type, amount, category, description |
| Budget usage | `/api/budgets` | limitAmount, spentAmount, percentageSpent |
| Savings progress | `/api/savings` | targetAmount, savedAmount, progressPercentage, deadline |
| Debt obligations | `/api/debts` | remainingAmount, paymentProgress, interestRate |

---

## ⚡ Quick Start Checklist for AI Team

- [ ] Choose your LLM provider (OpenAI / Google Gemini / Anthropic)
- [ ] Set up your AI agent server (Node.js / Python / etc.)
- [ ] Implement `buildUserContext()` to fetch data from home-backend
- [ ] Write your system prompt (template above)
- [ ] Expose `POST /api/ai/chat` endpoint
- [ ] Handle the `accessToken` forwarding securely
- [ ] Test with sample questions (see below)

---

## 🧪 Sample Test Questions

Use these to test your agent after setup:

| Question | What Agent Should Use |
|---|---|
| "Am I spending too much on food?" | Categories breakdown, food % |
| "How long until I reach my vacation goal?" | Savings goal progress + deadline |
| "Should I pay off my debt faster?" | Debt remaining + interest rate + savings rate |
| "What's my biggest expense this month?" | Category breakdown sorted by amount |
| "Can I afford a new phone this month?" | Current balance, savings rate, active budgets |
| "How has my spending changed in 6 months?" | Trends data month by month |
| "Give me a budget plan for next month" | All data combined |

---

## 🔒 Security Notes

1. **Never store the accessToken** — use it only for that request session
2. **Validate the token** before fetching data (if 401 from home-backend, return error to user)
3. **Don't expose user financial data** in error messages
4. **Rate limit** the chat endpoint (e.g., max 20 messages per user per hour)

---

## 📌 Key Info

| Item | Value |
|---|---|
| Home Backend URL | `http://localhost:5001` |
| Auth method | Bearer token (forwarded from frontend) |
| Data endpoints | 7 endpoints (all GET, see table above) |
| Agent endpoint to expose | `POST /api/ai/chat` |
| Token used | Same `accessToken` user gets from login |

---

*Last Updated: February 25, 2026*
