# NyayaConnect AI — Phase 3: Supabase + Gemini + Interactive Chatbot Integration

**Goal:** Turn the frontend prototype into a working application with Supabase authentication and persistence, a secure Express API, and an interactive Gemini-powered legal intake chatbot.

**Existing stack:** React + Vite + JavaScript + Tailwind CSS + React Router, Node.js + Express, Supabase, Gemini API.

**Important:** Work in small milestones. Do not ask Copilot to integrate everything in one pass. Inspect the existing code and preserve working UI.

---

## 1. What we are integrating

```text
React + Vite frontend
       |
       | Supabase Auth session / access token
       v
Node.js + Express backend
       |
       +------ Verify Supabase JWT
       |
       +------ Supabase database
       |          - profiles
       |          - conversations
       |          - chat_messages
       |          - cases
       |          - case_facts
       |
       +------ Gemini API
                  - Understand user message
                  - Ask follow-up questions
                  - Produce structured case brief
                  - Give preliminary legal information
```

### Responsibilities

| Component | Responsibility |
|---|---|
| React | Chat UI, auth screens, conversation history, case brief |
| Supabase Auth | Sign up, login, logout, session |
| Supabase PostgreSQL | Persist profiles, conversations, messages, cases |
| Express | Verify identity, validate requests, enforce permissions |
| Gemini | Understand the user's message and generate assistant responses |
| Zod | Validate request and AI response structures |

**Architecture rule:** The frontend must not call Gemini directly. All Gemini requests go through Express.

---

## 2. Environment variables and secrets

Create local environment files. Do not commit them.

### `client/.env.example`

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=http://localhost:5000
```

Use the current Supabase project URL and publishable/anon key. These are intended for browser use when RLS is correctly configured.

### `server/.env.example`

```env
PORT=5000
CLIENT_URL=http://localhost:5173

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

GEMINI_API_KEY=
GEMINI_MODEL=
```

### Secret handling rules

- `GEMINI_API_KEY`: backend only.
- `SUPABASE_SERVICE_ROLE_KEY`: backend only; use only where elevated access is truly necessary.
- Never prefix backend secrets with `VITE_`.
- Never commit `.env`.
- Commit `.env.example` with empty values only.
- Rotate any key that has accidentally been committed or exposed.
- Prefer using the authenticated user's access token and least-privilege database access rather than using the service-role key for every database query.
- If using the service-role key for a server-only task, manually enforce authorization because it bypasses RLS.

---

## 3. Database schema for this integration

Start with the minimum tables required for a working chatbot. Add the full marketplace schema after chat and authentication work reliably.

### Table A — `profiles`

One row per Supabase Auth user.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid primary key | Must reference `auth.users.id` |
| `role` | text | `citizen` or `advocate`; admin provisioned separately |
| `full_name` | text | User's display name |
| `created_at` | timestamptz | Default now |
| `updated_at` | timestamptz | Default now |

Do not allow users to set their own role to `admin`.

### Table B — `conversations`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid primary key | Generated UUID |
| `user_id` | uuid | References `profiles.id` |
| `title` | text | Conversation title |
| `status` | text | For example `active`, `archived` |
| `created_at` | timestamptz | Default now |
| `updated_at` | timestamptz | Default now |

### Table C — `chat_messages`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid primary key | Generated UUID |
| `conversation_id` | uuid | References `conversations.id` |
| `user_id` | uuid | References `profiles.id` |
| `role` | text | `user` or `assistant` |
| `content` | text | Message text |
| `metadata` | jsonb | Structured response data; avoid unnecessary sensitive data |
| `created_at` | timestamptz | Default now |

Do not allow the browser to insert a `system` role message. System instructions belong on the server.

### Table D — `cases`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid primary key | Generated UUID |
| `user_id` | uuid | References `profiles.id` |
| `conversation_id` | uuid | Optional reference to conversation |
| `title` | text | Case title |
| `issue_summary` | text | User-reviewed summary |
| `category` | text | Tentative category |
| `location_city` | text | Optional user-provided location |
| `location_state` | text | Optional user-provided location |
| `status` | text | For example `draft`, `active`, `closed` |
| `created_at` | timestamptz | Default now |
| `updated_at` | timestamptz | Default now |

### Table E — `case_facts`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid primary key | Generated UUID |
| `case_id` | uuid | References cases.id |
| `user_id` | uuid | Owner |
| `fact_key` | text | Example `employment_type` |
| `fact_value` | text | Extracted value |
| `source` | text | `user` or `ai_extracted` |
| `confirmed_by_user` | boolean | Default false |
| `created_at` | timestamptz | Default now |

AI-extracted facts must not be treated as confirmed facts until the user confirms them.

---

## 4. RLS and database security

Enable RLS on all five tables.

### Policy intent

- Profiles: authenticated user can read their own profile and update allowed fields on their own profile.
- Conversations: user can select, insert, update, and delete only their own conversations.
- Messages: user can read messages only when they own the parent conversation.
- Message inserts: user can insert only into a conversation they own, with `user_id = auth.uid()` and role `user`.
- Assistant messages: insert through the trusted backend after it verifies ownership; do not expose unrestricted assistant-message insertion to browser clients.
- Cases: user can access only their own cases.
- Case facts: user can access facts only for cases they own.

Use foreign keys and indexes. Add database constraints for allowed role/status values where appropriate.

**Do not solve permission errors by disabling RLS.** Fix the policy or backend access pattern.

### Profile creation

Use a safe server-side or database-trigger approach to create a profile after Supabase Auth signup. The role must be validated against allowed self-registration roles (`citizen`, `advocate`). Do not accept `admin` from the public registration form.

---

## 5. Authentication flow

```text
User registers / logs in
        |
        v
