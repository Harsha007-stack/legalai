# NyayaConnect AI --- Complete VS Code Build Plan

**Project type:** Hackathon MVP\
**Track:** Civic Pulse, Digital Governance & Public Information\
**Working tagline:** Your Legal Problem. Our AI. The Right Advocate.\
**Primary users:** Citizens seeking preliminary legal information and
advocates receiving consultation requests.

------------------------------------------------------------------------

## 1. Product vision

NyayaConnect AI is an AI-assisted legal information and
advocate-discovery platform for India. A citizen describes a legal
problem in plain language. The application helps them understand the
issue, identify information they may need, explore possible next steps,
prepare an editable document draft, and discover potentially relevant
advocates. The citizen chooses whether to contact an advocate. The
advocate can accept, decline, or propose a different consultation
arrangement.

The platform is a **legal information and connection tool**, not a
substitute for a qualified advocate or a court, police station,
government department, or legal aid authority.

### Core user promise

1.  **Understand:** Explain a legal concern in accessible language and
    collect relevant facts.
2.  **Prepare:** Create a structured case brief, evidence checklist, and
    editable first draft.
3.  **Connect:** Help the citizen discover relevant advocates and send a
    consultation request.
4.  **Coordinate:** Track request status, appointments, and preparation
    tasks.

### Product principles

-   Plain language, accessibility, and mobile-first design.
-   Explain uncertainty; do not present guesses as established law.
-   Cite reliable sources for legal information.
-   Let users inspect and edit AI-generated content.
-   Never send a notice, file a complaint, make a payment, or confirm an
    appointment without the required user approval.
-   Protect sensitive legal documents and personal information.
-   Matching should be explainable and based on relevant criteria, not
    hidden paid placement or lowest-bid competition.

------------------------------------------------------------------------

## 2. Recommended technology stack

Use one JavaScript/TypeScript ecosystem so the team can build quickly in
VS Code.

  -----------------------------------------------------------------------
  Layer                   Technology              Purpose
  ----------------------- ----------------------- -----------------------
  Frontend                React + Vite            Web application

  Language                JavaScript initially;   Shared development
                          TypeScript if team is   ecosystem
                          comfortable             

  Styling                 Tailwind CSS            Responsive UI

  Routing                 React Router            Page navigation

  Server                  Node.js + Express       API, authorization, AI
                                                  calls

  Database                Supabase PostgreSQL     Application data

  Authentication          Supabase Auth           Citizen and advocate
                                                  accounts

  File storage            Supabase Storage        Private document
                                                  uploads

  Realtime                Supabase Realtime       Request/status updates
                                                  where useful

  GenAI                   Gemini API              Intake, explanations,
                                                  summaries, drafting

  Agent orchestration     LangGraph.js (optional  Controlled multi-step
                          for MVP)                agent workflow

  Validation              Zod                     Validate API and AI
                                                  output

  PDF/text extraction     Add a suitable          Document ingestion
                          parser/OCR service only 
                          when needed             

  Version control         Git + GitHub            Collaboration
  -----------------------------------------------------------------------

### Important architecture rule

The browser must call your Express backend for Gemini-powered features.
Keep `GEMINI_API_KEY` and the Supabase service-role key on the server
only. Never put either secret in a React environment variable or commit
it to GitHub.

The frontend may use the Supabase publishable/anon key for client-side
authentication and appropriately protected queries. Enable Row Level
Security (RLS) on every table containing user-specific data.

------------------------------------------------------------------------

## 3. MVP scope

### Must build for the hackathon

-   Landing page and role-based registration/login.
-   Citizen dashboard.
-   Advocate profile and advocate dashboard.
-   AI legal assistant chat.
-   Legal issue category and structured case brief.
-   Preliminary next-step guidance with clear limitations.
-   Advocate discovery with filters.
-   Advocate profile detail.
-   Consultation request workflow: pending, accepted, declined,
    counter-proposed.
-   User confirmation of a counter-proposal.
-   Supabase persistence and access controls.
-   Demo data and a complete end-to-end demo journey.

### Build if time permits

-   Editable complaint/application/notice draft.
-   Document upload and basic text extraction.
-   Appointment scheduling.
-   Evidence checklist and case preparation tasks.
-   Source-grounded legal research retrieval.

### Defer until after the hackathon

-   Payments and escrow.
-   Automatic legal filings or sending legal notices.
-   Voice calling and multilingual voice assistant.
-   Full OCR for every document type.
-   Advanced case-management suite.
-   Court integrations and automated case-status tracking.
-   Production advocate verification workflow.
-   Any paid ranking, lead-selling, or referral-fee model.

**Hackathon rule:** Finish one reliable end-to-end workflow before
adding more agents or advanced features.

------------------------------------------------------------------------

## 4. Main user journeys

### A. Citizen journey

1.  Open the landing page.
2.  Register or log in as a citizen.
3.  Open the AI Legal Assistant.
4.  Describe the issue in their own words.
5.  Answer follow-up questions from the assistant.
6.  Review the issue category and structured case brief.
7.  Read preliminary information, possible next steps, and a checklist.
8.  Optionally generate and edit a document draft.
9.  Browse matching advocate profiles.
10. Open an advocate profile and review practice areas, jurisdiction,
    experience, availability, and indicative consultation information.
