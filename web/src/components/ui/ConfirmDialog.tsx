import { useEffect, useRef, type ReactNode } from "react";

/**
 * Accessible modal built on the native <dialog>: focus is trapped by the browser, Escape closes it, and the backdrop
 * is inert. Used before any action that moves money or cannot be undone.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
  busy = false,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={ref} className="confirm" aria-labelledby="confirm-title" onCancel={(e) => { e.preventDefault(); if (!busy) onCancel(); }}>
      <h3 id="confirm-title" className="m-0 font-serif text-[26px] font-normal leading-tight">
        {title}
      </h3>
      <div className="mt-3 text-[14px] leading-relaxed text-app-soft">{children}</div>
      <div className="mt-6 flex flex-wrap justify-end gap-2.5">
        <button className="ghost" onClick={onCancel} disabled={busy}>
          Go back
        </button>
        <button onClick={onConfirm} disabled={busy}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
