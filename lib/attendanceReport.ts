import type { AttendanceSummary } from "@/components/AttendanceInsights";

export function groupAttendanceDays(sessions: AttendanceSummary["daily"]) {
  const groups = new Map<string, AttendanceSummary["daily"]>();
  for (const session of sessions) {
    const day = groups.get(session.workDate) || [];
    day.push(session);
    groups.set(session.workDate, day);
  }
  return [...groups].sort(([a], [b]) => b.localeCompare(a)).map(([date, rows]) => ({
    date,
    sessions: [...rows].sort((a, b) => +new Date(a.checkInAt) - +new Date(b.checkInAt)),
    totalHours: Math.round(rows.reduce((sum, row) => sum + row.workedHours, 0) * 100) / 100,
    flags: [...new Set(rows.flatMap((row) => row.flags))],
  }));
}

export function attendanceTrend(sessions: AttendanceSummary["daily"], from: string, to: string) {
  const totals = new Map(groupAttendanceDays(sessions).map((day) => [day.date, day.totalHours]));
  const points: { day: string; value: number }[] = [];
  const cursor = new Date(`${from}T00:00:00Z`), end = new Date(`${to}T00:00:00Z`);
  while (cursor <= end) {
    const day = cursor.toISOString().slice(0, 10);
    points.push({ day, value: totals.get(day) || 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return points;
}