11. Send a consultation request.
12. Track the request and respond to an advocate's counter-proposal.
13. Confirm a mutually agreed appointment, if appointment scheduling is
    implemented.

### B. Advocate journey

1.  Register or log in as an advocate.
2.  Complete profile details: name, enrolment details, practice areas,
    jurisdiction, experience, languages, location, availability, and
    indicative fee information.
3.  Submit verification information for administrator review.
4.  View incoming consultation requests.
5.  Open the citizen-provided case summary and any documents explicitly
    shared with the advocate.
6.  Accept, decline, or propose an alternative consultation arrangement.
7.  Coordinate an appointment after the citizen confirms.
8.  Update request/appointment status.

### C. Admin journey

1.  Log in with an administrator account.
2.  Review advocate verification submissions.
3.  Approve, reject, or request more information.
4.  Review reports and inappropriate content.
5.  Manage legal information source records and demo data.
6.  Inspect audit events where appropriate.

------------------------------------------------------------------------

## 5. Application pages and UI requirements

### Public pages

-   `/` --- Landing page: product explanation, how it works, safety
    note, sign-in/register actions.
-   `/login` --- Login.
-   `/register` --- Registration with citizen/advocate role selection.

### Citizen pages

-   `/app` --- Citizen dashboard and recent activity.
-   `/app/assistant` --- AI chat, case brief, action plan.
-   `/app/lawyers` --- Advocate discovery and filters.
-   `/app/lawyers/:id` --- Advocate profile.
-   `/app/requests` --- Consultation request list and statuses.
-   `/app/documents` --- Uploaded files and generated drafts.
-   `/app/appointments` --- Confirmed appointments and preparation
    checklist.

### Advocate pages

-   `/advocate` --- Advocate dashboard.
-   `/advocate/profile` --- Edit profile.
-   `/advocate/requests` --- Incoming requests and response actions.
-   `/advocate/availability` --- Availability management.

### Admin pages

-   `/admin` --- Admin overview.
-   `/admin/verifications` --- Advocate verification queue.
-   `/admin/reports` --- Reports and moderation.

### UI direction

Use a calm, professional legal-tech visual system: - Deep navy or
charcoal for primary surfaces. - White or warm off-white backgrounds. -
Muted gold as a restrained accent. - Clear typography such as Inter. -
Strong contrast, visible focus states, keyboard support, and readable
line lengths. - Responsive layout, with mobile as a first-class
target. - Avoid making the interface look like a court portal or a law
firm advertisement.

------------------------------------------------------------------------

## 6. AI design: agents and responsibilities

Do not create several agents that all do the same thing. Each agent must
have a clear input, output, and permission boundary. For the first MVP,
these can be separate backend modules even if you do not yet use
LangGraph.

### Agent 1 --- Legal Intake Agent

**Purpose:** Understand the user's issue and collect missing facts.

**Input:** User's message and conversation history.

**Tasks:** - Identify the user's stated concern. - Suggest a tentative
legal category. - Ask focused follow-up questions. - Extract facts,
dates, locations, parties, and relevant documents mentioned. - Identify
missing information and uncertainty. - Produce a structured case brief.

**Output example:**

``` json
{
  "issue_summary": "The user reports that salary has not been paid for three months.",
  "possible_category": "Employment / wage dispute",
  "location": "User-provided location",
  "facts": ["Salary unpaid for three months"],
  "missing_information": ["Employer type", "Employment agreement", "Salary records"],
  "documents_to_collect": ["Offer letter", "Payslips", "Bank statements", "Written communications"],
  "confidence": "medium"
}
```

The category is preliminary, not a legal finding.

### Agent 2 --- Legal Information and Action Agent

**Purpose:** Explain relevant legal information and practical next
steps.

**Tasks:** - Retrieve relevant material from trusted legal and
government sources. - Summarize in plain language. - Separate general
information from fact-dependent possibilities. - Explain where a person
may need to seek official help. - Provide source title, issuing
authority, URL, and relevant section where available. - State when the
available facts are insufficient.

**Source priority:** 1. India Code and official legislation. 2. Supreme
Court of India and relevant High Courts. 3. Official central/state
government portals and departments. 4. Official legal services
authorities. 5. Other reputable secondary sources only as supplementary
context.

Do not fabricate statute names, section numbers, case citations,
deadlines, or procedural requirements. If retrieval cannot find a
reliable source, say so.

### Agent 3 --- Document Intelligence and Drafting Agent

**Purpose:** Help the user understand documents and prepare editable
first drafts.

**Tasks:** - Summarize uploaded document text. - Extract names, dates,
amounts, deadlines, and important clauses. - Identify missing
information. - Generate a first draft based on user-confirmed facts. -
Provide a checklist of fields requiring review.

**Draft types for a later MVP:** complaint/application, grievance
letter, RTI request, notice outline, and other carefully scoped
templates.

Every generated document must be labelled:

> AI-generated draft --- not reviewed by an advocate. Check all facts,
> law, recipient details, and deadlines with a qualified professional
> before use.

Never submit or send a generated document automatically.

### Agent 4 --- Advocate Matching Agent

**Purpose:** Find advocates whose profiles appear relevant to the user's
stated needs.

Use deterministic database filtering and ranking, not free-form LLM
decisions.

