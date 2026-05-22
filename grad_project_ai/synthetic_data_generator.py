"""
synthetic_data_generator.py
Generates realistic Egyptian-market financial data for testing.

Usage:  python synthetic_data_generator.py
Output: data/users.json  transactions.json  voice_feedback.json
        ocr_feedback.json  budgets.json  savings_goals.json  debts.json
"""

import json
import random
import uuid
from datetime import datetime, timedelta
from pathlib import Path

random.seed(42)
Path("data").mkdir(exist_ok=True)


# ─── Personas ────────────────────────────────────────────────────────────────

PERSONAS = [
    {
        "name": "Young Professional",
        "income_range": (12000, 18000),
        "spending_profile": {"Housing": 0.28, "Food & Dining": 0.24,
                             "Transportation": 0.07, "Entertainment": 0.09,
                             "Shopping": 0.10, "Utilities": 0.04, "Healthcare": 0.03},
        "tx_per_month": (60, 80), "save_rate": 0.25,
        "voice_pct": 0.45, "ocr_pct": 0.20,
        "lang": "mixed",
    },
    {
        "name": "Medical Student",
        "income_range": (2500, 3500),
        "spending_profile": {"Education": 0.27, "Food & Dining": 0.38,
                             "Transportation": 0.10, "Utilities": 0.07,
                             "Personal Care": 0.05, "Entertainment": 0.04},
        "tx_per_month": (40, 55), "save_rate": 0.09,
        "voice_pct": 0.20, "ocr_pct": 0.10,
        "lang": "ar",
    },
    {
        "name": "Small Business Owner",
        "income_range": (20000, 30000),
        "spending_profile": {"Housing": 0.20, "Food & Dining": 0.10,
                             "Transportation": 0.06, "Utilities": 0.05,
                             "Shopping": 0.08, "Debt Repayment": 0.12,
                             "Miscellaneous": 0.10},
        "tx_per_month": (100, 120), "save_rate": 0.16,
        "voice_pct": 0.20, "ocr_pct": 0.40,
        "lang": "ar",
    },
    {
        "name": "Working Mother",
        "income_range": (10000, 14000),
        "spending_profile": {"Housing": 0.29, "Food & Dining": 0.25,
                             "Education": 0.17, "Healthcare": 0.07,
                             "Transportation": 0.05, "Utilities": 0.04},
        "tx_per_month": (70, 90), "save_rate": 0.13,
        "voice_pct": 0.30, "ocr_pct": 0.10,
        "lang": "mixed",
    },
    {
        "name": "Fresh Graduate",
        "income_range": (4500, 6000),
        "spending_profile": {"Housing": 0.10, "Food & Dining": 0.36,
                             "Transportation": 0.12, "Entertainment": 0.14,
                             "Shopping": 0.16, "Utilities": 0.06},
        "tx_per_month": (45, 60), "save_rate": 0.06,
        "voice_pct": 0.15, "ocr_pct": 0.05,
        "lang": "en",
    },
    {
        "name": "Retired Teacher",
        "income_range": (5000, 7000),
        "spending_profile": {"Housing": 0.30, "Food & Dining": 0.30,
                             "Healthcare": 0.15, "Utilities": 0.10,
                             "Personal Care": 0.05},
        "tx_per_month": (30, 45), "save_rate": 0.10,
        "voice_pct": 0.05, "ocr_pct": 0.05,
        "lang": "ar",
    },
    {
        "name": "Freelance Designer",
        "income_range": (8000, 20000),
        "spending_profile": {"Housing": 0.22, "Food & Dining": 0.20,
                             "Entertainment": 0.12, "Shopping": 0.14,
                             "Subscriptions": 0.05, "Transportation": 0.07},
        "tx_per_month": (50, 70), "save_rate": 0.18,
        "voice_pct": 0.35, "ocr_pct": 0.15,
        "lang": "en",
    },
    {
        "name": "University Professor",
        "income_range": (22000, 35000),
        "spending_profile": {"Housing": 0.20, "Food & Dining": 0.15,
                             "Education": 0.08, "Travel & Vacation": 0.08,
                             "Shopping": 0.09, "Healthcare": 0.06,
                             "Utilities": 0.04},
        "tx_per_month": (55, 75), "save_rate": 0.22,
        "voice_pct": 0.25, "ocr_pct": 0.20,
        "lang": "mixed",
    },
    {
        "name": "Nurse",
        "income_range": (7000, 10000),
        "spending_profile": {"Housing": 0.28, "Food & Dining": 0.25,
                             "Healthcare": 0.08, "Transportation": 0.09,
                             "Personal Care": 0.06, "Utilities": 0.05},
        "tx_per_month": (55, 70), "save_rate": 0.12,
        "voice_pct": 0.20, "ocr_pct": 0.10,
        "lang": "ar",
    },
    {
        "name": "Entrepreneur",
        "income_range": (25000, 50000),
        "spending_profile": {"Housing": 0.15, "Food & Dining": 0.12,
                             "Transportation": 0.08, "Travel & Vacation": 0.10,
                             "Shopping": 0.10, "Miscellaneous": 0.10,
                             "Debt Repayment": 0.08},
        "tx_per_month": (80, 110), "save_rate": 0.20,
        "voice_pct": 0.40, "ocr_pct": 0.25,
        "lang": "mixed",
    },
]

