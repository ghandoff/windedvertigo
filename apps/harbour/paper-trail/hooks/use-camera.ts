"use client";

/**
 * paper.trail — camera hook
 *
 * Manages getUserMedia stream lifecycle and canvas frame capture.
 */

import { useState, useRef, useCallback, useEffect } from "react";

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const start = useCallback(async () => {
    try {
      let mediaStream: MediaStream;
      try {
        // Prefer rear camera on mobile; ideal constraint won't reject on desktop
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
      } catch (firstErr) {
        // Fallback: drop facingMode if it over-constrained (desktop with front-only webcam)
        if (firstErr instanceof DOMException && firstErr.name === "OverconstrainedError") {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false,
          });
        } else {
          throw firstErr;
        }
      }
      setStream(mediaStream);
      setError(null);
      // srcObject is wired in the effect below — the <video> element
      // isn't mounted yet on the first click (it only renders after
      // `started` flips), so assigning here would no-op.
    } catch (err) {
      let message: string;
      if (err instanceof DOMException) {
        switch (err.name) {
          case "NotAllowedError":
            message = "camera access was denied. please allow camera access in your browser settings.";
            break;
          case "NotFoundError":
            message = "no camera was found on this device.";
            break;
          case "NotReadableError":
            message = "the camera is in use by another app. close other tabs or apps using the camera and try again.";
            break;
          case "SecurityError":
            message = "camera access is blocked by a security policy. make sure you're using https.";
            break;
          default:
            message = "could not access the camera. make sure your device has a camera available.";
        }
      } else {
        message = "could not access the camera. make sure your device has a camera available.";
      }
      setError(message);
    }
  }, []);

  const stop = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
      setReady(false);
    }
  }, [stream]);

  const capture = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || !ready) return null;

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL("image/jpeg", 0.85);
  }, [ready]);

  // Wire the stream into the <video> once both the stream and the
  // element exist. Starts playback and flips `ready` on loadedmetadata.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    const onReady = () => setReady(true);
    if (video.readyState >= 1) onReady();
    else video.addEventListener("loadedmetadata", onReady, { once: true });
    // Safari sometimes needs an explicit play() on first attach.
    video.play().catch(() => {});
    return () => {
      video.removeEventListener("loadedmetadata", onReady);
    };
  }, [stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [stream]);

  return { videoRef, stream, error, ready, start, stop, capture };
}