Potential matching criteria: - Practice area. - Relevant jurisdiction. -
Location or willingness to consult remotely. - Availability. -
Language. - Experience range. - User's stated consultation budget, if
provided.

Explain why each result appears. Do not imply guaranteed suitability or
success. The user makes the final choice.

### Agent 5 --- Case Coordination Agent

**Purpose:** Help manage the consultation workflow after the user
chooses an advocate.

**Tasks:** - Create a consultation request. - Notify the advocate. -
Track accept/decline/counter-proposal. - Ask the citizen to confirm a
counter-proposal. - Create an appointment only after both sides agree. -
Provide reminders and a preparation checklist.

The agent must not change request status or make commitments outside the
allowed workflow.

### Agent orchestration

For a hackathon, begin with a simple Express service that calls the
appropriate module. Add LangGraph.js if the workflow genuinely needs
stateful branching and handoffs.

Suggested graph:

``` text
User message
    |
    v
Legal Intake
    |
    v
Structured case brief
    |
    +------> Legal Information / Action
    |                 |
    |                 v
    |          Grounded explanation
    |
    +------> Document Drafting (only if requested)
    |
    +------> Advocate Matching (only with user consent)
                      |
                      v
              User selects advocate
                      |
                      v
              Consultation request
                      |
                      v
             Advocate response
                      |
                      v
             User confirms terms
                      |
                      v
                 Appointment
```

Use schema validation (for example, Zod) on model output. Treat model
output as untrusted input. Business rules, permissions, and request
state transitions must be implemented in ordinary backend code.

------------------------------------------------------------------------

## 7. Suggested project folder structure

Create this structure in VS Code:

``` text
nyayaconnect-ai/
├── client/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   ├── layout/
│   │   │   ├── assistant/
│   │   │   ├── advocates/
│   │   │   └── requests/
│   │   ├── pages/
│   │   │   ├── public/
│   │   │   ├── citizen/
│   │   │   ├── advocate/
│   │   │   └── admin/
│   │   ├── services/
│   │   │   ├── api.js
│   │   │   └── supabase.js
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   └── package.json
├── server/
│   ├── src/
│   │   ├── config/
│   │   │   ├── env.js
│   │   │   ├── supabase.js
│   │   │   └── gemini.js
│   │   ├── middleware/
│   │   │   ├── authenticate.js
│   │   │   ├── authorizeRole.js
│   │   │   └── errorHandler.js
│   │   ├── agents/
│   │   │   ├── intakeAgent.js
│   │   │   ├── legalInfoAgent.js
│   │   │   ├── draftingAgent.js
│   │   │   ├── matchingAgent.js
│   │   │   └── coordinationAgent.js
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── validators/
│   │   ├── utils/
│   │   ├── app.js
│   │   └── server.js
│   ├── .env.example
│   └── package.json
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── docs/
│   ├── product-plan.md
│   ├── api-contract.md
│   └── demo-script.md
├── .gitignore
├── README.md
└── package.json
```

Keep the folder structure simple if the hackathon team is small. Do not
create empty abstractions that slow down implementation.

------------------------------------------------------------------------

## 8. Database blueprint (Supabase PostgreSQL)

Use UUID primary keys, timestamps, foreign keys, indexes, and RLS
policies. The schema below is a logical blueprint; refine field types
and constraints in migrations.

### `profiles`

One row per authenticated user.

-   `id` UUID primary key, references `auth.users.id`
-   `role` text: `citizen`, `advocate`, or `admin`
-   `full_name` text
-   `phone` text, optional
-   `email` text, if needed for display
-   `city` text, optional
-   `state` text, optional
-   `created_at`, `updated_at`

### `advocate_profiles`

-   `id` UUID primary key
-   `user_id` UUID unique, references `profiles.id`
-   `display_name` text
-   `bio` text
-   `practice_areas` text array or normalized relation
-   `jurisdictions` text array
-   `years_experience` integer
-   `languages` text array
-   `city`, `state` text
-   `remote_consultation` boolean
-   `consultation_fee_min` numeric, optional
-   `consultation_fee_max` numeric, optional
-   `fee_currency` text default `INR`
-   `availability_status` text
-   `verification_status` text: `pending`, `approved`, `rejected`,
    `needs_more_info`
-   `created_at`, `updated_at`

Fee information must be presented as indicative and subject to direct
agreement.

### `advocate_verifications`

-   `id` UUID primary key
-   `advocate_user_id` UUID references `profiles.id`
-   `enrolment_number` text
-   `bar_council_name` text
-   `document_path` text, private storage path
-   `status` text
-   `reviewed_by` UUID, optional
-   `review_notes` text, optional
-   `submitted_at`, `reviewed_at`

Restrict access to the advocate and authorized administrators. Do not
expose verification documents publicly.

### `legal_categories`

-   `id` UUID primary key
-   `name` text
-   `description` text
-   `is_active` boolean

### `cases`

-   `id` UUID primary key
-   `citizen_user_id` UUID references `profiles.id`
-   `title` text
-   `issue_summary` text
-   `category_id` UUID references `legal_categories.id`, optional
-   `location_city`, `location_state` text, optional
-   `status` text
-   `created_at`, `updated_at`

### `case_facts`

-   `id` UUID primary key
-   `case_id` UUID references `cases.id`
-   `fact_key` text
-   `fact_value` text
-   `source` text: `user`, `document`, or `ai_extracted`
-   `confirmed_by_user` boolean
-   `created_at`

