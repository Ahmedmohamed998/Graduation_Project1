# 📡 Hasibha — Complete API Reference

> **For the frontend team.** Every single endpoint, fully documented with separate examples.
> Last Updated: **May 2, 2026** | Version: **3.0.0** | Total Endpoints: **81**

---

## ⚡ How to Run the Project

> Open **3 separate terminals** and run each service:

| Terminal | Folder | Command | Port |
|---|---|---|---|
| **Terminal 1** | `auth-backend/` | `npm run dev` | **3210** |
| **Terminal 2** | `home-backend/` | `npm run dev` | **5001** |
| **Terminal 3** | `grad_project_ai/` | *(see below)* | **8000** |

```bash
# Terminal 1 — Auth Backend
cd auth-backend
npm run dev

# Terminal 2 — Home Backend
cd home-backend
npm run dev

# Terminal 3 — AI Agent (Python)
cd grad_project_ai
python -m venv venv                        # first time only
venv\Scripts\activate                      # Windows
# source venv/bin/activate                 # Mac/Linux
pip install -r requirements.txt            # first time only
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

> ✅ **Confirm all 3 are running:**
> - Auth: `http://localhost:3210` → `{ "message": "Auth API is running!" }`
> - Home: `http://localhost:5001/health` → `{ "status": "ok" }`
> - AI: `http://localhost:8000/docs` → FastAPI Swagger UI

---

## 🌐 Base URLs

| Service | URL | Description |
|---|---|---|
| **Auth Backend** | `http://localhost:3210` | Authentication, security, devices |
| **Home Backend** | `http://localhost:5001` | All financial data + AI + Notifications |
| **AI Agent** *(internal)* | `http://localhost:8000` | Do NOT call directly — proxied through home-backend |

---

## 🔐 Authentication

All home-backend endpoints require a JWT token in the header:
```
Authorization: Bearer <accessToken>
```
You receive `accessToken` from login or signup.

---

## 📋 Table of Contents

