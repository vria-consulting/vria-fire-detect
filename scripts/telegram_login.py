#!/usr/bin/env python3
"""Génère la session string Telegram de VigiFire (à exécuter UNE fois, localement).

    pip3 install telethon
    python3 scripts/telegram_login.py

Telegram enverra un code de connexion dans votre app : saisissez-le ici.
Le script affiche ensuite une longue chaîne — c'est la session string, à
transmettre pour qu'elle soit stockée dans les secrets GitHub Actions.
⚠️ Cette chaîne donne accès à votre compte Telegram : ne la publiez nulle part.
"""

from telethon.sync import TelegramClient
from telethon.sessions import StringSession

API_ID = 37676736
API_HASH = "653d632b05a486df5aad0b7c8d42e748"

with TelegramClient(StringSession(), API_ID, API_HASH) as client:
    print("\n=== Session string VigiFire (à me transmettre) ===\n")
    print(client.session.save())
    print("\n===================================================")
