import {
  requireAuth,
  bindTopbar,
  fetchAllCollection,
  fetchUsersByCompany
} from "./app.js";

function injectStyles() {
  const style = document.createElement("style");
  style.textContent = `
    .org-container{
      padding:30px;
    }

    .org-node{
      border:1px solid rgba(255,255,255,.1);
      border-radius:14px;
      padding:12px;
      margin:10px;
      background:rgba(255,255,255,.03);
    }

    .org-children{
      margin-left:30px;
      border-left:1px dashed rgba(255,255,255,.1);
      padding-left:10px;
    }

    .org-name{
      font-weight:700;
    }

    .org-role{
      font-size:12px;
      color:#aaa;
    }
  `;
  document.head.appendChild(style);
}

function buildTree(users) {
  const map = {};
  const roots = [];

  users.forEach(u => {
    map[u.id] = { ...u, children: [] };
  });

  users.forEach(u => {
    if (u.reportsTo && map[u.reportsTo]) {
      map[u.reportsTo].children.push(map[u.id]);
    } else {
      roots.push(map[u.id]);
    }
  });

  return roots;
}

function renderNode(node) {
  return `
    <div class="org-node">
      <div class="org-name">${node.name || "No Name"}</div>
      <div class="org-role">${node.role}</div>

      ${
        node.children.length
          ? `<div class="org-children">
              ${node.children.map(renderNode).join("")}
            </div>`
          : ""
      }
    </div>
  `;
}

function renderTree(tree) {
  return tree.map(renderNode).join("");
}

requireAuth(async (user) => {
  injectStyles();
  await bindTopbar(user);

  const users =
    user.role === "super_admin"
      ? await fetchAllCollection("users")
      : await fetchUsersByCompany(user.companyId);

  const tree = buildTree(users);

  document.getElementById("orgRoot").innerHTML = `
    <div class="org-container">
      <h1>Organization Structure</h1>
      ${renderTree(tree)}
    </div>
  `;
});
