# Billetterie – réservation temporaire de places

Django + DRF + Channels + Celery + PostgreSQL (Neon) côté serveur, React + TypeScript + TanStack Query côté client.

## Installation

Prérequis : Python 3.12, Node 20+, Docker (pour Redis), un projet Neon.

```bash
# 1. Redis (broker Celery, WebSocket, cache du rate limiting)
docker compose up -d

# 2. Backend
cd backend
python -m venv .venv && source .venv/bin/activate     # Windows : .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # puis coller la DATABASE_URL de Neon (sslmode=require)
python manage.py makemigrations accounts ticketing      # une seule fois (migrations non versionnées ici)
python manage.py migrate
python manage.py seed_demo      # comptes + 2 événements
python manage.py runserver      # API + WebSocket (Daphne) sur :8000

# 3. Dans deux autres terminaux (toujours dans backend/, venv activé)
celery -A config worker -l info          # Windows : ajouter -P solo
celery -A config beat -l info            # balayage des réservations expirées + listes d'attente

# 4. Frontend
cd frontend
npm install
npm run dev                     # http://localhost:5173
```

Comptes de démo : `alice / alice12345` (client), `orga / orga12345` (organisateur), `admin / admin12345`.

**Tests** (PostgreSQL requis : `select_for_update` n'a aucun effet sous SQLite, le test de concurrence est ignoré sinon) :
```bash
python manage.py test ticketing
```
**Pic de charge** (200 utilisateurs, 50 sièges – l'événement n°2 du seed) :
```bash
RESERVATION_RATE=100000/min python manage.py runserver   # relancer le serveur avec le rate limit relevé
python scripts/load_test.py --event-id 2 --users 200
# ... ✅ ZÉRO SURVENTE : aucun siège attribué deux fois
```

## Document d'architecture

### Principe général
Le serveur est la seule source de vérité. Le front propose (de façon optimiste), le serveur décide (409 en cas de conflit), puis le front se resynchronise.

### 1. Concurrence : verrou de ligne pessimiste
`reserve_seats` (`ticketing/services/orders.py`) ouvre une transaction, puis exécute `SELECT … FOR UPDATE` sur les sièges demandés, **vérifie** qu'ils sont tous `available`, **modifie** et commit. Deux requêtes sur le même siège : la seconde attend la fin de la première, relit le siège (désormais `held`) et lève `SeatUnavailable` → HTTP 409.

*Pourquoi pessimiste plutôt qu'optimiste ?* Lors d'une ouverture de vente, la contention est forte et prévisible : en optimiste, la plupart des requêtes échoueraient puis réessaieraient. Le verrou fait simplement attendre quelques millisecondes.
*Pas de deadlock* : les sièges sont toujours verrouillés triés par `id`, et les verrous sont pris dans le même ordre partout (commande, puis sièges).
*Défense en profondeur* : `UniqueConstraint(event, row, number)` et un `CheckConstraint` imposent en base qu'un siège libre n'a pas de commande et qu'un siège pris en a une.
*Neon* : `select_for_update` vit dans une transaction, il fonctionne donc avec la chaîne poolée (PgBouncer, mode transaction) comme avec la directe. Les verrous de session (advisory locks) ne fonctionneraient pas en poolé.

### 2. Expiration : trois filets, une seule fonction idempotente
`expire_order` verrouille la commande, vérifie `status == pending` et `expires_at <= now`, puis libère les sièges.
1. **Tâche Celery avec ETA** à `created_at + 10 min` : précise, une tâche par commande.
2. **Balayage Celery beat toutes les 30 s** : rattrape les ETA perdus (redémarrage de Redis).
3. **Expiration paresseuse** : si un siège est bloqué par une commande périmée au moment d'une réservation, on l'expire d'abord. Même sans worker, aucun siège ne reste bloqué.
La fonction pouvant être appelée n'importe quand, N fois, la redondance ne coûte rien. Une commande **payée entre-temps** n'est jamais expirée (garde `status == pending` sous verrou).

### 3. Webhook de paiement : idempotence et cas limites
- **Signature HMAC** (`X-Signature`) : seul le prestataire peut appeler le webhook.
- **Doublons** : `WebhookEvent.provider_event_id` est `UNIQUE`. Le 2ᵉ insert lève `IntegrityError` → réponse 200 `duplicate`, sans effet. La commande est verrouillée avant l'insert, donc deux doublons simultanés se sérialisent. Si le traitement échoue, la transaction (insert compris) est annulée : le prestataire peut réessayer.
- **Arrivée tardive** : sous verrou, si la commande est encore `pending`, les sièges sont encore à nous, donc `paid` (même si l'horloge a dépassé `expires_at` de quelques secondes). Si elle est déjà `expired`/`cancelled`, les sièges ont été libérés (et peut-être revendus) : `refunded`, sans toucher aux sièges.
- **Machine à états** (`Order.TRANSITIONS`) : `pending → paid | expired | cancelled`, `paid → refunded`, `expired → refunded`, `cancelled → refunded`. Tout le reste lève `InvalidTransition`.

### 4. Temps réel
Les changements de sièges sont diffusés par Django Channels (groupe `event_<id>`) **après commit** (`transaction.on_commit`) : on n'annonce jamais un changement annulé. Le canal est descendant uniquement ; toutes les actions passent par REST. Côté front, chaque message patche le cache React Query ; à chaque (re)connexion, le plan est rechargé en entier (les messages envoyés pendant une coupure sont perdus).

### 5. Autres choix
- **Liste d'attente** : quand des sièges se libèrent, le premier inscrit passe `notified` avec une fenêtre de 5 min ; pendant ce temps, seul lui peut réserver (`PriorityWindowActive` → 403). La fenêtre se referme par tâche ETA + balayage.
- **Rôles** : `customer`, `organizer`, `admin`. Le queryset du back-office est filtré par organisateur (un organisateur ne voit que ses événements), les autres reçoivent 403.
- **JWT** : access 5 min, refresh 1 jour avec rotation et blacklist. Rate limiting : réservation (20/min/utilisateur) et login (10/min).
- **Audit** : table `AuditLog` écrite dans la même transaction que l'action (création/annulation/expiration de commande, webhooks, création d'événement, liste d'attente).

## Limites connues et pistes
- Les migrations ne sont pas versionnées (à générer avec `makemigrations`) ; le projet n'a pas été exécuté dans l'environnement de génération : **vérifiez les tests chez vous** et attendez-vous à quelques ajustements.
- Pas de paiement réel : le prestataire est simulé par une tâche Celery.
- Un seul paiement simulé réussit toujours ; pas de scénario d'échec ni de remboursement réel.
- Tokens JWT en `localStorage` (exposés au XSS) : préférer un cookie `HttpOnly` pour le refresh en production.
- WebSocket public et sans authentification (le plan de salle est public) ; `waitlist_notified` diffuse un `userId` à tous les abonnés de l'événement : en production, utiliser un groupe par utilisateur.
- Le paiement tardif est remboursé, sans tenter de reprendre les sièges s'ils sont encore libres.
- La notification de liste d'attente n'est visible que si la personne est sur la page (pas d'e-mail/push).
- Le statut d'une commande est obtenu par polling (2 s) ; un message WebSocket par utilisateur serait plus propre.
- Avec plus de temps : tests front (Vitest + Testing Library + MSW), tests E2E (Playwright) avec deux navigateurs sur le même siège, pagination des événements, Docker pour le backend, CI.
