# 📚 Home Backend - Complete API Documentation

## Base URL
```
http://localhost:5001
```

---

## 🔐 Authentication

All endpoints except health check require a JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

Get your token from the auth-backend login endpoint (`http://localhost:3210`).

---

## 📋 Table of Contents

1. [Health Check](#health-check)
2. [Dashboard](#dashboard)
3. [Profile](#profile)
4. [Transactions](#transactions)
5. [Budgets](#budgets)
6. [Savings Goals](#savings-goals)
7. [Debts](#debts)
8. [Analytics](#analytics)
9. [Offers](#offers)
10. [Settings](#settings)
11. [Help & Support](#help--support)
12. [Auth Backend - Security API](#auth-backend---security-api)

---

## Health Check

### Get Server Health
Check if the server is running.

**Endpoint:** `GET /health`

**Authentication:** Not required

**Request:**
```http
GET http://localhost:5001/health
```

**Response:** `200 OK`
```json
{
  "status": "ok",
  "service": "home-backend",
  "timestamp": "2026-01-24T04:56:19.000Z"
}
```

---

## Dashboard

### Get Dashboard Data
Get home screen data including user info, balance, and monthly income/expense.

**Endpoint:** `GET /api/dashboard`

**Authentication:** Required

**Request:**
```http
GET http://localhost:5001/api/dashboard
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response:** `200 OK`
```json
{
  "user": {
    "name": "Mohamed Yaser",
    "photo": "https://i.pravatar.cc/150?img=12",
    "currency": "EGP"
  },
  "balance": {
    "total": 7849.5,
    "income": 8500,
    "expense": 650.5,
    "period": "This Month"
  },
  "quickActions": [
    { "id": "add_expense", "label": "Add Expense", "enabled": true },
    { "id": "create_budget", "label": "Create Budget", "enabled": true },
    { "id": "savings_goal", "label": "Savings Goal", "enabled": true },
    { "id": "analytics", "label": "Analytics", "enabled": true },
    { "id": "debt_tracking", "label": "Debt Tracking", "enabled": true },
    { "id": "ai_chat", "label": "AI Chat", "enabled": true },
    { "id": "offers", "label": "Offers", "enabled": true }
  ]
}
```

**Notes:**
- Automatically creates UserProfile and Account if they don't exist
- Balance is calculated from all transactions
- Income/Expense are for the current month only

---

## Profile

### Get User Profile

**Endpoint:** `GET /api/profile`

**Authentication:** Required

**Request:**
```http
GET http://localhost:5001/api/profile
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "_id": "67934abc123def456789",
  "userId": "67933def456789abc123",
  "displayName": "Mohamed Yaser",
  "profilePhoto": "https://i.pravatar.cc/150?img=12",
  "currency": "EGP",
  "createdAt": "2026-01-24T04:30:00.000Z",
  "updatedAt": "2026-01-24T04:35:00.000Z"
}
```

---

### Update User Profile

**Endpoint:** `PUT /api/profile`

**Authentication:** Required

**Request:**
```http
PUT http://localhost:5001/api/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "displayName": "Mohamed Yaser",
  "profilePhoto": "https://example.com/photo.jpg",
  "currency": "EGP"
}
```

**Request Body:**
| Field | Type | Required | Options |
|-------|------|----------|---------|
| `displayName` | string | No | Any name |
| `profilePhoto` | string | No | URL to image |
| `currency` | string | No | USD, EUR, GBP, EGP, SAR, AED |

**Response:** `200 OK`
```json
{
  "message": "Profile updated successfully",
  "profile": {
    "_id": "67934abc123def456789",
    "userId": "67933def456789abc123",
    "displayName": "Mohamed Yaser",
    "profilePhoto": "https://example.com/photo.jpg",
    "currency": "EGP",
    "updatedAt": "2026-01-24T04:40:00.000Z"
  }
}
```

---

## Transactions

### Create Transaction

**Endpoint:** `POST /api/transactions`

**Authentication:** Required

**Request:**
```http
POST http://localhost:5001/api/transactions
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "expense",
  "amount": 150.50,
  "category": "Food & Dining",
  "description": "Grocery shopping",
  "date": "2026-01-24",
  "paymentMethod": "cash",
  "tags": ["groceries", "weekly"],
  "notes": "Bought fruits and vegetables"
}
```

**Request Body:**
| Field | Type | Required | Options/Notes |
|-------|------|----------|---------------|
| `type` | string | Yes | `income` or `expense` |
| `amount` | number | Yes | Must be > 0 |
| `category` | string | Yes | See categories below |
| `description` | string | No | Transaction description |
| `date` | string | No | ISO date, defaults to now |
| `paymentMethod` | string | No | See payment methods below |
| `tags` | array | No | Array of strings |
| `attachments` | array | No | Array of URLs |
| `notes` | string | No | Additional notes |

**Categories (Expense):**
- Food & Dining
- Shopping
- Transportation
- Bills & Utilities
- Entertainment
- Healthcare
- Education
- Travel
- Personal Care
- Other Expense

**Categories (Income):**
- Salary
- Freelance
- Business
- Investment
- Gift
- Other Income

**Payment Methods:**
- cash
- credit_card
- debit_card
- bank_transfer
- mobile_wallet
- other

**Response:** `201 Created`
```json
{
  "message": "Transaction created successfully",
  "transaction": {
    "_id": "67935abc123def456789",
    "userId": "67933def456789abc123",
    "type": "expense",
    "amount": 150.5,
    "category": "Food & Dining",
    "description": "Grocery shopping",
    "date": "2026-01-24T00:00:00.000Z",
    "paymentMethod": "cash",
    "tags": ["groceries", "weekly"],
    "notes": "Bought fruits and vegetables",
    "createdAt": "2026-01-24T04:45:00.000Z"
  },
  "newBalance": 7849.5
}
```

**Important:** Creating a transaction automatically updates the account balance!

---

### Get All Transactions

**Endpoint:** `GET /api/transactions`

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `type` | string | Filter by type | `income` or `expense` |
| `category` | string | Filter by category | `Food & Dining` |
| `startDate` | string | Start date filter | `2026-01-01` |
| `endDate` | string | End date filter | `2026-01-31` |
| `limit` | number | Results per page | `50` (default) |
| `page` | number | Page number | `1` (default) |

**Request:**
```http
GET http://localhost:5001/api/transactions?type=expense&limit=10&page=1
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "transactions": [
    {
      "_id": "67935abc123def456789",
      "userId": "67933def456789abc123",
      "type": "expense",
      "amount": 150.5,
      "category": "Food & Dining",
      "description": "Grocery shopping",
      "date": "2026-01-24T00:00:00.000Z",
      "paymentMethod": "cash",
      "createdAt": "2026-01-24T04:45:00.000Z"
    },
    {
      "_id": "67935def456789abc123",
      "type": "expense",
      "amount": 200,
      "category": "Transportation",
      "description": "Monthly gas",
      "date": "2026-01-24T00:00:00.000Z",
      "paymentMethod": "cash",
      "createdAt": "2026-01-24T04:46:00.000Z"
    }
  ],
  "pagination": {
    "total": 25,
    "page": 1,
    "limit": 10,
    "pages": 3
  }
}
```

---

### Get Single Transaction

**Endpoint:** `GET /api/transactions/:id`

**Authentication:** Required

**Request:**
```http
GET http://localhost:5001/api/transactions/67935abc123def456789
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "_id": "67935abc123def456789",
  "userId": "67933def456789abc123",
  "type": "expense",
  "amount": 150.5,
  "category": "Food & Dining",
  "description": "Grocery shopping",
  "date": "2026-01-24T00:00:00.000Z",
  "paymentMethod": "cash",
  "tags": ["groceries"],
  "createdAt": "2026-01-24T04:45:00.000Z"
}
```

**Error Response:** `404 Not Found`
```json
{
  "error": "Transaction not found"
}
```

---

### Update Transaction

**Endpoint:** `PUT /api/transactions/:id`

**Authentication:** Required

**Request:**
```http
PUT http://localhost:5001/api/transactions/67935abc123def456789
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 175.00,
  "description": "Updated grocery shopping"
}
```

**Response:** `200 OK`
```json
{
  "message": "Transaction updated successfully",
  "transaction": {
    "_id": "67935abc123def456789",
    "amount": 175,
    "description": "Updated grocery shopping",
    "updatedAt": "2026-01-24T05:00:00.000Z"
  }
}
```

**Important:** Updating amount or type automatically recalculates account balance!

---

### Delete Transaction

**Endpoint:** `DELETE /api/transactions/:id`

**Authentication:** Required

**Request:**
```http
DELETE http://localhost:5001/api/transactions/67935abc123def456789
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "message": "Transaction deleted successfully"
}
```

**Important:** Deleting a transaction automatically updates account balance!

---

## Budgets

### Create Budget

**Endpoint:** `POST /api/budgets`

**Authentication:** Required

**Request:**
```http
POST http://localhost:5001/api/budgets
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Monthly Food Budget",
  "category": "Food & Dining",
  "limitAmount": 2000,
  "period": "monthly",
  "startDate": "2026-01-01",
  "endDate": "2026-01-31",
  "alertThreshold": 80
}
```

**Request Body:**
| Field | Type | Required | Options/Notes |
|-------|------|----------|---------------|
| `name` | string | Yes | Budget name |
| `category` | string | Yes | Must match transaction category |
| `limitAmount` | number | Yes | Budget limit |
| `period` | string | No | `weekly`, `monthly`, `yearly` (default: monthly) |
| `startDate` | string | Yes | ISO date |
| `endDate` | string | Yes | ISO date |
| `alertThreshold` | number | No | Alert at X% (default: 80) |

**Response:** `201 Created`
```json
{
  "message": "Budget created successfully",
  "budget": {
    "_id": "67936abc123def456789",
    "userId": "67933def456789abc123",
    "name": "Monthly Food Budget",
    "category": "Food & Dining",
    "limitAmount": 2000,
    "spentAmount": 0,
    "period": "monthly",
    "startDate": "2026-01-01T00:00:00.000Z",
    "endDate": "2026-01-31T23:59:59.000Z",
    "isActive": true,
    "alertThreshold": 80,
    "remainingAmount": 2000,
    "percentageSpent": 0,
    "createdAt": "2026-01-24T05:10:00.000Z"
  }
}
```

---

### Get All Budgets

**Endpoint:** `GET /api/budgets`

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `isActive` | boolean | Filter by active status |

**Request:**
```http
GET http://localhost:5001/api/budgets?isActive=true
Authorization: Bearer <token>
```

**Response:** `200 OK`
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
      "isActive": true
    }
  ]
}
```

**Note:** `spentAmount` is auto-calculated from matching transactions!

---

### Get Single Budget

**Endpoint:** `GET /api/budgets/:id`

**Authentication:** Required

**Request:**
```http
GET http://localhost:5001/api/budgets/67936abc123def456789
Authorization: Bearer <token>
```

**Response:** `200 OK`

---

### Update Budget

**Endpoint:** `PUT /api/budgets/:id`

**Authentication:** Required

**Request:**
```http
PUT http://localhost:5001/api/budgets/67936abc123def456789
Authorization: Bearer <token>
Content-Type: application/json

{
  "limitAmount": 2500,
  "isActive": true
}
```

**Response:** `200 OK`
```json
{
  "message": "Budget updated successfully",
  "budget": {
    "_id": "67936abc123def456789",
    "limitAmount": 2500,
    "updatedAt": "2026-01-24T05:20:00.000Z"
  }
}
```

---

### Delete Budget

**Endpoint:** `DELETE /api/budgets/:id`

**Authentication:** Required

**Request:**
```http
DELETE http://localhost:5001/api/budgets/67936abc123def456789
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "message": "Budget deleted successfully"
}
```

---

## Savings Goals

### Create Savings Goal

**Endpoint:** `POST /api/savings`

**Authentication:** Required

**Request:**
```http
POST http://localhost:5001/api/savings
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Vacation Fund",
  "targetAmount": 5000,
  "deadline": "2026-07-01",
  "icon": "✈️",
  "priority": "high",
  "description": "Summer vacation to Europe"
}
```

**Request Body:**
| Field | Type | Required | Options/Notes |
|-------|------|----------|---------------|
| `name` | string | Yes | Goal name |
| `targetAmount` | number | Yes | Target amount |
| `deadline` | string | No | ISO date |
| `icon` | string | No | Emoji or string |
| `priority` | string | No | `high`, `medium`, `low` (default: medium) |
| `description` | string | No | Goal description |

**Response:** `201 Created`
```json
{
  "message": "Savings goal created successfully",
  "savingsGoal": {
    "_id": "67937abc123def456789",
    "userId": "67933def456789abc123",
    "name": "Vacation Fund",
    "targetAmount": 5000,
    "savedAmount": 0,
    "deadline": "2026-07-01T00:00:00.000Z",
    "icon": "✈️",
    "priority": "high",
    "isCompleted": false,
    "description": "Summer vacation to Europe",
    "remainingAmount": 5000,
    "progressPercentage": 0,
    "createdAt": "2026-01-24T05:30:00.000Z"
  }
}
```

---

### Get All Savings Goals

**Endpoint:** `GET /api/savings`

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `isCompleted` | boolean | Filter by completion status |

**Request:**
```http
GET http://localhost:5001/api/savings?isCompleted=false
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "savingsGoals": [
    {
      "_id": "67937abc123def456789",
      "name": "Vacation Fund",
      "targetAmount": 5000,
      "savedAmount": 1000,
      "remainingAmount": 4000,
      "progressPercentage": 20,
      "priority": "high",
      "isCompleted": false
    }
  ]
}
```

---

### Get Single Savings Goal

**Endpoint:** `GET /api/savings/:id`

**Authentication:** Required

**Request:**
```http
GET http://localhost:5001/api/savings/67937abc123def456789
Authorization: Bearer <token>
```

**Response:** `200 OK`

---

### Update Savings Goal

**Endpoint:** `PUT /api/savings/:id`

**Authentication:** Required

**Request:**
```http
PUT http://localhost:5001/api/savings/67937abc123def456789
Authorization: Bearer <token>
Content-Type: application/json

{
  "targetAmount": 6000,
  "deadline": "2026-08-01"
}
```

**Response:** `200 OK`
```json
{
  "message": "Savings goal updated successfully",
  "savingsGoal": {
    "_id": "67937abc123def456789",
    "targetAmount": 6000,
    "deadline": "2026-08-01T00:00:00.000Z"
  }
}
```

---

### Contribute to Savings Goal

**Endpoint:** `POST /api/savings/:id/contribute`

**Authentication:** Required

**Request:**
```http
POST http://localhost:5001/api/savings/67937abc123def456789/contribute
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 1000
}
```

**Request Body:**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `amount` | number | Yes | Must be > 0 |

**Response:** `200 OK`
```json
{
  "message": "Contribution added successfully",
  "savingsGoal": {
    "_id": "67937abc123def456789",
    "savedAmount": 1000,
    "targetAmount": 5000,
    "remainingAmount": 4000,
    "progressPercentage": 20,
    "isCompleted": false
  }
}
```

**Auto-complete:** Goal is automatically marked complete when savedAmount >= targetAmount!

---

### Delete Savings Goal

**Endpoint:** `DELETE /api/savings/:id`

**Authentication:** Required

**Request:**
```http
DELETE http://localhost:5001/api/savings/67937abc123def456789
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "message": "Savings goal deleted successfully"
}
```

---

## Debts

### Create Debt

**Endpoint:** `POST /api/debts`

**Authentication:** Required

**Request:**
```http
POST http://localhost:5001/api/debts
Authorization: Bearer <token>
Content-Type: application/json

{
  "creditorName": "Bank Loan",
  "totalAmount": 10000,
  "interestRate": 5.5,
  "dueDate": "2027-01-01",
  "description": "Car loan"
}
```

**Request Body:**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `creditorName` | string | Yes | Creditor/lender name |
| `totalAmount` | number | Yes | Total debt amount |
| `interestRate` | number | No | Interest rate % (default: 0) |
| `dueDate` | string | No | ISO date |
| `description` | string | No | Debt description |

**Response:** `201 Created`
```json
{
  "message": "Debt created successfully",
  "debt": {
    "_id": "67938abc123def456789",
    "userId": "67933def456789abc123",
    "creditorName": "Bank Loan",
    "totalAmount": 10000,
    "paidAmount": 0,
    "interestRate": 5.5,
    "dueDate": "2027-01-01T00:00:00.000Z",
    "status": "active",
    "description": "Car loan",
    "payments": [],
    "remainingAmount": 10000,
    "paymentProgress": 0,
    "createdAt": "2026-01-24T05:40:00.000Z"
  }
}
```

---

### Get All Debts

**Endpoint:** `GET /api/debts`

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status: `active`, `paid`, `overdue` |

**Request:**
```http
GET http://localhost:5001/api/debts?status=active
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "debts": [
    {
      "_id": "67938abc123def456789",
      "creditorName": "Bank Loan",
      "totalAmount": 10000,
      "paidAmount": 1000,
      "remainingAmount": 9000,
      "paymentProgress": 10,
      "status": "active",
      "dueDate": "2027-01-01T00:00:00.000Z"
    }
  ]
}
```

---

### Get Single Debt

**Endpoint:** `GET /api/debts/:id`

**Authentication:** Required

**Request:**
```http
GET http://localhost:5001/api/debts/67938abc123def456789
Authorization: Bearer <token>
```

**Response:** `200 OK`

---

### Update Debt

**Endpoint:** `PUT /api/debts/:id`

**Authentication:** Required

**Request:**
```http
PUT http://localhost:5001/api/debts/67938abc123def456789
Authorization: Bearer <token>
Content-Type: application/json

{
  "interestRate": 4.5,
  "description": "Updated car loan"
}
```

**Response:** `200 OK`

---

### Record Payment

**Endpoint:** `POST /api/debts/:id/payment`

**Authentication:** Required

**Request:**
```http
POST http://localhost:5001/api/debts/67938abc123def456789/payment
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 1000,
  "notes": "Monthly payment"
}
```

**Request Body:**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `amount` | number | Yes | Payment amount, must be > 0 |
| `notes` | string | No | Payment notes |

**Response:** `200 OK`
```json
{
  "message": "Payment recorded successfully",
  "debt": {
    "_id": "67938abc123def456789",
    "paidAmount": 1000,
    "remainingAmount": 9000,
    "paymentProgress": 10,
    "status": "active",
    "payments": [
      {
        "amount": 1000,
        "date": "2026-01-24T05:50:00.000Z",
        "notes": "Monthly payment"
      }
    ]
  }
}
```

**Auto-update:** Status changes to `paid` when paidAmount >= totalAmount!

---

### Delete Debt

**Endpoint:** `DELETE /api/debts/:id`

**Authentication:** Required

**Request:**
```http
DELETE http://localhost:5001/api/debts/67938abc123def456789
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "message": "Debt deleted successfully"
}
```

---

## Analytics

### Get Overview

**Endpoint:** `GET /api/analytics/overview`

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Description | Options |
|-----------|------|-------------|---------|
| `period` | string | Time period | `weekly`, `monthly`, `yearly` (default: monthly) |

**Request:**
```http
GET http://localhost:5001/api/analytics/overview?period=monthly
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "period": "monthly",
  "dateRange": {
    "startDate": "2026-01-01T00:00:00.000Z",
    "endDate": "2026-01-31T23:59:59.000Z"
  },
  "summary": {
    "totalIncome": 8500,
    "totalExpense": 650.5,
    "netSavings": 7849.5,
    "savingsRate": 92.36,
    "transactionCount": 4
  }
}
```

**Fields:**
- `totalIncome`: Sum of all income in period
- `totalExpense`: Sum of all expenses in period
- `netSavings`: income - expense
- `savingsRate`: (netSavings / income) * 100
- `transactionCount`: Total number of transactions

---

### Get Category Breakdown

**Endpoint:** `GET /api/analytics/categories`

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Description | Options |
|-----------|------|-------------|---------|
| `type` | string | Transaction type | `income` or `expense` (default: expense) |
| `period` | string | Time period | `weekly`, `monthly`, `yearly` (default: monthly) |

**Request:**
```http
GET http://localhost:5001/api/analytics/categories?type=expense&period=monthly
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "type": "expense",
  "period": "monthly",
  "dateRange": {
    "startDate": "2026-01-01T00:00:00.000Z",
    "endDate": "2026-01-31T23:59:59.000Z"
  },
  "totalAmount": 650.5,
  "breakdown": [
    {
      "category": "Entertainment",
      "amount": 300,
      "count": 1,
      "percentage": 46.11
    },
    {
      "category": "Transportation",
      "amount": 200,
      "count": 1,
      "percentage": 30.74
    },
    {
      "category": "Food & Dining",
      "amount": 150.5,
      "count": 1,
      "percentage": 23.14
    }
  ]
}
```

**Notes:**
- Results are sorted by amount (highest first)
- Percentages are calculated from totalAmount

---

### Get Trends

**Endpoint:** `GET /api/analytics/trends`

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `months` | number | Number of months | 6 |

**Request:**
```http
GET http://localhost:5001/api/analytics/trends?months=6
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "trends": [
    {
      "month": "Aug 2025",
      "income": 8000,
      "expense": 5500,
      "net": 2500
    },
    {
      "month": "Sep 2025",
      "income": 8200,
      "expense": 5800,
      "net": 2400
    },
    {
      "month": "Oct 2025",
      "income": 8500,
      "expense": 6000,
      "net": 2500
    },
    {
      "month": "Nov 2025",
      "income": 8300,
      "expense": 5700,
      "net": 2600
    },
    {
      "month": "Dec 2025",
      "income": 9000,
      "expense": 6500,
      "net": 2500
    },
    {
      "month": "Jan 2026",
      "income": 8500,
      "expense": 650.5,
      "net": 7849.5
    }
  ]
}
```

**Use Case:** Perfect for charts/graphs showing financial trends over time!

---

## Offers

### Get Offers

**Endpoint:** `GET /api/offers`

**Authentication:** Required

**Request:**
```http
GET http://localhost:5001/api/offers
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "offers": [
    {
      "_id": "67939abc123def456789",
      "title": "20% Off on Electronics",
      "description": "Get 20% discount on all electronics this month",
      "category": "Shopping",
      "discountPercentage": 20,
      "imageUrl": "https://example.com/offer.jpg",
      "validFrom": "2026-01-01T00:00:00.000Z",
      "validUntil": "2026-01-31T23:59:59.000Z",
      "merchantName": "Tech Store",
      "merchantUrl": "https://techstore.com",
      "isActive": true,
      "isValid": true
    }
  ],
  "count": 1
}
```

**Notes:**
- Only returns active and currently valid offers
- `isValid` is a virtual field checking current date against validFrom/validUntil

---

### Create Offer (Admin)

**Endpoint:** `POST /api/offers`

**Authentication:** Required

**Request:**
```http
POST http://localhost:5001/api/offers
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "20% Off on Electronics",
  "description": "Get 20% discount on all electronics this month",
  "category": "Shopping",
  "discountPercentage": 20,
  "imageUrl": "https://example.com/offer.jpg",
  "validUntil": "2026-01-31",
  "targetUsers": ["all"],
  "merchantName": "Tech Store",
  "merchantUrl": "https://techstore.com"
}
```

**Request Body:**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `title` | string | Yes | Offer title |
| `description` | string | Yes | Offer description |
| `category` | string | Yes | Offer category |
| `discountPercentage` | number | No | Discount % (0-100) |
| `discountAmount` | number | No | Fixed discount amount |
| `imageUrl` | string | No | Offer image URL |
| `validUntil` | string | Yes | ISO date |
| `targetUsers` | array | No | User categories, default: ["all"] |
| `merchantName` | string | No | Merchant name |
| `merchantUrl` | string | No | Merchant website |

**Response:** `201 Created`
```json
{
  "message": "Offer created successfully",
  "offer": {
    "_id": "67939abc123def456789",
    "title": "20% Off on Electronics",
    "discountPercentage": 20,
    "validUntil": "2026-01-31T00:00:00.000Z",
    "isActive": true
  }
}
```

---

## Error Responses

### Common Error Codes

**401 Unauthorized**
```json
{
  "error": "Access denied. No token provided."
}
```

**401 Unauthorized (Expired Token)**
```json
{
  "error": "Token expired. Please login again."
}
```

**401 Unauthorized (Invalid Token)**
```json
{
  "error": "Invalid token."
}
```

**404 Not Found**
```json
{
  "error": "Resource not found"
}
```

**400 Bad Request**
```json
{
  "error": "Validation Error",
  "details": [
    "Type, amount, and category are required"
  ]
}
```

**400 Bad Request (Invalid ID)**
```json
{
  "error": "Invalid ID format"
}
```

**500 Internal Server Error**
```json
{
  "error": "Internal server error"
}
```

---

## Rate Limiting

Currently, there is no rate limiting implemented. This may be added in future versions.

---

## Data Validation

All endpoints perform validation:
- Required fields are checked
- Number fields must be valid numbers
- Enum fields must match allowed values
- Dates must be valid ISO 8601 format
- IDs must be valid MongoDB ObjectIds

---

## Best Practices

1. **Always include Authorization header** (except health check)
2. **Store JWT token securely** on the client side
3. **Handle token expiration** gracefully
4. **Use pagination** for large datasets
5. **Validate data** before sending requests
6. **Handle errors** appropriately in your app

---

## Quick Reference

### Transaction Categories
**Expense:** Food & Dining, Shopping, Transportation, Bills & Utilities, Entertainment, Healthcare, Education, Travel, Personal Care, Other Expense

**Income:** Salary, Freelance, Business, Investment, Gift, Other Income

### Payment Methods
cash, credit_card, debit_card, bank_transfer, mobile_wallet, other

### Budget Periods
weekly, monthly, yearly

### Savings Priorities
high, medium, low

### Debt Statuses
active, paid, overdue

### Currencies
USD, EUR, GBP, EGP, SAR, AED

---

## Testing

See `TESTING_GUIDE.md` for complete testing instructions.

Quick test with PowerShell:
```powershell
.\test-api.ps1
```

---

## Settings

### Get All Settings

**Endpoint:** `GET /api/settings`

**Authentication:** Required

**Request:**
```http
GET http://localhost:5001/api/settings
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "currency": "USD",
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

**Endpoint:** `PUT /api/settings/theme`

**Authentication:** Required

**Request:**
```http
PUT http://localhost:5001/api/settings/theme
Authorization: Bearer <token>
Content-Type: application/json

{
  "theme": "dark"
}
```

**Request Body:**
| Field | Type | Required | Options |
|-------|------|----------|---------|
| `theme` | string | Yes | `light`, `dark`, `auto` |

**Response:** `200 OK`
```json
{
  "message": "Theme updated successfully",
  "theme": "dark"
}
```

---

### Update Currency

**Endpoint:** `PUT /api/settings/currency`

**Authentication:** Required

**Request:**
```http
PUT http://localhost:5001/api/settings/currency
Authorization: Bearer <token>
Content-Type: application/json

{
  "currency": "EGP"
}
```

**Request Body:**
| Field | Type | Required | Options |
|-------|------|----------|---------|
| `currency` | string | Yes | USD, EUR, GBP, EGP, SAR, AED, JPY, AUD, CAD, CHF |

**Response:** `200 OK`
```json
{
  "message": "Currency updated successfully",
  "currency": "EGP"
}
```

---

### Update Date Format

**Endpoint:** `PUT /api/settings/date-format`

**Authentication:** Required

**Request:**
```http
PUT http://localhost:5001/api/settings/date-format
Authorization: Bearer <token>
Content-Type: application/json

{
  "dateFormat": "DD/MM/YYYY"
}
```

**Request Body:**
| Field | Type | Required | Options |
|-------|------|----------|---------|
| `dateFormat` | string | Yes | `MM/DD/YYYY`, `DD/MM/YYYY`, `YYYY-MM-DD` |

**Response:** `200 OK`
```json
{
  "message": "Date format updated successfully",
  "dateFormat": "DD/MM/YYYY"
}
```

---

### Toggle Biometric

**Endpoint:** `PUT /api/settings/biometric`

**Authentication:** Required

**Request:**
```http
PUT http://localhost:5001/api/settings/biometric
Authorization: Bearer <token>
Content-Type: application/json

{
  "enabled": true
}
```

**Request Body:**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `enabled` | boolean | Yes | Enable or disable biometric |

**Response:** `200 OK`
```json
{
  "message": "Biometric enabled successfully",
  "biometricEnabled": true
}
```

---

### Update Notification Preferences

**Endpoint:** `PUT /api/settings/notifications`

**Authentication:** Required

**Request:**
```http
PUT http://localhost:5001/api/settings/notifications
Authorization: Bearer <token>
Content-Type: application/json

{
  "budgetAlerts": true,
  "goalReminders": false,
  "billReminders": true,
  "savingsTips": true,
  "monthlyReports": false
}
```

**Request Body:** (all fields optional, send only what you want to update)
| Field | Type | Required |
|-------|------|----------|
| `budgetAlerts` | boolean | No |
| `goalReminders` | boolean | No |
| `billReminders` | boolean | No |
| `savingsTips` | boolean | No |
| `monthlyReports` | boolean | No |

**Response:** `200 OK`
```json
{
  "message": "Notification preferences updated successfully",
  "notifications": {
    "budgetAlerts": true,
    "goalReminders": false,
    "billReminders": true,
    "savingsTips": true,
    "monthlyReports": false
  }
}
```

---

### Backup Data

**Endpoint:** `POST /api/settings/backup`

**Authentication:** Required

**Request:**
```http
POST http://localhost:5001/api/settings/backup
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "message": "Data backup created successfully",
  "backup": {
    "version": "1.0",
    "timestamp": "2026-02-08T00:53:00.000Z",
    "data": {
      "profile": {...},
      "accounts": [...],
      "transactions": [...],
      "budgets": [...],
      "savingsGoals": [...],
      "debts": [...]
    }
  }
}
```

---

### Restore Data

**Endpoint:** `POST /api/settings/restore`

**Authentication:** Required

**Request:**
```http
POST http://localhost:5001/api/settings/restore
Authorization: Bearer <token>
Content-Type: application/json

{
  "backup": {
    "version": "1.0",
    "timestamp": "2026-02-08T00:53:00.000Z",
    "data": {
      ...backup data...
    }
  }
}
```

**Response:** `200 OK`
```json
{
  "message": "Data restored successfully"
}
```

**⚠️ Warning:** This will delete all existing data and replace it with the backup!

---

### Clear All Data

**Endpoint:** `POST /api/settings/clear-all`

**Authentication:** Required

**Request:**
```http
POST http://localhost:5001/api/settings/clear-all
Authorization: Bearer <token>
Content-Type: application/json

{
  "confirmation": "DELETE_ALL_DATA"
}
```

**Request Body:**
| Field | Type | Required | Value |
|-------|------|----------|-------|
| `confirmation` | string | Yes | Must be exactly "DELETE_ALL_DATA" |

**Response:** `200 OK`
```json
{
  "message": "All data cleared successfully"
}
```

**⚠️ Warning:** This permanently deletes all user data!

---

### Get App Info

** Endpoint:** `GET /api/settings/app-info`

**Authentication:** Required

**Request:**
```http
GET http://localhost:5001/api/settings/app-info
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "appName": "Budget App",
  "version": "1.0.0",
  "build": "100",
  "developer": "Your Company Name",
  "contact": "support@budgetapp.com",
  "website": "https://budgetapp.com",
  "releaseDate": "2024-01-01"
}
```

---

## Help & Support

### Get All Help Articles

**Endpoint:** `GET /api/help`

**Authentication:** Required

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | string | Filter by category |
| `search` | string | Search in title, content, and tags |

**Request:**
```http
GET http://localhost:5001/api/help?category=budgets
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "total": 5,
  "articles": [
    {
      "_id": "67939abc123def456789",
      "category": "budgets",
      "title": "How to create a budget",
      "content": "Creating a budget helps you...",
      "order": 1,
      "tags": ["budget", "getting-started"],
      "videoUrl": "",
      "isActive": true
    }
  ]
}
```

**Categories:**
- getting_started
- accounts
- transactions
- budgets
- savings
- debts
- analytics
- settings
- security
- faq

---

### Get Help by Category

**Endpoint:** `GET /api/help/category/:category`

**Authentication:** Required

**Request:**
```http
GET http://localhost:5001/api/help/category/budgets
Authorization: Bearer <token>
```

**Response:** `200 OK`

---

### Get FAQ

**Endpoint:** `GET /api/help/faq`

**Authentication:** Required

**Request:**
```http
GET http://localhost:5001/api/help/faq
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "total": 10,
  "faqs": [...]
}
```

---

### Get Single Help Article

**Endpoint:** `GET /api/help/:id`

**Authentication:** Required

**Request:**
```http
GET http://localhost:5001/api/help/67939abc123def456789
Authorization: Bearer <token>
```

**Response:** `200 OK`

---

### Contact Support

**Endpoint:** `POST /api/help/contact`

**Authentication:** Required

**Request:**
```http
POST http://localhost:5001/api/help/contact
Authorization: Bearer <token>
Content-Type: application/json

