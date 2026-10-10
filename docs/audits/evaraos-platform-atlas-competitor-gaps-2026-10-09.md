# EvaraOS Platform Atlas + Competitor Gap Review — 2026-10-09
Status: read-only repository/market review. User-facing presentation and Drive organization; no production deployment, legal rename or payroll activation.

## Deliverables
- 56-slide native Google Slides Platform Atlas: https://docs.google.com/presentation/d/1oIIJNt0d0VPTYrHq1m_RbiGgyM8Lm_TxVAqDfsxlXog/edit
- Native Google Doc living register: https://docs.google.com/document/d/10n7uCiL32kIQeDyP21g8vLfFVptTylOZ0zmH33ob51A/edit
- Existing Competitor & Market Intelligence document updated: https://docs.google.com/document/d/1Vnb0Ztr56c0elpmgaLLH_bUfpFDin_SINMv9mk0lG28/edit
- Canonical Drive folder: https://drive.google.com/drive/folders/1aHJ6HGVLsMnf0mwbH-0VIoJuT4qC-e7q
- Art folders: original logos https://drive.google.com/drive/folders/1AGJg67jkBao4eOHAkk8PMFNSFkJ1y_K9 ; concept mockups https://drive.google.com/drive/folders/1rXgEVk9a-C0kgZj7rzxUJIqMn942GQAT ; Google Business Profile https://drive.google.com/drive/folders/1HipeNuo576rUsB4ILheLc8STYTlmU2zg

## Source inventory sampled
Release: `docs/RELEASE_STATUS.md`, `docs/deployments/firebase-production-release.json`. Deployed Hosting SHA reported: `73cfc3cce1d43450e1da89fb9d330ca06597e018`; backed by Hosting-only release proof. Backend/Functions/security rules/storage release status not inferred.
Operations: `public/territory-map.html`, `public/assets/js/field-ops-realtime.js`, `public/assets/js/offline-leads.js`, `public/assets/js/dispatch-map.js`, `public/assets/js/shift-orchestration.js`.
Staff/permissions: `public/applications.html`, `functions/staff-onboarding.js`, `functions/staff-approval.js`, `public/assets/js/access-control.js`.
Business finance/commerce: `public/payroll.html`, `public/assets/js/payroll.js`, `public/customer-commerce.html`, `functions/marketplace-refunds.js`, `docs/MARKETPLACE_PRODUCTION_DEPLOYMENT.md`.
AI/Studio: `public/ai.html`, `public/assets/js/ai-chat.js`, `public/assets/js/studio/*`, `docs/design-system/FINAL_AUDIT_2026-07-09.md`.
Cross-cutting: messaging, notifications, customer portal, audit/replay/governance/analytics and predictive operations source surfaces.
Not a comprehensive semantic/security audit of every tracked file. File existence is not production proof.

## Competitor research update
1. SalesRabbit: territory drawing, assigned rep areas, location mapping, lead notes/status/appointments/reminders/routing. Source: https://salesrabbit.com/features/ , https://salesrabbit.com/sales-territory-mapping/
2. Enzy: leaderboards, incentives, profiles, sales coaching, approved scripts/training, performance AI. Source: https://enzy.ai/system , https://enzy.ai/solutions
3. ServiceTitan: pricebooks, equipment, forms, timesheets, financing, booking and customer communication. Source: https://www.servicetitan.com/features
4. Jobber: quote approvals, client requests, appointment details, invoices/payments, rebooking. Source: https://www.getjobber.com/features/client-hub/
5. Housecall Pro: AI answer/summarize calls; some booking automation described as future by its own help article. Source: https://help.housecallpro.com/en/articles/9740104-csr-ai-overview
6. Workiz: AI answering and call insights, built-in phones/messages, source tracking and smart scheduling. Source: https://www.workiz.com/features/
7. Homebase + Connecteam: hiring/schedules/time/payroll/HR and geolocation/geofenced clock-in/time export. Sources: https://www.joinhomebase.com/ , https://help.connecteam.com/en/articles/10086009-starting-guide-to-the-time-clock

## Proposed gap prioritization
P0: exact deployed proof, least-privilege roles/tenant bounds, worker shift/payroll legal/accounting definitions, end-to-end mobile and customer acceptance.
P1: prospect visit -> lead -> quote -> job -> invoice, accurate pricebook, secure messages, work-hours and consent-based clock-in/out, customer self-service.
P2: incentive coaching and training, AI phone/actions with human approval, earned-wage access only after lawful and funded rails, Studio publishing and provider-marketplace scale.

## Artwork and public-profile controls
Original glossy red E remains canonical; owner-provided 1 of 1 Cleaning and Supreme TrueClean marks remain originals. Separate visual concepts from real product screenshots and authentic staff/business photography. Google Business Profile service-area eligibility and incorrect map/Street View association remain separate tasks. Do not market speculative instant cash-out or fabricate company metrics.

## Account/source coverage
Accessible Google Drives: EvaraOS company and a connected personal account. A requested third address, grsnap@gmail.com, is not linked through the current Google Drive connection. Google Drive access does not expose historical ChatGPT conversations from other accounts. Unrelated personal documents were deliberately excluded.

## Revision policy
Update Slides, Drive living register and a reviewable GitHub record whenever a major audit, feature, release, architectural or brand decision changes. Review CI and explicit owner approval before any application modifications, merging or deployment.
