# NyayaConnect AI — Frontend Design & VS Code Copilot Prompt Pack

**Phase:** UI/UX design and frontend implementation  
**Design direction:** Minimalism  
**Stack:** React + Vite + JavaScript + Tailwind CSS + React Router  
**Goal:** Build a polished, responsive frontend with realistic mock data before connecting the backend.

---

## 1. Design decision: Minimalism

Use **Minimalism only** as the design system. Do not combine it with neumorphism or claymorphism.

### Why minimalism fits NyayaConnect AI

NyayaConnect is a legal-tech product. People may arrive worried, confused, or under pressure. The interface should feel calm, credible, clear, and easy to navigate. Minimalism helps users focus on the legal task rather than decorative effects.

### Visual identity

| Element | Direction |
|---|---|
| Primary color | Deep navy `#14243A` |
| Secondary color | Slate `#526174` |
| Accent | Muted gold `#B89455` |
| Page background | Warm off-white `#F7F8FA` |
| Surface | White `#FFFFFF` |
| Border | Light grey `#E5E9EF` |
| Success | Restrained green |
| Warning | Muted amber |
| Error | Accessible red |
| Typography | Inter or a clean system sans-serif |
| Corners | Consistent, moderately rounded |
| Shadows | Very subtle; use borders first |
| Icons | Lucide icons, consistent stroke weight |
| Motion | Short, subtle transitions; respect reduced-motion preferences |

### Design rules

1. Use whitespace to create hierarchy.
2. Use a clear page title, short description, and one primary action per screen.
3. Keep body text readable and avoid tiny grey text.
4. Use navy for primary actions and muted gold sparingly.
5. Use cards only when they group related information.
6. Avoid excessive gradients, glass effects, 3D buttons, inflated shadows, and decorative blobs.
7. Keep button styles, input heights, border radii, and spacing consistent.
8. Use clear focus rings, keyboard navigation, labels, and accessible contrast.
9. Design mobile layouts deliberately; do not simply shrink desktop screens.
10. Every page must include loading, empty, and error states where relevant.

---

## 2. Frontend scope for this phase

Build the frontend using **mock data** first. Do not connect Gemini or Supabase yet unless the UI is already stable.

### Build these screens

#### Public
- Landing page
- Login
- Register with Citizen / Advocate selection

#### Citizen
- Dashboard
- AI Legal Assistant
- Case brief and action-plan panel
- Advocate discovery
- Advocate profile
- Consultation requests
- Documents page (initially mock data)

#### Advocate
- Advocate dashboard
- Incoming consultation requests
- Request detail with Accept / Decline / Counter-propose actions
- Profile editor

#### Shared
- Responsive navigation
- Notifications panel or notification list
- Reusable buttons, cards, badges, inputs, modals, tabs, and empty states
- Not-found page

For this first frontend pass, make the major flows navigable and interactive with local mock data. Do not pretend a real request has been sent to an advocate. Use clear demo-state labels.

---

## 3. Recommended frontend structure

```text
client/
└── src/
    ├── assets/
    ├── components/
    │   ├── ui/
    │   │   ├── Button.jsx
    │   │   ├── Input.jsx
    │   │   ├── Card.jsx
    │   │   ├── Badge.jsx
    │   │   ├── Modal.jsx
    │   │   ├── EmptyState.jsx
    │   │   └── PageHeader.jsx
    │   ├── layout/
    │   │   ├── PublicLayout.jsx
    │   │   ├── CitizenLayout.jsx
    │   │   └── AdvocateLayout.jsx
    │   ├── landing/
    │   ├── assistant/
    │   ├── advocates/
    │   ├── requests/
    │   └── dashboard/
    ├── data/
    │   ├── mockAdvocates.js
    │   ├── mockRequests.js
    │   └── mockCases.js
    ├── pages/
    │   ├── public/
    │   ├── citizen/
    │   ├── advocate/
    │   └── NotFound.jsx
    ├── routes/
    ├── services/
    │   └── mockApi.js
    ├── hooks/
    ├── context/
    ├── utils/
    ├── App.jsx
    ├── index.css
    └── main.jsx
```

Adapt the existing project rather than duplicating files or replacing working setup.

---

## 4. Frontend implementation sequence

Follow this order. Ask Copilot to complete and test one milestone before moving to the next.

| Milestone | Build | Completion check |
|---|---|---|
| 1 | Design tokens and reusable UI components | Consistent buttons, inputs, cards, badges |
| 2 | Routing and layouts | Public, citizen, advocate navigation works |
| 3 | Landing page | Responsive, clear product story and CTA |
| 4 | Login and registration | Forms validate and role selection works in demo mode |
| 5 | Citizen dashboard | Overview cards and recent activity |
| 6 | AI assistant | Chat interaction, follow-up prompts, case brief |
| 7 | Advocate discovery | Search, filters, profile cards |
| 8 | Advocate profile | Profile details and request CTA |
| 9 | Consultation request flow | Mock pending/accepted/declined/counter-proposed states |
| 10 | Advocate dashboard | Incoming requests and response controls |
| 11 | Documents page | Draft list, status, preview/edit mock |
| 12 | Responsive and accessibility pass | Mobile, keyboard, contrast, loading/empty/error states |

