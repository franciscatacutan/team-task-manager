# Team Task Manager

A full-stack collaborative work management platform built with Spring Boot, React, TypeScript, PostgreSQL, Docker, and GitHub Actions.

Team Task Manager enables organizations and teams to manage projects, organize tasks, collaborate through task discussions, track activity, and receive contextual notifications within a centralized workspace.

---

## Features

### Authentication & Security

- JWT-based Authentication
- Refresh Token Support
- Protected Routes
- Role-Based Access Control (RBAC)
- Secure API Authorization

### Team Management

- Create and manage teams
- Team ownership management
- Team administrators and members
- Member invitations and removal
- Role management (Owner, Admin, Member)
- Team activity tracking

### Project Management

- Create and manage projects
- Project status tracking
- Project activity timeline
- Team-based project organization

### Task Management

- Create, update, and archive tasks
- Task assignment and ownership
- Support member assignments
- Task priorities
- Due date management
- Advanced task workflow

#### Task Status Workflow

- TODO
- IN_PROGRESS
- IN_REVIEW
- ON_HOLD
- DONE
- CANCELLED

#### Task Priorities

- LOW
- MEDIUM
- HIGH

### Collaboration

- Task discussions and updates
- Activity feeds
- Team activity timeline
- Project activity timeline

### Notifications

Receive notifications for:

- Team member additions
- Team member removals
- Team role changes
- Team ownership transfers
- Project creation and updates
- Project status changes
- Task creation
- Task assignments
- Support member changes
- Task discussions
- Task status updates

### Insights & Analytics

- Team insights
- Project insights
- Task progress tracking

---

## Technology Stack

### Frontend

- React 19
- TypeScript
- Vite
- Tailwind CSS
- React Router
- TanStack Query
- React Hook Form
- Zod
- Axios
- Shadcn UI

### Backend

- Java 21
- Spring Boot 4
- Spring Security
- Spring Data JPA
- Hibernate
- JWT Authentication
- PostgreSQL

### Infrastructure

- Docker
- Docker Compose
- Nginx
- GitHub Actions

---

## Architecture

Frontend (React + TypeScript)
↓
Backend API (Spring Boot)
↓
PostgreSQL Database

Infrastructure:

- Dockerized Frontend
- Dockerized Backend
- Dockerized PostgreSQL
- CI Pipeline via GitHub Actions
- Health Monitoring via Spring Boot Actuator

---

## Project Structure

```text
backend/
├── authentication
├── user
├── team
├── project
├── task
├── notification
├── activity
└── common

frontend/
├── components
├── pages
├── hooks
├── services
├── layouts
└── routes
```

---

## Local Development

### Requirements

- Java 21
- Node.js 22+
- Docker Desktop
- PostgreSQL (optional when using Docker)

### Backend

```bash
cd backend
mvn spring-boot:run
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## Docker Setup

### Start Application

```bash
docker compose up --build
```

### Stop Application

```bash
docker compose down
```

Application URLs:

Frontend:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:8080
```

Health Endpoint:

```text
http://localhost:8080/actuator/health
```

---

## Verification

Frontend checks require Node.js 22.22.2+, 24.15+, or a newer supported even-numbered release. Use `npm ci` to reproduce the lockfile.

```powershell
cd frontend
npm ci
npm test
npm run lint -- --max-warnings 0
npm run build
```

Backend checks require a JDK supporting Java 21 and a running Docker engine:

```powershell
cd backend
.\mvnw.cmd -B -ntp verify
```

On Linux/macOS, use `bash ./mvnw -B -ntp verify`. Set `JAVA_HOME` to your JDK if needed.

Integration tests use a Spring-managed, disposable PostgreSQL 17 container and the `test` profile. They do not use the development database, local `.env`, or real bootstrap credentials. Docker must be available; integration tests fail rather than silently skip when it is missing.

CI runs backend verification, frontend tests, strict lint, production compilation, and Docker image builds. See [Phase 1 notes](docs/phase-1.md) for scope and remaining work.

---

## CI/CD

GitHub Actions automatically:

- Builds the backend
- Builds the frontend
- Validates Docker images
- Verifies application compilation

---

## Screenshots

Screenshots will be added as the application UI continues to evolve.

---

## Future Improvements

- Database migrations with Flyway
- File attachments
- Email notifications
- Real-time updates
- Dashboard analytics improvements
- Production cloud deployment
- Monitoring and observability

---

## License

MIT License
