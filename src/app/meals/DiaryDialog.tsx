import { useLayoutEffect, useRef, type ReactNode, type RefObject } from "react";

export default function DiaryDialog({ titleId, onClose, submitting, fallbackFocus, children }: {
  titleId: string;
  onClose: () => void;
  submitting?: boolean;
  fallbackFocus?: RefObject<HTMLButtonElement | null>;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement;
    const alternate = fallbackFocus?.current;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (alternate) queueMicrotask(() => {
        if (alternate.isConnected && !opener?.isConnected && document.activeElement === document.body) {
          alternate.focus();
        }
      });
    };
  }, [fallbackFocus]);

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