### `conversations`

-   `id` UUID primary key
-   `user_id` UUID references `profiles.id`
-   `case_id` UUID references `cases.id`, optional
-   `title` text
-   `created_at`, `updated_at`

### `chat_messages`

-   `id` UUID primary key
-   `conversation_id` UUID references `conversations.id`
-   `sender_role` text: `user`, `assistant`, or `system`
-   `content` text
-   `message_metadata` JSONB
-   `created_at`

Do not store secrets or unnecessary sensitive information in metadata.

### `case_documents`

-   `id` UUID primary key
-   `case_id` UUID references `cases.id`
-   `uploaded_by` UUID references `profiles.id`
-   `storage_path` text
-   `original_filename` text
-   `mime_type` text
-   `file_size` bigint
-   `document_type` text
-   `extracted_text` text, optional and access-controlled
-   `sharing_status` text: `private`, `shared_with_selected_advocate`
-   `created_at`

Store files in a private Supabase Storage bucket. Do not use public
buckets for legal documents.

### `document_drafts`

-   `id` UUID primary key
-   `case_id` UUID references `cases.id`
-   `created_by` UUID references `profiles.id`
-   `draft_type` text
-   `title` text
-   `content` text
-   `version` integer
-   `review_status` text default `ai_unreviewed`
-   `created_at`, `updated_at`

### `lawyer_requests`

-   `id` UUID primary key
-   `case_id` UUID references `cases.id`
-   `citizen_user_id` UUID references `profiles.id`
-   `advocate_user_id` UUID references `profiles.id`
-   `request_message` text
-   `proposed_fee` numeric, optional
-   `currency` text default `INR`
-   `proposed_time` timestamptz, optional
-   `status` text: `pending`, `accepted`, `declined`,
    `counter_proposed`, `cancelled`, `confirmed`
-   `counter_proposal` JSONB, optional
-   `created_at`, `updated_at`

Implement allowed state transitions in backend code and validate the
acting user's role and ownership.

### `appointments`

-   `id` UUID primary key
-   `request_id` UUID references `lawyer_requests.id`
-   `citizen_user_id` UUID references `profiles.id`
-   `advocate_user_id` UUID references `profiles.id`
-   `starts_at` timestamptz
-   `ends_at` timestamptz, optional
-   `meeting_mode` text
-   `meeting_location_or_link` text, access-controlled
-   `status` text
-   `created_at`, `updated_at`

### `case_tasks`

-   `id` UUID primary key
-   `case_id` UUID references `cases.id`
-   `assigned_to` UUID references `profiles.id`, optional
-   `title` text
-   `description` text
-   `due_at` timestamptz, optional
-   `status` text
-   `created_at`, `updated_at`

### `agent_runs`

-   `id` UUID primary key
-   `user_id` UUID references `profiles.id`
-   `case_id` UUID references `cases.id`, optional
-   `agent_name` text
-   `input_summary` text
-   `output_summary` text
-   `status` text
-   `created_at`

Avoid logging full legal documents or entire private conversations
unless there is a justified, consented purpose.

### Key database rules

-   RLS enabled on all user data tables.
-   Citizens can read and update only their own profile and cases.
-   Advocates can update only their own advocate profile.
-   Advocates can read only requests addressed to them and only
    documents explicitly shared with them.
-   Citizens can read their own requests and appointments.
-   Only authorized admins can review verification records.
-   A user cannot change their own role to `admin`.
-   Never trust a `user_id` supplied by the browser; derive identity
    from the verified access token.
-   Use private Storage buckets and short-lived signed URLs when sharing
    is authorized.
-   Add indexes on foreign keys and frequently filtered fields such as
    advocate location, verification status, practice area, and request
    status.

------------------------------------------------------------------------

## 9. API plan (Express)

Use a consistent JSON response format and central error handling.
Protect routes with authentication and role middleware.

### Health and authentication

-   `GET /api/health` --- service health.
-   Authentication is handled by Supabase Auth. The frontend obtains a
    session token and sends it as a Bearer token to Express.
-   `GET /api/me` --- return the authenticated profile.

### Assistant

-   `POST /api/assistant/chat`
    -   Input: conversation ID (optional), message, case ID (optional).
    -   Output: assistant reply, structured facts, follow-up questions,
        and source references where available.
-   `POST /api/assistant/case-brief`
    -   Input: conversation or case ID.
    -   Output: structured case brief.
-   `POST /api/assistant/action-plan`
    -   Input: case ID.
    -   Output: preliminary steps, checklist, caveats, and sources.

### Documents

-   `POST /api/documents/upload-url` --- create an authorized upload
    path or signed upload URL.
-   `POST /api/documents/analyze` --- analyze an authorized uploaded
    document.
-   `POST /api/documents/drafts` --- create a draft.
-   `GET /api/documents/drafts/:id` --- retrieve an authorized draft.
-   `PATCH /api/documents/drafts/:id` --- update draft content.

### Advocates

-   `GET /api/advocates` --- list/filter approved advocate profiles.
-   `GET /api/advocates/:id` --- view public profile fields.
-   `PATCH /api/advocates/me` --- advocate updates own profile.
-   `POST /api/advocates/me/verification` --- submit verification
    details.

