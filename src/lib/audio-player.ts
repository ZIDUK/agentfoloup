/**
 * Audio Player utility for playing audio chunks from Deepgram Voice Agent
 */

export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private audioBuffer: ArrayBuffer[] = [];
  private isPlaying: boolean = false;
  private audioChunkCount: number = 0;
  private nextPlayTime: number = 0; // Schedule next chunk to play at this time

  constructor() {
    // Initialize AudioContext on first use (browser requires user interaction)
  }

  /**
   * Initialize AudioContext (must be called after user interaction)
   */
  async initialize() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 16000 });
    }
    return this.audioContext;
  }

  /**
   * Add audio chunk to buffer
   */
  async addAudioChunk(audioData: ArrayBuffer | Uint8Array | any) {
    // Ensure AudioContext is initialized before adding chunks
    if (!this.audioContext) {
      await this.initialize();
    }

    // Resume AudioContext if suspended (browser autoplay policy)
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log("AudioContext resumed in addAudioChunk");
      } catch (error) {
        console.error("Error resuming AudioContext:", error);
      }
    }

    // Convert to ArrayBuffer if needed
    let arrayBuffer: ArrayBuffer;
    if (audioData instanceof ArrayBuffer) {
      arrayBuffer = audioData;
    } else if (audioData instanceof Uint8Array) {
      arrayBuffer = audioData.buffer;
    } else if ((audioData as any).buffer instanceof ArrayBuffer) {
      arrayBuffer = (audioData as any).buffer;
    } else {
      // Last resort: try to create ArrayBuffer from the data
      console.warn("Converting unknown audio format to ArrayBuffer");
      const uint8 = new Uint8Array(audioData);
      arrayBuffer = uint8.buffer;
    }

    this.audioBuffer.push(arrayBuffer);
    
    // Auto-play if not already playing
    if (!this.isPlaying) {
      // Use requestAnimationFrame to ensure AudioContext is ready
      requestAnimationFrame(() => {
        this.playBufferedAudio();
      });
    }
  }

  /**
   * Play all buffered audio chunks
   */
  private async playBufferedAudio() {
    if (this.isPlaying || this.audioBuffer.length === 0) {
      return;
    }

    // Ensure AudioContext is initialized
    if (!this.audioContext) {
      await this.initialize();
    }

    // Resume AudioContext if suspended (browser autoplay policy)
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
        console.log("AudioContext resumed");
      } catch (error) {
        console.error("Error resuming AudioContext:", error);
      }
    }

    if (!this.audioContext) {
      console.error("AudioContext not available");
      return;
    }

    this.isPlaying = true;

    try {
      // Get current time once for all chunks
      const currentTime = this.audioContext.currentTime;
      if (this.nextPlayTime < currentTime) {
        // If we're behind, start immediately
        this.nextPlayTime = currentTime;
      }

      // Process all buffered chunks and schedule them all at once
      const chunksToPlay: Array<{
        source: AudioBufferSourceNode;
        startTime: number;
        duration: number;
      }> = [];

      while (this.audioBuffer.length > 0) {
        const chunk = this.audioBuffer.shift();
        if (!chunk) continue;

        try {
          // Deepgram sends audio as raw PCM data (linear16)
          // The data can come as ArrayBuffer, we need to convert it properly
          let int16Array: Int16Array;
          
          // Handle different possible formats
          if (chunk instanceof Int16Array) {
            int16Array = chunk;
          } else if (chunk instanceof ArrayBuffer) {
            // Deepgram Voice Agent sends audio as ArrayBuffer containing Int16 PCM data
            // The ArrayBuffer length should be even (2 bytes per sample)
            if (chunk.byteLength % 2 !== 0) {
              console.warn("Audio chunk has odd byte length, truncating");
            }
            int16Array = new Int16Array(chunk, 0, Math.floor(chunk.byteLength / 2));
          } else if (chunk instanceof Uint8Array) {
            // Convert Uint8Array to Int16Array (little-endian)
            const numSamples = Math.floor(chunk.length / 2);
            int16Array = new Int16Array(numSamples);
            for (let i = 0; i < numSamples; i++) {
              const byteIndex = i * 2;
              const low = chunk[byteIndex];
              const high = chunk[byteIndex + 1];
              const unsigned = (high << 8) | low;
              int16Array[i] = unsigned > 32767 ? unsigned - 65536 : unsigned;
            }
          } else {
            // Handle Buffer type (Node.js Buffer, which extends Uint8Array)
            // This is what Deepgram SDK sends in browser context
            const buffer = chunk as any;
            if (buffer instanceof Uint8Array || (buffer.buffer && buffer.buffer instanceof ArrayBuffer)) {
              // It's a Buffer/Uint8Array, convert to Int16Array
              const numSamples = Math.floor(buffer.length / 2);
              int16Array = new Int16Array(numSamples);
              for (let i = 0; i < numSamples; i++) {
                const byteIndex = i * 2;
                const low = buffer[byteIndex];
                const high = buffer[byteIndex + 1];
                const unsigned = (high << 8) | low;
                int16Array[i] = unsigned > 32767 ? unsigned - 65536 : unsigned;
              }
            } else {
              console.warn("Unknown audio format:", chunk.constructor.name, "skipping chunk");
              continue;
            }
          }
          
          if (int16Array.length === 0) {
            console.warn("Empty audio chunk, skipping");
            continue;
          }
          
          // Log first few chunks for debugging
          this.audioChunkCount++;
          if (this.audioChunkCount <= 5) {
            console.log("Processing audio chunk:", {
              chunkNumber: this.audioChunkCount,
              samples: int16Array.length,
              duration: (int16Array.length / 16000).toFixed(3) + "s",
              chunkType: chunk.constructor.name,
              chunkSize: chunk.byteLength || (chunk as any).length,
            });
          }

          // Convert Int16 to Float32 (-1.0 to 1.0)
          const float32Array = new Float32Array(int16Array.length);
          let maxSample = 0;
          for (let i = 0; i < int16Array.length; i++) {
            const normalized = int16Array[i] / 32768.0;
            float32Array[i] = Math.max(-1, Math.min(1, normalized));
            maxSample = Math.max(maxSample, Math.abs(normalized));
          }

          // Log audio level for first few chunks
          if (this.audioChunkCount <= 5) {
            console.log(`Audio chunk ${this.audioChunkCount} - Max sample level: ${maxSample.toFixed(4)}`);
          }

          // Ensure AudioContext is initialized
          if (!this.audioContext) {
            await this.initialize();
          }

          // Resume AudioContext if suspended (browser autoplay policy)
          if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
            console.log("AudioContext resumed in playBufferedAudio");
          }

          // Check AudioContext state
          if (this.audioChunkCount <= 5) {
            console.log(`AudioContext state: ${this.audioContext.state}, sampleRate: ${this.audioContext.sampleRate}`);
          }

          // Create audio buffer with correct sample rate (16000 Hz from Deepgram output)
          const audioBuffer = this.audioContext.createBuffer(
            1, // mono
            float32Array.length,
            16000 // sample rate (matches Deepgram output config)
          );
          
          audioBuffer.getChannelData(0).set(float32Array);
          
          // Create buffer source
          const source = this.audioContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(this.audioContext.destination);

          // Calculate chunk duration
          const chunkDuration = float32Array.length / 16000; // seconds
          
          // Schedule playback to start at nextPlayTime for seamless playback
          const startTime = this.nextPlayTime;
          this.nextPlayTime += chunkDuration; // Schedule next chunk right after this one

          // Store chunk info for scheduling (don't start yet)
          chunksToPlay.push({
            source,
            startTime,
            duration: chunkDuration,
          });

          if (this.audioChunkCount <= 5) {
            console.log(`Audio chunk ${this.audioChunkCount} prepared for scheduling at ${startTime.toFixed(3)}s (${float32Array.length} samples, ${chunkDuration.toFixed(3)}s)`);
          }
        } catch (chunkError) {
          console.error("Error preparing audio chunk:", chunkError);
          // Continue with next chunk
        }
      }

      // Now schedule all chunks at once for seamless playback
      chunksToPlay.forEach(({ source, startTime, duration }, index) => {
        try {
          source.start(startTime);
          if (index < 5) {
            console.log(`Audio chunk ${index + 1} scheduled to start at ${startTime.toFixed(3)}s`);
          }
        } catch (e) {
          console.error(`Error starting audio source ${index}:`, e);
        }
      });

      // Wait for the last chunk to finish (approximate)
      if (chunksToPlay.length > 0) {
        const lastChunk = chunksToPlay[chunksToPlay.length - 1];
        const totalDuration = lastChunk.startTime + lastChunk.duration - chunksToPlay[0].startTime;
        
        // Wait a bit longer than the total duration to ensure all chunks play
        await new Promise(resolve => {
          setTimeout(resolve, (totalDuration * 1000) + 100);
        });
      }
    } catch (error) {
      console.error("Error playing audio:", error);
    } finally {
      this.isPlaying = false;
      
      // Check if more chunks arrived while playing
      if (this.audioBuffer.length > 0) {
        // Use requestAnimationFrame for smoother scheduling
        requestAnimationFrame(() => {
          this.playBufferedAudio();
        });
      }
    }
  }

  /**
   * Clear audio buffer
   */
  clearBuffer() {
    this.audioBuffer = [];
    this.nextPlayTime = 0; // Reset scheduling
  }

  /**
   * Stop and cleanup
   */
  async stop() {
    this.clearBuffer();
    this.nextPlayTime = 0; // Reset scheduling
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    this.isPlaying = false;
  }
}

