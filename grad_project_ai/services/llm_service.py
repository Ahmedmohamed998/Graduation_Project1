import os
import json
import re
import logging
from openai import AsyncAzureOpenAI
from services.memory_service import get_chat_history, save_chat_turn

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
#  FINANCIAL ADVISOR — Chat system prompt
# ─────────────────────────────────────────────

# Base rules — financial data is injected per-request below
SYSTEM_PROMPT_BASE = """You are a personal financial advisor AI assistant for a budgeting app.
The user's up-to-date financial data is provided below under "## Financial Data".

## Rules — follow these exactly:
1. **Answer only what was asked.** Never volunteer a financial summary, overview, or data dump unless the user explicitly requests one.
2. **Scope strictly limited to finance:** You must outright reject ANY questions unrelated to personal finance, budgeting, or the user's financial data (e.g., recipes, general trivia). Respond politely: "I am a financial advisor and can only help with your finances and budgeting."
3. **No actions allowed:** You are a READ-ONLY advisor. You CANNOT add income, add expenses, create budgets, or perform any actions in the app. If the user asks you to do something, explain that you cannot perform actions and they must use the app's interface to do it. Never pretend or say you will do it.
4. **No hallucination.** Only cite figures that appear verbatim in the Financial Data. If a number is absent, say "I don't have that information".
5. **Simple data lookups** (e.g. "what is my balance?", "what's my income?"): respond with 1–3 short sentences containing only the directly relevant figure(s). No extra commentary.
6. **Advice questions** (e.g. "how can I save more?", "am I overspending?"): give actionable advice tied to specific numbers from the data. Keep it under 6 sentences.
7. **Conversational / general questions** (greetings, clarifications, follow-ups): respond naturally and concisely. You do not need to reference financial data unless it is relevant.
8. Never repeat the same number more than once in a single reply.
9. Be encouraging but honest.

## Financial Data
{financial_data}"""

# ─────────────────────────────────────────────
#  CATEGORIZER — Strict JSON-only system prompt
# ─────────────────────────────────────────────
CATEGORIZE_SYSTEM_PROMPT = """You are a transaction categorization engine for a personal finance app used by Egyptian users who may write in English, Arabic, or a mix of both.

Core Rules:
- Always respond with valid JSON only. Never add explanations, apologies, or extra text outside the JSON.
- Be accurate, conservative, and context-aware.
- Support both English and Arabic input.
- If the text contains multiple items, focus on the main item being described.
- If the text is unclear or missing critical info (amount, type), still return the best possible guess and set "confidence" accordingly.

Available transaction types: "income" or "expense"

Income Categories (use exactly as written):
- Salary / Wages
- Freelance / Side Hustle
- Business Income
- Investments / Dividends
- Bonuses / Commissions
- Gifts / Refunds
- Rental Income
- Other Income

Expense Category Groups and Categories (use exactly as written):
- Housing: Rent/Mortgage, Home Maintenance, Utilities, Internet & Phone, Home Insurance
- Transportation: Fuel/Gas, Car Maintenance/Insurance/Payments, Public Transport/Uber/Taxi, Parking
- Food & Dining: Groceries, Restaurants/Dining Out, Coffee/Snacks/Fast Food
- Healthcare & Medicine: Doctor/Hospital, Pharmacy/Medicine, Health Insurance, Vitamins/Supplements
- Entertainment & Joy: Movies/Streaming, Hobbies/Sports, Concerts/Events, Gaming
- Shopping: Clothing, Electronics, Home Decor/Furniture
- Personal Care: Haircuts/Salon, Cosmetics, Gym/Fitness
- Travel & Vacation: Flights, Hotels, Local Trips
- Education: Courses, Books, School Fees
- Gifts & Donations: Gifts, Charity
- Subscriptions: Streaming, Apps, Gym memberships
- Debt Repayment: Credit Card Payments, Loan Installments
- Miscellaneous: Bank Fees, Pet Care, Childcare, Other

Always return a JSON object with this exact structure:
{
  "type": "income" or "expense",
  "categoryGroup": "<group name or null for income>",
  "category": "<exact category name from the list above>",
  "confidence": <number 0.0 to 1.0>,
  "detectedAmount": <number or null if not found in text>,
  "detectedCurrency": "<EGP, USD, EUR, etc. or null>",
  "suggestedDescription": "<clean short description in English>",
  "language": "en", "ar", or "mixed"
}"""


