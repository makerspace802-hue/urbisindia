/** Square, heavy-bordered range slider with a live value readout. */
export function NbSlider({
  label,
  value,
  min,
  max,
  step = 1,
  fill,
  displayValue,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Solid color for the filled portion of the track. */
  fill: string;
  displayValue: string;
  onChange: (value: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label className="text-xs font-black uppercase tracking-wider text-[#CBD5E1]">
          {label}
        </label>
        <span className="nb-chip bg-[#F8FAFC] text-black tabular-nums">
          {displayValue}
        </span>
      </div>
      <div className="mt-3 px-3">
        <div className="relative h-6">
          <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 border-2 border-black bg-[#0B0F17]" />
          <div
            className="absolute left-0 top-1/2 h-3 -translate-y-1/2 border-2 border-black"
            style={{ width: `${pct}%`, background: fill }}
          />
          <div
            className="absolute top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 border-2 border-black bg-[#F8FAFC] shadow-[2px_2px_0_0_#000]"
            style={{ left: `${pct}%` }}
          />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            aria-label={label}
            onChange={(event) => onChange(Number(event.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
      </div>
    </div>
  );
}

/** Square block toggle switch. */
export function NbSwitch({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-xs font-black uppercase tracking-wider text-[#CBD5E1]">
        {label}
      </span>
      <div className="flex items-center gap-3">
        <span
          className={[
            "nb-chip",
            checked ? "bg-[#10B981] text-[#04110C]" : "bg-[#0B0F17] text-[#94A3B8]",
          ].join(" ")}
        >
          {checked ? "On" : "Off"}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          aria-label={label}
          onClick={() => onChange(!checked)}
          className={[
            "relative h-7 w-14 border-2 border-black shadow-[3px_3px_0_0_#000] transition-colors",
            checked ? "bg-[#10B981]" : "bg-[#111827]",
          ].join(" ")}
        >
          <span
            className={[
              "absolute top-0.5 size-5 border-2 border-black bg-[#F8FAFC] transition-all duration-150",
              checked ? "left-[calc(100%-1.375rem)]" : "left-0.5",
            ].join(" ")}
          />
        </button>
      </div>
    </div>
  );
}
