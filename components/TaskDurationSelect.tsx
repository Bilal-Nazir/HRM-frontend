"use client";
import { ReactNode, useId } from "react";
import { formatTaskDuration } from "@/lib/taskDuration";

export default function TaskDurationSelect({
  options,
  value,
  onChange,
  disabled = false,
  setup,
}: {
  options: number[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  setup?: ReactNode;
}) {
  const existing = value !== "" && !options.includes(Number(value));
  const inputId = useId();
  return (
    <div className="field task-duration-select">
      <label htmlFor={inputId}>Task duration <span aria-hidden="true">*</span></label>
      <select
        id={inputId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || (!options.length && !existing)}
        required
      >
        <option value="" disabled hidden>{options.length || existing ? "Select duration" : "No durations configured"}</option>
        {existing && (
          <option value={value}>
            {formatTaskDuration(Number(value))} (existing selection)
          </option>
        )}
        {options.map((minutes) => (
          <option value={minutes} key={minutes}>
            {formatTaskDuration(minutes)}
          </option>
        ))}
      </select>
      {!options.length && !existing && (
        setup ? <details className="duration-setup"><summary>Configure task durations</summary>{setup}</details>
          : <small>Ask a project admin to add duration choices in Workflow settings.</small>
      )}
    </div>
  );
}
