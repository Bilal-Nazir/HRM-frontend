# Be My Admin Frontend

Next.js frontend for the HRM backend.

## Setup

1. Copy `.env.example` to `.env.local`.
2. Set `NEXT_PUBLIC_API_URL` to the backend URL (default: `http://localhost:8080`).
3. Run `npm install`.
4. Run `npm run dev`.
5. Open `http://localhost:3000`.

The backend must be running and an organization must already be created through `POST /organization/bootstrap`.

## Included screens

- Organization-aware login
- Dashboard overview
- Employee directory and employee creation
- Attendance check-in/check-out with browser geolocation
- Attendance history
- Leave request form and history
- Direct-report leave approval/rejection

The access token and user session are stored in browser local storage for this MVP. A production deployment should move authentication to secure HTTP-only cookies.
