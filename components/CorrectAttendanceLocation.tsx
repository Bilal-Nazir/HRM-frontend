"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { parseLocationPin } from "@/lib/attendanceGeolocation";
import { errorMessage } from "@/lib/workspace";
import { ErrorBanner } from "@/components/ui";
import type { Attendance } from "@/types";

export default function CorrectAttendanceLocation({
  record,
  onSaved,
}: {
  record: Attendance;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false),
    [stage, setStage] = useState("check_in"),
    [pin, setPin] = useState(""),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, [open]);
  const chooseStage = (value: string) => {
    setStage(value);
    const point =
      value === "check_in" ? record.checkInLocation : record.checkOutLocation;
    setPin(point ? `${point.latitude}, ${point.longitude}` : "");
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    const point = parseLocationPin(pin);
    if (!point) {
      setError("A valid location pin is required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.patch(`/attendance/${record.id}/location`, {
        stage,
        ...point,
        reason,
      });
      setOpen(false);
      onSaved();
      window.dispatchEvent(new Event("hrm:attendance-change"));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button
        className="location-correct-button"
        type="button"
        onClick={() => {
          chooseStage("check_in");
          setReason("");
          setError("");
          setOpen(true);
        }}
      >
        Correct location
      </button>
      {open && (
        <dialog
          ref={dialog}
          className="checkout-dialog"
          aria-labelledby={`correct-location-${record.id}`}
          onCancel={(e) => {
            e.preventDefault();
            if (!busy) setOpen(false);
          }}
        >
          <form onSubmit={save}>
            <div className="modal-header">
              <div>
                <h2 id={`correct-location-${record.id}`}>
                  Correct attendance location
                </h2>
                <p>
                  The new pin is labeled admin-entered. The original value is
                  preserved in the audit log.
                </p>
              </div>
            </div>
            <div className="modal-body location-review-form">
              {error && <ErrorBanner message={error} />}
              <label>
                Attendance event
                <select
                  value={stage}
                  onChange={(e) => chooseStage(e.target.value)}
                >
                  <option value="check_in">Check-in location</option>
                  <option value="check_out" disabled={!record.checkOutAt}>
                    Check-out location
                  </option>
                </select>
              </label>
              <label>
                Coordinates or full Maps link
                <input
                  required
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                />
              </label>
              <label>
                Reason
                <textarea
                  required
                  minLength={5}
                  maxLength={1000}
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            </div>
            <div className="modal-actions">
              <button
                type="button"
                className="button button-secondary"
                disabled={busy}
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>
              <button className="button button-primary" disabled={busy}>
                Save manual location
              </button>
            </div>
          </form>
        </dialog>
      )}
    </>
  );
}
