"use client";

import {
  AlarmClockIcon,
  XCircleIcon,
  CheckCircleIcon,
  VideoIcon,
  VideoOffIcon,
} from "lucide-react";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { useResponses } from "@/contexts/responses.context";
import Image from "next/image";
import MiniLoader from "../loaders/mini-loader/miniLoader";
import { toast } from "sonner";
import { isLightColor, testEmail } from "@/lib/utils";
import { Interview } from "@/types/interview";
import { FeedbackData } from "@/types/response";
import { FeedbackForm } from "@/components/call/feedbackForm";
import {
  TabSwitchWarning,
  useTabSwitchPrevention,
} from "./tabSwitchPrevention";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { DeepgramAgentService } from "@/services/deepgram-agent.service";
import { AudioPlayer } from "@/lib/audio-player";
import { AgentEvents } from "@deepgram/sdk";
import { useCameraRecording } from "@/hooks/useCameraRecording";

type InterviewProps = {
  interview: Interview;
  applicationId?: string;
  jobId?: number;
  isTestResponse?: boolean;
  prefillEmail?: string;
  prefillName?: string;
};

type transcriptType = {
  role: string;
  content: string;
};

function Call({ interview, applicationId, jobId, isTestResponse = false, prefillEmail = "", prefillName = "" }: InterviewProps) {
  const { createResponse } = useResponses();
  const [lastInterviewerResponse, setLastInterviewerResponse] =
    useState<string>("");
  const [lastUserResponse, setLastUserResponse] = useState<string>("");
  const [transcript, setTranscript] = useState<transcriptType[]>([]);
  const [activeTurn, setActiveTurn] = useState<string>("");
  const [Loading, setLoading] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [isEnded, setIsEnded] = useState(false);
  const [isCalling, setIsCalling] = useState(false);
  const [email, setEmail] = useState<string>(prefillEmail);
  const [name, setName] = useState<string>(prefillName);
  const [isValidEmail, setIsValidEmail] = useState<boolean>(false);
  const [isOldUser, setIsOldUser] = useState<boolean>(false);
  const [isCompiling, setIsCompiling] = useState<boolean>(false);
  const [isCheckingApplication, setIsCheckingApplication] = useState<boolean>(!!applicationId);
  const [callId, setCallId] = useState<string>("");
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [isFeedbackSubmitted, setIsFeedbackSubmitted] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [interviewerImg, setInterviewerImg] = useState("");
  const [interviewerFallbackImg, setInterviewerFallbackImg] = useState("/interviewers/Lisa.png");
  const [interviewTimeDuration, setInterviewTimeDuration] =
    useState<string>("1");
  const [time, setTime] = useState(0);
  const [currentTimeDuration, setCurrentTimeDuration] = useState<string>("0");
  const [agentService, setAgentService] = useState<DeepgramAgentService | null>(null);
  const [audioPlayer, setAudioPlayer] = useState<AudioPlayer | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const [isCameraCovered, setIsCameraCovered] = useState(false);
  const cameraCoveredRef = useRef(false);
  const [permissionStatus, setPermissionStatus] = useState<"unknown" | "granted" | "denied">("unknown");

  // Proctoring — isStarted drives activation so events aren't captured pre-interview.
  const {
    tabSwitchCount,
    windowSwitchCount,
    fullscreenExitCount,
    isDialogOpen: isProctoringDialogOpen,
    dialogMessage: proctoringDialogMessage,
    handleUnderstand,
    getProctoringData,
  } = useTabSwitchPrevention(isStarted && !isEnded);

  // Keep a ref so the save effect always reads the latest proctoring snapshot
  // without needing it in the effect dependency array.
  const proctoringDataRef = useRef(getProctoringData());
  useEffect(() => {
    proctoringDataRef.current = getProctoringData();
  }, [getProctoringData]);

  // Camera recording
  const {
    cameraStream,
    cameraError,
    requestCameraAccess,
    startRecording,
    stopAndUpload,
    stopCamera,
  } = useCameraRecording();
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);

  // Attach the camera stream to the preview video element whenever it changes.
  useEffect(() => {
    if (cameraVideoRef.current && cameraStream) {
      cameraVideoRef.current.srcObject = cameraStream;
    }
  }, [cameraStream]);

  // Proactively check camera + mic permission state on mount.
  useEffect(() => {
    if (!("permissions" in navigator)) return;
    Promise.all([
      navigator.permissions.query({ name: "camera" as PermissionName }),
      navigator.permissions.query({ name: "microphone" as PermissionName }),
    ]).then(([cam, mic]) => {
      const update = (c: PermissionState, m: PermissionState) => {
        if (c === "denied" || m === "denied") setPermissionStatus("denied");
        else if (c === "granted" && m === "granted") setPermissionStatus("granted");
        else setPermissionStatus("unknown");
      };
      update(cam.state, mic.state);
      cam.addEventListener("change", () => update(cam.state, mic.state));
      mic.addEventListener("change", () => update(cam.state, mic.state));
    }).catch(() => {});
  }, []);

  const lastUserResponseRef = useRef<HTMLDivElement | null>(null);

  const handleFeedbackSubmit = async (
    formData: Omit<FeedbackData, "interview_id">,
  ) => {
    try {
      const feedbackRes = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, interview_id: interview.id }),
      });
      const result = feedbackRes.ok ? await feedbackRes.json() : null;

      if (result) {
        toast.success("Thank you for your feedback!");
        setIsFeedbackSubmitted(true);
        setIsDialogOpen(false);
      } else {
        toast.error("Failed to submit feedback. Please try again.");
      }
    } catch {
      toast.error("An error occurred. Please try again later.");
    }
  };

  useEffect(() => {
    if (lastUserResponseRef.current) {
      const { current } = lastUserResponseRef;
      current.scrollTop = current.scrollHeight;
    }
  }, [lastUserResponse]);

  useEffect(() => {
    let intervalId: any;
    if (isCalling) {
      intervalId = setInterval(() => setTime(time + 1), 10);
    }
    setCurrentTimeDuration(String(Math.floor(time / 100)));
    if (Number(currentTimeDuration) == Number(interviewTimeDuration) * 60) {
      if (agentService) {
        agentService.close();
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.stop().catch(() => {});
      }
      setIsEnded(true);
    }

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCalling, time, currentTimeDuration]);

  useEffect(() => {
    setIsValidEmail(testEmail(email));
  }, [email]);

  useEffect(() => {
    if (!agentService) {
      return;
    }

    const player = new AudioPlayer();
    setAudioPlayer(player);
    audioPlayerRef.current = player;

    const initAudio = async () => {
      try {
        await player.initialize();
      } catch {
        // audio init failure is non-fatal
      }
    };

    const handleInteraction = () => {
      initAudio();
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("touchstart", handleInteraction);
    };

    document.addEventListener("click", handleInteraction, { once: true });
    document.addEventListener("touchstart", handleInteraction, { once: true });

    agentService.on(AgentEvents.Open, () => {
      setIsCalling(true);
    });

    agentService.on(AgentEvents.Close, () => {
      setIsCalling(false);
      setIsEnded(true);
    });

    agentService.on(AgentEvents.ConversationText, async (data: any) => {
      let role: string | null = null;
      let content: string | null = null;

      if (data.role && data.content) {
        role = data.role;
        content = data.content;
      } else if (data.agent?.text) {
        role = "agent";
        content = data.agent.text;
      } else if (data.user?.text) {
        role = "user";
        content = data.user.text;
      }

      if (role && content) {
        if (role === "agent" || role === "assistant") {
          setLastInterviewerResponse(content);
          setActiveTurn("agent");
          setTranscript((prev) => {
            const lastEntry = prev[prev.length - 1];
            if (lastEntry?.role === "agent" && lastEntry?.content === content) {
              return prev;
            }
            return [...prev, { role: "agent", content: content! }];
          });
        } else if (role === "user") {
          setLastUserResponse(content);
          setActiveTurn("user");
          setTranscript((prev) => {
            const lastEntry = prev[prev.length - 1];
            if (lastEntry?.role === "user" && lastEntry?.content === content) {
              return prev;
            }
            return [...prev, { role: "user", content: content! }];
          });
        }
      }
    });

    agentService.on(AgentEvents.UserStartedSpeaking, () => {
      setActiveTurn("user");
      if (audioPlayerRef.current) {
        audioPlayerRef.current.clearBuffer();
      }
    });

    agentService.on("AgentStartedSpeaking" as any, () => {
      setActiveTurn("agent");
    });

    agentService.on(AgentEvents.Audio, async (audioData: any) => {
      setActiveTurn("agent");

      let player = audioPlayerRef.current;
      if (!player) {
        player = new AudioPlayer();
        setAudioPlayer(player);
        audioPlayerRef.current = player;
      }

      try {
        let arrayBuffer: ArrayBuffer;
        if (audioData instanceof ArrayBuffer) {
          arrayBuffer = audioData;
        } else if ((audioData as any).buffer instanceof ArrayBuffer) {
          arrayBuffer = (audioData as any).buffer as ArrayBuffer;
        } else if (audioData instanceof Uint8Array) {
          arrayBuffer = audioData.buffer.slice(0) as ArrayBuffer;
        } else {
          const converted =
            (await audioData.arrayBuffer?.()) || new Uint8Array(audioData).buffer;
          arrayBuffer = converted as ArrayBuffer;
        }
        await player.addAudioChunk(arrayBuffer);
      } catch {
        // non-fatal audio chunk error
      }
    });

    agentService.on(AgentEvents.AgentAudioDone, () => {
      setActiveTurn("user");
    });

    agentService.on(AgentEvents.Error, () => {
      agentService.close();
      setIsEnded(true);
      setIsCalling(false);
    });

    return () => {
      if (agentService) {
        agentService.removeAllListeners();
      }
      if (audioPlayerRef.current) {
        audioPlayerRef.current.stop();
      }
    };
  }, [agentService]);

  const onEndCallClick = async () => {
    setLoading(true);
    if (agentService) agentService.close();
    if (audioPlayerRef.current) await audioPlayerRef.current.stop();
    setIsEnded(true);
    setLoading(false);
  };

  // Block duplicate submissions on page load when an applicationId is present.
  useEffect(() => {
    if (!applicationId) return;
    fetch("/api/check-response", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicationId }),
    })
      .then((r) => r.json())
      .then(({ exists, call_id }) => {
        if (exists && call_id) {
          window.location.href = `/result/${call_id}`;
        } else {
          setIsCheckingApplication(false);
        }
      })
      .catch(() => { setIsCheckingApplication(false); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  // Detect covered camera during interview using multi-signal pixel analysis.
  // Uses a dedicated off-screen video so detection is independent of the DOM ref
  // and the stream-attach render-order race condition.
  useEffect(() => {
    if (!isStarted || isEnded || !cameraStream) return;

    const analysisVideo = document.createElement("video");
    analysisVideo.srcObject = cameraStream;
    analysisVideo.muted = true;
    analysisVideo.playsInline = true;
    analysisVideo.play().catch(() => {});

    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 48;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    let blockedFrameCount = 0;

    const checkFrame = () => {
      if (!ctx || analysisVideo.readyState < 2) return;

      ctx.drawImage(analysisVideo, 0, 0, 64, 48);
      const { data } = ctx.getImageData(0, 0, 64, 48);
      const pixelCount = data.length / 4;

      // Pass 1: per-channel averages
      let sumR = 0, sumG = 0, sumB = 0;
      for (let i = 0; i < data.length; i += 4) {
        sumR += data[i];
        sumG += data[i + 1];
        sumB += data[i + 2];
      }
      const avgR = sumR / pixelCount;
      const avgG = sumG / pixelCount;
      const avgB = sumB / pixelCount;
      const avgBrightness = (avgR + avgG + avgB) / 3;

      // Pass 2: per-channel variance + edge density + brightness histogram
      let varR = 0, varG = 0, varB = 0, edgeCount = 0;
      const histogram = new Array(32).fill(0);
      for (let i = 0; i < data.length; i += 4) {
        varR += (data[i] - avgR) ** 2;
        varG += (data[i + 1] - avgG) ** 2;
        varB += (data[i + 2] - avgB) ** 2;
        const pixBright = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (Math.abs(pixBright - avgBrightness) > 25) edgeCount++;
        histogram[Math.min(31, Math.floor(pixBright / 8))]++;
      }
      const chromaVariance = (varR + varG + varB) / pixelCount;
      const edgeDensity = edgeCount / pixelCount;
      let activeBuckets = 0;
      for (let k = 0; k < 32; k++) {
        if (histogram[k] > pixelCount * 0.01) activeBuckets++;
      }

      if (process.env.NODE_ENV === "development") {
        console.log("[camera-cover]", {
          avgBrightness: avgBrightness.toFixed(1),
          chromaVariance: chromaVariance.toFixed(0),
          edgeDensity: edgeDensity.toFixed(3),
          activeBuckets,
          blockedFrameCount,
        });
      }

      // Real feed: chromaVariance >~3000, edgeDensity >~0.20, activeBuckets >~12
      // Covered signals (any one is enough):
      //   1. Very dark frame (black tape / dark cloth)
      //   2. Very uniform chroma (grey/blank feed, paper, sticker)
      //   3. Narrow brightness histogram (hand or solid object)
      //   4. Mid-brightness + low variance + sparse edges (skin/cloth)
      const isBlocked =
        avgBrightness < 40 ||
        chromaVariance < 400 ||
        activeBuckets < 10 ||
        (avgBrightness < 200 && chromaVariance < 1500 && edgeDensity < 0.15);

      if (isBlocked) {
        blockedFrameCount++;
        if (blockedFrameCount >= 2) {
          setIsCameraCovered(true);
          cameraCoveredRef.current = true;
        }
      } else {
        blockedFrameCount = 0;
        setIsCameraCovered(false);
      }
    };

    const id = setInterval(checkFrame, 2000);
    return () => {
      clearInterval(id);
      analysisVideo.srcObject = null;
    };
  }, [isStarted, isEnded, cameraStream]);

  const startConversation = async () => {
    // Must be called synchronously within the user-gesture call stack before any
    // awaits — browsers block requestFullscreen() outside the gesture window.
    if (typeof document !== 'undefined' && document.fullscreenEnabled && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    }

    let reuseCallId: string | null = null;

    if (!isTestResponse) {
      if (applicationId) {
        const checkRes = await fetch("/api/check-response", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicationId }),
        });
        const { exists, call_id } = await checkRes.json();
        if (exists && call_id) {
          window.location.href = `/result/${call_id}`;
          return;
        }
        // Incomplete response from a previous crashed attempt — reuse the same call_id
        if (call_id) reuseCallId = call_id;
      }
    }

    setLoading(true);

    try {
      // Camera + mic access is required to proceed.
      const stream = await requestCameraAccess();
      if (!stream) {
        toast.error("Camera and microphone access are required to start the interview. Please allow access and try again.");
        setLoading(false);
        return;
      }
      setPermissionStatus("granted");

      const iRes = await fetch(`/api/interviewers/${interview.interviewer_id}`);
      const interviewer = await iRes.json();

      const tokenRes = await fetch("/api/deepgram-token", { method: "POST" });
      const tokenData = await tokenRes.json();
      const apiKey: string = tokenData.token || "";
      if (!apiKey) {
        toast.error("Failed to start interview. Please try again.");
        setLoading(false);
        return;
      }

      const agent = new DeepgramAgentService(apiKey);
      setAgentService(agent);

      const newCallId = reuseCallId ?? `call_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      setCallId(newCallId);
      setCallStartTime(Date.now());
      setTranscript([]);

      agent.configure({
        name: name || "Candidate",
        objective: interview?.objective || "",
        questions: interview?.questions.map((q) => q.question) || [],
        duration: interview?.time_duration || "15",
        interviewerName: interviewer?.name || "Interviewer",
        voiceModel: interviewer?.audio?.toLowerCase().includes("bob")
          ? "aura-2-orion-en"
          : "aura-2-thalia-en",
        interviewerPersonality: {
          empathy: interviewer?.empathy || 7,
          rapport: interviewer?.rapport || 7,
          exploration: interviewer?.exploration || 7,
          speed: interviewer?.speed || 5,
        },
      });

      await new Promise<void>((resolve) => {
        agent.on(AgentEvents.Open, () => resolve());
      });

      let player = audioPlayerRef.current;
      if (!player) {
        player = new AudioPlayer();
        setAudioPlayer(player);
        audioPlayerRef.current = player;
      }
      try {
        await player.initialize();
      } catch {
        // non-fatal
      }

      try {
        await agent.startAudioCapture();
      } catch (error) {
        toast.error(
          "Failed to access microphone. Please check permissions and try again.",
        );
        throw error;
      }

      // Start camera recording if access was granted.
      // Pass the AI audio stream so both the candidate and interviewer voices are recorded.
      if (stream) {
        startRecording(stream, player.getRecordingStream());
      }

      if (!reuseCallId) {
        await createResponse({
          interview_id: interview.id,
          call_id: newCallId,
          email: email,
          name: name,
          ...(applicationId ? { application_id: applicationId } : {}),
          ...(jobId != null ? { job_id: jobId } : {}),
          ...(isTestResponse ? { is_test_response: true } : {}),
        });
      }

      setIsStarted(true);
      setIsCalling(true);
    } catch (error) {
      toast.error("Failed to start interview. Please try again.");
      stopCamera();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (interview?.time_duration) {
      setInterviewTimeDuration(interview?.time_duration);
    }
  }, [interview]);

  useEffect(() => {
    const fetchInterviewer = async () => {
      const iRes = await fetch(`/api/interviewers/${interview.interviewer_id}`);
      const interviewer = await iRes.json();
      const img: string = interviewer?.image ?? "";
      // Only accept paths that next/image can serve (leading slash or absolute URL).
      // Anything else (e.g. legacy "employee-photos/233.jpg") falls back to the
      // local public/interviewers default.
      const fallbackImg = interviewer?.audio?.toLowerCase().includes("bob")
        ? "/interviewers/Bob.png"
        : "/interviewers/Lisa.png";
      setInterviewerFallbackImg(fallbackImg);
      setInterviewerImg(
        img && (img.startsWith("/") || img.startsWith("http"))
          ? img
          : fallbackImg,
      );
    };
    fetchInterviewer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interview.interviewer_id]);

  // Save response when interview ends.
  useEffect(() => {
    if (isEnded && callId && callStartTime) {
      const updateInterview = async () => {
        const transcriptString = transcript
          .map(
            (t) =>
              `${t.role === "agent" ? "Interviewer" : "Candidate"}: ${t.content}`,
          )
          .join("\n");

        const endTime = Date.now();
        const duration = Math.round((endTime - callStartTime) / 1000);

        // Stop recording and upload; get back the public URL (null if no recording).
        const recordingUrl = await stopAndUpload(callId);

        // Capture final proctoring snapshot.
        const proctoring = proctoringDataRef.current;

        setIsCompiling(true);
        try {
          await fetch(`/api/responses/${callId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              is_ended: true,
              tab_switch_count: proctoring.tabSwitchCount,
              fullscreen_exit_count: proctoring.fullscreenExitCount,
              proctoring_events: [
                ...proctoring.events,
                ...(proctoring.windowSwitchCount > 0
                  ? [{ type: "window_switch_summary", count: proctoring.windowSwitchCount, timestamp: endTime }]
                  : []),
                ...(cameraCoveredRef.current
                  ? [{ type: "camera_covered", timestamp: endTime }]
                  : []),
              ],
              recording_url: recordingUrl,
              details: {
                transcript: transcriptString,
                transcript_object: transcript,
                start_timestamp: callStartTime,
                end_timestamp: endTime,
              },
              duration: duration,
            }),
          });

          // keepalive ensures analysis completes even if the user closes the tab.
          await fetch("/api/get-call", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: callId }),
            keepalive: true,
          }).catch(() => {});

          if (isTestResponse) {
            if (!interview.id) {
              console.warn("interview.id is undefined, falling back to result page");
              window.location.href = `/result/${callId}`;
            } else {
              window.location.href = `/interviews/${interview.id}`;
            }
          } else {
            window.location.href = `/result/${callId}`;
          }
        } catch {
          toast.error("Error saving interview. Please try again.");
          setIsCompiling(false);
        }
      };

      updateInterview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnded, callId, callStartTime]);

  return (
    <div className="flex justify-center items-center h-full bg-gray-100">
      {/* Proctoring warning dialog — driven by the single shared hook instance */}
      {isStarted && (
        <TabSwitchWarning
          isDialogOpen={isProctoringDialogOpen}
          dialogMessage={proctoringDialogMessage}
          onUnderstand={handleUnderstand}
        />
      )}

      {/* Camera preview — small floating thumbnail visible during the interview */}
      {isStarted && !isEnded && cameraStream && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg overflow-hidden border-2 border-indigo-400 shadow-lg bg-black">
          <video
            ref={cameraVideoRef}
            autoPlay
            muted
            playsInline
            className="w-36 h-28 object-cover"
          />
          <div className="absolute top-1 right-1">
            <VideoIcon className="h-3 w-3 text-red-500" />
          </div>
          {isCameraCovered && (
            <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center text-white text-xs text-center p-1 gap-1">
              <VideoOffIcon className="h-4 w-4 text-red-400" />
              <span>Camera appears covered</span>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-md md:w-[80%] w-[90%] h-full">
        {isTestResponse && (
          <div className="bg-amber-100 border border-amber-300 text-amber-800 text-xs font-semibold text-center py-1 rounded-t-lg">
            Test Mode — This response will be stored as a test response
          </div>
        )}
        <Card className={`h-full rounded-lg border-2 border-b-4 border-r-4 border-black text-xl font-bold transition-all md:block dark:border-white ${isTestResponse ? "rounded-t-none" : ""}`}>
          <div className="flex flex-col h-full">
            <CardHeader className="items-center p-1">
              {!isEnded && (
                <CardTitle className="flex flex-row items-center text-lg md:text-xl font-bold mb-2">
                  {interview?.name}
                </CardTitle>
              )}
              {!isEnded && (
                <div className="flex mt-2 flex-row">
                  <AlarmClockIcon
                    className="text-indigo-600 h-[1rem] w-[1rem] rotate-0 scale-100  dark:-rotate-90 dark:scale-0 mr-2 font-bold"
                    style={{ color: interview.theme_color }}
                  />
                  <div className="text-sm font-normal">
                    Expected duration:{" "}
                    <span
                      className="font-bold"
                      style={{ color: interview.theme_color }}
                    >
                      {interviewTimeDuration} mins{" "}
                    </span>
                    or less
                  </div>
                </div>
              )}
            </CardHeader>

            {/* ── Pre-start screen ── */}
            {!isStarted && !isEnded && !isOldUser && !isCheckingApplication && (
              <div className="w-fit min-w-[400px] max-w-[400px] mx-auto mt-2  border border-indigo-200 rounded-md p-2 m-2 bg-slate-50">
                <div>
                  {interview?.logo_url && (interview.logo_url.startsWith("/") || interview.logo_url.startsWith("http")) && (
                    <div className="p-1 flex justify-center">
                      <Image
                        src={interview.logo_url}
                        alt="Logo"
                        className="h-10 w-auto"
                        width={100}
                        height={100}
                      />
                    </div>
                  )}
                  <div className="p-2 font-normal text-sm mb-4 whitespace-pre-line">
                    {interview?.description}
                    <p className="font-bold text-sm mt-3">
                      {"\n"}Ensure your volume is up and grant microphone access
                      when prompted. Additionally, please make sure you are in a
                      quiet environment.
                      {"\n\n"}Note: Tab switching will be recorded.
                    </p>

                    {/* Camera & proctoring consent notice */}
                    <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded-md text-xs text-yellow-800 font-normal">
                      <div className="flex items-center gap-1 mb-1 font-semibold">
                        <VideoIcon className="h-3 w-3" />
                        Camera & Integrity Monitoring
                      </div>
                      <p>
                        This session will be video-recorded for assessment integrity
                        purposes. Tab switching, window changes, and fullscreen exits
                        are also logged. Recordings are only accessible to authorised
                        assessors. By starting the interview you consent to this
                        monitoring.
                      </p>
                      <div className="mt-2 flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-xs">
                          {permissionStatus === "granted" ? (
                            <span className="text-green-600 flex items-center gap-1">
                              <VideoIcon className="h-3 w-3" /> Camera &amp; microphone access granted
                            </span>
                          ) : permissionStatus === "denied" ? (
                            <span className="text-red-600 flex items-center gap-1">
                              <VideoOffIcon className="h-3 w-3" /> Camera or microphone access denied — please allow in browser settings
                            </span>
                          ) : (
                            <span className="text-yellow-700 flex items-center gap-1">
                              <VideoIcon className="h-3 w-3" /> Camera &amp; microphone access will be requested when you start
                            </span>
                          )}
                        </div>
                        {cameraError && permissionStatus !== "granted" && (
                          <p className="text-red-600 flex items-center gap-1 text-xs">
                            <VideoOffIcon className="h-3 w-3" />
                            {cameraError}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  {isTestResponse ? (
                    <div className="text-center text-sm text-gray-600 py-2">
                      Testing as: <span className="font-semibold">{name}</span> ({email})
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 justify-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <input
                          value={email}
                          className={`h-fit mx-auto py-2 border-2 rounded-md w-[75%] self-center px-2 text-sm font-normal ${
                            email && !isValidEmail ? "border-red-400" : "border-gray-400"
                          }`}
                          placeholder="Enter your email address"
                          onChange={(e) => setEmail(e.target.value)}
                        />
                        {email && !isValidEmail && (
                          <p className="text-red-500 text-xs w-[75%]">Please enter a valid email address</p>
                        )}
                      </div>
                      <div className="flex justify-center">
                        <input
                          value={name}
                          className="h-fit mx-auto py-2 border-2 rounded-md w-[75%] self-center px-2 border-gray-400 text-sm font-normal"
                          placeholder="Enter your first name"
                          onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="w-[80%] flex flex-row mx-auto justify-center items-center align-middle py-3">
                  <Button
                    className="min-w-20 h-10 rounded-lg flex flex-row justify-center"
                    style={{
                      backgroundColor: interview.theme_color ?? "#4F46E5",
                      color: isLightColor(interview.theme_color ?? "#4F46E5")
                        ? "black"
                        : "white",
                    }}
                    disabled={
                      Loading ||
                      permissionStatus === "denied" ||
                      (!isTestResponse && (!isValidEmail || !name))
                    }
                    onClick={startConversation}
                  >
                    {!Loading ? "Start Interview" : <MiniLoader />}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        className="bg-white border ml-2 text-black min-w-15 h-10 rounded-lg flex flex-row justify-center"
                        style={{ borderColor: interview.theme_color }}
                        disabled={Loading}
                      >
                        Exit
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action will exit the interview. You can start a
                          new interview later.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-indigo-600 hover:bg-indigo-800"
                          onClick={async () => {
                            await onEndCallClick();
                          }}
                        >
                          Continue
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            )}

            {/* ── Timing bar — visible only during active interview ── */}
            {isStarted && !isEnded && !isOldUser && (
              <div className="mx-4 mt-2 mb-1">
                <div className="h-2 rounded-full bg-indigo-100 border border-indigo-200 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-600 transition-all duration-1000"
                    style={{
                      width: `${Math.min(
                        (Number(currentTimeDuration) / (Number(interviewTimeDuration) * 60)) * 100,
                        100,
                      )}%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-0.5 font-normal">
                  <span>{Math.floor(Number(currentTimeDuration) / 60)}m {Number(currentTimeDuration) % 60}s</span>
                  <span>{interviewTimeDuration}m limit</span>
                </div>
              </div>
            )}

            {/* ── Active interview screen ── */}
            {isStarted && !isEnded && !isOldUser && (
              <div className="flex flex-row p-2 grow">
                <div className="border-x-2 border-grey w-[50%] my-auto min-h-[70%]">
                  <div className="flex flex-col justify-evenly">
                    <div
                      className={`text-[22px] w-[80%] md:text-[26px] mt-4 min-h-[250px] mx-auto px-6`}
                    >
                      {lastInterviewerResponse}
                    </div>
                    <div className="flex flex-col mx-auto justify-center items-center align-middle">
                      <div
                        className={`w-[120px] h-[120px] rounded-full overflow-hidden ${
                          activeTurn === "agent"
                            ? `border-4 border-[${interview.theme_color}]`
                            : ""
                        }`}
                      >
                        <Image
                          src={
                            interviewerImg &&
                            (interviewerImg.startsWith("/") || interviewerImg.startsWith("http"))
                              ? interviewerImg
                              : interviewerFallbackImg
                          }
                          onError={() => setInterviewerImg(interviewerFallbackImg)}
                          alt="Image of the interviewer"
                          width={120}
                          height={120}
                          className="w-full h-full object-cover object-center"
                        />
                      </div>
                      <div className="font-semibold mt-1">Interviewer</div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col justify-evenly w-[50%]">
                  <div
                    ref={lastUserResponseRef}
                    className={`text-[22px] w-[80%] md:text-[26px] mt-4 mx-auto h-[250px] px-6 overflow-y-auto`}
                  >
                    {lastUserResponse}
                  </div>
                  <div className="flex flex-col mx-auto justify-center items-center align-middle">
                    <Image
                      src={`/user-icon.png`}
                      alt="Picture of the user"
                      width={120}
                      height={120}
                      className={`object-cover object-center mx-auto my-auto ${
                        activeTurn === "user"
                          ? `border-4 border-[${interview.theme_color}] rounded-full`
                          : ""
                      }`}
                    />
                    <div className="font-semibold">You</div>
                  </div>
                </div>
              </div>
            )}
            {isStarted && !isEnded && !isOldUser && (
              <div className="items-center p-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      className="w-full bg-white text-black border border-indigo-600 h-10 mx-auto flex flex-row justify-center"
                      disabled={Loading}
                    >
                      End Interview{" "}
                      <XCircleIcon className="h-[1.5rem] ml-2 w-[1.5rem] rotate-0 scale-100  dark:-rotate-90 dark:scale-0 text-red" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This action will end the
                        call.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-indigo-600 hover:bg-indigo-800"
                        onClick={async () => {
                          await onEndCallClick();
                        }}
                      >
                        Continue
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            )}

            {/* ── End screen ── */}
            {isEnded && !isOldUser && (
              <div className="w-fit min-w-[400px] max-w-[400px] mx-auto mt-2  border border-indigo-200 rounded-md p-2 m-2 bg-slate-50  absolute -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2">
                <div>
                  {isCompiling ? (
                    <div className="p-6 flex flex-col items-center gap-4">
                      <MiniLoader />
                      <p className="text-lg font-semibold text-center text-gray-700">
                        Compiling your results…
                      </p>
                      <p className="text-sm text-center text-gray-500">
                        Please wait while we prepare your feedback. You will be redirected automatically.
                      </p>
                      {!isTestResponse && !isFeedbackSubmitted && (
                        <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                          <AlertDialogTrigger asChild>
                            <Button
                              className="w-full bg-indigo-600 text-white h-10 mt-2"
                              onClick={() => setIsDialogOpen(true)}
                            >
                              Provide Feedback
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Provide Feedback</AlertDialogTitle>
                              <AlertDialogDescription>
                                Your feedback helps us improve the interview experience.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <FeedbackForm email={email} onSubmit={handleFeedbackSubmit} />
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="p-2 font-normal text-base mb-4 whitespace-pre-line">
                        <CheckCircleIcon className="h-[2rem] w-[2rem] mx-auto my-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-indigo-500 " />
                        <p className="text-lg font-semibold text-center">
                          {isTestResponse
                            ? "Test completed. Redirecting to responses..."
                            : "Thank you for completing the interview."}
                        </p>
                      </div>

                      {!isTestResponse && !isFeedbackSubmitted && (
                        <AlertDialog
                          open={isDialogOpen}
                          onOpenChange={setIsDialogOpen}
                        >
                          <AlertDialogTrigger asChild>
                            <Button
                              className="w-full bg-indigo-600 text-white h-10 mt-4 mb-4"
                              onClick={() => setIsDialogOpen(true)}
                            >
                              Provide Feedback
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Provide Feedback</AlertDialogTitle>
                              <AlertDialogDescription>
                                Your feedback helps us improve the interview
                                experience.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <FeedbackForm
                              email={email}
                              onSubmit={handleFeedbackSubmit}
                            />
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
            {isOldUser && (
              <div className="w-fit min-w-[400px] max-w-[400px] mx-auto mt-2  border border-indigo-200 rounded-md p-2 m-2 bg-slate-50  absolute -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2">
                <div>
                  <div className="p-2 font-normal text-base mb-4 whitespace-pre-line">
                    <CheckCircleIcon className="h-[2rem] w-[2rem] mx-auto my-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-indigo-500 " />
                    <p className="text-lg font-semibold text-center">
                      You have already responded in this interview or you are
                      not eligible to respond. Thank you!
                    </p>
                    <p className="text-center">
                      {"\n"}
                      You can close this tab now.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default Call;
