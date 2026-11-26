"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/workspace";

export type TaskSnapshot = { id: string; key?: string; title: string };
export type StandupPlan = { yesterday?: TaskSnapshot[]; planned: TaskSnapshot[]; blocker?: { text: string; priority: string } };
export type StandupStatus = { enabled: boolean; plan: StandupPlan | null };
export type StandupInput =
  | { planned: string[]; hasBlocker: boolean; blocker: string; priority: string }
  | { workedOn: string[] };

const groupsByStage = {
  "check-in": [{ category: "in_progress", label: "In progress" }, { category: "todo", label: "To do" }],
  "check-out": [{ category: "paused", label: "Paused" }, { category: "done", label: "Done" }],
};

type TaskOption = TaskSnapshot & { column: string; category: string };
const selectionLimit = 200;

export default function StandupForm({ plan, onCancel, onSubmit, busy, submitError }: {
  plan: StandupPlan | null;
  onCancel: () => void;
  onSubmit: (input: StandupInput) => void;
  busy: boolean;
  submitError: string;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = plan ? "check-out" : "check-in";
  const [tasks, setTasks] = useState<TaskOption[] | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [blockerChoice, setBlockerChoice] = useState("");
  const [blocker, setBlocker] = useState("");
  const [priority, setPriority] = useState("");
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  useEffect(() => {
    let current = true;
    setError("");
    api.get<{ tasks: TaskOption[] }>(`/attendance/standup/tasks?stage=${stage}`)
      .then(({ tasks }) => {
        if (current) setTasks(tasks);
      })
      .catch((err) => {
        if (current) setError(errorMessage(err));
      });
    return () => { current = false; };
  }, [retry, stage]);

  const search = query.trim().toLowerCase();
  const visibleTasks = tasks?.filter((task) =>
    [task.key, task.title, task.column].some((value) => value?.toLowerCase().includes(search)),
  ) ?? [];
  const groups = groupsByStage[stage].map((group) => ({
    ...group,
    tasks: visibleTasks.filter((task) => task.category === group.category),
  }));

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || !tasks) return;
    onSubmit(plan ? { workedOn: selected } : {
      planned: selected,
      hasBlocker: blockerChoice === "yes",
      blocker,
      priority,
    });
  };

  return <dialog ref={dialog} className="checkout-dialog standup-dialog" aria-labelledby={titleId} onCancel={(event) => {
    event.preventDefault();
    if (!busy) onCancel();
  }}>
    <form onSubmit={submit}>
      <header className="modal-header standup-header">
        <h2 id={titleId}>{plan ? "Check-out report" : "Check-in stand-up"}</h2>
      </header>
      <div className="modal-body standup-fields">
        {submitError && <p className="standup-error" role="alert">{submitError}</p>}
        {error && <div className="standup-error" role="alert">
          <p>{error}</p>
          <button className="button button-secondary" type="button" onClick={() => setRetry((attempt) => attempt + 1)}>Retry</button>
        </div>}
        <fieldset className="standup-section" disabled={busy}>
          <legend>{plan ? "What did you work on?" : "What will you work on today?"}</legend>
          <p>{plan ? "Select the Paused or Done tasks you worked on." : "Select the To do or In progress tasks you plan to work on."}</p>
          {tasks === null && !error && <p role="status">Loading assigned tasks…</p>}
          {tasks?.length ? <>
            <div className="standup-picker-tools">
              <label className="standup-search">
                <Search size={16} aria-hidden="true" />
                <input type="search" aria-label="Search tasks by number or name" placeholder="Search task number or name" value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
                />
              </label>
              <span className="standup-count" aria-live="polite">{selected.length} selected</span>
            </div>
            {selected.length === selectionLimit && <p role="status">You can select up to {selectionLimit} tasks.</p>}
            <div className="standup-task-list">
              {groups.filter((group) => group.tasks.length).map((group) => <section key={group.category} className="standup-task-group">
                <h3>{group.label} <span>{group.tasks.length}</span></h3>
                {group.tasks.map((task) => {
                  const checked = selected.includes(task.id);
                  return <label key={task.id} className={`standup-choice${checked ? " selected" : ""}`}>
                    <input type="checkbox" checked={checked} disabled={!checked && selected.length >= selectionLimit} onChange={(event) => {
                      const next = event.target.checked;
                      setSelected((items) => next ? [...items, task.id] : items.filter((id) => id !== task.id));
                    }} />
                    <span className="standup-task-copy">
                      <span className="standup-task-meta">{task.key && <strong>{task.key}</strong>} <span>{task.column}</span></span>
                      <span>{task.title}</span>
                    </span>
                  </label>;
                })}
              </section>)}
              {!visibleTasks.length && <p className="standup-empty">No tasks match your search.</p>}
            </div>
          </> : tasks && <p className="standup-empty">You have no assigned tasks in these columns.</p>}
        </fieldset>
        {!plan && <fieldset className="standup-section standup-blockers" disabled={busy}>
          <legend>Any blockers?</legend>
          <div className="standup-blocker-options">
            {[["no", "No blockers"], ["yes", "Yes, I have a blocker"]].map(([value, label]) => <label key={value}>
              <input type="radio" name="blocker-choice" required checked={blockerChoice === value} onChange={() => setBlockerChoice(value)} />
              {label}
            </label>)}
          </div>
          {blockerChoice === "yes" && <div className="standup-blocker-fields">
            <label className="field">What’s blocking you?
              <input required maxLength={240} value={blocker} onChange={(event) => setBlocker(event.target.value)} />
            </label>
            <label className="field">Priority
              <select required value={priority} onChange={(event) => setPriority(event.target.value)}>
                <option value="">Choose priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>}
        </fieldset>}
      </div>
      <div className="modal-actions">
        <button type="button" className="button button-secondary" disabled={busy} onClick={onCancel}>Cancel</button>
        <button className="button button-primary" disabled={tasks === null || busy}>
          {busy ? "Submitting…" : plan ? "Submit and check out" : "Submit and check in"}
        </button>
      </div>
    </form>
  </dialog>;
}
