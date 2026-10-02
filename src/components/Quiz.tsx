import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { motion } from "framer-motion";
import { Check, RotateCcw, Sparkles, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";

/* --------------------------------------------------------------- questions */

type Category = "dailyHabits" | "usage" | "carbonFootprint";

interface Question {
  id: string;
  category: Category;
  prompt: string;
  options: { label: string; points: number }[];
}

const QUESTIONS: Question[] = [
  // --- Daily habits (5) ---
  {
    id: "h1",
    category: "dailyHabits",
    prompt: "How do you usually get to work or campus?",
    options: [
      { label: "Walk or cycle", points: 10 },
      { label: "Bus, metro or train", points: 8 },
      { label: "Ride-share or carpool", points: 5 },
      { label: "Drive alone", points: 1 },
    ],
  },
  {
    id: "h2",
    category: "dailyHabits",
    prompt: "How many single-use items did you use yesterday?",
    options: [
      { label: "None", points: 10 },
      { label: "One or two", points: 7 },
      { label: "Three to five", points: 4 },
      { label: "More than five", points: 1 },
    ],
  },
  {
    id: "h3",
    category: "dailyHabits",
    prompt: "How long is your typical outdoor commute?",
    options: [
      { label: "Under 10 minutes", points: 10 },
      { label: "10 to 25 minutes", points: 7 },
      { label: "25 to 45 minutes", points: 4 },
      { label: "Over 45 minutes", points: 1 },
    ],
  },
  {
    id: "h4",
    category: "dailyHabits",
    prompt: "How often do you shop locally rather than online?",
    options: [
      { label: "Most days", points: 10 },
      { label: "About once a week", points: 7 },
      { label: "Rarely", points: 4 },
      { label: "Almost never", points: 1 },
    ],
  },
  {
    id: "h5",
    category: "dailyHabits",
    prompt: "How much of your food is plant-based in a typical week?",
    options: [
      { label: "Almost entirely", points: 10 },
      { label: "Mostly plant-based", points: 7 },
      { label: "A balanced mix", points: 4 },
      { label: "Mostly meat or dairy", points: 1 },
    ],
  },

  // --- Energy usage (5) ---
  {
    id: "u1",
    category: "usage",
    prompt: "What is your home's main heat or cooling source?",
    options: [
      { label: "Heat pump or efficient system", points: 10 },
      { label: "Modern gas furnace", points: 7 },
      { label: "Older central unit", points: 4 },
      { label: "Electric resistance heating", points: 1 },
    ],
  },
  {
    id: "u2",
    category: "usage",
    prompt: "How many LED bulbs are in your home?",
    options: [
      { label: "All of them", points: 10 },
      { label: "Most of them", points: 7 },
      { label: "Only a few", points: 4 },
      { label: "None yet", points: 1 },
    ],
  },
  {
    id: "u3",
    category: "usage",
    prompt: "Do you line-dry clothes instead of using a dryer?",
    options: [
      { label: "Yes, every week", points: 10 },
      { label: "Sometimes", points: 7 },
      { label: "Rarely", points: 4 },
      { label: "Never", points: 1 },
    ],
  },
  {
    id: "u4",
    category: "usage",
    prompt: "How often do you charge a battery or electric device overnight?",
    options: [
      { label: "Never, I avoid it", points: 10 },
      { label: "A few nights a week", points: 7 },
      { label: "Most nights", points: 4 },
      { label: "Every single night", points: 1 },
    ],
  },
  {
    id: "u5",
    category: "usage",
    prompt: "How much of your electricity comes from rooftop solar?",
    options: [
      { label: "All of it", points: 10 },
      { label: "More than half", points: 7 },
      { label: "A small share", points: 4 },
      { label: "None", points: 1 },
    ],
  },

  // --- Carbon footprint (5) ---
  {
    id: "c1",
    category: "carbonFootprint",
    prompt: "How many flights have you taken in the last year?",
    options: [
      { label: "None", points: 10 },
      { label: "One or two", points: 7 },
      { label: "Three to five", points: 4 },
      { label: "More than five", points: 1 },
    ],
  },
  {
    id: "c2",
    category: "carbonFootprint",
    prompt: "How often do you eat a plant-based meal?",
    options: [
      { label: "Every meal", points: 10 },
      { label: "Most days", points: 7 },
      { label: "Once a week", points: 4 },
      { label: "Rarely", points: 1 },
    ],
  },
  {
    id: "c3",
    category: "carbonFootprint",
    prompt: "What is your main grocery habit?",
    options: [
      { label: "Local and seasonal", points: 10 },
      { label: "Mostly plant-based", points: 8 },
      { label: "Mixed shopping", points: 4 },
      { label: "Packaged and processed", points: 1 },
    ],
  },
  {
    id: "c4",
    category: "carbonFootprint",
    prompt: "How much of your waste do you recycle or compost?",
    options: [
      { label: "Nearly everything", points: 10 },
      { label: "Most of it", points: 7 },
      { label: "A small share", points: 4 },
      { label: "None", points: 1 },
    ],
  },
  {
    id: "c5",
    category: "carbonFootprint",
    prompt: "How many new clothes did you buy in the last three months?",
    options: [
      { label: "None", points: 10 },
      { label: "One or two", points: 7 },
      { label: "Three to five", points: 4 },
      { label: "More than five", points: 1 },
    ],
  },
];

const MAX_PER_CATEGORY = 50;

const CATEGORY_META: Record<
  Category,
  { label: string; color: string; shadow: string }
> = {
  dailyHabits: { label: "Daily Habits", color: "#06B6D4", shadow: "text-[#03151A]" },
  usage: { label: "Energy Usage", color: "#10B981", shadow: "text-[#04110C]" },
  carbonFootprint: { label: "Carbon Footprint", color: "#FBBF24", shadow: "text-black" },
};

const CATEGORY_ORDER: Category[] = [
  "dailyHabits",
  "usage",
  "carbonFootprint",
];

function grade(scorePct: number) {
  if (scorePct >= 85)
    return { label: "Trailblazer", color: "#10B981", note: "Top decile. The city is pulling toward you." };
  if (scorePct >= 65)
    return { label: "Green Commuter", color: "#06B6D4", note: "Strong habits with a few easy wins left." };
  if (scorePct >= 40)
    return { label: "On The Curb", color: "#FBBF24", note: "Solid baseline. A couple of swaps would compound." };
  return { label: "High Impact", color: "#F43F5E", note: "Biggest headroom on this block of the city." };
}

/* ------------------------------------------------------------------ page */

export default function Quiz({ population = 0 }: { population?: number }) {
  const { isAuthenticated, user } = useAuth();
  const saved = useQuery(api.quiz.myQuizScore);
  const submit = useMutation(api.quiz.submitQuizScore);

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const answered = Object.keys(answers).length;
  const complete = answered === QUESTIONS.length;

  const results = useMemo(() => {
    const perCategory: Record<Category, number> = {
      dailyHabits: 0,
      usage: 0,
      carbonFootprint: 0,
    };
    for (const question of QUESTIONS) {
      const points = answers[question.id];
      if (points !== undefined) perCategory[question.category] += points;
    }
    const total =
      perCategory.dailyHabits +
      perCategory.usage +
      perCategory.carbonFootprint;
    const max = MAX_PER_CATEGORY * 3;
    return { perCategory, total, max, pct: Math.round((total / max) * 100) };
  }, [answers]);

  const cityScale = useMemo(() => {
    if (!population) return null;
    // Scale the individual's score into a city-wide figure so a single
    // result reads as a share of the whole urban programme.
    const cityPct = results.pct;
    return {
      kgAvoided: Math.round((population * cityPct) / 100 / 1000) * 1000,
      commuters: Math.round((population * cityPct) / 100 / 10000) * 100,
      households: Math.round((population * cityPct) / 100 / 100000) * 100,
    };
  }, [population, results.pct]);

  const handleReset = () => {
    setAnswers({});
    setSavedAt(null);
  };

  const handleSave = async () => {
    if (!complete || !isAuthenticated) return;
    const city = saved?.city ?? "Unknown";
    const id = await submit({
      city,
      country: "—",
      totalPoints: results.total,
      categoryPoints: results.perCategory,
    });
    setSavedAt(Date.now());
    void id;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-black uppercase tracking-tight text-[#F8FAFC] md:text-3xl">
          Resident Sustainability Quiz
        </h1>
        <span className="nb-chip bg-[#1E293B] text-[#10B981]">
          {answered} / {QUESTIONS.length} Answered
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        {/* ------------------------------------------------- questions */}
        <div className="flex flex-col gap-4">
          {QUESTIONS.map((question, index) => {
            const meta = CATEGORY_META[question.category];
            const chosen = answers[question.id];
            return (
              <motion.article
                key={question.id}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.22, delay: (index % 3) * 0.05 }}
                className="nb-panel"
              >
                <div className="flex items-center gap-3 border-b-2 border-black bg-[#111827] p-4">
                  <span className="nb-chip bg-[#1E293B] text-[#94A3B8]">
                    Q{index + 1}
                  </span>
                  <span
                    className="nb-chip"
                    style={{ background: meta.color, color: meta.shadow }}
                  >
                    {meta.label}
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="text-sm font-black leading-snug text-[#F8FAFC]">
                    {question.prompt}
                  </h3>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {question.options.map((option) => {
                      const active = chosen === option.points;
                      return (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() =>
                            setAnswers((prev) => ({
                              ...prev,
                              [question.id]: option.points,
                            }))
                          }
                          className={[
                            "flex items-center gap-2 border-2 border-black px-3 py-2 text-left text-xs font-bold transition-transform",
                            active
                              ? "bg-[#10B981] text-[#04110C] shadow-[3px_3px_0_0_#000]"
                              : "bg-[#1E293B] text-[#CBD5E1] hover:bg-[#334155]",
                          ].join(" ")}
                        >
                          {active && <Check className="size-3.5 shrink-0" strokeWidth={4} />}
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>

        {/* --------------------------------------------------- scorecard */}
        <aside className="lg:sticky lg:top-24">
          <section className="nb-panel">
            <div className="flex items-center justify-between gap-3 border-b-2 border-black bg-[#111827] p-4">
              <h2 className="nb-title text-sm">Your Scorecard</h2>
              <span className="nb-chip bg-[#1E293B] text-[#10B981] tabular-nums">
                {results.total} / {results.max}
              </span>
            </div>

            <div className="flex flex-col gap-4 p-4">
              {CATEGORY_ORDER.map((category) => {
                const meta = CATEGORY_META[category];
                const value = results.perCategory[category];
                const pct = Math.round((value / MAX_PER_CATEGORY) * 100);
                return (
                  <div key={category}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-black uppercase tracking-widest text-[#CBD5E1]">
                        {meta.label}
                      </span>
                      <span className="text-xs font-black tabular-nums text-[#F8FAFC]">
                        {pct}%
                      </span>
                    </div>
                    <div className="mt-2 h-4 border-2 border-black bg-[#0B0F17]">
                      <div
                        className="h-full border-2 border-black transition-[width] duration-300"
                        style={{ width: `${pct}%`, background: meta.color }}
                      />
                    </div>
                  </div>
                );
              })}

              {complete && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="border-2 border-black p-4 text-black shadow-[4px_4px_0_0_#000]"
                  style={{ background: grade(results.pct).color }}
                >
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-70">
                    Overall Grade
                  </p>
                  <p className="mt-1 text-2xl font-black leading-none">
                    {grade(results.pct).label}
                  </p>
                  <p className="mt-2 text-xs font-bold leading-relaxed">
                    {grade(results.pct).note}
                  </p>
                </motion.div>
              )}

              {cityScale && complete && (
                <div className="border-2 border-black bg-[#0B0F17] p-4">
                  <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#06B6D4]">
                    <Users className="size-3.5" strokeWidth={3} />
                    If your city scored like you
                  </p>
                  <p className="mt-3 text-2xl font-black leading-none tabular-nums text-[#F8FAFC]">
                    {cityScale.kgAvoided.toLocaleString()} kg
                  </p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[#64748B]">
                    CO2 avoided each year
                  </p>
                  <p className="mt-3 text-lg font-black leading-none tabular-nums text-[#10B981]">
                    {cityScale.commuters.toLocaleString()}
                  </p>
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[#64748B]">
                    commuters shifting off cars
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!complete || !isAuthenticated}
                  className="nb-btn w-full justify-center bg-[#10B981] py-2.5 text-[#04110C] disabled:cursor-not-allowed disabled:bg-[#1E293B] disabled:text-[#64748B]"
                >
                  <Sparkles className="size-4" strokeWidth={3} />
                  {isAuthenticated ? "Save Result" : "Sign In To Save"}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  className="nb-btn w-full justify-center bg-[#1E293B] py-2 text-[#CBD5E1]"
                >
                  <RotateCcw className="size-4" strokeWidth={3} />
                  Retake Quiz
                </button>
              </div>

              {savedAt && (
                <p className="nb-chip bg-[#10B981] text-[#04110C]">
                  Result saved
                </p>
              )}
              {user?.email && (
                <p className="text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                  Signed in as {user.email}
                </p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
