# Support Desk

A full-stack support desk application built with **Next.js 16**, **Supabase**, **Redis**, **BullMQ**, and **OpenAI**. Features include authentication, role-based access control, a ticketing system with AI-powered responses, and a real-time chat assistant.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TailwindCSS 4 |
| Auth & Database | Supabase (PostgreSQL) |
| Queue | BullMQ + Redis |
| AI | OpenAI GPT-4o-mini |
| Testing | Jest + React Testing Library |
| Containerization | Docker + Docker Compose |

## Features

### Authentication
- Sign up, login, logout with Supabase Auth
- Forgot password + password update flow
- Session-based middleware protection

### Role-Based Access
- `user` — standard permissions, own data only
- `super_admin` — admin dashboard, can view all users and todo counts

### Todo Management
- Full CRUD (create, read, update, delete)
- Completion toggling
- Users can only access their own todos

### Support Tickets
- Submit tickets via a form
- Tickets are queued via BullMQ for async AI processing
- AI auto-response generation with retry logic

### AI Chat
- Real-time chat with OpenAI integration
- Per-user chat history stored in Redis
- Knowledge-base context for app-specific questions

### Analytics
- Ticket stats endpoint (total, resolved, pending, AI success ratio)

## API Routes

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/todos` | Fetch authenticated user's todos |
| POST | `/api/todos` | Create a new todo |
| PATCH | `/api/todos` | Toggle todo completion |
| DELETE | `/api/todos?id=` | Delete a todo |
| POST | `/api/chat` | Send a message to AI chat |
| POST | `/api/queue` | Add a job to the chat queue |
| GET | `/api/queue/[id]` | Get job status by ID |
| GET | `/api/queue/status?id=` | Get job result |
| GET | `/api/queue/metrics` | Queue job counts |
| POST | `/api/tickets` | Submit a support ticket |
| GET | `/api/analytics` | Get ticket analytics |

## Project Structure

```
support-desk/
├── apps/
│   ├── web/                  # Next.js frontend + API
│   │   ├── app/              # Pages + API routes (App Router)
│   │   ├── lib/               # Supabase, Redis, BullMQ clients
│   │   ├── utils/             # Validation, auth helpers
│   │   └── __tests__/         # Unit + integration tests
│   └── worker/               # Background job worker
├── docker-compose.yml
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+
- Docker (for Redis)
- Supabase project
- OpenAI API key

### Setup

```bash
# Clone and install
git clone https://github.com/SinemZeybek/AI-Powered-Ticket-System.git
cd AI-Powered-Ticket-System/support-desk/apps/web
npm install

# Set up environment variables
cp .env.example .env.local
# Fill in your Supabase, OpenAI, and Redis credentials

# Start Redis via Docker
docker compose up -d

# Run the app
npm run dev
```

### Running Tests

```bash
cd support-desk/apps/web
npx jest
```

## Branch Structure

Each branch represents a week of development:

- `main` — initial setup
- `week1/todo-crud` — todo CRUD, auth, admin panel, tests
- `week2/auth-system` — Supabase auth system, role-based access
- `week3/chat-and-queues` — AI chat, BullMQ queue, Docker, analytics
