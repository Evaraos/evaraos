# Page material review inventory — 2026-10-07

This source review locates every retained page-material warning. It does not
establish authenticated visual acceptance. Both audits still report all 24
files; no warnings were suppressed or blanket-approved.

Studio text-block flattening and reduced-motion `none` declarations serve
different purposes from floating interface chrome. Frosted icon and authored
Studio-node previews represent selected content. Validate those outputs before
changing their effects. Application chrome should use canonical optics presets
after its actual cascade and rendered behavior have been checked.

| Page stylesheet | Source observations | Remaining review |
| --- | --- | --- |
| `ai-chat.css` | `.evara-ai-composer`: `blur(28px) saturate(175%)` | Authenticated control/material acceptance against canonical optics |
| `app-icon-premium-options.css` | `.app-icon-preview--frostedClear`: `blur(20px)!important` | Separate authored icon preview effects from application controls; verify both |
| `app-icon-studio-final.css` | `.app-icon-current-card,.app-icon-background-card,.app-icon-tips-card,.app-icon-device-card,.app-icon-ios-helper`: `blur(34px) saturate(1.42)!important`; `.app-icon-back,.app-icon-save-button`: `blur(26px) saturate(1.3)!important`; `.app-icon-toast`: `blur(24px)!important` | Authenticated control/material acceptance against canonical optics |
| `app-icon-studio-pro.css` | `.app-icon-preview--frostedClear`: `blur(18px)!important`; `.owner-edit-fab,.owner-editor-fab`: `blur(26px) saturate(1.35)!important` | Separate authored icon preview effects from application controls; verify both |
| `app-icon-studio-repair.css` | `.app-icon-current-card,.app-icon-background-card,.app-icon-tips-card,.app-icon-device-card`: `blur(28px) saturate(1.35)!important`; `.app-icon-upload-button,.app-icon-restore-button,.app-icon-back,.app-icon-save-button`: `blur(24px) saturate(1.25)!important` | Authenticated control/material acceptance against canonical optics |
| `app-icons-motion.css` | `.app-icon-toast`: `blur(22px) saturate(1.3)` | Authenticated control/material acceptance against canonical optics |
| `customer-portal.css` | `.customer-photo-modal`: `blur(16px)` | Authenticated control/material acceptance against canonical optics |
| `dispatch.css` | `.dispatch-skip-link`: `blur(24px) saturate(150%)` | Authenticated control/material acceptance against canonical optics |
| `jobs.css` | `.jobs-skip-link`: `blur(24px) saturate(150%)` | Authenticated control/material acceptance against canonical optics |
| `live-map.css` | `.live-map-card,.live-map-workspace`: `blur(20px) saturate(135%)`; `.map-float-button`: `blur(12px)`; `.map-selected-card`: `blur(18px)` | Authenticated control/material acceptance against canonical optics |
| `messages-fullscreen.css` | `.messages-sidebar`: `blur(24px) saturate(165%)`; `.messages-chat-head`: `blur(22px) saturate(160%)`; `.messages-composer`: `blur(24px) saturate(165%)` | Authenticated control/material acceptance against canonical optics |
| `messages-group-photo.css` | `body.messages-page .messages-photo-button`: `none !important`; `body.messages-page .messages-photo-button::after`: `blur(var(--lg-blur)) saturate(160%) !important` | Authenticated control/material acceptance against canonical optics |
| `messages-polish.css` | `.group-image-source-sheet`: `blur(12px)` | Authenticated control/material acceptance against canonical optics |
| `notifications-center.css` | `.notifications-toolbar`: `blur(24px) saturate(165%)`; `.notification-clear-rail`: `blur(18px) saturate(180%)`; `.notification-card`: `blur(22px) saturate(160%)` | Authenticated control/material acceptance against canonical optics |
| `schedule.css` | `.schedule-skip-link`: `blur(24px) saturate(150%)` | Authenticated control/material acceptance against canonical optics |
| `studio-canvas-sandbox.css` | `.studio-canvas-sandbox`: `blur(28px) saturate(130%)`; `.studio-canvas-sandbox-stage-help`: `blur(18px)` | Authenticated control/material acceptance against canonical optics |
| `studio-canvas-session.css` | `.studio-canvas-sync-status`: `blur(18px) saturate(1.15)`; `.studio-canvas-sync-status`: `none` | Verify sync status and intentional reduced-motion flattening |
| `studio-component-catalog.css` | `.studio-node[data-node-type="text-block"]`: `none` | Verify intentional text-block flattening; preserve readable authored content |
| `studio-experience-editor.css` | `.experience-editor-trigger`: `blur(22px) saturate(150%)`; `.experience-editor-drawer`: `blur(30px) saturate(155%)` | Authenticated control/material acceptance against canonical optics |
| `studio-production-authority.css` | `.studio-production-conflict-panel`: `blur(20px) saturate(140%)` | Authenticated control/material acceptance against canonical optics |
| `studio-visual-builder-runtime.css` | `.studio-card-block, .studio-metric-block, .studio-map-block, .studio-image-block, .studio-button-block`: `blur(calc(var(--node-glass, 72) * 0.45px)) saturate(1.18)` | Separate authored node presets from editor chrome; verify node appearance and editor controls |
| `studio-visual-builder.css` | `.studio-topbar`: `blur(28px) saturate(1.3)`; `.studio-dock`: `blur(28px) saturate(1.3)`; `.studio-card-block, .studio-metric-block, .studio-map-block, .studio-image-block, .studio-button-block`: `blur(var(--studio-glass-blur)) saturate(1.18)`; `.studio-context-toolbar`: `blur(26px) saturate(1.3)`; `.studio-sheet`: `blur(34px) saturate(1.35)`; `.studio-toast`: `blur(24px)` | Separate authored node presets from editor chrome; verify node appearance and editor controls |
| `territory-map.css` | `.territory-map-status`: `blur(var(--lg-blur)) saturate(160%)` | Authenticated control/material acceptance against canonical optics |
| `website-builder.css` | `.studio-hero,.studio-rail,.studio-canvas,.studio-inspector,.studio-command-card,.studio-feature-card,.studio-stat-card,.studio-module-card,.studio-blueprint-card,.studio-page-card,.studio-asset-card,.studio-component-pick`: `blur(30px) saturate(1.24)`; `.builder-toast`: `blur(22px)` | Authenticated control/material acceptance against canonical optics |

Acceptance requires the relevant authenticated routes in the existing four-device,
five-appearance matrix, including contrast, focus, responsiveness, modal behavior
and screenshot review. A source inventory alone does not clear these warnings.
