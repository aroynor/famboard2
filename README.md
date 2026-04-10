# FamBoard

A self-hosted family schedule and reward tracker for kids. Built with FastAPI, React, SQLite, and ntfy — runs entirely on your home server in Docker.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Home Server (homex)                                            │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  Frontend    │    │  API         │    │  ntfy            │  │
│  │  nginx:80    │───▶│  FastAPI     │───▶│  push server     │  │
│  │  port 8701   │    │  port 8700   │    │  port 8702       │  │
│  └──────────────┘    └──────┬───────┘    └──────────────────┘  │
│                             │                      │            │
│                    ┌────────▼───────┐              │            │
│                    │  SQLite DB     │              │            │
│                    │  /data/        │              ▼            │
│                    └────────────────┘   ┌──────────────────┐   │
│                                        │  ntfy volume     │   │
│                                        └──────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         │                                        │
         ▼                                        ▼
  ┌─────────────┐                        ┌──────────────────┐
  │ Parent      │                        │ Son's phone      │
  │ browser     │                        │ ntfy app         │
  │ (desktop)   │                        │ (push alerts)    │
  └─────────────┘                        └──────────────────┘
```

### Port allocation (no conflicts with existing stack)

| Port | Service         | Notes                             |
|------|-----------------|-----------------------------------|
| 8700 | FamBoard API    | FastAPI, internal only            |
| 8701 | FamBoard UI     | React app via nginx               |
| 8702 | ntfy            | Push notification server          |

**Existing ports avoided:** 2283 (immich), 5432 (joplin-db), 6379 (immich-redis), 8080 (vaultwarden), 8096/8920 (jellyfin), 9090 (filebrowser), 22300 (joplin), 3012 (vaultwarden ws)

### Data flow

1. **Parent** creates tasks with time slots, categories, and point values via the Tasks page
2. **Scheduler** (APScheduler, runs inside the API container) fires a push notification via ntfy 10 minutes before each task
3. **Son's phone** receives the alert via the ntfy app (subscribed to the `famboard` topic)
4. **Son** opens the FamBoard web app on his phone, checks off tasks, adds comments
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
│   └── core/
│       ├── database.py          # SQLAlchemy models + get_db()
│       ├── auth.py              # JWT, bcrypt, guards
│       └── scheduler.py         # APScheduler: reminders + weekly summary
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
│   ├── Dockerfile               # Multi-stage: Vite build → nginx
│   ├── nginx.conf               # Proxy /api/* → api:8700
│   └── src/
│       ├── main.jsx
│       ├── App.jsx              # Router, Nav, auth guards
│       ├── index.css            # Global design tokens + components
│       ├── api.js               # Typed fetch wrapper
│       ├── hooks/
│       │   └── useAuth.jsx      # Auth context + localStorage
│       ├── views/
│       │   ├── Login.jsx
│       │   ├── KidToday.jsx     # Daily schedule, check-offs, filter by category
│       │   ├── KidRewards.jsx   # Reward shop + redemption history
│       │   ├── ParentDashboard.jsx  # Kid overview, bonus points
│       │   ├── ParentTasks.jsx      # Task CRUD, seed button
│       │   ├── ParentAnalytics.jsx  # Bar charts, category breakdown
│       │   └── ParentRewards.jsx    # Reward management, approve redemptions
│       └── components/
│           └── TaskCard.jsx     # Reusable check-off card with comment
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## Quick start

### 1. Clone and configure

```bash
git clone https://github.com/YOUR_USERNAME/famboard.git
cd famboard
cp .env.example .env
```

Edit `.env`:

```bash
# Generate a strong secret key
python3 -c "import secrets; print(secrets.token_hex(32))"

SECRET_KEY=<paste output here>
NTFY_TOPIC=famboard-abhi        # pick a unique topic name
```

### 2. Build and start

```bash
docker compose up -d --build
```

First build takes ~3 minutes (installs Node modules and Python packages).

### 3. Create accounts

```bash
# Create the parent account
curl -X POST http://localhost:8700/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"abhi","name":"Abhi","password":"yourpassword","role":"parent"}'

