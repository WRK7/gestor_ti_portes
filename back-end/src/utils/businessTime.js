const WORK_START_HOUR = 9;
const WORK_END_HOUR = 18;
const SECONDS_PER_WORK_DAY = (WORK_END_HOUR - WORK_START_HOUR) * 3600;

function isWeekday(date) {
  const day = date.getDay();
  return day >= 1 && day <= 5;
}

function clampToWorkday(date) {
  const d = new Date(date);
  if (d.getHours() < WORK_START_HOUR) {
    d.setHours(WORK_START_HOUR, 0, 0, 0);
  } else if (d.getHours() >= WORK_END_HOUR) {
    d.setHours(WORK_END_HOUR, 0, 0, 0);
  }
  return d;
}

function startOfWorkDay(date) {
  const d = new Date(date);
  d.setHours(WORK_START_HOUR, 0, 0, 0);
  return d;
}

function endOfWorkDay(date) {
  const d = new Date(date);
  d.setHours(WORK_END_HOUR, 0, 0, 0);
  return d;
}

function calcBusinessSeconds(from, to) {
  if (!from || !to) return 0;
  const start = new Date(from);
  const end = new Date(to);
  if (end <= start) return 0;

  let total = 0;
  const cursor = new Date(start);

  while (cursor < end) {
    if (!isWeekday(cursor)) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(WORK_START_HOUR, 0, 0, 0);
      continue;
    }

    const dayStart = startOfWorkDay(cursor);
    const dayEnd = endOfWorkDay(cursor);

    const effectiveStart = cursor < dayStart ? dayStart : clampToWorkday(cursor);
    const effectiveEnd = end < dayEnd ? clampToWorkday(end) : dayEnd;

    if (effectiveStart < effectiveEnd) {
      total += (effectiveEnd - effectiveStart) / 1000;
    }

    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(WORK_START_HOUR, 0, 0, 0);
  }

  return Math.round(total);
}

function formatDevTime(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return '0min';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

module.exports = { calcBusinessSeconds, formatDevTime, SECONDS_PER_WORK_DAY };
