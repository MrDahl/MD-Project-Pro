import { useEffect, useRef, useState } from "react";
import { HelpCircle } from "lucide-react";

/** Event the app listens for to switch tab (used by the help links). */
export const GOTO_TAB_EVENT = "mdpp:goto-tab";

interface HelpTipProps {
  /** One-line explanation */
  text: string;
  /** Label used for screen readers, e.g. "Hjælp: Kritisk vej" */
  label: string;
  /** Show a link to the knowledge base (Vidensbase) */
  link?: boolean;
}

/** Small (?) button that opens a short explanation, with an optional link to the knowledge base. */
export function HelpTip({ text, label, link = true }: HelpTipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== "Escape") return;
      if (e instanceof MouseEvent && ref.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        data-testid="help-tip"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open);
        }}
        className="text-slate-500 hover:text-sky-700 cursor-pointer p-1 -m-1 rounded-full"
      >
        <HelpCircle className="w-4 h-4" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute z-50 left-0 top-full mt-1.5 w-64 max-w-[80vw] bg-white border border-slate-200 shadow-lg rounded-lg p-3 text-xs font-medium text-slate-700 leading-snug normal-case"
        >
          {text}
          {link && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                window.dispatchEvent(new CustomEvent(GOTO_TAB_EVENT, { detail: "glossary" }));
              }}
              className="block mt-2 font-bold text-sky-700 hover:underline cursor-pointer"
            >
              Læs mere i Vidensbasen →
            </button>
          )}
        </span>
      )}
    </span>
  );
}
