export function formatTaskDuration(minutes: number) {
  const days = Math.floor(minutes / 1440),
    hours = Math.floor((minutes % 1440) / 60),
    rest = minutes % 60;
  return (
    [days ? `${days}d` : "", hours ? `${hours}h` : "", rest ? `${rest}min` : ""]
      .filter(Boolean)
      .join(" ") || "0min"
  );
}
