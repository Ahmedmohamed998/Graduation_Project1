# 🎓 Graduation Project — Complete Technical Guide
> **Intelligent Personal Budgeting Application**  
> A full-stack, AI-powered financial management system built with a microservices architecture.

---

## 🚀 1. Project Overview 

> *"My graduation project is an **Intelligent Personal Budgeting Application**. It is a full-stack web system that helps users manage their finances intelligently — tracking income and expenses, setting budgets, managing debts, achieving savings goals, and getting **AI-powered financial advice** personalized to their real spending data.*
>
> *I was responsible for the backend, where I designed and implemented RESTful APIs across three separate microservices, handled data storage in MongoDB, managed authentication with JWT, and integrated an AI agent powered by Azure OpenAI."*

### Quick Summary

| Item | Details |
|------|---------|
| **Project Type** | Full-Stack Web Application (Microservices Architecture) |
| **My Role** | Backend Developer |
| **Backend Runtime** | Node.js |
| **AI Service** | Python (FastAPI) |
| **Database** | MongoDB (NoSQL) |
| **Authentication** | JWT (JSON Web Tokens) + Google OAuth |
| **AI Integration** | Azure OpenAI (GPT model) |
| **API Style** | RESTful APIs |

---

## ⚙️ 2. Backend Architecture

### System Overview

The project is divided into **3 backend microservices**, each responsible for a specific domain:

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (Client)                    │
└─────────┬───────────────────┬───────────────────────────┘
          │                   │                   │
          ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────────┐   ┌────────────────┐
│ auth-backend │   │  home-backend    │   │ grad_project_ai│
│  Port: 3210  │   │  Port: 5001      │   │  Port: 8000    │
│              │   │                  │   │                │
│ - Signup     │   │ - Transactions   │   │ - AI Chat      │
│ - Login      │   │ - Budgets        │   │ - Financial    │
│ - Google SSO │   │ - Savings        │   │   Advisor Bot  │
│ - 2FA (SMS)  │   │ - Debts          │   │ (Azure OpenAI) │
│ - JWT Tokens │   │ - Analytics      │   │                │
│ - OTP Email  │   │ - Dashboard      │   │                │
└──────────────┘   └──────────────────┘   └────────────────┘
          │                   │
          └─────────┬─────────┘
                    ▼
         ┌─────────────────────┐
         │      MongoDB        │
         │  (Shared Database)  │
         └─────────────────────┘
```

### Layered Architecture (MVC Pattern)

Each Node.js service follows a clear **3-layer architecture**:

```
Request
   │
   ▼
[Routes]        → Defines the URL path and HTTP method
   │
   ▼
[Controllers]   → Handles business logic, validates data
   │
   ▼
[Models]        → Mongoose schemas, interacts with MongoDB
   │
   ▼
[Database]      → MongoDB stores/retrieves the data
   │
   ▼
Response (JSON)
```

**Example explanation for the committee:**
> *"I structured the backend using a layered MVC approach: routes define the API endpoints, controllers contain all business logic, and Mongoose models define the database structure. This separation of concerns makes the code clean and maintainable."*

---

## 🌐 3. API & Endpoints

### What is an API?

> *"An API (Application Programming Interface) allows the frontend to communicate with the backend using HTTP requests. The frontend sends a request (e.g., GET, POST), the backend processes it, and returns a JSON response."*

### Service 1: `auth-backend` — Authentication APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/signup` | Register a new user (email + password) |
| `POST` | `/api/auth/signup-phone` | Register using phone number |
| `POST` | `/api/auth/login` | Login and receive JWT tokens |
| `POST` | `/api/auth/google-signin` | Login / Register with Google OAuth |
| `POST` | `/api/auth/forgot-password` | Send password-reset email (OTP) |
| `POST` | `/api/auth/reset-password` | Reset password with OTP token |
| `POST` | `/api/auth/refresh-token` | Get a new access token using refresh token |
| `POST` | `/api/auth/logout` | Logout and invalidate tokens |
| `GET`  | `/api/auth/me` | Get current authenticated user info |
| `POST` | `/api/auth/sms/send` | Send OTP code via SMS (Twilio) |
| `POST` | `/api/auth/sms/verify` | Verify the OTP code |
| `GET`  | `/api/security` | Get security settings (2FA, etc.) |

