# Be My Admin Frontend

Next.js frontend for the HRM backend.

## Docker deployment

This repository includes a multi-stage Dockerfile using Next.js standalone output.
Keep it alongside `HRM-backend` and use that repository's `compose.yaml` and
`deploy/README.md` to run the complete frontend/backend/MongoDB/Redis stack.
Compose builds this frontend with `NEXT_PUBLIC_API_URL=/api`; Caddy routes API
requests to the backend on the same origin. No private secrets belong in build arguments.

The AWS workflow in `.github/workflows/deploy.yml` builds on pushes to `main`.
The shared AWS server and four Actions secrets are configured. See
`HRM-backend/deploy/AWS-PIPELINE.md` for operations and limitations.

## Setup

1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_API_URL` to the backend URL (default: `https://3.126.250.133/api`). Use `http://localhost:8080` only when explicitly testing a local backend.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open `http://localhost:3000`.

The backend must be running and an organization must already be created through `POST /organization/bootstrap`.

## Cloudflare frontend with AWS backend

Set the Cloudflare build variable `NEXT_PUBLIC_API_URL=https://3.126.250.133/api`.
This URL is public and contains no credentials. The API client also uses this AWS
address if the variable is omitted; Docker's explicit `/api` setting remains supported.
Rebuild the frontend when changing this build variable.

Deploy the matching backend changes to AWS as well. The chat and profile screens
require `/api/chat/*` and `/api/auth/profile*`; an older backend returns 404 even if
the frontend deploy succeeds. Uploads and chat messages are sent directly to AWS,
with existing bearer-token authentication. No local backend is needed for the
deployed frontend.

## Included screens

- Organization-aware login
- Dashboard overview
- Employee directory and employee creation
- Attendance check-in/check-out with browser geolocation
- Attendance history
- Leave request form and history
- Direct-report leave approval/rejection

The access token and user session are stored in browser local storage for this MVP. A production deployment should move authentication to secure HTTP-only cookies.
