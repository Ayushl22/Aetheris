# Aetheris Dashboard

React + Vite dashboard for the existing Aetheris backend.

## Run

From the `dashboard` folder:

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

The dashboard expects the backend at `http://localhost:3000` by default.

## Important

Start these processes separately:

1. Redis container
2. PostgreSQL container
3. Aetheris server:
   `cd server && node server.js`
4. Aetheris worker:
   `cd worker && node worker.js`
5. Dashboard:
   `cd dashboard && npm install && npm run dev`

## Current frontend fixes

- Socket.IO job lifecycle events update the job table immediately.
- Jobs in QUEUED/WAITING/DELAYED/PROCESSING/ACTIVE are also polled from PostgreSQL every second as a reliability fallback.
- The Job Details modal refreshes while a job is still running, so PROCESSING -> COMPLETED/FAILED is reflected automatically.
- Removed overlapping socket-triggered database requests that could race and overwrite newer state with older data.
- Registration automatically logs the new account in and opens the dashboard.
- JWT/localStorage handling is validated on startup.
- Logout clears the selected project and resets the dashboard section.
- API errors and backend-unavailable errors are shown clearly.
- Socket authentication uses the stored JWT.
- Project selection and project deletion are kept user-scoped by the existing backend.

This frontend does not change the existing Aetheris server or worker contracts.