### Service 2: `home-backend` — Financial Management APIs

All these endpoints require a valid **JWT token** in the request header.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dashboard` | Dashboard summary (balance, income, expense) |
| `POST` | `/api/transactions` | Create a new transaction |
| `GET` | `/api/transactions` | Get all transactions (filter by type, category, date) |
| `GET` | `/api/transactions/:id` | Get a single transaction |
| `PUT` | `/api/transactions/:id` | Update a transaction |
| `DELETE` | `/api/transactions/:id` | Delete a transaction |
| `POST` | `/api/budgets` | Create a budget for a category |
| `GET` | `/api/budgets` | Get all budgets |
| `PUT` | `/api/budgets/:id` | Update a budget |
| `DELETE` | `/api/budgets/:id` | Delete a budget |
| `POST` | `/api/savings` | Create a savings goal |
| `GET` | `/api/savings` | Get all savings goals |
| `POST` | `/api/savings/:id/contribute` | Add money toward a savings goal |
| `DELETE` | `/api/savings/:id` | Delete a savings goal |
| `POST` | `/api/debts` | Record a new debt |
| `GET` | `/api/debts` | Get all debts |
| `POST` | `/api/debts/:id/payment` | Record a debt payment |
| `DELETE` | `/api/debts/:id` | Delete a debt |
| `GET` | `/api/analytics/overview` | Financial summary (income/expenses, params: `?period=monthly`) |
| `GET` | `/api/analytics/categories` | Spending by category |
| `GET` | `/api/analytics/trends` | Historical trends (params: `?months=6`) |
| `GET` | `/api/profile` | Get user profile |
| `PUT` | `/api/profile` | Update profile (name, photo, currency) |
| `GET` | `/api/offers` | Get active offers/deals |
| `POST` | `/api/ai/chat` | Send message to AI financial advisor |

### Service 3: `grad_project_ai` — AI Agent API

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/ai/chat` | Send a financial question, receive AI-powered personalized advice |

**Example Request:**
```json
POST /api/ai/chat
{
  "message": "How can I save more money this month?",
  "accessToken": "eyJhbGci..."
}
```

**Example Response:**
```json
{
  "reply": "Based on your data, you spent 35% of your income on Food this month. Try reducing it by 10% to save an extra $85.",
  "dataUsed": {
    "savingsRate": 22.5,
    "totalIncome": 8500.00
  }
}
```

### HTTP Status Codes

| Code | Meaning |
|------|---------|
| `200` | OK — Request succeeded |
| `201` | Created — New resource created (e.g., new transaction) |
| `400` | Bad Request — Invalid input from client |
| `401` | Unauthorized — Missing or invalid JWT token |
| `403` | Forbidden — Valid token but no permissions |
| `404` | Not Found — Resource doesn't exist |
| `429` | Too Many Requests — Rate limit exceeded |
| `500` | Internal Server Error — Something broke on the server |

---

## 🗄️ 4. Database & Data Storage

### Why MongoDB (NoSQL)?

> *"We chose MongoDB because our data is semi-structured and flexible — each transaction can have different optional fields (notes, attachments, tags). MongoDB's document-based model, using JSON-like BSON documents, gives us that flexibility without needing a rigid schema."*

### Database Models (Schemas)

**Transaction Model:**
```javascript
{
  userId,         // Reference to the User (from auth-backend)
  type,           // "income" or "expense"
  amount,         // Number
  category,       // e.g., "Food & Dining", "Salary"
  description,    // Text
  date,           // Date
  paymentMethod,  // e.g., "credit_card", "cash"
  tags,           // Array of strings
  notes           // Optional text
}
```

