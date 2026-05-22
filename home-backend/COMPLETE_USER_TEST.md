# 🧪 Complete New User Testing - Step by Step

This guide will walk you through testing the entire system as a brand new user.

---

## ✅ Prerequisites

Make sure both servers are running:

**Terminal 1 - Auth Backend:**
```bash
cd d:/Visual_StudioCode/GitHub/auth-backend
npm run dev
# Should show: Server running on port 3210
```

**Terminal 2 - Home Backend:**
```bash
cd d:/Visual_StudioCode/GitHub/home-backend
npm run dev
# Should show: 🚀 Home Backend Server running on port 5001
```

---

## 📝 Step-by-Step Manual Testing

### **Step 1: Signup New User**

Open a new terminal and run:

```powershell
$response = Invoke-RestMethod -Uri "http://localhost:3210/api/auth/signup" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"email":"testuser@example.com","password":"Test123456","phone":"+201234567890"}'

$response | ConvertTo-Json
```

**Expected Output:**
```json
{
  "message": "User registered successfully...",
  "user": {
    "id": "...",
    "email": "testuser@example.com"
  }
}
```

---

### **Step 2: Login** 

```powershell
$loginResponse = Invoke-RestMethod -Uri "http://localhost:3210/api/auth/login" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"email":"testuser@example.com","password":"Test123456"}'

# Save the token
$token = $loginResponse.accessToken

Write-Host "Token received: $($token.Substring(0,50))..."
```

**Expected Output:**
```json
{
  "message": "Login successful",
  "accessToken": "eyJhbGc...",
  "user": { ... }
}
```

**✅ Save this token - you'll use it for all next requests!**

---

### **Step 3: View Dashboard (First Time)**

```powershell
$headers = @{ "Authorization" = "Bearer $token" }

$dashboard = Invoke-RestMethod -Uri "http://localhost:5001/api/dashboard" `
  -Method Get `
  -Headers $headers

$dashboard | ConvertTo-Json -Depth 5
```

**Expected Output:**
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
  "quickActions": [...]
}
```

**✅ Notice:** Balance is 0, name is "User" (default)

---

### **Step 4: Update Profile**

```powershell
$profileUpdate = Invoke-RestMethod -Uri "http://localhost:5001/api/profile" `
  -Method Put `
  -Headers $headers `
  -ContentType "application/json" `
  -Body '{"displayName":"Mohamed Yaser","currency":"EGP","profilePhoto":"https://i.pravatar.cc/150?img=12"}'

$profileUpdate | ConvertTo-Json
```

**Expected Output:**
```json
{
  "message": "Profile updated successfully",
  "profile": {
    "displayName": "Mohamed Yaser",
    "currency": "EGP",
    "profilePhoto": "..."
  }
}
```

---

### **Step 5: Add Income Transaction**

```powershell
$income = Invoke-RestMethod -Uri "http://localhost:5001/api/transactions" `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body '{"type":"income","amount":8500,"category":"Salary","description":"January salary","paymentMethod":"bank_transfer"}'

$income | ConvertTo-Json
```

**Expected Output:**
```json
{
  "message": "Transaction created successfully",
  "transaction": {
    "type": "income",
    "amount": 8500,
    "category": "Salary",
    ...
  },
  "newBalance": 8500
}
```

**✅ Notice:** Balance is now 8500!

---

### **Step 6: Add Expense Transactions**

```powershell
# Expense 1 - Groceries
$expense1 = Invoke-RestMethod -Uri "http://localhost:5001/api/transactions" `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body '{"type":"expense","amount":150.50,"category":"Food & Dining","description":"Grocery shopping"}'

Write-Host "Expense 1: EGP 150.50 - New Balance: $($expense1.newBalance)"

# Expense 2 - Transportation
$expense2 = Invoke-RestMethod -Uri "http://localhost:5001/api/transactions" `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body '{"type":"expense","amount":200,"category":"Transportation","description":"Monthly gas"}'

Write-Host "Expense 2: EGP 200 - New Balance: $($expense2.newBalance)"

# Expense 3 - Entertainment
$expense3 = Invoke-RestMethod -Uri "http://localhost:5001/api/transactions" `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body '{"type":"expense","amount":300,"category":"Entertainment","description":"Movie and dinner"}'

Write-Host "Expense 3: EGP 300 - New Balance: $($expense3.newBalance)"
```

**Expected Final Balance:** 8500 - 150.50 - 200 - 300 = **7849.50 EGP**

---

### **Step 7: View Updated Dashboard**

```powershell
$dashboardUpdated = Invoke-RestMethod -Uri "http://localhost:5001/api/dashboard" `
  -Method Get `
  -Headers $headers

