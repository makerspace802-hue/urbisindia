import { motion } from "framer-motion";
import { ChevronUp, ImagePlus, Send, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

/* --------------------------------------------------------------- config */

const CATEGORIES = [
  {
    value: "Extreme Heat / Unshaded Stop",
    tag: "Heat/Shade",
    dept: "Parks & Transport Dept",
    color: "#F43F5E",
  },
  {
    value: "Pothole / Bike Lane Hazard",
    tag: "Bike Lane",
    dept: "Roads & Mobility Dept",
    color: "#06B6D4",
  },
  {
    value: "Overcrowded Transit Hub",
    tag: "Transit Hub",
    dept: "Transit Operations Dept",
    color: "#FBBF24",
  },
  {
    value: "Request Tree Planting",
    tag: "Tree Planting",
    dept: "Parks & Forestry Dept",
    color: "#10B981",
  },
];

const DISTRICTS = [
  "Financial District",
  "North Suburban Hub",
  "Industrial Zone 4",
  "West Tech Corridor",
];

const URGENCIES = ["Low", "Medium", "High"] as const;
type Urgency = (typeof URGENCIES)[number];

const URGENCY_ACTIVE: Record<Urgency, string> = {
  Low: "bg-[#06B6D4] text-[#03151A]",
  Medium: "bg-[#FBBF24] text-black",
  High: "bg-[#F43F5E] text-black",
};

const STATUS_COLORS: Record<CitizenReport["status"], string> = {
  New: "#06B6D4",
  "In Progress": "#FBBF24",
  Resolved: "#10B981",
};

/* ----------------------------------------------------------- data types */

interface CitizenReport {
  id: string;
  ticket: string;
  category: string;
  tag: string;
  tagColor: string;
  district: string;
  description: string;
  urgency: Urgency;
  status: "New" | "In Progress" | "Resolved";
  upvotes: number;
  createdAt: number;
  aiTag: string;
}

const SEED_REPORTS: CitizenReport[] = [
  {
    id: "seed-8812",
    ticket: "#URB-8812",
    category: "Extreme Heat / Unshaded Stop",
    tag: "Heat/Shade",
    tagColor: "#F43F5E",
    district: "Financial District",
    description:
      "Unshaded Bus Stop on 5th Ave during 40°C heat wave",
    urgency: "High",
    status: "In Progress",
    upvotes: 42,
    createdAt: Date.now() - 3 * 60 * 60 * 1000,
    aiTag: "[AI Priority Tag: High - Routed to Parks & Transport Dept]",
  },
  {
    id: "seed-8790",
    ticket: "#URB-8790",
    category: "Pothole / Bike Lane Hazard",
    tag: "Bike Lane",
    tagColor: "#06B6D4",
    district: "West Tech Corridor",
    description:
      "Debris blocking Commuter E-Bike Corridor near Metro Exit",
    urgency: "Medium",
    status: "Resolved",
    upvotes: 18,
    createdAt: Date.now() - 26 * 60 * 60 * 1000,
    aiTag: "[AI Priority Tag: Medium - Routed to Roads & Mobility Dept]",
  },
];

function timeAgo(timestamp: number): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/* ------------------------------------------------------------------ page */

export default function ReportPortal() {
  const [reports, setReports] = useState<CitizenReport[]>(SEED_REPORTS);
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set());

  // Form state
  const [category, setCategory] = useState("");
  const [district, setDistrict] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("Medium");
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [success, setSuccess] = useState<{
    ticket: string;
    aiTag: string;
  } | null>(null);

  const nextTicket = useRef(8942);

  // Revoke object URLs when the preview changes or the page unmounts.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const acceptFile = (file: File | undefined | null) => {
    if (!file) return;
    setFileName(file.name);
    setPreviewUrl(
      file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
    );
  };

  const clearForm = () => {
    setCategory("");
    setDistrict("");
    setDescription("");
    setUrgency("Medium");
    setFileName(null);
    setPreviewUrl(null);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const match = CATEGORIES.find((entry) => entry.value === category);
    if (!match || !district || description.trim().length < 10) return;

    const ticket = `#URB-${nextTicket.current}`;
    nextTicket.current += 1;
    const aiTag = `[AI Priority Tag: ${urgency} - Routed to ${match.dept}]`;

    const report: CitizenReport = {
      id: ticket,
      ticket,
      category: match.value,
      tag: match.tag,
      tagColor: match.color,
      district,
      description: description.trim(),
      urgency,
      status: "New",
      upvotes: 0,
      createdAt: Date.now(),
      aiTag,
    };

    setReports((previous) => [report, ...previous]);
    setSuccess({ ticket, aiTag });
    clearForm();
  };

  const handleUpvote = (id: string) => {
    setReports((previous) =>
      previous.map((report) =>
        report.id === id
          ? { ...report, upvotes: report.upvotes + 1 }
          : report,
      ),
    );
    setUpvotedIds((previous) => {
      const next = new Set(previous);
      next.add(id);
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-black uppercase tracking-tight text-[#F8FAFC] md:text-3xl">
          Citizen Engagement &amp; Grievance Portal
        </h1>
        <span className="nb-chip bg-[#1E293B] text-[#06B6D4]">
          {reports.length} Tickets Live
        </span>
      </div>

      {/* Success alert */}
      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="nb-panel mt-5 flex flex-wrap items-center gap-x-4 gap-y-3 border-l-[8px] border-l-[#10B981] p-4"
          role="status"
        >
          <span className="nb-chip bg-[#10B981] text-[#04110C]">
            Report Received
          </span>
          <span className="text-lg font-black tabular-nums text-[#F8FAFC]">
            Ticket {success.ticket}
          </span>
          <span className="nb-chip whitespace-normal bg-[#FBBF24] text-black">
            {success.aiTag}
          </span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setSuccess(null)}
            className="ml-auto flex size-7 shrink-0 items-center justify-center border-2 border-black bg-[#1E293B] text-[#E2E8F0] transition-transform hover:scale-105"
          >
            <X className="size-4" strokeWidth={3} />
          </button>
        </motion.div>
      )}

      <div className="mt-5 grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
        {/* ------------------------------------------------------ form */}
        <form onSubmit={handleSubmit} className="nb-panel">
          <div className="flex items-center justify-between gap-3 border-b-2 border-black bg-[#111827] p-4">
            <h2 className="nb-title text-sm">Report an Issue</h2>
            <span className="nb-chip bg-[#1E293B] text-[#94A3B8]">
              Public Form
            </span>
          </div>

          <div className="flex flex-col gap-4 p-4">
            {/* Category */}
            <div>
              <label
                htmlFor="report-category"
                className="mb-2 block text-xs font-black uppercase tracking-wider text-[#CBD5E1]"
              >
                Report Category
              </label>
              <select
                id="report-category"
                className="nb-field"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                required
              >
                <option value="">Select category…</option>
                {CATEGORIES.map((entry) => (
                  <option key={entry.value} value={entry.value}>
                    {entry.value}
                  </option>
                ))}
              </select>
            </div>

            {/* District */}
            <div>
              <label
                htmlFor="report-district"
                className="mb-2 block text-xs font-black uppercase tracking-wider text-[#CBD5E1]"
              >
                Location / District
              </label>
              <select
                id="report-district"
                className="nb-field"
                value={district}
                onChange={(event) => setDistrict(event.target.value)}
                required
              >
                <option value="">Select district…</option>
                {DISTRICTS.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="report-description"
                className="mb-2 block text-xs font-black uppercase tracking-wider text-[#CBD5E1]"
              >
                Issue Description
              </label>
              <textarea
                id="report-description"
                className="nb-field min-h-28 resize-y"
                placeholder="Describe the issue, exact location, and who is affected…"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
                minLength={10}
              />
            </div>

            {/* Urgency */}
            <div>
              <span className="mb-2 block text-xs font-black uppercase tracking-wider text-[#CBD5E1]">
                Urgency Level
              </span>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Urgency Level">
                {URGENCIES.map((level) => (
                  <button
                    key={level}
                    type="button"
                    role="radio"
                    aria-checked={urgency === level}
                    onClick={() => setUrgency(level)}
                    className={[
                      "nb-chip px-4 py-2 transition-colors",
                      urgency === level
                        ? URGENCY_ACTIVE[level]
                        : "bg-[#0B0F17] text-[#94A3B8] hover:bg-[#334155] hover:text-[#E2E8F0]",
                    ].join(" ")}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Image dropzone */}
            <div>
              <span className="mb-2 block text-xs font-black uppercase tracking-wider text-[#CBD5E1]">
                Image Evidence
              </span>
              <label
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  acceptFile(event.dataTransfer.files?.[0]);
                }}
                className={[
                  "flex cursor-pointer flex-col items-center justify-center gap-2 border-2 border-dashed p-5 text-center transition-colors",
                  dragging
                    ? "border-[#10B981] bg-[#10B981]/10"
                    : "border-black bg-[#111827] hover:bg-[#334155]",
                ].join(" ")}
              >
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => acceptFile(event.target.files?.[0])}
                />
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Upload preview"
                    className="h-28 w-full border-2 border-black object-cover"
                  />
                ) : fileName ? (
                  <span className="nb-chip max-w-full bg-[#F8FAFC] text-black">
                    <span className="truncate">{fileName}</span>
                  </span>
                ) : (
                  <>
                    <ImagePlus className="size-6 text-[#94A3B8]" strokeWidth={2.5} />
                    <span className="text-xs font-black uppercase tracking-wide text-[#94A3B8]">
                      Drop image or click to upload
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[#64748B]">
                      JPG / PNG · preview simulated
                    </span>
                  </>
                )}
              </label>
            </div>

            <button
              type="submit"
              className="nb-btn mt-1 w-full bg-[#10B981] py-3 text-[#04110C]"
            >
              <Send className="size-4" strokeWidth={3} />
              Submit Citizen Report
            </button>
          </div>
        </form>

        {/* ------------------------------------------------------ feed */}
        <section className="nb-panel">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black bg-[#111827] p-4">
            <h2 className="nb-title text-xs leading-snug md:text-sm">
              Community Public Live Feed &amp; Status Tracker
            </h2>
            <span className="nb-chip bg-[#1E293B] text-[#06B6D4]">
              <span className="size-2 animate-pulse bg-[#06B6D4]" />
              Live
            </span>
          </div>

          <div className="flex flex-col gap-3 p-4">
            {reports.map((report) => (
              <motion.article
                key={report.id}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22 }}
                className="nb-panel p-4 transition-transform duration-150 hover:scale-[1.01]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="nb-chip bg-[#F8FAFC] text-black">
                    {report.ticket}
                  </span>
                  <span
                    className="nb-chip"
                    style={{
                      background: STATUS_COLORS[report.status],
                      color: "#000000",
                    }}
                  >
                    {report.status}
                  </span>
                  <span
                    className="nb-chip"
                    style={{ background: report.tagColor, color: "#000000" }}
                  >
                    {report.tag}
                  </span>
                  <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-[#64748B]">
                    {timeAgo(report.createdAt)}
                  </span>
                </div>

                <p className="mt-3 text-sm font-semibold leading-relaxed text-[#E2E8F0]">
                  {report.description}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t-2 border-black pt-3">
                  <span className="text-[11px] font-bold uppercase tracking-wide text-[#94A3B8]">
                    {report.district}
                  </span>
                  <span className="border-2 border-black bg-[#111827] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#CBD5E1]">
                    {report.urgency} Priority
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUpvote(report.id)}
                    aria-label={`Upvote ${report.ticket}`}
                    className={[
                      "nb-btn ml-auto px-3 py-1.5 text-xs tabular-nums",
                      upvotedIds.has(report.id)
                        ? "bg-[#10B981] text-[#04110C]"
                        : "bg-[#1E293B] text-[#E2E8F0]",
                    ].join(" ")}
                  >
                    <ChevronUp className="size-4" strokeWidth={3} />
                    {report.upvotes}
                  </button>
                </div>
              </motion.article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