Supabase Auth returns session
        |
        v
React stores session using Supabase client
        |
        v
React calls Express with:
Authorization: Bearer <access_token>
        |
        v
Express verifies token with Supabase Auth
        |
        v
Express gets trusted user ID
        |
        v
Backend checks resource ownership and role
```

Do not trust a `user_id` sent in the JSON body. Derive identity from the verified token.

---

## 6. Chatbot behavior requirements

The chatbot should feel interactive and useful, not like a generic question-answer box.

### Chat experience

1. User opens the assistant.
2. User starts a new conversation or selects an earlier one.
3. User describes a legal issue in natural language.
4. Assistant acknowledges the concern and asks focused follow-up questions.
5. Assistant tracks facts stated by the user.
6. Assistant identifies missing information.
7. Assistant gives a short preliminary explanation when enough information exists.
8. Assistant creates a structured case brief.
9. User can correct the summary and confirm extracted facts.
10. User can ask for a next-step checklist.
11. Conversation and messages persist in Supabase.
12. When the user returns, previous conversations can be reopened.

### Example interaction

**User:** My employer has not paid my salary for three months.

**Assistant:** I can help you organize the facts and understand possible next steps. To make the information more relevant, which state in India are you working in?

**User:** Kerala.

**Assistant:** Thanks. Are you employed by a private company, a contractor, or a government organization?

**User:** A private company.

**Assistant:** Do you have an offer letter, payslips, bank statements, or messages showing the unpaid salary?

The assistant should ask a small number of relevant questions at a time, not overwhelm the user with a long questionnaire.

### Structured response format

Use a validated JSON response shape similar to:

```json
{
  "reply": "Thanks for explaining. I need a little more information...",
  "issue_category": "employment_wage_dispute",
  "case_brief": {
    "summary": "User reports three months of unpaid salary.",
    "facts": [
      {
        "key": "unpaid_duration",
        "value": "three months",
        "source": "user",
        "confirmed": true
      }
    ],
    "missing_information": [
      "employment arrangement",
      "employer location",
      "available salary records"
    ]
  },
  "follow_up_questions": [
    "Which state are you working in?",
    "Are you employed directly or through a contractor?"
  ],
  "next_steps": [],
  "sources": [],
  "safety_note": "This is preliminary legal information, not a substitute for advice from a qualified advocate."
}
```

This is a shape example, not a requirement that every response fill every field. Use empty arrays or null values when information is unavailable. Do not invent sources.

### Legal safety rules for the assistant

- It provides preliminary legal information, not a definitive legal opinion.
- It must not claim to be a lawyer or advocate.
- It must not guarantee case outcomes.
- It must distinguish facts stated by the user from AI inferences.
- It must ask for jurisdiction when it materially affects the answer.
- It must not invent laws, statute sections, case citations, deadlines, government links, or procedures.
- If reliable sources are not connected, say that the legal information has not yet been verified against an official source.
- Do not tell users that a complaint has been filed or a notice has been sent.
- Do not request unnecessary sensitive personal data.
- Do not ask for passwords, OTPs, bank PINs, or unrelated identity details.
- If a user describes immediate danger, direct them to appropriate emergency/official help rather than continuing a long chatbot intake.

---

## 7. Backend API contract

Implement these routes in stages.

### Health and identity

- `GET /api/health`
- `GET /api/me`

### Conversations

- `POST /api/conversations` — create conversation.
- `GET /api/conversations` — list authenticated user's conversations.
- `GET /api/conversations/:id/messages` — get messages after ownership check.
- `PATCH /api/conversations/:id` — rename/archive an owned conversation.
- `DELETE /api/conversations/:id` — delete only if product retention policy permits.

### Chat

- `POST /api/assistant/chat`

Example request:

```json
{
  "conversationId": "uuid",
  "message": "My employer has not paid salary for three months."
}
```

Example response:

```json
{
  "userMessage": {
    "id": "uuid",
    "role": "user",
    "content": "My employer has not paid salary for three months."
  },
  "assistantMessage": {
    "id": "uuid",
    "role": "assistant",
    "content": "I can help you organize the facts...",
    "metadata": {
      "issue_category": "employment_wage_dispute",
      "follow_up_questions": ["Which state are you working in?"]
    }
  }
}
```

The backend must:
1. Verify the user's token.
2. Validate the request body.
3. Verify the conversation belongs to the user, or create a conversation through a separate authorized route.
4. Save the user message.
5. Load a limited amount of conversation context.
6. Call Gemini.
7. Validate the model output.
8. Save the assistant message.
9. Return the saved messages.

If Gemini fails, do not lose the user's message. Return a safe retry message and preserve the conversation.

### Case brief

- `POST /api/assistant/case-brief`
- `PATCH /api/cases/:id/brief` — save user corrections/confirmation.

### API rules

- Validate every body with Zod.
- Limit message length and context size.
- Add rate limiting to AI endpoints.
- Add request timeouts and safe error handling.
- Never return API keys or internal stack traces.
- Log request IDs and high-level errors, not full private legal conversations.
- Enforce user ownership in backend code.
- Use server-side database access patterns that preserve least privilege.

---

## 8. Gemini integration plan

Use the official Google GenAI JavaScript SDK on the backend. Check Google's current official documentation for the correct SDK usage, model identifier, structured output configuration, and generation options before implementing. Do not assume a model name from an old tutorial remains available.

### Gemini service responsibilities

Create a service/module that:
- Reads the API key from backend environment variables.
- Accepts a system instruction and limited conversation context.
- Sends the user message to the selected Gemini model.
- Requests a structured response where supported.
- Parses and validates the response using Zod.
- Handles malformed output, API errors, quota limits, and timeouts.
- Never returns raw provider errors or secrets to the browser.

### Suggested server files

```text
server/src/
├── config/
│   ├── env.js
│   ├── supabase.js
│   └── gemini.js
├── middleware/
│   ├── authenticate.js
│   ├── errorHandler.js
│   └── rateLimit.js
├── agents/
│   └── intakeAgent.js
├── validators/
│   ├── chatSchema.js
│   └── assistantResponseSchema.js
├── services/
│   ├── conversationService.js
│   ├── messageService.js
│   └── assistantService.js
├── controllers/
│   └── assistantController.js
├── routes/
│   ├── conversationRoutes.js
│   └── assistantRoutes.js
├── app.js
└── server.js
```

### System instruction guidance

Tell the model to:
- Act as a preliminary legal information and intake assistant for India.
- Use plain, empathetic, non-alarmist language.
- Ask only the most useful next question or two.
- Track user-provided facts separately from assumptions.
- Ask for state/jurisdiction if needed.
- Never invent legal sources or citations.
- Be transparent when current official sources are unavailable.
- Avoid definitive advice on fact-dependent legal matters.
- Return only the expected structured format.
- Never claim to have taken external action.

---

## 9. Frontend chat integration requirements

The existing chat page should call the Express API, not Gemini directly.

### Chat page behavior

- Load conversation list from `GET /api/conversations`.
- Create new conversation with `POST /api/conversations`.
- Load selected conversation messages.
- Send message to `POST /api/assistant/chat`.
- Render user and assistant messages in order.
- Show typing/loading indicator while waiting.
- Disable send button when input is empty or request is in progress.
- Support Enter to send and Shift+Enter for newline.
- Preserve draft text if the request fails.
- Show retry action for failed responses.
- Scroll to the newest message without disrupting manual scrolling.
- Display follow-up questions as clickable chips that populate or submit the next question.
- Show case brief in a responsive side panel or collapsible mobile section.
- Let user edit/correct case brief facts before saving.
- Show a visible preliminary-information disclaimer.
- Never show fake citations or fake source links.
- Do not lose the conversation when the user refreshes the page.

### Suggested UI states

- `idle`
- `loading_conversations`
- `loading_messages`
- `sending`
- `error`
- `ready`

Avoid multiple overlapping requests for the same conversation unless deliberately supported.

---

## 10. Copilot prompt pack

Paste the **Global Instruction** once, then use one prompt at a time.

### Global Copilot instruction for integration

```text
We are integrating the NyayaConnect AI frontend with Supabase and Gemini.