CATEGORIES = [
    "Housing", "Food & Dining", "Transportation", "Utilities",
    "Healthcare", "Education", "Entertainment", "Shopping",
    "Personal Care", "Travel & Vacation", "Subscriptions",
    "Debt Repayment", "Miscellaneous",
]

MERCHANTS = {
    "Food & Dining":      ["مطعم أبو شقرة", "كارفور", "سيلانترو", "KFC", "مخبز العائلة", "McDonald's", "هايبر وان", "Cilantro Coffee"],
    "Transportation":     ["أوبر", "Uber", "Careem", "كريم", "Cairo Metro", "محطة وقود توتال", "Total Gas"],
    "Shopping":           ["LC Waikiki", "Jumia", "Noon", "محل الأحذية", "H&M", "Carrefour"],
    "Housing":            ["إيجار الشقة", "House Rent", "صيانة"],
    "Utilities":          ["فاتورة الكهرباء", "فاتورة المياه", "WE Internet", "Vodafone", "Orange"],
    "Healthcare":         ["صيدلية مصر", "Pharmacy Plus", "Dr. Ahmed Clinic", "مستشفى السلام"],
    "Education":          ["مكتبة الأكاديمية", "Coursera", "Udemy", "كتب دراسية"],
    "Entertainment":      ["Netflix", "VOD", "سينما سيتي ستارز", "Spotify"],
    "Personal Care":      ["Haircut Salon", "صالون تجميل", "Gym Flex"],
    "Travel & Vacation":  ["EgyptAir", "فندق الماريوت", "حجز فندق", "Booking.com"],
    "Subscriptions":      ["Adobe Creative", "Microsoft 365", "Notion Premium"],
    "Debt Repayment":     ["قسط البنك", "Bank Loan", "سداد قرض"],
    "Miscellaneous":      ["متفرقات", "Misc", "Other"],
}

PAYMENT_METHODS = ["cash", "credit_card", "debit_card", "mobile_wallet", "bank_transfer"]
PAYMENT_WEIGHTS = [0.35,  0.30,          0.20,          0.10,            0.05]

LOCATIONS = ["Cairo", "Alexandria", "Giza", "Mansoura", "Tanta", "Aswan", "Luxor"]

AR_TRANSCRIPTS = [
    "دفعت {} جنيه في {}",
    "صرفت {} جنيه على {}",
    "اتحسبت {} جنيه من حسابي على {}",
]
EN_TRANSCRIPTS = [
    "I spent {} EGP at {}",
    "paid {} pounds for {}",
    "charged {} EGP for {}",
]

# ─── Helpers ──────────────────────────────────────────────────────────────────

def oid():
    return str(uuid.uuid4())

def rand_date(start: datetime, end: datetime) -> datetime:
    delta = end - start
    return start + timedelta(seconds=random.randint(0, int(delta.total_seconds())))

def monthly_multiplier(month: int) -> float:
    """Seasonal spending adjustments (month 1-12)."""
    m = {3: 1.30, 4: 1.20,   # Ramadan / Eid spike
         7: 1.15, 8: 1.15,   # Summer
         12: 1.20}            # December
    return m.get(month, 1.0)

def day_multiplier(day: int) -> float:
    """Early-month bills, mid-month payday, end-of-month decline."""
    if day <= 5:   return 1.40
    if day <= 15:  return 1.10
    if day <= 20:  return 1.00
    return 0.80