def _get_azure_client() -> AsyncAzureOpenAI:
    return AsyncAzureOpenAI(
        api_key=os.getenv("AZURE_OPENAI_API_KEY"),
        api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
    )


def _build_system_prompt(user_context: dict) -> str:
    """
    Inject the user's financial data directly into the system prompt.
    The model reads it silently — it is never part of any assistant turn,
    so it will never be parroted back verbatim.
    """
    context_str = json.dumps(user_context, indent=2, ensure_ascii=False)
    return SYSTEM_PROMPT_BASE.format(financial_data=context_str)


# ─────────────────────────────────────────────
#  generate_advice — financial chat
# ─────────────────────────────────────────────
async def generate_advice(
    user_message: str,
    user_context: dict,
    user_id: str | None = None,
) -> dict:
    """
    Call the LLM with:
      [system]  rules + financial data
      [user]    turn 1 (from history)
      [assistant] turn 1
      ...        (up to 5 prior pairs)
      [user]    current message        ← always last

    Then persist the new turn to MongoDB.
    """
    client = _get_azure_client()
    deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")

    # 1. Build the system prompt (data embedded, never printed)
    system_prompt = _build_system_prompt(user_context)

    # 2. Load conversation history for this user
    history = await get_chat_history(user_id) if user_id else []

    # 3. Assemble the message list
    #    system → [history turns] → current user message
    messages = [
        {"role": "system", "content": system_prompt},
        *history,
        {"role": "user", "content": user_message},
    ]

    # 4. Call the LLM
    response = await client.chat.completions.create(
        model=deployment_name,
        messages=messages,
        max_completion_tokens=500,
    )

    reply = response.choices[0].message.content

    # 5. Persist the new turn (fire-and-forget style — don't let a DB error
    #    break the chat response)
    if user_id:
        try:
            await save_chat_turn(user_id, user_message, reply)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(
                f"[memory] Failed to save chat turn for user {user_id}: {e}"
            )

    return {
        "reply": reply,
        "dataUsed": {
            "savingsRate": user_context.get("overview", {}).get("savingsRate", 0),
            "totalIncome":  user_context.get("overview", {}).get("totalIncome",  0),
            "historyLength": len(history) // 2,   # number of prior turns included
        },
    }



# ─────────────────────────────────────────────
#  categorize_transaction — JSON-only response
# ─────────────────────────────────────────────
async def categorize_transaction(text: str) -> dict:
    client = _get_azure_client()
    deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")

    messages = [
        {"role": "system", "content": CATEGORIZE_SYSTEM_PROMPT},
        {"role": "user",   "content": f"Categorize this transaction: {text}"}
    ]

    response = await client.chat.completions.create(
        model=deployment_name,
        messages=messages,
        max_completion_tokens=300
    )

    raw = response.choices[0].message.content.strip()

    # Strip markdown code fences if the model wraps in ```json ... ```
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        # Return a safe fallback so the API never crashes
        result = {
            "type": "expense",
            "categoryGroup": "Miscellaneous",
            "category": "Other",
            "confidence": 0.1,
            "detectedAmount": None,
            "detectedCurrency": None,
            "suggestedDescription": text,
            "language": "en",
            "rawResponse": raw
        }

    return result


