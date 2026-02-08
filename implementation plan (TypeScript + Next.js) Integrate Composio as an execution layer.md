## Implementation plan (TypeScript + Next.js)

Integrate Composio as an execution layer by (1) creating an Auth Config for LinkedIn once, (2) onboarding each user through a hosted OAuth “Connect Link” flow, (3) storing only Composio’s Connected Account nanoId in the database, and (4) executing the LinkedIn “Create a LinkedIn post” tool with that user_id/connected account at runtime.[^57][^54][^18]

### Goals & non-goals

- Goal: “One-click connect LinkedIn” for SMB users (no extension/desktop install), then agents can post on their behalf with auditability and token refresh handled by Composio.[^57][^54]
- Goal: Multi-tenant safety (each of your users maps to a Composio user_id scope; tools are executed only in that scope).[^49]
- Non-goal: Storing LinkedIn passwords locally or “logging in with local credentials.” OAuth-based delegated authorization is the intended secure pattern; Composio supports managed OAuth flows and token refresh.[^57][^54]

---

## Architecture overview

### Key Composio concepts to implement

- **Auth Config**: app-level blueprint defining auth method, scopes, and whether using Composio-managed OAuth vs your own OAuth credentials; reusable across all your users.[^57]
- **Connected Account**: per-user connection to LinkedIn; Composio handles token refresh and lifecycle operations (enable/disable/refresh/delete).[^54]
- **user_id scoping**: in the new SDK/API, all operations are explicitly scoped by `user_id` (your internal user identifier, e.g., UUID/email), and you can further target a specific connected account via `connected_account_id` when needed.[^49][^54]

### Recommended service decomposition

- Next.js app (UI + API routes)
- DB (Postgres + Prisma recommended) storing Composio IDs and your business-level “agent job” state
- Background jobs/queue (for “auto-post” and retries): e.g., BullMQ/Redis, SQS, or serverless cron + durable workflow
- Composio Cloud (auth + tool execution)

---

## Phase 0 — Composio project setup (1–2 hours)

### 0.1 Create Composio account and API key

- Create a Composio project and generate an API key (store it as a server-only secret).[^53]

### 0.2 Create LinkedIn Auth Config

- In Composio dashboard, create an **Auth Config** for LinkedIn and choose:
  - Composio-managed OAuth for development/testing (fastest path).[^57]
  - For production: create your own LinkedIn developer OAuth credentials (if needed for branding/white-labeling), then configure a custom auth config.[^57]

Notes:
- Composio describes Auth Configs as reusable and recommends multiple Auth Configs only when you need different scopes, different OAuth apps, or different environments.[^57]

### 0.3 Decide your Composio `user_id`

- Use your internal user UUID or user email as `user_id` (must be stable and unique per tenant user).[^49]
- If your product has organizations/teams, prefer a structure like `orgId:userId` or store both and ensure `user_id` is unique globally.

---

## Phase 1 — Next.js + TypeScript integration (core plumbing)

### 1.1 Install Composio TypeScript SDK

```bash
pnpm add @composio/core
# or npm install @composio/core
```
[^62]

Initialize server-side:

```ts
import { Composio } from '@composio/core';

export const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY!,
});
```
[^62]

### 1.2 Environment variables

Server-only (`.env`):

- `COMPOSIO_API_KEY=...` (secret)
- `COMPOSIO_LINKEDIN_AUTH_CONFIG_ID=ac_...` (the Auth Config nanoId from Composio)[^49]
- `APP_BASE_URL=https://yourdomain.com` (used to build callback URLs)


### 1.3 Database schema (Prisma suggestion)

Store IDs and statuses, not raw tokens.

Recommended tables/fields:

**UserIntegration**
- `id`
- `userId` (your app user)
- `provider` (enum: LINKEDIN)
- `composioAuthConfigId` (e.g., `ac_...`)
- `composioConnectedAccountId` (e.g., `ca_...`)
- `status` (ACTIVE/INACTIVE/PENDING/FAILED/EXPIRED)
- `connectedAt`, `lastCheckedAt`
- `scopes` (optional JSON)

**AgentJob** (for posting)
- `id`
- `userId`
- `provider` (LINKEDIN)
- `connectedAccountId` (FK to UserIntegration)
- `content` (text JSON)
- `status` (QUEUED/RUNNING/SUCCEEDED/FAILED)
- `attempts`, `lastError`

Composio connected accounts have lifecycle operations (refresh/enable/disable/delete) and statuses; mirroring them helps UX and debuggability.[^54][^57]

