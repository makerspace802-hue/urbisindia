import { api } from "@/convex/_generated/api";
import { useMutation, useQuery } from "convex/react";
import { Check, ChevronUp, ShieldAlert, Trash2, Wrench, X } from "lucide-react";
import { useState } from "react";

/**
 * Private admin desk for reviewing and resolving citizen reports.
 *
 * This used to live on the public report portal, where every visitor could see
 * the whole feed and an admin could resolve tickets in the open. Reports are
 * complaints about named places with photos attached, so both halves are now
 * admin-only and reachable only from the profile page.
 *
 * Two independent gates guard it, because the component is only ever rendered
 * inside an `isAdmin` branch but that is a UI decision, not an access control:
 *
 *   1. The parent renders this only when `isAdmin` resolves true.
 *   2. `listAllIssues` itself calls `requireAdminEmail`, so even if this ever
 *      rendered for a non-admin the query would throw and return nothing.
 *
 * The resolve mutation is gated server-side too. Nothing here trusts the client
 * to decide who is allowed to close a ticket.
 */

interface Ticket {
  ticket: string;
  category: string;
  tag: string;
  tagColor: string;
  district: string;
  description: string;
  urgency: string;
  status: "New" | "In Progress" | "On Review" | "Resolved";
  upvotes: number;
  createdAt: number;
  aiTag: string;
  reporterEmail: string;
  storageId?: string | null;
  resolution?: string;
  resolvedAt?: number;
}

const STATUS_COLORS: Record<Ticket["status"], string> = {
  New: "#06B6D4",
  "In Progress": "#FBBF24",
  "On Review": "#A78BFA",
  Resolved: "#10B981",
};

