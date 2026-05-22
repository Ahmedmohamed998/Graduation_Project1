# 🛠️ Hasibha Backend — Required Security & Bug Fixes

> **Senior Backend QA + Security Auditor.**
> **Date:** May 19, 2026
> **Project:** Hasibha — auth-backend (3210) · home-backend (5001)

---

## ⛔ ABSOLUTE CONSTRAINT — DO NOT TOUCH API ROUTES

**You must NOT change any API route path under any circumstances.**
Every route must remain exactly as-is:

```
POST /api/auth/login                    ← DO NOT CHANGE
GET  /api/transactions                  ← DO NOT CHANGE
PUT  /api/transactions/:id              ← DO NOT CHANGE
DELETE /api/security/devices/:deviceId  ← DO NOT CHANGE
```

All fixes below are **internal logic changes only** — no route paths, no HTTP methods, no URL patterns are to be modified. The frontend must require zero changes after applying these fixes.

---

## FIX-001 — Rotate JWT Secret (Critical)

**Files:** `auth-backend/.env` · `home-backend/.env`

Run this command to generate a secure secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Replace in **both** `.env` files:

```env
# BEFORE:
JWT_SECRET=supersecret_access_key

# AFTER (use the generated value):
JWT_SECRET=<generated_64_char_hex_string>
```

> ⚠️ Both files must use the **exact same** JWT_SECRET value, otherwise tokens issued by auth-backend will be rejected by home-backend.

---

## FIX-002 — Add NoSQL Injection Protection (Critical)

**Target:** `home-backend`

### Step 1 — Install package

```bash
cd home-backend
npm install express-mongo-sanitize
```

### Step 2 — Register middleware in `home-backend/server.js`

Add **after** `app.use(express.json())` and **before** any route registration:

```javascript
const mongoSanitize = require("express-mongo-sanitize");
app.use(mongoSanitize());
```

Do **not** move or rename any existing route declarations.

---

## FIX-003 — Fix Mass Assignment on Transaction Update (High)

**File:** `home-backend/controllers/transactionController.js`

Find the `PUT /api/transactions/:id` handler. Locate the line that does:

```javascript
Object.assign(transaction, updates);
```

Replace **only that block** with:

```javascript
const allowed = [
  "type",
  "amount",
  "category",
  "categoryGroup",
  "description",
  "date",
  "paymentMethod",
  "tags",
  "notes",
];
const safeUpdates = {};
allowed.forEach((k) => {
  if (updates[k] !== undefined) safeUpdates[k] = updates[k];
});
Object.assign(transaction, safeUpdates);
```

> Do NOT change the route path `PUT /api/transactions/:id` or the function signature.

---

## FIX-004 — Add ObjectId Validation to All Controllers (Medium)

**Files:** All controllers in `home-backend/controllers/` that use an `:id` param.

At the **top of each controller function** that reads `req.params.id`, add this check before any database call:

```javascript
const mongoose = require("mongoose");
const { id } = req.params;

if (!mongoose.Types.ObjectId.isValid(id)) {
  return res.status(400).json({ error: "Invalid ID format" });
}
```

Apply to these controllers:

- `transactionController.js` — GET single, PUT, DELETE handlers
- `budgetController.js` — GET single, PUT, DELETE handlers
- `savingsController.js` — GET single, PUT, DELETE, contribute handlers
- `debtController.js` — GET single, PUT, DELETE handlers
- `categoryController.js` — PUT, DELETE handlers

> Do NOT change any route paths. Add the check inside the existing function body only.

---

## FIX-005 — Fix verifyToken Returning 500 Instead of 401 (Medium)

**File:** `home-backend/middleware/verifyToken.js`

Find the catch block that returns status `500`:

```javascript
return res.status(500).json({
  error: "Token verification failed.",
});
```

Change **only the status code**:

```javascript
return res.status(401).json({
  error: "Token verification failed.",
});
```

> One number change only. Do not touch anything else in this file.

---

## FIX-006 — Fix Floating Point on Balance Updates (Medium)

**File:** `home-backend/controllers/transactionController.js`

Find all lines that add or subtract from `account.totalBalance`:

```javascript
account.totalBalance += amount;
account.totalBalance -= amount;
```

Wrap each one with `roundToTwo()` (the function already exists in the file):

```javascript
account.totalBalance = roundToTwo(account.totalBalance + amount);
account.totalBalance = roundToTwo(account.totalBalance - amount);
```

Apply this fix everywhere `totalBalance` is modified in the file (creation, update, delete handlers).

---

## FIX-007 — Prevent Budget Notification Spam (Medium)

**Step 1 — Update Budget Model**

**File:** `home-backend/models/Budget.js`

Add two new boolean fields to the schema:

