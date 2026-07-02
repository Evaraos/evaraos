(() => {
  if (!/\/messages\.html$/i.test(location.pathname)) return;

  const reveal = () => {
    document.documentElement.classList.remove('auth-pending', 'boot-pending', 'evara-boot-lock');
    document.body?.classList.remove('auth-pending', 'app-loading');
    document.body?.classList.add('app-ready');
    window.EvaraLoader?.markAppReady?.();
  };

  reveal();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', reveal, { once: true });
  }

  setTimeout(reveal, 300);
  setTimeout(reveal, 900);
})();
