# EvaraOS iOS 27 Theme Audit – Phase 1

Status: Audit Started

## Confirmed Theme System Conflicts

### Theme Engine Remnants
Found references requiring removal or consolidation:
- public/assets/js/theme.js
- public/assets/js/theme-boot.js
- public/assets/js/settings-shared.js
- public/assets/js/app.js
- public/assets/js/nav/nav-utils.js
- public/assets/js/nav/nav-main.js

### Theme CSS Remnants
- public/assets/css/themes/theme-light.css
- public/assets/css/components/liquid-glass.css
- public/assets/css/components/glass.css
- public/assets/css/effects/liquid-ui-overrides.css
- public/assets/css/mobile-polish.css
- public/assets/css/base/variables.css
- public/assets/css/base/layout.css

### Navigation Architecture Conflict
Current architecture uses bottom dock navigation (eva-nav-pill).
Target architecture is iOS 27 top floating Siri-style morphing island.

### Immediate Findings
- data-theme system still exists.
- dark mode selectors still exist.
- multiple glass authorities exist.
- navigation and theme concerns are coupled.

## Phase 2 Planned
1. Build deletion matrix.
2. Remove dark mode architecture.
3. Build Liquid Glass V3 authority.
4. Replace dock navigation with Siri Island navigation.
