# 🔬 Hasibha Backend — Full QA & Security Audit Report

> **Date:** May 19, 2026  
> **Auditor:** Senior Backend QA + Security Auditor  
> **Method:** Static code analysis + live test scripts (servers offline due to MongoDB Atlas IP whitelist block)  
> **Services:** auth-backend (3210) · home-backend (5001) · grad_project_ai (8000)

---

## ⚠️ Why Live Tests Could Not Execute

Both servers crashed at startup:

```
❌ Could not connect to any servers in your MongoDB Atlas cluster.
   One common reason is that you're trying to access the database
   from an IP that isn't whitelisted.
```

**Root Cause:** Both `.env` files use MongoDB Atlas (`mongodb+srv://hasibha-cluster.vggy436.mongodb.net`).
The current machine's IP is not in the Atlas Network Access whitelist.

**Fix before next test run:**
1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) → Security → Network Access
2. Click **"+ Add IP Address"** → **"Add Current IP Address"** → Confirm
3. Wait ~30 seconds → restart both servers

---

## ✅ PASSED TESTS (Static Analysis — Confirmed Correct)

| # | Area | Finding |
|---|---|---|
| 1 | Auth — JWT Verification | `verifyToken.js` correctly checks `Bearer ` prefix, rejects missing/expired/invalid tokens |
| 2 | Auth — No Algorithm Downgrade | `jwt.verify()` uses secret-based verification, not public-key — `alg:none` attack is rejected by `jsonwebtoken` |
| 3 | Auth — Token Expiry Differentiated | Separate error messages for `TokenExpiredError` vs `JsonWebTokenError` — correct |
| 4 | Auth — IDOR on Transactions (GET) | `findOne({ _id: id, userId })` — userId always scoped from JWT, not from body |
| 5 | Auth — IDOR on Transactions (DELETE) | Same `findOne({ _id: id, userId })` pattern — correct |
| 6 | Auth — IDOR on Budgets | `findOne({ _id: id, userId })` used — correct |
| 7 | Auth — IDOR on Savings | `findOne({ _id: id, userId })` used — correct |
| 8 | Auth — IDOR on Debts | `findOne({ _id: id, userId })` used — correct |
| 9 | Transactions — Type Validation | Rejects anything not `income` or `expense` |
| 10 | Transactions — Amount > 0 | `if (amount <= 0)` → 400 enforced |
| 11 | Transactions — Required fields | `type`, `amount`, `category` checked before DB write |
| 12 | Transactions — userId from JWT | `userId` always taken from `req.userId` (JWT), never from `req.body` |
| 13 | Transactions — Balance Recalc on Update | Old amount reversed, new amount applied — correct logic |
| 14 | Transactions — Balance Recalc on Delete | Account balance restored correctly on delete |
| 15 | Notifications — All routes protected | `router.use(verifyToken)` applied to all `/api/notifications/*` routes |
| 16 | FCM — Token upsert | Uses `findOneAndUpdate` with `upsert:true` — no duplicate tokens |
| 17 | FCM — Invalid token cleanup | `sendToUser()` removes invalid/expired tokens from DB automatically |
| 18 | Savings — Goal auto-complete | `isCompleted = true` set when `savedAmount >= targetAmount` |
| 19 | Savings — Milestone notifications | 25%, 50%, 75%, 100% milestones correctly triggered |
| 20 | Firebase — Singleton init | `initFirebase()` uses singleton pattern — no re-initialization |

---

## ❌ FAILED TESTS / BUGS

### BUG-001 — Mass Assignment on Transaction Update
**Severity:** 🔴 High  
**File:** `home-backend/controllers/transactionController.js` — Line 223  

```javascript
// VULNERABLE:
Object.assign(transaction, updates);   // ← assigns ALL body fields, no filter
await transaction.save();
```

**Problem:** A user can send `{ "userId": "another_user_id", "createdAt": "2000-01-01" }` in the `PUT /api/transactions/:id` body and those fields will be written to the document.

**Proof of Concept:**
```json
PUT /api/transactions/:id
{ "userId": "victim_user_id", "amount": 999 }
```
This would reassign the transaction to a different user.

**Recommended Fix:**
```javascript
// Allowlist only safe fields:
const allowed = ['type','amount','category','categoryGroup','description','date','paymentMethod','tags','notes'];
const safeUpdates = {};
allowed.forEach(k => { if (updates[k] !== undefined) safeUpdates[k] = updates[k]; });
Object.assign(transaction, safeUpdates);
```

