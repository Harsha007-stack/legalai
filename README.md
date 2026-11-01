# NyayaConnect AI

## Local setup

1. In Supabase, open **SQL Editor** and run the migrations in order: [`supabase/migrations/202610310001_chatbot_schema.sql`](./supabase/migrations/202610310001_chatbot_schema.sql), [`supabase/migrations/202610310002_assistant_rpc_permissions.sql`](./supabase/migrations/202610310002_assistant_rpc_permissions.sql), [`supabase/migrations/202610310003_advocate_directory.sql`](./supabase/migrations/202610310003_advocate_directory.sql), [`supabase/migrations/202610310004_sample_advocate_directory.sql`](./supabase/migrations/202610310004_sample_advocate_directory.sql), [`supabase/migrations/202610310005_consultation_communications.sql`](./supabase/migrations/202610310005_consultation_communications.sql), [`supabase/migrations/202610310006_fix_consultation_request_rls_recursion.sql`](./supabase/migrations/202610310006_fix_consultation_request_rls_recursion.sql), and [`supabase/migrations/202610310007_fix_consultation_status_constraint.sql`](./supabase/migrations/202610310007_fix_consultation_status_constraint.sql). The second migration updates the assistant-message function for existing projects and grants execution only to authenticated users; it verifies the caller's user ID, so a service-role key is not needed. The third migration creates the advocate profile directory with owner-only edits and published-profile visibility for signed-in clients. The fourth seeds fictional sample advocates with reserved `example.com` emails; it does not create Auth accounts. The fifth enables persistent consultation requests, role-validated accept/decline/counter-proposals, per-participant request hiding, private messages, document storage, and call signaling. The sixth fixes request-creation RLS recursion for projects that already applied the fifth migration. The seventh replaces any stale consultation status check while preserving statuses on existing rows.
2. In Supabase Auth settings, configure the local site URL as `http://127.0.0.1:5173` (or `http://localhost:5173`) and choose the email-confirmation behavior for development.
3. Copy `client/.env.example` to `client/.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Copy `server/.env.example` to `server/.env` and set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `GEMINI_API_KEY`. Use a newly rotated Google Gemini API key; never put it in a `VITE_` variable or client file. The previously shared key should not be reused. `GEMINI_MODEL` defaults to `gemini-3.5-flash-lite`. For document analysis, optional provider keys are tried in order: Groq, Gemini, then Kimi (Kimi uses `KIMI_API_KEY` and defaults to `kimi-k3.1-pro`). Restart the server after changing keys.
5. Install dependencies once and start the frontend and API together. Restart the dev command after changing `.env` values:

```powershell
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The development frontend proxies `/api` requests to the API, avoiding browser CORS/localhost address mismatches.

## Single-service deployment

Build and run the entire site from the repository root:

```powershell
npm install
npm run build
npm start
```

The Node server serves both the built frontend and API on the same port. Configure the hosting provider's environment variables for the client build (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and server (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, and optionally `GEMINI_MODEL`, `GROQ_API_KEY`, and `KIMI_API_KEY`). Keep all AI provider keys server-side. Document analysis falls back from Groq to Gemini to Kimi when those providers are configured.

The assistant provides general legal information and does not retrieve verified legal sources. It asks up to three structured follow-up questions per turn and suggests practical next steps. Advocate profile publishing, real consultation requests, status changes, private case messages, and consultation document uploads use Supabase. Call signaling uses browser peer-to-peer WebRTC with a public STUN server; networks requiring a TURN relay may not connect. Fictional sample profiles support session-only demo requests; these are not sent to advocates and never enable chat, uploads, or calls. Displayed consultation prices are indicative ranges provided by advocates and must be confirmed directly.

## Netlify deployment

Netlify hosts the Vite frontend. Deploy the Express API separately (the included [`render.yaml`](./render.yaml) can create it on Render); keeping the API on a Node web service avoids serverless execution limits for document OCR and AI requests.

1. Import this GitHub repository into Netlify. Netlify reads [`netlify.toml`](./netlify.toml): the build command is `npm run build`, and the publish directory is `client/dist`. The redirect rule supports client-side routes.
2. Deploy the API from the repository on Render using the included Blueprint. Set its required `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GEMINI_API_KEY`, and `CLIENT_URL` environment variables. `CLIENT_URL` must be the exact deployed Netlify site origin (for example, `https://your-site.netlify.app`). Add any configured document-provider keys in Render's environment settings. Never commit or put provider secrets in Netlify `VITE_` variables.
3. In Netlify's environment settings, add `VITE_API_BASE_URL` with the Render API origin (for example, `https://nyayaconnect-api.onrender.com`), `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY`. Trigger a new deploy after setting or changing these values; Vite embeds them at build time.
4. In Supabase Auth URL configuration, add the deployed Netlify URL to the allowed redirect URLs and set the production site URL. Keep the existing database migrations applied.

Check `https://<your-api-host>/api/health` after the API deploy; it should return `{"status":"ok","service":"nyayaconnect-api"}`. Render's free service may sleep while idle, so the first API request after inactivity can be slow.

To let clients attach a document to a pending consultation request, run [`supabase/migrations/202611010008_request_document_sharing.sql`](./supabase/migrations/202611010008_request_document_sharing.sql) in the Supabase SQL Editor after migrations 001–007. The advocate can open the private attachment from the request inbox; the client’s concern and document are shared with the selected advocate when the request is sent.

Advocate profiles support multiple practice areas and an optional AI bio draft. The draft uses only the advocate’s profile details and notes, is editable, and is not published until the advocate saves the profile. For a live consultation request, clients must separately consent to AI processing of their concern and any attachment for a preliminary advocate-facing brief, and to sharing an attachment with the advocate. If AI generation or document text extraction is unavailable, the request can still be sent with the client’s original concern and consented attachment; the inbox labels the brief as unavailable rather than presenting it as analyzed. The brief and original concern are stored together in the existing `case_summary` field; this feature does not require another database migration. AI summaries are unverified, are not legal advice, and should be checked with the client.
