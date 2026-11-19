// Durations do not wrap at midnight and always come from the recorded check-in.
export function attendanceClock(
  checkInAt: string | undefined,
  now: Date | null,
) {
  if (!checkInAt) return "00:00:00";
  if (!now) return "—";
  const start = new Date(checkInAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(now.getTime())) return "—";
  const seconds = Math.max(0, Math.floor((now.getTime() - start) / 1000));
  return [
    Math.floor(seconds / 3600),
    Math.floor((seconds % 3600) / 60),
    seconds % 60,
  ]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}
