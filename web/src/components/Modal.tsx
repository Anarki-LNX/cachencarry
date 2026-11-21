import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { useT } from "../i18n";
import { Button, IconButton } from "./Controls";

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useT();

  useEffect(() => {
    const dlg = ref.current;
    if (!dlg) return;
    if (!dlg.open) dlg.showModal();
    // showModal() focuses the first focusable element (the close button); prefer the form field or the safe choice.
    const target = dlg.querySelector<HTMLElement>("[data-autofocus]") ?? dlg.querySelector<HTMLElement>("textarea, input, select");
    target?.focus();
    return () => {
      if (dlg.open) dlg.close();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-line bg-panel p-0 text-fg shadow-2xl backdrop:bg-black/60"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <h2 className="text-sm font-semibold">{title}</h2>
        <IconButton label={t("common.closeDialog")} onClick={onClose}>
          <X className="size-4" aria-hidden />
        </IconButton>
      </div>
      <div className="max-h-[70vh] overflow-auto p-4 text-sm">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-line px-4 py-3">{footer}</div>}
    </dialog>
  );
}

export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}: {
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { t } = useT();
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} data-autofocus>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" busy={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
