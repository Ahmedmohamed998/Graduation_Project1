# 🧪 Complete API Testing Guide
> Test every endpoint in order. Copy responses between steps as needed.

---

## ⚡ Pre-flight: Start All Servers

| Terminal | Command | Port |
|---|---|---|
| **Auth Backend** | `npm run dev` in `auth-backend/` | **3210** |
| **Home Backend** | `npm run dev` in `home-backend/` | **5001** |
| **AI Agent** | `python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload` in `grad_project_ai/` | **8000** |

**Confirm home-backend console shows:**
```
✅ MongoDB connected
✅ Seeded 21 system categories   ← first run only
🚀 Home Backend Server running on port 5001
```

---

## 📋 Table of Contents

### 🔐 Auth Backend (port 3210)
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

### 🏠 Home Backend (port 5001)
14. [Dashboard](#14-dashboard)
15. [Profile](#15-profile)
16. [Transactions](#16-transactions)
17. [Budgets](#17-budgets)
18. [Savings Goals](#18-savings-goals)
19. [Debts](#19-debts)
20. [Analytics](#20-analytics)
21. [Offers](#21-offers)
22. [Settings](#22-settings)
23. [Help & Support](#23-help--support)
24. [Categories (System + Custom)](#24-categories)
25. [AI Agent — Chat](#25-ai-agent--chat)
26. [AI Agent — Auto Categorize](#26-ai-agent--auto-categorize)

---

## 🔐 Auth Backend Endpoints

---

## 1. SMS Verification

### 1a. Send SMS Code
**`POST http://localhost:3210/api/auth/sms/send`**

```json
{
  "phone": "+201234567890"
}
```
✅ **Expected:** `200`
```json
{ "success": true, "message": "Code sent" }
```
❌ **Rate limit:** `429` → `{ "success": false, "message": "Wait before requesting another code", "seconds_left": 45 }`

---

### 1b. Verify SMS Code
**`POST http://localhost:3210/api/auth/sms/verify`**

```json
{
  "phone": "+201234567890",
  "code": "123456"
}
```
✅ **Expected:** `200`
```json
{
  "success": true,
  "message": "Phone verified",
  "phoneVerificationToken": "eyJ..."
}
```
> ⚠️ Save `phoneVerificationToken` — needed for phone signup (Step 3)

---

## 2. Signup with Email
**`POST http://localhost:3210/api/auth/signup`**

```json
{
  "username": "Test User",
  "email": "testuser@example.com",
  "password": "Test123456",
  "confirmPassword": "Test123456",
  "phone": "+201234567890"
}
```
> `phone` is optional. `username`, `email`, `password`, `confirmPassword` are **required**.

✅ **Expected:** `201`
```json
{
  "success": true,
  "message": "Account created successfully.",
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": "67933def456789abc123",
    "username": "Test User",
    "email": "testuser@example.com",
    "phone": "+201234567890"
  }
}
```
> ⚠️ **Save `accessToken` and `refreshToken`** — used in all home-backend requests.

❌ Missing fields: `400` → `{ "success": false, "message": "Username, email, and passwords are required." }`
❌ Duplicate email: `409` → `{ "success": false, "message": "Email already registered." }`

---

## 3. Signup with Phone
**`POST http://localhost:3210/api/auth/signup-phone`**

```json
{
  "username": "Phone User",
  "phone": "+201234567890",
  "email": "phoneuser@example.com",
  "password": "Test123456",
  "confirmPassword": "Test123456",
  "phoneVerificationToken": "<token from Step 1b>"
}
```
> `email` is optional. `phoneVerificationToken` is **required** (from Step 1b).

✅ **Expected:** `201` — same shape as email signup response

---

## 4. Login
**`POST http://localhost:3210/api/auth/login`**

Any of these formats work:
```json
{ "email": "testuser@example.com", "password": "Test123456" }
```
```json
{ "phone": "+201234567890", "password": "Test123456" }
```
```json
{ "identifier": "testuser@example.com", "password": "Test123456" }
```

✅ **Expected:** `200`
```json
{
  "success": true,
  "message": "Login successful.",
  "accessToken": "eyJ...",
  "refreshToken": "eyJ...",
  "user": {
    "id": "67933def456789abc123",
    "username": "Test User",
    "email": "testuser@example.com",
    "phone": "+201234567890"
  }
}
```
> ⚠️ **Save `accessToken`** — paste in `Authorization: Bearer <token>` for all steps below.

❌ Wrong password: `401` → `{ "success": false, "message": "Incorrect password." }`
❌ Not found: `404` → `{ "success": false, "message": "User not found." }`

---

## 5. Google Sign-In
**`POST http://localhost:3210/api/auth/google-signin`**

```json
{ "idToken": "<Google ID token from Google Sign-In SDK>" }
```
✅ **Expected:** `200` — same response shape as login (creates account if new user)

---

## 6. Forgot Password
**`POST http://localhost:3210/api/auth/forgot-password`**

```json
{ "email": "testuser@example.com" }
```
✅ **Expected:** `200`
```json
{ "success": true, "message": "If the email exists, a reset code has been sent." }
```
> A 6-digit code is emailed. Rate limited to 5 attempts/hour.

---

## 7. Reset Password
**`POST http://localhost:3210/api/auth/reset-password`**

```json
{
  "email": "testuser@example.com",
  "code": "123456",
  "newPassword": "NewPass789"
}
```
✅ **Expected:** `200`
```json
{ "success": true, "message": "Password reset successful." }
```
❌ Wrong code: `400` → `{ "success": false, "message": "Invalid code." }`
❌ Expired code: `400` → `{ "success": false, "message": "Code expired." }`

---

## 8. Refresh Token
**`POST http://localhost:3210/api/auth/refresh-token`**

```json
{ "refreshToken": "eyJ..." }
```
✅ **Expected:** `200`
```json
{
  "success": true,
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```
> Old refresh token is invalidated. Save the new one.

---

## 9. Logout
**`POST http://localhost:3210/api/auth/logout`**

```json
{ "refreshToken": "eyJ..." }
```
✅ **Expected:** `200`
```json
{ "success": true, "message": "Logged out successfully" }
```

---

## 10. Check Auth Status
**`GET http://localhost:3210/api/auth/me`**
```
Authorization: Bearer <accessToken>
```
✅ **Expected:** `200`
```json
{
  "success": true,
  "user": {
    "id": "67933def456789abc123",
    "email": "testuser@example.com",
    "username": "Test User",
    "phone": "+201234567890"
  }
}
```

---

## 11. Change Password
**`POST http://localhost:3210/api/security/change-password`**
```
Authorization: Bearer <accessToken>
```
```json
{
  "currentPassword": "Test123456",
  "newPassword": "NewSecure789"
}
```
✅ **Expected:** `200`
```json
{ "message": "Password changed successfully" }
```
❌ Wrong current: `400` → `{ "error": "Current password is incorrect" }`

---

## 12. Two-Factor Authentication

### 12a. Setup 2FA
**`POST http://localhost:3210/api/security/2fa/setup`**
```
Authorization: Bearer <accessToken>
```
✅ **Expected:** `200`
```json
{
  "message": "2FA setup initiated. Scan QR code and verify to enable.",
  "qrCode": "data:image/png;base64,...",
  "secret": "JBSWY3DPEHPK3PXP",
  "backupCodes": ["A1B2C3D4", "E5F6G7H8", "I9J0K1L2", "M3N4O5P6"]
}
```
> Show `qrCode` image in frontend for user to scan with Google Authenticator / Authy.

---

### 12b. Verify & Enable 2FA
**`POST http://localhost:3210/api/security/2fa/verify`**
```
Authorization: Bearer <accessToken>
```
```json
{ "token": "123456" }
```
✅ **Expected:** `200`
```json
{ "message": "2FA enabled successfully", "backupCodes": ["..."] }
```

---

### 12c. Get 2FA Status
**`GET http://localhost:3210/api/security/2fa/status`**
```
Authorization: Bearer <accessToken>
```
✅ **Expected:** `200`
```json
{ "enabled": true, "method": "totp", "verifiedAt": "2026-04-07T00:00:00.000Z" }
```

---

### 12d. Disable 2FA
**`POST http://localhost:3210/api/security/2fa/disable`**
```
Authorization: Bearer <accessToken>
```
```json
{
  "password": "NewSecure789",
  "token": "123456"
}
```
✅ **Expected:** `200`
```json
{ "message": "2FA disabled successfully" }
```

---

## 13. Device Management

### 13a. List Devices
**`GET http://localhost:3210/api/security/devices`**
```
Authorization: Bearer <accessToken>
```
✅ **Expected:** `200`
```json
{
  "devices": [
    {
      "_id": "...",
      "deviceId": "device_abc123",
      "deviceName": "iPhone 14",
      "deviceType": "mobile",
      "platform": "iOS",
      "lastActive": "2026-04-07T00:00:00.000Z",
      "isTrusted": true
    }
  ],
  "total": 1
}
```

---

### 13b. Trust a Device
**`PUT http://localhost:3210/api/security/devices/:deviceId/trust`**
```
Authorization: Bearer <accessToken>
```
✅ **Expected:** `200`
```json
{ "message": "Device trusted successfully" }
```

---

### 13c. Remove a Device
**`DELETE http://localhost:3210/api/security/devices/:deviceId`**
```
Authorization: Bearer <accessToken>
```
✅ **Expected:** `200`
```json
{ "message": "Device removed successfully" }
```

---
---

## 🏠 Home Backend Endpoints

> **All requests below require:**
> ```
> Authorization: Bearer <accessToken>
> ```

---

## 14. Dashboard
**`GET http://localhost:5001/api/dashboard`**

✅ **Expected:** `200`
```json
{
  "user": {
    "name": "Test User",
    "photo": null,
    "currency": "EGP"
  },
  "balance": {
    "total": 7499.5,
    "income": 8500,
    "expense": 1000.5,
    "period": "This Month"
  },
  "quickActions": [
    { "id": "add_expense",   "label": "Add Expense",    "enabled": true },
    { "id": "create_budget", "label": "Create Budget",  "enabled": true },
    { "id": "savings_goal",  "label": "Savings Goal",   "enabled": true },
    { "id": "analytics",     "label": "Analytics",      "enabled": true },
    { "id": "debt_tracking", "label": "Debt Tracking",  "enabled": true },
    { "id": "ai_chat",       "label": "AI Chat",        "enabled": true },
    { "id": "offers",        "label": "Offers",         "enabled": true }
  ]
}
```

---

## 15. Profile

### 15a. Get Profile
**`GET http://localhost:5001/api/profile`**

✅ **Expected:** `200`
```json
{
  "_id": "...",
  "userId": "67933def456789abc123",
  "displayName": "Test User",
  "profilePhoto": null,
  "currency": "EGP"
}
```

---

### 15b. Update Profile
**`PUT http://localhost:5001/api/profile`**

```json
{
  "displayName": "Mohamed Yaser",
  "currency": "EGP",
  "profilePhoto": "https://example.com/photo.jpg"
}
```

| Field | Options |
|---|---|
| `currency` | USD, EUR, GBP, EGP, SAR, AED, JPY, AUD, CAD, CHF |

✅ **Expected:** `200`
```json
{
  "message": "Profile updated successfully",
  "profile": { "displayName": "Mohamed Yaser", "currency": "EGP" }
}
```

---

## 16. Transactions

### 16a. Create Expense Transaction
**`POST http://localhost:5001/api/transactions`**

```json
{
  "type": "expense",
  "amount": 150.50,
  "category": "Food & Dining",
  "description": "Grocery shopping",
  "date": "2026-04-07",
  "paymentMethod": "cash",
  "tags": ["groceries"],
  "notes": "Weekly groceries"
}
```

| Field | Required | Values |
|---|---|---|
| `type` | ✅ | `income` / `expense` |
| `amount` | ✅ | number > 0 |
| `category` | ✅ | see categories section |
| `paymentMethod` | No | `cash`, `credit_card`, `debit_card`, `bank_transfer`, `mobile_wallet`, `other` |

✅ **Expected:** `201`
```json
{
  "message": "Transaction created successfully",
  "transaction": {
    "_id": "...",
    "type": "expense",
    "amount": 150.5,
    "category": "Food & Dining",
    "description": "Grocery shopping",
    "date": "2026-04-07T00:00:00.000Z"
  },
  "newBalance": 7349.5
}
```
> Save the `_id` for update/delete tests.

---

### 16b. Create Income Transaction
**`POST http://localhost:5001/api/transactions`**

```json
{
  "type": "income",
  "amount": 8500,
  "category": "Salary",
  "description": "Monthly salary",
  "date": "2026-04-01"
}
```
✅ **Expected:** `201` — same shape as above

---

### 16c. Get All Transactions
**`GET http://localhost:5001/api/transactions`**

Query params available:

| Param | Example | Description |
|---|---|---|
| `type` | `?type=expense` | Filter by type |
| `category` | `?category=Food & Dining` | Filter by category |
| `startDate` | `?startDate=2026-04-01` | From date |
| `endDate` | `?endDate=2026-04-30` | To date |
| `limit` | `?limit=10` | Per page (default 50) |
| `page` | `?page=1` | Page number |

✅ **Expected:** `200`
```json
{
  "transactions": [ { "_id": "...", "type": "expense", "amount": 150.5, "..." } ],
  "pagination": { "total": 1, "page": 1, "limit": 50, "pages": 1 }
}
```

---

### 16d. Get Single Transaction
**`GET http://localhost:5001/api/transactions/:id`**

✅ **Expected:** `200` — full transaction object
❌ Wrong id: `404` → `{ "error": "Transaction not found" }`

---

### 16e. Update Transaction
**`PUT http://localhost:5001/api/transactions/:id`**

```json
{
  "amount": 175.00,
  "description": "Updated grocery shopping"
}
```
✅ **Expected:** `200`
```json
{ "message": "Transaction updated successfully", "transaction": { "..." } }
```
> Balance auto-recalculates.

---

### 16f. Delete Transaction
**`DELETE http://localhost:5001/api/transactions/:id`**

✅ **Expected:** `200`
```json
{ "message": "Transaction deleted successfully" }
```

---

## 17. Budgets

### 17a. Create Budget
**`POST http://localhost:5001/api/budgets`**

```json
{
  "name": "Monthly Food Budget",
  "category": "Food & Dining",
  "limitAmount": 2000,
  "period": "monthly",
  "startDate": "2026-04-01",
  "endDate": "2026-04-30",
  "alertThreshold": 80
}
```

| Field | Required | Values |
|---|---|---|
| `name` | ✅ | any string |
| `category` | ✅ | match a transaction category |
| `limitAmount` | ✅ | number > 0 |
| `period` | No | `weekly`, `monthly`, `yearly` |
| `alertThreshold` | No | 0–100 (%) — default 80 |

✅ **Expected:** `201`
```json
{
  "message": "Budget created successfully",
  "budget": {
    "_id": "...",
    "name": "Monthly Food Budget",
    "limitAmount": 2000,
    "spentAmount": 150.5,
    "remainingAmount": 1849.5,
    "percentageSpent": 7.53,
    "isActive": true
  }
}
```
> `spentAmount` auto-calculated from existing matching transactions!

---

### 17b. Get All Budgets
**`GET http://localhost:5001/api/budgets`**
**`GET http://localhost:5001/api/budgets?isActive=true`**

✅ **Expected:** `200` — array of budgets with live spent/remaining amounts

---

### 17c. Get Single Budget
**`GET http://localhost:5001/api/budgets/:id`**

✅ **Expected:** `200` — full budget object

---

### 17d. Update Budget
**`PUT http://localhost:5001/api/budgets/:id`**

```json
{ "limitAmount": 2500, "alertThreshold": 90 }
```
✅ **Expected:** `200` → `{ "message": "Budget updated successfully" }`

---

### 17e. Delete Budget
**`DELETE http://localhost:5001/api/budgets/:id`**

✅ **Expected:** `200` → `{ "message": "Budget deleted successfully" }`

---

## 18. Savings Goals

### 18a. Create Savings Goal
**`POST http://localhost:5001/api/savings`**

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

| Field | Required | Values |
|---|---|---|
| `name` | ✅ | any string |
| `targetAmount` | ✅ | number > 0 |
| `priority` | No | `high`, `medium`, `low` |

✅ **Expected:** `201`
```json
{
  "message": "Savings goal created successfully",
  "savingsGoal": {
    "_id": "...",
    "name": "Vacation Fund",
    "targetAmount": 15000,
    "savedAmount": 0,
    "remainingAmount": 15000,
    "progressPercentage": 0,
    "isCompleted": false
  }
}
```

---

### 18b. Get All Savings Goals
**`GET http://localhost:5001/api/savings`**
**`GET http://localhost:5001/api/savings?isCompleted=false`**

✅ **Expected:** `200` — array of savings goals

---

### 18c. Get Single Goal
**`GET http://localhost:5001/api/savings/:id`**

✅ **Expected:** `200` — full goal object

---

### 18d. Update Goal
**`PUT http://localhost:5001/api/savings/:id`**

```json
{ "targetAmount": 18000, "deadline": "2026-08-01" }
```
✅ **Expected:** `200` → `{ "message": "Savings goal updated successfully" }`

---

### 18e. Contribute to Goal
**`POST http://localhost:5001/api/savings/:id/contribute`**

```json
{ "amount": 1000 }
```
✅ **Expected:** `200`
```json
{
  "message": "Contribution added successfully",
  "savingsGoal": {
    "savedAmount": 1000,
    "progressPercentage": 6.67,
    "isCompleted": false
  }
}
```
> Goal auto-marks `isCompleted: true` when `savedAmount >= targetAmount`!

---

### 18f. Delete Goal
**`DELETE http://localhost:5001/api/savings/:id`**

✅ **Expected:** `200` → `{ "message": "Savings goal deleted successfully" }`

---

## 19. Debts

### 19a. Create Debt
**`POST http://localhost:5001/api/debts`**

```json
{
  "creditorName": "Bank Loan",
  "totalAmount": 50000,
  "interestRate": 7.5,
  "dueDate": "2028-02-01",
  "description": "Car purchase loan"
}
```

✅ **Expected:** `201`
```json
{
  "message": "Debt created successfully",
  "debt": {
    "_id": "...",
    "creditorName": "Bank Loan",
    "totalAmount": 50000,
    "paidAmount": 0,
    "remainingAmount": 50000,
    "paymentProgress": 0,
    "status": "active"
  }
}
```

---

### 19b. Get All Debts
**`GET http://localhost:5001/api/debts`**
**`GET http://localhost:5001/api/debts?status=active`**

| `status` values | `active`, `paid`, `overdue` |
|---|---|

✅ **Expected:** `200` — array of debts

---

### 19c. Get Single Debt
**`GET http://localhost:5001/api/debts/:id`**

✅ **Expected:** `200` — full debt with payment history

---

### 19d. Update Debt
**`PUT http://localhost:5001/api/debts/:id`**

```json
{ "interestRate": 6.5 }
```
✅ **Expected:** `200` → `{ "message": "Debt updated successfully" }`

---

### 19e. Record Payment
**`POST http://localhost:5001/api/debts/:id/payment`**

```json
{
  "amount": 5000,
  "notes": "Monthly payment - April 2026"
}
```
✅ **Expected:** `200`
```json
{
  "message": "Payment recorded successfully",
  "debt": {
    "paidAmount": 5000,
    "remainingAmount": 45000,
    "paymentProgress": 10,
    "payments": [ { "amount": 5000, "date": "...", "notes": "Monthly payment - April 2026" } ]
  }
}
```
> Debt auto-marks `status: "paid"` when `paidAmount >= totalAmount`!

---

### 19f. Delete Debt
**`DELETE http://localhost:5001/api/debts/:id`**

✅ **Expected:** `200` → `{ "message": "Debt deleted successfully" }`

---

## 20. Analytics

### 20a. Overview
**`GET http://localhost:5001/api/analytics/overview?period=monthly`**

| `period` | `weekly`, `monthly`, `yearly` |
|---|---|

✅ **Expected:** `200`
```json
{
  "period": "monthly",
  "dateRange": { "startDate": "2026-04-01T00:00:00.000Z", "endDate": "2026-04-30T23:59:59.000Z" },
  "summary": {
    "totalIncome": 8500,
    "totalExpense": 150.5,
    "netSavings": 8349.5,
    "savingsRate": 98.23,
    "transactionCount": 2
  }
}
```

---

### 20b. Category Breakdown
**`GET http://localhost:5001/api/analytics/categories?type=expense&period=monthly`**

✅ **Expected:** `200`
```json
{
  "type": "expense",
  "totalAmount": 150.5,
  "breakdown": [
    { "category": "Food & Dining", "amount": 150.5, "count": 1, "percentage": 100 }
  ]
}
```

---

### 20c. Spending Trends
**`GET http://localhost:5001/api/analytics/trends?months=6`**

✅ **Expected:** `200`
```json
{
  "trends": [
    { "month": "Nov 2025", "income": 0, "expense": 0, "net": 0 },
    { "month": "Apr 2026", "income": 8500, "expense": 150.5, "net": 8349.5 }
  ]
}
```

---

## 21. Offers

### 21a. Get Offers
**`GET http://localhost:5001/api/offers`**

✅ **Expected:** `200`
```json
{
  "offers": [ { "_id": "...", "title": "...", "isActive": true, "isValid": true } ],
  "count": 0
}
```

---

### 21b. Create Offer *(admin/testing)*
**`POST http://localhost:5001/api/offers`**

```json
{
  "title": "20% Off Electronics",
  "description": "Special discount this month",
  "category": "Shopping",
  "discountPercentage": 20,
  "validUntil": "2026-04-30",
  "merchantName": "Tech Store"
}
```
✅ **Expected:** `201` → `{ "message": "Offer created successfully", "offer": { "..." } }`

---

## 22. Settings

### 22a. Get All Settings
**`GET http://localhost:5001/api/settings`**

✅ **Expected:** `200`
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

### 22b. Update Theme
**`PUT http://localhost:5001/api/settings/theme`**

```json
{ "theme": "dark" }
```
Options: `light`, `dark`, `auto`
✅ **Expected:** `200` → `{ "message": "Theme updated successfully", "theme": "dark" }`

---

### 22c. Update Currency
**`PUT http://localhost:5001/api/settings/currency`**

```json
{ "currency": "USD" }
```
Options: `USD`, `EUR`, `GBP`, `EGP`, `SAR`, `AED`, `JPY`, `AUD`, `CAD`, `CHF`
✅ **Expected:** `200` → `{ "message": "Currency updated successfully", "currency": "USD" }`

---

### 22d. Update Date Format
**`PUT http://localhost:5001/api/settings/date-format`**

```json
{ "dateFormat": "DD/MM/YYYY" }
```
Options: `MM/DD/YYYY`, `DD/MM/YYYY`, `YYYY-MM-DD`
✅ **Expected:** `200` → `{ "message": "Date format updated successfully" }`

---

### 22e. Toggle Biometric
**`PUT http://localhost:5001/api/settings/biometric`**

```json
{ "enabled": true }
```
✅ **Expected:** `200` → `{ "message": "Biometric enabled successfully", "biometricEnabled": true }`

---

### 22f. Update Notifications
**`PUT http://localhost:5001/api/settings/notifications`**

```json
{
  "budgetAlerts": true,
  "goalReminders": true,
  "billReminders": false,
  "savingsTips": true,
  "monthlyReports": true
}
```
✅ **Expected:** `200` → `{ "message": "Notification preferences updated successfully" }`

---

### 22g. Backup Data
**`POST http://localhost:5001/api/settings/backup`**

*(no body needed)*

✅ **Expected:** `200`
```json
{
  "message": "Data backup created successfully",
  "backup": {
    "version": "1.0",
    "timestamp": "2026-04-07T00:00:00.000Z",
    "data": { "profile": {}, "transactions": [], "budgets": [], "..." }
  }
}
```
> Save the full `backup` object — use it in the restore test below.

---

### 22h. Restore Data
**`POST http://localhost:5001/api/settings/restore`**

```json
{
  "backup": { "<paste backup object from 22g here>" }
}
```
⚠️ **Warning:** Replaces ALL existing user data!
✅ **Expected:** `200` → `{ "message": "Data restored successfully" }`

---

### 22i. Clear All Data
**`POST http://localhost:5001/api/settings/clear-all`**

```json
{ "confirmation": "DELETE_ALL_DATA" }
```
⚠️ **Warning:** Permanent deletion!
✅ **Expected:** `200` → `{ "message": "All data cleared successfully" }`

---

### 22j. Get App Info
**`GET http://localhost:5001/api/settings/app-info`**

✅ **Expected:** `200`
```json
{
  "appName": "Budget App",
  "version": "1.0.0",
  "build": "100"
}
```

---

## 23. Help & Support

### 23a. Get All Help Articles
**`GET http://localhost:5001/api/help`**
✅ **Expected:** `200` → `{ "articles": [ ... ] }`

### 23b. Get Help by Category
**`GET http://localhost:5001/api/help/category/transactions`**

Categories: `getting_started`, `accounts`, `transactions`, `budgets`, `savings`, `debts`, `analytics`, `settings`, `security`, `faq`

### 23c. Get FAQ
**`GET http://localhost:5001/api/help/faq`**

### 23d. Get Single Article
**`GET http://localhost:5001/api/help/:id`**

### 23e. Contact Support
**`POST http://localhost:5001/api/help/contact`**
```json
{
  "subject": "Issue with budget tracking",
  "message": "I'm having trouble creating a budget..."
}
```
✅ **Expected:** `200` → `{ "message": "Support request submitted successfully" }`

---

## 24. Categories

> System categories are **seeded automatically** when home-backend starts.
> Custom categories belong to the logged-in user only.

---

### 24a. Get All Categories (System + Custom)
**`GET http://localhost:5001/api/categories`**

✅ **Expected:** `200`
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
        { "_id": "...", "name": "Groceries",             "icon": "🛒" },
        { "_id": "...", "name": "Restaurants/Dining Out", "icon": "🍴" },
        { "_id": "...", "name": "Coffee/Snacks/Fast Food","icon": "☕" }
      ]
    }
  ]
}
```

---

### 24b. Filter by Type
**`GET http://localhost:5001/api/categories?type=expense`**
**`GET http://localhost:5001/api/categories?type=income`**

✅ **Expected:** `200` — filtered list (13 expense groups / 8 income groups)

---

### 24c. Get Single Category
**`GET http://localhost:5001/api/categories/:id`**

✅ **Expected:** `200` — full category with subcategories

---

### 24d. Create Custom Category
**`POST http://localhost:5001/api/categories`**

```json
{
  "name": "Crypto",
  "icon": "₿",
  "color": "#f7931a",
  "type": "expense",
  "subcategories": [
    { "name": "Bitcoin",  "icon": "₿" },
    { "name": "Altcoins", "icon": "🪙" }
  ]
}
```

✅ **Expected:** `201`
```json
{
  "message": "Custom category created successfully",
  "category": {
    "_id": "...",
    "name": "Crypto",
    "icon": "₿",
    "color": "#f7931a",
    "type": "expense",
    "isSystem": false,
    "subcategories": [
      { "name": "Bitcoin", "icon": "₿" },
      { "name": "Altcoins", "icon": "🪙" }
    ]
  }
}
```
> Save `_id` for the next tests.

❌ Duplicate name: `409` → `{ "error": "A category named \"Crypto\" already exists" }`

---

### 24e. Update Custom Category
**`PUT http://localhost:5001/api/categories/:id`**

```json
{
  "name": "Cryptocurrency",
  "color": "#ff9900",
  "icon": "🪙"
}
```

✅ **Expected:** `200`
```json
{ "message": "Category updated successfully", "category": { "name": "Cryptocurrency", "..." } }
```
❌ Try with a system category id → `404` (cannot edit system categories)

---

### 24f. Add Subcategory to Custom Category
**`POST http://localhost:5001/api/categories/:id/subcategories`**

```json
{ "name": "DeFi", "icon": "⛓️" }
```

✅ **Expected:** `201`
```json
{
  "message": "Subcategory added successfully",
  "subcategories": [
    { "name": "Bitcoin",  "icon": "₿" },
    { "name": "Altcoins", "icon": "🪙" },
    { "name": "DeFi",     "icon": "⛓️" }
  ]
}
```
> Save the `_id` of the new subcategory for the remove test.

---

### 24g. Remove Subcategory
**`DELETE http://localhost:5001/api/categories/:id/subcategories/:subId`**

✅ **Expected:** `200`
```json
{ "message": "Subcategory removed successfully", "subcategories": [ ... ] }
```

---

### 24h. Clone a System Category
**`POST http://localhost:5001/api/categories/:systemCategoryId/clone`**

*(Use the `_id` of a system category, e.g., "Food & Dining")*

```json
{
  "name": "My Food Budget",
  "color": "#22c55e"
}
```

✅ **Expected:** `201`
```json
{
  "message": "System category \"Food & Dining\" cloned successfully. You can now customise it.",
  "category": {
    "_id": "...",
    "name": "My Food Budget",
    "isSystem": false,
    "subcategories": [
      { "name": "Groceries" },
      { "name": "Restaurants/Dining Out" },
      { "name": "Coffee/Snacks/Fast Food" }
    ]
  }
}
```
> Now you can add/remove subcategories on your clone freely.

---

### 24i. Delete Custom Category (Soft Delete)
**`DELETE http://localhost:5001/api/categories/:id`**

*(Use your custom category id)*

✅ **Expected:** `200`
```json
{ "message": "Category deleted successfully" }
```
❌ Try with a system category id → `404` (cannot delete system categories)

---

## 25. AI Agent — Chat

> Requires both **home-backend (5001)** and **AI agent (8000)** running.

---

### 25a. Auth Guard Test (must fail)
**`POST http://localhost:5001/api/ai/chat`** *(no Authorization header)*

```json
{ "message": "How am I doing financially?" }
```
✅ **Expected:** `401` → `{ "error": "Access denied. No token provided." }`

---

### 25b. Empty Message Test (must fail)
**`POST http://localhost:5001/api/ai/chat`**
```
Authorization: Bearer <accessToken>
```
```json
{ "message": "" }
```
✅ **Expected:** `400` → `{ "error": "message is required." }`

---

### 25c. Full AI Chat Test ⭐
**`POST http://localhost:5001/api/ai/chat`**
```
Authorization: Bearer <accessToken>
```
```json
{ "message": "Am I spending too much on food this month?" }
```
✅ **Expected:** `200` *(takes 5–15 seconds)*
```json
{
  "reply": "Based on your data, you spent 150.5 EGP on Food & Dining this month...",
  "dataUsed": {
    "savingsRate": 98.23,
    "totalIncome": 8500
  }
}
```

---

### 25d. More Chat Tests

**Savings question:**
```json
{ "message": "How long until I reach my Vacation Fund goal?" }
```

**Debt question:**
```json
{ "message": "Should I pay off my debt faster?" }
```

**Budget question:**
```json
{ "message": "Am I staying within my budget this month?" }
```

**Trend question:**
```json
{ "message": "How has my spending changed over the last 6 months?" }
```

**General advice:**
```json
{ "message": "Give me a plan to save more money next month." }
```

✅ Each response should mention **specific numbers** from your actual data.

---

## 26. AI Agent — Auto Categorize

> No financial data needed — this is stateless. Just needs auth token.
> Supports English, Arabic, and mixed input.

---

### 26a. English Input
**`POST http://localhost:5001/api/ai/categorize`**
```
Authorization: Bearer <accessToken>
```
```json
{ "text": "Uber ride to the airport 85 EGP" }
```
✅ **Expected:** `200`
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

---

### 26b. Arabic Input
```json
{ "text": "فاتورة كهرباء 320 جنيه" }
```
✅ **Expected:** `200`
```json
{
  "type": "expense",
  "categoryGroup": "Housing",
  "category": "Utilities",
  "confidence": 0.95,
  "detectedAmount": 320,
  "detectedCurrency": "EGP",
  "suggestedDescription": "Electricity bill",
  "language": "ar"
}
```

---

### 26c. Mixed Input
```json
{ "text": "Netflix subscription 159 جنيه شهريا" }
```
✅ **Expected:** `200`
```json
{
  "type": "expense",
  "categoryGroup": "Subscriptions",
  "category": "Streaming",
  "confidence": 0.98,
  "detectedAmount": 159,
  "detectedCurrency": "EGP",
  "suggestedDescription": "Netflix monthly subscription",
  "language": "mixed"
}
```

---

### 26d. More Categorization Tests

| Input | Expected Category |
|---|---|
| `"راتب شهر ابريل 12000"` | Salary / Wages (income) |
| `"حلاق 80 جنيه"` | Haircuts/Salon (Personal Care) |
| `"gym membership 350 EGP"` | Gym/Fitness (Personal Care) |
| `"dentist visit 600 pounds"` | Doctor/Hospital (Healthcare) |
| `"Amazon order for headphones"` | Electronics (Shopping) |
| `"school fees for kids"` | School Fees (Education) |
| `"credit card payment 2000"` | Credit Card Payments (Debt Repayment) |
| `"مطعم كنتاكي 95 جنيه"` | Restaurants/Dining Out (Food & Dining) |
| `"parking ticket downtown"` | Parking (Transportation) |
| `"bonus from work 5000"` | Bonuses / Commissions (income) |

---

## ✅ Full Test Checklist

| # | Test | Status |
|---|---|---|
| 1a | SMS send code | ☐ |
| 1b | SMS verify code | ☐ |
| 2 | Email signup | ☐ |
| 3 | Phone signup | ☐ |
| 4 | Login + save token | ☐ |
| 5 | Google sign-in | ☐ |
| 6 | Forgot password | ☐ |
| 7 | Reset password | ☐ |
| 8 | Refresh token | ☐ |
| 9 | Logout | ☐ |
| 10 | Check auth | ☐ |
| 11 | Change password | ☐ |
| 12a | 2FA setup | ☐ |
| 12b | 2FA verify | ☐ |
| 12c | 2FA status | ☐ |
| 12d | 2FA disable | ☐ |
| 13a | List devices | ☐ |
| 13b | Trust device | ☐ |
| 13c | Remove device | ☐ |
| 14 | Dashboard | ☐ |
| 15a | Get profile | ☐ |
| 15b | Update profile | ☐ |
| 16a | Create expense | ☐ |
| 16b | Create income | ☐ |
| 16c | Get all transactions | ☐ |
| 16d | Get single transaction | ☐ |
| 16e | Update transaction | ☐ |
| 16f | Delete transaction | ☐ |
| 17a | Create budget | ☐ |
| 17b | Get all budgets | ☐ |
| 17c | Get single budget | ☐ |
| 17d | Update budget | ☐ |
| 17e | Delete budget | ☐ |
| 18a | Create savings goal | ☐ |
| 18b | Get all goals | ☐ |
| 18c | Get single goal | ☐ |
| 18d | Update goal | ☐ |
| 18e | Contribute to goal | ☐ |
| 18f | Delete goal | ☐ |
| 19a | Create debt | ☐ |
| 19b | Get all debts | ☐ |
| 19c | Get single debt | ☐ |
| 19d | Update debt | ☐ |
| 19e | Record payment | ☐ |
| 19f | Delete debt | ☐ |
| 20a | Analytics overview | ☐ |
| 20b | Category breakdown | ☐ |
| 20c | Spending trends | ☐ |
| 21a | Get offers | ☐ |
| 21b | Create offer | ☐ |
| 22a | Get settings | ☐ |
| 22b | Update theme | ☐ |
| 22c | Update currency | ☐ |
| 22d | Update date format | ☐ |
| 22e | Toggle biometric | ☐ |
| 22f | Update notifications | ☐ |
| 22g | Backup data | ☐ |
| 22h | Restore data | ☐ |
| 22i | Clear all data | ☐ |
| 22j | App info | ☐ |
| 23a | Get help articles | ☐ |
| 23b | Get by category | ☐ |
| 23c | FAQ | ☐ |
| 23d | Single article | ☐ |
| 23e | Contact support | ☐ |
| 24a | Get all categories | ☐ |
| 24b | Filter by type | ☐ |
| 24c | Get single category | ☐ |
| 24d | Create custom category | ☐ |
| 24e | Update custom category | ☐ |
| 24f | Add subcategory | ☐ |
| 24g | Remove subcategory | ☐ |
| 24h | Clone system category | ☐ |
| 24i | Delete custom category | ☐ |
| 25a | AI chat — no auth (expect 401) | ☐ |
| 25b | AI chat — empty msg (expect 400) | ☐ |
| 25c | AI chat — full test | ☐ |
| 25d | AI chat — savings/debt/budget | ☐ |
| 26a | Categorize — English | ☐ |
| 26b | Categorize — Arabic | ☐ |
| 26c | Categorize — mixed | ☐ |
| 26d | Categorize — various inputs | ☐ |

---

## ⚠️ Common Errors Quick Reference

| Code | Meaning | Fix |
|---|---|---|
| `400` | Missing/invalid field | Check required fields |
| `401` | No/expired token | Login again, get new accessToken |
| `404` | Resource not found | Check the `:id` in the URL |
| `409` | Duplicate (email/name) | Use a different value |
| `429` | Rate limited | Wait before retrying |
| `503` | AI agent offline | Start `uvicorn` on port 8000 |
| `504` | AI request timed out | Try again / check Azure OpenAI |

---

## 🔑 Auth Flow Summary

```
1. Signup or Login → get accessToken + refreshToken
2. Add header to every home-backend request:
   Authorization: Bearer <accessToken>
3. When you get 401 "Token expired":
   POST /api/auth/refresh-token → { refreshToken }  → new accessToken
4. On logout:
   POST /api/auth/logout → { refreshToken }
```

---

*Last Updated: April 7, 2026 — Version 2.0.0 — Total Endpoints: 76*
