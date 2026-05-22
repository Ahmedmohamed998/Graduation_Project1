# 📡 API Reference — Frontend Integration Guide

> **For the frontend team.** Complete reference for all backend endpoints.
> Last Updated: **April 7, 2026** | Version: **2.0.0** | Total Endpoints: **76**

---

## 🌐 Base URLs

| Service | URL | Description |
|---|---|---|
| **Auth Backend** | `http://localhost:3210` | Authentication, security, devices |
| **Home Backend** | `http://localhost:5001` | All financial data + AI features |
| **AI Agent** *(internal)* | `http://localhost:8000` | Do not call directly — proxied through home-backend |

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
16. [Transactions](#16-transactions)
17. [Budgets](#17-budgets)
18. [Savings Goals](#18-savings-goals)
19. [Debts](#19-debts)
20. [Analytics](#20-analytics)
21. [Offers](#21-offers)
22. [Settings](#22-settings)
23. [Help & Support](#23-help--support)
24. [Categories](#24-categories)
25. [AI — Financial Advisor Chat](#25-ai--financial-advisor-chat)
26. [AI — Transaction Auto-Categorizer](#26-ai--transaction-auto-categorizer)
27. [AI — Voice Processing](#27-ai--voice-processing)
28. [AI — OCR Receipt Scanner](#28-ai--ocr-receipt-scanner)

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

**Expected Response:** `200 OK`
```json
{
  "success": true,
  "message": "Code sent"
}
```

**Rate limit response:** `429`
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

**Expected Response:** `200 OK`
```json
{
  "success": true,
  "message": "Phone verified",
  "phoneVerificationToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

> ⚠️ Save `phoneVerificationToken` — required for phone-based signup.

**Error:** `400` → `{ "success": false, "message": "Invalid or expired code" }`

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

**Expected Response:** `201 Created`
```json
{
  "success": true,
  "message": "Account created successfully.",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
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

**Expected Response:** `201 Created` — same shape as email signup

---

## 4. Login

**Endpoint:** `POST http://localhost:3210/api/auth/login`

**All three formats are accepted:**
```json
{ "email": "user@example.com", "password": "Test123456" }
```
```json
{ "phone": "+201234567890", "password": "Test123456" }
```
```json
{ "identifier": "user@example.com", "password": "Test123456" }
```

> `identifier` accepts either email or phone.

**Expected Response:** `200 OK`
```json
{
  "success": true,
  "message": "Login successful.",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
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

**Expected Response:** `200 OK`
```json
{
  "success": true,
  "message": "Google authentication successful.",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
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

**Expected Response:** `200 OK`
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

**Expected Response:** `200 OK`
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
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Expected Response:** `200 OK`
```json
{
  "success": true,
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```
> Old refresh token is revoked. Save the new one.

---

## 9. Logout

**Endpoint:** `POST http://localhost:3210/api/auth/logout`

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Expected Response:** `200 OK`
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

**Expected Response:** `200 OK`
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

**Expected Response:** `200 OK`
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

**Expected Response:** `200 OK`
```json
{
  "message": "2FA setup initiated. Scan QR code and verify to enable.",
  "qrCode": "data:image/png;base64,...",
  "secret": "JBSWY3DPEHPK3PXP",
  "backupCodes": ["A1B2C3D4", "E5F6G7H8", "I9J0K1L2", "M3N4O5P6"]
}
```
> Display `qrCode` as an `<img>` for the user to scan with Google Authenticator or Authy.

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

**Expected Response:** `200 OK`
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

**Expected Response:** `200 OK`
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

**Expected Response:** `200 OK`
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

**Expected Response:** `200 OK`
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

**Expected Response:** `200 OK`
```json
{
  "message": "Device trusted successfully"
}
```

---

### Remove a Device

**Endpoint:** `DELETE http://localhost:3210/api/security/devices/:deviceId`

**Headers:** `Authorization: Bearer <accessToken>`

**Expected Response:** `200 OK`
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

**Expected Response:** `200 OK`
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

**Expected Response:** `200 OK`
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

**Expected Response:** `200 OK`
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

## 16. Transactions

> Users can manually add any income or expense with free-text category names.

### Create Transaction

**Endpoint:** `POST http://localhost:5001/api/transactions`

**Request Body:**
```json
{
  "type": "expense",
  "amount": 150.50,
  "category": "Groceries",
  "categoryGroup": "Food & Dining",
  "description": "Weekly grocery shopping",
  "date": "2026-04-07",
  "paymentMethod": "cash",
  "tags": ["groceries", "weekly"],
  "notes": "Bought from Carrefour"
}
```

| Field | Required | Notes |
|---|---|---|
| `type` | ✅ | `income` or `expense` |
| `amount` | ✅ | Number > 0 |
| `category` | ✅ | **Free text** — any string (subcategory name recommended) |
| `categoryGroup` | No | Parent group name e.g. `"Food & Dining"` — used for analytics |
| `description` | No | Short description |
| `date` | No | ISO date string, defaults to today |
| `paymentMethod` | No | `cash`, `credit_card`, `debit_card`, `bank_transfer`, `mobile_wallet`, `other` |
| `tags` | No | Array of strings |
| `notes` | No | Additional notes |

> 💡 **Tip:** Use the AI Auto-Categorizer (endpoint 26) to automatically fill `category` and `categoryGroup` from a text description.

**Expected Response:** `201 Created`
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
    "date": "2026-04-07T00:00:00.000Z",
    "paymentMethod": "cash",
    "tags": ["groceries", "weekly"],
    "notes": "Bought from Carrefour",
    "createdAt": "2026-04-07T04:45:00.000Z"
  },
  "newBalance": 7349.5
}
```

**Errors:**
```json
{ "error": "Type, amount, and category are required" }
{ "error": "Type must be either income or expense" }
{ "error": "Amount must be greater than 0" }
```

---

### Get All Transactions

**Endpoint:** `GET http://localhost:5001/api/transactions`

**Query Parameters:**

| Param | Type | Example | Description |
|---|---|---|---|
| `type` | string | `?type=expense` | Filter by type |
| `category` | string | `?category=Groceries` | Filter by category |
| `startDate` | string | `?startDate=2026-04-01` | From date |
| `endDate` | string | `?endDate=2026-04-30` | To date |
| `limit` | number | `?limit=20` | Per page (default 50) |
| `page` | number | `?page=1` | Page number |

**Expected Response:** `200 OK`
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
      "date": "2026-04-07T00:00:00.000Z",
      "paymentMethod": "cash"
    }
  ],
  "pagination": {
    "total": 1,
    "page": 1,
    "limit": 50,
    "pages": 1
  }
}
```

---

### Get Single Transaction

**Endpoint:** `GET http://localhost:5001/api/transactions/:id`

**Expected Response:** `200 OK` — full transaction object

**Error:** `404` → `{ "error": "Transaction not found" }`

---

### Update Transaction

**Endpoint:** `PUT http://localhost:5001/api/transactions/:id`

**Request Body:** *(send only fields to update)*
```json
{
  "amount": 175.00,
  "description": "Updated grocery shopping",
  "category": "Restaurants/Dining Out",
  "categoryGroup": "Food & Dining"
}
```

**Expected Response:** `200 OK`
```json
{
  "message": "Transaction updated successfully",
  "transaction": { "..." }
}
```
> Balance auto-recalculates when `amount` or `type` changes.

---

### Delete Transaction

**Endpoint:** `DELETE http://localhost:5001/api/transactions/:id`

**Expected Response:** `200 OK`
```json
{
  "message": "Transaction deleted successfully"
}
```
> Balance auto-recalculates.

---

## 17. Budgets

### Create Budget

**Endpoint:** `POST http://localhost:5001/api/budgets`

**Request Body:**
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

| Field | Required | Notes |
|---|---|---|
| `name` | ✅ | Budget label |
| `category` | ✅ | Matches transaction category or group |
| `limitAmount` | ✅ | Spending limit |
| `startDate` | ✅ | ISO date |
| `endDate` | ✅ | ISO date |
| `period` | No | `weekly`, `monthly`, `yearly` |
| `alertThreshold` | No | % to alert at (default 80) |

**Expected Response:** `201 Created`
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
    "alertThreshold": 80
  }
}
```
> `spentAmount` is auto-calculated from existing matching transactions!

---

### Get All Budgets

**Endpoint:** `GET http://localhost:5001/api/budgets`
**Endpoint:** `GET http://localhost:5001/api/budgets?isActive=true`

**Expected Response:** `200 OK` — array of budgets with live spent/remaining amounts

---

### Get Single Budget

**Endpoint:** `GET http://localhost:5001/api/budgets/:id`

**Expected Response:** `200 OK` — full budget object

---

### Update Budget

**Endpoint:** `PUT http://localhost:5001/api/budgets/:id`

**Request Body:**
```json
{
  "limitAmount": 2500,
  "alertThreshold": 90
}
```

**Expected Response:** `200 OK` → `{ "message": "Budget updated successfully" }`

---

### Delete Budget

**Endpoint:** `DELETE http://localhost:5001/api/budgets/:id`

**Expected Response:** `200 OK` → `{ "message": "Budget deleted successfully" }`

---

## 18. Savings Goals

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

| Field | Required | Notes |
|---|---|---|
| `name` | ✅ | Goal label |
| `targetAmount` | ✅ | Number > 0 |
| `deadline` | No | ISO date |
| `icon` | No | Emoji or icon string |
| `priority` | No | `high`, `medium`, `low` (default: `medium`) |
| `description` | No | Optional notes |

**Expected Response:** `201 Created`
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
    "isCompleted": false
  }
}
```

---

### Get All Savings Goals

**Endpoint:** `GET http://localhost:5001/api/savings`
**Endpoint:** `GET http://localhost:5001/api/savings?isCompleted=false`

**Expected Response:** `200 OK` — array of goals

---

### Get Single Goal

**Endpoint:** `GET http://localhost:5001/api/savings/:id`

**Expected Response:** `200 OK` — full goal object

---

### Update Goal

**Endpoint:** `PUT http://localhost:5001/api/savings/:id`

**Request Body:**
```json
{
  "targetAmount": 18000,
  "deadline": "2026-08-01"
}
```

**Expected Response:** `200 OK` → `{ "message": "Savings goal updated successfully" }`

---

### Contribute to Goal

**Endpoint:** `POST http://localhost:5001/api/savings/:id/contribute`

**Request Body:**
```json
{
  "amount": 1000
}
```

**Expected Response:** `200 OK`
```json
{
  "message": "Contribution added successfully",
  "savingsGoal": {
    "savedAmount": 1000,
    "remainingAmount": 14000,
    "progressPercentage": 6.67,
    "isCompleted": false
  }
}
```
> Goal auto-marks `isCompleted: true` when `savedAmount >= targetAmount`.

---

### Delete Goal

**Endpoint:** `DELETE http://localhost:5001/api/savings/:id`

**Expected Response:** `200 OK` → `{ "message": "Savings goal deleted successfully" }`

---

## 19. Debts

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

| Field | Required | Notes |
|---|---|---|
| `creditorName` | ✅ | Lender name |
| `totalAmount` | ✅ | Total debt |
| `interestRate` | No | Rate % (default 0) |
| `dueDate` | No | ISO date |
| `description` | No | — |

**Expected Response:** `201 Created`
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
**Endpoint:** `GET http://localhost:5001/api/debts?status=active`

| `status` | `active`, `paid`, `overdue` |
|---|---|

**Expected Response:** `200 OK` — array of debts

---

### Get Single Debt

**Endpoint:** `GET http://localhost:5001/api/debts/:id`

**Expected Response:** `200 OK` — full debt with payment history array

---

### Update Debt

**Endpoint:** `PUT http://localhost:5001/api/debts/:id`

**Request Body:**
```json
{
  "interestRate": 6.5,
  "description": "Renegotiated loan terms"
}
```

**Expected Response:** `200 OK` → `{ "message": "Debt updated successfully" }`

---

### Record Payment

**Endpoint:** `POST http://localhost:5001/api/debts/:id/payment`

**Request Body:**
```json
{
  "amount": 5000,
  "notes": "Monthly payment - April 2026"
}
```

**Expected Response:** `200 OK`
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
        "date": "2026-04-07T00:00:00.000Z",
        "notes": "Monthly payment - April 2026",
        "_id": "..."
      }
    ]
  }
}
```
> Debt auto-marks `status: "paid"` when `paidAmount >= totalAmount`.

---

### Delete Debt

**Endpoint:** `DELETE http://localhost:5001/api/debts/:id`

**Expected Response:** `200 OK` → `{ "message": "Debt deleted successfully" }`

---

## 20. Analytics

### Overview

**Endpoint:** `GET http://localhost:5001/api/analytics/overview?period=monthly`

| `period` | `weekly`, `monthly`, `yearly` |
|---|---|

**Expected Response:** `200 OK`
```json
{
  "period": "monthly",
  "dateRange": {
    "startDate": "2026-04-01T00:00:00.000Z",
    "endDate": "2026-04-30T23:59:59.000Z"
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

**Expected Response:** `200 OK`
```json
{
  "type": "expense",
  "period": "monthly",
  "totalAmount": 1150.5,
  "breakdown": [
    { "category": "Food & Dining", "amount": 600.5, "count": 2, "percentage": 52.17 },
    { "category": "Transportation", "amount": 300,  "count": 1, "percentage": 26.08 },
    { "category": "Entertainment",  "amount": 250,  "count": 1, "percentage": 21.74 }
  ]
}
```

---

### Spending Trends

**Endpoint:** `GET http://localhost:5001/api/analytics/trends?months=6`

**Expected Response:** `200 OK`
```json
{
  "trends": [
    { "month": "Nov 2025", "income": 7000, "expense": 900,    "net": 6100 },
    { "month": "Dec 2025", "income": 7200, "expense": 1100,   "net": 6100 },
    { "month": "Jan 2026", "income": 8000, "expense": 950,    "net": 7050 },
    { "month": "Feb 2026", "income": 8500, "expense": 1150.5, "net": 7349.5 },
    { "month": "Mar 2026", "income": 8500, "expense": 980,    "net": 7520 },
    { "month": "Apr 2026", "income": 8500, "expense": 1150.5, "net": 7349.5 }
  ]
}
```

---

### Daily Spending Calendar

**Endpoint:** `GET http://localhost:5001/api/analytics/daily-spending?months=3`

**Expected Response:** `200 OK`
```json
{
  "dailySpending": [
    { "date": "2026-04-01", "amount": 150 },
    { "date": "2026-04-02", "amount": 0 },
    { "date": "2026-04-03", "amount": 400 }
  ]
}
```

---

### Budget Alerts

**Endpoint:** `GET http://localhost:5001/api/analytics/budget-alerts`

**Expected Response:** `200 OK`
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

**Expected Response:** `200 OK`
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

**Expected Response:** `200 OK`
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

## 21. Offers

### Get All Offers

**Endpoint:** `GET http://localhost:5001/api/offers`

**Expected Response:** `200 OK`
```json
{
  "offers": [
    {
      "_id": "67939abc123def456789",
      "title": "20% Off Electronics",
      "description": "Get 20% discount on all electronics this month",
      "category": "Shopping",
      "discountPercentage": 20,
      "validFrom": "2026-04-01T00:00:00.000Z",
      "validUntil": "2026-04-30T23:59:59.000Z",
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
  "validUntil": "2026-04-30",
  "merchantName": "Restaurant Partners"
}
```

**Expected Response:** `201 Created` → `{ "message": "Offer created successfully", "offer": { "..." } }`

---

## 22. Settings

### Get All Settings

**Endpoint:** `GET http://localhost:5001/api/settings`

**Expected Response:** `200 OK`
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

**Request Body:**
```json
{ "theme": "dark" }
```
**Options:** `light`, `dark`, `auto`

**Expected Response:** `200 OK` → `{ "message": "Theme updated successfully", "theme": "dark" }`

---

### Update Currency

**Endpoint:** `PUT http://localhost:5001/api/settings/currency`

**Request Body:**
```json
{ "currency": "USD" }
```
**Options:** `USD`, `EUR`, `GBP`, `EGP`, `SAR`, `AED`, `JPY`, `AUD`, `CAD`, `CHF`

**Expected Response:** `200 OK` → `{ "message": "Currency updated successfully", "currency": "USD" }`

---

### Update Date Format

**Endpoint:** `PUT http://localhost:5001/api/settings/date-format`

**Request Body:**
```json
{ "dateFormat": "DD/MM/YYYY" }
```
**Options:** `MM/DD/YYYY`, `DD/MM/YYYY`, `YYYY-MM-DD`

**Expected Response:** `200 OK` → `{ "message": "Date format updated successfully" }`

---

### Toggle Biometric

**Endpoint:** `PUT http://localhost:5001/api/settings/biometric`

**Request Body:**
```json
{ "enabled": true }
```

**Expected Response:** `200 OK` → `{ "message": "Biometric enabled successfully", "biometricEnabled": true }`

---

### Update Notifications

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

**Expected Response:** `200 OK` → `{ "message": "Notification preferences updated successfully" }`

---

### Backup All Data

**Endpoint:** `POST http://localhost:5001/api/settings/backup`

*(no body needed)*

**Expected Response:** `200 OK`
```json
{
  "message": "Data backup created successfully",
  "backup": {
    "version": "1.0",
    "timestamp": "2026-04-07T00:00:00.000Z",
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

**Request Body:**
```json
{
  "backup": { "<paste full backup object from above>" }
}
```

> ⚠️ **Replaces ALL existing user data!**

**Expected Response:** `200 OK` → `{ "message": "Data restored successfully" }`

---

### Clear All Data

**Endpoint:** `POST http://localhost:5001/api/settings/clear-all`

**Request Body:**
```json
{ "confirmation": "DELETE_ALL_DATA" }
```

> ⚠️ **Permanent! Cannot be undone.**

**Expected Response:** `200 OK` → `{ "message": "All data cleared successfully" }`

---

### Get App Info

**Endpoint:** `GET http://localhost:5001/api/settings/app-info`

**Expected Response:** `200 OK`
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

## 23. Help & Support

### Get All Help Articles

**Endpoint:** `GET http://localhost:5001/api/help`

**Query:** `?category=transactions`

**Available categories:** `getting_started`, `accounts`, `transactions`, `budgets`, `savings`, `debts`, `analytics`, `settings`, `security`, `faq`

**Expected Response:** `200 OK` → `{ "articles": [ "..." ] }`

---

### Get Help by Category

**Endpoint:** `GET http://localhost:5001/api/help/category/:category`

**Example:** `GET http://localhost:5001/api/help/category/budgets`

---

### Get FAQ

**Endpoint:** `GET http://localhost:5001/api/help/faq`

---

### Get Single Article

**Endpoint:** `GET http://localhost:5001/api/help/:id`

---

### Contact Support

**Endpoint:** `POST http://localhost:5001/api/help/contact`

**Request Body:**
```json
{
  "subject": "Issue with budget tracking",
  "message": "I'm having trouble creating a budget..."
}
```

**Expected Response:** `200 OK` → `{ "message": "Support request submitted successfully" }`

---

## 24. Categories

> **System categories** are seeded automatically on first startup (21 groups total).
> **Custom categories** are per-user and are fully editable.

---

### Get All Categories

**Endpoint:** `GET http://localhost:5001/api/categories`
**Endpoint:** `GET http://localhost:5001/api/categories?type=expense`
**Endpoint:** `GET http://localhost:5001/api/categories?type=income`

**Expected Response:** `200 OK`
```json
{
  "total": 21,
  "system": 21,
  "custom": 0,
  "categories": [
    {
      "_id": "67940abc123def456789",
      "name": "Food & Dining",
      "icon": "🍽️",
      "color": "#ef4444",
      "type": "expense",
      "isSystem": true,
      "subcategories": [
        { "_id": "...", "name": "Groceries",              "icon": "🛒" },
        { "_id": "...", "name": "Restaurants/Dining Out", "icon": "🍴" },
        { "_id": "...", "name": "Coffee/Snacks/Fast Food","icon": "☕" }
      ]
    }
  ]
}
```

**System Expense Groups (13):**

| Group | Icon | Subcategories |
|---|---|---|
| Housing | 🏠 | Rent/Mortgage, Home Maintenance, Utilities, Internet & Phone, Home Insurance |
| Transportation | 🚗 | Fuel/Gas, Car Maintenance/Insurance/Payments, Public Transport/Uber/Taxi, Parking |
| Food & Dining | 🍽️ | Groceries, Restaurants/Dining Out, Coffee/Snacks/Fast Food |
| Healthcare & Medicine | 🏥 | Doctor/Hospital, Pharmacy/Medicine, Health Insurance, Vitamins/Supplements |
| Entertainment & Joy | 🎮 | Movies/Streaming, Hobbies/Sports, Concerts/Events, Gaming |
| Shopping | 🛍️ | Clothing, Electronics, Home Decor/Furniture |
| Personal Care | 💆 | Haircuts/Salon, Cosmetics, Gym/Fitness |
| Travel & Vacation | ✈️ | Flights, Hotels, Local Trips |
| Education | 📚 | Courses, Books, School Fees |
| Gifts & Donations | 🎁 | Gifts, Charity |
| Subscriptions | 🔁 | Streaming, Apps, Gym memberships |
| Debt Repayment | 💳 | Credit Card Payments, Loan Installments |
| Miscellaneous | 📦 | Bank Fees, Pet Care, Childcare, Other |

**System Income Groups (8):**
`Salary / Wages`, `Freelance / Side Hustle`, `Business Income`, `Investments / Dividends`, `Bonuses / Commissions`, `Gifts / Refunds`, `Rental Income`, `Other Income`

---

### Get Single Category

**Endpoint:** `GET http://localhost:5001/api/categories/:id`

**Expected Response:** `200 OK` — full category with all subcategories

---

### Create Custom Category

**Endpoint:** `POST http://localhost:5001/api/categories`

**Request Body:**
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

| Field | Required | Notes |
|---|---|---|
| `name` | ✅ | Must be unique (no match with system or own categories) |
| `type` | ✅ | `expense`, `income`, or `both` |
| `icon` | No | Emoji (default `📂`) |
| `color` | No | Hex color (default `#6366f1`) |
| `subcategories` | No | Array of `{ name, icon }` |

**Expected Response:** `201 Created`
```json
{
  "message": "Custom category created successfully",
  "category": {
    "_id": "67941abc123def456789",
    "name": "Crypto",
    "icon": "₿",
    "color": "#f7931a",
    "type": "expense",
    "isSystem": false,
    "subcategories": [
      { "_id": "...", "name": "Bitcoin",  "icon": "₿" },
      { "_id": "...", "name": "Altcoins", "icon": "🪙" }
    ]
  }
}
```

**Error:** `409` → `{ "error": "A category named \"Crypto\" already exists" }`

---

### Update Custom Category

**Endpoint:** `PUT http://localhost:5001/api/categories/:id`

**Request Body:** *(send only fields to update)*
```json
{
  "name": "Cryptocurrency",
  "color": "#ff9900",
  "icon": "🪙"
}
```

**Expected Response:** `200 OK` → `{ "message": "Category updated successfully", "category": { "..." } }`

> ⚠️ Cannot update system categories — returns `404`.

---

### Add Subcategory

**Endpoint:** `POST http://localhost:5001/api/categories/:id/subcategories`

**Request Body:**
```json
{
  "name": "DeFi",
  "icon": "⛓️"
}
```

**Expected Response:** `201 Created`
```json
{
  "message": "Subcategory added successfully",
  "subcategories": [
    { "_id": "...", "name": "Bitcoin",  "icon": "₿" },
    { "_id": "...", "name": "Altcoins", "icon": "🪙" },
    { "_id": "...", "name": "DeFi",     "icon": "⛓️" }
  ]
}
```

---

### Remove Subcategory

**Endpoint:** `DELETE http://localhost:5001/api/categories/:id/subcategories/:subId`

**Expected Response:** `200 OK`
```json
{
  "message": "Subcategory removed successfully",
  "subcategories": [ "..." ]
}
```

---

### Clone a System Category

Use this to make your own editable copy of a system category.

**Endpoint:** `POST http://localhost:5001/api/categories/:systemCategoryId/clone`

**Request Body:**
```json
{
  "name": "My Food Spending",
  "color": "#22c55e"
}
```

**Expected Response:** `201 Created`
```json
{
  "message": "System category \"Food & Dining\" cloned successfully. You can now customise it.",
  "category": {
    "_id": "67942abc123def456789",
    "name": "My Food Spending",
    "isSystem": false,
    "subcategories": [
      { "name": "Groceries" },
      { "name": "Restaurants/Dining Out" },
      { "name": "Coffee/Snacks/Fast Food" }
    ]
  }
}
```

---

### Delete Custom Category

**Endpoint:** `DELETE http://localhost:5001/api/categories/:id`

**Expected Response:** `200 OK` → `{ "message": "Category deleted successfully" }`

> ⚠️ System categories **cannot** be deleted — returns `404`.
> Deletion is a soft-delete (`isActive: false`).

---

## 25. AI — Financial Advisor Chat

> This endpoint fetches the user's complete financial data and sends it to an AI model to give personalized advice.
> Response time: **5–15 seconds** (calls Azure OpenAI).

**Endpoint:** `POST http://localhost:5001/api/ai/chat`

**Request Body:**
```json
{
  "message": "Am I spending too much on food this month?"
}
```

| Field | Required | Notes |
|---|---|---|
| `message` | ✅ | User question in English or Arabic |

**Expected Response:** `200 OK`
```json
{
  "reply": "Based on your data, you've spent 600.5 EGP on Food & Dining this month, which is 52.17% of your total expenses. Your savings rate is 86.48%, which is excellent! You could comfortably stay within a 2,000 EGP food budget. Consider reducing dining-out expenses and shifting more to groceries to save an extra 200–300 EGP per month.",
  "dataUsed": {
    "savingsRate": 86.48,
    "totalIncome": 8500
  }
}
```

**Sample questions that work well:**

| Question | What the AI uses |
|---|---|
| "Am I spending too much on food?" | Category breakdown |
| "How long until I reach my savings goal?" | Savings progress + deadline |
| "Should I pay my debt faster?" | Debt + interest rate + savings rate |
| "What's my biggest expense this month?" | Category breakdown sorted by amount |
| "Give me a plan for next month" | All financial data combined |
| "كيف أوفر أكثر؟" | Full financial data (supports Arabic) |

**Errors:**
```json
{ "error": "message is required." }                            // 400
{ "error": "Access denied. No token provided." }               // 401
{ "error": "AI agent is unavailable. Please try again later." }  // 503
{ "error": "AI agent took too long. Please try again." }         // 504
```

---

## 26. AI — Transaction Auto-Categorizer

> Analyzes free text (Arabic, English, or mixed) and returns a structured category suggestion.
> Use this to auto-fill the category when a user types a transaction description.
> Response time: **2–5 seconds**.

**Endpoint:** `POST http://localhost:5001/api/ai/categorize`

**Request Body:**
```json
{
  "text": "Uber ride to the airport 85 EGP"
}
```

| Field | Required | Notes |
|---|---|---|
| `text` | ✅ | Transaction description — supports English, Arabic, mixed |

**Expected Response:** `200 OK`
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

| Response Field | Type | Description |
|---|---|---|
| `type` | string | `income` or `expense` |
| `categoryGroup` | string | Parent group — use as `categoryGroup` in transaction |
| `category` | string | Subcategory — use as `category` in transaction |
| `confidence` | number | 0.0 to 1.0 — how sure the AI is |
| `detectedAmount` | number\|null | Amount found in text (if any) |
| `detectedCurrency` | string\|null | Currency found in text |
| `suggestedDescription` | string | Clean English description |
| `language` | string | `en`, `ar`, or `mixed` |

**Recommended frontend flow:**
```
1. User types: "كافيه لاتيه 45 جنيه"
2. Call POST /api/ai/categorize → { category: "Coffee/Snacks/Fast Food", categoryGroup: "Food & Dining", detectedAmount: 45 }
3. Auto-fill category, categoryGroup, amount fields in the transaction form
4. User confirms and submits → POST /api/transactions
```

**More examples:**

| Input | `type` | `categoryGroup` | `category` |
|---|---|---|---|
| `"فاتورة كهرباء 320 جنيه"` | expense | Housing | Utilities |
| `"Netflix 159 EGP monthly"` | expense | Subscriptions | Streaming |
| `"راتب شهر ابريل 12000"` | income | *null* | Salary / Wages |
| `"dentist visit 600 EGP"` | expense | Healthcare & Medicine | Doctor/Hospital |
| `"حلاق 80 جنيه"` | expense | Personal Care | Haircuts/Salon |
| `"gym membership 350 EGP"` | expense | Personal Care | Gym/Fitness |
| `"Amazon headphones order"` | expense | Shopping | Electronics |
| `"bonus from work 5000"` | income | *null* | Bonuses / Commissions |
| `"مطعم كنتاكي 95 جنيه"` | expense | Food & Dining | Restaurants/Dining Out |
| `"credit card payment 2000"` | expense | Debt Repayment | Credit Card Payments |

**Errors:**
```json
{ "error": "text is required." }                                 // 400
{ "error": "AI agent is unavailable. Please try again later." }  // 503
```

---

## 27. AI — Voice Processing

### Transcribe Audio

**Endpoint:** `POST http://localhost:5001/api/voice/transcribe`

**Headers:** `Content-Type: multipart/form-data`

**Body (`multipart/form-data`):**
| Field | Type | Required | Description |
|---|---|---|---|
| `audio` | File | ✅ | Audio file up to 25MB |
| `language_hint` | string | No | `auto`, `ar`, `en` |

**Expected Response:** `200 OK`
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

**Expected Response:** `200 OK`
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

**Expected Response:** `200 OK`
```json
{
  "message": "Feedback saved. Thank you for helping improve the system.",
  "feedbackId": "679...123"
}
```

---

## 28. AI — OCR Receipt Scanner

### Scan Receipt Image/Document

**Endpoint:** `POST http://localhost:5001/api/ocr/scan`

**Headers:** `Content-Type: multipart/form-data`

**Body (`multipart/form-data`):**
| Field | Type | Required | Description |
|---|---|---|---|
| `file` | File | ✅ | Image or PDF up to 10MB |
| `language_hint` | string | No | `auto`, `ar`, `en` |

**Expected Response:** `200 OK`
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

**Expected Response:** `200 OK`
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

**Expected Response:** `200 OK`
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
  └── On success → save accessToken + refreshToken

User adds a transaction
  │
  ├── User types description
  ├── Call POST /api/ai/categorize → auto-fill category fields
  └── User confirms → POST /api/transactions

User asks AI for advice
  └── POST /api/ai/chat → display personalized advice

Token expires?
  └── POST /api/auth/refresh-token → replace stored accessToken
```

---

*Last Updated: April 26, 2026 | Version 2.0.1 | Total Endpoints: 76*
