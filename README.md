# SFA Sales Tracker

A full-stack Sales Force Automation system built with MERN Stack.

## Tech Stack

- **Frontend:** React.js + Vite + Tailwind CSS
- **Backend:** Express.js + Node.js
- **Database:** MongoDB Atlas
- **Auth:** JWT + bcrypt

## Features

- Admin & Staff role-based authentication
- Order Plans management
- Lifting Plans management
- Collections management
- Sales Reports & Dashboard
- Product & Dealer management

## Setup Instructions

### Backend
```bash
cd backend
npm install
# Create .env file with your credentials
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Login Credentials (Development)
```
Admin:  admin@sfa.com  / admin123
Staff:  staff@sfa.com  / staff123
```

## Environment Variables

Create a `.env` file inside `backend/` folder:
```
PORT=8000
MONGO_URI=your_mongodb_uri
JWT_SECRET=your_jwt_secret
JWT_EXPIRE=7d
NODE_ENV=development
```

### Database backups

The backend has an Admin-only backup manager at **Admin Dashboard → Database Backup**. **Create & Download Full Backup** creates a compressed MongoDB Extended JSON archive and downloads it to the current device in one operation. The archive includes every application collection and field, including password hashes and stored tokens, so it can serve as a complete recovery copy. Treat it as highly sensitive: store it only in encrypted, access-controlled storage. The separate PDF download is a readable summary for viewing/printing and is not a restorable backup. Scheduled backup failures also create in-app notifications for Admin users.

Configure backups in `backend/.env` (see [`backend/.env.example`](./backend/.env.example)):

| Variable | Default | Purpose |
| --- | --- | --- |
| `BACKUP_ENABLED` | `true` | Enables scheduled and manual backup creation. |
| `BACKUP_SCHEDULE` | `0 2 * * *` | Cron schedule; by default, one run daily at 2:00 AM. |
| `BACKUP_TIMEZONE` | Server timezone | Optional IANA timezone, such as `Asia/Kathmandu`. |
| `BACKUP_RETENTION_DAYS` | `30` | Remove successful backup files older than this many days, while always preserving the newest successful backup. |
| `BACKUP_DIRECTORY` | `./secure-backups` | Private backup directory; relative paths are resolved from `backend/`. |

The scheduler starts with the backend after MongoDB connects. Each daily execution is claimed through a uniquely indexed MongoDB record, so multiple backend instances sharing the same database do not create duplicate scheduled backups. Backup files are written with owner-only permissions and are served only through the authenticated Admin API. The metadata, execution claims, and activity log are stored in MongoDB. Download archives to encrypted offsite storage so a failure of the application host does not also destroy the only backup copy.

#### Production deployment

The backup directory must be on a **persistent disk/volume** owned by the backend process and mounted read/write. For example, set `BACKUP_DIRECTORY=/var/lib/sfa/secure-backups`, create that directory on the host/volume, and grant the service account access (the backend applies `0700` to the backup directory and `0600` to each file). Do not configure it under `frontend/public`, `frontend/dist`, or any other web-served directory. Admins can download either the complete compressed archive or a readable PDF summary through authenticated endpoints.

The repository only deploys the frontend to Vercel; the scheduler runs in the Node.js backend process. Host the backend on a persistent Node.js service and attach persistent storage: serverless/ephemeral filesystems will not retain backups across restarts. Keep the service running for scheduled execution, set `BACKUP_TIMEZONE` to the intended server timezone if needed, and ensure the MongoDB user can read application collections and create the backup metadata collections/indexes. When running multiple backend instances, all must use the same MongoDB database and shared backup volume; the database execution claim prevents duplicate scheduled runs, while shared storage makes every backup available to whichever instance handles a download. If shared storage is unavailable, run a single backend instance with a persistent volume.

#### Admin API

- `GET /api/admin/backups` — backup system status and history
- `POST /api/admin/backups` — create a manual backup
- `GET /api/admin/backups/:id/archive` — download the complete compressed MongoDB Extended JSON archive
- `GET /api/admin/backups/:id/download` — generate and download a human-readable PDF for a backup
- `DELETE /api/admin/backups/:id` — permanently delete a backup

Every endpoint uses the existing JWT authentication middleware and requires the `admin` role. Downloads stream through the authenticated API; no public file URL is created. Activity is recorded in MongoDB with the Admin ID/email, action, filename, time, IP (when supplied by Express), and result.
