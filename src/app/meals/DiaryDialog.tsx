import { useLayoutEffect, useRef, type ReactNode } from "react";

export default function DiaryDialog({ titleId, onClose, submitting, getFallbackFocus, children }: {
  titleId: string;
  onClose: () => void;
  submitting?: boolean;
  getFallbackFocus: () => HTMLElement | null;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      queueMicrotask(() => {
        // The browser restores a connected opener. Resolve the fallback after the DOM update.
        const active = document.activeElement;
        if (dialog.open || (active?.isConnected && active !== document.body && active !== document.documentElement)) return;
        const fallback = getFallbackFocus();
        if (fallback?.isConnected) fallback.focus();
      });
    };
  }, [getFallbackFocus]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onKeyDown={event => {
        if (event.key !== "Escape" || event.defaultPrevented) return;
        event.preventDefault();
        if (!submitting) onClose();
      }}
      onCancel={event => {
        event.preventDefault();
        if (!submitting) onClose();
      }}
      className="diary-dialog"
    >
      <div
        className="diary-dialog-frame"
        onClick={event => {
          if (event.target === event.currentTarget && !submitting) onClose();
        }}
      >
        <div className="diary-dialog-panel">
          {children}
        </div>
      </div>
    </dialog>
  );
}
