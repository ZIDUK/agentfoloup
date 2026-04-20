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
import { ResponseService } from "@/services/responses.service";
import { Interview } from "@/types/interview";
import { FeedbackData } from "@/types/response";
import { FeedbackService } from "@/services/feedback.service";
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
import { InterviewerService } from "@/services/interviewers.service";
import { DeepgramAgentService } from "@/services/deepgram-agent.service";
import { AudioPlayer } from "@/lib/audio-player";
import { AgentEvents } from "@deepgram/sdk";
import { useCameraRecording } from "@/hooks/useCameraRecording";

type InterviewProps = {
  interview: Interview;
  applicationId?: string;
  isTestResponse?: boolean;
  prefillEmail?: string;
  prefillName?: string;
};

type transcriptType = {
  role: string;
  content: string;
};

function Call({ interview, applicationId, isTestResponse = false, prefillEmail = "", prefillName = "" }: InterviewProps) {
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
  const [callId, setCallId] = useState<string>("");
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const [isFeedbackSubmitted, setIsFeedbackSubmitted] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [interviewerImg, setInterviewerImg] = useState("");
  const [interviewTimeDuration, setInterviewTimeDuration] =
    useState<string>("1");
  const [time, setTime] = useState(0);
  const [currentTimeDuration, setCurrentTimeDuration] = useState<string>("0");
  const [agentService, setAgentService] = useState<DeepgramAgentService | null>(null);
  const [audioPlayer, setAudioPlayer] = useState<AudioPlayer | null>(null);
  const audioPlayerRef = useRef<AudioPlayer | null>(null);
  const [isCameraCovered, setIsCameraCovered] = useState(false);
  const cameraCoveredRef = useRef(false);

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

  const lastUserResponseRef = useRef<HTMLDivElement | null>(null);

  const handleFeedbackSubmit = async (
    formData: Omit<FeedbackData, "interview_id">,
  ) => {
    try {
      const result = await FeedbackService.submitFeedback({
        ...formData,
        interview_id: interview.id,
      });

      if (result) {
        toast.success("Thank you for your feedback!");
        setIsFeedbackSubmitted(true);
        setIsDialogOpen(false);
      } else {
        toast.error("Failed to submit feedback. Please try again.");
      }
    } catch (error) {
      console.error("Error submitting feedback:", error);
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
        audioPlayerRef.current.stop().catch(console.error);
      }
      setIsEnded(true);
    }

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCalling, time, currentTimeDuration]);

  useEffect(() => {
    if (testEmail(email)) {
      setIsValidEmail(true);
    }
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
      } catch (error) {
        console.error("Error initializing AudioPlayer:", error);
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
      } catch (error) {
        console.error("Error adding audio chunk:", error);
      }
    });

    agentService.on(AgentEvents.AgentAudioDone, () => {
      setActiveTurn("user");
    });

    agentService.on(AgentEvents.Error, (error: any) => {
      console.error("Deepgram Agent Error:", error);
      agentService.close();
      setIsEnded(true);
      setIsCalling(false);
      toast.error("An error occurred during the call");
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
    if (isStarted && agentService) {
      setLoading(true);
      agentService.close();
      if (audioPlayerRef.current) {
        await audioPlayerRef.current.stop();
      }
      setIsEnded(true);
      setLoading(false);
    } else {
      setIsEnded(true);
    }
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
      .then(({ exists }) => { if (exists) setIsOldUser(true); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  // Detect covered camera during interview by sampling video frame brightness.
  useEffect(() => {
    if (!isStarted || isEnded || !cameraStream) return;
    let blackFrameCount = 0;
    const checkFrame = () => {
      const video = cameraVideoRef.current;
      if (!video || video.readyState < 2) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 48;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0, 64, 48);
        const { data } = ctx.getImageData(0, 0, 64, 48);
        let sum = 0;
        for (let i = 0; i < data.length; i += 4) {
          sum += (data[i] + data[i + 1] + data[i + 2]) / 3;
        }
        const avgBrightness = sum / (data.length / 4);
        if (avgBrightness < 15) {
          blackFrameCount++;
          if (blackFrameCount >= 3) {
            setIsCameraCovered(true);
            cameraCoveredRef.current = true;
          }
        } else {
          blackFrameCount = 0;
          setIsCameraCovered(false);
        }
      } catch { /* ignore canvas security errors */ }
    };
    const id = setInterval(checkFrame, 2000);
    return () => clearInterval(id);
  }, [isStarted, isEnded, cameraStream]);

  const startConversation = async () => {
    if (!isTestResponse) {
      const oldUserEmails: string[] = (
        await ResponseService.getAllEmails(interview.id)
      ).map((item: { email: string }) => item.email);
      const OldUser =
        oldUserEmails.includes(email) ||
        (interview?.respondents && !interview?.respondents.includes(email));

      if (OldUser) {
        setIsOldUser(true);
        return;
      }

      // If this interview was opened via a DreamIT application link, block if already submitted
      if (applicationId) {
        const checkRes = await fetch("/api/check-response", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicationId }),
        });
        const { exists } = await checkRes.json();
        if (exists) {
          setIsOldUser(true);
          return;
        }
      }
    }

    setLoading(true);

    try {
      // Request camera access for recording (non-blocking — denied = no recording).
      const stream = await requestCameraAccess();

      const interviewer = await InterviewerService.getInterviewer(
        interview.interviewer_id,
      );

      const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY || "";
      if (!apiKey) {
        toast.error("Deepgram API key not configured");
        setLoading(false);
        return;
      }

      const agent = new DeepgramAgentService(apiKey);
      setAgentService(agent);

      const newCallId = `call_${Date.now()}_${Math.random()
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
      } catch (error) {
        console.error("Error initializing AudioPlayer:", error);
      }

      try {
        await agent.startAudioCapture();
      } catch (error) {
        console.error("Failed to start audio capture:", error);
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

      await createResponse({
        interview_id: interview.id,
        call_id: newCallId,
        email: email,
        name: name,
        ...(applicationId ? { application_id: applicationId } : {}),
        ...(isTestResponse ? { is_test_response: true } : {}),
      });

      setIsStarted(true);
      setIsCalling(true);
    } catch (error) {
      console.error("Error starting conversation:", error);
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
      const interviewer = await InterviewerService.getInterviewer(
        interview.interviewer_id,
      );
      setInterviewerImg(interviewer.image);
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

        try {
          await ResponseService.saveResponse(
            {
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
            },
            callId,
          );

          // Trigger analysis immediately after save — keepalive ensures the request
          // completes even if the user closes the tab before the redirect fires.
          fetch("/api/get-call", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: callId }),
            keepalive: true,
          }).catch(() => {});

          setTimeout(() => {
            window.location.href = isTestResponse
              ? `/interviews/${interview.id}`
              : `/result/${callId}`;
          }, 1000);
        } catch (error) {
          console.error("Error saving response:", error);
          toast.error("Error saving interview. Please try again.");
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
            {!isStarted && !isEnded && !isOldUser && (
              <div className="w-fit min-w-[400px] max-w-[400px] mx-auto mt-2  border border-indigo-200 rounded-md p-2 m-2 bg-slate-50">
                <div>
                  {interview?.logo_url && (
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
                      {cameraError && (
                        <p className="mt-1 text-red-600 flex items-center gap-1">
                          <VideoOffIcon className="h-3 w-3" />
                          {cameraError} The interview will continue without video recording.
                        </p>
                      )}
                    </div>
                  </div>
                  {!interview?.is_anonymous && (
                    isTestResponse ? (
                      <div className="text-center text-sm text-gray-600 py-2">
                        Testing as: <span className="font-semibold">{name}</span> ({email})
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 justify-center">
                        <div className="flex justify-center">
                          <input
                            value={email}
                            className="h-fit mx-auto py-2 border-2 rounded-md w-[75%] self-center px-2 border-gray-400 text-sm font-normal"
                            placeholder="Enter your email address"
                            onChange={(e) => setEmail(e.target.value)}
                          />
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
                    )
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
                      (!isTestResponse && !interview?.is_anonymous && (!isValidEmail || !name))
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
                      {interviewerImg ? (
                        <Image
                          src={interviewerImg}
                          alt="Image of the interviewer"
                          width={120}
                          height={120}
                          className={`object-cover object-center mx-auto my-auto ${
                            activeTurn === "agent"
                              ? `border-4 border-[${interview.theme_color}] rounded-full`
                              : ""
                          }`}
                        />
                      ) : (
                        <div className="w-[120px] h-[120px] bg-gray-200 rounded-full flex items-center justify-center text-gray-400">
                          No Image
                        </div>
                      )}
                      <div className="font-semibold">Interviewer</div>
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
                  <div className="p-2 font-normal text-base mb-4 whitespace-pre-line">
                    <CheckCircleIcon className="h-[2rem] w-[2rem] mx-auto my-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-indigo-500 " />
                    <p className="text-lg font-semibold text-center">
                      {isTestResponse
                        ? "Test completed. Redirecting to responses..."
                        : isStarted
                        ? `Thank you for taking the time to participate in this interview`
                        : "Thank you very much for considering."}
                    </p>
                    {!isTestResponse && (
                      <p className="text-center">
                        {"\n"}
                        You can close this tab now.
                      </p>
                    )}
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
