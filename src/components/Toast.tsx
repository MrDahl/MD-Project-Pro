export interface ToastData {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/** Slide-up notification; an optional action button (e.g. "Fortryd") makes it interactive. */
export function Toast({ toast, onDismiss }: { toast: ToastData | null; onDismiss: () => void }) {
  if (!toast) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="animate-toast-in fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 border border-slate-800 text-white rounded-xl pl-4 pr-2 py-2.5 text-xs font-bold flex items-center gap-3 shadow-lg z-[60] max-w-[92vw]"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
      <span>{toast.message}</span>
      {toast.actionLabel && toast.onAction && (
        <button
          type="button"
          onClick={() => {
            toast.onAction?.();
            onDismiss();
          }}
          className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 font-black cursor-pointer"
        >
          {toast.actionLabel}
        </button>
      )}
    </div>
  );
}