**Budget Model:**
```javascript
{
  userId,
  name,           // Budget name
  category,       // Spending category
  limitAmount,    // Maximum allowed spending
  spentAmount,    // Current spending tracked
  period,         // "monthly" / "weekly"
  startDate, endDate,
  isActive,
  alertThreshold  // e.g., 80% → triggers warning
}
```

**Savings Goal Model:**
```javascript
{
  userId,
  name,           // e.g., "New Laptop"
  targetAmount,   // Goal target
  savedAmount,    // Amount saved so far
  deadline,       // Target date
  priority,       // "high" / "medium" / "low"
  isCompleted     // Boolean
}
```

**Debt Model:**
```javascript
{
  userId,
  creditorName,   // Who you owe money to
  totalAmount,    // Total debt
  paidAmount,     // Amount paid so far
  interestRate,   // Interest percentage
  dueDate,
  status,         // "active" / "paid"
  payments[]      // Array of payment records
}
```

### Basic Database Operations (CRUD)

| Operation | MongoDB Method | HTTP Method |
|-----------|---------------|-------------|
| **Create** | `Model.create()` | `POST` |
| **Read** | `Model.find()` / `Model.findById()` | `GET` |
| **Update** | `Model.findByIdAndUpdate()` | `PUT` |
| **Delete** | `Model.findByIdAndDelete()` | `DELETE` |

---

## 🔗 5. How Everything Connects — The Full Flow

### Standard Request Flow

```
User Action (Frontend)
        │
        ▼
HTTP Request (with JWT Token in header)
        │
        ▼
  [auth-backend validates token] / [home-backend middleware: verifyToken.js]
        │
        ▼
  Router → Controller → Model → MongoDB
        │
        ▼
  JSON Response → Frontend
```

### AI Chat Flow (The Most Impressive Feature)

```
User asks: "Am I spending too much on food?"
        │
        ▼
Frontend → POST /api/ai/chat  { message, accessToken }
        │
        ▼
grad_project_ai (FastAPI, Python)
        │
        ├─→ Fetches user's real data from home-backend in PARALLEL:
        │     • /api/analytics/overview
        │     • /api/analytics/categories
        │     • /api/analytics/trends
        │     • /api/transactions (last 20)
        │     • /api/budgets
        │     • /api/savings
        │     • /api/debts
        │
        ▼
  Builds full user context (financial snapshot)
        │
        ▼
  Sends to Azure OpenAI (GPT) with user's real data as context
        │
        ▼
  AI generates personalized advice based on actual numbers
        │
        ▼
  Returns { reply, dataUsed } → Frontend shows the advice
```

---

## 🧠 6. Problem-Solving — Challenges & Solutions

### Challenge 1: Building a Real AI Agent (Not Generic Advice)
**Problem:** Generic AI responses are useless for a budgeting app.  
**Solution:** Before every AI query, the system fetches **7 financial data endpoints in parallel** using `asyncio.gather()` (Python), builds a full user financial context, and injects it into the AI prompt. The AI then gives advice tied to real numbers, not generic tips.

### Challenge 2: Microservices Communication & Token Sharing
**Problem:** The AI service (Python/FastAPI) needed to access user data from the Node.js home-backend securely.  
**Solution:** The user's JWT token is passed with the AI chat request. The AI service forwards this token to the home-backend, which validates it via the shared JWT secret. No separate auth is needed between services.

### Challenge 3: Security Across Services
**Problem:** Two Node.js backends need to share authentication.  
**Solution:** Both `auth-backend` and `home-backend` use the **same `JWT_SECRET`** environment variable. The auth-backend issues the token, and the home-backend's `verifyToken.js` middleware validates it independently.

### Challenge 4: Rate Limiting for AI Endpoint
**Problem:** AI calls are expensive; unlimited requests would be costly.  
**Solution:** Used `slowapi` (Python rate limiting library) to enforce **20 requests per minute per user IP** on the AI endpoint.

### Challenge 5: Multi-Method Authentication
**Problem:** Supporting multiple login methods (email, phone, Google).  
**Solution:** Implemented three separate signup/login flows; Google OAuth uses `google-auth-library` to verify Google ID tokens and map them to internal users.

---

