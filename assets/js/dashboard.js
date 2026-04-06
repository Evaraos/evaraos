<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dashboard | Evaraos</title>
  <link rel="stylesheet" href="/evaraos/assets/css/styles.css" />
</head>
<body class="app-theme">
  <header id="topbar" class="topbar"></header>

  <div class="page-shell">
    <aside id="sidebar" class="sidebar"></aside>

    <main class="main-content">
      <section class="grid grid-3">
        <div class="card stat-card">
          <h3>Active Companies</h3>
          <p id="statCompanies">--</p>
        </div>
        <div class="card stat-card">
          <h3>Open Leads</h3>
          <p id="statLeads">--</p>
        </div>
        <div class="card stat-card">
          <h3>Jobs In Progress</h3>
          <p id="statJobs">--</p>
        </div>
      </section>

      <section class="section-space card">
        <h2>Executive Overview</h2>
        <p id="overviewText">
          Loading dashboard...
        </p>
      </section>
    </main>
  </div>

  <script type="module">
    import { requireAuth, bindTopbar, renderSidebar, hasPermission } from "/evaraos/assets/js/app.js";

    requireAuth(async (user) => {
      if (!hasPermission(user, "dashboard")) {
        if (user.role === "customer") {
          window.location.href = "/evaraos/customer_dashboard.html";
          return;
        }
        window.location.href = "/evaraos/index.html";
        return;
      }

      await bindTopbar(user);

      const sidebar = document.getElementById("sidebar");
      if (sidebar) {
        sidebar.innerHTML = renderSidebar(user.role, "dashboard");
      }

      document.getElementById("statCompanies").textContent = user.role === "owner" ? "12" : "3";
      document.getElementById("statLeads").textContent = user.role === "sales_rep" ? "42" : "148";
      document.getElementById("statJobs").textContent = "36";

      document.getElementById("overviewText").textContent =
        `Welcome ${user.name || user.username || user.email}. Your ${user.role} dashboard is now using the unified Firebase module shell.`;
    });
  </script>
</body>
</html>