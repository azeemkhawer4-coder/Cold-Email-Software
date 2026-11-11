# OutboundOS — Local-First Cold Outreach & Sales Engagement Platform

OutboundOS is a local-first, zero-cost cold email outreach and sales engagement platform that runs directly on your Windows 10/11 laptop. It operates with a **strict $0 software and infrastructure budget** using local SQLite, free email provider quotas, and free-tier AI copy generation.

---

## 🌟 Key Architecture & Highlights

1. **Local SQLite Database (`better-sqlite3`)**:
   - File-based ACID storage in WAL (Write-Ahead Logging) mode.
   - Stored outside the repository at `%LOCALAPPDATA%\OutboundOS\data\outboundos.sqlite` (overridable with `OUTBOUNDOS_DATA_DIR`).
   - SQLite files are never committed to version control.
   - Automated SQL migrations, foreign key enforcement, and parameterized queries.
2. **First-Run Administrator Setup & Local Auth**:
   - First-run setup wizard creates local administrator with scrypt-hashed credentials.
   - HTTP-only session cookies with local session management in SQLite.
   - Sensitive OAuth refresh tokens and credentials encrypted with local AES-256-GCM master key (`.secret_key`).
3. **Free Email Dispatch (Gmail API, Microsoft Graph, SMTP/IMAP)**:
   - Primary: Gmail API with server-side OAuth 2.0 (free quota: 500 emails/day personal, 2,000 emails/day Workspace).
   - Optional: Microsoft Graph REST integration on free Outlook.com/M365 accounts.
   - Optional: Custom SMTP/IMAP for domain mailboxes or Ethereal sandbox testing.
4. **Autonomous Background Sending Engine**:
   - SQLite-backed sending queue with persistent jobs surviving application restarts.
   - Automatic stop-on-reply, stop-on-bounce, and stop-on-unsubscribe.
   - Exponential retry backoff, schedule time windows, and idempotency protection against duplicate sends.
   - Executes continuously in the background while the application runs on your laptop.
5. **Free Google Gemini AI (`gemini-2.5-flash`)**:
   - Sequence generation, email shortening, spam analysis, and sentiment classification using Google AI Studio free tier (1,500 requests/day free).
   - Graceful fallback: If no API key is provided, the application runs normally without crashing.
6. **Built-in Local Deliverability & DNS MX Verifier**:
   - Validates RFC 5322 syntax and resolves authoritative mail server DNS MX records locally without paid credits (no ZeroBounce/NeverBounce required).
7. **Complete Database Backup & Restore**:
   - 1-click ACID database snapshot creation without taking the app offline (`backup-database.bat`).
   - Safe restoration with integrity checks (`restore-database.bat` & `scripts/db-cli.ts`).

---

## 🚀 1-Click Launch on Windows 10 & 11

### Intended Workflow:
```
DOWNLOAD ZIP → EXTRACT → DOUBLE-CLICK START.BAT → OPEN OUTBOUNDOS
```

1. **Extract the ZIP file** to any folder on your laptop.
2. **Double-click `start.bat`**:
   - Verifies Node.js installation (v20+ recommended).
   - Initializes local data directory at `%LOCALAPPDATA%\OutboundOS\data`.
   - Runs `npm install` on first launch.
   - Automatically opens OutboundOS in Chrome or Edge at `http://localhost:3000`.
3. **On First Run**: Complete the short Administrator Setup modal (Name, Email, Master Password, Workspace Name).
4. **To Stop**: Double-click `stop.bat` or press `Ctrl + C` in the console.

---

## 💾 Database Backup & Restore

### Creating a Backup:
Double-click **`backup-database.bat`** (or run `npx tsx scripts/db-cli.ts backup`).
- Generates an online, ACID-consistent snapshot:
  `%LOCALAPPDATA%\OutboundOS\data\backups\outboundos_backup_YYYY-MM-DD_HHMMSS.sqlite`

### Restoring from Backup:
Double-click **`restore-database.bat`** (or run `npx tsx scripts/db-cli.ts restore <filename>`).
- Performs a pre-restore backup, validates backup file integrity via `PRAGMA integrity_check`, safely closes the live connection, and restores the database.

---

## 🔧 Optional Configuration (`.env`)

No environment variables are required to start the application. To connect optional services:

1. Copy `.env.example` to `.env`:
   ```cmd
   copy .env.example .env
   ```
2. Optional Settings:
   - `GEMINI_API_KEY`: Free AI Studio key for copy generation.
   - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`: For Gmail OAuth 2.0.
   - `OUTBOUNDOS_DATA_DIR`: Custom database directory override.

---

## 🧪 Testing & Verification

Run the comprehensive unit and integration test suite:
```bash
npm test
```
All 30 tests execute locally using Node's native test runner (`node:test`), verifying idempotency, linear/branched sequence resolution, sender rotation, email validation, and live SMTP dispatch over a test mailbox.