# Create the kid account
curl -X POST http://localhost:8700/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"liam","name":"Liam","password":"liamspassword","role":"kid"}'
```

### 4. Seed the initial schedule

Log in as parent at `http://homex:8701`, go to **Tasks** → click **"Seed sample tasks"**.

This creates 10 recurring tasks (studies, chores, guitar, football, swimming) and 5 rewards.

### 5. Set up phone notifications

On your son's phone:

1. Install the **ntfy** app ([Android](https://play.google.com/store/apps/details?id=io.heckel.ntfy) | [iOS](https://apps.apple.com/app/ntfy/id1625396347))
2. Tap **+** → add subscription
3. Server URL: `http://homex:8702` (or your server's LAN IP)
4. Topic: whatever you set as `NTFY_TOPIC` (e.g. `famboard-abhi`)

He'll now get push alerts 10 minutes before each scheduled task.

---

## Usage guide

### Parent views

| Page | URL | What you can do |
|------|-----|-----------------|
| Overview | `/parent` | See today's check-offs, grant bonus points |
| Tasks | `/parent/tasks` | Create / edit / archive tasks, adjust points |
| Analytics | `/parent/analytics` | 6-week point trends, category completion, streaks |
| Rewards | `/parent/rewards` | Create rewards, approve redemption requests |

### Kid views

| Page | URL | What they can do |
|------|-----|-----------------|
| Today | `/kid` | Check off tasks, add comments, see points |
| Rewards | `/kid/rewards` | Browse shop, submit redemption requests |

---

## Task categories and default points

| Category | Colour  | Default pts | Examples                          |
|----------|---------|-------------|-----------------------------------|
| Study    | Blue    | 10–15       | Khan Academy, homework, reading   |
| Chore    | Green   | 5           | Morning routine, dishes, room     |
| Sport    | Coral   | 15–20       | Football, swimming                |
| Music    | Purple  | 20          | Guitar practice                   |

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

A solid week (all tasks, all days) earns roughly **150–200 pts**, so rewards land around **3–10 days of effort** — motivating without being impossible.

---

## API reference

Interactive docs at `http://localhost:8700/docs` (Swagger UI auto-generated by FastAPI).

Key endpoints:

```
POST /api/auth/token          Login → JWT
POST /api/auth/register       Create user
GET  /api/tasks/              List active tasks
POST /api/tasks/              Create task (parent only)
GET  /api/logs/{date}         Get today's log rows (auto-created)
PATCH /api/logs/{id}          Check off / add comment
GET  /api/points/summary/{id} Points totals (today / week / month)
POST /api/points/bonus        Grant bonus points (parent only)
GET  /api/analytics/weekly/{id}   6-week trend
GET  /api/analytics/category/{id} Breakdown by category
GET  /api/analytics/streak/{id}   Current day streak
POST /api/admin/seed          Seed sample data (parent only)
```

---

## Updating

```bash
cd famboard
git pull
docker compose up -d --build
```

The SQLite database is stored in a named Docker volume (`famboard_data`) — it survives rebuilds.

---

## Backup

```bash
# Backup the database
docker cp famboard_api:/data/famboard.db ./famboard-backup-$(date +%Y%m%d).db

# Restore
docker cp ./famboard-backup-YYYYMMDD.db famboard_api:/data/famboard.db
docker compose restart api
```

---

## Troubleshooting

**API not starting:**
```bash
docker compose logs api
```

**ntfy notifications not arriving:**
- Confirm the ntfy container is running: `docker compose ps`
- Check the ntfy topic matches between `.env` and the phone app subscription
- Make sure your phone is on the same LAN, or expose port 8702 through your router

**Reset everything:**
```bash
docker compose down -v   # WARNING: deletes all data
docker compose up -d --build
```

---

## Tech stack

| Layer        | Technology                  |
|--------------|-----------------------------|
| API          | FastAPI 0.115, Python 3.12  |
| Database     | SQLite via SQLAlchemy 2.0   |
| Auth         | JWT (python-jose) + bcrypt  |
| Scheduler    | APScheduler 3.10            |
| Push alerts  | ntfy (self-hosted)          |
| Frontend     | React 18, Vite 6            |
| Charts       | Recharts                    |
| Container    | Docker + nginx alpine       |
