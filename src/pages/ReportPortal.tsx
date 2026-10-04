import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "@/lib/locationContext";
import {
  categoryByValue,
  categoriesInGroup,
  locationLabel,
  placeFromCensusState,
  REPORT_CATEGORIES,
  REPORT_GROUPS,
  REPORT_PLACES,
} from "@/lib/reportTaxonomy";
import { useAction, useMutation } from "convex/react";
import { motion } from "framer-motion";
import {
  ImagePlus,
  LocateFixed,
  Send,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { Lock } from "lucide-react";

/* --------------------------------------------------------------- config */

/* Categories and locations are NOT defined here — they come from
   `@/lib/reportTaxonomy`, which is also what the help bot reads. Defining them
   in this component is what let four invented district names and four
   one-size-only categories reach production unnoticed. */

const URGENCIES = ["Low", "Medium", "High"] as const;
type Urgency = (typeof URGENCIES)[number];

const URGENCY_ACTIVE: Record<Urgency, string> = {
  Low: "bg-[#06B6D4] text-[#03151A]",
  Medium: "bg-[#FBBF24] text-black",
  High: "bg-[#F43F5E] text-black",
};

/* ------------------------------------------------------------------ page */

export default function ReportPortal() {
  const { isAuthenticated } = useAuth();

  /**
   * Filing a report needs an account.
   *
   * `submitIssue` has always refused an anonymous caller, but the form did
   * not: a signed-out visitor could fill in every field, attach a photo and
   * press submit, and only found out at the end — after the browser had
   * already uploaded their image to storage for a ticket that was never going
   * to be created. That is a bad way to be told no, and it wasted their photo.
   *
   * So the form is not rendered at all without a session. `handleSubmit` still
   * checks, so a submit that arrives by any other route cannot reach the
   * upload either.
   */

  /** The shared fix. Only offered as a one-tap shortcut — never auto-selected,
   *  because a ticket silently stamped to the wrong state is worse than one
   *  extra tap. */
  const { state: locatedState, busy: locating } = useLocation();
  const detectedPlace = placeFromCensusState(locatedState);

  const getUploadUrl = useAction(api.admin.uploadUrl);
  const submitIssue = useMutation(api.admin.submitIssue);

  

  // Form state
  const [category, setCategory] = useState("");
  const [place, setPlace] = useState("");
  const [landmark, setLandmark] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<Urgency>("Medium");
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [success, setSuccess] = useState<{
    ticket: string;
    aiTag: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Revoke the previous object URL explicitly when a new file is picked, and
  // only clean up the live one on real unmount. Revoking inside an effect keyed
  // on `previewUrl` breaks the preview: StrictMode double-mounts, so the cleanup
  // runs while the <img> is still pointing at that URL and the image goes blank.
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const acceptFile = (file: File | undefined | null) => {
    if (!file) return;
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    const next =
      file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
    previewUrlRef.current = next;
    setFileName(file.name);
    setPreviewUrl(next);
    // Hold the real File so it can be uploaded on submit. The blob URL above
    // is only a local preview and is not what gets stored.
    setPendingFile(file.type.startsWith("image/") ? file : null);
  };

  /** Push the chosen photo into Convex file storage. */
  const uploadPhoto = async (file: File): Promise<string | undefined> => {
    const url = await getUploadUrl();
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!response.ok) {
      throw new Error(`Photo upload failed (${response.status})`);
    }
    const { storageId } = (await response.json()) as { storageId?: string };
    return storageId;
  };

  const clearForm = () => {
    setCategory("");
    setPlace("");
    setLandmark("");
    setDescription("");
    setUrgency("Medium");
    setFileName(null);
    setPreviewUrl(null);
    setPendingFile(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Defence in depth. The form below is not rendered without a session, so
    // this only fires if a submit reaches us some other way — and it has to be
    // above the upload, not below the mutation, or the photo goes to storage
    // before anything refuses it.
    if (!isAuthenticated) {
      setError("Sign in to submit a report.");
      return;
    }

    const match = categoryByValue(category);
    if (!match || !place || description.trim().length < 10) return;

    const aiTag = `[AI Priority Tag: ${urgency} - Routed to ${match.dept}]`;
    setSubmitting(true);
    try {
      // Upload the photo FIRST so the ticket never lands without it.
      let storageId: string | undefined;
      if (pendingFile) {
        try {
          storageId = await uploadPhoto(pendingFile);
        } catch (uploadError) {
          console.error("Photo upload failed:", uploadError);
          setError(
            "Your photo could not be uploaded, so the report was not filed. Please try again.",
          );
          setSubmitting(false);
          return;
        }
      }

      const result = await submitIssue({
        category: match.value,
        tag: match.tag,
        tagColor: match.color,
        district: locationLabel(place, landmark),
        description: description.trim(),
        urgency,
        aiTag,
        storageId,
      });
      setSuccess({ ticket: result.ticket, aiTag });
      setError(null);
      clearForm();
    } catch (err) {
      setSuccess(null);
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while filing the report. Please try again.",
      );
      console.error("Report submission failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-black uppercase tracking-tight text-[var(--nb-text)] md:text-3xl">
          Citizen Engagement &amp; Grievance Portal
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className="nb-chip bg-[var(--nb-surface-2)] text-[var(--nb-text-muted)]">
            Submitted Reports Are Reviewed Privately
          </span>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div
          className="nb-panel mt-5 border-l-[8px] border-l-[#F43F5E] p-4"
          role="alert"
        >
          <p className="text-xs font-black uppercase tracking-wide text-[#F43F5E]">
            Could Not File Report
          </p>
          <p className="mt-1 text-xs font-bold leading-relaxed text-[var(--nb-text-2)]">
            {error}
          </p>
        </div>
      )}

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
          <span className="text-lg font-black tabular-nums text-[var(--nb-text)]">
            Ticket {success.ticket}
          </span>
          <span className="nb-chip whitespace-normal bg-[#FBBF24] text-black">
            {success.aiTag}
          </span>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setSuccess(null)}
            className="ml-auto flex size-7 shrink-0 items-center justify-center border-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)] text-[var(--nb-text-2)] transition-transform hover:scale-105"
          >
            <X className="size-4" strokeWidth={3} />
          </button>
        </motion.div>
      )}

      <div className="mt-5 mx-auto grid max-w-3xl grid-cols-1 items-start gap-4">
        {/* ------------------------------------------------------ form */}
        {isAuthenticated ? (
        <form onSubmit={handleSubmit} className="nb-panel">
          <div className="nb-subpanel flex items-center justify-between gap-3 border-b-2 border-[var(--nb-ink)] p-4">
            <h2 className="nb-title text-sm">Report an Issue</h2>
            <span className="nb-chip bg-[var(--nb-surface-2)] text-[var(--nb-text-muted)]">
              Public Form
            </span>
          </div>

          <div className="flex flex-col gap-4 p-4">
            {/* Category */}
            <div>
              <label
                htmlFor="report-category"
                className="mb-2 block text-xs font-black uppercase tracking-wider text-[var(--nb-text-2)]"
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
                {REPORT_GROUPS.map((group) => (
                  <optgroup key={group} label={group}>
                    {categoriesInGroup(group).map((entry) => (
                      <option key={entry.value} value={entry.value}>
                        {entry.value}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--nb-text-dim)]">
                {REPORT_CATEGORIES.length} categories across{" "}
                {REPORT_GROUPS.length} departments
                {category && ` · routed to ${categoryByValue(category)?.dept}`}
              </p>
            </div>

            {/* Location — a real state or UT, plus an optional landmark */}
            <div>
              <label
                htmlFor="report-place"
                className="mb-2 block text-xs font-black uppercase tracking-wider text-[var(--nb-text-2)]"
              >
                State / Union Territory
              </label>
              <select
                id="report-place"
                className="nb-field"
                value={place}
                onChange={(event) => setPlace(event.target.value)}
                required
              >
                <option value="">Select your state…</option>
                {REPORT_PLACES.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>

              {/* Offered, never assumed — a ticket stamped to the wrong state is
                  worse than one extra tap. */}
              {detectedPlace && detectedPlace !== place && (
                <button
                  type="button"
                  onClick={() => setPlace(detectedPlace)}
                  className="nb-chip mt-2 bg-[#06B6D4] text-[#03151A]"
                >
                  <LocateFixed className="size-3.5" strokeWidth={3} />
                  {locating ? "Locating…" : `Use ${detectedPlace}`}
                </button>
              )}

              <input
                id="report-landmark"
                className="nb-field mt-2"
                value={landmark}
                onChange={(event) => setLandmark(event.target.value)}
                placeholder="Landmark, street or ward (optional)"
                maxLength={80}
                aria-label="Landmark, street or ward"
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="report-description"
                className="mb-2 block text-xs font-black uppercase tracking-wider text-[var(--nb-text-2)]"
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
              <span className="mb-2 block text-xs font-black uppercase tracking-wider text-[var(--nb-text-2)]">
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
                        : "bg-[var(--nb-field-bg)] text-[var(--nb-text-muted)] hover:bg-[var(--nb-surface-hover)] hover:text-[var(--nb-text-2)]",
                    ].join(" ")}
                  >
                    {level}
                  </button>
                ))}
              </div>
            </div>

            {/* Image dropzone */}
            <div>
              <span className="mb-2 block text-xs font-black uppercase tracking-wider text-[var(--nb-text-2)]">
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
                    : "border-[var(--nb-ink)] bg-[var(--nb-surface-2)] hover:bg-[var(--nb-surface-hover)]",
                ].join(" ")}
              >
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) => {
                    acceptFile(event.target.files?.[0]);
                    // Allow re-picking the same file after a clear.
                    event.target.value = "";
                  }}
                />
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt={fileName ? `Preview of ${fileName}` : "Upload preview"}
                    className="max-h-40 w-full border-2 border-[var(--nb-ink)] bg-[var(--nb-bg)] object-contain"
                  />
                ) : fileName ? (
                  <span className="nb-chip max-w-full bg-[#F8FAFC] text-black">
                    <span className="truncate">{fileName}</span>
                  </span>
                ) : (
                  <>
                    <ImagePlus
                      className="size-6 text-[var(--nb-text-muted)]"
                      strokeWidth={2.5}
                    />
                    <span className="text-xs font-black uppercase tracking-wide text-[var(--nb-text-2)]">
                      Drop image or click to upload
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--nb-text-dim)]">
                      JPG / PNG · shown as a live preview
                    </span>
                  </>
                )}
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="nb-btn mt-1 w-full bg-[#10B981] py-3 text-[#04110C] disabled:cursor-not-allowed disabled:bg-[var(--nb-surface-2)] disabled:text-[var(--nb-text-dim)]"
            >
              <Send className="size-4" strokeWidth={3} />
              {submitting ? "Submitting…" : "Submit Citizen Report"}
            </button>
          </div>
        </form>
        ) : (
          /* ----------------------------------------------------- locked */
          <div className="nb-panel">
            <div className="nb-subpanel flex items-center justify-between gap-3 border-b-2 border-[var(--nb-ink)] p-4">
              <h2 className="nb-title text-sm">Report an Issue</h2>
              <span className="nb-chip bg-[var(--nb-surface-2)] text-[var(--nb-text-muted)]">
                Sign In Required
              </span>
            </div>

            <div className="flex flex-col items-center gap-4 p-8 text-center">
              <span className="flex size-14 items-center justify-center border-2 border-[var(--nb-ink)] bg-[var(--nb-surface-2)]">
                <Lock className="size-7 text-[var(--nb-text-muted)]" strokeWidth={2.5} />
              </span>
              <p className="text-sm font-black uppercase tracking-wide text-[var(--nb-text)]">
                Only signed-in residents can file a report
              </p>
              <p className="max-w-md text-xs font-bold leading-relaxed text-[var(--nb-text-muted)]">
                A report has to be tied to an account so the department can
                follow it up, and so it can be tracked privately — reports are
                never shown on a public feed. Signing in takes about a minute
                and returns you straight to this page.
              </p>
              <Link
                to="/auth?returnTo=%2Freport"
                className="nb-btn bg-[#10B981] px-5 py-2.5 text-[#04110C]"
              >
                Sign In To File A Report
              </Link>
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--nb-text-dim)]">
                You can still browse every census table without an account
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
