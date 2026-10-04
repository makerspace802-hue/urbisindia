import agentLogo from "@/assets/agent.svg";
import {
  ask,
  STARTER_QUESTIONS,
  type HelpReply,
} from "@/lib/helpKnowledge";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, CornerDownLeft, Sparkles, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useNavigate } from "react-router";
import { revealStep } from "@/lib/typewriter";

interface Message {
  id: number;
  from: "you" | "urbis";
  text: string;
  /** Where the answer came from. Shown so a claim is always traceable. */
  source?: string;
  route?: string;
  /** Follow-ups the visitor can tap instead of typing. */
  suggestions?: string[];
}

const GREETING: Omit<Message, "id"> = {
  from: "urbis",
  text:
    "Hi — I'm the URBIS assistant.\n\n" +
    "I know what's on this site: the Census pages, the analytics, the complaint portal, the carbon quiz and your account. " +
    "I answer site questions only.",
  source: "helpKnowledge.ts",
  suggestions: [...STARTER_QUESTIONS],
};

/**
 * Site help bot.
 *
 * Square, not round: `index.css` sets `border-radius: 0 !important` on
 * everything, so a circular launcher would have been the one rounded object on
 * the page. It also carries the same 2px ink border and offset shadow as every
 * other control, which is what makes it read as part of the app rather than a
 * third-party widget dropped on top.
 *
 * It sits at `z-[90]`, above the draggable clock/weather widget at `z-[70]`, so
 * dragging that widget can never park it on top of the launcher.
 *
 * Answers come from `lib/helpKnowledge`, which is pure and reads the real
 * Census modules — there is no model call, so nothing here can invent a figure.
 */
