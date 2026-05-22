# Complete User Signup and Testing Guide

## Step-by-Step: Create New User and Test Home Backend

---

## 📝 Step 1: Signup New User (Auth-Backend)

**Endpoint:** `POST http://localhost:3210/api/auth/signup`

**Request Body:**
```json
{
  "email": "testuser@example.com",
  "password": "Test123456",
  "phone": "+201234567890"
}
```

**Expected Response:**
```json
{
  "message": "User registered successfully. Please verify your email.",
  "user": {
    "id": "...",
    "email": "testuser@example.com"
  }
}
```

---

## 📧 Step 2: Check Email Verification (Optional)

If email verification is required, check your email or skip this step for testing.

For testing purposes, you might want to manually verify the user in MongoDB or check if your auth-backend allows login without verification.

---

## 🔐 Step 3: Login (Get JWT Token)

**Endpoint:** `POST http://localhost:3210/api/auth/login`

**Request Body:**
```json
{
  "email": "testuser@example.com",
  "password": "Test123456"
}
```

**Expected Response:**
```json
{
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "...",
  "user": {
    "id": "...",
    "email": "testuser@example.com"
  }
}
```

**⚠️ IMPORTANT:** Copy the `accessToken` - you'll need it for all home-backend requests!

---

## 🏠 Step 4: Test Home Backend Dashboard

**Endpoint:** `GET http://localhost:5001/api/dashboard`

**Headers:**
```
Authorization: Bearer <paste-your-accessToken-here>
```

**Expected Response (First Time User):**
```json
{
  "user": {
    "name": "User",
    "photo": "",
    "currency": "USD"
  },
  "balance": {
    "total": 0,
    "income": 0,
    "expense": 0,
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

**✅ What Happens:** 
- Home-backend automatically creates a UserProfile and Account for the new user
- Initial balance is 0
- Ready to start adding transactions!

---

## 💰 Step 5: Update User Profile

**Endpoint:** `PUT http://localhost:5001/api/profile`

**Headers:**
```
Authorization: Bearer <your-token>
```

**Request Body:**
```json
{
  "displayName": "Mohamed Yaser",
  "currency": "EGP",
  "profilePhoto": "https://example.com/photo.jpg"
}
```

**Expected Response:**
```json
{
  "message": "Profile updated successfully",
  "profile": {
    "_id": "...",
    "userId": "...",
    "displayName": "Mohamed Yaser",
    "profilePhoto": "https://example.com/photo.jpg",
    "currency": "EGP"
  }
}
```

---

## 📊 Step 6: Add First Income Transaction

**Endpoint:** `POST http://localhost:5001/api/transactions`

**Headers:**
```
Authorization: Bearer <your-token>
```

**Request Body:**
```json
{
  "type": "income",
  "amount": 8500.00,
  "category": "Salary",
  "description": "January salary",
  "paymentMethod": "bank_transfer",
  "date": "2026-01-24"
}
```

**Expected Response:**
```json
{
  "message": "Transaction created successfully",
  "transaction": {
    "_id": "...",
    "userId": "...",
    "type": "income",
    "amount": 8500,
    "category": "Salary",
    "description": "January salary",
    "date": "2026-01-24T...",
    "paymentMethod": "bank_transfer"
  },
  "newBalance": 8500
}
```

---

## 🛒 Step 7: Add Expense Transactions

**Endpoint:** `POST http://localhost:5001/api/transactions`

**Example 1 - Food:**
```json
{
  "type": "expense",
  "amount": 150.50,
  "category": "Food & Dining",
  "description": "Grocery shopping",
  "paymentMethod": "cash"
}
```

**Example 2 - Transportation:**
```json
{
  "type": "expense",
  "amount": 200.00,
  "category": "Transportation",
  "description": "Monthly gas",
  "paymentMethod": "credit_card"
}
```

**Example 3 - Entertainment:**
```json
{
  "type": "expense",
  "amount": 300.00,
  "category": "Entertainment",
  "description": "Movie tickets and dinner",
  "paymentMethod": "debit_card"
}
```

---

## 📈 Step 8: Check Updated Dashboard

**Endpoint:** `GET http://localhost:5001/api/dashboard`

**Headers:**
```
Authorization: Bearer <your-token>
```

**Expected Response:**
```json
{
  "user": {
    "name": "Mohamed Yaser",
    "photo": "https://example.com/photo.jpg",
    "currency": "EGP"
  },
  "balance": {
    "total": 7849.5,
    "income": 8500,
    "expense": 650.5,
    "period": "This Month"
  },
  "quickActions": [...]
}
```