### Consultation requests

-   `POST /api/requests` --- citizen sends a request.
-   `GET /api/requests` --- list requests visible to the authenticated
    user.
-   `GET /api/requests/:id` --- request detail after authorization.
-   `POST /api/requests/:id/accept` --- addressed advocate accepts.
-   `POST /api/requests/:id/decline` --- addressed advocate declines.
-   `POST /api/requests/:id/counter-propose` --- addressed advocate
    proposes alternative terms.
-   `POST /api/requests/:id/confirm` --- citizen confirms a
    counter-proposal.
-   `POST /api/requests/:id/cancel` --- authorized participant cancels
    under defined rules.

### Appointments

-   `POST /api/appointments` --- create only after request agreement.
-   `GET /api/appointments` --- list appointments visible to user.
-   `PATCH /api/appointments/:id` --- reschedule/cancel under defined
    rules.

### API implementation rules

-   Validate every request body and path parameter.
-   Authenticate every private route.
-   Check role and resource ownership on the server.
-   Rate-limit AI endpoints.
-   Set file size and MIME-type limits.
-   Avoid returning internal errors, secrets, stack traces, or private
    storage paths.
-   Keep an audit trail for sensitive workflow actions.
-   Make state-changing endpoints idempotent where practical.

------------------------------------------------------------------------

## 10. Build instructions in VS Code

### Step 1 --- Create the workspace

Install: - Node.js LTS. - VS Code. - Git. - A modern browser. - Supabase
account/project. - Gemini API access.

Create the project:

``` bash
mkdir nyayaconnect-ai
cd nyayaconnect-ai
git init
mkdir client server supabase docs
```

Open the folder in VS Code.

### Step 2 --- Create the React app

``` bash
cd client
npm create vite@latest . -- --template react
npm install
npm install react-router-dom @supabase/supabase-js lucide-react
```

Install and configure Tailwind using the current Tailwind CSS + Vite
installation instructions. Tailwind's setup commands can change between
major versions, so follow the official guide for the version installed.

Start frontend:

``` bash
npm run dev
```

### Step 3 --- Create the Express backend

Open a second terminal:

``` bash
cd server
npm init -y
npm install express cors dotenv helmet morgan express-rate-limit zod @google/genai @supabase/supabase-js
npm install -D nodemon
```

Set the server package to use ES modules (`"type": "module"`) and add
scripts:

``` json
{
  "scripts": {
    "dev": "nodemon src/server.js",
    "start": "node src/server.js"
  }
}
```

Create `server/src/server.js`:

``` js
import "dotenv/config";
import app from "./app.js";

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`NyayaConnect API running on port ${port}`);
});
```

Create a minimal `server/src/app.js`:

``` js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan("dev"));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "nyayaconnect-api" });
});

export default app;
```

Run:

``` bash
npm run dev
```

Confirm `GET http://localhost:5000/api/health` returns a healthy
response.

### Step 4 --- Create Supabase project

1.  Create a Supabase project.
2.  Copy the project URL and publishable/anon key for the frontend.
3.  Copy the service-role key only for backend use, if required by the
    chosen server-side access pattern.
4.  Enable Supabase Auth providers needed for the demo.
5.  Create private Storage buckets for case documents and verification
    files.
6.  Create SQL migrations for the tables in Section 8.
7.  Enable RLS and write/test policies before connecting real user data.
8.  Add seed data for demo advocate profiles and legal categories.

Do not disable RLS to make the demo work. Fix the policies instead.

### Step 5 --- Add environment variables

`client/.env.example`:

``` env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=http://localhost:5000
```

`server/.env.example`:

``` env
PORT=5000
CLIENT_URL=http://localhost:5173
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
```

Create local `.env` files from these examples and fill in your own
credentials. Ensure `.env` is in `.gitignore`. Never commit real keys.

### Step 6 --- Connect Supabase Auth

-   Create a Supabase client in `client/src/services/supabase.js`.
-   Build registration, login, logout, and session persistence.
-   On registration, create a profile row using a trusted
    server/database flow.
-   Protect routes by session and role.
-   On the backend, verify the Supabase JWT for every protected request.
-   Do not rely only on frontend route guards for security.

### Step 7 --- Build the UI using mock data first

Build these components/pages in order: 1. App shell, navigation,
responsive layout. 2. Landing page. 3. Login/register. 4. Citizen
dashboard. 5. Chat interface. 6. Advocate result card and filter panel.
7. Advocate profile page. 8. Request status card. 9. Advocate request
inbox. 10. Admin verification queue.

Use mock data until layouts and user flows work. Then replace mock
services with API calls.

### Step 8 --- Connect the AI assistant

Create `server/src/config/gemini.js`:

``` js
import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not configured");
}

export const gemini = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});
```

Create an intake agent module that: - Accepts a user message and
relevant conversation context. - Uses a carefully written system
instruction. - Requests structured JSON output where supported. -
Validates output with Zod. - Returns a safe fallback if the model fails
or output is invalid. - Does not make database changes or external
commitments on its own.

Verify the current Gemini model name and SDK options in Google's
official documentation before selecting a model for the final build.
Model identifiers and SDK behavior can change.

### Step 9 --- Implement matching

