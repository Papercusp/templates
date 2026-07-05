/**
 * The continuous DOWN carrier — a best-effort poll loop that runs one ingest
 * pass on a cadence (the oddsmith projector / quartermaster research-ingest
 * pattern). A throwing pass is reported via `onError` and the loop keeps
 * going; `stop()` halts it. The timer is unref'd so the loop never keeps the
 * host process alive on its own.
 *
 * The PASS itself is app-owned (fetch completed outputs → run each through
 * the app's contract gate → store) — this module only owns the cadence.
 *
 * Extracted from quartermaster's startResearchIngestLoop (P-002 of plan
 * app-templates-2026-07-04).
 */

export interface IngestLoopHandle {
  stop(): void;
}

export interface IngestLoopOpts {
  /** Poll cadence between passes. Default 60000ms. */
  intervalMs?: number;
  /** Called with a pass's thrown error (the loop continues). Default: swallow. */
  onError?: (err: unknown) => void;
}

/** Start the poll loop: run `pass()` every `intervalMs`, best-effort. */
export function startIngestLoop(pass: () => Promise<unknown>, opts: IngestLoopOpts = {}): IngestLoopHandle {
  const intervalMs = opts.intervalMs ?? 60_000;
  const onError = opts.onError ?? (() => {});
  let stopped = false;
  const timer = setInterval(() => {
    void pass().catch((err) => onError(err));
  }, intervalMs);
  // Never keep the process alive just for the poll.
  timer.unref?.();
  return {
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
    },
  };
}
