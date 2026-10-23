export function defaultView(role) {
  return role === "business" ? "dashboard" : "discover";
}
export function navigationFor(role) {
  if (role === "business")
    return [
      ["dashboard", "▦", "Overview"],
      ["tasks", "▤", "My tasks"],
      ["applicants", "◯", "Applicants"],
      ["projects", "▣", "Active work"],
      ["confirmations", "✓", "References"],
      ["profile", "◈", "Business profile"],
    ];
  return [
    ["discover", "▦", "Find work"],
    ["projects", "▣", "My applications"],
    ["passport", "◈", "Skills & evidence"],
    ["confirmations", "✓", "References"],
    ["profile", "◯", "My profile"],
  ];
}
export function resolveView(role, requested) {
  return navigationFor(role).some(([view]) => view === requested)
    ? requested
    : defaultView(role);
}