---

### BUG-002 — Missing ObjectId Validation (Potential 500 on Malformed ID)
**Severity:** 🟡 Medium  
**Files:** All controllers using `:id` params  

```javascript
const transaction = await Transaction.findOne({ _id: id, userId });
// ↑ If id = "NOT_A_VALID_MONGO_ID", Mongoose throws CastError → next(error) → 500
```

**Problem:** Passing a non-ObjectId string (e.g. `GET /api/transactions/HACKED`) throws a Mongoose CastError that reaches `next(error)` → returns 500 with a stack trace, not a clean 400.

**Recommended Fix:** Add ObjectId validation in each controller or as shared middleware:
```javascript
const mongoose = require('mongoose');
if (!mongoose.Types.ObjectId.isValid(id)) {
  return res.status(400).json({ error: 'Invalid ID format' });
}
```

---

### BUG-003 — NoSQL Injection via Query Parameters
**Severity:** 🔴 High  
**File:** `home-backend/controllers/transactionController.js` — Lines 128–133  

```javascript
if (type) query.type = type;           // ← raw query param assigned to MongoDB query
if (category) query.category = category;
if (startDate) query.date.$gte = new Date(startDate);
```

**Problem:** A request like `GET /api/transactions?type[$ne]=expense` passes `{ $ne: 'expense' }` directly into the Mongoose query, which MongoDB will execute as an operator.

**Proof of Concept:**
```
GET /api/transactions?category[$ne]=x
```
Returns ALL transactions regardless of category — NoSQL injection confirmed by code inspection.

**Recommended Fix:**
```javascript
// Sanitize query params — only accept plain strings:
if (type && typeof type === 'string') query.type = type;
if (category && typeof category === 'string') query.category = category;
// Or use a sanitization library: npm install express-mongo-sanitize
```

---

### BUG-004 — Balance Floating Point Accumulation Error
**Severity:** 🟡 Medium  
**File:** `home-backend/controllers/transactionController.js` — Lines 51–53  

```javascript
account.totalBalance += amount;   // ← raw float addition
account.totalBalance -= amount;
```

**Problem:** `roundToTwo()` is applied to the transaction amount when saving, but NOT when updating the balance. Over many transactions, floating point drift accumulates (e.g., `0.1 + 0.2 = 0.30000000000000004`).

**Recommended Fix:**
```javascript
account.totalBalance = roundToTwo(account.totalBalance + amount);
account.totalBalance = roundToTwo(account.totalBalance - amount);
```

---

### BUG-005 — Budget Exceeded Notification Fires Every Transaction
**Severity:** 🟡 Medium  
**File:** `home-backend/controllers/transactionController.js` — Lines 94–98  

```javascript
if (percentUsed >= 100) {
    notifyBudgetExceeded(...);  // ← fires on EVERY expense after 100%
} else if (percentUsed >= threshold) {
    notifyBudgetAlert(...);     // ← fires on EVERY expense after threshold
}
```

**Problem:** Once a budget is exceeded, every subsequent expense in that category sends another "Budget Exceeded" push notification — spam.

**Recommended Fix:** Track `alertSent` and `exceededSent` boolean flags on the Budget model, only fire once per state transition.

---

### BUG-006 — Weak JWT Secret in Production Config
**Severity:** 🔴 Critical  
**File:** `auth-backend/.env` + `home-backend/.env`  

```env
JWT_SECRET=supersecret_access_key
```

**Problem:** This is a trivially guessable secret. Anyone who knows it can forge valid JWTs for any user, bypassing all authentication.

**Recommended Fix:**
```bash
# Generate a proper secret:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# → e.g.: a3f8d2c1b9e7f4a2d5c8b1e6f3a9d2c7b4e1f8a5d2c9b6e3f0a7d4c1b8e5f2a9
```
Use this in both `.env` files and **never commit it to git**.

---

### BUG-007 — verifyToken Returns 500 on Unexpected JWT Errors
**Severity:** 🟡 Medium  
**File:** `home-backend/middleware/verifyToken.js` — Lines 47–49  

```javascript
return res.status(500).json({
    error: 'Token verification failed.'   // ← 500 for any non-standard JWT error
});
```

