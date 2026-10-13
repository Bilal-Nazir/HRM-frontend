"use client";
import AppShell from "@/components/AppShell";
import AdminAttendance from "@/components/AdminAttendance";
import { ErrorBanner, PageHeader } from "@/components/ui";
import { AttendanceInsights, AttendanceSummary } from "@/components/AttendanceInsights";
import { api } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";
import { errorMessage } from "@/lib/workspace";
import { FormEvent, useEffect, useState } from "react";

type Schedule = { timezone: string; weeklyPattern: { day: number; startTime: string; endTime: string; working: boolean }[] };
const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export default function AdminAttendancePage() {
  const insights = useLiveData<AttendanceSummary>("/attendance/summary?scope=organization");
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { api.get<{ schedule: Schedule | null }>("/attendance/schedule").then(({ schedule: value }) => { setSchedule(value); if (value?.weeklyPattern.length) { setStartTime(value.weeklyPattern[0].startTime); setEndTime(value.weeklyPattern[0].endTime); setWorkingDays(value.weeklyPattern.filter((day) => day.working).map((day) => day.day)); } }).catch((err) => setError(errorMessage(err))); }, []);
  const saveSchedule = async (event: FormEvent) => { event.preventDefault(); setSaving(true); setSaved(false); setError(""); try { const result = await api.patch<{ schedule: Schedule }>("/attendance/schedule", { startTime, endTime, workingDays }); setSchedule(result.schedule); setSaved(true); insights.refresh(); } catch (err) { setError(errorMessage(err)); } finally { setSaving(false); } };
  return (
    <AppShell>
      <PageHeader
        eyebrow="Live operations"
        title="Attendance"
        description="See who is checked in and review employee work sessions."
      />
      <AttendanceInsights summary={insights.data} />
      <section className="card attendance-policy"><div className="card-header"><div><span className="section-kicker">Attendance rules</span><h2>Organization work schedule</h2><p>Set expected hours to flag late check-ins and early check-outs. No flags are inferred until this is saved.</p></div></div>
        <form onSubmit={saveSchedule} className="attendance-policy-form">
          {error && <ErrorBanner message={error} />}{saved && <div className="success-banner">Schedule saved. Attendance flags will use these hours.</div>}
          {schedule && <p>Time zone: {schedule.timezone}</p>}
          <div className="form-grid"><div className="field"><label htmlFor="schedule-start">Start time</label><input id="schedule-start" type="time" required value={startTime} onChange={(event) => setStartTime(event.target.value)} /></div><div className="field"><label htmlFor="schedule-end">End time</label><input id="schedule-end" type="time" required value={endTime} onChange={(event) => setEndTime(event.target.value)} /></div></div>
          <fieldset className="schedule-days"><legend>Working days</legend>{weekdays.map((name, day) => <label key={day}><input type="checkbox" checked={workingDays.includes(day)} onChange={() => setWorkingDays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day])} />{name}</label>)}</fieldset>
          <button type="submit" className="button button-primary" disabled={saving || !workingDays.length}>{saving ? "Saving…" : "Save work schedule"}</button>
        </form>
      </section>
      <AdminAttendance />
    </AppShell>
  );
}
