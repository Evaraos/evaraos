function mockUsers() {
  return [
    {
      email: "owner@evaraos.com",
      password: "123456",
      name: "Owner Account",
      role: "owner"
    },
    {
      email: "admin@evaraos.com",
      password: "123456",
      name: "Admin Account",
      role: "admin"
    },
    {
      email: "manager@evaraos.com",
      password: "123456",
      name: "Manager Account",
      role: "manager"
    },
    {
      email: "sales@evaraos.com",
      password: "123456",
      name: "Sales Rep Account",
      role: "sales_rep"
    }
  ];
}

function loginUser(email, password) {
  const users = mockUsers();
  const found = users.find(
    user => user.email.toLowerCase() === email.toLowerCase().trim() && user.password === password
  );

  if (!found) {
    return { success: false, message: "Invalid email or password." };
  }

  const sessionUser = {
    email: found.email,
    name: found.name,
    role: found.role
  };

  localStorage.setItem("evaraos_user", JSON.stringify(sessionUser));
  localStorage.setItem("evaraos_role", found.role);

  return { success: true, user: sessionUser };
}

function signupUser(name, email, password) {
  if (!name || !email || !password) {
    return { success: false, message: "Please fill in all fields." };
  }

  const newUser = {
    name,
    email,
    role: "customer"
  };

  localStorage.setItem("evaraos_user", JSON.stringify(newUser));
  localStorage.setItem("evaraos_role", "customer");

  return { success: true, user: newUser };
}

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");

  if (loginForm) {
    loginForm.addEventListener("submit", e => {
      e.preventDefault();

      const email = document.getElementById("email")?.value || "";
      const password = document.getElementById("password")?.value || "";
      const result = loginUser(email, password);

      const status = document.getElementById("formStatus");
      if (!result.success) {
        if (status) status.textContent = result.message;
        return;
      }

      window.location.href = "/evaraos/dashboard.html";
    });
  }

  if (signupForm) {
    signupForm.addEventListener("submit", e => {
      e.preventDefault();

      const name = document.getElementById("name")?.value || "";
      const email = document.getElementById("email")?.value || "";
      const password = document.getElementById("password")?.value || "";
      const result = signupUser(name, email, password);

      const status = document.getElementById("formStatus");
      if (!result.success) {
        if (status) status.textContent = result.message;
        return;
      }

      window.location.href = "/evaraos/customer_dashboard.html";
    });
  }
});