"use client";

import { createClient, AgentEvents } from "@deepgram/sdk";

export interface AgentConfig {
  name: string;
  objective: string;
  questions: string[];
  duration: string;
  interviewerName?: string;
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
    
    // Register Open event handler immediately to track connection state
    this.connection.on(AgentEvents.Open, () => {
      console.log("Deepgram connection opened");
      this.isConnected = true;
    });

    // Register Close event handler immediately
    this.connection.on(AgentEvents.Close, () => {
      console.log("Deepgram connection closed");
      this.isConnected = false;
      this.isConfigured = false;
    });
  }

  /**
   * Configure the agent with interview settings
   */
  configure(config: AgentConfig) {
    this.connection.on(AgentEvents.Welcome, () => {
      console.log("Deepgram Welcome event received, configuring agent...");
      const prompt = this.buildPrompt(config);

      this.connection.configure({
        audio: {
          input: {
            encoding: "linear16",
            sample_rate: 16000, // Match Deepgram official demo
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
              model: "nova-3",
            },
          },
          think: {
            provider: {
              type: "open_ai",
              model: "gpt-4o-mini",
              // Note: Deepgram Voice Agent API currently supports OpenAI and Anthropic
              // Mistral support may require custom integration
            },
            prompt: prompt,
          },
          speak: {
            provider: {
              type: "deepgram",
              model: "aura-2-thalia-en",
            },
          },
          greeting: `Hello ${config.name}! Let's start the interview.`,
        },
      });

      this.isConfigured = true;
      console.log("Deepgram agent configuration sent");

      // Start keep-alive messages after configuration
      this.keepAliveInterval = setInterval(() => {
        if (this.isConnected && this.connection) {
          try {
            this.connection.keepAlive();
          } catch (error) {
            console.error("Error sending keep-alive:", error);
          }
        }
      }, 5000);
    });
  }

  /**
   * Build the prompt for the LLM based on interview configuration
   */
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

  /**
   * Start capturing audio from microphone and sending to Deepgram
   */
  async startAudioCapture() {
    try {
      console.log("Requesting microphone access...");
      
      // First, enumerate devices to see what's available
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      console.log("Available audio input devices:", audioInputs.map(d => ({
        label: d.label,
        deviceId: d.deviceId,
      })));
      
      // Try to use the default device first, but prefer built-in microphone
      const builtInMic = audioInputs.find(d => 
        d.label.toLowerCase().includes('built-in') || 
        d.label.toLowerCase().includes('internal') ||
        d.label.toLowerCase().includes('macbook')
      );
      
      // Match Deepgram official demo settings
      const audioConstraints: MediaTrackConstraints = {
        sampleRate: 16000, // Deepgram expects 16kHz input
        channelCount: 1,
        volume: 1.0,
        echoCancellation: true,
        noiseSuppression: false, // Match official demo
        latency: 0,
      };
      
      // If we found a built-in mic, prefer it
      if (builtInMic && builtInMic.deviceId !== 'default') {
        audioConstraints.deviceId = { exact: builtInMic.deviceId };
        console.log("Using built-in microphone:", builtInMic.label);
      } else {
        console.log("Using default microphone device");
      }
      
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });
      
      console.log("Microphone access granted. Stream active:", this.mediaStream.active);
      const audioTracks = this.mediaStream.getAudioTracks();
      console.log("Audio tracks:", audioTracks.map(t => ({
        label: t.label,
        enabled: t.enabled,
        muted: t.muted,
        readyState: t.readyState,
        settings: t.getSettings(),
      })));
      
      // Check if microphone is muted
      const activeTrack = audioTracks[0];
      if (activeTrack) {
        const settings = activeTrack.getSettings();
        
        // Log device info
        console.log("Active microphone device:", {
          deviceId: settings.deviceId,
          label: activeTrack.label,
          sampleRate: settings.sampleRate,
          channelCount: settings.channelCount,
          echoCancellation: settings.echoCancellation,
          noiseSuppression: settings.noiseSuppression,
          autoGainControl: settings.autoGainControl,
        });
        
        // Check track status
        if (activeTrack.muted) {
          console.error("❌ ERROR: Microphone track is MUTED!");
          console.error("Please unmute your microphone in System Settings > Sound > Input");
        }
        if (!activeTrack.enabled) {
          console.error("❌ ERROR: Microphone track is DISABLED!");
        }
        if (activeTrack.readyState !== 'live') {
          console.error("❌ ERROR: Microphone track is not LIVE. State:", activeTrack.readyState);
        }
        
        // Additional check: monitor track state changes
        activeTrack.addEventListener('mute', () => {
          console.error("❌ Microphone was MUTED during the call!");
        });
        activeTrack.addEventListener('unmute', () => {
          console.log("✅ Microphone was UNMUTED");
        });
      }

      // Use ScriptProcessorNode to capture PCM audio
      // Note: ScriptProcessorNode is deprecated but still the most reliable way
      // to get raw PCM data from MediaStream. AudioWorkletNode is the modern
      // alternative but requires additional setup and worker files.
      // Don't specify sampleRate - let it use system default (usually 48000)
      // We'll downsample to 16000 before sending to Deepgram
      this.audioContext = new AudioContext();
      this.source = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Use createScriptProcessor as fallback (deprecated but functional)
      // @ts-ignore - ScriptProcessorNode is deprecated but still works
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

      let audioChunkCount = 0;
      let warningCount = 0;
      let lastAudioLevel = 0;
      let silentChunkCount = 0;
      
      this.processor.onaudioprocess = (e) => {
        // Always process audio, but only send if connection is ready and configured
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Downsample from AudioContext sample rate (usually 48000) to 16000
        const downsampledData = this.downsample(
          inputData,
          this.audioContext!.sampleRate,
          16000
        );
        
        // Convert Float32 to Int16 (matching Deepgram official demo)
        const int16Array = this.convertFloat32ToInt16(downsampledData);

        // Calculate audio level to detect if microphone is working
        let maxLevel = 0;
        for (let i = 0; i < inputData.length; i++) {
          const level = Math.abs(inputData[i]);
          maxLevel = Math.max(maxLevel, level);
        }

        // Track audio levels (use a more realistic threshold)
        // Normal speech should be > 0.01, loud speech > 0.1
        if (maxLevel > 0.005) {
          // Audio detected
          silentChunkCount = 0;
          lastAudioLevel = maxLevel;
        } else {
          silentChunkCount++;
        }
        
        // Warn if microphone seems to not be working (after 50 chunks = ~1 second)
        if (audioChunkCount === 50 && lastAudioLevel < 0.01) {
          console.warn("⚠️ WARNING: Microphone audio level is very low:", lastAudioLevel.toFixed(4));
          console.warn("Expected levels: Normal speech > 0.01, Loud speech > 0.1");
          console.warn("Please check:");
          console.warn("1. Microphone is not muted in System Settings > Sound > Input");
          console.warn("2. Microphone volume/gain is not set too low");
          console.warn("3. You are speaking into the microphone");
          console.warn("4. Microphone is selected as input device");
          console.warn("5. If using AirPods/Bluetooth, ensure microphone is enabled");
          
          // Check track status
          if (this.mediaStream) {
            const tracks = this.mediaStream.getAudioTracks();
            tracks.forEach((track, index) => {
              const currentSettings = track.getSettings();
              console.warn(`Track ${index} status:`, {
                label: track.label,
                muted: track.muted,
                enabled: track.enabled,
                readyState: track.readyState,
                volume: currentSettings.volume,
                deviceId: currentSettings.deviceId,
              });
            });
          }
        }
        
        // Additional warning if consistently silent (after 200 chunks = ~4 seconds)
        if (audioChunkCount === 200 && silentChunkCount > 190) {
          console.error("❌ ERROR: Microphone appears to not be capturing audio!");
          console.error("Last audio level:", lastAudioLevel.toFixed(4), "(expected > 0.01 for normal speech)");
          console.error("Silent chunks:", silentChunkCount, "out of", audioChunkCount);
          console.error("");
          console.error("TROUBLESHOOTING STEPS:");
          console.error("1. Open System Settings > Sound > Input");
          console.error("2. Check that your microphone is not muted (slider should be visible)");
          console.error("3. Speak into the microphone and watch the input level meter");
          console.error("4. If the meter doesn't move, your microphone may be muted or not working");
          console.error("5. Try selecting a different input device");
          console.error("6. Check macOS microphone permissions in System Settings > Privacy & Security > Microphone");
          
          // Final track status check
          if (this.mediaStream) {
            const tracks = this.mediaStream.getAudioTracks();
            tracks.forEach((track, index) => {
              console.error(`Final Track ${index} status:`, {
                label: track.label,
                muted: track.muted,
                enabled: track.enabled,
                readyState: track.readyState,
              });
            });
          }
        }

        // Check if connection is ready and configured
        if (this.isConnected && this.isConfigured && this.connection) {
          try {
            this.connection.send(int16Array.buffer);
            audioChunkCount++;
            // Log first few chunks to confirm audio is being sent
            if (audioChunkCount <= 5) {
              console.log(`Audio chunk ${audioChunkCount} sent to Deepgram (${int16Array.length} samples, level: ${maxLevel.toFixed(4)})`);
            }
            // Log every 100 chunks to monitor audio levels
            if (audioChunkCount % 100 === 0) {
              console.log(`Audio monitoring: ${audioChunkCount} chunks sent, last level: ${lastAudioLevel.toFixed(4)}, silent chunks: ${silentChunkCount}`);
            }
          } catch (error) {
            console.error("Error sending audio to Deepgram:", error);
          }
        } else {
          // Log when connection is not ready (only first few times to avoid spam)
          if (warningCount < 3) {
            console.warn("Connection not ready, audio not being sent.", {
              isConnected: this.isConnected,
              isConfigured: this.isConfigured,
              hasConnection: !!this.connection,
            });
            warningCount++;
          }
        }
      };

      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
    } catch (error) {
      console.error("Error starting audio capture:", error);
      throw error;
    }
  }

  /**
   * Stop audio capture
   */
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

  /**
   * Setup event handlers
   */
  on(event: string, callback: Function) {
    this.connection.on(event, callback);
  }

  /**
   * Remove event listeners
   */
  removeAllListeners() {
    if (this.connection) {
      this.connection.removeAllListeners();
    }
  }

  /**
   * Downsample audio from one sample rate to another
   * Based on Deepgram official demo implementation
   */
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

  /**
   * Convert Float32 audio buffer to Int16 PCM
   * Based on Deepgram official demo implementation
   */
  private convertFloat32ToInt16(buffer: Float32Array): Int16Array {
    const length = buffer.length;
    const int16Array = new Int16Array(length);
    for (let i = 0; i < length; i++) {
      // Clamp to [-1, 1] and convert to Int16 range [-32768, 32767]
      int16Array[i] = Math.max(-1, Math.min(1, buffer[i])) * 0x7fff;
    }
    return int16Array;
  }

  /**
   * Close the connection
   */
  close() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }

    this.stopAudioCapture();
    this.isConnected = false;
    this.isConfigured = false;

    // Deepgram agent connection will close naturally when audio stops
    // The connection object doesn't have a direct close() method
    // Stopping the media stream will trigger the Close event
    if (this.connection) {
      try {
        // Try to access the underlying WebSocket if available
        const ws = (this.connection as any).ws || 
                   (this.connection as any).websocket || 
                   (this.connection as any)._socket ||
                   (this.connection as any).socket;
        
        if (ws && typeof ws.close === 'function') {
          ws.close();
        }
      } catch (error) {
        // Connection will close naturally when media stream stops
        console.log("Connection will close naturally");
      }
    }
  }

  /**
   * Get the connection object (for advanced usage)
   */
  getConnection() {
    return this.connection;
  }
}