function timeAgo(timestamp: number): string {
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function AdminTicketDesk() {
  const tickets = useQuery(api.admin.listAllIssues);
  const imageUrls = useQuery(api.admin.adminImageUrls) ?? {};
  const resolveIssue = useMutation(api.admin.resolveIssue);
  const upvoteIssue = useMutation(api.admin.upvoteIssue);
  const purgeAllIssues = useMutation(api.admin.purgeAllIssues);
  const purgeOtherAdmins = useMutation(api.identity.purgeOtherAdmins);
  const [purgingAdmins, setPurgingAdmins] = useState(false);
  const [adminNote, setAdminNote] = useState<string | null>(null);

  const handlePurgeAdmins = async () => {
    setPurgingAdmins(true);
    setAdminNote(null);
    try {
      const result = await purgeOtherAdmins();
      setAdminNote(
        `Removed ${result.removedGrants.length} extra grant(s) and cleared ` +
          `${result.clearedRoles} legacy role flag(s). Sole admin: ` +
          result.admins.join(", "),
      );
    } catch (error) {
      setAdminNote(
        error instanceof Error ? error.message : "Could not purge other admins",
      );
    } finally {
      setPurgingAdmins(false);
    }
  };

  const [filter, setFilter] = useState<"open" | "all">("open");
  const [resolvingTicket, setResolvingTicket] = useState<string | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [confirmingPurge, setConfirmingPurge] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeError, setPurgeError] = useState<string | null>(null);

  const handlePurge = async () => {
    setPurging(true);
    setPurgeError(null);
    try {
      await purgeAllIssues();
      setConfirmingPurge(false);
    } catch (error) {
      setPurgeError(error instanceof Error ? error.message : "Could not delete the reports");
    } finally {
      setPurging(false);
    }
  };

  const all: Ticket[] = tickets ?? [];
  const visible = filter === "open" ? all.filter((t) => t.status !== "Resolved") : all;

  const handleResolve = async (ticket: string) => {
    if (resolutionNote.trim().length < 4) return;
    try {
      await resolveIssue({ ticket, resolution: resolutionNote.trim() });
      setResolvingTicket(null);
      setResolutionNote("");
    } catch (error) {
      console.error("Resolve failed:", error);
    }
  };

  return (
    <section className="nb-panel">
      <div className="nb-subpanel flex flex-wrap items-center gap-3 border-b-2 border-[var(--nb-ink)] p-4">
        <ShieldAlert className="size-4 text-[#F43F5E]" strokeWidth={3} />
        <h2 className="nb-title text-sm">Admin Ticket Desk</h2>
        <span className="nb-chip bg-[#F43F5E] text-black">
          {all.filter((t) => t.status !== "Resolved").length} Open
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilter("open")}
            className={`nb-chip ${filter === "open" ? "bg-[#10B981] text-[#04110C]" : "bg-[var(--nb-surface-2)] text-[var(--nb-text-2)]"}`}
          >
            Open
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`nb-chip ${filter === "all" ? "bg-[#10B981] text-[#04110C]" : "bg-[var(--nb-surface-2)] text-[var(--nb-text-2)]"}`}
          >
            All
          </button>
          {all.length > 0 && !confirmingPurge && (
            <button
              type="button"
              onClick={() => setConfirmingPurge(true)}
              title="Delete every filed report"
              className="nb-chip bg-[var(--nb-surface-2)] text-[#F43F5E]"
            >
              <Trash2 className="size-3.5" strokeWidth={3} />
              Clear All
            </button>
          )}
          <button
            type="button"
            onClick={() => void handlePurgeAdmins()}
            disabled={purgingAdmins}
            title="Remove every admin grant except yours, and clear legacy role flags"
            className="nb-chip bg-[var(--nb-surface-2)] text-[var(--nb-text-2)] disabled:opacity-50"
          >
            <ShieldAlert className="size-3.5" strokeWidth={3} />
            {purgingAdmins ? "Working…" : "Sole Admin"}
          </button>
        </div>

      {adminNote && (
        <p className="border-b-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)] p-3 text-xs font-bold leading-relaxed text-[var(--nb-text-2)]">
          {adminNote}
        </p>
      )}
      </div>

      {/* Two-step confirmation, because this cannot be undone. The stored blob
          for every attached photo is removed with the rows, so a cleared
          report leaves nothing behind to recover. */}
      {confirmingPurge && (
        <div className="flex flex-wrap items-center gap-2 border-b-2 border-[var(--nb-ink)] bg-[#F43F5E] p-3">
          <span className="text-xs font-black uppercase tracking-wide text-black">
            Delete all {all.length} reports permanently?
          </span>
          <button
            type="button"
            onClick={() => void handlePurge()}
            disabled={purging}
            className="nb-chip ml-auto bg-black text-[#F43F5E] disabled:opacity-50"
          >
            {purging ? "Deleting…" : "Yes, Delete Everything"}
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmingPurge(false);
              setPurgeError(null);
            }}
            disabled={purging}
            className="nb-chip bg-black text-white disabled:opacity-50"
          >
            <X className="size-3.5" strokeWidth={3} />
            Cancel
          </button>
          {purgeError && (
            <p className="w-full text-xs font-bold text-black">{purgeError}</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 p-4">
        {visible.length === 0 ? (
          <p className="border-2 border-dashed border-[var(--nb-ink)] bg-[var(--nb-surface-2)] p-6 text-center text-xs font-bold uppercase tracking-wide text-[var(--nb-text-dim)]">
            {filter === "open"
              ? "No open tickets. Everything has been resolved."
              : "No reports have been filed yet."}
          </p>
        ) : (
          visible.map((report) => (
            <article key={report.ticket} className="border-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="nb-chip bg-[#F8FAFC] text-black">{report.ticket}</span>
                <span className="nb-chip" style={{ background: STATUS_COLORS[report.status], color: "#000" }}>
                  {report.status}
                </span>
                <span className="nb-chip" style={{ background: report.tagColor, color: "#000" }}>
                  {report.tag}
                </span>
                <span className="ml-auto text-[10px] font-black uppercase tracking-widest text-[var(--nb-text-dim)]">
                  {timeAgo(report.createdAt)}
                </span>
              </div>

              <p className="mt-2 text-sm font-semibold leading-relaxed text-[var(--nb-text-2)]">
                {report.description}
              </p>

              {report.storageId && imageUrls[report.storageId] && (
                <a
                  href={imageUrls[report.storageId]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block border-2 border-[var(--nb-ink)]"
                >
                  <img
                    src={imageUrls[report.storageId]}
                    alt={`Photo attached to ${report.ticket}`}
                    loading="lazy"
                    className="max-h-56 w-full bg-[var(--nb-bg)] object-cover"
                  />
                </a>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 border-t-2 border-[var(--nb-ink)] pt-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--nb-text-muted)]">
                  {report.district}
                </span>
                <span className="border-2 border-[var(--nb-ink)] bg-[var(--nb-surface)] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[var(--nb-text-2)]">
                  {report.urgency} Priority
                </span>
                {/* The reporter's own address. Only an admin ever sees this. */}
                <span className="text-[10px] font-bold text-[var(--nb-text-dim)]">
                  {report.reporterEmail}
                </span>
                <button
                  type="button"
                  onClick={() => void upvoteIssue({ ticket: report.ticket })}
                  aria-label={`Upvote ${report.ticket}`}
                  className="nb-btn ml-auto px-2.5 py-1 text-xs tabular-nums bg-[var(--nb-surface)] text-[var(--nb-text-2)]"
                >
                  <ChevronUp className="size-3.5" strokeWidth={3} />
                  {report.upvotes}
                </button>
              </div>

              {report.resolution && (
                <div className="mt-2 flex flex-wrap items-center gap-2 border-2 border-[var(--nb-ink)] bg-[#10B981] p-2">
                  <Check className="size-4 shrink-0 text-[#04110C]" strokeWidth={4} />
                  <span className="text-xs font-bold leading-relaxed text-[#04110C]">
                    {report.resolution}
                  </span>
                </div>
              )}

              {report.status !== "Resolved" && (
                <div className="mt-2 border-t-2 border-[var(--nb-ink)] pt-2">
                  {resolvingTicket === report.ticket ? (
                    <div className="flex flex-col gap-2">
                      <input
                        className="nb-field"
                        value={resolutionNote}
                        onChange={(event) => setResolutionNote(event.target.value)}
                        placeholder="Describe the resolution…"
                        aria-label={`Resolution for ${report.ticket}`}
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => void handleResolve(report.ticket)}
                          className="nb-btn flex-1 justify-center bg-[#10B981] py-2 text-[#04110C]"
                        >
                          <Check className="size-4" strokeWidth={3} />
                          Confirm Resolve
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setResolvingTicket(null);
                            setResolutionNote("");
                          }}
                          className="nb-btn justify-center bg-[var(--nb-surface)] px-3 py-2 text-[var(--nb-text-2)]"
                        >
                          <X className="size-4" strokeWidth={3} />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setResolvingTicket(report.ticket)}
                      className="nb-btn w-full justify-center bg-[#F43F5E] py-2 text-black"
                    >
                      <Wrench className="size-4" strokeWidth={3} />
                      Resolve Ticket
                    </button>
                  )}
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </section>
  );
}