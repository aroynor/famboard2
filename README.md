# FamBoard

A self-hosted family schedule and reward tracker for kids. Built with FastAPI, React, SQLite, and ntfy — runs entirely on your home server in Docker, reverse-proxied by your existing Caddy instance.

---

## Architecture

```
                        ┌─────────────────────────────────────────────────┐
                        │  Home Server (homex)                            │
                        │                                                 │
  Browser / Phone ──────┤──▶ Caddy (system, existing)                    │
                        │       │                                         │
                        │       ├──▶ famboard_frontend:3000 (caddy_net)   │
                        │       │        Caddy static file server         │
                        │       │        serves React build               │
                        │       │        proxies /api/* ──────────┐       │
                        │       │                                 │       │
                        │       └──▶ ntfy.home ──▶ famboard_ntfy  │       │
                        │                                         ▼       │
                        │                         famboard_api:8700       │
                        │                         FastAPI / APScheduler   │
                        │                              │                  │
                        │                     ┌────────▼────────┐        │
                        │                     │  SQLite DB      │        │
                        │                     │  Docker volume  │        │
                        │                     └─────────────────┘        │
                        └─────────────────────────────────────────────────┘
                                                          │
                                       ┌──────────────────▼────────────┐
                                       │  Son's phone                  │
                                       │  ntfy app (push alerts)       │
                                       └───────────────────────────────┘
```

### How Caddy fits in

FamBoard has **no exposed ports for the frontend or API** — they live entirely inside Docker networks and are only reachable through your existing system Caddy via reverse proxy. The only exposed port is `8702` for ntfy (direct LAN phone access), which Caddy can also proxy under a hostname if you prefer.

### Port allocation

| Port | Service      | Exposed | Notes                                        |
|------|--------------|---------|----------------------------------------------|
| 8700 | FamBoard API | No      | Internal only, on `famboard_net`             |
| 3000 | Frontend     | No      | Internal, Caddy reaches it via `caddy_net`   |
| 8702 | ntfy         | Yes     | LAN phone access; Caddy can also proxy this  |

**Existing ports avoided:** 2283 (immich), 5432 (joplin-db), 6379 (immich-redis), 8080 (vaultwarden), 8096/8920 (jellyfin), 9090 (filebrowser), 22300 (joplin), 3012 (vaultwarden ws)

### Data flow

1. **Parent** creates tasks with time slots, categories, and point values via the Tasks page
2. **Scheduler** (APScheduler, inside the API container) fires a push notification via ntfy 10 minutes before each task
3. **Son's phone** receives the alert via the ntfy app (subscribed to the `famboard` topic)
4. **Son** opens FamBoard on his phone browser, checks off tasks, adds comments
5. **Parent** sees real-time completion on the dashboard, can grant bonus points
6. **Every Sunday at 20:00** the scheduler posts a weekly summary notification with total points
7. **Son** browses the reward shop and submits redemption requests; parent approves them

---

## Project structure

```
famboard/
├── backend/
│   ├── main.py                  # FastAPI app, lifespan, CORS, routers
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── core/
│   │   ├── database.py          # SQLAlchemy models + get_db()
│   │   ├── auth.py              # JWT, bcrypt, guards
│   │   └── scheduler.py         # APScheduler: reminders + weekly summary
│   └── routers/
│       ├── auth.py              # /api/auth — login, register, me
│       ├── tasks.py             # /api/tasks — CRUD task definitions
│       ├── logs.py              # /api/logs — daily check-offs + comments
│       ├── points.py            # /api/points — totals + bonus grants
│       ├── rewards.py           # /api/rewards — shop + redemptions
│       ├── analytics.py         # /api/analytics — weekly trends, categories, streaks
│       └── admin.py             # /api/admin — user list, seed data
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   ├── Dockerfile               # Multi-stage: Vite build → Caddy static server
│   ├── Caddyfile                # Internal: serves /srv, proxies /api/* → api:8700
│   └── src/
│       ├── main.jsx
│       ├── App.jsx              # Router, Nav, auth guards
│       ├── index.css            # Global design tokens + components
│       ├── api.js               # Typed fetch wrapper
│       ├── hooks/
│       │   └── useAuth.jsx      # Auth context + localStorage
│       ├── views/
│       │   ├── Login.jsx
│       │   ├── KidToday.jsx         # Daily schedule, check-offs, filter by category
│       │   ├── KidRewards.jsx       # Reward shop + redemption history
│       │   ├── ParentDashboard.jsx  # Kid overview, bonus points
│       │   ├── ParentTasks.jsx      # Task CRUD, seed button
│       │   ├── ParentAnalytics.jsx  # Bar charts, category breakdown
│       │   └── ParentRewards.jsx    # Reward management, approve redemptions
│       └── components/
│           └── TaskCard.jsx     # Reusable check-off card with comment
├── docker-compose.yml
├── Caddyfile.example            # Blocks to add to your system Caddy
├── .env.example
├── .gitignore
└── README.md
```