Write-Host "`n=== UPDATED DASHBOARD ===" -ForegroundColor Cyan
Write-Host "User: $($dashboardUpdated.user.name)" -ForegroundColor Green
Write-Host "Total Balance: EGP $($dashboardUpdated.balance.total)" -ForegroundColor Cyan
Write-Host "Income (This Month): EGP $($dashboardUpdated.balance.income)" -ForegroundColor Green
Write-Host "Expense (This Month): EGP $($dashboardUpdated.balance.expense)" -ForegroundColor Red
```

**Expected Output:**
```
User: Mohamed Yaser
Total Balance: EGP 7849.5
Income (This Month): EGP 8500
Expense (This Month): EGP 650.5
```

---

### **Step 8: Get All Transactions**

```powershell
$transactions = Invoke-RestMethod -Uri "http://localhost:5001/api/transactions" `
  -Method Get `
  -Headers $headers

Write-Host "`nTotal Transactions: $($transactions.transactions.Count)"
$transactions.transactions | ForEach-Object {
    Write-Host "$($_.type) - EGP $($_.amount) - $($_.category) - $($_.description)"
}
```

---

### **Step 9: Create Budget**

```powershell
$budget = Invoke-RestMethod -Uri "http://localhost:5001/api/budgets" `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body '{"name":"Monthly Food Budget","category":"Food & Dining","limitAmount":2000,"period":"monthly","startDate":"2026-01-01","endDate":"2026-01-31"}'

Write-Host "`n=== BUDGET CREATED ===" -ForegroundColor Yellow
Write-Host "Name: $($budget.budget.name)"
Write-Host "Limit: EGP $($budget.budget.limitAmount)"
Write-Host "Spent: EGP $($budget.budget.spentAmount)"
```

---

### **Step 10: Create Savings Goal**

```powershell
$savings = Invoke-RestMethod -Uri "http://localhost:5001/api/savings" `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body '{"name":"Vacation Fund","targetAmount":5000,"deadline":"2026-07-01","icon":"✈️","priority":"high","description":"Summer vacation to Europe"}'

Write-Host "`n=== SAVINGS GOAL CREATED ===" -ForegroundColor Yellow
Write-Host "Name: $($savings.savingsGoal.name)"
Write-Host "Target: EGP $($savings.savingsGoal.targetAmount)"
Write-Host "Saved: EGP $($savings.savingsGoal.savedAmount)"
Write-Host "Progress: $($savings.savingsGoal.progressPercentage)%"
```

---

### **Step 11: Contribute to Savings**

```powershell
$savingsId = $savings.savingsGoal._id

$contribution = Invoke-RestMethod -Uri "http://localhost:5001/api/savings/$savingsId/contribute" `
  -Method Post `
  -Headers $headers `
  -ContentType "application/json" `
  -Body '{"amount":1000}'

Write-Host "`n=== CONTRIBUTION ADDED ===" -ForegroundColor Green
Write-Host "New Saved Amount: EGP $($contribution.savingsGoal.savedAmount)"
Write-Host "Progress: $($contribution.savingsGoal.progressPercentage)%"
```

---

### **Step 12: View Analytics Overview**

```powershell
$analytics = Invoke-RestMethod -Uri "http://localhost:5001/api/analytics/overview?period=monthly" `
  -Method Get `
  -Headers $headers

Write-Host "`n=== ANALYTICS OVERVIEW ===" -ForegroundColor Cyan
Write-Host "Total Income: EGP $($analytics.summary.totalIncome)" -ForegroundColor Green
Write-Host "Total Expense: EGP $($analytics.summary.totalExpense)" -ForegroundColor Red
Write-Host "Net Savings: EGP $($analytics.summary.netSavings)" -ForegroundColor Cyan
Write-Host "Savings Rate: $($analytics.summary.savingsRate)%" -ForegroundColor Cyan
Write-Host "Transaction Count: $($analytics.summary.transactionCount)"
```

---

### **Step 13: View Category Breakdown**

```powershell
$categories = Invoke-RestMethod -Uri "http://localhost:5001/api/analytics/categories?type=expense&period=monthly" `
  -Method Get `
  -Headers $headers

Write-Host "`n=== EXPENSE BREAKDOWN ===" -ForegroundColor Yellow
Write-Host "Total Expenses: EGP $($categories.totalAmount)"
$categories.breakdown | ForEach-Object {
    Write-Host "  $($_.category): EGP $($_.amount) ($($_.percentage)%)"
}
```

---

## 🎉 Testing Complete!

You've successfully tested:
- ✅ User signup
- ✅ User login & JWT authentication
- ✅ Profile management
- ✅ Income transactions
- ✅ Expense transactions
- ✅ Dashboard with real-time calculations
- ✅ Budget creation
- ✅ Savings goals
- ✅ Savings contributions
- ✅ Analytics overview
- ✅ Category breakdown

---

## 💾 Save Your Token

Your JWT token for this session:
```
echo $token
```

Use this token for any additional manual testing!

---

## 🚀 Quick Copy-Paste Script

Run all steps at once:

```powershell
# Copy the entire content of this file and paste into PowerShell!
```
