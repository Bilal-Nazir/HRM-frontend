"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LeaveRequest } from "@/types";
import { useLiveData } from "@/lib/useLiveData";
import { EmptyState, ErrorBanner, StatusPill } from "@/components/ui";

function initials(name?: string) {
  if (!name) return "--";
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] || ""}${parts[1]?.[0] || ""}`.toUpperCase() || "--";
}
type LeaveOverview = {
  leaveRequests: LeaveRequest[];
  totalCount: number;
  lastPage: number;
};

export default function AdminLeave() {
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const router = useRouter();
  const prefix = usePathname().startsWith("/admin") ? "/admin" : "";
  const href = (id: string) => `${prefix}/leave/${id}`;
  const { data, error, refresh } = useLiveData<LeaveOverview>(
    `/leave/requests/manage?size=20&page=${page}${status ? "&status=" + status : ""}`,
  );
  return (
    <section className="card">
      <div className="card-header">
        <div>
          <h2>Employee requests</h2>
          <p>
            Leave and Work-from-Home requests appear here automatically · refreshes every 30 seconds
          </p>
        </div>
        <div className="admin-table-actions">
          <select
            aria-label="Leave status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="cancelled">Cancelled</option>
            <option value="">All requests</option>
          </select>
          <button className="button button-secondary" onClick={refresh}>
            Refresh
          </button>
        </div>
      </div>
      {error && <ErrorBanner message={error} />}
      {!data && !error && (
        <p className="panel-message">Loading leave requests…</p>
      )}
      {data &&
        !error &&
        (!data.leaveRequests.length ? (
          <EmptyState
            title="No requests to show"
            description="Employee requests will appear here for review."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Request type</th>
                  <th>Dates</th>
                  <th>Days</th>
                  <th>Reason</th>
                  <th>Status / action</th>
                </tr>
              </thead>
              <tbody>
                {data.leaveRequests.map((item) => (
                  <tr key={item.id} className={`request-clickable-row ${item.status === "pending" ? "row-pending" : ""}`} tabIndex={0} onClick={() => router.push(href(item.id))} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); router.push(href(item.id)); } }}>
                    <td>
                      <div className="person-cell">
                        <div className="avatar">{initials(item.employee?.name)}</div>
                        <div>
                          <Link href={href(item.id)} onClick={event => event.stopPropagation()}><strong>{item.employee?.name || "Employee unavailable"}</strong></Link>
                          <span>{item.employee?.employeeCode}</span>
                        </div>
                      </div>
                    </td>
                    <td>{item.leaveTypeName}</td>
                    <td>
                      {item.startDate.slice(0, 10)} –{" "}
                      {item.endDate.slice(0, 10)}
                    </td>
                    <td>{item.totalDays}</td>
                    <td><span>{item.reason || "—"}</span>{item.managerComment && <small style={{display:"block",marginTop:5,color:"var(--green-dark)"}}>Manager: {item.managerComment}</small>}</td>
                    <td>
                      <div className="admin-table-actions"><StatusPill value={item.status} /><Link className="button button-secondary" href={href(item.id)} onClick={event => event.stopPropagation()}>View details</Link></div>
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
