"use client";

import { createClient, AgentEvents } from "@deepgram/sdk";

export interface AgentConfig {
  name: string;
  objective: string;
  questions: string[];
  duration: string;
  interviewerName?: string;
  voiceModel?: string;
  interviewerPersonality?: {
    empathy: number;
    rapport: number;
    exploration: number;
    speed: number;
  };
}

export class DeepgramAgentService {
  private connection: any;
  private deepgram: any;
  private audioContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  // Note: ScriptProcessorNode is deprecated but still widely supported
  // AudioWorkletNode is the modern alternative but requires additional setup
  private processor: ScriptProcessorNode | null = null;
  private mediaStream: MediaStream | null = null;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private isConnected: boolean = false;
  private isConfigured: boolean = false;

  constructor(apiKey: string) {
    this.deepgram = createClient(apiKey);
    this.connection = this.deepgram.agent();

    this.connection.on(AgentEvents.Open, () => {
      this.isConnected = true;
    });

    this.connection.on(AgentEvents.Close, () => {
      this.isConnected = false;
      this.isConfigured = false;
    });
  }

  configure(config: AgentConfig) {
    this.connection.on(AgentEvents.Welcome, () => {
      const prompt = this.buildPrompt(config);

      this.connection.configure({
        audio: {
          input: {
            encoding: "linear16",
            sample_rate: 16000,
          },
          output: {
            encoding: "linear16",
            sample_rate: 16000,
            container: "wav",
          },
        },
        agent: {
          language: "en",
          listen: {
            provider: {
              type: "deepgram",
              model: "flux-general-en",
              version: "v2",
              eager_eot_threshold: 0.6,
            },
          },
          think: {
            provider: {
              type: "open_ai",
              model: "gpt-4o-mini",
            },
            prompt: prompt,
          },
          speak: {
            provider: {
              type: "deepgram",
              model: config.voiceModel ?? "aura-2-thalia-en",
            },
          },
          greeting: `Hello ${config.name}! Let's start the interview.`,
        },
      });

      this.isConfigured = true;

      this.keepAliveInterval = setInterval(() => {
        if (this.isConnected && this.connection) {
          try {
            this.connection.keepAlive();
          } catch {
            // keep-alive failure is non-fatal
          }
        }
      }, 5000);
    });
  }

  private buildPrompt(config: AgentConfig): string {
    const personality = config.interviewerPersonality || {
      empathy: 7,
      rapport: 7,
      exploration: 7,
      speed: 5,
    };

    return `You are an AI interviewer conducting a professional interview.

Candidate Information:
- Name: ${config.name}
- Interview Objective: ${config.objective}

Interview Questions to Ask:
${config.questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Interview Guidelines:
- Keep the interview to approximately ${config.duration} minutes
- Ask each question clearly and wait for the candidate's response
- Ask thoughtful follow-up questions based on the candidate's answers
- Be professional, friendly, and ${config.interviewerName || "empathetic"}
- Show empathy level: ${personality.empathy}/10
- Build rapport level: ${personality.rapport}/10
- Explore topics in depth: ${personality.exploration}/10
- Speaking pace: ${personality.speed}/10 (1=slow, 10=fast)

Important:
- Do not repeat questions that have already been asked
- Keep questions concise (30 words or less)
- Use the candidate's name naturally in conversation
- End the interview gracefully when time is up or all questions are covered
- Thank the candidate for their time at the end`;
  }

  async startAudioCapture() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');

      const builtInMic = audioInputs.find(d =>
        d.label.toLowerCase().includes('built-in') ||
        d.label.toLowerCase().includes('internal') ||
        d.label.toLowerCase().includes('macbook')
      );

      const audioConstraints: MediaTrackConstraints = {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: false,
        autoGainControl: false,
      };

      if (builtInMic && builtInMic.deviceId !== 'default') {
        audioConstraints.deviceId = { exact: builtInMic.deviceId };
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });

      // Note: ScriptProcessorNode is deprecated but still the most reliable way
      // to get raw PCM data from MediaStream.
      this.audioContext = new AudioContext();
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);

      // @ts-ignore - ScriptProcessorNode is deprecated but still works
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      this.processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);

        const downsampledData = this.downsample(
          inputData,
          this.audioContext!.sampleRate,
          16000
        );

        const int16Array = this.convertFloat32ToInt16(downsampledData);

        if (this.isConnected && this.isConfigured && this.connection) {
          try {
            this.connection.send(int16Array.buffer);
          } catch {
            // send failure is non-fatal
          }
        }
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    } catch (error) {
      throw error;
    }
  }

  stopAudioCapture() {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }

    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }

  on(event: string, callback: Function) {
    this.connection.on(event, callback);
  }

  removeAllListeners() {
    if (this.connection) {
      this.connection.removeAllListeners();
    }
  }

  private downsample(buffer: Float32Array, fromSampleRate: number, toSampleRate: number): Float32Array {
    if (fromSampleRate === toSampleRate) {
      return buffer;
    }
    const sampleRateRatio = fromSampleRate / toSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;
    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = accum / count;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }
    return result;
  }

  private convertFloat32ToInt16(buffer: Float32Array): Int16Array {
    const length = buffer.length;
    const int16Array = new Int16Array(length);
    for (let i = 0; i < length; i++) {
      int16Array[i] = Math.max(-1, Math.min(1, buffer[i])) * 0x7fff;
    }
    return int16Array;
  }

  close() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }

    this.stopAudioCapture();
    this.isConnected = false;
    this.isConfigured = false;

    if (this.connection) {
      try {
        const ws = (this.connection as any).ws ||
                   (this.connection as any).websocket ||
                   (this.connection as any)._socket ||
                   (this.connection as any).socket;

        if (ws && typeof ws.close === 'function') {
          ws.close();
        }
      } catch {
        // connection closes naturally when media stream stops
      }
    }
  }

  getConnection() {
    return this.connection;
  }
}