---

## Quick start

### 1. Find your Caddy Docker network name

```bash
docker network ls
# Look for the network your Caddy container is attached to

docker inspect <your_caddy_container_name> | grep -A10 Networks
```

Edit `docker-compose.yml` and replace `caddy_net` with your actual network name in two places:

```yaml
# In the frontend service networks list:
networks:
  - famboard_net
  - your_actual_network_name    # ← replace caddy_net here

# At the bottom of the file:
networks:
  your_actual_network_name:
    external: true              # ← and rename caddy_net here too
```

### 2. Clone and configure

```bash
git clone https://github.com/YOUR_USERNAME/famboard.git
cd famboard
cp .env.example .env
nano .env
```

```bash
# Generate a strong secret key:
python3 -c "import secrets; print(secrets.token_hex(32))"

SECRET_KEY=<paste output here>
NTFY_TOPIC=famboard-abhi
NTFY_BASE_URL=https://ntfy.home.abhi   # your ntfy URL (used in notification links)
```

### 3. Add FamBoard to your system Caddyfile

Open your existing Caddyfile and add these blocks (see also `Caddyfile.example`):

```caddy
famboard.home {
    reverse_proxy famboard_frontend:3000
}

# Optional — nice hostname for ntfy instead of bare port 8702
ntfy.home {
    reverse_proxy famboard_ntfy:80
}
```

Replace `.home` with your actual local domain. Then reload Caddy:

```bash
docker exec <caddy_container> caddy reload --config /etc/caddy/Caddyfile
```

### 4. Build and start FamBoard

```bash
docker compose up -d --build
```

First build takes ~3 minutes (Node modules + Python packages).

### 5. Create accounts

Run from the homeserver (API is not exposed externally):

```bash
# Parent account
curl -X POST http://localhost:8700/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"abhi","name":"Abhi","password":"yourpassword","role":"parent"}'

# Kid account
curl -X POST http://localhost:8700/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"liam","name":"Liam","password":"liamspassword","role":"kid"}'
```

### 6. Seed the initial schedule

Open `https://famboard.home` in your browser, log in as parent, go to **Tasks** → click **"Seed sample tasks"**.

This creates 10 recurring tasks (studies, chores, guitar, football, swimming) and 5 rewards.

### 7. Set up phone notifications (son's phone)

