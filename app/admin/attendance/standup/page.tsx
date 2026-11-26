"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { ErrorBanner, PageHeader } from "@/components/ui";
import type { StandupPlan, StandupStatus, TaskSnapshot } from "@/components/StandupForm";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/workspace";

type Report = {
  _id: string;
  employeeName: string;
  employeeId: string;
  workDate: string;
  checkInAt: string;
  checkOutAt?: string;
  standup: StandupPlan;
  standupResult?: { completed: TaskSnapshot[]; paused?: TaskSnapshot[]; pending: TaskSnapshot[]; additional?: TaskSnapshot[] };
};

export default function StandupReportsPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<StandupStatus>("/attendance/standup").then(({ enabled }) => setEnabled(enabled)).catch((err) => setError(errorMessage(err)));
  }, []);
  useEffect(() => {
    let current = true;
    setLoading(true);
    api.get<{ reports: Report[]; hasMore: boolean }>(`/attendance/standup/reports?page=${page}`)
      .then(({ reports, hasMore }) => { if (current) { setReports(reports); setMore(hasMore); } })
      .catch((err) => { if (current) setError(errorMessage(err)); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [page]);

  const toggle = async (value: boolean) => {
    setSaving(true);
    setError("");
    try {
      const result = await api.patch<StandupStatus>("/attendance/standup", { enabled: value });
      setEnabled(result.enabled);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };
  const names = (tasks?: TaskSnapshot[]) => tasks?.map((task) => [task.key, task.title].filter(Boolean).join(" · ")).join(", ") || "None";

  return <AppShell>
    <PageHeader eyebrow="Attendance" title="Daily stand-up" description="Review employee plans and check-out reports by date." />
    {error && <ErrorBanner message={error} />}
    <section className="card card-body">
      <label><input type="checkbox" checked={!!enabled} disabled={saving || enabled === null} onChange={(event) => void toggle(event.target.checked)} /> Require stand-up reports at attendance check-in and check-out</label>
    </section>
    <section className="card card-body">
      {loading ? <p role="status">Loading reports…</p> : !reports.length ? <p>No stand-up reports yet.</p> :
        reports.map((report, index) => {
          const previous = reports[index - 1];
          return <article key={report._id}>
            {previous?.workDate !== report.workDate && <h2>{report.workDate}</h2>}
            {(previous?.workDate !== report.workDate || previous?.employeeId !== report.employeeId) && <h3>{report.employeeName}</h3>}
            <details>
              <summary>{new Date(report.checkInAt).toLocaleTimeString()} · {report.checkOutAt ? "Final report locked" : "Checked in"}</summary>
              <dl>
                {!!report.standup.yesterday?.length && <><dt>Yesterday</dt><dd>{names(report.standup.yesterday)}</dd></>}
                <dt>Planned</dt><dd>{names(report.standup.planned)}</dd>
                <dt>Blocker</dt><dd>{report.standup.blocker ? `${report.standup.blocker.text} (${report.standup.blocker.priority})` : "None"}</dd>
                {report.standupResult && <>
                  <dt>Completed</dt><dd>{names(report.standupResult.completed)}</dd>
                  {report.standupResult.paused && <><dt>Paused</dt><dd>{names(report.standupResult.paused)}</dd></>}
                  <dt>Pending</dt><dd>{names(report.standupResult.pending)}</dd>
                  {!!report.standupResult.additional?.length && <><dt>Additional completed</dt><dd>{names(report.standupResult.additional)}</dd></>}
                </>}
              </dl>
            </details>
          </article>;
        })}
      <div className="content-actions">
        <button className="button button-secondary" disabled={page === 1 || loading} onClick={() => setPage(page - 1)}>Previous</button>
        <button className="button button-secondary" disabled={!more || loading} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </section>
  </AppShell>;
}
