export function dueInDaysLabel(dueDate) {
  const diffDays = Math.ceil((new Date(dueDate) - new Date()) / 86400000);
  if (diffDays <= 0) return "Due today";
  return `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`;
}
