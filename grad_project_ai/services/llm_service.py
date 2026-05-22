import os
import json
import re
from openai import AsyncAzureOpenAI
from services.memory_service import get_chat_history, save_chat_turn

# ─────────────────────────────────────────────
#  FINANCIAL ADVISOR — Chat system prompt
# ─────────────────────────────────────────────

# Base rules — financial data is injected per-request below
SYSTEM_PROMPT_BASE = """You are a personal financial advisor AI assistant for a budgeting app.
The user's up-to-date financial data is provided below under "## Financial Data".

## Rules — follow these exactly:
1. **Answer only what was asked.** Never volunteer a financial summary, overview, or data dump unless the user explicitly requests one.
2. **No hallucination.** Only cite figures that appear verbatim in the Financial Data. If a number is absent, say "I don't have that information".
3. **Simple data lookups** (e.g. "what is my balance?", "what's my income?"): respond with 1–3 short sentences containing only the directly relevant figure(s). No extra commentary.
4. **Advice questions** (e.g. "how can I save more?", "am I overspending?"): give actionable advice tied to specific numbers from the data. Keep it under 6 sentences.
5. **Conversational / general questions** (greetings, clarifications, follow-ups): respond naturally and concisely. You do not need to reference financial data unless it is relevant.
6. Never repeat the same number more than once in a single reply.
7. Be encouraging but honest.

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

Your task is to extract structured data from voice transcripts about purchases or income.

Always respond with valid JSON only — no explanations, no extra text.

Extract these fields:
- itemName: The name of the item purchased or sold (string or null)
- merchant: Where it was bought / from whom (string or null)
- amount: Numeric value only (number or null)
- currency: Currency code (EGP, USD, EUR, etc.) or null. If 'جنيه' → EGP, '$' → USD
- quantity: How many items (number, default 1)
- date: Date mentioned, ISO format (string or null — e.g. "today", "yesterday" → resolve to YYYY-MM-DD)
- rawTranscript: The original input text, unchanged

Common Arabic purchase phrases:
- اشتريت / شريت = "I bought"
- دفعت = "I paid"
- من = "from" (merchant)
- بـ / بـ حوالي = "for / for about" (price)
- جنيه / ج.م = EGP

Return:
{
  "itemName": "...",
  "merchant": "...",
  "amount": 75.0,
  "currency": "EGP",
  "quantity": 1,
  "date": null,
  "rawTranscript": "..."
}"""


async def extract_transaction_info(transcript: str, language: str) -> dict:
    """
    Extract structured financial info from a voice transcript.

    Returns:
        {
            "extracted"       : { itemName, merchant, amount, currency, quantity, date, rawTranscript },
            "confidence"      : float,
            "missingFields"   : list[str],
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
        max_completion_tokens=400
    )

    raw = response.choices[0].message.content.strip()
    raw = re.sub(r"^```[a-z]*\n?", "", raw)
    raw = re.sub(r"\n?```$", "", raw)

    try:
        extracted = json.loads(raw)
    except json.JSONDecodeError:
        extracted = {
            "itemName": None,
            "merchant": None,
            "amount": None,
            "currency": None,
            "quantity": 1,
            "date": None,
            "rawTranscript": transcript,
        }

    # Ensure rawTranscript is always set
    extracted.setdefault("rawTranscript", transcript)

    # Determine missing critical fields
    missing = []
    for field in ("itemName", "amount", "currency"):
        if extracted.get(field) is None:
            missing.append(field)

    # Estimate confidence based on completeness
    filled = sum(
        1 for f in ("itemName", "merchant", "amount", "currency")
        if extracted.get(f) is not None
    )
    confidence = round(0.55 + (filled / 4) * 0.45, 2)
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
- items: Array of { name, quantity, unitPrice, totalPrice } — empty array [] if not itemized
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
  "items": [],
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