Existing stack:
- React + Vite + JavaScript
- Tailwind CSS
- React Router
- Node.js + Express
- Supabase Auth and PostgreSQL
- Google Gemini through the official @google/genai SDK on the backend
- Zod validation

Core architecture:
- React calls Express for all AI operations.
- Supabase Auth handles login and sessions.
- React sends the Supabase access token as a Bearer token to Express.
- Express verifies the token and derives the authenticated user ID.
- Express enforces role and resource ownership.
- Gemini API key is backend-only.
- Supabase service-role key is backend-only and must be used sparingly.
- RLS must remain enabled on user data tables.

Security rules:
1. Never expose secrets in frontend code or VITE_ variables.
2. Never trust user_id from request bodies.
3. Never disable RLS to bypass a permission issue.
4. Never allow a user to self-assign admin.
5. Validate every request and model response with Zod.
6. Treat AI output as untrusted data.
7. Do not log full legal conversations or sensitive documents.
8. Rate-limit AI endpoints and enforce request size limits.
9. Do not invent laws, sections, case citations, sources, advocates, or fees.
10. Do not claim a filing, notice, booking, or external action has occurred.
11. Preserve the current frontend design and working routes.
12. Do not rewrite unrelated files.
13. Inspect existing files before changing them.
14. Work only on the milestone requested.
15. After each task, report changed files, environment variables needed, commands to run, and tests performed.

