# Diploma Project Management App

Full-stack project management system for small teams with roles, Kanban board, comments, and time tracking.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL (Prisma ORM)
- Auth: JWT + bcrypt

## Features

- Registration and login
- Role-based access (ADMIN, MANAGER, EXECUTOR, VIEWER)
- Project CRUD
- Task CRUD with status, priority, assignee, due date
- Kanban board with drag and drop
- Comments on tasks
- Time logs (planned/fact)
- Dashboard with basic statistics

## Run with Docker

```bash
docker compose up --build
```

Then open:

- Frontend: http://localhost:5173
- Backend: http://localhost:4000

## Run locally

### 1) Backend

```bash
cd backend
cp .env.example .env
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run dev
```

### 2) Frontend

```bash
cd frontend
npm install
npm run dev
```

## Demo users after seed

- Admin: `admin@example.com` / `admin123`
- Manager: `manager@example.com` / `manager123`
- Executor: `executor@example.com` / `executor123`
- Viewer: `viewer@example.com` / `viewer123`
