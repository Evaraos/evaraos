export function iconSvg(name) {
  const icons = {
    home: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5"/><path d="M6.5 9.5V20h11V9.5"/><path d="M10 20v-5h4v5"/></svg>`,
    login: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h3"/><path d="M14 8l4 4-4 4"/><path d="M8 12h10"/></svg>`,
    signup: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 13a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M5 20a7 7 0 0 1 14 0"/><path d="M19 8v6"/><path d="M16 11h6"/></svg>`,
    dashboard: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V10"/><path d="M12 19V5"/><path d="M19 19v-8"/><path d="M4 19h16"/></svg>`,
    settings: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 1 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 1 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 1 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 1 1 0 4h-.2a1 1 0 0 0-.9.6Z"/></svg>`,
    install: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11"/><path d="m7 10 5 5 5-5"/><path d="M5 19h14"/><path d="M7 21h10a2 2 0 0 0 2-2v-2"/><path d="M5 17v2a2 2 0 0 0 2 2"/></svg>`,
    companies: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V8l8-4 8 4v12"/><path d="M9 20v-4h6v4"/><path d="M8 10h.01"/><path d="M12 10h.01"/><path d="M16 10h.01"/><path d="M8 13h.01"/><path d="M12 13h.01"/><path d="M16 13h.01"/></svg>`,
    users: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1"/><circle cx="9.5" cy="8" r="3.5"/><path d="M20 21v-1a4 4 0 0 0-3-3.9"/><path d="M16.5 4.1a3.5 3.5 0 0 1 0 6.8"/></svg>`,
    leads: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.7 5.4L21 9.3l-4.5 4.4 1.1 6.3L12 17.2 6.4 20l1.1-6.3L3 9.3l6.3-.9L12 3Z"/></svg>`,
    jobs: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3h4"/><path d="M5 7h14v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7Z"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`,
    qa: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 3h4"/><path d="M9 3v4l-4.5 7.8A4 4 0 0 0 8 21h8a4 4 0 0 0 3.5-6.2L15 7V3"/><path d="M8.5 14h7"/></svg>`
  };

  return icons[name] || icons.home;
}
