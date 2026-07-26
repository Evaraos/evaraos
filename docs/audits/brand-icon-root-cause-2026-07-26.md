# Evaraos Brand and Icon Root-Cause Audit — 2026-07-26

Branch: `fix/brand-icon-canonical-release`

## Executive finding

The icon problem was not one cache bug. It was a release-and-precedence failure across several layers:

1. Production was deployed from commit `fadec0085c0ab5a2186635edc882344849e18079`.
2. That deployed commit is not on the current `evaraos` branch history; the histories diverged.
3. The repaired PNG masters exist on the owner-builder branch but were never deployed.
4. Multiple browser scripts persisted old image data URLs in `localStorage` and re-applied them after page load.
5. App Icon Studio embedded an old “official” icon directly inside JavaScript, bypassing repository image files.
6. HTML, the manifest, Studio defaults, and notification surfaces used several competing image paths.
7. The previous surgical PR restored `public/assets/img/evaraos_logo.png` as a zero-byte file, so path-existence checks passed while the browser had nothing to decode.
8. Installed PWAs can retain icon metadata independently of normal HTTP cache behavior.

## Canonical asset contract

This patch establishes one source for each job:

- In-app brand mark: `/assets/brand/evaraos-mark.png?v=brand-canonical-20260726-1`
- Install/PWA/app icon: `/assets/brand/evaraos-app-icon.png?v=brand-canonical-20260726-1`
- Legacy logo alias: `public/assets/img/evaraos_logo.png` points to the validated brand-mark payload.
- Legacy 512 icon alias: `public/assets/img/icon-512.png` points to the validated app-icon payload.

A transparent mark is never used as a launcher icon. A square launcher icon is never used as the loader/navigation logo.

## Surgical changes

### Validated image payloads

The repaired final PNG payloads were copied from the validated owner-builder branch:

- 384×384 transparent mark blob: `243b1cbab7e934e8cc5b13f8e406d9a265dbbc28`
- 512×512 app icon blob: `3853322d7d02e0034a89024f59919ee7105c188f`

### Runtime precedence repair

- Removed the embedded base64 “official icon” from App Icon Studio.
- Removed blob-manifest generation from device-only icon preferences.
- Added a one-time migration that clears obsolete official-icon and snapshot keys.
- Preserved only an explicit current personal icon upload.
- Made published app-builder icons optional and validated; the canonical repository icon remains the fallback.
- Replaced the repeated mutation/visibility override guard with a compatibility shim that cannot persist an official image.

### First-paint repair

- Restored loader, homepage, authentication, sidebar, and topbar references that distinguish the mark from the app icon.
- Restored a valid legacy logo alias instead of the zero-byte file.
- Updated the static manifest to a new versioned icon URL.

### Studio repair

- Corrected Studio’s default app-icon, favicon, and brand-mark records.
- Migrated saved default Studio asset records away from `icon-512.png`.
- Brand assets use `contain`; content/background assets may continue to use `cover`.

### Push/PWA repair

- Background notifications now use the canonical versioned app icon.
- The manifest icon URL changes with this release so supporting browsers can detect an icon update.
- Existing installed iOS/Android copies may still require reinstalling the Home Screen app because the operating system can retain installed metadata.

## Verification gates

Before production release:

- Decode both PNG masters and verify dimensions/alpha.
- Confirm no zero-byte logo aliases.
- Confirm no `data:image/png;base64` official icon remains in App Icon Studio source.
- Confirm no code writes old official/snapshot keys.
- Confirm loader uses the mark and manifest uses the app icon.
- Confirm Studio’s `brand-mark` default points to the mark.
- Run icon-system, design-system, and Studio CI.
- Perform a deployed-origin check after the exact commit is released.

## Exact next task

Merge this isolated icon PR only after CI is green, deploy that exact merge commit through the protected Firebase Hosting workflow, then verify the deployed asset hashes. An already-installed Home Screen app should be removed and installed again during final iOS/Android verification.
