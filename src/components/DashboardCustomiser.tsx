import { api } from "@/convex/_generated/api";
import {
  DEFAULT_PREFS,
  METRIC_CATALOGUE,
  isMetricId,
  type DashboardPrefs,
  type MetricId,
} from "@/lib/dashboardPreferences";
import { PLACES } from "@/lib/geo";
import { useMutation, useQuery } from "convex/react";
import { Check, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";

/**
 * The customise panel for the command centre.
 *
 * Opens from the dashboard header. Everything chosen here is stored per account
 * through `dashboard.myDashboard`, so it follows the resident to another device
 * or sign-in method, and every control has a value that already exists in the
 * Census tables — the state list is `PLACES` from `geo.ts`, the same list the
 * report portal and the help bot use, and the metrics are a fixed catalogue.
 * There is deliberately no free-text field here: nothing a resident types can
 * become a figure on the dashboard.
 */
export default function DashboardCustomiser({
  onClose,
  signedIn,
  signedInEmail,
}: {
  onClose: () => void;
  signedIn: boolean;
  signedInEmail: string;
}) {
  const saved = useQuery(api.dashboard.myDashboard);
  const save = useMutation(api.dashboard.saveDashboard);
  const reset = useMutation(api.dashboard.resetDashboard);

  // Local draft so the dashboard updates only on Save, not on every click.
  const [draft, setDraft] = useState<DashboardPrefs>(
    () => saved ?? { ...DEFAULT_PREFS },
  );
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const toggleMetric = (id: MetricId) => {
    setState("idle");
    setDraft((previous) => ({
      ...previous,
      metrics: previous.metrics.includes(id)
        ? previous.metrics.filter((m) => m !== id)
        : [...previous.metrics, id],
    }));
  };

  const onSave = async () => {
    setState("saving");
    try {
      // Only ids the catalogue still offers are sent; the server re-checks.
      await save({
        state: draft.state,
        metrics: draft.metrics.filter(isMetricId),
        showNational: draft.showNational,
      });
      setState("saved");
    } catch {
      setState("error");
    }
  };

  const onReset = async () => {
    setState("saving");
    try {
      await reset();
      setDraft({ ...DEFAULT_PREFS });
      setState("saved");
    } catch {
      setState("error");
    }
  };

  const groups = [...new Set(METRIC_CATALOGUE.map((m) => m.group))];

  return (
    <div className="nb-panel mt-4">
      <div className="nb-subpanel flex flex-wrap items-center gap-3 border-b-2 border-[var(--nb-ink)] p-4">
        <SlidersHorizontal className="size-4 text-[#10B981]" strokeWidth={3} />
        <h2 className="nb-title text-sm">Customise This Dashboard</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close customise panel"
          className="ml-auto flex size-7 items-center justify-center border-2 border-[var(--nb-ink)] bg-[var(--nb-surface)]"
        >
          <X className="size-3.5" strokeWidth={3} />
        </button>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {!signedIn && (
          <p className="border-2 border-dashed border-[var(--nb-ink)] bg-[var(--nb-surface-2)] p-3 text-xs font-bold leading-relaxed text-[var(--nb-text-2)]">
            Sign in to save a layout. Until then you can still pick what to look
            at — it just will not be remembered.
          </p>
        )}
        {signedIn && (
          <p className="text-[11px] font-bold text-[var(--nb-text-dim)]">
            Saved to {signedInEmail}
          </p>
        )}

        {/* Which state the cards are about */}
        <div>
          <label
            htmlFor="dash-state"
            className="mb-2 block text-xs font-black uppercase tracking-wider text-[var(--nb-text-2)]"
          >
            Show these figures for
          </label>
          <select
            id="dash-state"
            className="nb-field"
            value={draft.state ?? ""}
            onChange={(event) => {
              setState("idle");
              setDraft((previous) => ({
                ...previous,
                // Empty means "follow my location", which is the default.
                state: event.target.value === "" ? null : event.target.value,
              }));
            }}
          >
            <option value="">My located state (or India)</option>
            {PLACES.map((place) => (
              <option key={place} value={place}>
                {place}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[10px] font-bold text-[var(--nb-text-dim)]">
            Every name here is a real 2011 Census unit. Pick one and the cards
            below switch to it.
          </p>
        </div>

        {/* Which readings matter */}
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-wider text-[var(--nb-text-2)]">
            Which readings to show
          </p>
          <div className="flex flex-col gap-3">
            {groups.map((group) => (
              <div key={group}>
                <p className="mb-1.5 text-[10px] font-black uppercase tracking-widest text-[var(--nb-text-dim)]">
                  {group}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {METRIC_CATALOGUE.filter((m) => m.group === group).map((m) => {
                    const on = draft.metrics.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleMetric(m.id)}
                        aria-pressed={on}
                        title={m.unit}
                        className={`nb-chip ${on ? "bg-[#10B981] text-[#04110C]" : "bg-[var(--nb-surface-2)] text-[var(--nb-text-2)]"}`}
                      >
                        {on && <Check className="size-3" strokeWidth={4} />}
                        {m.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {draft.metrics.length === 0 && (
            <p className="mt-2 text-[11px] font-bold text-[#F43F5E]">
              Pick at least one reading, or there will be nothing to show.
            </p>
          )}
        </div>

        {/* Keep the India-wide cards? */}
        <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-[var(--nb-text-2)]">
          <input
            type="checkbox"
            checked={draft.showNational}
            onChange={(event) => {
              setState("idle");
              setDraft((previous) => ({
                ...previous,
                showNational: event.target.checked,
              }));
            }}
            className="size-4 accent-[#10B981]"
          />
          Keep the India-wide cards above
        </label>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 border-t-2 border-[var(--nb-ink)] pt-3">
          <button
            type="button"
            onClick={() => void onSave()}
            disabled={draft.metrics.length === 0 || state === "saving"}
            className="nb-btn bg-[#10B981] text-[#04110C] disabled:opacity-40"
          >
            {state === "saving" ? "Saving…" : "Save Layout"}
          </button>
          <button
            type="button"
            onClick={() => void onReset()}
            disabled={state === "saving"}
            className="nb-btn bg-[var(--nb-surface-2)] text-[var(--nb-text-2)] disabled:opacity-40"
          >
            <RotateCcw className="size-3.5" strokeWidth={3} />
            Reset
          </button>
          {state === "saved" && (
            <span className="text-[11px] font-black uppercase tracking-wide text-[#10B981]">
              Saved
            </span>
          )}
          {state === "error" && (
            <span className="text-[11px] font-black uppercase tracking-wide text-[#F43F5E]">
              Could not save — are you signed in?
            </span>
          )}
        </div>
      </div>
    </div>
  );
}