{
  "subject": "Issue with budget tracking",
  "message": "I'm having trouble creating a budget..."
}
```

**Request Body:**
| Field | Type | Required |
|-------|------|----------|
| `subject` | string | Yes |
| `message` | string | Yes |

**Response:** `200 OK`
```json
{
  "message": "Your message has been sent to support. We will get back to you soon."
}
```

---

## Auth Backend - Security API

**Base URL:** `http://localhost:3210`

### Change Password

**Endpoint:** `POST /api/security/change-password`

**Authentication:** Required

**Request:**
```http
POST http://localhost:3210/api/security/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "oldpass123",
  "newPassword": "newpass456"
}
```

**Request Body:**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `currentPassword` | string | Yes | Current password |
| `newPassword` | string | Yes | Must be at least 6 characters |

**Response:** `200 OK`
```json
{
  "message": "Password changed successfully"
}
```

**Error Response:** `401 Unauthorized`
```json
{
  "error": "Current password is incorrect"
}
```

---

### Setup 2FA

**Endpoint:** `POST /api/security/2fa/setup`

**Authentication:** Required

**Request:**
```http
POST http://localhost:3210/api/security/2fa/setup
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "message": "2FA setup initiated. Scan QR code and verify to enable.",
  "qrCode": "data:image/png;base64,...",
  "secret": "JBSWY3DPEHPK3PXP",
  "backupCodes": [
    "A1B2C3D4",
    "E5F6G7H8",
    ...
  ]
}
```

