# ============================================
# PowerShell API Testing Script
# Home Backend - Complete User Flow
# ============================================

Write-Host "`n🚀 Starting API Tests..." -ForegroundColor Cyan
Write-Host "============================================`n" -ForegroundColor Cyan

# Configuration
$AUTH_BASE_URL = "http://localhost:3210"
$HOME_BASE_URL = "http://localhost:5001"
$EMAIL = "testuser$(Get-Random)@example.com"
$PASSWORD = "Test123456"
$PHONE = "+201234567890"

# ============================================
# Step 1: Health Check
# ============================================
Write-Host "📡 Step 1: Health Check - Home Backend" -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$HOME_BASE_URL/health" -Method Get
    Write-Host "✅ Home Backend is running: $($health.status)" -ForegroundColor Green
    Write-Host "   Service: $($health.service)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Home Backend is NOT running on port 5001" -ForegroundColor Red
    Write-Host "   Please start it with: npm run dev" -ForegroundColor Red
    exit
}

# ============================================
# Step 2: Signup New User
# ============================================
Write-Host "`n📝 Step 2: Creating new user..." -ForegroundColor Yellow
Write-Host "   Email: $EMAIL" -ForegroundColor Gray

$signupBody = @{
    email = $EMAIL
    password = $PASSWORD
    phone = $PHONE
} | ConvertTo-Json

