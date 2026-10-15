#!/usr/bin/env python
"""Simule un pic de charge : N utilisateurs se jettent en même temps sur les sièges d'un événement.

    python scripts/load_test.py --event-id 2 --users 200

Prérequis : serveur lancé avec RESERVATION_RATE=100000/min (sinon le rate limiting répond 429,
ce qui est le comportement voulu en production).
"""
import argparse
import random
import threading
import uuid
from collections import Counter
from concurrent.futures import ThreadPoolExecutor

import requests


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://localhost:8000/api")
    ap.add_argument("--event-id", type=int, required=True)
    ap.add_argument("--users", type=int, default=200)
    ap.add_argument("--keep", action="store_true", help="ne pas annuler les commandes à la fin")
    a = ap.parse_args()

    seats = requests.get(f"{a.base}/events/{a.event_id}/seats/").json()
    free = [s["id"] for s in seats if s["status"] == "available"]
    print(f"Événement {a.event_id} : {len(free)} sièges libres, {a.users} utilisateurs")
    if not free:
        raise SystemExit("Aucun siège libre (relancer seed_demo ou annuler les commandes).")

    run = uuid.uuid4().hex[:6]

    def register(i):
        r = requests.post(f"{a.base}/auth/register/", json={
            "username": f"load-{run}-{i}", "email": f"l{i}@test.io", "password": "load-test-12345"})
        r.raise_for_status()
        return r.json()["access"]

    print("Création des comptes...")
    with ThreadPoolExecutor(20) as pool:
        tokens = list(pool.map(register, range(a.users)))

    barrier = threading.Barrier(a.users)

    def attack(token):
        barrier.wait()  # départ simultané
        r = requests.post(
            f"{a.base}/events/{a.event_id}/reserve/",
            json={"seatIds": [random.choice(free)]},
            headers={"Authorization": f"Bearer {token}"},
        )
        body = r.json() if r.content else {}
        return r.status_code, body.get("id"), [s["id"] for s in body.get("seats", [])]

    print("Assaut en cours...")
    with ThreadPoolExecutor(a.users) as pool:
        results = list(pool.map(attack, tokens))

    codes = Counter(code for code, _, _ in results)
    won_seats = [sid for code, _, ids in results if code == 201 for sid in ids]
    order_ids = [oid for code, oid, _ in results if code == 201]

    final = requests.get(f"{a.base}/events/{a.event_id}/seats/").json()
    held = sum(1 for s in final if s["status"] in ("held", "sold"))

    print("\n--- Résultat ---")
    print(f"201 (réussi)  : {codes.get(201, 0)}")
    print(f"409 (conflit) : {codes.get(409, 0)}")
    print(f"429 (limité)  : {codes.get(429, 0)}")
    print(f"autres        : {sum(v for k, v in codes.items() if k not in (201, 409, 429))}")
    print(f"sièges occupés côté serveur : {held}")

    ok = len(won_seats) == len(set(won_seats)) and held == len(won_seats) and held <= len(seats)
    print("\n✅ ZÉRO SURVENTE : aucun siège attribué deux fois" if ok else "\n❌ SURVENTE DÉTECTÉE")

    if not a.keep:
        print("Nettoyage (annulation des commandes)...")
        def cancel(pair):
            tok, oid = pair
            if oid:
                requests.post(f"{a.base}/orders/{oid}/cancel/", headers={"Authorization": f"Bearer {tok}"})
        with ThreadPoolExecutor(20) as pool:
            list(pool.map(cancel, [(t, r[1]) for t, r in zip(tokens, results)]))
    raise SystemExit(0 if ok else 1)


if __name__ == "__main__":
    main()