export default function HelpBot() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([{ ...GREETING, id: 0 }]);
  /**
   * The answer currently arriving, and how much of it is on screen. `null`
   * once a message has fully rendered, so an old answer never re-animates.
   */
  const [revealing, setRevealing] = useState<{ id: number; shown: number } | null>(null);

  /**
   * Read once, in a lazy initialiser rather than an effect, because it is a
   * property of the visitor's machine and never changes while the panel is
   * open. Someone who asked for reduced motion gets whole answers instantly.
   */
  const [reducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const navigate = useNavigate();
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const nextId = useRef(1);

  /** Push the question and its answer in one pass, so the pair cannot reorder. */
  const send = useCallback((raw: string) => {
    const question = raw.trim();
    if (!question) return;

    const reply: HelpReply = ask(question);
    const you: Message = { id: nextId.current++, from: "you", text: question };
    const urbis: Message = {
      id: nextId.current++,
      from: "urbis",
      text: reply.text,
      source: reply.source,
      route: reply.route,
      suggestions: reply.suggestions,
    };
    setMessages((previous) => [...previous, you, urbis]);
    // Starting the reveal here, in the event handler, is what keeps it out of
    // an effect body. Under reduced motion there is no reveal at all: the
    // answer is stored complete and renders complete.
    setRevealing(reducedMotion ? null : { id: urbis.id, shown: 0 });
    setDraft("");
  }, [reducedMotion]);

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    send(draft);
  };

  /**
   * The greeting is the first thing anyone reads, so it types too — an instant
   * wall of text on open is the exact impression this is meant to remove. Only
   * the very first open streams it; reopening resumes whatever is already in
   * the transcript. Started in the click handler, not an effect, for the same
   * reason `send` does it there.
   */
  const toggle = useCallback(() => {
    // Plain read of `open`, not a functional update: an updater must stay pure,
    // and nesting a setRevealing inside one is exactly the kind of side effect
    // React double-invokes in StrictMode.
    if (!open && messages.length === 1) {
      setRevealing(reducedMotion ? null : { id: 0, shown: 0 });
    }
    setOpen(!open);
  }, [open, messages.length, reducedMotion]);

  // Only state that is not already known: focus the field and pin the transcript
  // to the newest message. Neither effect writes React state, so neither can
  // trip the render-phase-update rule.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length, open, revealing?.shown]);

  /**
   * The typewriter. Each step schedules only the next one, so there is exactly
   * one timer in flight and a newer answer cancels the previous reveal by
   * changing `revealing` and re-running this effect. The state write happens
   * inside the timer callback rather than in the effect body, which is what
   * keeps this a timer rather than a render-phase update.
   */
  useEffect(() => {
    if (revealing === null || reducedMotion) return;
    const message = messages.find((entry) => entry.id === revealing.id);
    if (!message) return;
    // The final step lands the last characters and then stops: the guard is on
    // `shown` having reached the end, not on the step being the last one.
    if (revealing.shown >= message.text.length) return;

    const step = revealStep(message.text, revealing.shown);
    const timer = window.setTimeout(() => {
      setRevealing({ id: revealing.id, shown: step.shown });
    }, step.delay);
    return () => window.clearTimeout(timer);
  }, [messages, reducedMotion, revealing]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const lastIndex = messages.length - 1;

  /** Text as it should read right now — a partial slice while a reply lands. */
  const visibleText = (message: Message) =>
    message.from === "urbis" && revealing?.id === message.id
      ? message.text.slice(0, revealing.shown)
      : message.text;

  /** True only while this particular answer is still arriving. */
  const isTyping = (message: Message) =>
    message.from === "urbis" &&
    revealing?.id === message.id &&
    revealing.shown < message.text.length;

  return (
    <div className="fixed bottom-4 right-4 z-[90] flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            role="dialog"
            aria-label="URBIS site help"
            className="nb-panel flex max-h-[min(30rem,70vh)] w-[min(22rem,calc(100vw-2rem))] flex-col"
          >
            {/* Header */}
            <div className="nb-subpanel flex items-center gap-2.5 border-b-2 border-[var(--nb-ink)] p-3">
              <img src={agentLogo} alt="" className="size-8 shrink-0" />
              <div className="min-w-0">
                <p className="nb-title text-xs leading-tight">URBIS Assistant</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--nb-text-muted)]">
                  Site questions only
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close help"
                className="ml-auto flex size-7 shrink-0 items-center justify-center border-2 border-[var(--nb-ink)] bg-[var(--nb-surface)] text-[var(--nb-text-2)]"
              >
                <X className="size-3.5" strokeWidth={3} />
              </button>
            </div>

            {/* Transcript */}
            <div
              ref={listRef}
              aria-live="polite"
              className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-3"
            >
              {messages.map((message, index) =>
                message.from === "you" ? (
                  <p
                    key={message.id}
                    className="ml-auto max-w-[85%] border-2 border-[var(--nb-ink)] bg-[#10B981] px-2.5 py-1.5 text-xs font-bold leading-relaxed text-[#04110C]"
                  >
                    {message.text}
                  </p>
                ) : (
                  <div key={message.id} className="max-w-[92%]">
                    <p className="border-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)] px-2.5 py-1.5 text-xs font-semibold leading-relaxed whitespace-pre-line text-[var(--nb-text-2)]">
                      {/* The full answer is exposed once, up front, while the
                          animated slice is hidden from assistive tech. Without
                          this split a screen reader announces the reply one
                          character at a time, which makes it unusable. */}
                      <span className="sr-only">{message.text}</span>
                      <span aria-hidden="true">{visibleText(message)}</span>
                      {isTyping(message) && <span className="nb-caret" />}
                    </p>
                    {isTyping(message) && (
                      <button
                        type="button"
                        onClick={() =>
                          setRevealing({ id: message.id, shown: message.text.length })
                        }
                        className="nb-chip mt-1.5 bg-[var(--nb-surface-2)] text-[var(--nb-text-2)]"
                      >
                        Show all
                      </button>
                    )}
                    {message.route && (
                      <button
                        type="button"
                        onClick={() => {
                          void navigate(message.route as string);
                          setOpen(false);
                        }}
                        className="nb-chip mt-1.5 bg-[#06B6D4] text-[#03151A]"
                      >
                        <Sparkles className="size-3" strokeWidth={3} />
                        Go to {message.route}
                      </button>
                    )}

                    {/* Follow-ups belong to the newest answer only. Rendering
                        them on every message would bury the transcript under a
                        wall of duplicate chips. */}
                    {index === lastIndex &&
                      message.suggestions &&
                      message.suggestions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {message.suggestions.map((question) => (
                            <button
                              key={question}
                              type="button"
                              onClick={() => send(question)}
                              className="nb-chip whitespace-normal bg-[var(--nb-surface-2)] text-[var(--nb-text-2)]"
                            >
                              {question}
                            </button>
                          ))}
                        </div>
                      )}

                    {message.source && (
                      <p className="mt-1 text-[9px] font-bold uppercase tracking-wide text-[var(--nb-text-dim)]">
                        {message.source}
                      </p>
                    )}
                  </div>
                ),
              )}
            </div>

            {/* Composer */}
            <form
              onSubmit={onSubmit}
              className="flex items-center gap-2 border-t-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)] p-2"
            >
              <input
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Ask about this site…"
                aria-label="Ask about this site"
                maxLength={200}
                className="nb-field py-2 text-xs"
              />
              <button
                type="submit"
                disabled={draft.trim().length === 0}
                aria-label="Send question"
                className="nb-btn shrink-0 bg-[#10B981] px-2.5 py-2 text-[#04110C] disabled:opacity-40"
              >
                <ArrowUp className="size-4" strokeWidth={3} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Launcher — square, to match the flat-corner theme */}
      <button
        type="button"
        onClick={toggle}
        aria-label={open ? "Close site help" : "Open site help"}
        aria-expanded={open}
        title="Ask about this site"
        className="relative flex size-14 shrink-0 items-center justify-center border-2 border-[var(--nb-ink)] bg-[#10B981] shadow-[4px_4px_0_0_var(--nb-ink)] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_var(--nb-ink)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_0_var(--nb-ink)]"
      >
        {open ? (
          <X className="size-6 text-[#04110C]" strokeWidth={3} />
        ) : (
          <img src={agentLogo} alt="" className="size-9" />
        )}
        {!open && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center border-2 border-[var(--nb-ink)] bg-[#FBBF24]">
            <CornerDownLeft className="size-2.5 text-black" strokeWidth={3} />
          </span>
        )}
      </button>
    </div>
  );
}