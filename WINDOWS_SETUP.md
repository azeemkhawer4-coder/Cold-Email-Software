# OutboundOS — Windows 11 Local Installation & Operator Guide

This guide provides end-to-end instructions for running **OutboundOS** directly on a Windows 11 laptop or desktop without needing Cloud Run, Docker, or Google AI Studio.

---

## ⚡ Quick Start: 1-Click Launch (Recommended)

1. **Extract the ZIP file** to a local folder (e.g. `C:\OutboundOS` or `C:\Users\YourName\Projects\OutboundOS`).
2. Ensure you have **Node.js 20 LTS or higher** installed ([Download Node.js](https://nodejs.org/)).
3. **Double-click `start.bat`**.
   - `start.bat` automatically checks your Node.js environment.
   - It creates `.env` from `.env.example` if it doesn't already exist.
   - It runs `npm install` on first launch to populate `node_modules`.
   - It starts the OutboundOS local server on port 3000 with the background worker.
   - It opens your default web browser (Google Chrome or Microsoft Edge) directly to `http://localhost:3000`.
4. To stop the server at any time:
   - Press `Ctrl + C` in the Command Prompt window, OR
   - Double-click **`stop.bat`**.

---

## 📋 System Requirements

* **Operating System**: Windows 11 (or Windows 10 64-bit)
* **Runtime**: Node.js v20.x or v22.x LTS ([nodejs.org](https://nodejs.org/))
* **Browser**: Google Chrome, Microsoft Edge, or Brave
* **Memory**: Minimum 4 GB RAM (8 GB recommended)
* **Disk Space**: ~350 MB for dependencies and local database

---

## 🛠 Manual Installation & Execution (PowerShell or Command Prompt)

If you prefer using the command line:

### Step 1: Open Terminal in the project directory
Open Windows Terminal, PowerShell, or Command Prompt:
```cmd
cd C:\path\to\OutboundOS
```

### Step 2: Install Dependencies
```cmd
npm install
```

### Step 3: Configure Environment Variables
Copy `.env.example` to `.env`:
```cmd
copy .env.example .env
```
*(In PowerShell: `Copy-Item .env.example .env`)*

### Step 4: Start OutboundOS
```cmd
npm run dev
```

The application will be live at:
👉 **[http://localhost:3000](http://localhost:3000)**

### Step 5: Run Automated Tests
OutboundOS includes 30 automated integration and unit test suites that verify sequence branching, linear delays, durable queue retries, and real SMTP dispatch:
```cmd
npm test
```

### Step 6: Production Build & Run
To run the optimized production bundle:
```cmd
npm run build
npm start
```

---

## 💾 Database Persistence (`data/outboundos.db.json`)

OutboundOS uses a persistent, high-performance JSON database stored locally at:
```
data\outboundos.db.json
```
- **Zero External DB Required**: You do not need to install PostgreSQL, MySQL, or MongoDB.
- **Persistence**: All mailboxes, leads, CSV imports, sequences, A/B variants, CRM deals, and audit logs are saved to this file.
- **Backups**: To backup your entire workspace, simply copy the `data\outboundos.db.json` file.
- **Fresh Reset**: To reset to factory defaults, delete the `data` folder and restart the app; OutboundOS will automatically regenerate clean initial workspace data.

---

## 🤖 1. Google Gemini AI Configuration

OutboundOS integrates server-side Gemini AI for:
- Cold email sequence drafting (personalized 3-step outreach with hooks)
- Email copy improver & spam trigger reduction
- Inbound reply sentiment classification (Interested, Meeting Booked, Not Interested, OOO)
- AI Outreach Copilot chat assistant
- Target domain lead prospector & executive email discovery

### How to get your API Key:
1. Visit **[Google AI Studio](https://aistudio.google.com/app/apikey)**.
2. Sign in with your Google account and click **Create API Key**.
3. Copy the key and paste it into your `.env` file:
   ```env
   GEMINI_API_KEY="AIzaSyYourGeneratedGeminiKey..."
   ```
4. Restart OutboundOS (`start.bat`).

*(Note: OutboundOS functions completely even without an API key; built-in heuristic pattern matchers act as automatic fallbacks for classification and prospecting).*

---

## 📧 2. Google Workspace & Gmail API Setup

OutboundOS can dispatch emails through real Google Workspace and personal Gmail mailboxes using the official Gmail REST API with OAuth 2.0.

### Setup Instructions:
1. Go to the **[Google Cloud Console](https://console.cloud.google.com/)**.
2. Create a new project (e.g. `OutboundOS-Local`).
3. Navigate to **APIs & Services > Library**, search for **Gmail API**, and click **Enable**.
4. Navigate to **APIs & Services > OAuth consent screen**:
   - User Type: **External** (or **Internal** if using Google Workspace).
   - Fill in App Name (`OutboundOS`) and your developer email.
   - Click **Save and Continue**.
5. Navigate to **APIs & Services > Credentials**:
   - Click **Create Credentials > OAuth client ID**.
   - Application Type: **Web application**.
   - Name: `OutboundOS Local Client`.
   - **Authorized redirect URIs**:
     `http://localhost:3000/api/auth/google/callback`
   - Click **Create**.
6. Copy the **Client ID** and **Client Secret** into your `.env` file:
   ```env
   GOOGLE_CLIENT_ID="123456789-xxxx.apps.googleusercontent.com"
   GOOGLE_CLIENT_SECRET="GOCSPX-yyyy"
   GOOGLE_REDIRECT_URI="http://localhost:3000/api/auth/google/callback"
   ```
7. In OutboundOS, go to **Email Accounts > Connect New Account > Google Workspace**, and enter your credentials.

---

## 🏢 3. Microsoft 365 & Outlook Graph API Setup

OutboundOS supports Microsoft 365, Office 365, and Outlook.com accounts via the Microsoft Graph REST API.

### Setup Instructions:
1. Go to the **[Microsoft Entra / Azure Portal](https://portal.azure.com/)**.
2. Navigate to **Microsoft Entra ID > App registrations > New registration**:
   - Name: `OutboundOS Local`.
   - Supported account types: **Accounts in any organizational directory (Multitenant) and personal Microsoft accounts**.
   - Redirect URI: Select **Web** and enter:
     `http://localhost:3000/api/auth/microsoft/callback`
   - Click **Register**.
3. Under **Overview**, copy the **Application (client) ID**.
4. Navigate to **Certificates & secrets**:
   - Click **New client secret**, enter a description, and click **Add**.
   - Copy the secret **Value** immediately.
5. Navigate to **API permissions**:
   - Click **Add a permission > Microsoft Graph > Delegated permissions**.
   - Add: `Mail.Send`, `Mail.ReadWrite`, and `offline_access`.
   - Click **Grant admin consent** if managing a corporate tenant.
6. Add the credentials to your `.env` file:
   ```env
   MICROSOFT_CLIENT_ID="your-azure-app-client-id"
   MICROSOFT_CLIENT_SECRET="your-azure-client-secret"
   MICROSOFT_TENANT_ID="common"
   MICROSOFT_REDIRECT_URI="http://localhost:3000/api/auth/microsoft/callback"
   ```
7. In OutboundOS, go to **Email Accounts > Connect New Account > Microsoft 365**.

---

## 📬 4. Custom SMTP & IMAP Relays

You can connect dedicated relays like Amazon SES, Mailgun, SendGrid, Postfix, or Google App Passwords:
- Go to **Email Accounts > Connect New Account > Custom SMTP / IMAP**.
- Enter:
  - **SMTP Host & Port** (e.g. `smtp.sendgrid.net`, port 587)
  - **IMAP Host & Port** (e.g. `imap.mail.me.com`, port 993)
  - **Username & Password**
  - **Daily Quota** (e.g. 50 emails/day)
- Click **Verify Handshake & Save**. OutboundOS performs a real TLS handshake before allowing the account into active sending rotation.

### Instant Testing with Controlled Test Mailboxes:
Need to test sequences without using a real email account? Click the **"Generate Controlled Test Mailbox"** button on the Email Accounts page. OutboundOS will provision a live, dedicated test account on Ethereal Email with real SMTP credentials and full web preview of sent messages.

---

## 💾 5. SQLite Database & Backup Management

OutboundOS uses a local ACID SQLite database with Write-Ahead Logging (WAL) and foreign keys enabled:

- **Database Location**: `%LOCALAPPDATA%\OutboundOS\data\outboundos.sqlite`
- **Secret Encryption Key**: `%LOCALAPPDATA%\OutboundOS\data\.secret_key`
- **Backups Location**: `%LOCALAPPDATA%\OutboundOS\data\backups\`
- **Override Path**: Set `OUTBOUNDOS_DATA_DIR` in `.env` to store the database in another location if desired.

### Creating a Manual Backup:
Double-click **`backup-database.bat`** (or execute `npx tsx scripts/db-cli.ts backup`).
- Uses SQLite online backup API to take a non-blocking, transactionally consistent snapshot.
- Generates `outboundos_backup_YYYY-MM-DD_HHMMSS.sqlite`.

### Restoring a Backup:
Double-click **`restore-database.bat`** (or execute `npx tsx scripts/db-cli.ts restore <filename>`).
- Automatically verifies backup integrity before applying.
- Performs an emergency pre-restore snapshot so no data is ever lost.

### Database Integrity Verification:
Run:
```cmd
npx tsx scripts/db-cli.ts integrity
```
Validates the database file structure and returns health confirmation.

---

## 💻 Install as a Native Windows Desktop App (PWA)

OutboundOS is a Progressive Web App (PWA) configured for Windows 11 desktop integration:

1. Launch OutboundOS in **Google Chrome** or **Microsoft Edge** at `http://localhost:3000`.
2. Look at the right side of the browser URL bar:
   - In Chrome: Click the **Install OutboundOS** icon (computer monitor with download arrow).
   - In Edge: Click the **App Available** icon or open `... > Apps > Install OutboundOS`.
3. OutboundOS will open in a dedicated standalone window with its own taskbar icon, native title bar, and Start Menu launcher.

---

## ❓ Troubleshooting & FAQs

### Q: Port 3000 is already in use
**A:** Run `stop.bat` to terminate any hanging Node processes, or change `PORT=3001` in your `.env` file.

### Q: Windows Defender or SmartScreen popup on start.bat
**A:** Click **More info** -> **Run anyway**. Batch files downloaded from GitHub or extracted from ZIPs trigger a standard Windows SmartScreen warning.

### Q: "npm is not recognized as an internal or external command"
**A:** Install Node.js from [nodejs.org](https://nodejs.org/) and make sure the "Add to PATH" option is checked during installation. Restart your computer after installing.

### Q: Do campaigns keep sending when I close Chrome?
**A:** **Yes!** The background sending worker runs in the Command Prompt window powered by `server.ts`. As long as the `start.bat` Command Prompt window is running, emails and sequence steps will continue to dispatch according to your schedule.
