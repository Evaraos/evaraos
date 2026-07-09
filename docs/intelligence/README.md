# Evara Intelligence Layer

The Evara Intelligence Layer is the governed AI operating system for EvaraOS. It is designed to progress from an authenticated assistant into an autonomous business operator without allowing the model to bypass application permissions, tenant isolation, approvals, or auditability.

## Non-negotiable guarantees

1. **The model never becomes the authorization system.** Roles and capabilities are resolved by trusted server code.
2. **Tenant context is resolved on the server.** The client cannot select a company whose data the model should read.
3. **Read before recommend.** Claims about live operations must come from approved tools and aggregate Firestore data.
4. **Propose before execute.** Business-changing actions create approval requests; they are not executed by the assistant callable.
5. **Default deny.** Unknown roles, routes, tools, and actions are rejected.
6. **No secrets or raw customer PII in model context or logs.** Logs store hashes and redacted previews.
7. **Every run is auditable.** Each assistant request creates an `ai_runs` record with actor, tenant, status, tools, usage, and outcome.
8. **Autonomy must be reversible.** Future executors must support idempotency, rollback or compensating actions, and explicit failure states.

## Current production boundary

The first foundation release provides:

- Firebase callable: `aiCommand`
- Firebase App Check enforcement
- Signed-in actor and active-user validation
- AI access aligned with the existing `aiCommand` feature boundary:
  - Owner
  - Admin
  - Organization
- Tenant-safe aggregate operational snapshots
- Deterministic authorized navigation
- OpenAI Responses API orchestration
- Strict function schemas
- Maximum tool-call and output limits
- Redacted run logging
- Idempotent approval-request creation for proposed business changes
- No automatic business writes

## Server modules

```text
functions/
├── ai-command.js                  Callable boundary and error mapping
├── index-stats.js                 Active Firebase Functions entry point
└── intelligence/
    ├── audit.js                   Redaction, run logs, approval requests
    ├── context.js                 Actor and tenant-safe context resolution
    ├── orchestrator.js            Model/tool loop and deterministic routing
    ├── policy.js                  Roles, capabilities, action risk policy
    └── policy.test.js             Permission and risk regression tests
```

## Firestore records

### `ai_runs/{runId}`

Server-written execution record containing:

- actor user ID and normalized role
- company ID
- prompt hash and redacted preview
- run status
- model and response identifiers
- tool/action types
- action-request IDs
- token usage
- timestamps and redacted errors

Client access should remain denied until a dedicated governance dashboard and explicit rules are reviewed by the Security team.

### `ai_action_requests/{requestId}`

Server-written proposal record containing:

- deterministic request ID for retry safety
- action type
- risk level
- execution policy
- pending approval status
- redacted reason and payload
- requester and tenant
- approval history placeholder
- 24-hour expiration

Creating this record does **not** execute the action.

## Risk policy

| Risk | Examples | Current behavior |
|---|---|---|
| None | Navigate to an authorized page | Automatic UI suggestion |
| Read-only | Read aggregate operations snapshot | Automatic server tool |
| Low | Draft message, propose assignment, schedule change, quote | Pending approval request |
| High | Refund, permission change, publish, delete | Owner-approval request |
| Prohibited | Secret exposure, permission bypass, unknown action | Disabled |

## Roadmap

### Phase 1 — Intelligence foundation

- Governed assistant
- Tenant-safe context
- Run audit logs
- Approval contracts
- Read-only operational intelligence

### Phase 2 — Smart operations

- Lead qualification recommendations
- Schedule and dispatch recommendations
- Smart forms with server validation
- Notification prioritization
- Candidate and onboarding document review
- Customer message and quote drafts

### Phase 3 — Predictive intelligence

- Demand forecasting
- Staffing forecasts
- Churn and payment-risk prediction
- Route and capacity optimization
- Anomaly detection
- Owner daily intelligence brief

### Phase 4 — Approved execution

- Dedicated action executors
- Idempotency keys
- Approval workflow and role verification
- Before/after snapshots
- Compensating actions and rollback
- Action replay and incident review

### Phase 5 — Autonomous operations

- Policy-bounded recurring workflows
- Confidence thresholds
- Budget and rate limits
- Automatic low-risk execution where explicitly enabled
- Escalation only for exceptions or high-impact decisions

## Deployment requirements

Store the provider credential in Firebase Secret Manager:

```bash
firebase functions:secrets:set OPENAI_API_KEY
firebase deploy --only functions:aiCommand
```

The default model is configured in `orchestrator.js`. To override it without changing source, create the appropriate Firebase Functions dotenv file, such as `functions/.env.<project-id>`:

```dotenv
EVARA_AI_MODEL=gpt-4.1-mini
```

Do not commit environment files or secrets to the repository.

## Testing

From `functions/`:

```bash
npm test
```

The policy suite verifies role normalization, alignment with current frontend access, approval requirements, and high-risk owner control.