Start with deterministic filters in SQL or backend code: 1. Only include
approved advocate profiles. 2. Filter by practice area. 3. Filter by
jurisdiction. 4. Apply location/remote preference. 5. Apply availability
if maintained. 6. Apply budget compatibility only when the user supplies
a budget. 7. Return a transparent explanation of match factors.

Do not ask the LLM to invent advocate profiles or fees. All displayed
advocate information must come from your database.

### Step 10 --- Implement request workflow

Use a backend-controlled state machine:

``` text
pending
  ├── accepted
  ├── declined
  ├── counter_proposed
  │       ├── confirmed
  │       └── cancelled
  └── cancelled
```

Only the addressed advocate can accept, decline, or counter-propose.
Only the requesting citizen can confirm a counter-proposal. Validate
every transition on the server and record who performed it.

### Step 11 --- Add document drafting

Start with a template-driven draft, not a fully autonomous legal
document generator: 1. Collect facts through the assistant. 2. Ask the
user to confirm the facts. 3. Select an appropriate template. 4.
Generate a first draft. 5. Highlight fields requiring completion. 6. Let
the user edit and save. 7. Mark it AI-generated and unreviewed. 8.
Require qualified review before legal use.

### Step 12 --- Test the full demo journey

Use separate citizen and advocate test accounts: 1. Citizen logs in. 2.
Citizen describes a salary non-payment issue. 3. Assistant asks
follow-up questions. 4. Citizen reviews the case brief and next-step
checklist. 5. Citizen searches for employment advocates. 6. Citizen
opens a profile and sends a request. 7. Advocate logs in and sees the
request. 8. Advocate counter-proposes a consultation time/fee or
accepts. 9. Citizen confirms. 10. Both see the final status/appointment.

Also test denied access: one citizen must not be able to read another
citizen's case or documents.

------------------------------------------------------------------------

## 11. GitHub Copilot workflow

Use Copilot Chat in **Agent mode** (if available in your VS Code setup).
Give it one bounded task at a time. Ask it to inspect existing files
before editing and to summarize changes and tests afterward.

### Copilot global project instruction

Paste this into Copilot Chat at the beginning of the project:

``` text
You are helping build NyayaConnect AI, a hackathon MVP for India.

Stack:
- React + Vite + JavaScript
- Tailwind CSS
- Node.js + Express
- Supabase Auth, PostgreSQL, Storage, and Realtime
- Gemini API called only from the backend
- Zod for input/output validation

Product:
Citizens describe a legal problem, receive preliminary legal information and next-step guidance, optionally prepare an editable AI-generated draft, discover relevant advocates, and send a consultation request. Advocates can accept, decline, or counter-propose. Citizens confirm any counter-proposal.

Architecture and safety rules:
1. Keep frontend and backend separate.
2. Never expose Gemini API keys or Supabase service-role keys to the browser.
3. Verify Supabase JWTs on protected backend routes.
4. Enforce role checks and resource ownership on the server.
5. Enable and respect Supabase RLS.
6. Validate all inputs and AI outputs with Zod.
7. Treat LLM output as untrusted data.
8. Use deterministic backend logic for matching and request status transitions.
9. Do not invent advocates, fees, laws, statutes, citations, or legal deadlines.
10. Legal information must be preliminary, source-grounded where possible, and clearly distinguish uncertainty.
11. AI-generated documents must be editable and labelled unreviewed.
12. Never send a document, submit a filing, make a payment, or confirm an appointment without explicit user approval.
13. Use accessible, responsive UI and reusable components.
14. Do not rewrite unrelated files. Explain any new dependencies.
15. After each task, list changed files, commands to run, and tests performed.

Build only the task I ask for. First inspect the existing codebase and propose a concise implementation plan. Do not scaffold the entire product in one response.
```

### Prompt 1 --- Project foundation

``` text
Inspect the repository. Set up the React Vite frontend and Express backend in separate client and server folders. Add basic scripts, environment examples, .gitignore, health endpoint, CORS, Helmet, JSON parsing, and a concise README. Do not implement product features yet. Make sure secrets are not committed.
```

### Prompt 2 --- Supabase integration

``` text
Implement Supabase client configuration for the frontend and secure Supabase JWT verification middleware for Express. Add profile retrieval and role authorization middleware. Include clear environment variable names and safe error handling. Do not disable RLS or trust user IDs supplied by the browser.
```

### Prompt 3 --- Authentication and layouts

``` text
Build responsive login and registration pages with citizen/advocate role selection, session persistence, protected routes, and role-aware navigation. Use Supabase Auth. Keep the design professional and accessible. Do not allow users to self-assign the admin role.
```

### Prompt 4 --- Citizen dashboard and chat UI

``` text
Build the citizen dashboard and AI assistant chat UI. Include conversation history, loading and error states, message timestamps, follow-up question display, a structured case brief panel, and a preliminary action checklist. Connect to a placeholder API service first. Do not put Gemini calls in the browser.
```

### Prompt 5 --- Gemini intake agent

``` text
Implement a backend Legal Intake Agent using the official @google/genai SDK. It should classify the issue tentatively, extract user-stated facts, identify missing information, and ask focused follow-up questions. Define a Zod schema for the response. Keep the Gemini key on the server. Add error handling, a safe fallback, and tests. Do not give definitive legal advice or invent legal citations.
```

### Prompt 6 --- Legal information/action endpoint

