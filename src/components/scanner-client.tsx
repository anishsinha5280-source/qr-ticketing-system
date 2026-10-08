"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";

import { Icon } from "@/components/icons";
import { Alert, Badge, Card, Spinner } from "@/components/ui";
import { apiFetch, ApiClientError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import type { VerifyTicketResponse } from "@/lib/types";

type ScanHistoryItem = VerifyTicketResponse & { at: string; method: "QR_SCAN" | "MANUAL" };

type CameraState = "idle" | "starting" | "running" | "denied" | "unavailable" | "error";

const HINTS = new Map<DecodeHintType, unknown>([
  [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]],
  [DecodeHintType.TRY_HARDER, true],
]);

export function ScannerClient({
  events,
  defaultEventId,
}: {
  events: { id: string; title: string; startsAt: string }[];
  defaultEventId?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const busyRef = useRef(false);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const startCameraRef = useRef<() => Promise<void>>(async () => {});

  const [camera, setCamera] = useState<CameraState>("idle");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState(defaultEventId ?? "");
  const [result, setResult] = useState<VerifyTicketResponse | null>(null);
  const [history, setHistory] = useState<ScanHistoryItem[]>([]);
  const [verifying, setVerifying] = useState(false);
  const [manualToken, setManualToken] = useState("");
  const [manualOpen, setManualOpen] = useState(false);

  /* --------------------------------------------------------------- */
  /* Verification (backend decides everything)                        */
  /* --------------------------------------------------------------- */

  const verifyToken = useCallback(
    async (token: string, method: "QR_SCAN" | "MANUAL") => {
      if (busyRef.current) return;
      const cleaned = token.trim();
      if (!cleaned) return;
      busyRef.current = true;
      setVerifying(true);
      setResult(null);

      try {
        const data = await apiFetch<VerifyTicketResponse>("/api/organizer/verify-ticket", {
          method: "POST",
          body: { token: cleaned, eventId: selectedEventId || undefined, method },
        });
        setResult(data);
        setHistory((prev) => [{ ...data, at: new Date().toISOString(), method }, ...prev].slice(0, 8));
        if (data.result === "SUCCESS" && typeof navigator !== "undefined" && navigator.vibrate) {
          navigator.vibrate(120);
        }
      } catch (err) {
        const message =
          err instanceof ApiClientError ? err.message : "Verification request failed";
        const failure: VerifyTicketResponse = {
          result: "INVALID",
          headline: "INVALID TICKET",
          message,
        };
        setResult(failure);
        setHistory((prev) =>
          [{ ...failure, at: new Date().toISOString(), method }, ...prev].slice(0, 8),
        );
      } finally {
        setVerifying(false);
        busyRef.current = false;
      }
    },
    [selectedEventId],
  );

  /* --------------------------------------------------------------- */
  /* Camera lifecycle                                                 */
  /* --------------------------------------------------------------- */

  const stopCamera = useCallback(() => {
    try {
      controlsRef.current?.stop();
    } catch {
      /* noop */
    }
    controlsRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamera("idle");
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setCamera("starting");
    setResult(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera("unavailable");
      setCameraError(
        "This browser does not expose a camera API. Use HTTPS (or localhost) and a modern browser, or use manual token entry below.",
      );
      return;
    }

    try {
      if (!readerRef.current) readerRef.current = new BrowserMultiFormatReader(HINTS);
      const video = videoRef.current;
      if (!video) throw new Error("video element missing");

      const controls = await readerRef.current.decodeFromVideoDevice(
        undefined,
        video,
        (scanResult, _error, scanControls) => {
          const text = scanResult?.getText();
          if (!text) return;
          // Freeze the stream while the backend verifies this token.
          busyRef.current = true;
          scanControls.stop();
          setVerifying(true);
          void (async () => {
            await verifyToken(text, "QR_SCAN");
            busyRef.current = false;
            // Auto-resume for the next attendee after a short pause.
            window.setTimeout(() => {
              void startCameraRef.current();
            }, 2500);
          })();
        },
      );

      controlsRef.current = controls;
      setCamera("running");
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setCamera("denied");
        setCameraError(
          "Camera permission was blocked. Allow camera access for this site in your browser settings, then try again — or paste a token manually.",
        );
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setCamera("unavailable");
        setCameraError("No camera was found on this device. Use manual token entry instead.");
      } else {
        setCamera("error");
        setCameraError(
          err instanceof Error ? `Could not start the camera: ${err.message}` : "Could not start the camera",
        );
      }
    }
  }, [verifyToken]);

  // Keep a stable reference so the decode callback can restart the stream.
  useEffect(() => {
    startCameraRef.current = startCamera;
  }, [startCamera]);

  useEffect(() => {
    return () => {
      try {
        controlsRef.current?.stop();
      } catch {
        /* noop */
      }
    };
  }, []);

  /* --------------------------------------------------------------- */
  /* Render                                                           */
  /* --------------------------------------------------------------- */

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-4">
        <Card className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">
                Gate event filter
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                Tokens for other events are rejected as invalid.
              </p>
            </div>
            <select
              className="input max-w-xs"
              value={selectedEventId}
              onChange={(e) => setSelectedEventId(e.target.value)}
              aria-label="Restrict scanning to an event"
            >
              <option value="">Any of my events</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </div>
        </Card>

        {/* Viewfinder */}
        <Card className="overflow-hidden p-0">
          <div className="relative aspect-[4/3] w-full bg-slate-950 sm:aspect-video">
            <video
              ref={videoRef}
              muted
              playsInline
              className={`h-full w-full object-cover ${camera === "running" ? "opacity-100" : "opacity-0"}`}
            />

            {/* Framing overlay */}
            {camera === "running" && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="relative h-56 w-56 sm:h-64 sm:w-64">
                  <span className="absolute -left-1 -top-1 h-10 w-10 rounded-tl-xl border-l-4 border-t-4 border-cyan-400" />
                  <span className="absolute -right-1 -top-1 h-10 w-10 rounded-tr-xl border-r-4 border-t-4 border-cyan-400" />
                  <span className="absolute -bottom-1 -left-1 h-10 w-10 rounded-bl-xl border-b-4 border-l-4 border-cyan-400" />
                  <span className="absolute -bottom-1 -right-1 h-10 w-10 rounded-br-xl border-b-4 border-r-4 border-cyan-400" />
                  <span className="scanline absolute inset-x-2 top-1/2 h-0.5 rounded-full bg-cyan-400/80 shadow-[0_0_12px_2px_rgba(34,211,238,0.6)]" />
                </div>
              </div>
            )}

            {camera !== "running" && (
              <div className="absolute inset-0 grid place-items-center px-6 text-center">
                {camera === "starting" ? (
                  <div className="space-y-3 text-slate-400">
                    <Spinner className="mx-auto h-7 w-7" />
                    <p className="text-sm">Requesting camera access…</p>
                  </div>
                ) : camera === "idle" ? (
                  <div className="space-y-4">
                    <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-500">
                      <Icon name="camera" className="h-7 w-7" />
                    </span>
                    <p className="text-sm text-slate-400">
                      Point the camera at an attendee&apos;s QR ticket.
                    </p>
                    <button type="button" className="btn-primary" onClick={() => void startCamera()}>
                      <Icon name="scan" className="h-4 w-4" />
                      Start camera
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-rose-800/50 bg-rose-950/40 text-rose-300">
                      <Icon name="alert" className="h-7 w-7" />
                    </span>
                    <p className="max-w-sm text-sm text-slate-300">{cameraError}</p>
                    <button type="button" className="btn-secondary" onClick={() => void startCamera()}>
                      Try again
                    </button>
                  </div>
                )}
              </div>
            )}

            {verifying && (
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-slate-950/80 px-4 py-2.5 text-xs text-slate-300">
                <Spinner className="h-3.5 w-3.5" />
                Verifying signature with the server…
              </div>
            )}
          </div>

          {camera === "running" && (
            <div className="flex items-center justify-between gap-3 border-t border-slate-800 px-4 py-3">
              <p className="flex items-center gap-2 text-xs text-slate-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                Camera live · scanning for QR codes
              </p>
              <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={stopCamera}>
                <Icon name="x" className="h-3.5 w-3.5" />
                Stop
              </button>
            </div>
          )}
        </Card>

        {/* Result */}
        {result && <ResultCard result={result} onDismiss={() => setResult(null)} />}

        {/* Manual entry */}
        <Card className="p-5">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 text-left"
            onClick={() => setManualOpen((v) => !v)}
            aria-expanded={manualOpen}
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-white">
              <Icon name="keyboard" className="h-4 w-4 text-slate-400" />
              Enter token manually
            </span>
            <Icon name="chevronRight" className={`h-4 w-4 text-slate-500 transition ${manualOpen ? "rotate-90" : ""}`} />
          </button>

          {manualOpen && (
            <div className="mt-4 space-y-3">
              <p className="text-xs text-slate-500">
                Paste the signed token from a ticket (students can reveal it on their ticket page) —
                useful when no camera is available.
              </p>
              <textarea
                className="input min-h-24 font-mono text-xs"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9…"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                aria-label="Ticket token"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={verifying || manualToken.trim().length < 20}
                  onClick={() => void verifyToken(manualToken, "MANUAL")}
                >
                  {verifying ? <Spinner /> : <Icon name="shield" className="h-4 w-4" />}
                  Verify &amp; check in
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setManualToken("");
                    setResult(null);
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* History */}
      <div className="space-y-4">
        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">
            Session scans
          </h2>
          {history.length === 0 ? (
            <p className="mt-3 text-xs text-slate-600">
              Scans from this browser session appear here. The full history lives on the check-ins
              page.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {history.map((item, index) => (
                <li
                  key={`${item.ticket?.id ?? "invalid"}-${index}`}
                  className="rounded-xl border border-slate-800 bg-slate-950/50 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <HistoryTone result={item.result} />
                    <span className="text-[10px] text-slate-600">{formatDateTime(item.at)}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-400">
                    {item.attendee?.name ?? "Unknown attendee"}
                    {item.ticket?.code ? ` · ${item.ticket.code}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-slate-400">
            Gate rules
          </h2>
          <ul className="mt-3 space-y-2 text-xs text-slate-500">
            <li>· Signature, expiry, ticket row and event are all verified server side.</li>
            <li>· A second scan of the same QR returns ALREADY USED — no new check-in row.</li>
            <li>· Tampered or forged tokens are rejected and never stored.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function HistoryTone({ result }: { result: VerifyTicketResponse["result"] }) {
  if (result === "SUCCESS")
    return (
      <Badge tone="emerald" icon="checkCircle">
        Success
      </Badge>
    );
  if (result === "ALREADY_USED")
    return (
      <Badge tone="amber" icon="alert">
        Already used
      </Badge>
    );
  return (
    <Badge tone="rose" icon="xCircle">
      Invalid
    </Badge>
  );
}

function ResultCard({
  result,
  onDismiss,
}: {
  result: VerifyTicketResponse;
  onDismiss: () => void;
}) {
  const tone =
    result.result === "SUCCESS"
      ? {
          wrap: "border-emerald-500/50 bg-emerald-500/10",
          chip: "bg-emerald-500 text-slate-950",
          icon: "checkCircle" as const,
          text: "text-emerald-200",
        }
      : result.result === "ALREADY_USED"
        ? {
            wrap: "border-amber-500/50 bg-amber-500/10",
            chip: "bg-amber-400 text-slate-950",
            icon: "alert" as const,
            text: "text-amber-200",
          }
        : {
            wrap: "border-rose-500/50 bg-rose-500/10",
            chip: "bg-rose-500 text-white",
            icon: "xCircle" as const,
            text: "text-rose-200",
          };

  return (
    <div
      role="status"
      aria-live="assertive"
      className={`pop-in rounded-2xl border-2 p-5 ${tone.wrap}`}
    >
      <div className="flex items-start gap-4">
        <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl ${tone.chip}`}>
          <Icon name={tone.icon} className="h-8 w-8" />
        </span>
        <div className="min-w-0 flex-1">
          <p className={`text-xl font-black uppercase tracking-tight sm:text-2xl ${tone.text}`}>
            {result.headline}
          </p>
          <p className="mt-1 text-sm text-slate-300">{result.message}</p>

          {(result.attendee || result.ticket || result.checkedInAt || result.firstCheckInAt) && (
            <dl className="mt-4 grid gap-2 sm:grid-cols-2">
              {result.attendee && (
                <Fact label="Attendee" value={result.attendee.name} />
              )}
              {result.event && <Fact label="Event" value={result.event.title} />}
              {result.ticket && <Fact label="Ticket ID" value={result.ticket.code} mono />}
              {result.checkedInAt && (
                <Fact label="Checked in at" value={formatDateTime(result.checkedInAt)} />
              )}
              {result.firstCheckInAt && (
                <Fact label="Original check-in" value={formatDateTime(result.firstCheckInAt)} />
              )}
              {result.scannedBy && <Fact label="Scanned by" value={result.scannedBy} />}
            </dl>
          )}

          {result.result === "ALREADY_USED" && (
            <Alert tone="warning" >
              No duplicate check-in was created. Entry is denied.
            </Alert>
          )}
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="btn-ghost -mr-2 -mt-2 px-2 py-1 text-slate-400"
          aria-label="Dismiss result"
        >
          <Icon name="x" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-800/80 bg-slate-950/50 px-3 py-2">
      <dt className="text-[10px] uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className={`truncate text-sm font-medium text-slate-100 ${mono ? "font-mono text-cyan-300" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
