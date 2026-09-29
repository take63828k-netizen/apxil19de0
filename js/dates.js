const pad = (n) => String(n).padStart(2, '0');

export function studyDay(date, dayStartHour) {
  const d = new Date(date.getTime() - dayStartHour * 3600000);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dayEnd(day, dayStartHour) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(new Date(y, m - 1, d + 1, dayStartHour).getTime() - 1);
}

function toUTC(day) {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function addDays(day, n) {
  const d = new Date(toUTC(day) + n * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function daysBetween(a, b) {
  return Math.round((toUTC(b) - toUTC(a)) / 86400000);
}