``` text
Create a Legal Information and Action service that can accept a structured case brief and return plain-language preliminary information, possible next steps, evidence checklist, uncertainty notes, and source references. For now, use a small curated set of official source records or clearly marked demo fixtures. Never fabricate source URLs, law names, sections, or deadlines. Keep the UI explicit that this is general information, not a substitute for an advocate.
```

### Prompt 7 --- Advocate discovery

``` text
Build advocate listing, filters, profile detail, and backend query endpoints. Only show approved profiles. Filter by practice area, jurisdiction, location/remote availability, languages, and indicative consultation range. Use database values only; do not invent profile data. Explain the match factors and let the citizen choose.
```

### Prompt 8 --- Consultation request workflow

``` text
Implement consultation requests with pending, accepted, declined, counter_proposed, confirmed, and cancelled states. Enforce allowed transitions in backend services. Only the addressed advocate can accept/decline/counter-propose; only the requesting citizen can confirm a counter-proposal. Add audit events and tests for unauthorized transitions.
```

### Prompt 9 --- Document drafting

``` text
Build a document drafting module that uses confirmed user facts and a selected template to generate an editable first draft. Highlight missing fields. Save versions in Supabase. Label every generated draft AI-generated and not reviewed by an advocate. Do not send, file, or issue the document.
```

### Prompt 10 --- Security and QA

``` text
Review the entire app for authentication, authorization, Supabase RLS, private storage access, secret exposure, input validation, file upload limits, rate limiting, XSS risks, error leakage, and unauthorized workflow transitions. Add or update tests. Report findings by severity and fix critical/high issues without unrelated refactoring.
```

### How to work with Copilot effectively

-   Give it one prompt at a time.
-   Review the proposed files before accepting broad changes.
-   Ask it to explain unfamiliar code.
-   Run the app and tests after each milestone.
-   Do not paste real client legal documents or personal data into AI
    tools unless you have a lawful basis and appropriate consent.
-   Commit working milestones to Git.
-   Keep a human developer responsible for reviewing security, legal
    content, and generated code.

------------------------------------------------------------------------

## 12. Testing checklist

### Functional

-   [ ] Citizen can register, log in, log out.
-   [ ] Advocate can register and submit a profile.
-   [ ] Admin can review verification submissions.
-   [ ] Citizen can start and continue a conversation.
-   [ ] Intake agent asks relevant follow-up questions.
-   [ ] Case brief is generated and can be corrected by the user.
-   [ ] Legal guidance shows caveats and source references.
-   [ ] Advocate search filters return database-backed results.
-   [ ] Citizen can send a consultation request.
-   [ ] Advocate can accept, decline, or counter-propose.
-   [ ] Citizen can confirm or reject a proposal.
-   [ ] Appointment appears only after agreement.
-   [ ] Draft can be edited and saved.

### Security and privacy

-   [ ] User A cannot read User B's cases.
-   [ ] User A cannot read User B's private documents.
-   [ ] Advocate cannot read a case unless the citizen has shared the
    relevant information.
-   [ ] Advocate cannot act on another advocate's request.
-   [ ] Citizen cannot approve their own advocate verification.
-   [ ] User cannot assign themselves admin role.
-   [ ] Gemini key is absent from frontend bundle and Git history.
-   [ ] Service-role key is absent from frontend bundle and Git history.
-   [ ] Uploads enforce file size and MIME-type restrictions.
-   [ ] RLS policies are enabled and tested.
-   [ ] AI output is validated before use.

### AI quality

-   [ ] Assistant distinguishes known facts from assumptions.
-   [ ] Assistant asks for missing facts rather than guessing.
-   [ ] Assistant does not invent legal citations or deadlines.
-   [ ] Assistant says when it cannot find a reliable source.
-   [ ] Generated drafts are labelled unreviewed.
-   [ ] User can correct extracted facts.
-   [ ] AI failure does not corrupt a case or request.

------------------------------------------------------------------------

## 13. Suggested 48-hour hackathon schedule

  ---------------------------------------------------------------------------------
  Time                    Work                              Deliverable
  ----------------------- --------------------------------- -----------------------
  Hours 0--2              Confirm scope, assign team roles, Running client and
                          create repo and app skeleton      server

  Hours 2--5              Supabase project, auth, schema,   Login and database
                          RLS basics                        connected

  Hours 5--9              Landing page, dashboards,         Navigable frontend
                          navigation, responsive shell      

  Hours 9--14             Chat UI and Legal Intake Agent    Working issue intake

  Hours 14--18            Case brief and preliminary action Structured result
                          plan                              

  Hours 18--23            Advocate profiles, search and     Working discovery
                          filters                           

  Hours 23--28            Request                           Two-sided marketplace
                          accept/decline/counter-proposal   flow
                          workflow                          

  Hours 28--32            Document draft or appointment     One extra
                          feature                           differentiator

  Hours 32--37            RLS, authorization, validation,   Safer integrated MVP
                          error handling                    

  Hours 37--42            End-to-end tests and bug fixes    Stable demo

  Hours 42--46            Demo data, pitch deck, demo       Presentation ready
                          script                            

  Hours 46--48            Rehearsal and contingency buffer  Final submission
  ---------------------------------------------------------------------------------

### Suggested team split

-   **Frontend developer:** React pages, Tailwind, routing, API
    integration.
