# OutboundOS — Enterprise Cold Email Outreach & Sales Engagement Platform

OutboundOS is a desktop-first cold email outreach and sales engagement SaaS application that combines the capabilities of Instantly, Smartlead, Snov.io, and Lemlist.

---

## 🌟 Key Capabilities & Modules

1. **Executive Dashboard**: Real-time aggregated metrics (Leads, Dispatched Sends, Provider Acceptance, Replies, Positive Sentiments, Bounces, Meetings Booked), sending velocity graphs, and mailbox health tracking.
2. **Lead Management**: Complete prospect database with 26+ fields, custom variables, verification status, bulk tagging, CSV export, and deep Lead Profile drawer.
3. **CSV Importer**: Automated column recognition, syntax validation, duplicate detection, and global suppression safeguards.
4. **Lists & Audience Segmentation**: Static lists, dynamic segments, and workspace-wide suppression lists.
5. **Multi-Mailbox Rotation Engine**: Connect Google Workspace, Microsoft 365, or custom SMTP/IMAP servers. Fair round-robin, least-recently-used, and balanced quota algorithms.
6. **Campaign & Sequence Builder**: Visual sequence editor with personalized fallback variables (`{{first_name | fallback: "there"}}`), A/B variant split testing, delay steps, and live prospect preview.
7. **Unified Inbox (Unibox)**: 3-column master inbox with automated inbound reply detection, AI sentiment triage, thread view, and quick reply composer.
8. **Automated Sequence Stopping**: Automatically halts scheduled sequence follow-ups when an inbound reply, bounce, or unsubscribe request is detected.
9. **Deliverability & Domain Health Center**: Live DNS inspection (SPF, DKIM 2048-bit, DMARC quarantine/reject, MX routing) and real-time spam keyword scanner.
10. **Warm-up Dashboard**: Reputation ramp-up curves, inbox placement testing, and account readiness checklists.
11. **CRM & Deal Pipeline**: Horizontal Kanban board tracking deals from New Opportunity to Closed Won with stage valuations.
12. **Automations Builder**: Event-driven rules (e.g., when positive reply is received -> advance deal stage in CRM; when unsubscribe received -> global suppression).
13. **Gemini AI Outreach Copilot**: Server-side `@google/genai` integration with `gemini-3.8-flash` for multi-step sequence writing, email copy shortening, and objection handling.
14. **Integrations & Lead Finder**: Adapters for Google Workspace, Microsoft Graph, SMTP relays, Snov.io API, HubSpot, Zapier webhooks, and live email verification.
15. **Settings & Anti-Spam Compliance**: CAN-SPAM and GDPR mandatory physical business mailing addresses, custom unsubscribe footers, and role-based permissions.
16. **PWA Compliance**: Installable as a native desktop web app in Google Chrome and Microsoft Edge on Windows laptops.

---

## 🏗 Technical Architecture

- **Frontend**: React 19, TypeScript, Tailwind CSS, Lucide icons, Recharts, Vite.
- **Backend**: Node.js, Express, TSX.
- **Database**: Persistent JSON/Firestore adapter engine (`data/outboundos.db.json`) with workspace isolation, audit trails, and atomic state updates.
- **Background Worker**: Durable sending scheduler and execution engine (`src/server/worker.ts`) executing batch dispatches, rate limiting, and reply synchronization.
- **AI Engine**: Server-side Google Gemini API (`@google/genai`) using `gemini-3.8-flash`.

---

## 🚀 Local Installation & Execution

### Prerequisites
- Node.js 20+ installed
- npm or bun

### Step 1: Clone and install dependencies
```bash
npm install
```

### Step 2: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Populate your environment variables (optional for local testing, as local mock adapters and seed databases are included out-of-the-box):
- `GEMINI_API_KEY`: Google Gemini API key for server-side AI copywriting.
- `PORT`: 3000 (default)

### Step 3: Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in Google Chrome or Microsoft Edge.

### Step 4: Run Unit Tests
```bash
npx --yes tsx --test src/utils/templateEngine.test.ts src/utils/senderRotation.test.ts src/utils/emailValidator.test.ts
```

### Step 5: Build for Production
```bash
npm run build
npm start
```

---

## 🔒 Security & Sending Safeguards

- **No client-side API secrets**: AI keys and credentials are kept server-side only.
- **Immediate Unsubscribe Suppression**: Unsubscribes are permanently added to the workspace suppression list and prevent future contact across all campaigns.
- **Domain Throttling**: Limits concurrent messages per company domain per day to prevent domain-wide spam flags.
- **Physical Mailing Address**: Required by CAN-SPAM and automatically appended to every outbound message footer.
