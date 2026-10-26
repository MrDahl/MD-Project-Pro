import { useState } from "react";
import { Zap } from "lucide-react";
import { HelpTip } from "./HelpTip";

interface Props {
  /** Returns warnings to show (empty list = all fine), or null if nothing was created */
  onAdd: (text: string) => string[] | null;
}

/** One line to add a task fast: "Maling 5 dage @Maler efter Gipsplader" + Enter. */
export function QuickAdd({ onAdd }: Props) {
  const [text, setText] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  return (
    <form
      data-testid="quick-add-form"
      className="flex flex-col gap-1.5 bg-white border border-slate-200 rounded-xl p-2.5 shadow-2xs print:hidden"
      onSubmit={(e) => {
        e.preventDefault();
        const res = onAdd(text);
        if (res === null) return;
        setNotes(res);
        setText("");
      }}
    >
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-sky-600 shrink-0 ml-1" />
        <input
          data-testid="quick-add"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Hurtig-tilføj: Maling 5 dage @Maler efter Gipsplader"
          aria-label="Hurtig-tilføj opgave"
          className="flex-1 min-w-0 py-2 px-1 text-sm font-semibold text-slate-800 outline-none bg-transparent placeholder:font-normal"
        />
        <HelpTip
          label="Hjælp: hurtig-tilføj"
          link={false}
          text="Skriv navn og varighed, fx «Maling 5 dage», «Gulv 2 uger» eller «Fræsning 4 timer». Tilføj @faggruppe, #etape og «efter» en anden opgave. «Aflevering milepæl» laver en milepæl. Tryk Enter."
        />
        <button type="submit" disabled={!text.trim()} className="px-3 py-2 min-h-[36px] rounded-lg bg-slate-800 text-white text-sm font-bold cursor-pointer disabled:bg-slate-200 disabled:text-slate-600 disabled:cursor-default">
          Tilføj
        </button>
      </div>
      {notes.length > 0 && (
        <p data-testid="quick-add-notes" className="text-xs font-semibold text-amber-800 px-1">
          Oprettet, men: {notes.join(". ")}.
        </p>
      )}
    </form>
  );
}