---

## Phase 2 — User onboarding (OAuth connect) in Next.js

Composio supports a **hosted authentication (Connect Link)** flow where the user is redirected to a Composio-hosted URL that handles OAuth and returns the user to your callback URL.[^57]

### 2.1 Endpoint: start LinkedIn connect

**Route:** `POST /api/integrations/linkedin/connect`

Responsibilities:
- Ensure user is authenticated in your app.
- Create an OAuth connection request via Composio using `user_id` + `auth_config_id` and a `callback_url` back to your app.[^57]
- Return the `redirect_url` to your frontend.

From Composio docs, a connection request yields a `redirect_url` that the user visits to authenticate.[^57]

### 2.2 Frontend: “Connect LinkedIn” button

- Call your endpoint, then `window.location = redirect_url`.

### 2.3 Endpoint: OAuth callback / completion

**Route:** `GET /api/integrations/linkedin/callback`

Design notes:
- In OAuth, the user comes back to your callback URL, but you still need to mark the connection as established.
- Composio provides `waitForConnection` semantics (polling) to wait until the connected account becomes ACTIVE after initiation.[^57]
- In production, prefer async completion: store the initiation request ID and poll in background, or call Composio to check the connected account status and update your DB.

### 2.4 “Connected Accounts” management endpoints

Provide basic UX and ops:

- `GET /api/integrations/linkedin/status` (reads DB + optionally refreshes status)
- `POST /api/integrations/linkedin/disable` (set Composio account to INACTIVE + update DB)[^54]
- `POST /api/integrations/linkedin/enable` (set to ACTIVE)[^54]
- `POST /api/integrations/linkedin/refresh` (manual refresh)[^54]
- `DELETE /api/integrations/linkedin` (delete/revoke connection)[^54]

Composio docs note INACTIVE accounts cannot execute tools and refresh/delete operations are supported.[^54]

---

## Phase 3 — Posting flow (agent execution)

Composio’s LinkedIn toolkit supports:
- Create a LinkedIn post
- Delete LinkedIn post
- Get company info
- Get my info (includes author id)

These are the minimum building blocks to post as the authenticated user or (where permitted) organizations they manage.[^18]

### 3.1 Endpoint: create post (sync)

**Route:** `POST /api/linkedin/post`

- Validate user subscription/permissions.
- Load the user’s `composioConnectedAccountId` from DB.
- Execute tool call using Composio in that user context (and ideally with explicit `connected_account_id` if you allow multiple accounts).[^54][^49]
- Store the resulting share id/post id in your DB to support delete and audit.

### 3.2 Background execution (recommended)

For SMB workflows at scale, social posting should be queued and retried:

- Create `AgentJob` record
- Push to queue
- Worker pulls job and executes Composio tool
- Retry policy: exponential backoff; stop on auth terminal errors (EXPIRED/FAILED)

Composio will attempt OAuth refresh automatically and only marks EXPIRED after multiple refresh attempts fail.[^57]

### 3.3 Human-in-the-loop approval (recommended)

Add optional “Approve before posting” settings:
- Agent drafts content + preview
- User clicks “Approve & Post” → queue job

This reduces risk of account bans and increases trust.

---

## Phase 4 — Security & compliance controls

### 4.1 Don’t store raw tokens

- Prefer storing only `auth_config_id` and `connected_account_id` in your DB.
- Composio connected account credentials can be masked/redacted via “Mask Connected Account Secrets”; redaction is recommended for operational safety.[^54]

### 4.2 Principle of least privilege

- Create a dedicated LinkedIn Auth Config with only the scopes needed for posting.
- Create separate auth configs if you later add read-only analytics vs write actions.[^57]

### 4.3 Tenant isolation

- Ensure all tool executions use the current authenticated user’s `user_id` scope (never accept `user_id` from client).
- Enforce RBAC in your own product: which agents can post, for which workspaces.

### 4.4 Auditability

- Keep an internal audit log: userId, agentId, tool slug, timestamp, request payload hash, Composio connected account id.
- Composio’s plans mention audit logs and SOC II compliance as part of “Security & Administration” features.[^63]

---

## Phase 5 — Ops: rate limits, retries, observability

### 5.1 Rate limits

Composio pricing page lists rate limits by spending tier, including tool call rate limits and “infra limits,” so implement client-side throttling + queue-based smoothing.[^63]

### 5.2 Retries

- Retry transient network failures and 5xx.
- Do not blindly retry 401/403; instead mark integration as needing reconnect.