Legal assistant behavior:
- Preliminary legal information and intake only.
- Ask focused follow-up questions.
- Separate user-provided facts from assumptions.
- Ask for jurisdiction when relevant.
- State uncertainty.
- Clearly say when official sources have not been retrieved.
- Do not present AI output as a substitute for a qualified advocate.

First inspect the codebase and give a short plan. Do not implement all integrations at once.
```

### Prompt 1 — Audit current frontend and backend

```text
Inspect the current NyayaConnect AI repository before making changes.

Review:
- client and server folder structure
- installed dependencies and package versions
- existing Supabase client setup
- existing Express app and routes
- current chat page and mock API
- environment example files
- current database migrations if present

Do not edit files yet. Report:
1. What is already working?
2. What is mock-only?
3. What must be added for secure Supabase and Gemini integration?
4. Any package/version issues?
5. A safe implementation sequence.

Preserve the existing Minimalist frontend design.
```

### Prompt 2 — Environment validation and secret safety

```text
Prepare secure environment configuration for the existing Express backend and React frontend.

Create or update:
- client/.env.example
- server/.env.example
- server/src/config/env.js
- .gitignore

Frontend variables may contain only the Supabase project URL, publishable/anon key, and API base URL.
Backend variables may contain Supabase URL, server-side keys, Gemini API key, Gemini model identifier, port, and allowed client origin.