```javascript
alertSent:    { type: Boolean, default: false },
exceededSent: { type: Boolean, default: false }
```

**Step 2 — Update notification logic**

**File:** `home-backend/controllers/transactionController.js`

Find the budget notification block:

```javascript
if (percentUsed >= 100) {
    notifyBudgetExceeded(...);
} else if (percentUsed >= threshold) {
    notifyBudgetAlert(...);
}
```

Replace with:

```javascript
if (percentUsed >= 100 && !budget.exceededSent) {
    notifyBudgetExceeded(...);
    budget.exceededSent = true;
    budget.alertSent = true;
    await budget.save();
} else if (percentUsed >= threshold && !budget.alertSent) {
    notifyBudgetAlert(...);
    budget.alertSent = true;
    await budget.save();
}
```

**Step 3 — Reset flags on new month**

In the same controller, wherever a budget's monthly spending is reset (start of new period), add:

```javascript
budget.alertSent = false;
budget.exceededSent = false;
```

> Do NOT change any budget route paths.

---

## FIX-008 — Add Rate Limiting to Home Backend (Medium)

**Target:** `home-backend`

### Step 1 — Install package

```bash
cd home-backend
npm install express-rate-limit
```

### Step 2 — Add to `home-backend/server.js`

Add **after** the mongoSanitize middleware (from FIX-002) and **before** route registration:

```javascript
const rateLimit = require("express-rate-limit");
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // max 200 requests per IP per window
  message: { error: "Too many requests, please try again later." },
});
app.use("/api/", limiter);
```

> Do NOT change any route paths or existing route declarations.

---

## FIX-009 — Add maxlength Validators to Mongoose Models (Medium)

**Files:** `home-backend/models/Transaction.js` · and any other model with free-text fields.

In the Transaction schema, update the following fields:

```javascript
// BEFORE:
description: { type: String },
notes:       { type: String },
category:    { type: String },
tags:        [String]

// AFTER:
description: { type: String, maxlength: 500 },
notes:       { type: String, maxlength: 1000 },
category:    { type: String, maxlength: 100 },
tags:        { type: [String], validate: v => v.length <= 20 }
```

Apply the same pattern to any other model that has unconstrained `String` fields accepting user input.

---

## FIX-010 — Add .gitignore Entries (High)

**File:** `.gitignore` in project root (create if it doesn't exist)

Add these lines:

```
# Environment files
auth-backend/.env
home-backend/.env
grad_project_ai/.env
*.env

# Firebase service account
*.json
hasibha-notificatio-*.json
```

Then remove the sensitive files from Git tracking (without deleting them from disk):

```bash
git rm --cached auth-backend/.env
git rm --cached home-backend/.env
git rm --cached "hasibha-notificatio-firebase-adminsdk-fbsvc-ac5586ab12.json"
git commit -m "chore: remove sensitive files from git tracking"
```

> ⚠️ After this, rotate all credentials — Gmail password, Twilio tokens, Azure keys, and MongoDB Atlas user password — because they are already in Git history.

---

## FIX-011 — Add /health Route to Auth Backend (Low)

**File:** `auth-backend/server.js`

Add this route **before** any other route registration, after middleware setup:

```javascript
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "auth-backend" });
});
```

> This adds a new route but changes nothing about existing routes.

---

## FIX-012 — Fix Duplicate Mongoose Index Warning (Low)

**File:** `auth-backend/models/Device.js` (or whichever model has the deviceId index)

Find the duplicate index declaration. It will look like one of these patterns appearing twice:

```javascript
deviceId: { type: String, index: true }   // ← defined inline on field
// AND also:
DeviceSchema.index({ deviceId: 1 });       // ← defined again explicitly
```

Remove **one** of the two declarations. Keep whichever one is more explicit (the `schema.index()` call).

---

## ✅ Verification Checklist

After applying all fixes, confirm:

- [ ] Both servers start without crashing
- [ ] `GET /api/transactions?type[$ne]=expense` returns 400 or ignores the operator (not all records)
- [ ] `PUT /api/transactions/:id` with `{ "userId": "other_id" }` in body does NOT change the userId
- [ ] `GET /api/transactions/INVALID_ID` returns 400, not 500
- [ ] Malformed JWT returns 401, not 500
- [ ] Budget notification fires only once when threshold is crossed, not on every subsequent transaction
- [ ] All existing API routes respond exactly as before — same paths, same response shapes

---

## 🚫 Summary of What Must NOT Change

- No route path may be renamed or restructured
- No HTTP method may be changed (POST stays POST, GET stays GET, etc.)
- No response field names may be renamed
- No request body field names may be renamed
- The frontend requires zero changes after all fixes are applied

---

_Generated: May 19, 2026 | Hasibha Graduation Project — Backend Security Fixes_