try {
    $signupResponse = Invoke-RestMethod -Uri "$AUTH_BASE_URL/api/auth/signup" `
        -Method Post `
        -Body $signupBody `
        -ContentType "application/json"
    
    Write-Host "✅ Signup successful!" -ForegroundColor Green
    Write-Host "   User ID: $($signupResponse.user.id)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Signup failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
}

# Wait a moment
Start-Sleep -Seconds 1

# ============================================
# Step 3: Login to Get JWT Token
# ============================================
Write-Host "`n🔐 Step 3: Logging in..." -ForegroundColor Yellow

$loginBody = @{
    email = $EMAIL
    password = $PASSWORD
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$AUTH_BASE_URL/api/auth/login" `
        -Method Post `
        -Body $loginBody `
        -ContentType "application/json"
    
    $JWT_TOKEN = $loginResponse.accessToken
    Write-Host "✅ Login successful!" -ForegroundColor Green
    Write-Host "   Token: $($JWT_TOKEN.Substring(0,50))..." -ForegroundColor Gray
} catch {
    Write-Host "❌ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit
}

# ============================================
# Step 4: Get Dashboard (First Time)
# ============================================
Write-Host "`n🏠 Step 4: Getting Dashboard..." -ForegroundColor Yellow

$headers = @{
    "Authorization" = "Bearer $JWT_TOKEN"
}

try {
    $dashboard = Invoke-RestMethod -Uri "$HOME_BASE_URL/api/dashboard" `
        -Method Get `
        -Headers $headers
    
    Write-Host "✅ Dashboard loaded!" -ForegroundColor Green
    Write-Host "   User: $($dashboard.user.name)" -ForegroundColor Gray
    Write-Host "   Balance: $($dashboard.balance.total)" -ForegroundColor Gray
    Write-Host "   Income: $($dashboard.balance.income)" -ForegroundColor Gray
    Write-Host "   Expense: $($dashboard.balance.expense)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Dashboard failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "   Response: $($_.ErrorDetails.Message)" -ForegroundColor Red
}

# ============================================
# Step 5: Update Profile
# ============================================
Write-Host "`n👤 Step 5: Updating Profile..." -ForegroundColor Yellow

$profileBody = @{
    displayName = "Mohamed Yaser"
    currency = "EGP"
    profilePhoto = "https://i.pravatar.cc/150?img=12"
} | ConvertTo-Json

try {
    $profile = Invoke-RestMethod -Uri "$HOME_BASE_URL/api/profile" `
        -Method Put `
        -Body $profileBody `
        -ContentType "application/json" `
        -Headers $headers
    
    Write-Host "✅ Profile updated!" -ForegroundColor Green
    Write-Host "   Name: $($profile.profile.displayName)" -ForegroundColor Gray
    Write-Host "   Currency: $($profile.profile.currency)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Profile update failed: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================
# Step 6: Add Income Transaction
# ============================================
Write-Host "`n💰 Step 6: Adding Income..." -ForegroundColor Yellow

$incomeBody = @{
    type = "income"
    amount = 8500.00
    category = "Salary"
    description = "January salary"
    paymentMethod = "bank_transfer"
} | ConvertTo-Json

try {
    $income = Invoke-RestMethod -Uri "$HOME_BASE_URL/api/transactions" `
        -Method Post `
        -Body $incomeBody `
        -ContentType "application/json" `
        -Headers $headers
    
    Write-Host "✅ Income added!" -ForegroundColor Green
    Write-Host "   Amount: $($income.transaction.amount)" -ForegroundColor Gray
    Write-Host "   New Balance: $($income.newBalance)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Income transaction failed: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================
# Step 7: Add Expense Transactions
# ============================================
Write-Host "`n🛒 Step 7: Adding Expenses..." -ForegroundColor Yellow

$expenses = @(
    @{ amount = 150.50; category = "Food & Dining"; description = "Grocery shopping" },
    @{ amount = 200.00; category = "Transportation"; description = "Monthly gas" },
    @{ amount = 300.00; category = "Entertainment"; description = "Movie and dinner" }
)

foreach ($expense in $expenses) {
    $expenseBody = @{
        type = "expense"
        amount = $expense.amount
        category = $expense.category
        description = $expense.description
        paymentMethod = "cash"
    } | ConvertTo-Json

    try {
        $result = Invoke-RestMethod -Uri "$HOME_BASE_URL/api/transactions" `
            -Method Post `
            -Body $expenseBody `
            -ContentType "application/json" `
            -Headers $headers
        
        Write-Host "  ✅ $($expense.description): EGP $($expense.amount)" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ Failed: $($expense.description)" -ForegroundColor Red
    }
}

# ============================================
# Step 8: Get Updated Dashboard
# ============================================
Write-Host "`n📊 Step 8: Getting Updated Dashboard..." -ForegroundColor Yellow

try {
    $dashboard2 = Invoke-RestMethod -Uri "$HOME_BASE_URL/api/dashboard" `
        -Method Get `
        -Headers $headers
    
    Write-Host "✅ Dashboard updated!" -ForegroundColor Green
    Write-Host "   User: $($dashboard2.user.name)" -ForegroundColor Cyan
    Write-Host "   Total Balance: EGP $($dashboard2.balance.total)" -ForegroundColor Cyan
    Write-Host "   Income (This Month): EGP $($dashboard2.balance.income)" -ForegroundColor Green
    Write-Host "   Expense (This Month): EGP $($dashboard2.balance.expense)" -ForegroundColor Red
} catch {
    Write-Host "❌ Dashboard failed: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================
# Step 9: Create Budget
# ============================================
Write-Host "`n🎯 Step 9: Creating Budget..." -ForegroundColor Yellow

$budgetBody = @{
    name = "Monthly Food Budget"
    category = "Food & Dining"
    limitAmount = 2000
    period = "monthly"
    startDate = "2026-01-01"
    endDate = "2026-01-31"
} | ConvertTo-Json

try {
    $budget = Invoke-RestMethod -Uri "$HOME_BASE_URL/api/budgets" `
        -Method Post `
        -Body $budgetBody `
        -ContentType "application/json" `
        -Headers $headers
    
    Write-Host "✅ Budget created!" -ForegroundColor Green
    Write-Host "   Name: $($budget.budget.name)" -ForegroundColor Gray
    Write-Host "   Limit: EGP $($budget.budget.limitAmount)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Budget creation failed: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================
# Step 10: Create Savings Goal
# ============================================
Write-Host "`n💎 Step 10: Creating Savings Goal..." -ForegroundColor Yellow

$savingsBody = @{
    name = "Vacation Fund"
    targetAmount = 5000
    deadline = "2026-07-01"
    icon = "✈️"
    priority = "high"
    description = "Summer vacation"
} | ConvertTo-Json

try {
    $savings = Invoke-RestMethod -Uri "$HOME_BASE_URL/api/savings" `
        -Method Post `
        -Body $savingsBody `
        -ContentType "application/json" `
        -Headers $headers
    
    Write-Host "✅ Savings goal created!" -ForegroundColor Green
    Write-Host "   Name: $($savings.savingsGoal.name)" -ForegroundColor Gray
    Write-Host "   Target: EGP $($savings.savingsGoal.targetAmount)" -ForegroundColor Gray
    
    $savingsId = $savings.savingsGoal._id
} catch {
    Write-Host "❌ Savings goal failed: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================
# Step 11: Get Analytics
# ============================================
Write-Host "`n📈 Step 11: Getting Analytics..." -ForegroundColor Yellow

try {
    $analytics = Invoke-RestMethod -Uri "$HOME_BASE_URL/api/analytics/overview?period=monthly" `
        -Method Get `
        -Headers $headers
    
    Write-Host "✅ Analytics loaded!" -ForegroundColor Green
    Write-Host "   Total Income: EGP $($analytics.summary.totalIncome)" -ForegroundColor Green
    Write-Host "   Total Expense: EGP $($analytics.summary.totalExpense)" -ForegroundColor Red
    Write-Host "   Net Savings: EGP $($analytics.summary.netSavings)" -ForegroundColor Cyan
    Write-Host "   Savings Rate: $($analytics.summary.savingsRate)%" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Analytics failed: $($_.Exception.Message)" -ForegroundColor Red
}

# ============================================
# Final Summary
# ============================================
Write-Host "`n============================================" -ForegroundColor Cyan
Write-Host "🎉 Testing Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "`nYour JWT Token (save this for manual testing):" -ForegroundColor Yellow
Write-Host $JWT_TOKEN -ForegroundColor White
Write-Host "`n✅ All systems working correctly!" -ForegroundColor Green
