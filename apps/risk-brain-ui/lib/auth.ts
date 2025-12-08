export function getDemoRole() {
  if (typeof window !== "undefined") {
    return localStorage.getItem("demo_role") || "operator"
  }
  return "operator"
}
