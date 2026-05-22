const axios = require('axios');

// Configuration
const AUTH_BASE_URL = 'http://localhost:3210';
const HOME_BASE_URL = 'http://localhost:5001';
const EMAIL = `testuser${Date.now()}@example.com`;
const PASSWORD = 'Test123456';
const PHONE = '+201234567890';

let jwtToken = '';

// Colors for console
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    red: '\x1b[31m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m'
};

const log = {
    success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
    info: (msg) => console.log(`${colors.cyan}${msg}${colors.reset}`),
    step: (msg) => console.log(`\n${colors.yellow}${msg}${colors.reset}`),
    detail: (msg) => console.log(`${colors.gray}   ${msg}${colors.reset}`)
};

// Helper function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
    console.log(`\n${colors.cyan}${'='.repeat(50)}`);
    console.log('🚀 Home Backend API Testing');
    console.log(`${'='.repeat(50)}${colors.reset}\n`);

    try {
        // Step 1: Health Check
        log.step('📡 Step 1: Health Check - Home Backend');
        const health = await axios.get(`${HOME_BASE_URL}/health`);
        log.success(`Home Backend is running: ${health.data.status}`);
        log.detail(`Service: ${health.data.service}`);

        await sleep(500);

        // Step 2: Signup
        log.step('📝 Step 2: Creating new user...');
        log.detail(`Email: ${EMAIL}`);

        const signupResponse = await axios.post(`${AUTH_BASE_URL}/api/auth/signup`, {
            email: EMAIL,
            password: PASSWORD,
            phone: PHONE
        });

        log.success('Signup successful!');
        log.detail(`User ID: ${signupResponse.data.user.id}`);

        await sleep(1000);

        // Step 3: Login
        log.step('🔐 Step 3: Logging in...');

        const loginResponse = await axios.post(`${AUTH_BASE_URL}/api/auth/login`, {
            email: EMAIL,
            password: PASSWORD
        });

        jwtToken = loginResponse.data.accessToken;
        log.success('Login successful!');
        log.detail(`Token: ${jwtToken.substring(0, 50)}...`);

        const headers = { Authorization: `Bearer ${jwtToken}` };

        await sleep(500);

        // Step 4: Get Dashboard
        log.step('🏠 Step 4: Getting Dashboard (First Time)...');

        const dashboard = await axios.get(`${HOME_BASE_URL}/api/dashboard`, { headers });

        log.success('Dashboard loaded!');
        log.detail(`User: ${dashboard.data.user.name}`);
        log.detail(`Balance: ${dashboard.data.balance.total}`);
        log.detail(`Income: ${dashboard.data.balance.income}`);
        log.detail(`Expense: ${dashboard.data.balance.expense}`);

        await sleep(500);

        // Step 5: Update Profile
        log.step('👤 Step 5: Updating Profile...');

        const profileResponse = await axios.put(`${HOME_BASE_URL}/api/profile`, {
            displayName: 'Mohamed Yaser',
            currency: 'EGP',
            profilePhoto: 'https://i.pravatar.cc/150?img=12'
        }, { headers });

        log.success('Profile updated!');
        log.detail(`Name: ${profileResponse.data.profile.displayName}`);
        log.detail(`Currency: ${profileResponse.data.profile.currency}`);

        await sleep(500);

        // Step 6: Add Income
        log.step('💰 Step 6: Adding Income Transaction...');

        const incomeResponse = await axios.post(`${HOME_BASE_URL}/api/transactions`, {
            type: 'income',
            amount: 8500.00,
            category: 'Salary',
            description: 'January salary',
            paymentMethod: 'bank_transfer'
        }, { headers });

        log.success('Income added!');
        log.detail(`Amount: EGP ${incomeResponse.data.transaction.amount}`);
        log.detail(`New Balance: EGP ${incomeResponse.data.newBalance}`);

        await sleep(500);

        // Step 7: Add Expenses
        log.step('🛒 Step 7: Adding Expense Transactions...');

        const expenses = [
            { amount: 150.50, category: 'Food & Dining', description: 'Grocery shopping' },
            { amount: 200.00, category: 'Transportation', description: 'Monthly gas' },
            { amount: 300.00, category: 'Entertainment', description: 'Movie and dinner' }
        ];

        for (const expense of expenses) {
            await axios.post(`${HOME_BASE_URL}/api/transactions`, {
                type: 'expense',
                ...expense,
                paymentMethod: 'cash'
            }, { headers });

            log.success(`${expense.description}: EGP ${expense.amount}`);
            await sleep(200);
        }

        await sleep(500);

        // Step 8: Get Updated Dashboard
        log.step('📊 Step 8: Getting Updated Dashboard...');

        const dashboard2 = await axios.get(`${HOME_BASE_URL}/api/dashboard`, { headers });

        log.success('Dashboard updated!');
        console.log(`${colors.cyan}   User: ${dashboard2.data.user.name}${colors.reset}`);
        console.log(`${colors.cyan}   Total Balance: EGP ${dashboard2.data.balance.total}${colors.reset}`);
        console.log(`${colors.green}   Income (This Month): EGP ${dashboard2.data.balance.income}${colors.reset}`);
        console.log(`${colors.red}   Expense (This Month): EGP ${dashboard2.data.balance.expense}${colors.reset}`);

        await sleep(500);

        // Step 9: Create Budget
        log.step('🎯 Step 9: Creating Budget...');

        const budgetResponse = await axios.post(`${HOME_BASE_URL}/api/budgets`, {
            name: 'Monthly Food Budget',
            category: 'Food & Dining',
            limitAmount: 2000,
            period: 'monthly',
            startDate: '2026-01-01',
            endDate: '2026-01-31'
        }, { headers });

        log.success('Budget created!');
        log.detail(`Name: ${budgetResponse.data.budget.name}`);
        log.detail(`Limit: EGP ${budgetResponse.data.budget.limitAmount}`);

        await sleep(500);

        // Step 10: Create Savings Goal
        log.step('💎 Step 10: Creating Savings Goal...');

        const savingsResponse = await axios.post(`${HOME_BASE_URL}/api/savings`, {
            name: 'Vacation Fund',
            targetAmount: 5000,
            deadline: '2026-07-01',
            icon: '✈️',
            priority: 'high',
            description: 'Summer vacation'
        }, { headers });

        log.success('Savings goal created!');
        log.detail(`Name: ${savingsResponse.data.savingsGoal.name}`);
        log.detail(`Target: EGP ${savingsResponse.data.savingsGoal.targetAmount}`);

        await sleep(500);

        // Step 11: Get Analytics
        log.step('📈 Step 11: Getting Analytics...');

        const analyticsResponse = await axios.get(
            `${HOME_BASE_URL}/api/analytics/overview?period=monthly`,
            { headers }
        );

        log.success('Analytics loaded!');
        console.log(`${colors.green}   Total Income: EGP ${analyticsResponse.data.summary.totalIncome}${colors.reset}`);
        console.log(`${colors.red}   Total Expense: EGP ${analyticsResponse.data.summary.totalExpense}${colors.reset}`);
        console.log(`${colors.cyan}   Net Savings: EGP ${analyticsResponse.data.summary.netSavings}${colors.reset}`);
        console.log(`${colors.cyan}   Savings Rate: ${analyticsResponse.data.summary.savingsRate}%${colors.reset}`);

        // Final Summary
        console.log(`\n${colors.cyan}${'='.repeat(50)}`);
        log.success('Testing Complete!');
        console.log(`${colors.cyan}${'='.repeat(50)}${colors.reset}\n`);

        log.info('Your JWT Token (save this for manual testing):');
        console.log(`${colors.bright}${jwtToken}${colors.reset}\n`);

        log.success('All systems working correctly! 🚀');

    } catch (error) {
        log.error('Test failed!');
        console.error(error.response?.data || error.message);
        process.exit(1);
    }
}

// Run the tests
main();
