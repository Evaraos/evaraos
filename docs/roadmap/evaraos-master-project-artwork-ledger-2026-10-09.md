# EvaraOS Master Product and Artwork Ledger — 2026-10-09

**Status:** Documentation and review only; no merge, Firebase deployment, Google Business Profile edits, payment launch, rename, or third-party product replacement is authorized.

## Primary durable artifacts
- Google Slides (50 pages): https://docs.google.com/presentation/d/1oIIJNt0d0VPTYrHq1m_RbiGgyM8Lm_TxVAqDfsxlXog/edit
- Editable PowerPoint master, backed up in EvaraOS Drive: https://drive.google.com/file/d/12fm2NGZPi1Givi_Iyvu3taRHwpzUOXUy/view
- Detailed 50-slide source/evidence and action ledger, backed up in EvaraOS Drive: https://drive.google.com/file/d/1ymgqzPnp0VjrvZdrgbv5KUTn-Veh2btx/view
- Related visual brand direction (draft PR #96): https://github.com/Evaraos/evaraos/pull/96

## Canonical evidence boundary
The 2026-09-13 release status records successful **Hosting-only** deployment at `73cfc3cce1d43450e1da89fb9d330ca06597e018`. The machine-readable proof records Functions, Firestore, and Storage as **not deployed in that release**. The authenticated production QA validates owner session, Home, Leads, Dashboard and navigation, not arbitrary payments, backend AI, staff approvals or payouts. Source code and historical milestone percentages are not production acceptance.

See `docs/RELEASE_STATUS.md`, `docs/deployments/firebase-production-release.json`, `README.md`, and `docs/REPOSITORY_ORGANIZATION.md`.

## Repository feature register — audit categories
| Domain | Evidence anchor | Risk / gate |
|---|---|---|
| Dashboard / company portfolio | `public/dashboard.html`, `public/companies.html`, `public/assets/js/company-governance.js` | Tenant and data freshness QA |
| Staff applications / approval | `public/applications.html`, `functions/staff-approval.js` | Current authoritative rules / verified enrollment |
| Onboarding / work eligibility | `functions/staff-onboarding.js`, `docs/backend/SOURCE_RECONCILIATION_2026-09-12.md` | Approval != verified documentation != work eligibility != payout |
| Organization / role policy | `public/org.html`, `public/assets/js/access-control.js` | Enforced company/branch/team scope |
| Sales map / territories | `public/territory-map.html`, `public/assets/js/territory-map-dashboard.js` | Maps configuration and sales-role live QA |
| Offline lead capture | `public/assets/js/offline-leads.js`, `public/assets/js/offline-lead-queue.js` | Device trust, sync collisions and duplicates |
| Lead pipeline / conversion | `public/leads.html`, `public/assets/js/lead-job-conversion.js` | E2E follow-up/quote/job proof |
| Schedule / shifts | `public/schedule.html`, `public/assets/js/shift-orchestration.js` | Full attendance/clock-in and payroll timing unverified |
| Field location / dispatch | `public/assets/js/dispatch-map.js`, `public/assets/js/field-ops-realtime.js` | Consent/on-shift scope and real location accuracy |
| Jobs / service execution | `public/jobs.html`, `public/assets/js/jobs.js` | Role and customer completion QA |
| Service and vendor marketplace | `docs/MARKETPLACE_PROGRESS.md`, `docs/MARKETPLACE_PRODUCTION_DEPLOYMENT.md` | Production secrets, backend release and acceptance |
| Customer portals / self service | `public/customer_portal.html`, `public/customer-commerce.html` | Customer-role end-to-end testing |
| Stripe / subscription / refund | `functions/marketplace-refunds.js`, `public/assets/js/persistent-subscriptions-adapter.js` | Financial reconciliation, test-mode and policy QA |
| Finance / payroll queue | `public/payroll.html`, `public/enterprise-finance-dashboard.html` | Record summaries != compliant payroll service |
| On-demand worker cashout | No verified dedicated cashout engine in repo searches | Future product and legal/payment-provider work |
| Communications / push | `functions/messaging-registry.js`, `functions/push-notifications.js` | End-to-end delivery and consent |
| AI chat and intelligence | `public/ai.html`, `public/assets/js/ai-chat.js`, `docs/intelligence/PROGRESS.md` | Functions live scope, approved permissions, grounded data |
| Analytics / predictive | `public/analytics.html`, `public/predictive_ops.html` | Forecast validity and no fictional metrics |
| Governance / audit | `public/executive-queue.html`, `public/audit-dashboard.html` | Action audit & rollback |
| Studio / design tokens | `docs/adr/0001-studio-core.md`, `docs/design-system/FINAL_AUDIT_2026-07-09.md` | Visual QA, safe publishing and source/deployed gap |
| Security and release | `docs/SECURITY_RELEASE_BRANCH_MODEL.md`, `docs/RELEASE_STATUS.md` | Exact-SHA release verification |

## Brand and artwork history
1. May 2026: high-churn repo/UX audit and applications form polish; inspect historic documents before claiming resolution.
2. July 2026: Adaptive/Liquid Glass design system v2 and official brand/icon root-cause work. Canonical source assets are `public/assets/brand/evaraos-mark.png` and `public/assets/brand/evaraos-app-icon.png`.
3. September 2026: authenticated Hosting proof, roadmap and go-to-market planning.
4. October 2026: confirmed owner-provided glossy red E master, pearlescent homepage mockup, dark operations dashboard mockup, service category logo references, staff/worker/dispatch imagery, Google Profile logo and concept pack.
5. **Creative distinction:** user-supplied logos are official references; AI illustrative screens, people, revenues and fictional feature states are concepts and not documentary business photography or proof of released app functionality.

## Artwork index
- A001 red E — official logo / do not redraw.
- A002 light homepage mockup — creative draft.
- A003 dark operations dashboard — creative draft.
- A004 staff scheduling — creative draft.
- A005 worker mobile — creative draft.
- A006 dispatch/sales map — creative draft.
- A007 1 of 1 Cleaning house logo — owner supplied reference.
- A008 Supreme TrueClean wordmark — owner supplied reference.
- Next visual set: separate customer experience screens, not a mega collage.

## Google Business Profile publication gate
Use the verified official E in Logo. Use only authentic business photography and accurate sanitized deployed app screenshots as factual business photos. Concept art can be an internal marketing planning tool but not evidence of personnel, physical offices or live transactions. Investigate historic Google Maps pin/Street View mismatch and face-to-face eligibility separately.

## Delivery and ongoing ritual
At each important implementation, audit, brand decision or release: update feature status with tested role and precise release SHA, record source paths and known blockers, update slide(s), save the living register in Drive, commit corresponding docs in a scoped GitHub PR, and keep next actions owner-approved.

### Immediate decision queue
P0 — verify production source; Map/Leads/Staff role QA; Google Profile eligibility and location.
P1 — role hierarchy, field workflows and staff-facing visual screens; EvaraOS AI checks.
P2 — payout rails/legal review and Marketplace acceptance gates; customer visual story.
P3 — Studio publishing readiness, predictive workflows, trade school partnership thesis.

**Do not confuse this product map with a current deployed inventory.**
