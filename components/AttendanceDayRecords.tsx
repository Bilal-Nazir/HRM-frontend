import type { AttendanceSummary } from "@/components/AttendanceInsights";
import type { Attendance } from "@/types";
import { groupAttendanceDays } from "@/lib/attendanceReport";
import AttendanceDevices from "@/components/AttendanceDevices";
import CorrectAttendanceLocation from "@/components/CorrectAttendanceLocation";

function RecordedLocation({ point, withinOffice, pending = false }: { point?: Attendance["checkInLocation"]; withinOffice?: boolean; pending?: boolean }) {
  if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return <span className="activity-location-missing">{pending ? "Awaiting check-out" : "Location unavailable · Admin review"}</span>;
  const coordinates = `${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}`;
  return <div className="recorded-session-location">
    {point.address && <span>{point.address}</span>}
    {point.source === "admin" && <small className="manual-location-label" title={point.reason}>Admin-entered location</small>}
    {point.source !== "admin" && point.accuracyMeters !== undefined && <small>Browser accuracy ±{Math.round(point.accuracyMeters)} m</small>}
    <a href={`https://www.google.com/maps?q=${point.latitude},${point.longitude}`} target="_blank" rel="noopener noreferrer" title="Open recorded coordinates in Maps">{coordinates}</a>
    {withinOffice !== undefined && <small>{withinOffice ? "Within office area" : "Outside office area"}</small>}
  </div>;
}

export default function AttendanceDayRecords({ sessions, onCorrected }: { sessions: AttendanceSummary["daily"]; onCorrected?: () => void }) {
  const days = groupAttendanceDays(sessions);
  if (!days.length) return <p className="panel-message">No attendance records in this period.</p>;
  const time = (date?: string) => date ? new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }) : "In progress";
  return <div className="attendance-day-groups">{days.map((day) => <article className="attendance-day-group" key={day.date}>
    <header><div><strong>{new Date(`${day.date}T00:00:00`).toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</strong><span>{day.sessions.length} session{day.sessions.length === 1 ? "" : "s"}</span></div><div><b>{day.totalHours.toFixed(2)}h total</b><small>{day.flags.length ? day.flags.map((flag) => flag.replaceAll("_", " ")).join(", ") : "On track"}</small></div></header>
    <div className="table-wrap"><table aria-label={`Attendance sessions for ${day.date}`}><thead><tr><th>Session</th><th>Check in</th><th>Check-in location</th><th>Check out</th><th>Check-out location</th><th>Device</th><th>Hours</th><th>Flags</th></tr></thead><tbody>{day.sessions.map((session, index) => <tr key={session.id}>
      <td>#{index + 1}{onCorrected && <CorrectAttendanceLocation record={{ ...session, status: "" }} onSaved={onCorrected}/>}</td><td>{time(session.checkInAt)}</td><td><RecordedLocation point={session.checkInLocation} withinOffice={session.checkInWithinGeofence}/></td><td>{time(session.checkOutAt)}</td><td><RecordedLocation point={session.checkOutLocation} withinOffice={session.checkOutWithinGeofence} pending={!session.checkOutAt}/></td><td><AttendanceDevices checkIn={session.checkInDevice} checkOut={session.checkOutDevice} completed={!!session.checkOutAt}/></td><td>{session.workedHours.toFixed(2)}h</td><td>{session.flags.length ? session.flags.map((flag) => flag.replaceAll("_", " ")).join(", ") : "On track"}</td>
    </tr>)}</tbody></table></div>
  </article>)}</div>;
}