Validate required server environment variables at startup. Never print secret values in logs. Check that .env files are ignored by Git. Do not put Gemini or service-role keys in any VITE_ variable. Do not invent credentials. Explain where I should obtain each value from the provider dashboards.
```

### Prompt 3 — Supabase browser client and authentication

```text
Integrate Supabase Auth into the existing React frontend.

Implement:
- Supabase browser client using VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
- Sign up.
- Sign in.
- Sign out.
- Session persistence and session restoration.
- Auth context/provider and a useAuth hook.
- Protected routes.
- Role-aware routing for citizen and advocate.
- Clear loading and error states.

Do not allow public registration as admin. Do not store passwords yourself. Preserve the current Minimalist UI and existing pages. Add tests or a clear manual test checklist.
```

### Prompt 4 — Secure Express JWT authentication

```text
Implement Express authentication middleware for Supabase access tokens.

Requirements:
- Read Authorization: Bearer token.
- Verify token with Supabase Auth using the supported server-side method.
- Attach the verified user ID and claims to the request.
- Return 401 for missing/invalid/expired tokens.
- Add role authorization middleware based on trusted profile data.
- Never trust user_id or role from request body.
- Do not log access tokens.
- Add tests for missing token, invalid token, valid token, and role restrictions.

Inspect the installed Supabase SDK version and use its supported API. Do not disable RLS.
```

### Prompt 5 — Database migrations and RLS

```text
Create Supabase SQL migrations for:
- profiles
- conversations
- chat_messages
- cases
- case_facts

Include:
- UUID primary keys.
- Foreign keys and indexes.
- created_at and updated_at timestamps where appropriate.
- constraints for role and status fields.
- safe profile creation after signup.
- RLS enabled on every table.
- policies based on auth.uid() and ownership.

Rules:
- A user can access only their own profile, conversations, messages, cases, and facts.
- A user can insert user-role messages only into their own conversation.
- Browser users cannot insert assistant/system messages.
- Users cannot set their own role to admin.
- Avoid broad policies such as USING (true).

Also create a seed script with fictional legal categories only if needed. Explain how to apply migrations and test RLS using two different user accounts. Do not disable RLS.
```

### Prompt 6 — Backend Supabase database access

```text
Implement backend database access for conversations and chat messages.

Create services for:
- create conversation
- list current user's conversations
- get messages for an owned conversation
- save user message
- save assistant message
- update conversation title/updated_at

Use the verified authenticated user ID from middleware. Every query must enforce ownership. Prefer a user-scoped Supabase client using the user's access token where appropriate so RLS remains effective. If an elevated server key is used for a specific operation, enforce authorization explicitly and explain why.

Do not expose service-role credentials. Add route/controller/service separation, Zod validation, and tests for cross-user access denial.
```

### Prompt 7 — Gemini backend service

```text
Integrate the official Google GenAI JavaScript SDK in the Express backend.

Before coding, inspect the installed SDK version and verify the current supported SDK method and model configuration from official Google documentation. Do not use outdated SDK examples or guess a model identifier.

Implement:
- server-only Gemini client configuration.
- a service that accepts system instruction and limited conversation context.
- request timeout and error handling.
- structured output where supported.
- response parsing and Zod validation.
- safe fallback for invalid model output, quota errors, and provider failures.
- no secret or full private conversation logging.

