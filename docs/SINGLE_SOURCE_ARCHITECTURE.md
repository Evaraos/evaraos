# Evaraos Single-Source Architecture

## Non-negotiable rule
Each feature has one canonical runtime file and one canonical stylesheet. New work edits those files directly. Do not add `v2`, `v3`, `fix`, `final`, `override`, `patch`, or compatibility layers.

## File ownership
- Navigation: `public/assets/js/nav.js` and `public/assets/css/nav.css`
- Theme: `public/assets/js/theme.js` and `public/assets/css/theme.css`
- Messages: `public/assets/js/messages.js` and `public/assets/css/pages/messages.css`
- Authentication and route access: `public/assets/js/route-guard.js`

## Update procedure
1. Find the canonical owner file.
2. Remove obsolete code before adding replacement code.
3. Edit the canonical file in place.
4. Remove old imports and script or stylesheet references.
5. Delete superseded files in the same change.
6. Verify that only one listener, observer, subscription, and style authority exists for the feature.
7. Do not leave empty compatibility files or redirect imports.

## Performance rules
- No document-wide MutationObserver unless the feature cannot work without it.
- No duplicate Firebase auth listeners for the same page.
- No duplicate Firestore subscriptions for the same channel or collection.
- No runtime stylesheet swapping.
- No loader blocking navigation.
- No startup database cleanup or migration work.
- Defer nonessential data until the related panel is opened.

## Naming
Use stable names without version suffixes. Cache busting belongs in deployment headers or a single build identifier, not filenames.

## Definition of done
A feature update is complete only when the replacement works and all superseded imports, files, observers, listeners, and subscriptions are removed.