**Problem:** Any unexpected `jwt.verify()` error (e.g. malformed token causing a library bug) returns a 500. This should be a 401 — it's a client error, not a server error.

**Recommended Fix:**
```javascript
return res.status(401).json({ error: 'Token verification failed.' });
```

---

### BUG-008 — No Input Length Limits on Text Fields
**Severity:** 🟡 Medium  
**Files:** All controllers accepting `description`, `notes`, `category`, `tags`  

**Problem:** No `maxlength` validation on any text field. A malicious client can send 1MB+ strings in `notes`, causing MongoDB document size issues or slow responses.

**Recommended Fix:** Add model-level validators:
```javascript
notes: { type: String, maxlength: 1000 },
description: { type: String, maxlength: 500 },
category: { type: String, maxlength: 100 }
```

---

### BUG-009 — auth-backend: No Graceful MongoDB Reconnect
**Severity:** 🟡 Medium  
**File:** `auth-backend/server.js` — Lines 58–60  

```javascript
.catch(err => {
  console.error("MongoDB connection error:", err);
  process.exit(1);   // ← immediate crash on ANY connection failure
});
```

**Problem:** A transient Atlas connection blip kills the entire auth service. Nodemon restarts it, but during restart all in-flight requests fail.

**Recommended Fix:** Add Mongoose reconnect options and use `mongoose.connection.on('error', ...)` with retry logic instead of `process.exit`.

---

## 🔴 SECURITY VULNERABILITIES

### SEC-001 — NoSQL Injection via Query Parameters
**Type:** NoSQL Injection  
**Endpoint:** `GET /api/transactions`, `GET /api/budgets`, `GET /api/categories`  
**Proof of Concept:**
```
GET http://localhost:5001/api/transactions?type[$ne]=expense
GET http://localhost:5001/api/transactions?category[$regex]=.*
```
**Impact:** Returns all records regardless of filter — potential data exfiltration across categories.  
**Fix:** Sanitize query params with `express-mongo-sanitize` or manual type checking.

```bash
npm install express-mongo-sanitize
```
```javascript
// In server.js, after body-parser:
const mongoSanitize = require('express-mongo-sanitize');
app.use(mongoSanitize());
```

---

### SEC-002 — Mass Assignment on Transaction Update
**Type:** Mass Assignment / Object Injection  
**Endpoint:** `PUT /api/transactions/:id`  
**Proof of Concept:**
```json
PUT /api/transactions/:id
Authorization: Bearer <valid_token>
{ "userId": "victim_user_id", "_id": "new_id", "createdAt": "2000-01-01" }
```
**Impact:** Attacker can reassign their transactions to other users, corrupt timestamps.  
**Fix:** Allowlist only permitted update fields (see BUG-001 fix).

---

### SEC-003 — Weak JWT Secret (Credential Issue)
**Type:** Broken Authentication  
**Endpoints:** All authenticated endpoints  
**Impact:** Anyone who discovers `supersecret_access_key` can forge tokens for any userId, gaining full access to any account.  
**Fix:** Rotate secret immediately with a 256-bit random value (see BUG-006 fix).

---

### SEC-004 — Sensitive Credentials Committed to Codebase
**Type:** Secrets Exposure  
**Files:** `auth-backend/.env`, `home-backend/.env`, `grad_project_ai/.env`  

Exposed credentials found:
- Gmail app password: `uqou ipnj fwbk qhai`
- Twilio Account SID + Auth Token
- MongoDB Atlas connection string with credentials
- Azure OpenAI API Key
- Azure Speech Key
- Firebase service account JSON (in project root)

**Impact:** If repo is ever made public or shared, all services are compromised.  
**Fix:**
1. Add `.env` and `*.json` to `.gitignore` immediately
2. Rotate all credentials (Gmail, Twilio, Azure, MongoDB user password)
3. Use environment variable injection (GitHub Secrets, Azure Key Vault, or VPS-level env)

---

### SEC-005 — Firebase Service Account JSON in Project Root
**Type:** Sensitive File Exposure  
**File:** `hasibha-notificatio-firebase-adminsdk-fbsvc-ac5586ab12.json`  
**Impact:** If the file is accessible via any static file serving or leaked via git, an attacker can send push notifications to all users impersonating the server.  
**Fix:**
```bash
# Move outside project directory:
mv hasibha-notificatio-*.json ~/secrets/firebase-key.json
# Update .env:
FIREBASE_SERVICE_ACCOUNT_PATH=/home/user/secrets/firebase-key.json
# Add to .gitignore:
echo "*.json" >> .gitignore  # or specifically the filename
```

