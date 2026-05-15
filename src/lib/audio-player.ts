export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private recordingDestination: MediaStreamAudioDestinationNode | null = null;
  private audioBuffer: ArrayBuffer[] = [];
  private isPlaying: boolean = false;
  private audioChunkCount: number = 0;
  private nextPlayTime: number = 0;
  private isStopped: boolean = false;

  constructor() {}

  async initialize() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 16000 });
    }
    if (!this.recordingDestination) {
      this.recordingDestination = this.audioContext.createMediaStreamDestination();
    }
    return this.audioContext;
  }

  getRecordingStream(): MediaStream | null {
    return this.recordingDestination?.stream ?? null;
  }

  async addAudioChunk(audioData: ArrayBuffer | Uint8Array | any) {
    if (this.isStopped) return;
    if (!this.audioContext) {
      await this.initialize();
    }

    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume().catch(() => {});
    }

    let arrayBuffer: ArrayBuffer;
    if (audioData instanceof ArrayBuffer) {
      arrayBuffer = audioData;
    } else if (audioData instanceof Uint8Array) {
      arrayBuffer = audioData.buffer as ArrayBuffer;
    } else if ((audioData as any).buffer instanceof ArrayBuffer) {
      arrayBuffer = (audioData as any).buffer;
    } else {
      const uint8 = new Uint8Array(audioData);
      arrayBuffer = uint8.buffer;
    }

    this.audioBuffer.push(arrayBuffer);

    if (!this.isPlaying) {
      requestAnimationFrame(() => {
        this.playBufferedAudio();
      });
    }
  }

  private async playBufferedAudio() {
    if (this.isPlaying || this.audioBuffer.length === 0) {
      return;
    }

    if (!this.audioContext) {
      await this.initialize();
    }

    if (this.audioContext && this.audioContext.state === 'suspended') {
      await this.audioContext.resume().catch(() => {});
    }

    if (!this.audioContext) return;

    this.isPlaying = true;

    try {
      const currentTime = this.audioContext.currentTime;
      if (this.nextPlayTime < currentTime) {
        this.nextPlayTime = currentTime;
      }

      const chunksToPlay: Array<{
        source: AudioBufferSourceNode;
        startTime: number;
        duration: number;
      }> = [];

      while (this.audioBuffer.length > 0) {
        const chunk = this.audioBuffer.shift() as ArrayBuffer | Int16Array | Uint8Array | undefined;
        if (!chunk) continue;

        try {
          let int16Array: Int16Array;

          if (chunk instanceof Int16Array) {
            int16Array = chunk;
          } else if (chunk instanceof ArrayBuffer) {
            int16Array = new Int16Array(chunk, 0, Math.floor(chunk.byteLength / 2));
          } else if (chunk instanceof Uint8Array) {
            const numSamples = Math.floor(chunk.length / 2);
            int16Array = new Int16Array(numSamples);
            for (let i = 0; i < numSamples; i++) {
              const byteIndex = i * 2;
              const unsigned = (chunk[byteIndex + 1] << 8) | chunk[byteIndex];
              int16Array[i] = unsigned > 32767 ? unsigned - 65536 : unsigned;
            }
          } else {
            const buffer = chunk as any;
            if (buffer instanceof Uint8Array || (buffer.buffer && buffer.buffer instanceof ArrayBuffer)) {
              const numSamples = Math.floor(buffer.length / 2);
              int16Array = new Int16Array(numSamples);
              for (let i = 0; i < numSamples; i++) {
                const byteIndex = i * 2;
                const unsigned = (buffer[byteIndex + 1] << 8) | buffer[byteIndex];
                int16Array[i] = unsigned > 32767 ? unsigned - 65536 : unsigned;
              }
            } else {
              continue;
            }
          }

          if (int16Array.length === 0) continue;

          this.audioChunkCount++;

          const float32Array = new Float32Array(int16Array.length);
          for (let i = 0; i < int16Array.length; i++) {
            float32Array[i] = Math.max(-1, Math.min(1, int16Array[i] / 32768.0));
          }

          if (!this.audioContext) {
            await this.initialize();
          }

          if (this.audioContext!.state === 'suspended') {
            await this.audioContext!.resume().catch(() => {});
          }

          const audioBuffer = this.audioContext!.createBuffer(1, float32Array.length, 16000);
          audioBuffer.getChannelData(0).set(float32Array);

          const source = this.audioContext!.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(this.audioContext!.destination);
          if (this.recordingDestination) {
            source.connect(this.recordingDestination);
          }

          const chunkDuration = float32Array.length / 16000;
          const startTime = this.nextPlayTime;
          this.nextPlayTime += chunkDuration;

          chunksToPlay.push({ source, startTime, duration: chunkDuration });
        } catch {
          // skip malformed chunk
        }
      }

      chunksToPlay.forEach(({ source, startTime }) => {
        try {
          source.start(startTime);
        } catch {
          // skip unschedulable chunk
        }
      });

      if (chunksToPlay.length > 0) {
        const lastChunk = chunksToPlay[chunksToPlay.length - 1];
        const totalDuration = lastChunk.startTime + lastChunk.duration - chunksToPlay[0].startTime;
        await new Promise(resolve => setTimeout(resolve, totalDuration * 1000 + 100));
      }
    } catch {
      // audio playback failure is non-fatal
    } finally {
      this.isPlaying = false;
      if (this.audioBuffer.length > 0) {
        requestAnimationFrame(() => {
          this.playBufferedAudio();
        });
      }
    }
  }

  clearBuffer() {
    this.audioBuffer = [];
    this.nextPlayTime = 0;
  }

  async stop() {
    this.isStopped = true;
    this.clearBuffer();
    this.nextPlayTime = 0;
    this.isPlaying = false;
    this.recordingDestination = null;
    if (this.audioContext) {
      const ctx = this.audioContext;
      this.audioContext = null;
      ctx.close().catch(() => {});
    }
  }
}
