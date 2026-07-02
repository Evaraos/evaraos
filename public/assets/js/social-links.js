function updateSocialLinks() {
  document.querySelectorAll('a[href*="tiktok.com"]').forEach((link) => {
    link.href = "https://www.tiktok.com/@evaraos";
  });
}

function installSocialLinks() {
  updateSocialLinks();
  const observer = new MutationObserver(updateSocialLinks);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 3000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", installSocialLinks, { once: true });
} else {
  installSocialLinks();
}