def pick_merchant(category: str) -> str:
    pool = MERCHANTS.get(category, ["متنوع"])
    return random.choice(pool)

# ─── Generators ───────────────────────────────────────────────────────────────

def generate_users(count=200):
    users = []
    per_persona = count // len(PERSONAS)
    for p in PERSONAS:
        for _ in range(per_persona):
            uid = oid()
            income = random.randint(*p["income_range"])
            users.append({
                "_id":          {"$oid": uid},
                "persona":      p["name"],
                "income":       income,
                "location":     random.choice(LOCATIONS),
                "language":     p["lang"],
                "voicePct":     p["voice_pct"],
                "ocrPct":       p["ocr_pct"],
                "txPerMonth":   random.randint(*p["tx_per_month"]),
                "saveRate":     p["save_rate"],
                "spendProfile": p["spending_profile"],
                "createdAt":    {"$date": "2025-05-01T00:00:00Z"},
            })
    return users


def generate_transactions(users):
    txs = []
    start = datetime(2025, 5, 1)
    end   = datetime(2026, 4, 30)

    for u in users:
        uid     = u["_id"]["$oid"]
        income  = u["income"]
        profile = u["spendProfile"]
        n_tx    = u["txPerMonth"]

        cur = datetime(start.year, start.month, 1)
        while cur <= end:
            month_end = datetime(cur.year, cur.month + 1, 1) - timedelta(days=1) if cur.month < 12 \
                        else datetime(cur.year + 1, 1, 1) - timedelta(days=1)

            # Income transaction (salary on 1st-5th)
            inc_date = datetime(cur.year, cur.month, random.randint(1, 5))
            txs.append({
                "_id":         {"$oid": oid()},
                "userId":      {"$oid": uid},
                "type":        "income",
                "amount":      round(income * random.uniform(0.95, 1.05), 2),
                "category":    "Salary / Wages",
                "categoryGroup": None,
                "description": "Monthly Salary",
                "date":        {"$date": inc_date.isoformat() + "Z"},
                "paymentMethod": "bank_transfer",
                "entryMethod": "manual",
                "entryDuration": random.randint(15, 40),
                "createdAt":   {"$date": inc_date.isoformat() + "Z"},
            })

            # Expense transactions
            total_budget = income * (1 - u["saveRate"])
            cats         = list(profile.keys())
            weights      = [profile[c] for c in cats]
            tx_count     = random.randint(*u["txPerMonth"]) if isinstance(n_tx, tuple) else n_tx

            for _ in range(tx_count):
                cat      = random.choices(cats, weights=weights)[0]
                merchant = pick_merchant(cat)
                tx_date  = rand_date(cur, min(month_end, end))
                base_amt = (total_budget * profile[cat]) / tx_count
                amount   = round(
                    base_amt
                    * monthly_multiplier(cur.month)
                    * day_multiplier(tx_date.day)
                    * random.uniform(0.5, 1.8), 2
                )
                amount   = max(5.0, min(amount, income * 0.40))

                # Entry method
                r = random.random()
                if r < u["voicePct"]:
                    entry = "voice"
                elif r < u["voicePct"] + u["ocrPct"]:
                    entry = "ocr"
                else:
                    entry = "manual"

                avg_dur = {"manual": 28, "voice": 5, "ocr": 10}
                dur = int(avg_dur[entry] * random.uniform(0.7, 1.4))

                txs.append({
                    "_id":         {"$oid": oid()},
                    "userId":      {"$oid": uid},
                    "type":        "expense",
                    "amount":      amount,
                    "category":    cat,
                    "categoryGroup": cat,
                    "description": merchant,
                    "date":        {"$date": tx_date.isoformat() + "Z"},
                    "paymentMethod": random.choices(PAYMENT_METHODS, PAYMENT_WEIGHTS)[0],
                    "entryMethod": entry,
                    "entryDuration": dur,
                    "createdAt":   {"$date": tx_date.isoformat() + "Z"},
                })

            # Next month
            cur = datetime(cur.year + (cur.month // 12), (cur.month % 12) + 1, 1)

    return txs


def generate_voice_feedback(transactions, target=15000):
    voice_txs = [t for t in transactions if t.get("entryMethod") == "voice"]
    if len(voice_txs) > target:
        voice_txs = random.sample(voice_txs, target)

    records = []
    for tx in voice_txs:
        lang = random.choices(["ar", "en"], weights=[0.70, 0.30])[0]
        amt  = tx["amount"]
        cat  = tx["category"]
        merch = tx["description"]

        if lang == "ar":
            tmpl = random.choice(AR_TRANSCRIPTS)
            transcript = tmpl.format(int(amt), merch)
        else:
            tmpl = random.choice(EN_TRANSCRIPTS)
            transcript = tmpl.format(int(amt), merch)

        confidence = round(random.uniform(0.65, 0.98), 3)
        correct    = confidence < 0.78 or random.random() < 0.15  # lower conf → more corrections
        corrected_fields = []
        if correct:
            corrected_fields = random.sample(["category", "amount", "date", "description"],
                                             k=random.randint(1, 2))

        records.append({
            "_id":                 {"$oid": oid()},
            "userId":              tx["userId"],
            "originalTranscript":  transcript,
            "language":            lang,
            "originalExtraction":  {"itemName": merch, "amount": amt, "currency": "EGP", "category": cat},
            "correctedExtraction": {"itemName": merch, "amount": amt, "currency": "EGP", "category": cat},
            "correctedFields":     corrected_fields,
            "hadCorrection":       correct,
            "transcriptionConfidence": confidence,
            "extractionConfidence":    round(confidence * random.uniform(0.85, 1.0), 3),
            "transactionId":       tx["_id"],
            "createdAt":           tx["date"],
        })
    return records


def generate_ocr_feedback(transactions, target=8000):
    ocr_txs = [t for t in transactions if t.get("entryMethod") == "ocr"]
    if len(ocr_txs) > target:
        ocr_txs = random.sample(ocr_txs, target)

    file_types  = ["image", "pdf", "text"]
    ft_weights  = [0.60,    0.30,  0.10]
    records     = []

    for tx in ocr_txs:
        ft         = random.choices(file_types, ft_weights)[0]
        confidence = round(random.uniform(0.55, 0.95), 3)
        correct    = confidence < 0.72 or random.random() < 0.20
        corrected_fields = []
        if correct:
            corrected_fields = random.sample(["vendor", "items", "total", "date"],
                                             k=random.randint(1, 2))

        records.append({
            "_id":                {"$oid": oid()},
            "userId":             tx["userId"],
            "fileType":           ft,
            "language":           random.choices(["ar", "en"], weights=[0.70, 0.30])[0],
            "originalRawText":    f"Receipt from {tx['description']} — Total: {tx['amount']} EGP",
            "originalExtraction": {"vendor": tx["description"], "totalAmount": tx["amount"], "currency": "EGP"},
            "correctedExtraction":{"vendor": tx["description"], "totalAmount": tx["amount"], "currency": "EGP"},
            "correctedFields":    corrected_fields,
            "hadCorrection":      correct,
            "ocrConfidence":      confidence,
            "extractionConfidence": round(confidence * random.uniform(0.80, 1.0), 3),
            "transactionId":      tx["_id"],
            "createdAt":          tx["date"],
        })
    return records


def generate_budgets(users, transactions):
    budgets = []
    tx_by_user = {}
    for t in transactions:
        uid = t["userId"]["$oid"]
        tx_by_user.setdefault(uid, []).append(t)

    for u in users:
        uid     = u["_id"]["$oid"]
        profile = u["spendProfile"]
        income  = u["income"]

        budget_cats = [c for c in profile if c not in ("Debt Repayment", "Miscellaneous")]
        selected    = random.sample(budget_cats, min(len(budget_cats), random.randint(3, 6)))

        for cat in selected:
            limit  = round(income * profile[cat] * random.uniform(0.85, 1.10), 2)
            spent  = round(limit * random.uniform(0.40, 1.20), 2)  # some over, some under
            now    = datetime.utcnow()
            start  = datetime(now.year, now.month, 1)
            end    = datetime(now.year, now.month + 1, 1) - timedelta(days=1) if now.month < 12 \
                     else datetime(now.year + 1, 1, 1) - timedelta(days=1)

            budgets.append({
                "_id":           {"$oid": oid()},
                "userId":        {"$oid": uid},
                "name":          f"{cat} Budget",
                "category":      cat,
                "limitAmount":   limit,
                "spentAmount":   min(spent, limit * 1.30),
                "period":        "monthly",
                "startDate":     {"$date": start.isoformat() + "Z"},
                "endDate":       {"$date": end.isoformat() + "Z"},
                "isActive":      True,
                "alertThreshold": 80,
                "createdAt":     {"$date": start.isoformat() + "Z"},
            })
    return budgets


def generate_savings_goals(users):
    goal_templates = [
        ("Wedding Fund", "💍", 20000, 50000),
        ("Emergency Fund", "🛡️", 10000, 30000),
        ("Vacation", "✈️", 5000, 15000),
        ("New Laptop", "💻", 15000, 25000),
        ("Car Down Payment", "🚗", 30000, 80000),
        ("Home Renovation", "🏠", 15000, 40000),
    ]
    goals = []
    now   = datetime.utcnow()

    for u in users:
        uid = u["_id"]["$oid"]
        selected = random.sample(goal_templates, random.randint(1, 3))
        for (name, icon, lo, hi) in selected:
            target  = random.randint(lo, hi)
            saved   = round(target * random.uniform(0.0, 0.90), 2)
            months  = random.randint(3, 24)
            deadline = now + timedelta(days=months * 30)
            goals.append({
                "_id":         {"$oid": oid()},
                "userId":      {"$oid": uid},
                "name":        name,
                "icon":        icon,
                "targetAmount":target,
                "savedAmount": saved,
                "deadline":    {"$date": deadline.isoformat() + "Z"},
                "priority":    random.choice(["high", "medium", "low"]),
                "isCompleted": saved >= target,
                "description": "",
                "createdAt":   {"$date": now.isoformat() + "Z"},
            })
    return goals


def generate_debts(users):
    debt_templates = [
        ("Bank Personal Loan", 0.18),
        ("Car Loan",           0.12),
        ("Business Loan",      0.15),
        ("Family Loan",        0.00),
    ]
    debts = []
    now   = datetime.utcnow()

    for u in users:
        uid    = u["_id"]["$oid"]
        income = u["income"]
        # Only 40% of users have debts
        if random.random() > 0.40:
            continue
        selected = random.sample(debt_templates, random.randint(1, 2))
        for (creditor, rate) in selected:
            total   = round(income * random.uniform(2, 8), 2)
            paid    = round(total * random.uniform(0.0, 0.80), 2)
            due     = now + timedelta(days=random.randint(30, 730))
            payments = []
            p_date  = now - timedelta(days=180)
            acc_paid = 0
            while acc_paid < paid:
                p_amt = min(round(total * random.uniform(0.04, 0.08), 2), paid - acc_paid)
                payments.append({
                    "amount": p_amt,
                    "date":   {"$date": p_date.isoformat() + "Z"},
                    "notes":  "Monthly installment"
                })
                acc_paid += p_amt
                p_date   += timedelta(days=30)

            debts.append({
                "_id":          {"$oid": oid()},
                "userId":       {"$oid": uid},
                "creditorName": creditor,
                "totalAmount":  total,
                "paidAmount":   paid,
                "interestRate": rate,
                "dueDate":      {"$date": due.isoformat() + "Z"},
                "status":       "paid" if paid >= total else "active",
                "payments":     payments,
                "description":  "",
                "createdAt":    {"$date": (now - timedelta(days=365)).isoformat() + "Z"},
            })
    return debts


# ─── Main ────────────────────────────────────────────────────────────────────

def save(name, data):
    path = Path("data") / f"{name}.json"
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, default=str)
    print(f"  [OK] {path}  ({len(data):,} records)")

def main():
    print("\n[*] Generating synthetic data...\n")

    print("[1] Users...")
    users = generate_users(200)
    save("users", users)

    print("[2] Transactions (takes a moment)...")
    transactions = generate_transactions(users)
    save("transactions", transactions)

    print("[3] Voice feedback...")
    voice = generate_voice_feedback(transactions)
    save("voice_feedback", voice)

    print("[4] OCR feedback...")
    ocr = generate_ocr_feedback(transactions)
    save("ocr_feedback", ocr)

    print("[5] Budgets...")
    budgets = generate_budgets(users, transactions)
    save("budgets", budgets)

    print("[6] Savings goals...")
    goals = generate_savings_goals(users)
    save("savings_goals", goals)

    print("[7] Debts...")
    debts = generate_debts(users)
    save("debts", debts)

    print(f"\n[DONE] Total transactions: {len(transactions):,}")
    print("[INFO] Load into MongoDB:")
    print("  mongoimport --db hexaverse_test --collection transactions --file data/transactions.json --jsonArray")
    print("  (repeat for each file)\n")

if __name__ == "__main__":
    main()