Do not create a frontend Gemini client. Do not invent legal citations or sources.
```

### Prompt 8 — Legal Intake Agent

```text
Implement the NyayaConnect Legal Intake Agent as a backend module using the Gemini service.

It should:
- understand the user's stated legal concern.
- identify a tentative category.
- ask one or two focused follow-up questions.
- extract facts stated by the user.
- separate user-provided facts from assumptions.
- identify missing information.
- ask for jurisdiction/location only when relevant.
- create a structured case brief.
- return a short, empathetic response.

Use a Zod schema for all output. Include reply, tentative issue category, facts with source/confirmation status, missing information, follow-up questions, preliminary next steps, sources, and safety note.

Never invent legal provisions, citations, case law, deadlines, official links, or procedural rules. If official legal sources are not connected, explicitly say that the information has not been verified against an official source. Add tests with fictional scenarios.
```

### Prompt 9 — Conversation and chat API

```text
Implement these authenticated Express endpoints:
- POST /api/conversations
- GET /api/conversations
- GET /api/conversations/:id/messages
- PATCH /api/conversations/:id
- POST /api/assistant/chat

For POST /api/assistant/chat:
1. Authenticate the user.
2. Validate conversationId and message.
3. Verify conversation ownership.
4. Save the user's message first.
5. Load a limited number of recent messages from that conversation.
6. Call the Legal Intake Agent.
7. Validate the response.
8. Save the assistant message and structured metadata.
9. Return both saved messages.

If Gemini fails, preserve the user's message and return a safe retry response. Do not create duplicate messages on accidental retries if an idempotency approach is feasible. Add rate limiting, request size limits, and tests for ownership and failures.
```

### Prompt 10 — Connect React chat UI to real API

```text
Replace the mock assistant API in the existing React chat page with the authenticated Express API.

Implement:
- load conversation list.
- create new conversation.
- load selected conversation messages.
- send a message.
- render saved user and assistant messages.
- show typing/loading state.
- handle API and Gemini failures.
- preserve unsent text on failure.
- retry failed requests safely.
- Enter to send and Shift+Enter for newline.
- follow-up question chips.
- responsive case brief panel.
- refresh persistence.

Attach the current Supabase access token as Authorization: Bearer <token> using a centralized API client. Never put Gemini credentials in the browser. Preserve the current Minimalist design and do not remove working features.
```

### Prompt 11 — User-reviewed case brief

```text
Implement a case brief panel connected to the real assistant response.

Show:
- issue summary
- tentative category
- facts stated by the user
- facts extracted by AI but not yet confirmed
- missing information
- documents the user may want to gather
- preliminary next steps
- source references only when actually returned by a trusted retrieval system

Allow the user to edit and confirm facts. Persist user corrections to cases and case_facts through authenticated APIs. Do not mark AI-inferred facts as user-confirmed automatically. Add loading, save, and error states.
```

### Prompt 12 — Security, reliability, and integration tests

```text
Perform a security and reliability review of the complete Supabase + Gemini chatbot integration.

Test:
- no Gemini key in frontend source or built bundle.
- no service-role key in frontend source or built bundle.
- JWT validation on every private endpoint.
- user A cannot access user B conversations, messages, cases, or facts.
- RLS is enabled and effective.
- role cannot be escalated to admin.
- request validation and message length limits.
- rate limiting for AI requests.
- Gemini quota/error/timeout behavior.
- malformed AI output handling.
- duplicate-send behavior.
- conversation persistence after refresh.
- user can correct AI-extracted facts.

Fix critical and high-severity issues. Do not disable RLS or weaken authentication to make tests pass. Report remaining risks.
```

### Prompt 13 — Final end-to-end demo

```text
Prepare and test a complete NyayaConnect AI chatbot demo using fictional data.

Journey:
1. Register a citizen test account.
2. Log in.
3. Start a new chat.
4. Enter: "My employer has not paid my salary for three months."
5. Assistant asks relevant follow-up questions.
6. User answers state and employment type.
7. Assistant produces a case brief.
8. User corrects one extracted fact and confirms it.
9. User refreshes the page and the conversation remains.
10. User opens the conversation again.
11. Test a Gemini failure and verify the user message is not lost.
12. Test that a second account cannot access the first account's conversation.

