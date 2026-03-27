import {
  bindTopbar,
  requireAuth,
  fetchCompanyCollection,
  renderSidebar,
  roleGuard,
  createSalesRep,
  updateSalesRep
} from "./app.js";

let currentUser = null;
let editingRepId = null;

function formatDate(value) {
  if (!value) return "—";
  try {
    if (value.toDate) return value.toDate().toLocaleString();
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function getRepFormData() {
  return {
    fullName: document.getElementById("repFullName").value.trim(),
    email: document.getElementById("repEmail").value.trim(),
    phone: document.getElementById("repPhone").value.trim(),
    status: document.getElementById("repStatus").value,
    notes: document.getElementById("repNotes").value.trim()
  };
}

function fillRepForm(rep) {
  document.getElementById("repFullName").value = rep.fullName || "";
  document.getElementById("repEmail").value = rep.email || "";
  document.getElementById("repPhone").value = rep.phone || "";
  document.getElementById("repStatus").value = rep.status || "active";
  document.getElementById("repNotes").value = rep.notes || "";
}

function clearRepForm() {
  editingRepId = null;
  document.getElementById("repFullName").value = "";
  document.getElementById("repEmail").value = "";
  document.getElementById("repPhone").value = "";
  document.getElementById("repStatus").value = "active";
  document.getElementById("repNotes").value = "";
  document.getElementById("cancelRepEditBtn").style.display = "none";
}

async function renderSalesReps() {
  const reps = await fetchCompanyCollection("sales_reps");
  const salesRepsList = document.getElementById("salesRepsList");

  if (!reps.length) {
    salesRepsList.innerHTML = `<div class="muted">No sales reps yet.</div>`;
    return;
  }

  salesRepsList.innerHTML = reps.map((rep) => `
    <div class="row">
      <div>
        <strong>${rep.fullName || "Unnamed Rep"}</strong><br>
        <span class="muted">${rep.email || "No email"}</span>
      </div>
      <div>
        ${rep.phone || "No phone"}<br>
        <span class="muted">Status: ${rep.status || "active"}</span>
      </div>
      <div>
        <span class="muted">${rep.notes || "No notes"}</span>
      </div>
      <div>
        <button class="btn secondary edit-rep-btn" data-id="${rep.id}">Edit</button>
        <div class="meta-line">
          Created: ${formatDate(rep.createdAt)}<br>
          Updated: ${formatDate(rep.updatedAt)}
        </div>
      </div>
    </div>
  `).join("");

  document.querySelectorAll(".edit-rep-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const selectedRep = reps.find((rep) => rep.id === btn.dataset.id);
      if (!selectedRep) return;

      editingRepId = selectedRep.id;
      fillRepForm(selectedRep);
      document.getElementById("cancelRepEditBtn").style.display = "inline-flex";
      document.getElementById("repMsg").textContent = `Editing ${selectedRep.fullName || "sales rep"}`;
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });
}

requireAuth(async (user) => {
  currentUser = user;

  if (!roleGuard(user, "sales_reps")) {
    document.body.innerHTML = `
      <div class="auth-shell">
        <div class="auth-card">
          <h2>Access denied</h2>
          <p class="muted">Your role does not have access to Sales Reps management.</p>
        </div>
      </div>
    `;
    return;
  }

  await bindTopbar(user);
  document.getElementById("sidebar").innerHTML = renderSidebar(user.role, "sales_reps");

  await renderSalesReps();

  document.getElementById("saveRepBtn").addEventListener("click", async () => {
    const msg = document.getElementById("repMsg");
    const data = getRepFormData();

    if (!data.fullName || !data.email) {
      msg.textContent = "Full name and email are required.";
      return;
    }

    try {
      if (editingRepId) {
        await updateSalesRep(editingRepId, data);
        msg.textContent = "Sales rep updated successfully.";
      } else {
        await createSalesRep(data, currentUser);
        msg.textContent = "Sales rep created successfully.";
      }

      clearRepForm();
      await renderSalesReps();
    } catch (e) {
      msg.textContent = e.message || "Failed to save sales rep.";
    }
  });

  document.getElementById("cancelRepEditBtn").addEventListener("click", () => {
    clearRepForm();
    document.getElementById("repMsg").textContent = "Edit cancelled.";
  });
});
