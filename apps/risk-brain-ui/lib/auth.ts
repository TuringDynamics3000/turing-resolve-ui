export function getDemoRole() {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_DEMO_USER_ROLE || "operator"
  }
  return process.env.NEXT_PUBLIC_DEMO_USER_ROLE || "operator"
}