**✅ Calculation:**
- Income: 8500.00
- Expenses: 150.50 + 200.00 + 300.00 = 650.50
- Balance: 8500.00 - 650.50 = **7849.50** ✓

---

## 🎯 Step 9: Create a Budget

**Endpoint:** `POST http://localhost:5001/api/budgets`

**Headers:**
```
Authorization: Bearer <your-token>
```

**Request Body:**
```json
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

**Expected Response:**
```json
{
  "message": "Budget created successfully",
  "budget": {
    "_id": "...",
    "userId": "...",
    "name": "Monthly Food Budget",
    "category": "Food & Dining",
    "limitAmount": 2000,
    "spentAmount": 0,
    "period": "monthly",
    "isActive": true,
    "remainingAmount": 2000,
    "percentageSpent": 0
  }
}
```

---

## 💎 Step 10: Create a Savings Goal

**Endpoint:** `POST http://localhost:5001/api/savings`

**Headers:**
```
Authorization: Bearer <your-token>
```

**Request Body:**
```json
{
  "name": "Vacation Fund",
  "targetAmount": 5000,
  "deadline": "2026-07-01",
  "icon": "✈️",
  "priority": "high",
  "description": "Summer vacation to Europe"
}
```

**Expected Response:**
```json
{
  "message": "Savings goal created successfully",
  "savingsGoal": {
    "_id": "...",
    "name": "Vacation Fund",
    "targetAmount": 5000,
    "savedAmount": 0,
    "deadline": "2026-07-01T...",
    "icon": "✈️",
    "priority": "high",
    "isCompleted": false,
    "remainingAmount": 5000,
    "progressPercentage": 0
  }
}
```

---

## 💰 Step 11: Contribute to Savings Goal

**Endpoint:** `POST http://localhost:5001/api/savings/:id/contribute`

**Headers:**
```
Authorization: Bearer <your-token>
```

**Request Body:**
```json
{
  "amount": 1000
}
```

**Expected Response:**
```json
{
  "message": "Contribution added successfully",
  "savingsGoal": {
    "savedAmount": 1000,
    "targetAmount": 5000,
    "progressPercentage": 20,
    "remainingAmount": 4000
  }
}
```

---

## 📊 Step 12: View Analytics

### Overview
**Endpoint:** `GET http://localhost:5001/api/analytics/overview?period=monthly`

**Expected Response:**
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

### Category Breakdown
**Endpoint:** `GET http://localhost:5001/api/analytics/categories?type=expense&period=monthly`

**Expected Response:**
```json
{
  "type": "expense",
  "period": "monthly",
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

---

## 🎉 Complete Testing Checklist

Use this checklist to verify everything works:

- [ ] ✅ User signup successful
- [ ] ✅ User login successful (JWT received)
- [ ] ✅ Dashboard loads with default data
- [ ] ✅ Profile updated successfully
- [ ] ✅ Income transaction created, balance updated
- [ ] ✅ Multiple expense transactions created
- [ ] ✅ Dashboard shows correct calculations
- [ ] ✅ Budget created successfully
- [ ] ✅ Savings goal created
- [ ] ✅ Contribution to savings goal works
- [ ] ✅ Analytics overview displays correctly
- [ ] ✅ Category breakdown accurate

---

## 🔧 Thunder Client Quick Setup

Create a new collection "Home Backend Tests" with these requests:

1. **Auth - Signup** → POST http://localhost:3210/api/auth/signup
2. **Auth - Login** → POST http://localhost:3210/api/auth/login
3. **Dashboard** → GET http://localhost:5001/api/dashboard
4. **Profile - Update** → PUT http://localhost:5001/api/profile
5. **Transaction - Income** → POST http://localhost:5001/api/transactions
6. **Transaction - Expense** → POST http://localhost:5001/api/transactions
7. **Transactions - List** → GET http://localhost:5001/api/transactions
8. **Budget - Create** → POST http://localhost:5001/api/budgets
9. **Savings - Create** → POST http://localhost:5001/api/savings
10. **Savings - Contribute** → POST http://localhost:5001/api/savings/:id/contribute
11. **Analytics - Overview** → GET http://localhost:5001/api/analytics/overview
12. **Analytics - Categories** → GET http://localhost:5001/api/analytics/categories

**Pro Tip:** Save the JWT token in Thunder Client environment variables for easier testing!

---

## 🚀 You're All Set!

Your complete budgeting backend is working with:
- ✅ Auth-backend (port 3210) - User authentication
- ✅ Home-backend (port 5001) - All budgeting features
- ✅ Shared MongoDB database
- ✅ Integrated JWT authentication

Ready to build the frontend! 🎨