-   **Backend developer:** Express, Supabase, auth, request workflow,
    database.
-   **AI developer:** Gemini intake, legal information retrieval,
    drafting.
-   **Integrator/tester:** end-to-end integration, RLS testing, demo
    data, pitch.

For a smaller team, combine roles and reduce scope rather than rushing
every feature.

------------------------------------------------------------------------

## 14. Demo script

Use a fictional scenario and fictional demo users. Do not use a real
person's confidential legal documents.

**Scenario:** A fictional employee says their employer has not paid
salary for three months.

1.  Open NyayaConnect AI and sign in as a citizen.
2.  Enter: "My employer has not paid my salary for three months. What
    can I do?"
3.  Show the assistant asking for relevant details, such as location,
    employment type, and available records.
4.  Show the structured case brief and distinguish user-provided facts
    from missing information.
5.  Show preliminary next steps and an evidence checklist with source
    references if available.
6.  Open advocate discovery and filter for employment/labour practice
    and relevant jurisdiction.
7.  Open an advocate profile and show transparent indicative
    information.
8.  Send a consultation request.
9.  Switch to the advocate account and show the incoming request.
10. Accept or counter-propose a consultation arrangement.
11. Switch back to the citizen account and confirm.
12. Show the request status and appointment/preparation checklist.

End by explaining that AI helps with understanding and preparation,
while the citizen retains control and a qualified advocate provides
professional advice.

------------------------------------------------------------------------

## 15. Legal, ethical, and privacy safeguards

This product operates in a regulated professional context. Before any
public launch, obtain review from an India-qualified legal professional
familiar with advocate professional-conduct rules, privacy, consumer
protection, and platform obligations.

Important design safeguards:

-   Do not present the AI as a lawyer or claim that it creates an
    advocate-client relationship.
-   Clearly distinguish general legal information from individualized
    legal advice.
-   Provide source references and date/context for legal information.
-   Do not guarantee case outcomes.
-   Do not use fabricated advocate profiles, testimonials, rankings,
    credentials, or fees.
-   Verify advocate enrolment and professional status through
    appropriate processes; an uploaded ID alone is not sufficient.
-   Be cautious with advertising, solicitation, paid ranking, lead fees,
    referral commissions, and competitive bidding. These can raise
    professional-conduct concerns in India. Do not launch such models
    without specialist review.
-   Avoid lowest-bid auction mechanics. Let users review profiles and
    make their own choice.
-   Show consultation fees only as indicative, scope-dependent
    information that the advocate and user must agree directly.
-   Obtain clear consent before sharing a case summary or document with
    an advocate.
-   Obtain appropriate consent and minimize personal information sent to
    an AI provider.
-   Use private storage, least-privilege access, retention limits, and a
    documented deletion process.
-   Do not automatically file complaints, issue notices, submit forms,
    or make payments.
-   Provide a route to urgent official help where relevant; do not let a
    chatbot delay emergency assistance.

Suggested visible disclaimer:

> NyayaConnect AI provides preliminary legal information and assistance
> with organizing facts and preparing drafts. It is not a law firm and
> does not replace advice from a qualified advocate. Laws and procedures
> depend on the facts and jurisdiction. Verify important information
> with an advocate or the relevant official authority before acting.

------------------------------------------------------------------------

## 16. Deployment plan

For the hackathon: - Frontend: deploy the Vite app to a static hosting
provider. - Backend: deploy the Express API to a Node-compatible hosting
provider. - Database/Auth/Storage: Supabase. - Add production
environment variables through hosting dashboards. - Configure CORS to
allow only the deployed frontend domain. - Use HTTPS. - Keep secrets out
of source control. - Apply database migrations and verify RLS in the
deployed environment. - Add basic logs and uptime checks. - Use demo
accounts and seeded fictional data.

Before public launch, add a privacy notice, terms, consent flows,
retention/deletion controls, incident response process, security review,
legal review, and a support contact.

------------------------------------------------------------------------

## 17. Definition of done

The hackathon MVP is ready when:

1.  The app runs locally from documented commands.
2.  A citizen can complete the full issue-intake-to-advocate-request
    journey.
3.  An advocate can receive and respond to the request.
4.  The citizen can confirm the response.
5.  AI output is structured, validated, and clearly caveated.
6.  Advocate results come from stored profiles, not generated claims.
7.  Private data is protected by server authorization and RLS.
8.  No secret key is exposed in the frontend or repository.
9.  The main journey works with fictional demo data.
10. The team can complete the demo reliably in under five minutes.

------------------------------------------------------------------------

## 18. Final implementation order

Follow this order. Do not jump ahead:

1.  Repository, React, Express, and environment setup.
2.  Supabase project, database schema, RLS, and auth.
3.  Role-based layouts and dashboards.
4.  AI chat UI using a mock response.
5.  Backend Gemini intake integration.
6.  Structured case brief and action checklist.
7.  Advocate profile database and discovery.
8.  Consultation request state machine.
9.  End-to-end citizen/advocate flow.
10. Document drafting.
11. Security, privacy, and quality testing.
12. Deployment, demo data, rehearsal.

**The most important hackathon decision:** A polished, secure, working
citizen-to-advocate consultation flow is more valuable than five
partially working autonomous agents. Build the workflow first; add agent
orchestration only where it improves that workflow.
