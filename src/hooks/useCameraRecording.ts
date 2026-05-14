"use client";

import { useCallback, useRef, useState } from "react";

export interface CameraRecordingState {
  cameraStream: MediaStream | null;
  isRecording: boolean;
  recordingUrl: string | null;
  cameraError: string | null;
}

export type ScreenShareResult =
  | { stream: MediaStream; reason: null }
  | { stream: null; reason: "denied" | "wrong_surface" | "unsupported" };

export const useCameraRecording = () => {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // Keep a ref to the latest stream so stopAndUpload can stop tracks
  const streamRef = useRef<MediaStream | null>(null);
  // Mixing AudioContext used to combine mic + AI audio into a single track
  const mixingContextRef = useRef<AudioContext | null>(null);

  const requestCameraAccess = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      setCameraStream(stream);
      streamRef.current = stream;
      setCameraError(null);
      return stream;
    } catch (err) {
      const name = err instanceof Error ? (err as any).name : "";
      const message =
        name === "NotAllowedError" || name === "PermissionDeniedError"
          ? "Camera access was denied. Video recording will not be available."
          : name === "NotFoundError"
          ? "No camera device found."
          : err instanceof Error
          ? err.message
          : "Unable to access camera.";
      setCameraError(message);
      return null;
    }
  }, []);

  const startRecording = useCallback((cameraStream: MediaStream, aiStream?: MediaStream | null) => {
    chunksRef.current = [];

    // Mix microphone (from cameraStream) and AI audio (from aiStream) into one track.
    let recordingStream = cameraStream;
    if (aiStream && aiStream.getAudioTracks().length > 0) {
      try {
        const mixingContext = new AudioContext();
        mixingContextRef.current = mixingContext;
        const destination = mixingContext.createMediaStreamDestination();

        if (cameraStream.getAudioTracks().length > 0) {
          mixingContext.createMediaStreamSource(cameraStream).connect(destination);
        }
        mixingContext.createMediaStreamSource(aiStream).connect(destination);

        recordingStream = new MediaStream([
          ...cameraStream.getVideoTracks(),
          ...destination.stream.getAudioTracks(),
        ]);
      } catch {
        // Fall back to camera stream only if mixing fails
        recordingStream = cameraStream;
      }
    }

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "video/mp4";

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(recordingStream, { mimeType });
    } catch {
      // Fallback without specifying mimeType
      recorder = new MediaRecorder(recordingStream);
    }

    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        chunksRef.current.push(e.data);
      }
    };

    recorder.start(5000); // collect a chunk every 5 seconds
    setIsRecording(true);
  }, []);

  /**
   * Stops recording, uploads the video blob via the server-side API route
   * (which uses the service role key to bypass RLS), and returns the public URL.
   * Returns null if no recording was made or the upload fails.
   */
  const stopAndUpload = useCallback(
    (callId: string): Promise<string | null> =>
      new Promise((resolve) => {
        const recorder = mediaRecorderRef.current;
        if (!recorder || recorder.state === "inactive") {
          resolve(null);
          return;
        }

        recorder.onstop = async () => {
          setIsRecording(false);

          // Stop camera tracks
          const stream = streamRef.current;
          if (stream) {
            stream.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
            setCameraStream(null);
          }

          // Close mixing context
          if (mixingContextRef.current) {
            mixingContextRef.current.close().catch(() => {});
            mixingContextRef.current = null;
          }

          if (chunksRef.current.length === 0) {
            resolve(null);
            return;
          }

          const mimeType = recorder.mimeType || "video/webm";
          const blob = new Blob(chunksRef.current, { type: mimeType });

          try {
            const formData = new FormData();
            formData.append("file", blob);
            formData.append("callId", callId);
            formData.append("mimeType", mimeType);

            const response = await fetch("/api/upload-recording", {
              method: "POST",
              body: formData,
            });

            if (!response.ok) {
              resolve(null);
              return;
            }

            const { url } = await response.json();
            setRecordingUrl(url ?? null);
            resolve(url ?? null);
          } catch {
            resolve(null);
          }
        };

        recorder.stop();
      }),
    [],
  );

  const requestScreenShare = useCallback(async (): Promise<ScreenShareResult> => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
      return { stream: null, reason: "unsupported" };
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" } as any,
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      const surface = track ? (track.getSettings() as any).displaySurface : undefined;
      if (surface !== undefined && surface !== "monitor") {
        stream.getTracks().forEach((t) => t.stop());
        return { stream: null, reason: "wrong_surface" };
      }
      return { stream, reason: null };
    } catch {
      return { stream: null, reason: "denied" };
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCameraStream(null);
    }
    if (mixingContextRef.current) {
      mixingContextRef.current.close().catch(() => {});
      mixingContextRef.current = null;
    }
    setIsRecording(false);
  }, []);

  return {
    cameraStream,
    isRecording,
    recordingUrl,
    cameraError,
    requestCameraAccess,
    requestScreenShare,
    startRecording,
    stopAndUpload,
    stopCamera,
  };
};
