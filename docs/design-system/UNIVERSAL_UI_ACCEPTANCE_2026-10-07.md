# Universal UI, brand and navigation — 2026-10-07

Status: shared source contracts and public guest browser checks pass on the
isolated candidate. Full authenticated acceptance remains unverified. This is
not a production release or a verified 5/5 result.

Base: `11e9e25bdc03aea63e1881fdaa48d2f066b72c1a` on canonical `evaraos`.

## Changes

- Synchronized theme, prepaint and navigation entry URLs across 67 visible and
  compatibility pages. Removed 39 duplicate theme stylesheet/runtime tags.
- Restored Appearance's synchronous save/reset APIs, mode constants and wallpaper
  API; settings imports the same versioned theme instance as its page.
- Unified prepaint/runtime mode resolution, legacy settings migration, valid zero
  dimming and live wallpaper canvas variables. Theme changes update the page
  background and native control color scheme. Image loading has a bounded wait.
- Supplied the selected image/settings to adaptive sampling. Stable light/dark
  modes use semantic ink; image text is sampled per word to avoid repeating a
  multiline gradient against different backgrounds. Adaptive contrast preserves
  a prior tone only when it still meets the sampling threshold. These samples
  do not certify every real wallpaper or authenticated route's contrast.
- Moved shared field/modal material into the active optics painter and retained
  reduced-motion, forced-colors and visible keyboard focus styles.
- Enabled browser zoom. The shared drawer has modal semantics, persistent control
  names, inert background interaction, contained Tab/Shift+Tab focus, Escape
  closure and focus restoration. Platform Admin selects the owner app catalog;
  existing page-access policy still filters destinations.
- Expanded secure role QA to Appearance Settings for every canonical role and
  both system color preferences. Setup and each route require the expected
  verified authenticated role. Accessible-name/focus checks now reject missing
  persistent names and invisible focus indicators.
- Added credential-free Universal UI Contracts CI and negative/state/renderer
  regression tests. Authentication and release-proof gates remain required.

## Verified candidate evidence

| Check | Result |
| --- | --- |
| Theme deep audit | PASS; baseline 97 errors resolved; 24 warnings remain |
| Interface audit | PASS; baseline 171 failures resolved |
| State/asset/renderer regression tests | PASS, 10 tests |
| Navigation refresh and Home authority | PASS, including all canonical role source fixtures |
| Access/lifecycle, design-system and visual-QA contracts | PASS |
| Guest Home/login/signup/staff application at 320/390/768/1440 px | PASS, 16 cases; no root overflow, duplicate IDs or unnamed visible controls |
| Home light/dark/system-light/system-dark/image at those widths | PASS, 20 cases; one theme stylesheet, correct resolved environment and no root overflow |
| Reduced motion and forced colors on public Home | PASS, checked rendered styles |
| Guest drawer keyboard containment, Escape and focus return | PASS in the rendered Chromium preview |

Guest and appearance matrix captures reported zero uncaught page exceptions and
zero failed same-origin asset requests after repairing the local preview
server's connection queue and applying the checked-in Hosting asset rewrite.
The localhost browser still emitted Firebase App Check/reCAPTCHA errors without
a registered QA debug token. Therefore these results are public layout checks,
not a clean authenticated runtime acceptance result. Guest Chromium checks do
not certify iPhone WebKit or Android hardware behavior.

## Remaining acceptance gates

1. Review/merge the isolated candidate through canonical protection. The connected
   baseline and production release are unchanged until integration/deployment.
2. Review the 24 page-specific material warnings, particularly Studio/editor
   chrome, App Icon Studio, communications and map overlays. They are retained
   in both audits and have not been suppressed or declared accepted.
3. Securely configure the encrypted QA origin, App Check debug token and all nine
   role credential pairs. At inspection, repository/environment secret-name
   inventories contained no `EVARA_QA_*` configuration. Never provide values in
   chat, source, reports or logs.
4. Satisfy the existing confirmed full Firebase release-proof prerequisite for
   the exact tested source. Current canonical proof does not establish full
   Hosting/Functions/Firestore/Storage acceptance of this UI candidate.
5. Run the full authenticated matrix: 98 role/route pairs × four devices, plus
   35 critical pairs × five appearance cases × four devices. Review screenshot
   artifacts, focus/label diagnostics and actual contrast/interaction behavior.
   Baseline generation, skipped jobs and source renderer fixtures do not count
   as passing role acceptance.

The confirmed score remains 3/5 until the partial theme acceptance and unverified
role matrix have actual integration and acceptance evidence. This candidate
removes the shared implementation defects and makes the remaining gates concrete.