# ─────────────────────────────────────────────
#  EXTRACT — Voice transcript → structured info
# ─────────────────────────────────────────────
EXTRACT_SYSTEM_PROMPT = """You are a financial data extraction engine for a personal budgeting app.
The user speaks in Arabic, English, or a mix of both (Egyptian Arabic is common).

Your task is to extract ALL items and prices from voice transcripts about purchases or income.
IMPORTANT: If the user mentions multiple items (e.g. "apples for 10 and bananas for 5"), extract EVERY item into the items array — never drop or merge items.

Always respond with valid JSON only — no explanations, no extra text.

Extract these fields:
- merchant: Where it was bought / from whom (string or null)
- currency: Currency code. If 'جنيه' or 'ج.م' → "EGP", '$' → "USD". Default "EGP" for Arabic input.
- date: Date mentioned, ISO format YYYY-MM-DD (or null)
- rawTranscript: The original input text, unchanged
- items: Array of ALL items mentioned. Each item MUST have its own category. Each item has:
    - name: item name in original language (string)
    - name_en: item name translated to English (string)
    - quantity: number of units (number, default 1)
    - unit_price: price per unit (number or null)
    - total_price: quantity × unit_price (number or null)
    - categoryGroup: one of the exact group names from the list below (DO NOT leave null)
    - category: exact category name from the list below (DO NOT leave null)
- totalAmount: sum of all items' total_price (number or null)

Use these categories (use EXACT strings):

Housing: Rent/Mortgage, Home Maintenance, Utilities, Internet & Phone, Property Tax, Home Insurance, Furniture & Appliances
Transportation: Fuel/Gas, Public Transport/Uber/Taxi, Vehicle Maintenance, Car Insurance, Parking & Tolls, Vehicle Loan, Car Rental
Food & Dining: Groceries, Restaurants/Dining Out, Coffee/Snacks, Fast Food, Food Delivery, Alcohol & Bars
Shopping: Clothing, Electronics, Shoes & Accessories, Jewelry & Watches, Department Stores, Online Shopping, Toys & Hobbies, Books & Magazines, Sports Equipment, Pet Supplies
Personal Care: Hair & Salon, Skincare & Cosmetics, Spa & Massage, Gym & Fitness, Pharmacy & Health
Healthcare: Doctor Visits, Dental Care, Vision Care, Medical Tests, Hospital Bills, Health Insurance
Entertainment: Movies & Theater, Concerts & Events, Games & Gaming, Streaming Services, Music & Podcasts, Amusement Parks
Education: Tuition & Fees, Books & Supplies, Online Courses, Student Loans, Workshops & Training
Bills & Fees: Electricity Bill, Water Bill, Gas Bill, Trash & Recycling, Sewer Bill, HOA Fees, Bank Fees, Late Fees
Insurance: Life Insurance, Health Insurance, Car Insurance, Home Insurance, Travel Insurance
Savings & Investments: Savings Account, Emergency Fund, Retirement Account, Stocks & Bonds, Mutual Funds, Real Estate Investment
Income: Salary, Freelance Income, Business Income, Investment Income, Gift Received, Refund, Bonus, Commission
Gifts & Donations: Gifts Given, Charitable Donations, Religious Offerings, Sponsorships
Travel: Flights, Hotels & Accommodation, Luggage & Travel Gear, Travel Insurance, Tours & Activities
Kids & Family: Childcare & Daycare, School Fees, Children's Clothing, Toys & Games, Allowance, Baby Supplies
Pets: Pet Food, Vet Visits, Pet Supplies, Pet Grooming, Pet Insurance
Miscellaneous: Uncategorized, Other Expenses

Common Arabic purchase phrases:
- اشتريت / شريت = "I bought"
- دفعت = "I paid"
- من = "from" (merchant)
- بـ / بـ حوالي / بسعر = "for / for about" (price)
- جنيه / ج.م = EGP
- و / وكمان = "and" (connecting multiple items)

Examples:
- "اشتريت تفاح بـ 10 جنيه وموز بـ 5 جنيه" →
  items: [{name:"تفاح",name_en:"Apple",quantity:1,unit_price:10,total_price:10,categoryGroup:"Food & Dining",category:"Groceries"},{name:"موز",name_en:"Banana",quantity:1,unit_price:5,total_price:5,categoryGroup:"Food & Dining",category:"Groceries"}], totalAmount: 15
- "I bought 2 kg apples for 20 and a bottle of water for 5" →
  items: [{name:"apples",name_en:"Apples",quantity:2,unit_price:10,total_price:20,categoryGroup:"Food & Dining",category:"Groceries"},{name:"water",name_en:"Water",quantity:1,unit_price:5,total_price:5,categoryGroup:"Food & Dining",category:"Groceries"}], totalAmount: 25

Return:
{
  "merchant": null,
  "currency": "EGP",
  "date": null,
  "rawTranscript": "...",
  "items": [
    {"name": "...", "name_en": "...", "quantity": 1, "unit_price": 0.0, "total_price": 0.0, "categoryGroup": "...", "category": "..."}
  ],
  "totalAmount": 0.0
}"""

