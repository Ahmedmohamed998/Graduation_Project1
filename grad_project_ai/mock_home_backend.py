from fastapi import FastAPI, Depends, Header, HTTPException
import uvicorn

app = FastAPI(title="Mock Home Backend")

def verify_token(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")
    return True

@app.get("/api/analytics/overview")
async def get_overview(period: str = "monthly", authorized: bool = Depends(verify_token)):
    return {
        "period": period,
        "summary": {
            "totalIncome": 8500,
            "totalExpense": 1150.5,
            "netSavings": 7349.5,
            "savingsRate": 86.48,
            "transactionCount": 5
        }
    }

@app.get("/api/analytics/categories")
async def get_categories(type: str = "expense", period: str = "monthly", authorized: bool = Depends(verify_token)):
    return {
        "totalAmount": 1150.5,
        "breakdown": [
            { "category": "Food & Dining", "amount": 600.5, "count": 2, "percentage": 52.17 },
            { "category": "Transportation", "amount": 300, "count": 1, "percentage": 26.08 },
            { "category": "Entertainment", "amount": 250, "count": 1, "percentage": 21.74 }
        ]
    }

@app.get("/api/analytics/trends")
async def get_trends(months: int = 6, authorized: bool = Depends(verify_token)):
    return {
        "trends": [
            { "month": "Sep 2025", "income": 7000, "expense": 900, "net": 6100 },
            { "month": "Oct 2025", "income": 7500, "expense": 1100, "net": 6400 },
            { "month": "Feb 2026", "income": 8500, "expense": 1150, "net": 7350 }
        ]
    }

@app.get("/api/transactions")
async def get_transactions(limit: int = 20, page: int = 1, authorized: bool = Depends(verify_token)):
    return {
        "transactions": [
            {
                "type": "expense",
                "amount": 150.5,
                "category": "Food & Dining",
                "description": "Grocery shopping",
                "date": "2026-02-25T00:00:00.000Z",
                "paymentMethod": "cash"
            }
        ],
        "pagination": { "total": 45, "page": page, "limit": limit }
    }

@app.get("/api/budgets")
async def get_budgets(isActive: bool = True, authorized: bool = Depends(verify_token)):
    return {
        "budgets": [
            {
                "name": "Monthly Food Budget",
                "category": "Food & Dining",
                "limitAmount": 2000,
                "spentAmount": 600.5,
                "remainingAmount": 1399.5,
                "percentageSpent": 30.03
            }
        ]
    }

@app.get("/api/savings")
async def get_savings(isCompleted: bool = False, authorized: bool = Depends(verify_token)):
    return {
        "savingsGoals": [
            {
                "name": "Vacation Fund",
                "targetAmount": 15000,
                "savedAmount": 3000,
                "remainingAmount": 12000,
                "progressPercentage": 20,
                "priority": "high",
                "deadline": "2026-07-01T00:00:00.000Z"
            }
        ]
    }

@app.get("/api/debts")
async def get_debts(status: str = "active", authorized: bool = Depends(verify_token)):
    return {
        "debts": [
            {
                "creditorName": "Bank Loan",
                "totalAmount": 50000,
                "paidAmount": 5000,
                "remainingAmount": 45000,
                "paymentProgress": 10,
                "interestRate": 7.5
            }
        ]
    }

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=5001)
