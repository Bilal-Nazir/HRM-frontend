"use client";
import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatTaskDuration } from "@/lib/taskDuration";
import { Project } from "@/types";
import { ErrorBanner } from "@/components/ui";

export default function TaskDurationSettings({
  project,
  onSaved,
}: {
  project: Project;
  onSaved: (project: Project) => void;
}) {
  const [options, setOptions] = useState<number[]>(
    project.taskDurationOptionsMinutes || [],
  );
  const [amount, setAmount] = useState("30"),
    [unit, setUnit] = useState("1"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    setOptions(project.taskDurationOptionsMinutes || []);
  }, [project]);
  const add = () => {
    const minutes = Number(amount) * Number(unit);
    if (!Number.isSafeInteger(minutes) || minutes < 1 || minutes > 525600) {
      setError("Enter a duration from 1 minute to 365 days, in whole minutes.");
      return;
    }
    if (options.length >= 50 && !options.includes(minutes)) {
      setError("You can configure up to 50 duration choices.");
      return;
    }
    setOptions((rows) =>
      [...new Set([...rows, minutes])].sort((a, b) => a - b),
    );
    setError("");
    setSaved(false);
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!options.length) {
      setError("Add at least one task duration option.");
      return;
    }
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const result = await api.patch<{ project: Project }>(
        `/projects/${project.id}/workflow/durations`,
        {
          taskDurationOptionsMinutes: options,
        },
      );
      onSaved(result.project);
      setSaved(true);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save duration settings",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="card task-duration-settings">
      <div className="card-header">
        <div>
          <h2>Task durations & automatic pause</h2>
          <p>
            Choose the durations task creators can select. Timed tasks always
            move to Pause.
          </p>
        </div>
      </div>
      <form className="card-body" onSubmit={save}>
        {error && <ErrorBanner message={error} />}{" "}
        {saved && (
          <p className="success-banner" role="status">
            Duration settings saved.
          </p>
        )}
        <div className="duration-add-row">
          <label className="field">
            Duration
            <input
              type="number"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={busy}
            />
          </label>
          <label className="field">
            Unit
            <select
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              disabled={busy}
            >
              <option value="1">Minutes</option>
              <option value="60">Hours</option>
              <option value="1440">Days</option>
            </select>
          </label>
          <button
            className="button button-secondary"
            type="button"
            disabled={busy}
            onClick={add}
          >
            Add option
          </button>
        </div>
        <div className="duration-presets">
          {options.map((minutes) => (
            <span key={minutes}>
              {formatTaskDuration(minutes)}
              <button
                type="button"
                aria-label={`Remove ${formatTaskDuration(minutes)}`}
                disabled={busy}
                onClick={() => {
                  setOptions((rows) =>
                    rows.filter((value) => value !== minutes),
                  );
                  setSaved(false);
                }}
              >
                ×
              </button>
            </span>
          ))}
          {!options.length && (
            <small>No duration choices yet. Add your first option above.</small>
          )}
        </div>
        <p className="duration-setting-hint">
          Only tracked working time counts, across starts and pauses. At the
          limit the timer stops and the task moves to the default Pause column.
          Only an admin can move an automatically paused task out of Pause. The
          admin must increase its duration before the timer can resume. Changing
          these choices does not change existing task durations.
        </p>
        <button className="button button-primary" disabled={busy}>
          {busy ? "Saving…" : "Save duration settings"}
        </button>
      </form>
    </section>
  );
}