async def extract_transaction_info(transcript: str, language: str) -> dict:
    """
    Extract structured financial info from a voice transcript.
    Now supports multi-item receipts via items[] array with categories.

    Returns:
        {
            "extracted"        : { merchant, currency, date, rawTranscript, items[], totalAmount },
            "confidence"       : float,
            "missingFields"    : list[str],
            "needsConfirmation": bool,
        }
    """
    client = _get_azure_client()
    deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")

    messages = [
        {"role": "system", "content": EXTRACT_SYSTEM_PROMPT},
        {"role": "user",   "content": f"Transcript ({language}): {transcript}"}
    ]

    response = await client.chat.completions.create(
        model=deployment_name,
        messages=messages,
        max_completion_tokens=600
    )

    raw = response.choices[0].message.content.strip()
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)

    try:
        extracted = json.loads(raw)
    except json.JSONDecodeError:
        extracted = {
            "merchant": None,
            "currency": None,
            "date": None,
            "rawTranscript": transcript,
            "items": [],
            "totalAmount": None,
        }

    # Ensure required defaults
    extracted.setdefault("rawTranscript", transcript)
    extracted.setdefault("items", [])

    # Re-compute totalAmount from items if the LLM missed it or got it wrong
    items = extracted.get("items") or []
    computed_total = sum(
        (item.get("total_price") or
         ((item.get("unit_price") or 0) * (item.get("quantity") or 1)))
        for item in items
        if item.get("total_price") or item.get("unit_price")
    )
    if computed_total > 0:
        extracted["totalAmount"] = round(computed_total, 2)

    # ─────────────────────────────────────────────────────────────────────────
    # FALLBACK CATEGORIZATION FOR ITEMS MISSING CATEGORIES
    # After LLM extraction, check each item for missing category fields
    # ─────────────────────────────────────────────────────────────────────────
    for item in items:
        has_category = item.get("category") and item.get("categoryGroup")
        
        if not has_category:
            # Build text for categorization from available item data
            item_text = f"{item.get('name_en') or item.get('name', 'unknown')}"
            
            # Add price context if available (helps with categorization)
            price = item.get("total_price") or item.get("unit_price")
            currency = extracted.get("currency", "EGP")
            if price:
                item_text += f" {price} {currency}"
            
            # Call categorize_transaction to get categories
            try:
                cat_result = await categorize_transaction(item_text)
                # Only apply if we got valid categories
                if cat_result.get("categoryGroup") and cat_result.get("category"):
                    item["categoryGroup"] = cat_result.get("categoryGroup")
                    item["category"] = cat_result.get("category")
                    logger.info(f"[Extract] Added categories to item '{item.get('name')}': "
                               f"{cat_result['categoryGroup']} → {cat_result['category']}")
                else:
                    # Default fallback when categorization fails
                    item.setdefault("categoryGroup", "Miscellaneous")
                    item.setdefault("category", "Uncategorized")
                    logger.warning(f"[Extract] Categorization returned no valid categories for '{item.get('name')}', using defaults")
            except Exception as e:
                # Handle categorization service errors gracefully
                item.setdefault("categoryGroup", "Miscellaneous")
                item.setdefault("category", "Uncategorized")
                logger.error(f"[Extract] Categorization failed for '{item.get('name')}': {e}")
        else:
            # Ensure category fields exist (even if present, validate they're not empty strings)
            if not item.get("categoryGroup"):
                item["categoryGroup"] = "Miscellaneous"
            if not item.get("category"):
                item["category"] = "Uncategorized"

    # Determine missing critical fields
    missing = []
    if not items:
        missing.append("items")
    if not extracted.get("totalAmount"):
        missing.append("totalAmount")
    if not extracted.get("currency"):
        missing.append("currency")
    
    # Check if any items are still missing categories (partial success)
    items_missing_categories = [
        item.get("name") for item in items 
        if not item.get("category") or not item.get("categoryGroup")
    ]
    if items_missing_categories:
        missing.append(f"categories_for_items: {items_missing_categories}")

    # Confidence based on new schema
    score = 0
    if items:                          score += 2   # items are most critical
    if extracted.get("totalAmount"):   score += 1
    if extracted.get("currency"):      score += 1
    if extracted.get("merchant"):      score += 1   # bonus
    confidence = round(min(0.55 + (score / 5) * 0.45, 1.0), 2)
    needs_confirmation = confidence < 0.9 or bool(missing)

    return {
        "extracted": extracted,
        "confidence": confidence,
        "missingFields": missing,
        "needsConfirmation": needs_confirmation,
    }

