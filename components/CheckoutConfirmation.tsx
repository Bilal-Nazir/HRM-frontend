"use client";
import { useEffect, useRef } from "react";
import { LogOut } from "lucide-react";

export default function CheckoutConfirmation({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      className="checkout-dialog"
      aria-labelledby="checkout-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <div className="modal-header">
        <div>
          <h2 id="checkout-title">Finish your work session?</h2>
          <p>Confirm to record your check-out time and location.</p>
        </div>
      </div>
      <div className="modal-body">
        <p>
          Your current session will end. You can check in again when you resume
          work.
        </p>
      </div>
      <div className="modal-actions">
        <button
          type="button"
          autoFocus
          className="button button-secondary"
          onClick={onCancel}
        >
          Keep working
        </button>
        <button
          type="button"
          className="button button-primary"
          onClick={onConfirm}
        >
          <LogOut size={17} />
          Confirm check out
        </button>
      </div>
    </dialog>
  );
}