1. Install the **ntfy** app ([Android](https://play.google.com/store/apps/details?id=io.heckel.ntfy) | [iOS](https://apps.apple.com/app/ntfy/id1625396347))
2. Tap **+** → add subscription
3. Server URL: `https://ntfy.home` (if proxied via Caddy) or `http://homex:8702` (direct LAN)
4. Topic: the value you set for `NTFY_TOPIC` (e.g. `famboard-abhi`)

He'll get push alerts 10 minutes before each scheduled task.

---

## Usage guide

### Parent views

| Page      | URL                 | What you can do                                   |
|-----------|---------------------|---------------------------------------------------|
| Overview  | `/parent`           | See today's check-offs, grant bonus points        |
| Tasks     | `/parent/tasks`     | Create / edit / archive tasks, adjust points      |
| Analytics | `/parent/analytics` | 6-week point trends, category completion, streaks |
| Rewards   | `/parent/rewards`   | Create rewards, approve redemption requests       |

### Kid views

| Page    | URL            | What they can do                          |
|---------|----------------|-------------------------------------------|
| Today   | `/kid`         | Check off tasks, add comments, see points |
| Rewards | `/kid/rewards` | Browse shop, submit redemption requests   |

---

## Task categories and default points

| Category | Colour | Default pts | Examples                        |
|----------|--------|-------------|---------------------------------|
| Study    | Blue   | 10–15       | Khan Academy, homework, reading |
| Chore    | Green  | 5           | Morning routine, dishes, room   |
| Sport    | Coral  | 15–20       | Football, swimming              |
| Music    | Purple | 20          | Guitar practice                 |

### Recurrence options

- **Daily** — appears every day
- **Weekdays** — Mon–Fri only
- **Weekend** — Sat–Sun only
- **Weekly** — once per week (shows every day until done)
- **Once** — one-off task

---

## Reward ideas

| Reward                   | Suggested cost |
|--------------------------|----------------|
| Extra screen time (1 hr) | 50 pts         |
| Choose weekend dinner    | 80 pts         |
| Skip one chore           | 60 pts         |
| Movie night pick         | 100 pts        |
| Late bedtime (Fri, 30m)  | 70 pts         |

A solid week (all tasks, all days) earns roughly **150–200 pts**, so rewards sit around **3–10 days of effort** — motivating without being impossible.

---

## API reference

Interactive docs at `http://localhost:8700/docs` from the homeserver (Swagger UI, auto-generated by FastAPI).

```
POST  /api/auth/token              Login → JWT
POST  /api/auth/register           Create user
GET   /api/tasks/                  List active tasks
POST  /api/tasks/                  Create task (parent only)
GET   /api/logs/{date}             Get day's log rows (auto-created)
PATCH /api/logs/{id}               Check off / add comment
GET   /api/points/summary/{id}     Points totals (today / week / month)
POST  /api/points/bonus            Grant bonus points (parent only)
GET   /api/analytics/weekly/{id}   6-week trend
GET   /api/analytics/category/{id} Breakdown by category
GET   /api/analytics/streak/{id}   Current day streak
POST  /api/admin/seed              Seed sample data (parent only)
```

---

## Updating

```bash
cd famboard
git pull
docker compose up -d --build
```

The SQLite database lives in the `famboard_data` Docker volume and survives rebuilds.

---

## Backup

```bash
# Backup
docker cp famboard_api:/data/famboard.db ./famboard-backup-$(date +%Y%m%d).db

# Restore
docker cp ./famboard-backup-YYYYMMDD.db famboard_api:/data/famboard.db
docker compose restart api
```

---

## Troubleshooting

**Frontend not reachable via Caddy:**
```bash
# Confirm the container is on the right network
docker inspect famboard_frontend | grep -A10 Networks

# Test from Caddy container
docker exec <caddy_container> curl -s http://famboard_frontend:3000
```

**Caddy network name mismatch:**
```bash
docker network ls
# Update docker-compose.yml — replace caddy_net with your actual network name in 2 places
```

**API not starting:**
```bash
docker compose logs api
```

**ntfy notifications not arriving:**
- Check container is running: `docker compose ps`
- Confirm topic in `.env` matches the ntfy app subscription
- Check scheduler logs: `docker compose logs api | grep ntfy`

**Reset everything (deletes all data):**
```bash
docker compose down -v
docker compose up -d --build
```

---

## Tech stack

| Layer         | Technology                 |
|---------------|----------------------------|
| API           | FastAPI 0.115, Python 3.12 |
| Database      | SQLite via SQLAlchemy 2.0  |
| Auth          | JWT (python-jose) + bcrypt |
| Scheduler     | APScheduler 3.10           |
| Push alerts   | ntfy (self-hosted)         |
| Frontend      | React 18, Vite 6           |
| Charts        | Recharts                   |
| Static server | Caddy (inside container)   |
| Reverse proxy | Caddy (system, existing)   |
| Containers    | Docker                     |