### 5.3 Monitoring

Track:
- connect success rate
- post success rate
- tool call latency
- per-tenant tool call volume (to forecast costs)

---

## Pricing / fees model (Composio)

Composio’s current pricing is usage-based, with separate meters for **tool calls** and **connected accounts**, plus log retention differences by tier.[^63]

### Pricing tiers (as of Composio pricing page)

| Tier | Base price | Included tool calls/month | Included connected accounts | Log retention |
|---|---:|---:|---:|---:|
| Totally Free | $0/mo | 20K | 1K | 14 days |
| Ridiculously Cheap | $29/mo | 200K (+ $0.299 / 1K extra) | 30K (+ $2 / 1K extra) | 30 days |
| Serious Business | $229/mo | 2M (+ $0.249 / 1K extra) | 100K (+ $1 / 1K extra) | 90 days |
| Enterprise | custom | flexible | flexible | flexible |
[^63]

### Estimating cost for LinkedIn auto-posting

A single “Create Post” generally maps to at least one tool call (often more if you also call “Get my info” or “Get company info” per post workflow).[^18]

Cost drivers:
- Number of posts per month (tool calls)
- Number of connected users (connected accounts)
- “Premium tool calls” don’t appear necessary for LinkedIn posting; they’re described as search APIs, code execution, scraping, OCR, etc.[^63]

Practical fee guidance:
- For most SMB deployments, the $29/mo tier can cover meaningful volume (200K calls/mo, 30K connected accounts included), but model your per-user posting frequency and include a buffer for retries and ancillary calls.[^63]

---

## Suggested rollout plan (2–4 weeks)

### Week 1 — MVP connect + manual post

- Create Auth Config in dashboard.[^57]
- Implement `connect → redirect → callback`.
- Store connected account id + status (ACTIVE) in DB.[^54][^57]
- Implement “Post now” endpoint calling LinkedIn Create Post tool.[^18]

### Week 2 — Queue + retry + approval

- Introduce background job runner.
- Add approval gate and UI preview.
- Add “disconnect/refresh/disable” endpoints.[^54]

### Week 3 — Multi-account & org posting

- Support multiple LinkedIn accounts per user (if needed) by storing multiple connected accounts; Composio supports multiple accounts and selecting `connected_account_id` for execution.[^54]
- Add organization posting capability using “Get company info” to discover orgs where the user has posting permissions.[^18]

### Week 4 — Hardening

- Add monitoring, dashboards, and cost metering.
- Add rate limiting and per-tenant quotas.
- Add internal audit logs (and align with Composio’s audit logs + retention needs via tier selection).[^63]

---

## Open items to confirm before final build

- Should “auto-post” be fully autonomous, or require approval per post (recommended for brand safety)?
- Is posting to LinkedIn **company pages** (organization posting) required from day 1, or only personal profiles?[^18]
- Expected scale: number of connected LinkedIn accounts (connected accounts meter) and monthly posts per account (tool calls meter).[^63]

If expected monthly connected LinkedIn accounts and average posts/week are shared, a precise monthly cost projection (tool calls + connected accounts) can be produced using Composio’s published rates.[^63]

---

## References

18. [Linkedin MCP Integration for AI Agents - Composio](https://composio.dev/toolkits/linkedin) - Securely connect your AI agents and chatbots (Claude, ChatGPT, Cursor, etc) with Linkedin MCP or dir...

49. [Our next generation SDKs - Composio Docs](https://docs.composio.dev/docs/migration-guide/new-sdk) - The following are example routes for Next.js and FastAPI. For development, you can also listen to tr...

53. [composio/docs/javascript/introduction.mdx at master · ComposioHQ/composio](https://github.com/ComposioHQ/composio/blob/master/docs/javascript/introduction.mdx) - Composio equip's your AI agents & LLMs with 100+ high-quality integrations via function calling - Co...

54. [Connected Accounts | Composio Docs](https://docs.composio.dev/docs/connected-accounts) - Manage and monitor user connections to toolkits

57. [Authenticating Tools](https://docs.composio.dev/docs/authenticating-tools) - Create auth configs and connect user accounts

62. [ComposioHQ/composio - GitHub](https://github.com/ComposioHQ/composio) - Composio equips your AI agents & LLMs with 100+ high-quality integrations via function calling - Com...

63. [Simple Pricing for Real-World Scale - Composio](https://composio.dev/pricing) - All usage-based pricing available with volume discounts and custom rates. Contact us for pricing. Ra...

