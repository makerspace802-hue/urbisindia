import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, RotateCcw, Save, TrendingDown, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

/* --------------------------------------------------------------- questions */

interface Question {
  id: string;
  prompt: string;
  /** Each option carries its share of an annual per-capita footprint, kg CO2e. */
  options: { label: string; kg: number }[];
}

const QUESTIONS: Question[] = [
  {
    id: "commute",
    prompt: "How do you usually get to work, college or school?",
    options: [
      { label: "Walk or cycle", kg: 40 },
      { label: "Bus, metro or train", kg: 110 },
      { label: "Ride-share or carpool", kg: 210 },
      { label: "Drive alone", kg: 380 },
    ],
  },
  {
    id: "commute-length",
    prompt: "How long is your one-way commute most days?",
    options: [
      { label: "Under 10 minutes", kg: 30 },
      { label: "10 to 25 minutes", kg: 90 },
      { label: "25 to 45 minutes", kg: 170 },
      { label: "Over 45 minutes", kg: 280 },
    ],
  },
  {
    id: "flights",
    prompt: "How many flights have you taken in the last twelve months?",
    options: [
      { label: "None", kg: 0 },
      { label: "One or two", kg: 300 },
      { label: "Three to five", kg: 750 },
      { label: "More than five", kg: 1400 },
    ],
  },
  {
    id: "diet",
    prompt: "In a typical week, how many meals are fully plant-based?",
    options: [
      { label: "All or nearly all", kg: 240 },
      { label: "About half", kg: 420 },
      { label: "A few", kg: 640 },
      { label: "Rarely or never", kg: 900 },
    ],
  },
  {
    id: "food-waste",
    prompt: "How much food do you throw away in a typical month?",
    options: [
      { label: "Almost nothing", kg: 20 },
      { label: "A small amount", kg: 70 },
      { label: "A fair bit", kg: 150 },
      { label: "A lot of it", kg: 260 },
    ],
  },
  {
    id: "home-power",
    prompt: "What heats or cools your home?",
    options: [
      { label: "Solar, or a heat pump", kg: 90 },
      { label: "Efficient modern unit", kg: 220 },
      { label: "An older central system", kg: 480 },
      { label: "Diesel, coal or a chulha", kg: 1150 },
    ],
  },
  {
    id: "bulbs",
    prompt: "What share of your lights are LEDs?",
    options: [
      { label: "All of them", kg: 10 },
      { label: "Most of them", kg: 45 },
      { label: "Only a few", kg: 95 },
      { label: "None yet", kg: 150 },
    ],
  },
  {
    id: "laundry",
    prompt: "How often do you use a clothes dryer?",
    options: [
      { label: "Never, I line-dry", kg: 10 },
      { label: "Once a month", kg: 40 },
      { label: "Once a week", kg: 110 },
      { label: "Several times a week", kg: 200 },
    ],
  },
  {
    id: "devices",
    prompt: "How many devices do you charge overnight on a typical night?",
    options: [
      { label: "None", kg: 5 },
      { label: "One", kg: 15 },
      { label: "Two or three", kg: 35 },
      { label: "Four or more", kg: 70 },
    ],
  },
  {
    id: "vehicle",
    prompt: "Do you own a petrol or diesel vehicle?",
    options: [
      { label: "No vehicle at all", kg: 0 },
      { label: "An EV or electric two-wheeler", kg: 70 },
      { label: "Yes, but I drive little", kg: 400 },
      { label: "Yes, I drive it daily", kg: 850 },
    ],
  },
  {
    id: "fuel",
    prompt: "How is your household cooking fuel supplied?",
    options: [
      { label: "Piped gas or induction", kg: 70 },
      { label: "LPG cylinder", kg: 110 },
      { label: "Mixed, or kerosene", kg: 260 },
      { label: "Firewood, coal or dung cake", kg: 620 },
    ],
  },
  {
    id: "waste",
    prompt: "How much of your waste is recycled or composted?",
    options: [
      { label: "Nearly all of it", kg: 10 },
      { label: "Most of it", kg: 60 },
      { label: "A small share", kg: 140 },
      { label: "None at all", kg: 210 },
    ],
  },
  {
    id: "clothing",
    prompt: "How many new clothing items did you buy in the last three months?",
    options: [
      { label: "None", kg: 20 },
      { label: "One or two", kg: 90 },
      { label: "Three to five", kg: 200 },
      { label: "More than five", kg: 380 },
    ],
  },
  {
    id: "water",
    prompt: "How long is your shower on average?",
    options: [
      { label: "Under 5 minutes", kg: 20 },
      { label: "About 10 minutes", kg: 70 },
      { label: "About 20 minutes", kg: 160 },
      { label: "Over 20 minutes", kg: 280 },
    ],
  },
  {
    id: "plastic",
    prompt: "How often do you use single-use plastic?",
    options: [
      { label: "I avoid it entirely", kg: 15 },
      { label: "A few times a week", kg: 60 },
      { label: "Most days", kg: 130 },
      { label: "Several times a day", kg: 240 },
    ],
  },
];

