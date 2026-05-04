export function iconSvg(name) {
  const icons = {
    home: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 3 3 10v11h6v-6h6v6h6V10z"/></svg>`,
    login: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M10 17v-2h4v-2h-4V9l-5 4 5 4Zm9-12H11v2h8v10h-8v2h8a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z"/></svg>`,
    signup: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm-7 9v-1a7 7 0 0 1 14 0v1H5Z"/></svg>`,
    dashboard: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 13h8V3H3v10Zm10 8h8v-6h-8v6ZM3 21h8v-6H3v6Zm10-8h8V3h-8v10Z"/></svg>`,
    settings: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M19.14 12.94a7.49 7.49 0 0 0 .05-.94 7.49 7.49 0 0 0-.05-.94l2.03-1.58a.5.5 0 0 0 .12-.65l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.28 7.28 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 1h-3.8a.5.5 0 0 0-.49.42l-.36 2.54a7.28 7.28 0 0 0-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 7.48a.5.5 0 0 0 .12.65l2.03 1.58c-.03.31-.05.63-.05.94s.02.63.05.94l-2.03 1.58a.5.5 0 0 0-.12.65l1.92 3.32a.5.5 0 0 0 .6.22l2.39-.96c.5.38 1.04.7 1.63.94l.36 2.54a.5.5 0 0 0 .49.42h3.8a.5.5 0 0 0 .49-.42l.36-2.54c.59-.24 1.13-.56 1.63-.94l2.39.96a.5.5 0 0 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.65l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"/></svg>`,
    companies: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 21V3l9-2 9 2v18h-6v-7H9v7H3Z"/></svg>`,
    users: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"/></svg>`,
    leads: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2 15 8l6 .9-4.5 4.3L17.5 20 12 17.3 6.5 20l1-6.8L3 8.9 9 8Z"/></svg>`,
    jobs: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2h3v13H3V7h3Zm2 0h8V5H8v2Z"/></svg>`,
    qa: `<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 15h-2v-2h2Zm0-4h-2V7h2Z"/></svg>`
  };

  return icons[name] || icons.home;
}
