const icons = {
  home: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.2 10.4 12 4.35l7.8 6.05v9.1c0 .88-.72 1.6-1.6 1.6h-4.05v-6.35h-4.3v6.35H5.8c-.88 0-1.6-.72-1.6-1.6v-9.1Z" fill="currentColor"/></svg>`,
  login: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.25 7.2V4.95h7.4c1.22 0 2.2.98 2.2 2.2v9.7c0 1.22-.98 2.2-2.2 2.2h-7.4V16.8h7.05V7.2h-7.05Z" fill="currentColor"/><path d="M10.85 8.35 15 12l-4.15 3.65v-2.28H4.15v-2.74h6.7V8.35Z" fill="currentColor"/></svg>`,
  logout: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.75 4.95H6.35c-1.22 0-2.2.98-2.2 2.2v9.7c0 1.22.98 2.2 2.2 2.2h7.4V16.8H6.7V7.2h7.05V4.95Z" fill="currentColor"/><path d="M14.15 8.35 18.3 12l-4.15 3.65v-2.28H8.05v-2.74h6.1V8.35Z" fill="currentColor"/></svg>`,
  signup: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.6 11.45a4.05 4.05 0 1 0 0-8.1 4.05 4.05 0 0 0 0 8.1Zm0 2.05c-4.05 0-7.3 2.05-7.3 4.58v1.02c0 .68.55 1.23 1.23 1.23h8.45a6.1 6.1 0 0 1-.28-1.83 6.2 6.2 0 0 1 1.9-4.45 10.02 10.02 0 0 0-4-.55Z" fill="currentColor"/><path d="M18.5 14.05a1.1 1.1 0 0 1 1.1 1.1v2.2h2.2a1.1 1.1 0 1 1 0 2.2h-2.2v2.2a1.1 1.1 0 1 1-2.2 0v-2.2h-2.2a1.1 1.1 0 1 1 0-2.2h2.2v-2.2a1.1 1.1 0 0 1 1.1-1.1Z" fill="currentColor"/></svg>`,
  dashboard: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.1 4.1h6.65v6.65H4.1V4.1Zm9.15 0h6.65v6.65h-6.65V4.1ZM4.1 13.25h6.65v6.65H4.1v-6.65Zm9.15 0h6.65v6.65h-6.65v-6.65Z" fill="currentColor"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.15a3.85 3.85 0 1 0 0 7.7 3.85 3.85 0 0 0 0-7.7Zm8.7 5.25c.05-.46.05-.94 0-1.4l1.65-1.3-1.85-3.2-1.98.78a8.3 8.3 0 0 0-1.22-.7L17 5.45h-3.7l-.3 2.13c-.43.18-.84.42-1.22.7L9.8 7.5l-1.85 3.2L9.6 12c-.05.46-.05.94 0 1.4l-1.65 1.3 1.85 3.2 1.98-.78c.38.28.79.52 1.22.7l.3 2.13H17l.3-2.13c.43-.18.84-.42 1.22-.7l1.98.78 1.85-3.2-1.65-1.3Z" fill="currentColor"/></svg>`,
  companies: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.8 20.8V6.5c0-.7.45-1.32 1.12-1.54l6.58-2.2c.32-.1.68-.1 1 0l6.58 2.2c.67.22 1.12.84 1.12 1.54v14.3h-6.1v-6.1H9.9v6.1H3.8Z" fill="currentColor"/></svg>`,
  users: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 11.35a4.35 4.35 0 1 0 0-8.7 4.35 4.35 0 0 0 0 8.7Zm0 2.25c-4.6 0-8.35 2.35-8.35 5.25v.75c0 .75.6 1.35 1.35 1.35h14c.75 0 1.35-.6 1.35-1.35v-.75c0-2.9-3.75-5.25-8.35-5.25Z" fill="currentColor"/></svg>`,
  leads: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.35 2.55 5.18 5.72.83-4.14 4.04.98 5.7L12 16.42 6.89 19.1l.98-5.7-4.14-4.04 5.72-.83L12 3.35Z" fill="currentColor"/></svg>`,
  jobs: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.15 6.2V4.9c0-1.16.94-2.1 2.1-2.1h3.5c1.16 0 2.1.94 2.1 2.1v1.3h3.2c.88 0 1.6.72 1.6 1.6v10.95c0 .88-.72 1.6-1.6 1.6H4.95c-.88 0-1.6-.72-1.6-1.6V7.8c0-.88.72-1.6 1.6-1.6h3.2Zm2.25 0h3.2V5h-3.2v1.2Z" fill="currentColor"/></svg>`,
  qa: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.9a9.1 9.1 0 1 0 0 18.2 9.1 9.1 0 0 0 0-18.2Zm1.35 13.95h-2.7v-2.55h2.7v2.55Zm-.08-4.15h-2.54l-.3-6.35h3.14l-.3 6.35Z" fill="currentColor"/></svg>`,
  applications: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.6 11.1a3.8 3.8 0 1 0 0-7.6 3.8 3.8 0 0 0 0 7.6Zm0 2.05c-3.8 0-6.85 1.93-6.85 4.3v1.15h10.9a6.45 6.45 0 0 1 1.15-3.68 9.4 9.4 0 0 0-5.2-1.77Zm8.6-1.05a3.05 3.05 0 1 0 0-6.1 3.05 3.05 0 0 0 0 6.1Zm0 1.8c-.78 0-1.52.1-2.18.3a5.18 5.18 0 0 1 1.2 3.32v1.08h6.03v-1.02c0-2.03-2.26-3.68-5.05-3.68Z" fill="currentColor"/></svg>`
};

export function iconSvg(name) {
  return icons[name] || icons.home;
}