/** Reference point: India's per-capita territorial CO2 emissions, kg CO2e/yr. */
const INDIA_AVERAGE_KG = 1900;
const WORLD_AVERAGE_KG = 4700;

function bandFor(kg: number) {
  if (kg < 700)
    return {
      label: "Low Impact",
      color: "#10B981",
      note: "Well under the Indian per-capita average. Unusually low and worth keeping up.",
    };
  if (kg < 1500)
    return {
      label: "Below Average",
      color: "#06B6D4",
      note: "Comfortably under the national per-capita figure of about 1.9 tonnes.",
    };
  if (kg < 2500)
    return {
      label: "Around Average",
      color: "#FBBF24",
      note: "Broadly in line with how India averages today. Transport is usually the lever.",
    };
  if (kg < 4000)
    return {
      label: "Above Average",
      color: "#F8FAFC",
      note: "Higher than most Indian households. Cooking fuel and flights are the big movers.",
    };
  return {
    label: "High Impact",
    color: "#F43F5E",
    note: "Well above both the Indian and global averages. Start with commute and cooking fuel.",
  };
}

/* ------------------------------------------------------------------ page */

export default function Quiz({
  population = 0,
  onComplete,
}: {
  population?: number;
  /** Fired once every question is answered, so the page can reveal what follows. */
  onComplete?: (footprintKg: number) => void;
}) {
  const { isAuthenticated, user } = useAuth();
  const saved = useQuery(api.quiz.myQuizScore);
  const submit = useMutation(api.quiz.submitQuizScore);

  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [locked, setLocked] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const question = QUESTIONS[index];
  const answeredCount = Object.keys(answers).length;
  const complete = answeredCount === QUESTIONS.length;

  const footprintKg = useMemo(
    () => QUESTIONS.reduce((total, item) => total + (answers[item.id] ?? 0), 0),
    [answers],
  );

  const band = bandFor(footprintKg);

  useEffect(() => {
    if (complete) onComplete?.(footprintKg);
  }, [complete, footprintKg, onComplete]);

  const cityScale = useMemo(() => {
    if (!population || !complete) return null;
    return {
      tonnes: (population * footprintKg) / 1000,
      savingsTonnes: (population * (INDIA_AVERAGE_KG - footprintKg)) / 1000,
    };
  }, [population, complete, footprintKg]);

  const handlePick = (optionKg: number) => {
    if (locked) return;
    setLocked(true);
    setAnswers((prev) => ({ ...prev, [question.id]: optionKg }));

    // Let the check mark land, then slide the next question in.
    window.setTimeout(() => {
      setLocked(false);
      setDirection(1);
      setIndex((i) => Math.min(i + 1, QUESTIONS.length - 1));
    }, 240);
  };

  const handleRestart = () => {
    setAnswers({});
    setIndex(0);
    setDirection(-1);
    setSavedAt(null);
  };

  const handleSave = async () => {
    if (!complete || !isAuthenticated) return;
    await submit({
      city: saved?.city || user?.city || "Unknown",
      country: saved?.country || user?.country || "—",
      footprintKg,
    });
    setSavedAt(Date.now());
  };

  const slide = {
    enter: (dir: number) => ({ x: dir > 0 ? 110 : -110, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -110 : 110, opacity: 0 }),
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-black uppercase tracking-tight text-[var(--nb-text)] md:text-3xl">
          Your Carbon Footprint
        </h1>
        <span className="nb-chip bg-[var(--nb-surface-2)] text-[#10B981]">
          {answeredCount} / {QUESTIONS.length}
        </span>
      </div>

      {/* Progress */}
      <div className="mt-4 h-4 border-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)]">
        <motion.div
          className="h-full bg-[#10B981]"
          animate={{ width: `${(index / (QUESTIONS.length - 1)) * 100}%` }}
          transition={{ type: "spring", stiffness: 130, damping: 22 }}
        />
      </div>

      {/* Single-question stage */}
      <div className="relative mt-5">
        <AnimatePresence mode="wait" custom={direction} initial={false}>
          <motion.section
            key={question.id}
            custom={direction}
            variants={slide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="nb-panel"
          >
            <div className="nb-subpanel flex items-center gap-3 border-b-2 border-[var(--nb-ink)] p-4">
              <span className="nb-chip bg-[#10B981] text-[#04110C]">
                {String(index + 1).padStart(2, "0")} / {QUESTIONS.length}
              </span>
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--nb-text-dim)]">
                Pick the closest to you
              </span>
            </div>

            <div className="p-5 md:p-6">
              <h2 className="text-lg font-black leading-snug text-[var(--nb-text)] md:text-xl">
                {question.prompt}
              </h2>

              <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {question.options.map((option) => {
                  const active = answers[question.id] === option.kg;
                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => handlePick(option.kg)}
                      disabled={locked}
                      className={[
                        "nb-btn justify-start px-3 py-3 text-left text-xs",
                        active
                          ? "bg-[#10B981] text-[#04110C]"
                          : "bg-[var(--nb-surface-2)] text-[var(--nb-text-2)]",
                      ].join(" ")}
                    >
                      <span className="flex items-center gap-2">
                        <span className="flex size-4 shrink-0 items-center justify-center border-2 border-[var(--nb-ink)]">
                          {active && (
                            <motion.span
                              initial={{ scale: 0, rotate: -90 }}
                              animate={{ scale: 1, rotate: 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <Check className="size-3" strokeWidth={4} />
                            </motion.span>
                          )}
                        </span>
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </motion.section>
        </AnimatePresence>
      </div>

      {/* Result */}
      <AnimatePresence>
        {complete && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="nb-panel mt-5"
          >
            <div className="nb-subpanel flex flex-wrap items-center gap-3 border-b-2 border-[var(--nb-ink)] p-4">
              <h2 className="nb-title text-sm">Your Result</h2>
              <span
                className="nb-chip ml-auto"
                style={{ background: band.color, color: "#0B0F17" }}
              >
                {band.label}
              </span>
            </div>

            <div className="p-5">
              <div className="flex flex-wrap items-end gap-4">
                <div>
                  <p className="text-5xl font-black leading-none tabular-nums text-[var(--nb-text)] md:text-6xl">
                    {(footprintKg / 1000).toFixed(2)}
                  </p>
                  <p className="mt-2 text-xs font-black uppercase tracking-widest text-[var(--nb-text-muted)]">
                    tonnes CO₂e per year
                  </p>
                </div>
                <p className="max-w-sm flex-1 text-sm font-bold leading-relaxed text-[var(--nb-text-2)]">
                  {band.note}
                </p>
              </div>

              {/* Comparison bars */}
              <div className="mt-5 flex flex-col gap-3">
                {(
                  [
                    ["You", footprintKg, band.color],
                    ["Indian average", INDIA_AVERAGE_KG, "#06B6D4"],
                    ["World average", WORLD_AVERAGE_KG, "#94A3B8"],
                  ] as const
                ).map(([label, kg, color]) => {
                  const pct = Math.min(100, (kg / WORLD_AVERAGE_KG) * 100);
                  return (
                    <div key={label}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-black uppercase tracking-widest text-[var(--nb-text-muted)]">
                          {label}
                        </span>
                        <span className="text-xs font-black tabular-nums text-[var(--nb-text)]">
                          {(kg / 1000).toFixed(2)} t
                        </span>
                      </div>
                      <div className="mt-1.5 h-4 border-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)]">
                        <motion.div
                          className="h-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                          style={{ background: color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* City scale */}
              {cityScale && population > 0 && (
                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="border-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)] p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-[var(--nb-text-muted)]">
                      If your city lived like you
                    </p>
                    <p className="mt-2 text-3xl font-black leading-none tabular-nums text-[#F43F5E]">
                      {Math.round(cityScale.tonnes).toLocaleString()} t
                    </p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[var(--nb-text-dim)]">
                      CO₂e a year
                    </p>
                  </div>
                  <div className="border-2 border-[var(--nb-ink)] bg-[#10B981] p-4 text-[#04110C]">
                    <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest opacity-75">
                      <TrendingDown className="size-3.5" strokeWidth={3} />
                      Headroom vs national average
                    </p>
                    <p className="mt-2 text-3xl font-black leading-none tabular-nums">
                      {Math.round(cityScale.savingsTonnes).toLocaleString()} t
                    </p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-widest opacity-75">
                      could be cut each year
                    </p>
                  </div>
                </div>
              )}

              <p className="mt-5 flex items-start gap-2 text-[10px] font-bold leading-relaxed text-[var(--nb-text-dim)]">
                <Users className="mt-0.5 size-3.5 shrink-0" strokeWidth={3} />
                Estimated from your answers against standard per-activity emission
                factors. This is an indicative personal tally, not an audited
                calculation, and the city figures are scaled from it.
              </p>

              <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!isAuthenticated}
                  className="nb-btn flex-1 justify-center bg-[#FBBF24] py-2.5 text-black disabled:cursor-not-allowed disabled:bg-[var(--nb-surface-2)] disabled:text-[var(--nb-text-dim)]"
                >
                  <Save className="size-4" strokeWidth={3} />
                  {isAuthenticated ? "Save Result" : "Sign In To Save"}
                </button>
                <button
                  type="button"
                  onClick={handleRestart}
                  className="nb-btn flex-1 justify-center bg-[var(--nb-surface-2)] py-2.5 text-[var(--nb-text-2)]"
                >
                  <RotateCcw className="size-4" strokeWidth={3} />
                  Retake
                </button>
              </div>

              {savedAt && (
                <p className="nb-chip mt-3 bg-[#10B981] text-[#04110C]">
                  Result saved
                </p>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}