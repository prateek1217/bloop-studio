# Auth backend

Go service backing login/signup for Subtitle Studio. Stores users (email +
bcrypt password hash) in MongoDB and issues a JWT in an httpOnly cookie.

## Setup

```bash
cd backend
cp .env.example .env
# edit .env: set MONGODB_URI to your connection string, and JWT_SECRET to a
# long random string (e.g. `openssl rand -hex 32`).
go run ./cmd/server
```

The server listens on `:8080` by default. The Next.js app proxies
`/api/go/*` to it (see `next.config.ts` / `GO_BACKEND_URL`), so run both at
once during development:

```bash
# terminal 1
cd backend && go run ./cmd/server

# terminal 2, from the repo root
npm run dev
```

## Endpoints

- `POST /api/auth/signup` — `{ email, password, confirmPassword }`
- `POST /api/auth/login` — `{ email, password }`
- `POST /api/auth/logout`
- `GET /api/auth/me` — `{ authenticated, user? }`, always 200

All auth endpoints are reached from the browser via `/api/go/...`, never
`localhost:8080` directly — that's what keeps the session cookie same-origin
without any CORS setup.
