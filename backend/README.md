# ZenWill Backend

A FastAPI backend for ZenWill — the Mental Operating System.

## Prerequisites

- Python 3.11+
- PostgreSQL 14+

## Setup

### 1. Create a PostgreSQL database

```sql
CREATE DATABASE zenwill;
```

### 2. Create and activate a virtual environment

```powershell
cd d:\zenwill.me\backend
python -m venv .venv
.venv\Scripts\Activate.ps1
```

### 3. Install dependencies

```powershell
pip install -r requirements.txt
```

### 4. Configure environment

```powershell
copy .env.example .env
```

Edit `.env` and set at minimum:
- `DATABASE_URL` — your PostgreSQL connection string
- `SECRET_KEY` — a long random string (use `python -c "import secrets; print(secrets.token_hex(32))"`)
- `OPENAI_API_KEY` — optional, for real AI coach responses

### 5. Run the server

```powershell
python run.py
```

The API will be available at:
- **API**: http://localhost:8000
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| GET | `/api/v1/profile/me` | Get current user profile |
| PATCH | `/api/v1/profile/me` | Update profile |
| POST | `/api/v1/profile/onboarding` | Submit full onboarding data |
| GET | `/api/v1/mind-profile/` | Get Mind Profile |
| POST | `/api/v1/checkin/` | Submit daily check-in |
| GET | `/api/v1/checkin/today` | Get today's check-in |
| POST | `/api/v1/journal/` | Create journal entry |
| GET | `/api/v1/journal/` | List journal entries |
| GET | `/api/v1/missions/today` | Get today's AI missions |
| POST | `/api/v1/missions/{id}/complete` | Complete a mission |
| POST | `/api/v1/coach/message` | Send AI coach message |
| GET | `/api/v1/coach/history` | Get chat history |
| POST | `/api/v1/emergency/start` | Start emergency session |
| POST | `/api/v1/emergency/complete` | Complete emergency session |
| GET | `/api/v1/analytics/weekly` | Get weekly AI insights |
| GET | `/api/v1/analytics/history` | Get check-in history for charts |
| POST | `/api/v1/events/` | Log behavioral event |

## Architecture

- **FastAPI** — async REST API framework
- **SQLAlchemy async** — ORM with async PostgreSQL via asyncpg
- **Pydantic v2** — request/response validation
- **Jose + Passlib** — JWT auth + bcrypt password hashing
- **OpenAI GPT-4o-mini** — AI coach (optional, falls back to templated responses)
- **PostgreSQL** — primary database

## Mind Profile

The `MindProfile` is the central behavioral object. Every API interaction either reads from or writes to it:
- `mind_strength` — composite 0–100 score
- `recovery_days` — lifetime count, never decreases
- `current_flow` — streak count, resets on relapse
- `risk_score_today` — daily vulnerability prediction
- `top_triggers`, `top_coping_strategies` — learned from behavioral events