## 🧪 7. Testing & Debugging

### Tools Used

- **Postman / Thunder Client** — Manual API testing (sending requests, viewing responses)
- **Winston** — Structured logging library (logs every request, error, and event to files)
- **Nodemon** — Auto-restarts server on code changes during development
- **`.env` files** — Environment variable management (keeps secrets out of code)
- **Health Check Endpoint** — `GET /health` on home-backend returns service status

### How I Debugged

1. Checked **Winston log files** (`logs/combined.log`, `logs/error.log`)
2. Used **Thunder Client** to test each endpoint individually
3. Used `console.log()` for quick in-development debugging
4. Checked **MongoDB** directly for data consistency

---

## 🤝 8. Team Collaboration

- Used **Git** for version control with **GitHub**
- Divided work: Auth Backend / Home Backend / AI Service / Frontend
- Each microservice is in its own **folder** for clear separation
- `.env` files are in `.gitignore` — secrets are never pushed to GitHub
- Used **README.md** files per service for documentation

---

## 📦 9. Complete Technology Stack with Versions

### Service 1: `auth-backend` (Node.js)

| Library | Version | Purpose |
|---------|---------|---------|
| **Node.js** | v14+ | JavaScript runtime |
| **express** | `^5.1.0` | Web framework — handles HTTP routes |
| **mongoose** | `^8.20.1` | MongoDB ODM — database schemas & queries |
| **jsonwebtoken** | `^9.0.2` | Create & verify JWT access/refresh tokens |
| **bcryptjs** | `^3.0.3` | Hash passwords securely before storing |
| **dotenv** | `^17.2.3` | Load environment variables from `.env` file |
| **cors** | `^2.8.5` | Enable Cross-Origin Resource Sharing |
| **cookie-parser** | `^1.4.7` | Parse cookies (used for refresh tokens) |
| **google-auth-library** | `^10.5.0` | Verify Google OAuth ID tokens (Google Sign-In) |
| **nodemailer** | `^7.0.10` | Send OTP/reset emails via SMTP |
| **twilio** | `^5.10.5` | Send OTP verification codes via SMS |
| **speakeasy** | `^2.0.0` | Generate TOTP/2FA one-time passwords |
| **qrcode** | `^1.5.4` | Generate QR codes for 2FA setup |
| **express-rate-limit** | `^8.2.1` | Limit login attempts — prevent brute force |
| **node-cron** | `^4.2.1` | Schedule periodic background tasks |
| **winston** | `^3.18.3` | Structured logging (info, error, warn levels) |
| **nodemon** | `^3.1.11` | Dev tool — auto-restart on file changes |
| **axios** | `^1.13.2` | HTTP client (service-to-service calls) |

---

### Service 2: `home-backend` (Node.js)

| Library | Version | Purpose |
|---------|---------|---------|
| **Node.js** | v14+ | JavaScript runtime |
| **express** | `^4.18.2` | Web framework — handles HTTP routes |
| **mongoose** | `^7.5.0` | MongoDB ODM — schemas for Transactions, Budgets, Debts, etc. |
| **jsonwebtoken** | `^9.0.2` | Verify JWT tokens from auth-backend |
| **bcryptjs** | `^2.4.3` | Password hashing utilities |
| **dotenv** | `^16.3.1` | Load environment variables from `.env` file |
| **cors** | `^2.8.5` | Allow frontend requests from different origin |
| **cookie-parser** | `^1.4.6` | Parse incoming cookies |
| **winston** | `^3.10.0` | Logging — records requests and errors |
| **nodemon** | `^3.0.1` | Dev tool — auto-restart on file changes |
| **axios** | `^1.13.2` | HTTP client (for AI service communication) |

---

### Service 3: `grad_project_ai` (Python / FastAPI)

