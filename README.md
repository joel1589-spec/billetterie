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
