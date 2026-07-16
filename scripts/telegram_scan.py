#!/usr/bin/env python3
"""Veille Telegram VigiFire — exécutée par GitHub Actions toutes les 10 min.

Recherche globale des messages publics récents mentionnant un feu de forêt
(multilingue), puis POST vers l'API VigiFire qui les stocke sur Blob.
Env requis : TELEGRAM_API_ID, TELEGRAM_API_HASH, TELEGRAM_SESSION, CRON_SECRET.
"""

import asyncio
import json
import os
import urllib.request
from datetime import datetime, timedelta, timezone

from telethon import TelegramClient, errors
from telethon.sessions import StringSession
from telethon.tl.functions.messages import SearchGlobalRequest
from telethon.tl.types import InputMessagesFilterEmpty, InputPeerEmpty

INGEST_URL = "https://vria-fire-detect.vercel.app/api/ingest/telegram"

# Expressions fortes uniquement (mêmes langues que la veille Bluesky/GDELT).
TERMS = [
    "feu de forêt",
    "incendie",
    "wildfire",
    "forest fire",
    "incendio forestal",
    "incêndio florestal",
    "Waldbrand",
    "orman yangını",
    "πυρκαγιά",
]

WINDOW = timedelta(hours=2)


async def scan() -> list[dict]:
    client = TelegramClient(
        StringSession(os.environ["TELEGRAM_SESSION"]),
        int(os.environ["TELEGRAM_API_ID"]),
        os.environ["TELEGRAM_API_HASH"],
    )
    await client.connect()
    if not await client.is_user_authorized():
        raise SystemExit("session Telegram invalide ou expirée — régénérer avec telegram_login.py")

    cutoff = datetime.now(timezone.utc) - WINDOW
    posts: list[dict] = []
    seen: set[str] = set()

    for term in TERMS:
        try:
            res = await client(
                SearchGlobalRequest(
                    q=term,
                    filter=InputMessagesFilterEmpty(),
                    # Filtre serveur : sans min_date, Telegram renvoie les posts
                    # les plus « pertinents » (souvent vieux) et rien de récent.
                    min_date=cutoff,
                    max_date=None,
                    offset_rate=0,
                    offset_peer=InputPeerEmpty(),
                    offset_id=0,
                    limit=50,
                )
            )
        except errors.FloodWaitError as e:
            print(f"FloodWait {e.seconds}s sur « {term} » — on saute le terme")
            await asyncio.sleep(min(e.seconds, 30))
            continue

        chats = {c.id: c for c in getattr(res, "chats", [])}
        for msg in getattr(res, "messages", []):
            text = getattr(msg, "message", None)
            date = getattr(msg, "date", None)
            peer = getattr(msg, "peer_id", None)
            if not text or not date or date < cutoff:
                continue
            channel_id = getattr(peer, "channel_id", None)
            chat = chats.get(channel_id) if channel_id else None
            username = getattr(chat, "username", None) if chat else None
            if not username:
                continue  # sans username public, pas d'URL consultable
            url = f"https://t.me/{username}/{msg.id}"
            if url in seen:
                continue
            seen.add(url)
            posts.append(
                {
                    "text": text[:600],
                    "url": url,
                    "channel": getattr(chat, "title", username) or username,
                    "handle": username,
                    "createdAt": date.astimezone(timezone.utc).isoformat().replace("+00:00", "Z"),
                }
            )
        await asyncio.sleep(2)  # politesse rate-limit entre les termes

    await client.disconnect()
    return posts


def push(posts: list[dict]) -> None:
    body = json.dumps({"posts": posts}).encode()
    req = urllib.request.Request(
        INGEST_URL,
        data=body,
        method="POST",
        headers={
            "content-type": "application/json",
            "x-cron-secret": os.environ["CRON_SECRET"],
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        print("ingest:", resp.status, resp.read().decode()[:200])


if __name__ == "__main__":
    found = asyncio.run(scan())
    print(f"{len(found)} messages récents trouvés")
    push(found)
