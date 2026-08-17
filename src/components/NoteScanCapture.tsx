import { useCallback, useEffect, useRef, useState } from "react";
import { snapshotVideoFrame } from "../lib/note-images";

type Facing = "environment" | "user";

interface Props {
  onClose: () => void;
  onCapture: (file: File) => void;
  /** Native camera / scan sheet when in-page video is unavailable. */
  onUseDeviceCamera: () => void;
}

/** Mounted only while the sheet is open — unmounting is the reset. */
export default function NoteScanCapture({
  onClose,
  onCapture,
  onUseDeviceCamera,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facing, setFacing] = useState<Facing>("environment");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The object URL is minted with the capture rather than derived from it: a
  // render-phase createObjectURL leaks one URL per StrictMode double-render.
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);

  useEffect(() => {
    if (!preview) return;
    return () => URL.revokeObjectURL(preview.url);
  }, [preview]);

  const stopStream = useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;
    if (!stream) return;
    for (const track of stream.getTracks()) track.stop();
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, []);

  // Only re-runs on a flip or a retake; both handlers clear `ready`/`error`
  // themselves so this effect never has to reset state on the way in.
  useEffect(() => {
    if (preview) return;

    let cancelled = false;

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser cannot open the camera here.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1440 },
          },
        });
        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }
        stopStream();
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
        setReady(true);
      } catch {
        if (!cancelled) {
          setReady(false);
          setError("Camera access was blocked or no camera is available.");
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [facing, preview, stopStream]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSnap = async () => {
    const video = videoRef.current;
    if (!video || busy) return;
    setBusy(true);
    setError(null);
    try {
      const file = await snapshotVideoFrame(video, "scan");
      stopStream();
      setPreview({ file, url: URL.createObjectURL(file) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not capture that photo.");
    } finally {
      setBusy(false);
    }
  };

  const handleUse = () => {
    if (!preview) return;
    onCapture(preview.file);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="scan-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 id="scan-title" className="text-sm font-semibold text-ink">
            Scan or take a photo
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-ink"
          >
            Close
          </button>
        </div>

        <div className="relative bg-surface-3">
          {preview ? (
            <img src={preview.url} alt="Captured preview" className="mx-auto max-h-[60vh] w-full object-contain" />
          ) : error ? (
            <div className="flex min-h-[10rem] items-center justify-center px-4 py-8">
              <p className="text-center text-sm text-muted">
                Use the device camera to take or choose a photo.
              </p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                muted
                className="mx-auto max-h-[60vh] w-full bg-black object-contain"
              />
              {ready && (
                <div
                  className="pointer-events-none absolute inset-6 rounded-xl border border-white/40"
                  aria-hidden="true"
                />
              )}
            </>
          )}
        </div>

        {error && (
          <p className="px-4 pt-3 text-xs text-danger">{error}</p>
        )}

        <div className="flex flex-wrap items-center gap-2 px-4 py-3">
          {preview ? (
            <>
              <button
                type="button"
                onClick={handleUse}
                className="btn-primary rounded-xl px-4 py-2 text-sm"
              >
                Add to note
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setError(null);
                  setReady(false);
                }}
                className="rounded-xl bg-surface-2 px-4 py-2 text-sm text-ink-soft hover:text-ink"
              >
                Retake
              </button>
            </>
          ) : (
            <>
              {error ? (
                <button
                  type="button"
                  onClick={onUseDeviceCamera}
                  className="btn-primary rounded-xl px-4 py-2 text-sm"
                >
                  Device camera
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => void handleSnap()}
                    disabled={!ready || busy}
                    className="btn-primary rounded-xl px-4 py-2 text-sm"
                  >
                    {busy ? "Capturing…" : "Capture"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReady(false);
                      setError(null);
                      setFacing((side) => (side === "environment" ? "user" : "environment"));
                    }}
                    disabled={busy}
                    className="rounded-xl bg-surface-2 px-4 py-2 text-sm text-ink-soft hover:text-ink disabled:opacity-50"
                  >
                    Flip camera
                  </button>
                  <button
                    type="button"
                    onClick={onUseDeviceCamera}
                    className="rounded-xl px-3 py-2 text-sm text-muted hover:text-ink"
                  >
                    Device camera
                  </button>
                </>
              )}
            </>
          )}
        </div>
        <p className="px-4 pb-4 text-xs text-muted">
          Photos are compressed before they are added to the article.
        </p>
      </div>
    </div>
  );
}
