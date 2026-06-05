import httpx
import asyncio
import os

HOME_BACKEND_URL = os.environ.get("HOME_BACKEND_URL", "http://home-backend:5001")

async def fetch_endpoint(client: httpx.AsyncClient, endpoint: str, access_token: str):
    headers = {"Authorization": f"Bearer {access_token}"}
    response = await client.get(f"{HOME_BACKEND_URL}{endpoint}", headers=headers)
    response.raise_for_status()
    return response.json()

async def build_user_context(access_token: str):
    async with httpx.AsyncClient() as client:
        endpoints = [
            "/api/analytics/overview?period=monthly",
            "/api/analytics/categories?type=expense&period=monthly",
            "/api/analytics/trends?months=6",
            "/api/transactions?limit=20",
            "/api/budgets?isActive=true",
            "/api/savings?isCompleted=false",
            "/api/debts?status=active"
        ]
        
        results = await asyncio.gather(
            *[fetch_endpoint(client, ep, access_token) for ep in endpoints]
        )
        
        overview, categories, trends, transactions, budgets, savings, debts = results
        
        return {
            "overview": overview.get("summary", {}),
            "topSpendingCategories": categories.get("breakdown", []),
            "spendingTrends": trends.get("trends", []),
            "recentTransactions": transactions.get("transactions", []),
            "activeBudgets": budgets.get("budgets", []),
            "savingsGoals": savings.get("savingsGoals", []),
            "activeDebts": debts.get("debts", [])
        }