---

## 5. Global Copilot instruction

Paste this first into GitHub Copilot Chat in VS Code:

```text
We are building the frontend of NyayaConnect AI, a legal-tech web application for India.

Frontend stack:
- React + Vite + JavaScript
- Tailwind CSS
- React Router
- lucide-react icons

Design system:
Use MINIMALISM as the only design direction. Do not mix neumorphism or claymorphism.
The interface must feel calm, professional, trustworthy, accessible, and modern.
Use deep navy #14243A, slate #526174, muted gold #B89455, warm off-white #F7F8FA, white surfaces, and light grey borders #E5E9EF.
Use consistent spacing, restrained shadows, clear typography, moderate corner radii, and subtle transitions.
Avoid excessive gradients, glassmorphism, 3D effects, oversized shadows, and decorative clutter.

Product:
Citizens describe legal problems, receive preliminary legal information, organize facts, optionally prepare editable AI drafts, discover advocates, and send consultation requests. Advocates can accept, decline, or counter-propose. Citizens confirm a counter-proposal.

Frontend rules:
1. Inspect the existing code before editing.
2. Do not recreate or overwrite the project scaffold unnecessarily.
3. Use reusable components and a consistent design token system.
4. Use responsive mobile-first layouts.
5. Use semantic HTML, accessible labels, keyboard navigation, visible focus states, and good contrast.
6. Include loading, empty, validation, and error states.
7. Use lucide-react icons consistently.
8. Use mock data and a mock API service in this phase.
9. Do not claim a real advocate request, booking, payment, or document filing occurred.
10. Do not implement fake legal advice or invented legal citations.
11. Do not put API keys or secrets in frontend code.
12. Keep components reasonably small and maintainable.
13. Do not add dependencies without explaining why.
14. Do not modify unrelated files.
15. After each task, report files changed, how to run the app, and what I should test.

Work only on the specific milestone I request. First inspect the repository and propose a short plan. Do not build every page at once.
```

---

## 6. Ready-to-use Copilot prompts

### Prompt 1 — Inspect project and prepare frontend

```text
Inspect the existing NyayaConnect AI repository, especially the client folder, package.json, Tailwind setup, and current routes.

Do not make large changes yet. Tell me:
1. What is already configured correctly?
2. What is missing for the frontend phase?
3. Which files should be created or updated?
4. Any version compatibility issues you notice?

Then propose the smallest safe implementation plan for the Minimalist design system. Do not overwrite working setup.
```

### Prompt 2 — Create design tokens and UI foundation

```text
Implement the NyayaConnect AI Minimalist design system in the existing React + Vite + Tailwind frontend.

Use:
- Navy #14243A
- Slate #526174
- Muted gold #B89455
- Warm off-white #F7F8FA
- White #FFFFFF
- Border #E5E9EF
- Inter or a clean system sans-serif

Create consistent design tokens and reusable components:
Button, Input, Textarea, Card, Badge, PageHeader, Modal, Avatar, Skeleton, EmptyState, and LoadingState.

Requirements:
- Variants for primary, secondary, outline, and danger buttons.
- Consistent input focus and error states.
- Accessible labels and focus rings.
- Responsive spacing and typography.
- Subtle borders and minimal shadows.
- No neumorphism, claymorphism, glassmorphism, or excessive gradients.

Inspect the installed Tailwind version and use the correct configuration style for that version. Do not break the current app. Show me the changed files and how to preview the components.
```

### Prompt 3 — Routing and app layouts

```text
Set up React Router routes and three reusable layouts for NyayaConnect AI:
1. PublicLayout
2. CitizenLayout
3. AdvocateLayout

Add route placeholders for:
- /
- /login
- /register
- /app
- /app/assistant
- /app/lawyers
- /app/lawyers/:id
- /app/requests
- /app/documents
- /advocate
- /advocate/requests
- /advocate/profile

Create a responsive sidebar/navigation for desktop and a compact mobile navigation pattern. Use the established Minimalist design tokens. For now, use a simple demo role switch or mock role state; do not pretend authentication is connected. Add a not-found page. Ensure every navigation link works.
```

### Prompt 4 — Landing page

