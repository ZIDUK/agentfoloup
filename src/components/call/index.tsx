"use client";

import {
  ArrowUpRightSquareIcon,
  AlarmClockIcon,
  XCircleIcon,
  CheckCircleIcon,
} from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { useResponses } from "@/contexts/responses.context";
import Image from "next/image";
import axios from "axios";
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

type InterviewProps = {
  interview: Interview;
};

type registerCallResponseType = {
  data: {
    registerCallResponse: {
      call_id: string;
      access_token: string;
    };
  };
};

type transcriptType = {
  role: string;
  content: string;
};

function Call({ interview }: InterviewProps) {
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
  const [email, setEmail] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [isValidEmail, setIsValidEmail] = useState<boolean>(false);
  const [isOldUser, setIsOldUser] = useState<boolean>(false);
  const [callId, setCallId] = useState<string>("");
  const [callStartTime, setCallStartTime] = useState<number | null>(null);
  const { tabSwitchCount } = useTabSwitchPrevention();
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
      // setting time from 0 to 1 every 10 milisecond using javascript setInterval method
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

    // Initialize audio player
    const player = new AudioPlayer();
    setAudioPlayer(player);
    audioPlayerRef.current = player; // Update ref immediately
    
    // Pre-initialize AudioContext on user interaction (required by browsers)
    const initAudio = async () => {
      try {
        await player.initialize();
        console.log("AudioPlayer initialized");
      } catch (error) {
        console.error("Error initializing AudioPlayer:", error);
      }
    };
    
    // Initialize on first user interaction
    const handleInteraction = () => {
      initAudio();
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('touchstart', handleInteraction);
    };
    
    document.addEventListener('click', handleInteraction, { once: true });
    document.addEventListener('touchstart', handleInteraction, { once: true });

    // Setup Deepgram Voice Agent event handlers
    agentService.on(AgentEvents.Open, () => {
      console.log("Connection opened");
      setIsCalling(true);
    });

    agentService.on(AgentEvents.Close, () => {
      console.log("Connection closed");
      setIsCalling(false);
      setIsEnded(true);
    });

    agentService.on(AgentEvents.ConversationText, async (data: any) => {
      console.log("ConversationText event received:", data);
      
      // Handle different formats of ConversationText event
      // Format 1: { role: "user" | "assistant", content: "text" }
      // Format 2: { agent: { text: "..." }, user: { text: "..." } }
      let role: string | null = null;
      let content: string | null = null;
      
      if (data.role && data.content) {
        // Format 1: Direct role and content
        role = data.role;
        content = data.content;
      } else if (data.agent?.text) {
        // Format 2: Agent text
        role = "agent";
        content = data.agent.text;
      } else if (data.user?.text) {
        // Format 2: User text
        role = "user";
        content = data.user.text;
      }
      
      if (role && content) {
        if (role === "agent" || role === "assistant") {
          setLastInterviewerResponse(content);
          setActiveTurn("agent");
          // Add to transcript (avoid duplicates)
          setTranscript((prev) => {
            // Check if this is a duplicate (same content as last entry)
            const lastEntry = prev[prev.length - 1];
            if (lastEntry?.role === "agent" && lastEntry?.content === content) {
              return prev; // Skip duplicate
            }
            const newTranscript = [
              ...prev,
              { role: "agent", content: content },
            ];
            console.log("Transcript updated with agent text. Total entries:", newTranscript.length);
            return newTranscript;
          });
        } else if (role === "user") {
          setLastUserResponse(content);
          setActiveTurn("user");
          // Add to transcript (avoid duplicates)
          setTranscript((prev) => {
            // Check if this is a duplicate (same content as last entry)
            const lastEntry = prev[prev.length - 1];
            if (lastEntry?.role === "user" && lastEntry?.content === content) {
              return prev; // Skip duplicate
            }
            const newTranscript = [
              ...prev,
              { role: "user", content: content },
            ];
            console.log("Transcript updated with user text. Total entries:", newTranscript.length);
            return newTranscript;
          });
        }
      }
    });

    agentService.on(AgentEvents.UserStartedSpeaking, () => {
      console.log("User started speaking - Deepgram detected user speech");
      setActiveTurn("user");
      // Clear audio buffer when user starts speaking (interrupt agent)
      if (audioPlayerRef.current) {
        audioPlayerRef.current.clearBuffer();
      }
    });

    // Handle EndOfThought event (LLM finished thinking)
    // Note: This event may not be in AgentEvents enum, so we use string directly
    agentService.on("EndOfThought" as any, () => {
      console.log("EndOfThought - LLM finished processing");
      // This is a good time to show "thinking" indicator if needed
    });

    // Handle AgentStartedSpeaking event (with latency metrics)
    // Note: This event may not be in AgentEvents enum, so we use string directly
    agentService.on("AgentStartedSpeaking" as any, (data: any) => {
      console.log("AgentStartedSpeaking:", data);
      setActiveTurn("agent");
      if (data) {
        console.log("Latency metrics:", {
          tts_latency: data.tts_latency,
          ttt_latency: data.ttt_latency,
          total_latency: data.total_latency,
        });
      }
    });

    agentService.on(AgentEvents.Audio, async (audioData: any) => {
      console.log("Audio chunk received", {
        size: audioData.byteLength || (audioData as any).length,
        type: audioData.constructor.name,
        isArrayBuffer: audioData instanceof ArrayBuffer,
        isBuffer: (audioData as any).buffer !== undefined,
      });
      setActiveTurn("agent");
      
      // Get current audioPlayer from ref (always up-to-date)
      let player = audioPlayerRef.current;
      if (!player) {
        console.log("Creating AudioPlayer on-the-fly for audio chunk");
        player = new AudioPlayer();
        setAudioPlayer(player);
        audioPlayerRef.current = player; // Update ref immediately
      }
      
      try {
        // Convert Buffer to ArrayBuffer if needed
        let arrayBuffer: ArrayBuffer;
        if (audioData instanceof ArrayBuffer) {
          arrayBuffer = audioData;
        } else if ((audioData as any).buffer instanceof ArrayBuffer) {
          // It's a Buffer/Uint8Array, get the underlying ArrayBuffer
          arrayBuffer = (audioData as any).buffer as ArrayBuffer;
        } else if (audioData instanceof Uint8Array) {
          // Uint8Array.buffer is ArrayBufferLike, but we know it's ArrayBuffer in this context
          arrayBuffer = audioData.buffer.slice(0) as ArrayBuffer;
        } else {
          // Try to convert to ArrayBuffer
          console.warn("Unknown audio format, attempting conversion");
          const converted = await audioData.arrayBuffer?.() || new Uint8Array(audioData).buffer;
          arrayBuffer = converted as ArrayBuffer;
        }
        
        // Add audio chunk (will initialize and play automatically)
        await player.addAudioChunk(arrayBuffer);
      } catch (error) {
        console.error("Error adding audio chunk:", error);
      }
    });

    agentService.on(AgentEvents.AgentAudioDone, () => {
      console.log("Agent audio done");
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

  const startConversation = async () => {
    const data = {
      mins: interview?.time_duration,
      objective: interview?.objective,
      questions: interview?.questions.map((q) => q.question).join(", "),
      name: name || "not provided",
    };
    setLoading(true);

    const oldUserEmails: string[] = (
      await ResponseService.getAllEmails(interview.id)
    ).map((item) => item.email);
    const OldUser =
      oldUserEmails.includes(email) ||
      (interview?.respondents && !interview?.respondents.includes(email));

    if (OldUser) {
      setIsOldUser(true);
      setLoading(false);

      return;
    }

    try {
      // Get interviewer details for personality
      const interviewer = await InterviewerService.getInterviewer(
        interview.interviewer_id
      );

      // Initialize Deepgram Agent Service
      const apiKey = process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY || "";
      if (!apiKey) {
        toast.error("Deepgram API key not configured");
        setLoading(false);

        return;
      }

      const agent = new DeepgramAgentService(apiKey);
      setAgentService(agent);

      // Generate call ID
      const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setCallId(callId);
      setCallStartTime(Date.now());
      setTranscript([]); // Reset transcript for new call

      // Configure agent with interview data
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

      // Wait for connection to open before starting audio capture
      await new Promise<void>((resolve) => {
        agent.on(AgentEvents.Open, () => {
          console.log("Connection opened, starting audio capture...");
          resolve();
        });
      });

      // Initialize audio player immediately when starting conversation
      // This ensures it's ready when audio chunks arrive
      // We need to get the current audioPlayer from ref or create a new one
      let player = audioPlayerRef.current;
      if (!player) {
        console.log("Creating new AudioPlayer for conversation");
        player = new AudioPlayer();
        setAudioPlayer(player);
        audioPlayerRef.current = player; // Update ref immediately
      }
      
      try {
        await player.initialize();
        console.log("AudioPlayer initialized for conversation");
      } catch (error) {
        console.error("Error initializing AudioPlayer:", error);
      }

      // Start audio capture after connection is open
      try {
        await agent.startAudioCapture();
        console.log("Audio capture started successfully");
        
        // Check microphone status after a short delay
        setTimeout(() => {
          navigator.mediaDevices.enumerateDevices().then(devices => {
            const audioInputs = devices.filter(d => d.kind === 'audioinput');
            console.log("Available audio input devices:", audioInputs.map(d => ({
              label: d.label,
              deviceId: d.deviceId,
            })));
          });
        }, 1000);
      } catch (error) {
        console.error("Failed to start audio capture:", error);
        toast.error("Failed to access microphone. Please check permissions and try again.");
        throw error;
      }

      // Create response record
        const response = await createResponse({
          interview_id: interview.id,
        call_id: callId,
          email: email,
          name: name,
        });

      setIsStarted(true);
      setIsCalling(true);
    } catch (error) {
      console.error("Error starting conversation:", error);
      toast.error("Failed to start interview. Please try again.");
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

  useEffect(() => {
    if (isEnded && callId && callStartTime) {
      const updateInterview = async () => {
        console.log("Saving interview response...", {
          transcriptEntries: transcript.length,
          transcriptPreview: transcript.slice(0, 3),
          callId: callId,
          interviewId: interview.id,
        });
        
        // Build transcript string from transcript array
        const transcriptString = transcript
          .map((t) => `${t.role === "agent" ? "Interviewer" : "Candidate"}: ${t.content}`)
          .join("\n");

        console.log("Transcript string length:", transcriptString.length);
        console.log("Transcript preview:", transcriptString.substring(0, 200));

        // Calculate duration
        const endTime = Date.now();
        const duration = Math.round((endTime - callStartTime) / 1000);

        try {
          const result = await ResponseService.saveResponse(
            {
              is_ended: true,
              tab_switch_count: tabSwitchCount,
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
          
          console.log("Response saved successfully", result);
          
          // Redirect to interview page after a short delay to allow save to complete
          setTimeout(() => {
            window.location.href = `/interviews/${interview.id}?call=${callId}`;
          }, 1000);
        } catch (error) {
          console.error("Error saving response:", error);
          toast.error("Error saving interview. Please try again.");
        }
      };

      updateInterview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEnded, callId, transcript, tabSwitchCount, callStartTime]);

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-100">
      {isStarted && <TabSwitchWarning />}
      <div className="bg-white rounded-md md:w-[80%] w-[90%]">
        <Card className="h-[88vh] rounded-lg border-2 border-b-4 border-r-4 border-black text-xl font-bold transition-all  md:block dark:border-white ">
          <div>
            <div className="m-4 h-[15px] rounded-lg border-[1px]  border-black">
              <div
                className=" bg-indigo-600 h-[15px] rounded-lg"
                style={{
                  width: isEnded
                    ? "100%"
                    : `${
                        (Number(currentTimeDuration) /
                          (Number(interviewTimeDuration) * 60)) *
                        100
                      }%`,
                }}
              />
            </div>
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
                    <p className="font-bold text-sm">
                      {"\n"}Ensure your volume is up and grant microphone access
                      when prompted. Additionally, please make sure you are in a
                      quiet environment.
                      {"\n\n"}Note: Tab switching will be recorded.
                    </p>
                  </div>
                  {!interview?.is_anonymous && (
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
                          className="h-fit mb-4 mx-auto py-2 border-2 rounded-md w-[75%] self-center px-2 border-gray-400 text-sm font-normal"
                          placeholder="Enter your first name"
                          onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="w-[80%] flex flex-row mx-auto justify-center items-center align-middle">
                  <Button
                    className="min-w-20 h-10 rounded-lg flex flex-row justify-center mb-8"
                    style={{
                      backgroundColor: interview.theme_color ?? "#4F46E5",
                      color: isLightColor(interview.theme_color ?? "#4F46E5")
                        ? "black"
                        : "white",
                    }}
                    disabled={
                      Loading ||
                      (!interview?.is_anonymous && (!isValidEmail || !name))
                    }
                    onClick={startConversation}
                  >
                    {!Loading ? "Start Interview" : <MiniLoader />}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        className="bg-white border ml-2 text-black min-w-15 h-10 rounded-lg flex flex-row justify-center mb-8"
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
                          This action will exit the interview. You can start a new interview later.
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
                      className="w-full bg-white text-black border border-indigo-600 h-10 mx-auto flex flex-row justify-center mb-8"
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

            {isEnded && !isOldUser && (
              <div className="w-fit min-w-[400px] max-w-[400px] mx-auto mt-2  border border-indigo-200 rounded-md p-2 m-2 bg-slate-50  absolute -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2">
                <div>
                  <div className="p-2 font-normal text-base mb-4 whitespace-pre-line">
                    <CheckCircleIcon className="h-[2rem] w-[2rem] mx-auto my-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-indigo-500 " />
                    <p className="text-lg font-semibold text-center">
                      {isStarted
                        ? `Thank you for taking the time to participate in this interview`
                        : "Thank you very much for considering."}
                    </p>
                    <p className="text-center">
                      {"\n"}
                      You can close this tab now.
                    </p>
                  </div>

                  {!isFeedbackSubmitted && (
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
                            Your feedback helps us improve the interview experience.
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
        <a
          className="flex flex-row justify-center align-middle mt-3"
          href="https://folo-up.co/"
          target="_blank"
        >
          <div className="text-center text-md font-semibold mr-2  ">
            Powered by{" "}
            <span className="font-bold">
              Folo<span className="text-indigo-600">Up</span>
            </span>
          </div>
          <ArrowUpRightSquareIcon className="h-[1.5rem] w-[1.5rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-indigo-500 " />
        </a>
      </div>
    </div>
  );
}

export default Call;