---

### SEC-006 — No Rate Limiting on Home Backend Endpoints
**Type:** Missing Rate Limit  
**Endpoints:** All `POST /api/transactions`, `POST /api/budgets`, etc.  
**Impact:** An attacker can flood the system with thousands of transactions, exhausting MongoDB storage and causing DoS.  
**Fix:** Apply `express-rate-limit` to home-backend routes:
```javascript
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({ windowMs: 15*60*1000, max: 100 });
app.use('/api/', limiter);
```

---

## 🟡 WARNINGS / BEST PRACTICE ISSUES

| # | Warning | File | Detail |
|---|---|---|---|
| 1 | Duplicate Mongoose index | auth-backend startup | `[MONGOOSE] Duplicate schema index on {"deviceId":1}` — index declared twice |
| 2 | Deprecated `punycode` module | home-backend startup | `[DEP0040]` — update dependency using it |
| 3 | Hardcoded currency in FCM | `transactionController.js:62` | `notifyLargeExpense(..., 'EGP', ...)` — currency hardcoded, should use user's profile currency |
| 4 | AI Agent URL hardcoded | `home-backend/.env` | `AI_AGENT_URL=http://localhost:8000` — fails on VPS if AI is on separate host |
| 5 | CORS too narrow | `home-backend/server.js:19` | Only allows one origin — frontend may have multiple environments (dev/staging/prod) |
| 6 | `console.log` in production | `home-backend/server.js:43` | Mix of `console.log` and `logger.info` — should use only logger in production |
| 7 | `notes` field unlimited | Transaction model | No maxlength — allows 100k+ character inputs |
| 8 | No pagination on devices list | `notificationController.js:77` | `UserDevice.find({ userId })` — no limit; user with 1000 devices would return all |
| 9 | `FRONTEND_URL` still localhost | `home-backend/.env:20` | CORS will block real frontend on VPS if not updated |
| 10 | Auth-backend has no health route | `auth-backend/server.js` | No `/health` endpoint — Nginx/PM2 cannot health-check it |

---

## 📊 SUMMARY

| Metric | Value |
|---|---|
| **Total Issues Found** | **16** |
| **🔴 Critical** | 2 (Weak JWT Secret, NoSQL Injection) |
| **🔴 High** | 2 (Mass Assignment, Secrets Exposure) |
| **🟡 Medium** | 6 (Missing ObjectId validation, Balance float, etc.) |
| **🟡 Warnings** | 10 (Best practice issues) |
| **✅ Correct Security Patterns** | 20 (IDOR protection, token expiry, scope isolation) |

---

## 🏆 Priority Fix Order

| Priority | Fix | Effort |
|---|---|---|
| 🔴 **P1** | Rotate `JWT_SECRET` to 32-byte random value | 2 min |
| 🔴 **P1** | Add `express-mongo-sanitize` to both backends | 5 min |
| 🔴 **P2** | Allowlist fields in `PUT /api/transactions/:id` | 10 min |
| 🔴 **P2** | Move `.env` files and Firebase JSON out of git | 10 min |
| 🟡 **P3** | Add `mongoose.Types.ObjectId.isValid()` check to all controllers | 20 min |
| 🟡 **P3** | Add `maxlength` to all text fields in Mongoose models | 15 min |
| 🟡 **P3** | Fix `verifyToken` 500 → 401 on line 47 | 1 min |
| 🟡 **P4** | Add `alertSent` flag to budgets to prevent notification spam | 30 min |
| 🟡 **P4** | Add `express-rate-limit` to home-backend | 10 min |
| 🟢 **P5** | Fix floating point in balance updates | 5 min |
| 🟢 **P5** | Add `/health` route to auth-backend | 5 min |

---

## 🚀 To Run Live Tests

Once Atlas IP is whitelisted:

```bash
# Terminal 1
cd auth-backend && npm run dev

# Terminal 2
cd home-backend && npm run dev

# Terminal 3 (test runner)
cd ..
node test_phase1.js   # Auth backend tests
node test_phase2.js   # Home backend + security tests
```

---

*Report generated: May 19, 2026 | Hasibha Graduation Project Security Audit*
