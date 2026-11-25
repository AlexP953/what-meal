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
      onCancel={event => {
        event.preventDefault();
        if (!submitting) onClose();
      }}
      className="fixed inset-0 m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 backdrop:bg-black/40"
    >
      <div
        className="flex min-h-full items-end justify-center sm:items-center"
        onClick={event => {
          if (event.target === event.currentTarget && !submitting) onClose();
        }}
      >
        <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-5 sm:p-6 shadow-xl mx-0 sm:mx-4">
          {children}
        </div>
      </div>
    </dialog>
  );
}
