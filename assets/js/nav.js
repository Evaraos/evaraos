function renderNav() {
  const nav = document.getElementById("universalNav");
  if (!nav) return;

  nav.innerHTML = `
    <div class="universal-nav">
      <div class="nav-inner glass">
        <img src="/assets/img/evaraos_logo.png" class="logo"/>

        <div class="hamburger" id="menuBtn">
          <span></span><span></span><span></span>
        </div>

        <div class="dropdown glass" id="menu">
          <a href="/index.html">Home</a>
          <a href="/login.html">Login</a>
          <a href="/signup.html">Signup</a>
          <a href="/settings.html">Settings</a>
        </div>
      </div>
    </div>
  `;
}

function bindNav() {
  const btn = document.getElementById("menuBtn");
  const menu = document.getElementById("menu");

  btn.onclick = () => {
    menu.classList.toggle("active");
  };

  document.addEventListener("click", (e) => {
    if (!btn.contains(e.target) && !menu.contains(e.target)) {
      menu.classList.remove("active");
    }
  });
}

function renderFooter() {
  document.body.insertAdjacentHTML("beforeend", `
    <div class="footer glass">
      © ${new Date().getFullYear()} Evaraos Inc
    </div>
  `);
}

document.addEventListener("DOMContentLoaded", () => {
  renderNav();
  renderFooter();
  bindNav();
});