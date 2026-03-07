/**
 * Czech relative time formatting
 */
export function timeAgo(date: string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "právě teď";
  if (diffMin < 60) {
    if (diffMin === 1) return "před 1 minutou";
    if (diffMin < 5) return `před ${diffMin} minutami`;
    return `před ${diffMin} minutami`;
  }
  if (diffHour < 24) {
    if (diffHour === 1) return "před 1 hodinou";
    if (diffHour < 5) return `před ${diffHour} hodinami`;
    return `před ${diffHour} hodinami`;
  }
  if (diffDay === 1) return "včera";
  if (diffDay < 7) return `před ${diffDay} dny`;
  if (diffDay < 30) {
    const weeks = Math.floor(diffDay / 7);
    if (weeks === 1) return "před týdnem";
    return `před ${weeks} týdny`;
  }

  return formatCzechDate(date);
}

const CZECH_MONTHS = [
  "ledna", "února", "března", "dubna", "května", "června",
  "července", "srpna", "září", "října", "listopadu", "prosince",
];

export function formatCzechDate(date: string): string {
  const d = new Date(date);
  return `${d.getDate()}. ${CZECH_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
