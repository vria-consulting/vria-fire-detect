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

INGEST_URL = "https://vria-fire-detect.vercel.app/api/ingest/telegram"

# La recherche globale MTProto est bridée sur ce compte (résultats vides) :
# on lit une liste de canaux publics vérifiés — protections civiles, pompiers,
# canaux dédiés aux feux — et on filtre les messages par mots-clés.
CHANNELS = [
    "incendios_forestales",     # 🇪🇸 canal dédié feux de forêt
    "IncendiosForestalesEU",    # 🇪🇸 information incendies forestiers
    "EmergenciasSevilla",       # 🇪🇸 urgences Séville
    "BomberosdeChileOficial",   # 🇨🇱 pompiers du Chili
    "ProtCivileFVG",            # 🇮🇹 protection civile Frioul
    "procivcal",                # 🇮🇹 protection civile Calabre
    "protezionecivileempoli",   # 🇮🇹 protection civile Empoli
    "dsns_telegram",            # 🇺🇦 service d'État des situations d'urgence
    "mchs_official",            # 🇷🇺 ministère des situations d'urgence
]

# Filtre thématique (les canaux généralistes parlent aussi d'autres urgences).
KEYWORDS = [
    "incendi", "fuego", "forestal",             # es / it (incendio, incendios…)
    "feu", "incendie",                          # fr
    "fire", "wildfire",                         # en
    "yangın",                                   # tr
    "φωτιά", "πυρκαγιά",                        # el
    "пожеж", "пожар", "лісов", "лесн",          # uk / ru
    "queimada", "incêndio",                     # pt
    "waldbrand",                                # de
]

WINDOW = timedelta(hours=float(os.environ.get("TG_WINDOW_HOURS", "2")))


def matches(text: str) -> bool:
    low = text.lower()
    return any(k in low for k in KEYWORDS)


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

    for username in CHANNELS:
        try:
            entity = await client.get_entity(username)
            async for msg in client.iter_messages(entity, limit=int(os.environ.get("TG_LIMIT", "30"))):
                text = getattr(msg, "message", None)
                date = getattr(msg, "date", None)
                if not date or date < cutoff:
                    break  # messages triés du plus récent au plus ancien
                if not text or not matches(text):
                    continue
                posts.append(
                    {
                        "text": text[:600],
                        "url": f"https://t.me/{username}/{msg.id}",
                        "channel": getattr(entity, "title", username) or username,
                        "handle": username,
                        "createdAt": date.astimezone(timezone.utc)
                        .isoformat()
                        .replace("+00:00", "Z"),
                    }
                )
        except errors.FloodWaitError as e:
            print(f"FloodWait {e.seconds}s sur @{username} — canal sauté")
            await asyncio.sleep(min(e.seconds, 30))
        except Exception as e:
            print(f"@{username} inaccessible : {type(e).__name__}")
        await asyncio.sleep(1)  # politesse rate-limit entre canaux

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
    if os.environ.get("TG_DRY"):
        # mode QA : dump JSON sur stdout, pas d'envoi
        print(json.dumps(found, ensure_ascii=False))
    else:
        print(f"{len(found)} messages récents trouvés")
        push(found)
