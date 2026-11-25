"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/workspace";
import type { ProjectTask } from "@/types";

export type TaskSnapshot = { id: string; title: string };
export type StandupPlan = { yesterday: TaskSnapshot[]; planned: TaskSnapshot[]; blocker?: { text: string; priority: string } };
export type StandupStatus = { enabled: boolean; plan: StandupPlan | null };
export type StandupInput =
  | { yesterday: string[]; planned: string[]; hasBlocker: boolean; blocker: string; priority: string }
  | { completed: string[]; additional: string[] };

export default function StandupForm({ plan, onCancel, onSubmit, busy, submitError }: {
  plan: StandupPlan | null;
  onCancel: () => void;
  onSubmit: (input: StandupInput) => void;
  busy: boolean;
  submitError: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tasks, setTasks] = useState<ProjectTask[] | null>(null);
  const [error, setError] = useState("");
  const [first, setFirst] = useState<string[]>([]);
  const [second, setSecond] = useState<string[]>([]);
  const [blockerChoice, setBlockerChoice] = useState("");
  const [blocker, setBlocker] = useState("");
  const [priority, setPriority] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
    api.get<{ tasks: ProjectTask[] }>("/projects/my-tasks").then(({ tasks }) => setTasks(tasks)).catch((error) => setError(errorMessage(error)));
  }, []);

  const choices = (label: string, items: TaskSnapshot[], selected: string[], change: (ids: string[]) => void) =>
    <fieldset><legend>{label}</legend>
      {items.length ? items.map((task) => <label key={task.id} className="standup-choice">
        <input type="checkbox" checked={selected.includes(task.id)} onChange={(event) => change(event.target.checked ? [...selected, task.id] : selected.filter((id) => id !== task.id))} />
        {task.title}
      </label>) : <p>No tasks available.</p>}
    </fieldset>;

  return <dialog ref={dialog} className="checkout-dialog" onCancel={(event) => { event.preventDefault(); onCancel(); }}>
    <form onSubmit={(event) => {
      event.preventDefault();
      onSubmit(plan ? { completed: first, additional: second } : { yesterday: first, planned: second, hasBlocker: blockerChoice === "yes", blocker, priority });
    }}>
      <div className="modal-header"><h2>{plan ? "Review your stand-up" : "Submit your stand-up"}</h2></div>
      <div className="modal-body standup-fields">
        {(error || submitError) && <p role="alert">{error || submitError}</p>}
        {!tasks && !error && <p role="status">Loading assigned tasks…</p>}
        {tasks && (plan ? <>
          {choices("Completed planned tasks", plan.planned, first, setFirst)}
          <p>Unchecked planned tasks will be recorded as pending.</p>
          {choices("Additional completed tasks", tasks.filter((task) => !plan.planned.some(({ id }) => id === task.id)), second, setSecond)}
        </> : <>
          <p>Create and assign any new tasks to yourself in Projects before checking in.</p>
          {choices("Tasks worked on yesterday", tasks, first, setFirst)}
          {choices("Tasks planned for today", tasks, second, setSecond)}
          <label className="field">Any blockers?
            <select required value={blockerChoice} onChange={(event) => setBlockerChoice(event.target.value)}><option value="">Choose yes or no</option><option value="no">No</option><option value="yes">Yes</option></select>
          </label>
          {blockerChoice === "yes" && <>
            <label className="field">Blocker<input required maxLength={240} value={blocker} onChange={(event) => setBlocker(event.target.value)} /></label>
            <label className="field">Priority<select required value={priority} onChange={(event) => setPriority(event.target.value)}><option value="">Choose priority</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option></select></label>
          </>}
        </>)}
      </div>
      <div className="modal-actions">
        <button type="button" className="button button-secondary" disabled={busy} onClick={onCancel}>Cancel</button>
        <button className="button button-primary" disabled={!tasks || busy}>{plan ? "Submit and check out" : "Submit and check in"}</button>
      </div>
    </form>
  </dialog>;
}
