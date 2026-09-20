# Aetheris Dashboard

React + Vite dashboard for the existing Aetheris backend.

## Run

From the repository root:

```bash
npm install --prefix dashboard
npm run dev --prefix dashboard
```

Open `http://localhost:5173`.

The dashboard expects the backend at `http://localhost:3000` by default.

## Run the full application

Start these processes separately:

1. Redis container
2. PostgreSQL container
3. Aetheris server:
   `npm start`
4. Aetheris worker:
   `npm run worker`
5. Dashboard:
   `npm install --prefix dashboard && npm run dev --prefix dashboard`

## Runtime behavior

- Socket.IO lifecycle events update the job table immediately.
- Active jobs are polled every second as a fallback for missed realtime events.
- Open job details refresh until the job reaches a terminal state.
- Registration signs the new user in automatically.
- The dashboard validates stored JWT data at startup and clears project state on logout.
- API and connection failures are shown in the interface.
- Socket connections authenticate with the stored JWT.
- The backend enforces project ownership for selection and deletion operations.
