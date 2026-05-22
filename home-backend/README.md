# Home Backend API

## 🎯 Overview

The **Home Backend** is a microservice for an intelligent personal budgeting application. It provides comprehensive financial management features including transaction tracking, budgeting, savings goals, debt management, and analytics.

---

## 🚀 Quick Start

### Prerequisites
- Node.js (v14+)
- MongoDB (local or Atlas)
- Auth-backend running (for JWT tokens)

### Installation

```bash
# Install dependencies
npm install

# Configure environment variables
# Copy .env.example to .env and update values
cp .env .env.local

# Start development server
npm run dev
```

### Environment Variables

Create a `.env` file with the following:

```env
PORT=5001
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/budgeting_app
JWT_SECRET=<copy-from-auth-backend>
FRONTEND_URL=http://localhost:3000
```

> **⚠️ IMPORTANT**: The `JWT_SECRET` must match the one in your auth-backend!

---

## 📋 API Endpoints

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dashboard` | Get home screen data (balance, income, expense) |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/transactions` | Create transaction |
| `GET` | `/api/transactions` | Get all transactions (filters: type, category, startDate, endDate) |
| `GET` | `/api/transactions/:id` | Get single transaction |
| `PUT` | `/api/transactions/:id` | Update transaction |
| `DELETE` | `/api/transactions/:id` | Delete transaction |

### Budgets
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/budgets` | Create budget |
| `GET` | `/api/budgets` | Get all budgets |
| `GET` | `/api/budgets/:id` | Get single budget |
| `PUT` | `/api/budgets/:id` | Update budget |
| `DELETE` | `/api/budgets/:id` | Delete budget |

### Savings Goals
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/savings` | Create savings goal |
| `GET` | `/api/savings` | Get all goals |
| `GET` | `/api/savings/:id` | Get single goal |
| `PUT` | `/api/savings/:id` | Update goal |
| `POST` | `/api/savings/:id/contribute` | Add money to goal |
| `DELETE` | `/api/savings/:id` | Delete goal |

### Debts
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/debts` | Create debt |
| `GET` | `/api/debts` | Get all debts |
| `GET` | `/api/debts/:id` | Get single debt |
| `PUT` | `/api/debts/:id` | Update debt |
| `POST` | `/api/debts/:id/payment` | Record payment |
| `DELETE` | `/api/debts/:id` | Delete debt |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/analytics/overview` | Get financial overview (params: period=weekly/monthly/yearly) |
| `GET` | `/api/analytics/categories` | Get spending by category |
| `GET` | `/api/analytics/trends` | Get historical trends (params: months=6) |

### Profile
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/profile` | Get user profile |
| `PUT` | `/api/profile` | Update profile (name, photo, currency) |

### Offers
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/offers` | Get active offers |

---

## 🔐 Authentication

All endpoints require a valid JWT token from the auth-backend.

**Request Header:**
```
Authorization: Bearer <your-jwt-token>
```

---

## 📊 Example Requests

### Get Dashboard Data
```bash
GET http://localhost:5001/api/dashboard
Authorization: Bearer eyJhbGc...
```

**Response:**
```json
{
  "user": {
    "name": "Mohamed Yaser",
    "photo": "",
    "currency": "USD"
  },
  "balance": {
    "total": 12547.32,
    "income": 8500.00,
    "expense": 3252.68,
    "period": "This Month"
  },
  "quickActions": [...]
}
```

### Create Transaction
```bash
POST http://localhost:5001/api/transactions
Authorization: Bearer eyJhbGc...
Content-Type: application/json

{
  "type": "expense",
  "amount": 50.00,
  "category": "Food & Dining",
  "description": "Lunch at restaurant",
  "paymentMethod": "credit_card"
}
```

### Get Analytics Overview
```bash
GET http://localhost:5001/api/analytics/overview?period=monthly
Authorization: Bearer eyJhbGc...
```

---

## 🗂️ Project Structure

```
home-backend/
├── server.js              # Entry point
├── package.json
├── .env
│
├── models/                # Database schemas
│   ├── UserProfile.js
│   ├── Account.js
│   ├── Transaction.js
│   ├── Budget.js
│   ├── SavingsGoal.js
│   ├── Debt.js
│   └── Offer.js
│
├── routes/                # API routes
│   ├── dashboard.js
│   ├── transactions.js
│   ├── budgets.js
│   ├── savings.js
│   ├── debts.js
│   ├── analytics.js
│   ├── profile.js
│   └── offers.js
│
├── controllers/           # Business logic
│   ├── dashboardController.js
│   ├── transactionController.js
│   ├── budgetController.js
│   ├── savingsController.js
│   ├── debtController.js
│   ├── analyticsController.js
│   ├── profileController.js
│   └── offersController.js
│
├── middleware/
│   ├── verifyToken.js     # JWT authentication
│   └── errorHandler.js    # Error handling
│
├── utils/
│   ├── logger.js          # Winston logger
│   └── calculations.js    # Helper functions
│
└── logs/
    ├── combined.log
    └── error.log
```

---

## 🧪 Testing

1. **Start MongoDB** (if local)
2. **Start auth-backend** on port 5000
3. **Start home-backend**: `npm run dev`
4. **Login via auth-backend** to get JWT token
5. **Use Thunder Client or Postman** to test endpoints

---

## 🛡️ Security Features

✅ JWT token verification  
✅ User-specific data isolation  
✅ MongoDB injection protection  
✅ Error logging  
✅ Request validation  

---

## 🔄 Integration with Auth-Backend

- **Shared Database**: Both services use the same MongoDB database
- **Shared JWT Secret**: Same secret key for token verification
- **User References**: All models reference User IDs from auth-backend

---

## 📝 Transaction Categories

### Expense Categories
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

### Income Categories
- Salary
- Freelance
- Business
- Investment
- Gift
- Other Income

---

## 💾 Database Models

### Transaction
```javascript
{
  userId, type, amount, category, description,
  date, paymentMethod, tags, attachments, notes
}
```

### Budget
```javascript
{
  userId, name, category, limitAmount, spentAmount,
  period, startDate, endDate, isActive, alertThreshold
}
```

### Savings Goal
```javascript
{
  userId, name, targetAmount, savedAmount,
  deadline, icon, priority, isCompleted
}
```

### Debt
```javascript
{
  userId, creditorName, totalAmount, paidAmount,
  interestRate, dueDate, status, payments[]
}
```

---

## 🚧 Future Enhancements

- [ ] AI-powered expense categorization
- [ ] Recurring transactions
- [ ] Budget alerts and notifications
- [ ] Export data to CSV/PDF
- [ ] Multi-currency support
- [ ] Shared budgets (family/couples)

---

## 📞 Support

For issues or questions, please contact the backend development team.

**Server Health Check**: `GET http://localhost:5001/health`