**Important:** Save the backup codes in a safe place!

---

### Verify and Enable 2FA

**Endpoint:** `POST /api/security/2fa/verify`

**Authentication:** Required

**Request:**
```http
POST http://localhost:3210/api/security/2fa/verify
Authorization: Bearer <token>
Content-Type: application/json

{
  "token": "123456"
}
```

**Request Body:**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `token` | string | Yes | 6-digit code from authenticator app |

**Response:** `200 OK`
```json
{
  "message": "2FA enabled successfully",
  "backupCodes": ["A1B2C3D4", "E5F6G7H8", ...]
}
```

---

### Disable 2FA

**Endpoint:** `POST /api/security/2fa/disable`

**Authentication:** Required

**Request:**
```http
POST http://localhost:3210/api/security/2fa/disable
Authorization: Bearer <token>
Content-Type: application/json

{
  "password": "yourpassword",
  "token": "123456"
}
```

**Request Body:**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `password` | string | Yes | Your account password |
| `token` | string | No | 2FA code (optional) |

**Response:** `200 OK`
```json
{
  "message": "2FA disabled successfully"
}
```

---

### Get 2FA Status

**Endpoint:** `GET /api/security/2fa/status`

**Authentication:** Required

**Request:**
```http
GET http://localhost:3210/api/security/2fa/status
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "enabled": true,
  "method": "totp",
  "verifiedAt": "2026-02-08T00:30:00.000Z"
}
```