# ─────────────────────────────────────────────
#  OCR EXTRACT — OCR text → structured invoice
# ─────────────────────────────────────────────
OCR_EXTRACT_SYSTEM_PROMPT = """You are an invoice/receipt data extraction engine for a personal finance app.
Users upload invoices from restaurants, rent, utilities, pharmacies, and supermarkets.
Text may be in Arabic, English, or mixed (Egyptian context).

Always respond with valid JSON only — no explanations, no extra text.

Extract:
- vendor: Business name in English (translate if Arabic)
- vendorArabic: Original Arabic name if present (or null)
- invoiceType: "restaurant" | "rent" | "supermarket" | "utility" | "pharmacy" | "transport" | "other"
- items: Array of { name, name_en, quantity, unit_price, total_price } — empty array [] if not itemized
- totalAmount: Final total paid (number)
- taxAmount: Tax amount (number or 0)
- currency: EGP, USD, EUR, etc.
- date: ISO date string (YYYY-MM-DD) or null
- rawText: Original OCR text, unchanged

Common Arabic invoice terms:
- الإجمالي / المجموع = Total
- ضريبة / ض.ق.م = Tax / VAT
- الكمية = Quantity
- السعر = Price
- التاريخ = Date
- الفاتورة = Invoice
- إيجار = Rent
- فاتورة كهرباء = Electricity bill
- صيدلية = Pharmacy

Return:
{
  "vendor": "...",
  "vendorArabic": "...",
  "invoiceType": "...",
  "items": [
    {"name": "...", "name_en": "...", "quantity": 1, "unit_price": 0.0, "total_price": 0.0}
  ],
  "totalAmount": 0.0,
  "taxAmount": 0.0,
  "currency": "EGP",
  "date": null,
  "rawText": "..."
}"""


async def extract_from_ocr_text(
    raw_text: str,
    structured_ocr: dict | None,
    language: str,
    file_type: str,
) -> dict:
    """
    Use LLM to extract structured invoice data from OCR text.

    Returns:
        {
            "extracted"          : { vendor, vendorArabic, invoiceType, items[], totalAmount,
                                      taxAmount, currency, date, rawText },
            "suggestedTransaction": { type, amount, description },
            "confidence"         : float,
            "missingFields"      : list[str],
            "needsConfirmation"  : bool,
        }
    """
    client = _get_azure_client()
    deployment_name = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME")

    # Build user prompt combining raw text + structured hint if available
    user_content = f"Language: {language}\nFile type: {file_type}\n\nOCR Raw Text:\n{raw_text}"
    if structured_ocr:
        user_content += f"\n\nPre-structured OCR fields (use as reference):\n{json.dumps(structured_ocr, ensure_ascii=False, indent=2)}"

    messages = [
        {"role": "system", "content": OCR_EXTRACT_SYSTEM_PROMPT},
        {"role": "user",   "content": user_content}
    ]

    response = await client.chat.completions.create(
        model=deployment_name,
        messages=messages,
        max_completion_tokens=600
    )

    raw = response.choices[0].message.content.strip()
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)

    try:
        extracted = json.loads(raw)
    except json.JSONDecodeError:
        extracted = {
            "vendor": None,
            "vendorArabic": None,
            "invoiceType": "other",
            "items": [],
            "totalAmount": None,
            "taxAmount": 0.0,
            "currency": None,
            "date": None,
            "rawText": raw_text,
        }

    extracted.setdefault("rawText", raw_text)
    extracted.setdefault("items", [])
    extracted.setdefault("taxAmount", 0.0)

    # Missing fields
    missing = []
    for field in ("vendor", "totalAmount", "currency"):
        if not extracted.get(field):
            missing.append(field)

    # Confidence
    filled = sum(
        1 for f in ("vendor", "totalAmount", "currency", "date")
        if extracted.get(f)
    )
    confidence = round(0.55 + (filled / 4) * 0.45, 2)
    needs_confirmation = confidence < 0.9 or bool(missing)

    # Suggested transaction shape
    item_names = ", ".join(
        i.get("name", "") for i in (extracted.get("items") or []) if i.get("name")
    )
    description = extracted.get("vendor") or ""
    if item_names:
        description = f"{description} — {item_names}"

    suggested_transaction = {
        "type": "expense",
        "amount": extracted.get("totalAmount"),
        "description": description.strip(" —"),
    }

    return {
        "extracted": extracted,
        "suggestedTransaction": suggested_transaction,
        "confidence": confidence,
        "missingFields": missing,
        "needsConfirmation": needs_confirmation,
    }