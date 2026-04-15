"use client";

import { useCallback, useRef, useState } from "react";

export interface CameraRecordingState {
  cameraStream: MediaStream | null;
  isRecording: boolean;
  recordingUrl: string | null;
  cameraError: string | null;
}

export const useCameraRecording = () => {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  // Keep a ref to the latest stream so stopAndUpload can stop tracks
  const streamRef = useRef<MediaStream | null>(null);

  const requestCameraAccess = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false, // audio is captured by Deepgram separately
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
      console.warn("Camera access error:", message);
      return null;
    }
  }, []);

  const startRecording = useCallback((stream: MediaStream) => {
    chunksRef.current = [];

    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : MediaRecorder.isTypeSupported("video/webm")
      ? "video/webm"
      : "video/mp4";

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch {
      // Fallback without specifying mimeType
      recorder = new MediaRecorder(stream);
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
              const err = await response.json().catch(() => ({}));
              console.error("[useCameraRecording] upload failed:", err);
              resolve(null);
              return;
            }

            const { url } = await response.json();
            setRecordingUrl(url ?? null);
            resolve(url ?? null);
          } catch (err) {
            console.error("[useCameraRecording] upload error:", err);
            resolve(null);
          }
        };

        recorder.stop();
      }),
    [],
  );

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
    setIsRecording(false);
  }, []);

  return {
    cameraStream,
    isRecording,
    recordingUrl,
    cameraError,
    requestCameraAccess,
    startRecording,
    stopAndUpload,
    stopCamera,
  };
};
