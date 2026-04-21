"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import type { ProctoringEvent } from "@/types/response";

const MODEL_CDN =
  "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";

// Minimum gap between consecutive multiple_faces events (ms) to avoid spam.
const MULTIPLE_FACES_COOLDOWN_MS = 10_000;
// Consecutive seconds without a face before logging a no_face event.
const NO_FACE_THRESHOLD_SECS = 10;
// Interval between detection runs (ms).
const DETECTION_INTERVAL_MS = 2000;

export function useFaceDetection(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  isActive: boolean,
) {
  const [noFaceCount, setNoFaceCount] = useState(0);
  const [multipleFacesCount, setMultipleFacesCount] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const eventsRef = useRef<ProctoringEvent[]>([]);
  const consecutiveNoFaceSecsRef = useRef(0);
  // Prevents logging the same no-face run multiple times.
  const noFaceActiveRef = useRef(false);
  const lastMultipleFacesTsRef = useRef(0);

  // Load tinyFaceDetector model once when the interview becomes active.
  useEffect(() => {
    if (!isActive || isReady) return;
    let cancelled = false;

    const load = async () => {
      try {
        const faceapi = await import("@vladmandic/face-api");
        if (!faceapi.nets.tinyFaceDetector.isLoaded) {
          await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_CDN);
        }
        if (!cancelled) setIsReady(true);
      } catch {
        // Face detection is best-effort; silently skip if unavailable.
      }
    };

    load();
    return () => { cancelled = true; };
  }, [isActive, isReady]);

  // Run face detection on a fixed interval while the interview is active.
  useEffect(() => {
    if (!isActive || !isReady) return;

    const detect = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      try {
        const faceapi = await import("@vladmandic/face-api");
        const detections = await faceapi.detectAllFaces(
          video,
          new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.5 }),
        );

        if (detections.length === 0) {
          consecutiveNoFaceSecsRef.current += DETECTION_INTERVAL_MS / 1000;

          if (
            consecutiveNoFaceSecsRef.current >= NO_FACE_THRESHOLD_SECS &&
            !noFaceActiveRef.current
          ) {
            noFaceActiveRef.current = true;
            setNoFaceCount((c) => c + 1);
            eventsRef.current = [
              ...eventsRef.current,
              { type: "no_face", timestamp: Date.now() },
            ];
          }
        } else {
          consecutiveNoFaceSecsRef.current = 0;
          noFaceActiveRef.current = false;

          if (detections.length > 1) {
            const now = Date.now();
            if (now - lastMultipleFacesTsRef.current > MULTIPLE_FACES_COOLDOWN_MS) {
              lastMultipleFacesTsRef.current = now;
              setMultipleFacesCount((c) => c + 1);
              eventsRef.current = [
                ...eventsRef.current,
                { type: "multiple_faces", timestamp: now },
              ];
            }
          }
        }
      } catch {
        // Ignore per-frame errors.
      }
    };

    const id = setInterval(detect, DETECTION_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isActive, isReady, videoRef]);

  const getFaceDetectionData = useCallback(
    () => ({
      noFaceCount,
      multipleFacesCount,
      events: eventsRef.current,
    }),
    [noFaceCount, multipleFacesCount],
  );

  return { noFaceCount, multipleFacesCount, isReady, getFaceDetectionData };
}