Fix demo-blocking bugs and provide the exact commands and test accounts setup steps. Do not use real people's legal information.
```

---

## 11. Local development commands

Run frontend and backend in separate VS Code terminals.

### Frontend

```bash
cd client
npm install
npm run dev
```

### Backend

```bash
cd server
npm install
npm run dev
```

### Verify backend health

Open:

```text
http://localhost:5000/api/health
```

Expected response should indicate that the API is running. Do not expose configuration secrets in this endpoint.

### Suggested package dependencies

Install only what is missing after inspecting `package.json`.

Backend likely needs:
- `express`
- `cors`
- `helmet`
- `dotenv`
- `morgan`
- `express-rate-limit`
- `zod`
- `@supabase/supabase-js`
- `@google/genai`

Frontend likely needs:
- `@supabase/supabase-js`
- `react-router-dom`
- `lucide-react`

Use the official documentation for current SDK and framework setup. Do not blindly copy old installation commands.

---

## 12. Manual acceptance checklist

### Authentication

- [ ] Citizen can sign up.
- [ ] Advocate can sign up.
- [ ] User can sign in and sign out.
- [ ] Session survives refresh.
- [ ] Admin cannot be self-assigned.
- [ ] Protected routes redirect unauthenticated users.

### Database

- [ ] Profile is created for a new account.
- [ ] Conversation is saved.
- [ ] User message is saved.
- [ ] Assistant response is saved.
- [ ] Conversation list loads after refresh.
- [ ] Old conversation can be reopened.
- [ ] RLS prevents cross-user access.

### Chatbot

- [ ] User can send a message.
- [ ] Assistant returns a real Gemini response.
- [ ] Assistant asks relevant follow-up questions.
- [ ] Assistant tracks facts and missing information.
- [ ] Case brief is structured and readable.
- [ ] Follow-up question chips work.
- [ ] Loading and error states work.
- [ ] Retry does not lose the user's message.
- [ ] User can correct and confirm extracted facts.
- [ ] No fabricated citations or source links appear.

### Security

- [ ] Gemini key exists only on backend.
- [ ] Service-role key exists only on backend.
- [ ] `.env` is ignored by Git.
- [ ] API verifies Supabase tokens.
- [ ] Every resource access checks ownership.
- [ ] AI endpoints have rate limits.
- [ ] Private conversation content is not logged unnecessarily.

---

## 13. Suggested integration schedule

| Milestone | Focus | Deliverable |
|---|---|---|
| 1 | Audit + environment | Safe configuration |
| 2 | Supabase Auth | Real sign up/login |
| 3 | Schema + RLS | Secure database |
| 4 | Express auth middleware | Protected API |
| 5 | Conversation/message services | Persistent chat storage |
| 6 | Gemini service | Real AI connection |
| 7 | Legal Intake Agent | Structured interactive responses |
| 8 | Chat API | End-to-end backend flow |
| 9 | React chat integration | Real interactive chatbot |
| 10 | Case brief corrections | User-reviewed case data |
| 11 | Security tests | Cross-user access protection |
| 12 | Demo rehearsal | Reliable working flow |

---

## 14. Definition of done

Phase 3 is complete when:

1. Users can sign up and log in with Supabase Auth.
2. Express verifies the user's Supabase token.
3. Users can create and reopen conversations.
4. User and assistant messages persist in Supabase.
5. Gemini responds through the backend only.
6. The chatbot asks useful follow-up questions.
7. The assistant creates a structured case brief.
8. Users can correct and confirm extracted facts.
9. The app survives refresh without losing chat history.
10. RLS and backend authorization prevent cross-user access.
11. Gemini failures do not silently lose user messages.
12. No secrets are exposed in the frontend or repository.

**Build priority:** First get authentication and secure chat persistence working. Then connect Gemini. Then improve the agent's legal reasoning and source retrieval. Do not start lawyer matching or document automation until this foundation is reliable.
