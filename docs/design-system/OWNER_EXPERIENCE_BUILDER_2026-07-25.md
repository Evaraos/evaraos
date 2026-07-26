# Owner Experience Builder

Status: implementation candidate  
Date: 2026-07-25  
Authority: Evara Studio / verified platform owner

## Purpose

The Owner Experience Builder gives verified EvaraOS owners a controlled way to update presentation and existing interface content without editing repository source for every copy, logo, or loader change.

It unifies two previously browser-local systems:

- Evara Studio visual editing
- Owner Live Edit on existing pages

The shared pipeline is:

1. Edit and preview locally.
2. Save an owner-only draft through an App Check-protected callable.
3. Publish with an expected draft revision.
4. Serve only the normalized published configuration through a public read endpoint.
5. Apply the last cached published configuration immediately, then refresh it in the background.

## Owner-editable surfaces in version 1

### Brand

- Visible loader and application mark
- PWA/app icon reference
- Brand alternative text
- Secure PNG, JPEG, or WebP upload under 2 MB

### Loader system

- Welcome-loader enabled state
- Eyebrow, title, and subtitle
- Minimum welcome display time
- Internal page-loader enabled state and accessible label
- Resume-loader enabled state, title, subtitle, and time-away threshold
- Shared accent, background, card radius, logo size, and progress visibility

### Homepage

- Kicker
- Main headline
- Supporting copy
- Primary action label
- Secondary action label

### Existing application pages

Owner Live Edit can publish existing:

- Text
- Images/background media
- Card radius
- Padding
- Glass strength

Temporary placeholder blocks remain local drafts until they are converted into registered Studio components. This prevents arbitrary HTML or unreviewed executable content from entering the live application.

## Security contract

- Draft, publish, and upload callables require Firebase Authentication and App Check.
- The backend re-reads the user profile from Firestore.
- Authority is limited to owner, super admin, platform admin, or platform-enabled admin.
- Draft and publish writes use server normalization.
- Published remote assets are restricted to the EvaraOS Firebase Storage bucket.
- Uploaded assets are limited to approved image MIME types and 2 MB.
- Configuration payloads are capped below Firestore's document limit.
- Publication uses an expected draft revision to prevent overwriting a newer owner edit.
- Every draft save, publication, and upload emits an audit record.
- The public endpoint returns only the published normalized configuration, never drafts or editor metadata.
- Arbitrary HTML, JavaScript, CSS strings, external scripts, and unrestricted external image origins are not supported.

## Performance contract

- Cached published configuration is applied on first paint where needed.
- Public configuration refresh is asynchronous and does not block the navigation shell.
- Loader behavior remains owned by `loader.js`; the Experience runtime configures it instead of creating a second loader lifecycle.
- The public payload contains presentation configuration only.
- Mutation handling is frame-debounced and applies only existing registered or deterministic edit targets.

## Storage and Functions

Firestore document:

```text
experience_configs/global
```

Storage prefix:

```text
experience-assets/global/
```

Trusted callables:

```text
getExperienceEditorState
saveExperienceDraft
publishExperienceConfig
uploadExperienceAsset
```

Public read function:

```text
getPublicExperienceConfig
```

Same-origin Hosting path:

```text
/__experience/config
```

## Deployment requirement

The feature requires one coordinated initial release containing:

- the five Experience Functions
- the Hosting rewrite
- the Studio and runtime assets

After that initial release, normal owner content publications do not require a GitHub commit or Firebase deployment. They update the published Experience configuration directly through the trusted owner workflow.

No deployment is authorized merely by merging this implementation.