```text
Build a polished, responsive landing page for NyayaConnect AI using the established Minimalist design system.

Sections:
1. Header with logo text, navigation, Login, and Get Started.
2. Hero headline: "Understand your legal options. Find the right advocate."
3. Short supporting description explaining that the platform helps people organize legal concerns, understand preliminary information, prepare drafts, and discover advocates.
4. Primary CTA: "Get legal guidance".
5. Secondary CTA: "Explore how it works".
6. Three-step section: Understand, Prepare, Connect.
7. Feature section for AI legal assistant, document preparation, and advocate discovery.
8. Trust and privacy section with careful, non-absolute wording.
9. Visible disclaimer that the platform provides preliminary legal information and does not replace a qualified advocate.
10. Footer with About, Privacy, Terms, and Contact placeholders.

Use clean whitespace, strong typography, navy primary buttons, restrained gold accents, and simple icons. Do not invent customer testimonials, success rates, lawyer counts, awards, or government partnerships. Make all CTA links navigate correctly.
```

### Prompt 5 — Login and registration

```text
Build responsive Login and Register pages for NyayaConnect AI.

Registration should allow a demo role selection:
- Citizen
- Advocate

Include name, email, password, confirm password, and role-appropriate fields only where necessary. Add validation, show/hide password, inline errors, loading state, and clear success/error feedback.

For now, use a mock authentication service with clearly marked demo behavior. Do not store passwords in localStorage or hardcode real credentials. Do not allow admin self-registration. Keep the design consistent with the Minimalist design system and make the forms keyboard accessible.
```

### Prompt 6 — Citizen dashboard

```text
Build the citizen dashboard at /app using realistic fictional mock data.

Include:
- Welcome header and a clear "Describe your legal issue" primary action.
- A prominent assistant entry card.
- Active consultation request summary.
- Recent cases or conversations.
- Document drafts summary.
- A short "What to prepare" checklist.
- Helpful empty states for a new user.

Use compact cards, clear labels, restrained colors, and responsive layout. Do not display fabricated platform statistics or claim real activity. Keep mock data in separate files rather than embedding it in page components.
```

### Prompt 7 — AI Legal Assistant interface

```text
Build the NyayaConnect AI Legal Assistant page at /app/assistant.

Layout:
- Main chat conversation area.
- Message composer with send button.
- Suggested starter questions.
- Assistant typing/loading state.
- Error/retry state.
- Follow-up question presentation.
- A side panel or responsive collapsible section showing the structured case brief.
- A preliminary next-step checklist section.

Use a mock API service for now. Make the chat interactive and keep conversation state in React. Clearly label the assistant output as preliminary legal information. Include a visible reminder that AI output may be incomplete and important decisions should be checked with a qualified advocate. Do not generate fake statute citations or present the mock response as verified law. Make the layout work well on mobile.
```

### Prompt 8 — Advocate discovery and filters

```text
Build the advocate discovery page at /app/lawyers with fictional demo profiles stored in a separate mock data file.

Include:
- Search by name or practice area.
- Filters for practice area, jurisdiction/state, city or remote consultation, language, and indicative consultation fee range.
- Clear filter/reset controls.
- Advocate cards with name, practice areas, jurisdiction, experience, languages, remote availability, verification status label only if the mock data explicitly supports it, and indicative fee range if supplied.
- A clear "View profile" action.

Use deterministic filtering in frontend mock data. Do not invent credentials, enrolment numbers, ratings, reviews, or verification claims. Clearly mark demo profiles as sample data in development. Make filters usable on mobile.
```

### Prompt 9 — Advocate profile page

```text
Build the advocate profile detail page at /app/lawyers/:id.

Show:
- Advocate display name.
- Practice areas.
- Jurisdiction.
- Experience.
- Languages.
- City and remote consultation availability.
- Profile biography.
- Indicative consultation fee information, if available.
- Verification status only when supported by explicit mock data.
- A clear "Request a consultation" action.

The request action should open a confirmation form/modal asking the citizen to provide a short message and optional preferred time. On submit, call the mock API and show a demo request confirmation. Do not claim an actual advocate has been contacted. Keep the layout calm, readable, and responsive.
```

### Prompt 10 — Citizen consultation requests

```text
Build the citizen consultation requests page at /app/requests.

Show request cards with:
- Advocate name.
- Request date.
- Related issue/case title.
- Status: pending, accepted, declined, counter-proposed, confirmed, or cancelled.
- Any counter-proposed consultation details.

Allow the citizen to confirm or reject a counter-proposal in demo mode. Use clear confirmation dialogs and update mock state predictably. Do not allow impossible status transitions. Clearly label all activity as demo data until the backend is connected. Include useful empty and loading states.
```

### Prompt 11 — Advocate dashboard and request inbox

