/**
 * Pacing for the help bot's typewriter reveal.
 *
 * Kept pure and separate from the component so it can be reasoned about — and
 * tested — without a DOM. The component only decides *when* to call this; the
 * two questions it answers are "how much of the answer is on screen now" and
 * "how long should the pause before the next character be".
 *
 * The variable pause is the part that matters. A reveal that advances at a
 * perfectly even rate reads as a progress bar; pausing at sentence ends and
 * line breaks is what makes it read as something composing a reply.
 */

/**
 * Base delay between characters.
 *
 * Short enough that a long answer still lands in a few seconds. The reveal has
 * to sell the idea that something is composing a reply, but a reader who has
 * to wait fifteen seconds for a paragraph has stopped reading and gone back to
 * the tab — length is the thing that has to be absorbed, not padded out.
 */
export const TICK_MS = 12;

/** Pause added after a sentence ends. */
export const SENTENCE_PAUSE_MS = 110;

/** Pause added after a line break, e.g. between the paragraphs of an answer. */
export const LINE_PAUSE_MS = 80;

/** Pause added after a comma or semicolon — a short breath, not a full stop. */
export const CLAUSE_PAUSE_MS = 40;

export interface RevealStep {
  /** Character count visible after this step. */
  shown: number;
  /** Milliseconds to wait before applying it. */
  delay: number;
  /** True once the whole answer is on screen. */
  done: boolean;
}

/**
 * Characters revealed per tick, scaled to how much is left to say.
 *
 * A fixed rate cannot serve both a 60-character reply and a 900-character one:
 * the short answer crawls, the long one never finishes. So the chunk grows with
 * the remaining length, and the reveal stays legible either way — never more
 * than four characters at once, which is still clearly characters rather than
 * text appearing.
 */
export function chunkFor(text: string, shown: number): number {
  const remaining = text.length - shown;
  if (remaining > 700) return 4;
  if (remaining > 400) return 3;
  if (remaining > 160) return 2;
  return 1;
}

/**
 * Extra pause after the character at `shown - 1`.
 *
 * Unknown trailing characters get no pause, so the delay is never longer than
 * it should be just because the answer ended on something unexpected.
 */
export function pauseAfter(text: string, shown: number): number {
  const last = text[shown - 1];
  if (last === "\n") return LINE_PAUSE_MS;
  if (last === "." || last === "!" || last === "?") return SENTENCE_PAUSE_MS;
  if (last === "," || last === ";") return CLAUSE_PAUSE_MS;
  return 0;
}

/**
 * Advance one step of the reveal. `shown` is clamped to the text length, so
 * calling this repeatedly — or calling it with a `shown` already past the end —
 * can never produce an out-of-range slice or a negative delay.
 */
export function revealStep(text: string, shown: number): RevealStep {
  if (shown >= text.length) {
    return { shown: text.length, delay: 0, done: true };
  }

  const next = Math.min(shown + chunkFor(text, shown), text.length);
  return {
    shown: next,
    delay: TICK_MS + pauseAfter(text, next),
    done: next >= text.length,
  };
}