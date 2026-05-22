"""
memory_service.py
─────────────────
Async MongoDB helper that stores the last 5 conversation turns
(5 user + 5 assistant = 10 message objects) per user.

Collection: chat_histories
Document shape:
{
    "userId":    "<string>",
    "messages":  [ { "role": "user"|"assistant", "content": "...", "ts": "<ISO>" }, ... ],
    "updatedAt": <datetime>   ← TTL index (30 days)
}
"""

import os
import datetime
from typing import List, Dict

from motor.motor_asyncio import AsyncIOMotorClient

# ── module-level singletons ───────────────────────────────────────────────────
_client: AsyncIOMotorClient | None = None
_collection = None

MAX_TURNS = 5          # how many user+assistant pairs to remember
MAX_MESSAGES = MAX_TURNS * 2   # = 10 message objects


def _get_collection():
    """Lazy-init the Motor client + return the collection handle."""
    global _client, _collection
    if _collection is None:
        uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017/hexaverse-auth")
        _client = AsyncIOMotorClient(uri)

        # derive DB name from the URI (everything after the last '/')
        db_name = uri.rstrip("/").rsplit("/", 1)[-1] or "hexaverse-auth"
        db = _client[db_name]
        _collection = db["chat_histories"]

    return _collection


async def _ensure_indexes():
    """Create indexes once at startup (idempotent)."""
    col = _get_collection()
    # Unique index on userId for fast lookup
    await col.create_index("userId", unique=True)
    # TTL: auto-delete documents not updated in 30 days
    await col.create_index(
        "updatedAt",
        expireAfterSeconds=30 * 24 * 3600,
        name="ttl_30d",
    )


async def get_chat_history(user_id: str) -> List[Dict]:
    """
    Return the stored message list for *user_id*.
    Each item is  { "role": "user"|"assistant", "content": "..." }
    (the 'ts' field is stripped so the LLM never sees it).
    Returns [] if no history exists yet.
    """
    if not user_id:
        return []

    col = _get_collection()
    doc = await col.find_one({"userId": user_id}, {"_id": 0, "messages": 1})
    if not doc:
        return []

    # Strip internal 'ts' field before handing to the LLM
    return [{"role": m["role"], "content": m["content"]} for m in doc.get("messages", [])]


async def save_chat_turn(user_id: str, user_msg: str, assistant_msg: str) -> None:
    """
    Append the latest user+assistant pair to the history, then trim to
    the last MAX_MESSAGES entries so the collection never grows unbounded.
    Uses upsert so the document is created on the first message.
    """
    if not user_id:
        return

    now = datetime.datetime.utcnow()

    new_messages = [
        {"role": "user",      "content": user_msg,      "ts": now.isoformat()},
        {"role": "assistant", "content": assistant_msg,  "ts": now.isoformat()},
    ]

    col = _get_collection()

    # Atomically push new messages and slice to the last MAX_MESSAGES
    await col.update_one(
        {"userId": user_id},
        {
            "$push": {
                "messages": {
                    "$each": new_messages,
                    "$slice": -MAX_MESSAGES,   # keep only the newest N
                }
            },
            "$set": {"updatedAt": now},
            "$setOnInsert": {"userId": user_id},
        },
        upsert=True,
    )


async def clear_chat_history(user_id: str) -> None:
    """Delete all chat history for a user (for future opt-out endpoint)."""
    if not user_id:
        return
    col = _get_collection()
    await col.delete_one({"userId": user_id})