| Library | Version | Purpose |
|---------|---------|---------|
| **Python** | 3.10+ | Programming language |
| **fastapi** | `0.104.1` | Modern async web framework for APIs |
| **uvicorn** | `0.24.0` | ASGI server — runs the FastAPI app |
| **pydantic** | `2.12.5` | Data validation — validates request body shapes |
| **openai** | `2.28.0` | Azure OpenAI SDK — calls GPT via Azure endpoint |
| **httpx** | `0.28.1` | Async HTTP client — fetches user data from home-backend |
| **slowapi** | `0.1.9` | Rate limiting middleware for FastAPI |
| **python-dotenv** | `1.0.0` | Load environment variables from `.env` file |

---

### Database & Infrastructure

| Tool | Version | Purpose |
|------|---------|---------|
| **MongoDB** | Latest / Atlas | NoSQL document database — stores all app data |
| **MongoDB Atlas** | Cloud | Cloud-hosted MongoDB (production) |
| **Azure OpenAI** | GPT-4o / GPT-4 | AI language model for financial advice |

---

## 🚀 10. Bonus Points — Advanced Concepts to Mention

> Saying these = **instant level-up** in the committee's eyes

### ✅ RESTful API Design
> *"I followed REST principles: using the correct HTTP methods (GET to read, POST to create, PUT to update, DELETE to remove), meaningful URL paths, and standard status codes."*

### ✅ MVC Pattern
> *"The backend uses an MVC (Model-View-Controller) pattern. Models define the database structure, Controllers handle the logic, and Routes map URLs to controllers."*

### ✅ JWT Authentication with Refresh Tokens
> *"We use two tokens: a short-lived **Access Token** (expires in minutes) for API calls, and a long-lived **Refresh Token** (stored in a cookie) to get a new access token without re-logging in. This is a standard industry practice."*

### ✅ Microservices Architecture
> *"Instead of one large app, we split the backend into three separate services: auth, finance, and AI. Each runs independently, can be scaled separately, and has a single responsibility."*

### ✅ Asynchronous Programming
> *"The AI service uses Python's `asyncio` and `async/await` to fetch data from 7 different endpoints **simultaneously** using `asyncio.gather()`, which is much faster than fetching them one by one."*

### ✅ Environment Variables & Security
> *"Sensitive data like database passwords, JWT secrets, and API keys are never hardcoded. They are stored in `.env` files and loaded at runtime using `dotenv`."*

### ✅ Rate Limiting
> *"To protect the AI endpoint from abuse, I implemented rate limiting — max 20 requests per minute per user. This also controls costs since Azure OpenAI charges per token."*

### ✅ Error Handling
> *"Every service has a centralized error handling middleware that catches unhandled errors and returns a clean JSON response with a meaningful status code, instead of crashing the server."*

### ✅ Google OAuth Integration
> *"Users can sign in with their Google account. The frontend sends a Google ID token to our backend, which verifies it using `google-auth-library`, and then creates or finds the user in our database."*

---

## 🎯 Quick Answer Sheet — What They Will Ask

| Question | Your Answer |
|----------|------------|
| *What is your project?* | "An intelligent personal budgeting app with AI financial advice." |
| *What is your role?* | "Backend developer — I built the RESTful APIs, database, auth system, and AI integration." |
| *What backend tech did you use?* | "Node.js with Express for two services, and Python with FastAPI for the AI service." |
| *What database?* | "MongoDB — a NoSQL document database, because our data structure is flexible and JSON-based." |
| *What is a REST API?* | "It uses HTTP methods (GET, POST, PUT, DELETE) to communicate between frontend and backend via JSON." |
| *How does authentication work?* | "Users log in → auth-backend validates credentials → issues JWT access + refresh tokens → frontend includes token in every request header." |
| *What is JWT?* | "JSON Web Token — a secure, encoded string containing user info, signed with a secret key so it can't be tampered with." |
| *What is the hardest part?* | "Building the AI agent to use real user data — I had to fetch 7 data points simultaneously and inject them as context into the AI prompt." |
| *How did you test?* | "I used Postman and Thunder Client to test every endpoint manually, and Winston for server-side logging." |
| *Did you use version control?* | "Yes, Git and GitHub. We used branches to separate work between team members." |

---

*Last updated: March 2026 | Graduation Project — Intelligent Personal Budgeting Application*
