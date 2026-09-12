// Only the established global legacy alias is normalized. Company roles stay scoped.
function normalizeAuthorityRole(value) {
  const role = typeof value === "string" ? value.trim().toLowerCase() : "";
  return role === "super_admin" ? "platform_admin" : role;
}
function isPlatformReviewer(user) {
  return ["owner", "platform_admin"].includes(normalizeAuthorityRole(user.role));
}
module.exports = { normalizeAuthorityRole, isPlatformReviewer };