```text
Build the advocate dashboard and /advocate/requests page using fictional mock requests.

Include:
- Summary of incoming and active requests.
- Request list with citizen-provided issue summary, date, and status.
- Request detail view or modal.
- Actions: Accept, Decline, Counter-propose.
- Counter-proposal form for an alternative consultation time and optional indicative fee.
- Confirmation dialog before changing a request.
- Empty state when there are no requests.

Use mock API functions and a clear demo label. Ensure the UI prevents actions that do not match the request status. Do not expose private citizen documents in the advocate view unless the mock record explicitly indicates that the citizen shared them.
```

### Prompt 12 — Documents page

```text
Build /app/documents as a frontend prototype with mock data.

Include:
- Uploaded document list.
- AI-generated draft list.
- Document type and last updated date.
- Status labels such as Private, Shared with selected advocate, and AI draft — unreviewed.
- A draft preview/edit screen with save-in-demo behavior.
- A visible warning that AI-generated drafts are not reviewed by an advocate.

Do not implement real file uploads or send documents to any service yet. Clearly label placeholder actions. Use accessible controls and responsive design.
```

### Prompt 13 — Responsive and accessibility audit

```text
Audit the complete NyayaConnect AI frontend for responsive behavior and accessibility.

Check:
- 360px mobile width, tablet, laptop, and wide desktop.
- Navigation and sidebar behavior.
- Horizontal overflow.
- Form labels and validation.
- Keyboard navigation and visible focus.
- Dialog focus and dismissal behavior.
- Color contrast.
- Text sizing and line length.
- Loading, empty, and error states.
- Reduced-motion preference.
- Consistent spacing, buttons, cards, and headings.

Fix issues without changing the chosen Minimalist design direction. Do not add neumorphism, claymorphism, glass effects, or unnecessary animations. Report what you tested and any remaining limitations.
```

### Prompt 14 — Frontend integration readiness

```text
Review the frontend and prepare it for backend integration.

1. Find all mock data and mock API calls.
2. Ensure components call service functions rather than importing mock arrays directly.
3. Define clear request/response shapes for auth, assistant chat, case brief, advocate search, consultation requests, and documents.
4. Add consistent loading, error, and empty states.
5. Identify which pages are still placeholders.
6. Do not connect Supabase or Gemini in this task.
7. Do not remove working demo behavior.

Produce an integration checklist and list the exact API endpoints the backend must implement.
```

---

## 7. How to use these prompts

1. Open the `nyayaconnect-ai` root folder in VS Code.
2. Open GitHub Copilot Chat and select Agent mode if available.
3. Paste the **Global Copilot instruction** once at the beginning of the project conversation.
4. Run Prompt 1 first.
5. Review Copilot's plan before allowing edits.
6. Run one milestone prompt at a time, in order.
7. Start the app and test after each milestone.
8. Commit stable milestones to Git.
9. Do not move to the next prompt while the current screen is broken.

Suggested Git checkpoints:

```bash
git add .
git commit -m "chore: inspect and prepare frontend"

git add .
git commit -m "feat: add minimalist design system"

git add .
git commit -m "feat: add app layouts and routing"

git add .
git commit -m "feat: build public landing and auth pages"

git add .
git commit -m "feat: build citizen dashboard and assistant UI"

git add .
git commit -m "feat: build advocate discovery and profile"

git add .
git commit -m "feat: build consultation request workflows"

git add .
git commit -m "test: responsive and accessibility improvements"
```

---

## 8. What should be working at the end of this phase?

- [ ] Landing page looks polished and responsive.
- [ ] Login/register screens are navigable in demo mode.
- [ ] Citizen and advocate layouts are distinct and usable.
- [ ] Citizen dashboard displays realistic sample activity.
- [ ] Chat interface accepts messages and displays mock responses.
- [ ] Case brief and action checklist are visible.
- [ ] Advocate search and filters work.
- [ ] Advocate profile page works.
- [ ] Citizen can create a mock consultation request.
- [ ] Advocate can accept, decline, or counter-propose in demo mode.
- [ ] Citizen can confirm a counter-proposal in demo mode.
- [ ] Documents page displays editable mock drafts.
- [ ] All key pages work on mobile.
- [ ] No real credentials, legal documents, or API keys are embedded in the frontend.

---

## 9. What comes after this frontend phase?

Once the frontend is stable, the next phase is **backend and Supabase integration**:

1. Supabase Auth and profile creation.
2. PostgreSQL schema and RLS policies.
3. Express authentication middleware.
4. Advocate profiles and database-backed search.
5. Consultation request APIs and server-side state machine.
6. Gemini Legal Intake Agent.
7. Legal information retrieval with reliable source references.
8. Document drafting endpoint.
9. Private document storage and consent-based sharing.
10. End-to-end security and workflow testing.

**Important:** Do not start all backend integrations before the UI flows are clear. A working frontend prototype gives the team a concrete contract for what the backend must support.
