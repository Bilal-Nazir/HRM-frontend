"use client";
import { useId } from "react";
import { formatTaskDuration } from "@/lib/taskDuration";

export default function TaskDurationSelect({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: number[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
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
        disabled={disabled}
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
    </div>
  );
}