### Auth Backend (`localhost:3210`)
1. [SMS Verification](#1-sms-verification)
2. [Signup with Email](#2-signup-with-email)
3. [Signup with Phone](#3-signup-with-phone)
4. [Login](#4-login)
5. [Google Sign-In](#5-google-sign-in)
6. [Forgot Password](#6-forgot-password)
7. [Reset Password](#7-reset-password)
8. [Refresh Token](#8-refresh-token)
9. [Logout](#9-logout)
10. [Check Auth Status](#10-check-auth-status)
11. [Change Password](#11-change-password)
12. [Two-Factor Authentication (2FA)](#12-two-factor-authentication)
13. [Device Management](#13-device-management)

### Home Backend (`localhost:5001`)
14. [Dashboard](#14-dashboard)
15. [Profile](#15-profile)
16. [Transactions — Add Expense](#16-transactions--add-expense)
17. [Transactions — Add Income](#17-transactions--add-income)
18. [Transactions — Get / Update / Delete](#18-transactions--get--update--delete)
19. [Budgets](#19-budgets)
20. [Savings Goals](#20-savings-goals)
21. [Debts](#21-debts)
22. [Analytics](#22-analytics)
23. [Offers](#23-offers)
24. [Settings](#24-settings)
25. [Help & Support](#25-help--support)
26. [Categories](#26-categories)
27. [Push Notifications (FCM)](#27-push-notifications-fcm)
28. [AI — Financial Advisor Chat](#28-ai--financial-advisor-chat)
29. [AI — Transaction Auto-Categorizer](#29-ai--transaction-auto-categorizer)
30. [AI — Voice Processing](#30-ai--voice-processing)
31. [AI — OCR Receipt Scanner](#31-ai--ocr-receipt-scanner)

---

# 🔐 Auth Backend

---

## 1. SMS Verification

### Send SMS Code

**Endpoint:** `POST http://localhost:3210/api/auth/sms/send`

**Request Body:**
```json
{
  "phone": "+201234567890"
}
```

**Success Response `200`:**
```json
{
  "success": true,
  "message": "Code sent"
}
```

**Rate limit `429`:**
```json
{
  "success": false,
  "message": "Wait before requesting another code",
  "seconds_left": 45
}
```

---

### Verify SMS Code

**Endpoint:** `POST http://localhost:3210/api/auth/sms/verify`

**Request Body:**
```json
{
  "phone": "+201234567890",
  "code": "123456"
}
```

**Success Response `200`:**
```json
{
  "success": true,
  "message": "Phone verified",
  "phoneVerificationToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

> ⚠️ Save `phoneVerificationToken` — required for phone-based signup.

**Error `400`:** `{ "success": false, "message": "Invalid or expired code" }`

---

## 2. Signup with Email

**Endpoint:** `POST http://localhost:3210/api/auth/signup`

**Request Body:**
```json
{
  "username": "Mohamed Yaser",
  "email": "user@example.com",
  "password": "Test123456",
  "confirmPassword": "Test123456",
  "phone": "+201234567890"
}
```

| Field | Required | Notes |
|---|---|---|
| `username` | ✅ | Display name |
| `email` | ✅ | Must be unique |
| `password` | ✅ | Min 6 characters |
| `confirmPassword` | ✅ | Must match `password` |
| `phone` | No | Optional |

**Success Response `201`:**
```json
{
  "success": true,
  "message": "Account created successfully.",
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": "67933def456789abc123",
    "username": "Mohamed Yaser",
    "email": "user@example.com",
    "phone": "+201234567890"
  }
}
```

**Errors:**
```json
{ "success": false, "message": "Username, email, and passwords are required." }
{ "success": false, "message": "Passwords do not match." }
{ "success": false, "message": "Password must be at least 6 characters." }
{ "success": false, "message": "Email already registered." }
```

---

## 3. Signup with Phone

**Endpoint:** `POST http://localhost:3210/api/auth/signup-phone`

**Request Body:**
```json
{
  "username": "Mohamed Yaser",
  "phone": "+201234567890",
  "email": "user@example.com",
  "password": "Test123456",
  "confirmPassword": "Test123456",
  "phoneVerificationToken": "<token from SMS verify>"
}
```

| Field | Required | Notes |
|---|---|---|
| `username` | ✅ | — |
| `phone` | ✅ | Must be unique |
| `password` | ✅ | Min 6 characters |
| `confirmPassword` | ✅ | Must match |
| `phoneVerificationToken` | ✅ | From `/api/auth/sms/verify` |
| `email` | No | Optional |

**Success Response `201`** — same shape as email signup.

---

## 4. Login

**Endpoint:** `POST http://localhost:3210/api/auth/login`

**All three formats are accepted:**

Login with email:
```json
{ "email": "user@example.com", "password": "Test123456" }
```

Login with phone:
```json
{ "phone": "+201234567890", "password": "Test123456" }
```

Login with identifier (accepts either):
```json
{ "identifier": "user@example.com", "password": "Test123456" }
```

**Success Response `200`:**
```json
{
  "success": true,
  "message": "Login successful.",
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": "67933def456789abc123",
    "username": "Mohamed Yaser",
    "email": "user@example.com",
    "phone": "+201234567890"
  }
}
```

> ⚠️ Store `accessToken` (short-lived) and `refreshToken` (30 days) securely.

**Errors:**
```json
{ "success": false, "message": "User not found." }
{ "success": false, "message": "Incorrect password." }
{ "success": false, "message": "Provide email, phone, or identifier." }
```

---

## 5. Google Sign-In

**Endpoint:** `POST http://localhost:3210/api/auth/google-signin`

**Request Body:**
```json
{
  "idToken": "<Google ID token from Google Sign-In SDK>"
}
```

**Success Response `200`:**
```json
{
  "success": true,
  "message": "Google authentication successful.",
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": "67933def456789abc123",
    "email": "user@gmail.com",
    "username": "Mohamed Yaser",
    "phone": ""
  }
}
```
> Creates a new account automatically if user doesn't exist yet.

---

## 6. Forgot Password

**Endpoint:** `POST http://localhost:3210/api/auth/forgot-password`

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Success Response `200`:**
```json
{
  "success": true,
  "message": "If the email exists, a reset code has been sent."
}
```
> A 6-digit code is sent to the email. Rate limited to **5 attempts per hour**.

---

## 7. Reset Password

**Endpoint:** `POST http://localhost:3210/api/auth/reset-password`

**Request Body:**
```json
{
  "email": "user@example.com",
  "code": "123456",
  "newPassword": "NewPass789"
}
```

**Success Response `200`:**
```json
{
  "success": true,
  "message": "Password reset successful."
}
```

**Errors:**
```json
{ "success": false, "message": "Invalid code." }
{ "success": false, "message": "Code expired." }
{ "success": false, "message": "Password must be at least 6 characters." }
```

---

## 8. Refresh Token

**Endpoint:** `POST http://localhost:3210/api/auth/refresh-token`

**Request Body:**
```json
{
  "refreshToken": "eyJ..."
}
```

**Success Response `200`:**
```json
{
  "success": true,
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```
> Old refresh token is revoked. Save the new one.

---

## 9. Logout

**Endpoint:** `POST http://localhost:3210/api/auth/logout`

**Request Body:**
```json
{
  "refreshToken": "eyJ..."
}
```

**Success Response `200`:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 10. Check Auth Status

**Endpoint:** `GET http://localhost:3210/api/auth/me`

**Headers:** `Authorization: Bearer <accessToken>`

**Success Response `200`:**
```json
{
  "success": true,
  "user": {
    "id": "67933def456789abc123",
    "email": "user@example.com",
    "username": "Mohamed Yaser",
    "phone": "+201234567890"
  }
}
```

---

## 11. Change Password

**Endpoint:** `POST http://localhost:3210/api/security/change-password`

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body:**
```json
{
  "currentPassword": "Test123456",
  "newPassword": "NewSecure789"
}
```

**Success Response `200`:**
```json
{
  "message": "Password changed successfully"
}
```

**Errors:**
```json
{ "error": "Current password is incorrect" }
{ "error": "New password must be at least 6 characters long" }
```

---

## 12. Two-Factor Authentication

### Setup 2FA

**Endpoint:** `POST http://localhost:3210/api/security/2fa/setup`

**Headers:** `Authorization: Bearer <accessToken>`

**Success Response `200`:**
```json
{
  "message": "2FA setup initiated. Scan QR code and verify to enable.",
  "qrCode": "data:image/png;base64,...",
  "secret": "JBSWY3DPEHPK3PXP",
  "backupCodes": ["A1B2C3D4", "E5F6G7H8", "I9J0K1L2", "M3N4O5P6"]
}
```
> Display `qrCode` as an `<img>` for the user to scan with Google Authenticator.

---

### Verify & Enable 2FA

**Endpoint:** `POST http://localhost:3210/api/security/2fa/verify`

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body:**
```json
{
  "token": "123456"
}
```

**Success Response `200`:**
```json
{
  "message": "2FA enabled successfully",
  "backupCodes": ["A1B2C3D4", "E5F6G7H8", "I9J0K1L2", "M3N4O5P6"]
}
```

---

### Get 2FA Status

**Endpoint:** `GET http://localhost:3210/api/security/2fa/status`

**Headers:** `Authorization: Bearer <accessToken>`

**Success Response `200`:**
```json
{
  "enabled": true,
  "method": "totp",
  "verifiedAt": "2026-04-07T00:00:00.000Z"
}
```

---

### Disable 2FA

**Endpoint:** `POST http://localhost:3210/api/security/2fa/disable`

**Headers:** `Authorization: Bearer <accessToken>`

**Request Body:**
```json
{
  "password": "Test123456",
  "token": "123456"
}
```

**Success Response `200`:**
```json
{
  "message": "2FA disabled successfully"
}
```

---

## 13. Device Management

### List Trusted Devices

**Endpoint:** `GET http://localhost:3210/api/security/devices`

**Headers:** `Authorization: Bearer <accessToken>`

**Success Response `200`:**
```json
{
  "devices": [
    {
      "_id": "67938abc123def456789",
      "deviceId": "device_abc123",
      "deviceName": "iPhone 14",
      "deviceType": "mobile",
      "platform": "iOS",
      "ipAddress": "192.168.1.100",
      "lastActive": "2026-04-07T00:00:00.000Z",
      "isTrusted": true
    }
  ],
  "total": 1
}
```

---

### Trust a Device

**Endpoint:** `PUT http://localhost:3210/api/security/devices/:deviceId/trust`

**Headers:** `Authorization: Bearer <accessToken>`

**Success Response `200`:**
```json
{
  "message": "Device trusted successfully"
}
```

---

### Remove a Device

**Endpoint:** `DELETE http://localhost:3210/api/security/devices/:deviceId`

**Headers:** `Authorization: Bearer <accessToken>`

**Success Response `200`:**
```json
{
  "message": "Device removed successfully"
}
```

---
---

# 🏠 Home Backend Endpoints

> **All endpoints below require:**
> ```
> Authorization: Bearer <accessToken>
> ```

---

## 14. Dashboard

**Endpoint:** `GET http://localhost:5001/api/dashboard`

**Success Response `200`:**
```json
{
  "user": {
    "name": "Mohamed Yaser",
    "photo": "https://example.com/photo.jpg",
    "currency": "EGP"
  },
  "balance": {
    "total": 7499.5,
    "income": 8500,
    "expense": 1000.5,
    "period": "This Month"
  },
  "quickActions": [
    { "id": "add_expense",   "label": "Add Expense",   "enabled": true },
    { "id": "create_budget", "label": "Create Budget", "enabled": true },
    { "id": "savings_goal",  "label": "Savings Goal",  "enabled": true },
    { "id": "analytics",     "label": "Analytics",     "enabled": true },
    { "id": "debt_tracking", "label": "Debt Tracking", "enabled": true },
    { "id": "ai_chat",       "label": "AI Chat",       "enabled": true },
    { "id": "offers",        "label": "Offers",        "enabled": true }
  ]
}
```

---

## 15. Profile

### Get Profile

**Endpoint:** `GET http://localhost:5001/api/profile`

**Success Response `200`:**
```json
{
  "_id": "67934abc123def456789",
  "userId": "67933def456789abc123",
  "displayName": "Mohamed Yaser",
  "profilePhoto": "https://example.com/photo.jpg",
  "currency": "EGP",
  "createdAt": "2026-04-07T04:30:00.000Z"
}
```

---

### Update Profile

**Endpoint:** `PUT http://localhost:5001/api/profile`

**Request Body:**
```json
{
  "displayName": "Mohamed Yaser",
  "profilePhoto": "https://example.com/photo.jpg",
  "currency": "EGP"
}
```

| Field | Options |
|---|---|
| `currency` | `USD`, `EUR`, `GBP`, `EGP`, `SAR`, `AED`, `JPY`, `AUD`, `CAD`, `CHF` |

**Success Response `200`:**
```json
{
  "message": "Profile updated successfully",
  "profile": {
    "displayName": "Mohamed Yaser",
    "currency": "EGP"
  }
}
```

---

## 16. Transactions — Add Expense

> Record any money going **out**. Category can be free text, but we recommend using values from the Categories endpoint (section 26) or the AI Auto-Categorizer (section 29).

**Endpoint:** `POST http://localhost:5001/api/transactions`

**Request Body — Expense Example:**
```json
{
  "type": "expense",
  "amount": 150.50,
  "category": "Groceries",
  "categoryGroup": "Food & Dining",
  "description": "Weekly grocery shopping",
  "date": "2026-05-02",
  "paymentMethod": "cash",
  "tags": ["groceries", "weekly"],
  "notes": "Bought from Carrefour"
}
```

| Field | Required | Type | Notes |
|---|---|---|---|
| `type` | ✅ | `string` | Must be `"expense"` |
| `amount` | ✅ | `number` | Must be > 0 |
| `category` | ✅ | `string` | **Free text** — subcategory name (e.g. `"Groceries"`, `"Uber/Taxi"`, `"Netflix"`) |
| `categoryGroup` | No | `string` | Parent group (e.g. `"Food & Dining"`, `"Transportation"`) — used for analytics |
| `description` | No | `string` | Short description |
| `date` | No | `string` | ISO date string, defaults to today |
| `paymentMethod` | No | `string` | `cash`, `credit_card`, `debit_card`, `bank_transfer`, `mobile_wallet`, `other` (default: `cash`) |
| `tags` | No | `array` | Array of strings |
| `notes` | No | `string` | Additional notes |

> 💡 **Tip:** Call `POST /api/ai/categorize` first with a text description to auto-fill `category` and `categoryGroup`.

**Success Response `201`:**
```json
{
  "message": "Transaction created successfully",
  "transaction": {
    "_id": "67935abc123def456789",
    "userId": "67933def456789abc123",
    "type": "expense",
    "amount": 150.5,
    "category": "Groceries",
    "categoryGroup": "Food & Dining",
    "description": "Weekly grocery shopping",
    "date": "2026-05-02T00:00:00.000Z",
    "paymentMethod": "cash",
    "tags": ["groceries", "weekly"],
    "notes": "Bought from Carrefour",
    "createdAt": "2026-05-02T04:45:00.000Z"
  },
  "newBalance": 7349.5
}
```

> ⚠️ **Side effects for expenses:**
> - Balance is **decreased** by the amount.
> - If amount ≥ 500 → a **💸 Large Expense** push notification is sent to the user's devices.
> - If the expense category matches an active budget → the budget threshold is checked and a **⚠️ Budget Alert** or **🚨 Budget Exceeded** push notification may be triggered.

**Errors:**
```json
{ "error": "Type, amount, and category are required" }
{ "error": "Type must be either income or expense" }
{ "error": "Amount must be greater than 0" }
```

---

## 17. Transactions — Add Income

> Record any money coming **in**. Same endpoint as expense, different `type`.

**Endpoint:** `POST http://localhost:5001/api/transactions`

**Request Body — Income Example:**
```json
{
  "type": "income",
  "amount": 12000,
  "category": "Salary / Wages",
  "description": "May 2026 salary",
  "date": "2026-05-01",
  "paymentMethod": "bank_transfer",
  "tags": ["salary", "monthly"],
  "notes": "Company payroll deposit"
}
```

| Field | Required | Type | Notes |
|---|---|---|---|
| `type` | ✅ | `string` | Must be `"income"` |
| `amount` | ✅ | `number` | Must be > 0 |
| `category` | ✅ | `string` | **Free text** — income category (e.g. `"Salary / Wages"`, `"Freelance"`, `"Dividends"`) |
| `categoryGroup` | No | `string` | Not commonly used for income, but supported |
| `description` | No | `string` | Short description |
| `date` | No | `string` | ISO date, defaults to today |
| `paymentMethod` | No | `string` | `cash`, `credit_card`, `debit_card`, `bank_transfer`, `mobile_wallet`, `other` |
| `tags` | No | `array` | Array of strings |
| `notes` | No | `string` | Additional notes |

**Success Response `201`:**
```json
{
  "message": "Transaction created successfully",
  "transaction": {
    "_id": "67935bcd234def567890",
    "userId": "67933def456789abc123",
    "type": "income",
    "amount": 12000,
    "category": "Salary / Wages",
    "description": "May 2026 salary",
    "date": "2026-05-01T00:00:00.000Z",
    "paymentMethod": "bank_transfer",
    "tags": ["salary", "monthly"],
    "notes": "Company payroll deposit",
    "createdAt": "2026-05-01T09:00:00.000Z"
  },
  "newBalance": 19349.5
}
```

> ✅ Balance is **increased** by the amount. No push notifications are triggered for income.

**Errors:** Same as expense above.

---

## 18. Transactions — Get / Update / Delete

### Get All Transactions

**Endpoint:** `GET http://localhost:5001/api/transactions`

**Query Parameters:**

| Param | Type | Example | Description |
|---|---|---|---|
| `type` | string | `?type=expense` | Filter by `income` or `expense` |
| `category` | string | `?category=Groceries` | Filter by category name |
| `startDate` | string | `?startDate=2026-05-01` | From date (inclusive) |
| `endDate` | string | `?endDate=2026-05-31` | To date (inclusive) |
| `limit` | number | `?limit=20` | Per page (default 50) |
| `page` | number | `?page=1` | Page number |

**Example — Get only expenses for May 2026:**
```
GET http://localhost:5001/api/transactions?type=expense&startDate=2026-05-01&endDate=2026-05-31&limit=20&page=1
```

**Success Response `200`:**
```json
{
  "transactions": [
    {
      "_id": "67935abc123def456789",
      "type": "expense",
      "amount": 150.5,
      "category": "Groceries",
      "categoryGroup": "Food & Dining",
      "description": "Weekly grocery shopping",
      "date": "2026-05-02T00:00:00.000Z",
      "paymentMethod": "cash",
      "tags": ["groceries", "weekly"],
      "notes": "Bought from Carrefour",
      "createdAt": "2026-05-02T04:45:00.000Z"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "pages": 1
  }
}
```

---

### Get Single Transaction

**Endpoint:** `GET http://localhost:5001/api/transactions/:id`

**Example:** `GET http://localhost:5001/api/transactions/67935abc123def456789`

**Success Response `200`:** Full transaction object (same shape as above).

**Error `404`:** `{ "error": "Transaction not found" }`

---

### Update Transaction

**Endpoint:** `PUT http://localhost:5001/api/transactions/:id`

**Example:** `PUT http://localhost:5001/api/transactions/67935abc123def456789`

**Request Body** *(send only fields to update):*
```json
{
  "amount": 175.00,
  "description": "Updated grocery shopping",
  "category": "Restaurants/Dining Out",
  "categoryGroup": "Food & Dining"
}
```

**Success Response `200`:**
```json
{
  "message": "Transaction updated successfully",
  "transaction": {
    "_id": "67935abc123def456789",
    "type": "expense",
    "amount": 175.0,
    "category": "Restaurants/Dining Out",
    "categoryGroup": "Food & Dining",
    "description": "Updated grocery shopping",
    "date": "2026-05-02T00:00:00.000Z",
    "paymentMethod": "cash"
  }
}
```

> ⚠️ Balance auto-recalculates when `amount` or `type` changes.

**Error `404`:** `{ "error": "Transaction not found" }`

---

### Delete Transaction

**Endpoint:** `DELETE http://localhost:5001/api/transactions/:id`

**Example:** `DELETE http://localhost:5001/api/transactions/67935abc123def456789`

**Success Response `200`:**
```json
{
  "message": "Transaction deleted successfully"
}
```

> ⚠️ Balance auto-recalculates (reversed).

**Error `404`:** `{ "error": "Transaction not found" }`

---

## 19. Budgets

### Create Budget

**Endpoint:** `POST http://localhost:5001/api/budgets`

**Request Body:**
```json
{
  "name": "Monthly Food Budget",
  "category": "Food & Dining",
  "limitAmount": 2000,
  "period": "monthly",
  "startDate": "2026-05-01",
  "endDate": "2026-05-31",
  "alertThreshold": 80
}
```

| Field | Required | Type | Notes |
|---|---|---|---|
| `name` | ✅ | `string` | Budget label |
| `category` | ✅ | `string` | Matches transaction category or group |
| `limitAmount` | ✅ | `number` | Spending limit (> 0) |
| `period` | No | `string` | `weekly`, `monthly`, `yearly` (default: `monthly`) |
| `startDate` | No | `string` | ISO date (default: today) |
| `endDate` | No | `string` | ISO date (default: 1 month from now) |
| `alertThreshold` | No | `number` | % to trigger alert at (default: `80`, range 0-100) |

**Success Response `201`:**
```json
{
  "message": "Budget created successfully",
  "budget": {
    "_id": "67936abc123def456789",
    "name": "Monthly Food Budget",
    "category": "Food & Dining",
    "limitAmount": 2000,
    "spentAmount": 150.5,
    "remainingAmount": 1849.5,
    "percentageSpent": 7.53,
    "isActive": true,
    "alertThreshold": 80,
    "period": "monthly",
    "startDate": "2026-05-01T00:00:00.000Z",
    "endDate": "2026-05-31T00:00:00.000Z"
  }
}
```

> `spentAmount` is auto-calculated from existing matching transactions!

**Error `400`:** `{ "error": "Name, category, and limit amount are required" }`

---

### Get All Budgets

**Endpoint:** `GET http://localhost:5001/api/budgets`

**Query Parameters:**

| Param | Type | Example |
|---|---|---|
| `isActive` | string | `?isActive=true` |

**Success Response `200`:**
```json
{
  "budgets": [
    {
      "_id": "67936abc123def456789",
      "name": "Monthly Food Budget",
      "category": "Food & Dining",
      "limitAmount": 2000,
      "spentAmount": 150.5,
      "remainingAmount": 1849.5,
      "percentageSpent": 7.53,
      "isActive": true,
      "alertThreshold": 80
    }
  ]
}
```

---

### Get Single Budget

**Endpoint:** `GET http://localhost:5001/api/budgets/:id`

**Success Response `200`:** Full budget object.

**Error `404`:** `{ "error": "Budget not found" }`

---

### Update Budget

**Endpoint:** `PUT http://localhost:5001/api/budgets/:id`

**Request Body** *(send only fields to update):*
```json
{
  "limitAmount": 2500,
  "alertThreshold": 90
}
```

**Success Response `200`:**
```json
{
  "message": "Budget updated successfully",
  "budget": { "..." }
}
```

**Error `404`:** `{ "error": "Budget not found" }`

---

### Delete Budget

**Endpoint:** `DELETE http://localhost:5001/api/budgets/:id`

**Success Response `200`:**
```json
{
  "message": "Budget deleted successfully"
}
```

**Error `404`:** `{ "error": "Budget not found" }`

---

## 20. Savings Goals

### Create Savings Goal

**Endpoint:** `POST http://localhost:5001/api/savings`

**Request Body:**
```json
{
  "name": "Vacation Fund",
  "targetAmount": 15000,
  "deadline": "2026-07-01",
  "icon": "✈️",
  "priority": "high",
  "description": "Summer trip to Europe"
}
```

| Field | Required | Type | Notes |
|---|---|---|---|
| `name` | ✅ | `string` | Goal label |
| `targetAmount` | ✅ | `number` | Must be > 0 |
| `deadline` | No | `string` | ISO date |
| `icon` | No | `string` | Emoji (default: `🎯`) |
| `priority` | No | `string` | `high`, `medium`, `low` (default: `medium`) |
| `description` | No | `string` | Optional notes |

**Success Response `201`:**
```json
{
  "message": "Savings goal created successfully",
  "savingsGoal": {
    "_id": "67937abc123def456789",
    "name": "Vacation Fund",
    "targetAmount": 15000,
    "savedAmount": 0,
    "remainingAmount": 15000,
    "progressPercentage": 0,
    "priority": "high",
    "isCompleted": false,
    "icon": "✈️",
    "deadline": "2026-07-01T00:00:00.000Z"
  }
}
```

**Error `400`:** `{ "error": "Name and target amount are required" }`

---

### Get All Savings Goals

**Endpoint:** `GET http://localhost:5001/api/savings`

**Query Parameters:**

| Param | Type | Example |
|---|---|---|
| `isCompleted` | string | `?isCompleted=false` |

**Success Response `200`:**
```json
{
  "savingsGoals": [
    {
      "_id": "67937abc123def456789",
      "name": "Vacation Fund",
      "targetAmount": 15000,
      "savedAmount": 3000,
      "priority": "high",
      "isCompleted": false
    }
  ]
}
```

---

### Get Single Savings Goal

**Endpoint:** `GET http://localhost:5001/api/savings/:id`

**Success Response `200`:** Full goal object.

**Error `404`:** `{ "error": "Savings goal not found" }`

---

### Update Savings Goal

**Endpoint:** `PUT http://localhost:5001/api/savings/:id`

**Request Body** *(send only fields to update):*
```json
{
  "targetAmount": 18000,
  "deadline": "2026-08-01"
}
```

**Success Response `200`:**
```json
{
  "message": "Savings goal updated successfully",
  "savingsGoal": { "..." }
}
```

**Error `404`:** `{ "error": "Savings goal not found" }`

---

### Contribute to Goal

**Endpoint:** `POST http://localhost:5001/api/savings/:id/contribute`

**Request Body:**
```json
{
  "amount": 1000
}
```

**Success Response `200`:**
```json
{
  "message": "Contribution added successfully",
  "savingsGoal": {
    "_id": "67937abc123def456789",
    "name": "Vacation Fund",
    "savedAmount": 4000,
    "targetAmount": 15000,
    "isCompleted": false
  }
}
```

> ⚠️ **Side effects:**
> - Auto-marks `isCompleted: true` when `savedAmount >= targetAmount`.
> - At **25%**, **50%**, or **75%** → a **💰 Savings Milestone** push notification is sent.
> - At **100%** → a **🎉 Goal Completed** push notification is sent.

**Error `400`:** `{ "error": "Valid amount is required" }`

**Error `404`:** `{ "error": "Savings goal not found" }`

---

### Delete Savings Goal

**Endpoint:** `DELETE http://localhost:5001/api/savings/:id`

**Success Response `200`:**
```json
{
  "message": "Savings goal deleted successfully"
}
```

**Error `404`:** `{ "error": "Savings goal not found" }`

---

## 21. Debts

### Create Debt

**Endpoint:** `POST http://localhost:5001/api/debts`

**Request Body:**
```json
{
  "creditorName": "Bank Loan",
  "totalAmount": 50000,
  "interestRate": 7.5,
  "dueDate": "2028-02-01",
  "description": "Car purchase loan"
}
```

| Field | Required | Type | Notes |
|---|---|---|---|
| `creditorName` | ✅ | `string` | Lender name |
| `totalAmount` | ✅ | `number` | Total debt amount |
| `interestRate` | No | `number` | Annual rate % (default: 0) |
| `dueDate` | No | `string` | ISO date |
| `description` | No | `string` | Notes |

**Success Response `201`:**
```json
{
  "message": "Debt created successfully",
  "debt": {
    "_id": "67938abc123def456789",
    "creditorName": "Bank Loan",
    "totalAmount": 50000,
    "paidAmount": 0,
    "remainingAmount": 50000,
    "paymentProgress": 0,
    "interestRate": 7.5,
    "status": "active",
    "payments": []
  }
}
```

---

### Get All Debts

**Endpoint:** `GET http://localhost:5001/api/debts`

**Query Parameters:**

| Param | Type | Options |
|---|---|---|
| `status` | string | `active`, `paid`, `overdue` |

**Example:** `GET http://localhost:5001/api/debts?status=active`

**Success Response `200`:** Array of debts.

---

### Get Single Debt

**Endpoint:** `GET http://localhost:5001/api/debts/:id`

**Success Response `200`:** Full debt with payment history array.

**Error `404`:** `{ "error": "Debt not found" }`

---

### Update Debt

**Endpoint:** `PUT http://localhost:5001/api/debts/:id`

**Request Body** *(send only fields to update):*
```json
{
  "interestRate": 6.5,
  "description": "Renegotiated loan terms"
}
```

**Success Response `200`:**
```json
{
  "message": "Debt updated successfully",
  "debt": { "..." }
}
```

---

### Record Payment

**Endpoint:** `POST http://localhost:5001/api/debts/:id/payment`

**Request Body:**
```json
{
  "amount": 5000,
  "notes": "Monthly payment - May 2026"
}
```

**Success Response `200`:**
```json
{
  "message": "Payment recorded successfully",
  "debt": {
    "paidAmount": 5000,
    "remainingAmount": 45000,
    "paymentProgress": 10,
    "status": "active",
    "payments": [
      {
        "amount": 5000,
        "date": "2026-05-02T00:00:00.000Z",
        "notes": "Monthly payment - May 2026",
        "_id": "..."
      }
    ]
  }
}
```

> Auto-marks `status: "paid"` when `paidAmount >= totalAmount`.

---

### Delete Debt

**Endpoint:** `DELETE http://localhost:5001/api/debts/:id`

**Success Response `200`:**
```json
{
  "message": "Debt deleted successfully"
}
```

---

## 22. Analytics

### Overview

**Endpoint:** `GET http://localhost:5001/api/analytics/overview?period=monthly`

| Param | Options |
|---|---|
| `period` | `weekly`, `monthly`, `yearly` |

**Success Response `200`:**
```json
{
  "period": "monthly",
  "dateRange": {
    "startDate": "2026-05-01T00:00:00.000Z",
    "endDate": "2026-05-31T23:59:59.000Z"
  },
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

### Category Breakdown

**Endpoint:** `GET http://localhost:5001/api/analytics/categories?type=expense&period=monthly`

| Param | Options |
|---|---|
| `type` | `income`, `expense` |
| `period` | `weekly`, `monthly`, `yearly` |

**Success Response `200`:**
```json
{
  "type": "expense",
  "period": "monthly",
  "totalAmount": 1150.5,
  "breakdown": [
    { "category": "Food & Dining", "amount": 600.5, "count": 2, "percentage": 52.17 },
    { "category": "Transportation", "amount": 300, "count": 1, "percentage": 26.08 },
    { "category": "Entertainment", "amount": 250, "count": 1, "percentage": 21.74 }
  ]
}
```

---

### Spending Trends

**Endpoint:** `GET http://localhost:5001/api/analytics/trends?months=6`

**Success Response `200`:**
```json
{
  "trends": [
    { "month": "Dec 2025", "income": 7200, "expense": 1100, "net": 6100 },
    { "month": "Jan 2026", "income": 8000, "expense": 950, "net": 7050 },
    { "month": "Feb 2026", "income": 8500, "expense": 1150.5, "net": 7349.5 },
    { "month": "Mar 2026", "income": 8500, "expense": 980, "net": 7520 },
    { "month": "Apr 2026", "income": 8500, "expense": 1150.5, "net": 7349.5 },
    { "month": "May 2026", "income": 8500, "expense": 1150.5, "net": 7349.5 }
  ]
}
```

---

### Daily Spending Calendar

**Endpoint:** `GET http://localhost:5001/api/analytics/daily-spending?months=3`

**Success Response `200`:**
```json
{
  "dailySpending": [
    { "date": "2026-05-01", "amount": 150 },
    { "date": "2026-05-02", "amount": 0 },
    { "date": "2026-05-03", "amount": 400 }
  ]
}
```

---

### Budget Alerts

**Endpoint:** `GET http://localhost:5001/api/analytics/budget-alerts`

**Success Response `200`:**
```json
{
  "alerts": [
    {
      "category": "Food & Dining",
      "limit": 3000,
      "spent": 2800,
      "percentage": 93.33,
      "status": "warning",
      "predictedOverrun": true
    }
  ]
}
```

---

### Entry Method Stats

**Endpoint:** `GET http://localhost:5001/api/analytics/entry-methods?months=3`

**Success Response `200`:**
```json
{
  "entryMethods": [
    { "method": "manual", "count": 45, "percentage": 50 },
    { "method": "voice", "count": 27, "percentage": 30 },
    { "method": "ocr", "count": 18, "percentage": 20 }
  ]
}
```

---

### Savings Overview

**Endpoint:** `GET http://localhost:5001/api/analytics/savings-overview`

**Success Response `200`:**
```json
{
  "savingsGoals": [
    {
      "name": "Emergency Fund",
      "targetAmount": 30000,
      "savedAmount": 15000,
      "completionPercentage": 50,
      "probabilityOfSuccess": 85
    }
  ]
}
```

---

## 23. Offers

### Get All Offers

**Endpoint:** `GET http://localhost:5001/api/offers`

**Success Response `200`:**
```json
{
  "offers": [
    {
      "_id": "67939abc123def456789",
      "title": "20% Off Electronics",
      "description": "Get 20% discount on all electronics this month",
      "category": "Shopping",
      "discountPercentage": 20,
      "validFrom": "2026-05-01T00:00:00.000Z",
      "validUntil": "2026-05-31T23:59:59.000Z",
      "merchantName": "Tech Store",
      "isActive": true,
      "isValid": true
    }
  ],
  "count": 1
}
```

---

### Create Offer *(admin/testing)*

**Endpoint:** `POST http://localhost:5001/api/offers`

**Request Body:**
```json
{
  "title": "15% Off Restaurants",
  "description": "Special discount at partner restaurants",
  "category": "Food & Dining",
  "discountPercentage": 15,
  "validUntil": "2026-05-31",
  "merchantName": "Restaurant Partners"
}
```

**Success Response `201`:** `{ "message": "Offer created successfully", "offer": { "..." } }`

---

## 24. Settings

### Get All Settings

**Endpoint:** `GET http://localhost:5001/api/settings`

**Success Response `200`:**
```json
{
  "currency": "EGP",
  "preferences": {
    "theme": "auto",
    "dateFormat": "MM/DD/YYYY",
    "notifications": {
      "budgetAlerts": true,
      "goalReminders": true,
      "billReminders": true,
      "savingsTips": false,
      "monthlyReports": true
    },
    "biometricEnabled": false,
    "language": "en"
  }
}
```

---

### Update Theme

**Endpoint:** `PUT http://localhost:5001/api/settings/theme`  
**Body:** `{ "theme": "dark" }` — Options: `light`, `dark`, `auto`  
**Response `200`:** `{ "message": "Theme updated successfully", "theme": "dark" }`

---

### Update Currency

**Endpoint:** `PUT http://localhost:5001/api/settings/currency`  
**Body:** `{ "currency": "USD" }` — Options: `USD`, `EUR`, `GBP`, `EGP`, `SAR`, `AED`, `JPY`, `AUD`, `CAD`, `CHF`  
**Response `200`:** `{ "message": "Currency updated successfully", "currency": "USD" }`

---

### Update Date Format

**Endpoint:** `PUT http://localhost:5001/api/settings/date-format`  
**Body:** `{ "dateFormat": "DD/MM/YYYY" }` — Options: `MM/DD/YYYY`, `DD/MM/YYYY`, `YYYY-MM-DD`  
**Response `200`:** `{ "message": "Date format updated successfully" }`

---

### Toggle Biometric

**Endpoint:** `PUT http://localhost:5001/api/settings/biometric`  
**Body:** `{ "enabled": true }`  
**Response `200`:** `{ "message": "Biometric enabled successfully", "biometricEnabled": true }`

---

### Update Notification Preferences

**Endpoint:** `PUT http://localhost:5001/api/settings/notifications`

**Request Body:**
```json
{
  "budgetAlerts": true,
  "goalReminders": true,
  "billReminders": false,
  "savingsTips": true,
  "monthlyReports": true
}
```

**Response `200`:** `{ "message": "Notification preferences updated successfully" }`

---

### Backup All Data

**Endpoint:** `POST http://localhost:5001/api/settings/backup` *(no body)*

**Success Response `200`:**
```json
{
  "message": "Data backup created successfully",
  "backup": {
    "version": "1.0",
    "timestamp": "2026-05-02T00:00:00.000Z",
    "data": {
      "profile": { "..." },
      "transactions": [ "..." ],
      "budgets": [ "..." ],
      "savingsGoals": [ "..." ],
      "debts": [ "..." ]
    }
  }
}
```

---

### Restore Data

**Endpoint:** `POST http://localhost:5001/api/settings/restore`  
**Body:** `{ "backup": { "<full backup object>" } }`

> ⚠️ **Replaces ALL existing user data!**

**Response `200`:** `{ "message": "Data restored successfully" }`

---

### Clear All Data

**Endpoint:** `POST http://localhost:5001/api/settings/clear-all`  
**Body:** `{ "confirmation": "DELETE_ALL_DATA" }`

> ⚠️ **Permanent! Cannot be undone.**

**Response `200`:** `{ "message": "All data cleared successfully" }`

---

### Get App Info

**Endpoint:** `GET http://localhost:5001/api/settings/app-info`

**Response `200`:**
```json
{
  "appName": "Budget App",
  "version": "1.0.0",
  "build": "100",
  "developer": "Your Company Name",
  "contact": "support@budgetapp.com"
}
```

---

## 25. Help & Support

### Get All Help Articles
**Endpoint:** `GET http://localhost:5001/api/help`  
**Query:** `?category=transactions`  
**Categories:** `getting_started`, `accounts`, `transactions`, `budgets`, `savings`, `debts`, `analytics`, `settings`, `security`, `faq`

### Get Help by Category
**Endpoint:** `GET http://localhost:5001/api/help/category/:category`

### Get FAQ
**Endpoint:** `GET http://localhost:5001/api/help/faq`

### Get Single Article
**Endpoint:** `GET http://localhost:5001/api/help/:id`

### Contact Support
**Endpoint:** `POST http://localhost:5001/api/help/contact`  
**Body:** `{ "subject": "Issue with budget tracking", "message": "I'm having trouble..." }`  
**Response `200`:** `{ "message": "Support request submitted successfully" }`

---

## 26. Categories

> **System categories** are seeded automatically on first startup (21 groups).
> **Custom categories** are per-user and fully editable.

### Get All Categories
**Endpoint:** `GET http://localhost:5001/api/categories`  
**Query:** `?type=expense` or `?type=income`

**Success Response `200`:**
```json
{
  "total": 21,
  "system": 21,
  "custom": 0,
  "categories": [
    {
      "_id": "...",
      "name": "Food & Dining",
      "icon": "🍽️",
      "color": "#ef4444",
      "type": "expense",
      "isSystem": true,
      "subcategories": [
        { "_id": "...", "name": "Groceries", "icon": "🛒" },
        { "_id": "...", "name": "Restaurants/Dining Out", "icon": "🍴" },
        { "_id": "...", "name": "Coffee/Snacks/Fast Food", "icon": "☕" }
      ]
    }
  ]
}
```

**System Expense Groups (13):** Housing, Transportation, Food & Dining, Healthcare & Medicine, Entertainment & Joy, Shopping, Personal Care, Travel & Vacation, Education, Gifts & Donations, Subscriptions, Debt Repayment, Miscellaneous

**System Income Groups (8):** Salary / Wages, Freelance / Side Hustle, Business Income, Investments / Dividends, Bonuses / Commissions, Gifts / Refunds, Rental Income, Other Income

---

### Get Single Category
**Endpoint:** `GET http://localhost:5001/api/categories/:id`

### Create Custom Category
**Endpoint:** `POST http://localhost:5001/api/categories`  
**Body:**
```json
{
  "name": "Crypto",
  "icon": "₿",
  "color": "#f7931a",
  "type": "expense",
  "subcategories": [
    { "name": "Bitcoin", "icon": "₿" },
    { "name": "Altcoins", "icon": "🪙" }
  ]
}
```

| Field | Required | Notes |
|---|---|---|
| `name` | ✅ | Must be unique |
| `type` | ✅ | `expense`, `income`, or `both` |
| `icon` | No | Emoji (default `📂`) |
| `color` | No | Hex color (default `#6366f1`) |
| `subcategories` | No | Array of `{ name, icon }` |

**Response `201`:** `{ "message": "Custom category created successfully", "category": { "..." } }`  
**Error `409`:** `{ "error": "A category named \"Crypto\" already exists" }`

### Update Custom Category
**Endpoint:** `PUT http://localhost:5001/api/categories/:id`  
**Body:** `{ "name": "Cryptocurrency", "color": "#ff9900" }`  
> ⚠️ Cannot update system categories.

### Add Subcategory
**Endpoint:** `POST http://localhost:5001/api/categories/:id/subcategories`  
**Body:** `{ "name": "DeFi", "icon": "⛓️" }`

### Remove Subcategory
**Endpoint:** `DELETE http://localhost:5001/api/categories/:id/subcategories/:subId`

### Clone a System Category
**Endpoint:** `POST http://localhost:5001/api/categories/:systemCategoryId/clone`  
**Body:** `{ "name": "My Food Spending", "color": "#22c55e" }`

### Delete Custom Category
**Endpoint:** `DELETE http://localhost:5001/api/categories/:id`  
> ⚠️ System categories **cannot** be deleted. Deletion is soft-delete.

---

## 27. Push Notifications (FCM)

> Firebase Cloud Messaging integration. The mobile app must register its FCM token with the backend after login.

### Register Device Token

**Endpoint:** `POST http://localhost:5001/api/notifications/register-token`

> Call this **after every login** and whenever the FCM token refreshes.

**Request Body:**
```json
{
  "fcmToken": "eXAMPle_FCM_Token_String_here...",
  "deviceType": "android",
  "deviceName": "Samsung Galaxy S23"
}
```

| Field | Required | Notes |
|---|---|---|
| `fcmToken` | ✅ | FCM registration token from Firebase SDK |
| `deviceType` | No | `android`, `ios`, `web`, `unknown` |
| `deviceName` | No | Human-readable device name |

**Success Response `200`:**
```json
{
  "message": "Device token registered successfully",
  "deviceId": "664a1f..."
}
```

---

### Unregister Device Token

**Endpoint:** `DELETE http://localhost:5001/api/notifications/unregister-token`

> Call this **before logout** to stop pushes on this device.

**Request Body:**
```json
{
  "fcmToken": "eXAMPle_FCM_Token_String_here..."
}
```

**Success Response `200`:**
```json
{
  "message": "Device token unregistered successfully"
}
```

---

### List Registered Devices

**Endpoint:** `GET http://localhost:5001/api/notifications/devices`

**Success Response `200`:**
```json
{
  "devices": [
    {
      "_id": "664a1f...",
      "userId": "663b2a...",
      "fcmToken": "eXAMPle...",
      "deviceType": "android",
      "deviceName": "Samsung Galaxy S23",
      "active": true,
      "lastSeen": "2026-05-02T00:00:00.000Z"
    }
  ]
}
```

---

### Send Custom Notification

**Endpoint:** `POST http://localhost:5001/api/notifications/send`

**Request Body:**
```json
{
  "title": "Hello!",
  "body": "This is a custom notification.",
  "data": { "screen": "dashboard" },
  "userId": "optional — defaults to authenticated user"
}
```

**Success Response `200`:**
```json
{
  "message": "Notification sent",
  "sent": 1,
  "failed": 0
}
```

---

### Send Test Notification

**Endpoint:** `POST http://localhost:5001/api/notifications/test`

*(no body needed)*

**Success Response `200`:**
```json
{
  "message": "Test notification sent",
  "sent": 1,
  "failed": 0
}
```

### Auto-Triggered Notification Types

| Type | Trigger | `data.type` |
|---|---|---|
| ⚠️ Budget Alert | Expense pushes budget past alertThreshold (default 80%) | `budget_alert` |
| 🚨 Budget Exceeded | Expense pushes budget past 100% | `budget_exceeded` |
| 💸 Large Expense | Any expense ≥ 500 | `large_expense` |
| 💰 Savings Milestone | Contribution hits 25%, 50%, or 75% of goal | `goal_milestone` |
| 🎉 Goal Completed | `savedAmount >= targetAmount` | `goal_completed` |

---

### 🧪 FCM Testing Guide (Thunder Client / Postman)

> Follow these steps **in order** to test the full FCM push notification pipeline.
> All requests require `Authorization: Bearer <accessToken>`.

---

#### Test 1 — Register a Device Token

**`POST http://localhost:5001/api/notifications/register-token`**

```json
{
  "fcmToken": "eXAMPle_FCM_Token_String_from_your_mobile_app",
  "deviceType": "android",
  "deviceName": "Samsung Galaxy S23"
}
```

✅ **Expected:** `200`
```json
{
  "message": "Device token registered successfully",
  "deviceId": "664a1f..."
}
```

❌ Missing token: `400` → `{ "error": "fcmToken is required" }`

> ⚠️ **Where to get a real FCM token?**
> - Android/iOS: From `FirebaseMessaging.getInstance().getToken()` in your mobile app
> - Web: From `getToken(messaging)` in your web app
> - For quick testing: Use any string, but real push delivery will only work with a valid token

---

#### Test 2 — List Registered Devices

**`GET http://localhost:5001/api/notifications/devices`**

✅ **Expected:** `200`
```json
{
  "devices": [
    {
      "_id": "664a1f...",
      "userId": "663b2a...",
      "fcmToken": "eXAMPle_FCM_Token_String_from_your_mobile_app",
      "deviceType": "android",
      "deviceName": "Samsung Galaxy S23",
      "active": true,
      "lastSeen": "2026-05-16T00:00:00.000Z"
    }
  ]
}
```

> Verify the device you registered in Test 1 appears here with `"active": true`.

---

#### Test 3 — Send a Test Notification

**`POST http://localhost:5001/api/notifications/test`**

*(no body needed)*

✅ **Expected:** `200`
```json
{
  "message": "Test notification sent",
  "sent": 1,
  "failed": 0
}
```

> If using a **real FCM token**, you should see a push notification on your device:
> - Title: `🔔 Test Notification`
> - Body: `Firebase Cloud Messaging is working correctly on Hasibha!`
> - Data: `{ "type": "test", "timestamp": "2026-05-16T..." }`

> If `"sent": 0, "failed": 0` → No active devices found for this user. Re-run Test 1.

---

#### Test 4 — Send a Custom Notification

**`POST http://localhost:5001/api/notifications/send`**

```json
{
  "title": "💰 Payment Reminder",
  "body": "Your credit card bill is due tomorrow!",
  "data": {
    "screen": "debts",
    "debtId": "67938abc123def456789"
  }
}
```

✅ **Expected:** `200`
```json
{
  "message": "Notification sent",
  "sent": 1,
  "failed": 0
}
```

❌ Missing fields: `400` → `{ "error": "title and body are required" }`

> **Optional:** Send to a different user by adding `"userId": "<targetUserId>"` to the body. If omitted, sends to yourself.

---

#### Test 5 — Trigger Large Expense Notification (Auto)

> This tests the **automatic** notification triggered when you create an expense ≥ 500.

**`POST http://localhost:5001/api/transactions`**

```json
{
  "type": "expense",
  "amount": 750,
  "category": "Electronics",
  "categoryGroup": "Shopping",
  "description": "New headphones"
}
```

✅ **Expected:** `201` — Transaction created, AND a push notification sent to your device:
- Title: `💸 Large Expense Alert`
- Body: `You just spent 750 EGP on Electronics`
- Data: `{ "type": "large_expense" }`

> The threshold is controlled by `FCM_LARGE_EXPENSE_THRESHOLD` in `.env` (default: 500).

---

#### Test 6 — Trigger Budget Alert Notification (Auto)

> First, create a budget, then create an expense that pushes it past the alert threshold.

**Step A — Create a test budget:**
**`POST http://localhost:5001/api/budgets`**

```json
{
  "name": "Test Budget",
  "category": "Food & Dining",
  "limitAmount": 1000,
  "startDate": "2026-05-01",
  "endDate": "2026-05-31",
  "alertThreshold": 80
}
```

**Step B — Create an expense that crosses 80%:**
**`POST http://localhost:5001/api/transactions`**

```json
{
  "type": "expense",
  "amount": 850,
  "category": "Food & Dining",
  "description": "Restaurant dinner"
}
```

✅ **Expected:** Transaction created AND push notification:
- Title: `⚠️ Budget Alert`
- Body: `Your "Test Budget" budget is 85% used`
- Data: `{ "type": "budget_alert" }`

**Step C — Create another expense to exceed 100%:**
**`POST http://localhost:5001/api/transactions`**

```json
{
  "type": "expense",
  "amount": 200,
  "category": "Food & Dining",
  "description": "Groceries"
}
```

✅ **Expected:** Transaction created AND push notification:
- Title: `🚨 Budget Exceeded`
- Body: `You've exceeded your "Test Budget" budget!`
- Data: `{ "type": "budget_exceeded" }`

---

#### Test 7 — Trigger Savings Milestone Notification (Auto)

> Create a savings goal and contribute enough to hit 25%, 50%, 75%, or 100%.

**Step A — Create a savings goal:**
**`POST http://localhost:5001/api/savings`**

```json
{
  "name": "Test Savings",
  "targetAmount": 1000
}
```

> Save the `_id` from the response.

**Step B — Contribute 250 (hits 25%):**
**`POST http://localhost:5001/api/savings/:id/contribute`**

```json
{
  "amount": 250
}
```

✅ **Expected:** Contribution saved AND push notification:
- Title: `💰 Savings Milestone!`
- Body: `You've reached 25% of your "Test Savings" goal!`
- Data: `{ "type": "goal_milestone" }`

**Step C — Contribute 750 more (hits 100%):**
**`POST http://localhost:5001/api/savings/:id/contribute`**

```json
{
  "amount": 750
}
```

✅ **Expected:** Goal completed AND push notification:
- Title: `🎉 Goal Completed!`
- Body: `Congratulations! You've completed your "Test Savings" savings goal!`
- Data: `{ "type": "goal_completed" }`

---

#### Test 8 — Unregister Device Token

**`DELETE http://localhost:5001/api/notifications/unregister-token`**

```json
{
  "fcmToken": "eXAMPle_FCM_Token_String_from_your_mobile_app"
}
```

✅ **Expected:** `200`
```json
{
  "message": "Device token unregistered successfully"
}
```

❌ Missing token: `400` → `{ "error": "fcmToken is required" }`

**Verify:** Call `GET /api/notifications/devices` again — the device should still appear but with `"active": false`.

---

#### Test 9 — Verify No Notifications After Unregister

**`POST http://localhost:5001/api/notifications/test`**

✅ **Expected:** `200`
```json
{
  "message": "Test notification sent",
  "sent": 0,
  "failed": 0
}
```

> `"sent": 0` confirms the device was successfully unregistered and no push was delivered.

---

### 🔍 FCM Troubleshooting

| Problem | Cause | Fix |
|---|---|---|
| `"sent": 0, "failed": 0` | No active devices | Register a token first with `POST /register-token` |
| `"sent": 0, "failed": 1` | Invalid/expired FCM token | Get a fresh token from your mobile app |
| Push sent but not received | App is in foreground | Handle foreground notifications in your app code |
| Budget notification not firing | Category mismatch | Expense `category` must exactly match the budget `category` |
| Large expense notification not firing | Amount below threshold | Default threshold is 500. Check `FCM_LARGE_EXPENSE_THRESHOLD` in `.env` |
| Savings milestone not firing | Percentage not crossing milestone | Must cross exactly 25%, 50%, 75%, or reach 100% |

---

## 28. AI — Financial Advisor Chat

> Fetches the user's complete financial data and sends it to AI for personalized advice.
> Response time: **5–15 seconds**.

**Endpoint:** `POST http://localhost:5001/api/ai/chat`

**Request Body:**
```json
{
  "message": "Am I spending too much on food this month?"
}
```

**Success Response `200`:**
```json
{
  "reply": "Based on your data, you've spent 600.5 EGP on Food & Dining this month...",
  "dataUsed": {
    "savingsRate": 86.48,
    "totalIncome": 8500
  }
}
```

**Sample questions:** "Am I spending too much on food?", "How long until I reach my savings goal?", "Should I pay my debt faster?", "Give me a plan for next month", "كيف أوفر أكثر؟"

**Errors:**
| Status | Message |
|---|---|
| `400` | `message is required.` |
| `401` | `Access denied. No token provided.` |
| `503` | `AI agent is unavailable. Please try again later.` |
| `504` | `AI agent took too long. Please try again.` |

---

## 29. AI — Transaction Auto-Categorizer

> Analyzes free text (Arabic/English/mixed) and returns a structured category suggestion.
> Response time: **2–5 seconds**.

**Endpoint:** `POST http://localhost:5001/api/ai/categorize`

**Request Body:**
```json
{
  "text": "Uber ride to the airport 85 EGP"
}
```

**Success Response `200`:**
```json
{
  "type": "expense",
  "categoryGroup": "Transportation",
  "category": "Public Transport/Uber/Taxi",
  "confidence": 0.97,
  "detectedAmount": 85,
  "detectedCurrency": "EGP",
  "suggestedDescription": "Uber ride to airport",
  "language": "en"
}
```

**Recommended flow:**
1. User types: `"كافيه لاتيه 45 جنيه"`
2. Call `POST /api/ai/categorize` → get category, amount
3. Auto-fill the transaction form
4. User confirms → `POST /api/transactions`

**More examples:**

| Input | `type` | `categoryGroup` | `category` |
|---|---|---|---|
| `"فاتورة كهرباء 320 جنيه"` | expense | Housing | Utilities |
| `"Netflix 159 EGP monthly"` | expense | Subscriptions | Streaming |
| `"راتب شهر ابريل 12000"` | income | *null* | Salary / Wages |
| `"dentist visit 600 EGP"` | expense | Healthcare & Medicine | Doctor/Hospital |
| `"Amazon headphones order"` | expense | Shopping | Electronics |
| `"bonus from work 5000"` | income | *null* | Bonuses / Commissions |

---

## 30. AI — Voice Processing

### Transcribe Audio

**Endpoint:** `POST http://localhost:5001/api/voice/transcribe`  
**Content-Type:** `multipart/form-data`

| Field | Type | Required | Notes |
|---|---|---|---|
| `audio` | File | ✅ | Audio file up to 25MB (WAV/MP3/WebM/OGG/M4A) |
| `language_hint` | string | No | `auto`, `ar`, `en` |

**Success Response `200`:**
```json
{
  "transcript": "اشتريت قهوة ب 50 جنيه",
  "language": "ar"
}
```

---

### Extract Transaction from Transcript

**Endpoint:** `POST http://localhost:5001/api/voice/extract`

**Request Body:**
```json
{
  "transcript": "اشتريت قهوة ب 50 جنيه",
  "language": "ar"
}
```

**Success Response `200`:**
```json
{
  "extracted": {
    "itemName": "قهوة",
    "merchant": null,
    "amount": 50,
    "currency": "EGP",
    "quantity": 1,
    "date": null,
    "rawTranscript": "اشتريت قهوة ب 50 جنيه"
  },
  "confidence": 0.85,
  "missingFields": ["merchant"],
  "needsConfirmation": true
}
```

---

### Submit Voice Feedback

**Endpoint:** `POST http://localhost:5001/api/voice/feedback`

**Request Body:**
```json
{
  "originalTranscript": "اشتريت قهوة ب 50 جنيه",
  "language": "ar",
  "originalExtraction": { "itemName": "قهوة", "amount": 50 },
  "correctedExtraction": { "itemName": "قهوة", "amount": 50 },
  "correctedFields": [],
  "transcriptionConfidence": 0.95,
  "extractionConfidence": 0.85,
  "transactionId": "67935abc123def456789",
  "finalCategory": "Coffee/Snacks/Fast Food",
  "finalCategoryGroup": "Food & Dining",
  "finalType": "expense"
}
```

**Success Response `200`:**
```json
{
  "message": "Feedback saved. Thank you for helping improve the system.",
  "feedbackId": "679...123"
}
```

---

## 31. AI — OCR Receipt Scanner

### Scan Receipt Image/Document

**Endpoint:** `POST http://localhost:5001/api/ocr/scan`  
**Content-Type:** `multipart/form-data`

| Field | Type | Required | Notes |
|---|---|---|---|
| `file` | File | ✅ | Image or PDF up to 10MB (JPG/PNG/WEBP/HEIC/PDF/TXT) |
| `language_hint` | string | No | `auto`, `ar`, `en` |

**Success Response `200`:**
```json
{
  "rawText": "Starbucks Latte x2 = 150 EGP",
  "structuredOcr": {}
}
```

---

### Extract Transaction from OCR Text

**Endpoint:** `POST http://localhost:5001/api/ocr/extract`

**Request Body:**
```json
{
  "rawText": "Starbucks Latte x2 = 150 EGP",
  "structuredOcr": {},
  "language": "en",
  "fileType": "image"
}
```

**Success Response `200`:**
```json
{
  "extracted": {
    "vendor": "Starbucks",
    "invoiceType": "restaurant",
    "items": [
      { "name": "Latte", "quantity": 2, "unitPrice": 75.0, "totalPrice": 150.0 }
    ],
    "totalAmount": 150.0,
    "currency": "EGP"
  },
  "suggestedTransaction": {
    "type": "expense",
    "amount": 150.0,
    "description": "Starbucks — Latte"
  },
  "confidence": 0.89,
  "needsConfirmation": true
}
```

---

### Submit OCR Feedback

**Endpoint:** `POST http://localhost:5001/api/ocr/feedback`

**Request Body:**
```json
{
  "originalRawText": "Starbucks Latte x2 = 150 EGP",
  "originalExtraction": { "vendor": "Starbucks", "totalAmount": 150.0 },
  "correctedExtraction": { "vendor": "Starbucks", "totalAmount": 150.0 },
  "language": "en",
  "fileType": "image",
  "correctedFields": [],
  "ocrConfidence": 0.95,
  "extractionConfidence": 0.89,
  "transactionId": "67935abc123def456789",
  "finalCategory": "Coffee/Snacks/Fast Food",
  "finalCategoryGroup": "Food & Dining",
  "finalType": "expense"
}
```

**Success Response `200`:**
```json
{
  "message": "Feedback saved. Thank you for helping improve the system.",
  "feedbackId": "679...123"
}
```

---

## ⚠️ Common Error Reference

| Status | Meaning | Common Cause |
|---|---|---|
| `400` | Bad Request | Missing required field or invalid value |
| `401` | Unauthorized | No token or expired token |
| `403` | Forbidden | Action not allowed (e.g. editing system category) |
| `404` | Not Found | Wrong `:id` in URL |
| `409` | Conflict | Duplicate email, phone, or category name |
| `413` | Payload Too Large | File exceeds size limit |
| `429` | Rate Limited | Too many attempts — wait and retry |
| `500` | Server Error | Check server logs |
| `503` | AI Unavailable | AI agent server (`port 8000`) is not running |
| `504` | AI Timeout | AI agent took too long — retry |

---

## 🔑 Token Flow Summary

```
1. Signup or Login
   → receive accessToken (short-lived) + refreshToken (30 days)

2. Add to every home-backend request:
   Authorization: Bearer <accessToken>

3. When you get 401 "Token expired":
   POST http://localhost:3210/api/auth/refresh-token
   Body: { "refreshToken": "..." }
   → receive new accessToken + new refreshToken

4. On user logout:
   POST http://localhost:3210/api/auth/logout
   Body: { "refreshToken": "..." }
```

---

## 🔗 Recommended Integration Flow

```
User opens app
  │
  ├── First time?
  │     ├── Email: POST /api/auth/signup
  │     └── Phone: POST /api/auth/sms/send → verify → POST /api/auth/signup-phone
  │
  ├── Returning user → POST /api/auth/login
  │
  └── On success → save tokens → POST /api/notifications/register-token

User adds a transaction
  │
  ├── User types description
  ├── Call POST /api/ai/categorize → auto-fill category fields
  └── User confirms → POST /api/transactions
      └── Backend checks budgets → may send push notification

User asks AI for advice
  └── POST /api/ai/chat → display personalized advice

User contributes to savings
  └── POST /api/savings/:id/contribute
      └── Backend checks milestones → may send push notification

Token expires?
  └── POST /api/auth/refresh-token → replace stored accessToken

User logs out
  ├── DELETE /api/notifications/unregister-token
  └── POST /api/auth/logout
```

---

*Last Updated: May 2, 2026 | Version 3.0.0 | Total Endpoints: 81*