---

### List Devices

**Endpoint:** `GET /api/security/devices`

**Authentication:** Required

**Request:**
```http
GET http://localhost:3210/api/security/devices
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "devices": [
    {
      "_id": "6793aabc123def456789",
      "deviceId": "device_abc123",
      "deviceName": "iPhone 14",
      "deviceType": "mobile",
      "platform": "iOS",
      "browser": "Safari",
      "ipAddress": "192.168.1.100",
      "location": {
        "city": "Cairo",
        "country": "Egypt"
      },
      "lastActive": "2026-02-08T00:50:00.000Z",
      "isTrusted": true,
      "createdAt": "2026-02-01T10:00:00.000Z"
    }
  ],
  "total": 1
}
```

---

### Remove Device

**Endpoint:** `DELETE /api/security/devices/:deviceId`

**Authentication:** Required

**Request:**
```http
DELETE http://localhost:3210/api/security/devices/device_abc123
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "message": "Device removed successfully"
}
```

---

### Trust Device

**Endpoint:** `PUT /api/security/devices/:deviceId/trust`

**Authentication:** Required

**Request:**
```http
PUT http://localhost:3210/api/security/devices/device_abc123/trust
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "message": "Device trusted successfully",
  "device": {
    "_id": "6793aabc123def456789",
    "deviceId": "device_abc123",
    "isTrusted": true
  }
}
```

---

## Support

For issues or questions:
- Check server logs: `home-backend/logs/` or `auth-backend/logs/`
- Health check: `GET /health`
- Verify JWT token is valid

---

**Last Updated:** February 8, 2026
**API Version:** 1.1.0 (Phase 2)
