"use client";
import { useEffect, useState } from "react";
import { Attendance } from "@/types";
import { useLiveData } from "@/lib/useLiveData";
import { EmptyState, ErrorBanner, StatusPill } from "@/components/ui";
import { AttendanceLocation } from "@/components/AttendanceInsights";
import { Users, Clock3, ShieldAlert } from "lucide-react";

function initials(name?: string) {
  if (!name) return "--";
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase() || "--";
}

export type AttendanceOverview = {
  attendances: Attendance[];
  totalCount: number;
  lastPage: number;
  summary: {
    presentNow: number;
    activeEmployees: number;
    attendanceFlags: number;
  };
};
export default function AdminAttendance() {
  const [openOnly, setOpenOnly] = useState(true);
  const [flagsOnly, setFlagsOnly] = useState(false);
  useEffect(() => { const params = new URLSearchParams(window.location.search); setFlagsOnly(params.get("flags") === "true"); setOpenOnly(params.get("open") !== "false" && params.get("flags") !== "true"); }, []);
  const [page, setPage] = useState(1);
  const { data, error, refresh } = useLiveData<AttendanceOverview>(
    `/attendance/manage?open=${openOnly}&flags=${flagsOnly}&size=20&page=${page}`,
  );
  return (
    <section className="card">
      <div className="card-header">
        <div>
          <span className="section-kicker">Organization attendance</span>
          <h2>{openOnly ? "Checked in now" : "Attendance history"}</h2>
          <p>
            {data && !error
              ? `${data.summary.presentNow} active sessions · `
              : ""}
            Refreshes every 30 seconds
          </p>
        </div>
        <div className="admin-table-actions">
          <select
            aria-label="Attendance filter"
            value={flagsOnly ? "flags" : openOnly ? "open" : "all"}
            onChange={(e) => {
              setOpenOnly(e.target.value === "open");
              setFlagsOnly(e.target.value === "flags");
              setPage(1);
            }}
          >
            <option value="open">Checked in now</option>
            <option value="all">All sessions</option>
            <option value="flags">Flagged sessions</option>
          </select>
          <button className="button button-secondary" onClick={refresh}>
            Refresh
          </button>
        </div>
      </div>
      {error && (
        <ErrorBanner message={`Could not refresh attendance: ${error}`} />
      )}
      {!data && !error && <p className="panel-message">Loading attendance…</p>}
      {data && !error && (
        <div className="mini-stats">
          <div><span className="mini-icon mini-icon-green"><Clock3 size={16} /></span><div><span>Present now</span><strong>{data.summary.presentNow}</strong></div></div>
          <div><span className="mini-icon mini-icon-green"><Users size={16} /></span><div><span>Active employees</span><strong>{data.summary.activeEmployees}</strong></div></div>
          <div><span className="mini-icon mini-icon-amber"><ShieldAlert size={16} /></span><div><span>Flagged sessions</span><strong>{data.summary.attendanceFlags}</strong></div></div>
        </div>
      )}
      {data &&
        !error &&
        (!data.attendances.length ? (
          <EmptyState
            title={openOnly ? "Nobody is checked in" : "No attendance yet"}
            description="Employee check-ins appear here with their name and start time."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Check in</th>
                  <th>Check out</th>
                  <th>Location</th>
                  <th>Flags</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.attendances.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="person-cell">
                        <div className="avatar">{initials(item.employee?.name)}</div>
                        <div>
                          <strong>{item.employee?.name || "Employee unavailable"}</strong>
                          <span>{item.employee?.employeeCode}</span>
                        </div>
                      </div>
                    </td>
                    <td>{new Date(item.checkInAt).toLocaleString()}</td>
                    <td>
                      {item.checkOutAt
                        ? new Date(item.checkOutAt).toLocaleString()
                        : "In progress"}
                    </td>
                    <td><AttendanceLocation record={item} /></td>
                    <td>{item.flags?.length ? <span className="attendance-flags">{item.flags.join(", ").replaceAll("_", " ")}</span> : "—"}</td>
                    <td>
                      <StatusPill value={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      {data && data.lastPage > 1 && (
        <div className="modal-actions">
          <button
            className="button button-secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span>
            Page {page} of {data.lastPage}
          </span>
          <button
            className="button button-secondary"
            disabled={page >= data.lastPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
