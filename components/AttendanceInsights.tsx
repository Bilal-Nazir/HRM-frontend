"use client";

import { Attendance } from "@/types";

export type AttendanceSummary = {
  totalWorkingDays: number;
  totalWorkedHours: number;
  buckets: { atLeastEightHours: number; fiveToUnderEightHours: number; underFiveHours: number };
  flags: { lateCheckIns: number; earlyCheckOuts: number; outsideOfficeArea: number };
  daily: { id: string; employeeId: string; workDate: string; checkInAt: string; checkOutAt?: string; workedHours: number; flags: string[] }[];
};

export function AttendanceLocation({ record }: { record: Attendance }) {
  const point = (label: string, location?: Attendance["checkInLocation"]) => location ? (
    <span key={label}>
      {label}: <a href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`} target="_blank" rel="noopener noreferrer" title="Open recorded location in Maps">
        {location.address || `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`}
      </a>
    </span>
  ) : null;
  return <div className="attendance-location">
    {point("In", record.checkInLocation)}
    {point("Out", record.checkOutLocation)}
    {!record.checkInLocation && "Location unavailable"}
    {record.checkInWithinGeofence === false && <small>Outside assigned office area</small>}
    {record.checkInLocation && record.checkInWithinGeofence === undefined && <small>Office geofence not configured</small>}
  </div>;
}

export function AttendanceInsights({ summary }: { summary: AttendanceSummary | null }) {
  if (!summary) return null;
  const { atLeastEightHours, fiveToUnderEightHours, underFiveHours } = summary.buckets;
  const total = atLeastEightHours + fiveToUnderEightHours + underFiveHours;
  const eight = total ? atLeastEightHours / total * 100 : 0;
  const middle = total ? fiveToUnderEightHours / total * 100 : 0;
  return <section className="card attendance-insights">
    <div className="card-header"><div><span className="section-kicker">Attendance summary</span><h2>Working days and hours</h2><p>Sessions this year; late and early flags appear after an admin sets work hours.</p></div></div>
    <div className="attendance-insights-body">
      <div className="attendance-donut" role="img" aria-label={`${atLeastEightHours} days at least 8 hours, ${fiveToUnderEightHours} days 5 to under 8 hours, ${underFiveHours} days under 5 hours`} style={{ background: total ? `conic-gradient(#1ca989 0 ${eight}%, #e2b45e ${eight}% ${eight + middle}%, #e67d76 ${eight + middle}% 100%)` : "#e5eeeb" }}><div><strong>{summary.totalWorkingDays}</strong><span>working days</span></div></div>
      <div className="attendance-summary-copy">
        <strong>{summary.totalWorkedHours.toFixed(1)} hours worked</strong>
        <span><i style={{ background: "#1ca989" }} /> 8+ hours: {atLeastEightHours} days</span>
        <span><i style={{ background: "#e2b45e" }} /> 5–under 8 hours: {fiveToUnderEightHours} days</span>
        <span><i style={{ background: "#e67d76" }} /> Under 5 hours: {underFiveHours} days</span>
        <small>Late check-ins: {summary.flags.lateCheckIns} · Early check-outs: {summary.flags.earlyCheckOuts} · Outside office: {summary.flags.outsideOfficeArea}</small>
      </div>
    </div>
  </section>;
}
