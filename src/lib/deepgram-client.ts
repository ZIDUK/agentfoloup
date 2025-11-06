/**
 * Deepgram WebSocket client for real-time transcription
 * This is a client-side utility for connecting to Deepgram Live API
 */

export class DeepgramClient {
  private socket: WebSocket | null = null;
  private listeners: Map<string, Function[]> = new Map();
  private isConnected: boolean = false;
  private transcript: string = "";
  private interimTranscript: string = "";

  constructor(private apiKey: string) {}

  /**
   * Connect to Deepgram Live API
   */
  async connect(options: {
    model?: string;
    language?: string;
    punctuate?: boolean;
    interim_results?: boolean;
  } = {}) {
    const params = new URLSearchParams({
      model: options.model || "nova-2",
      language: options.language || "en-US",
      punctuate: String(options.punctuate ?? true),
      interim_results: String(options.interim_results ?? true),
      smart_format: "true",
    });

    const wsUrl = `wss://api.deepgram.com/v1/listen?${params.toString()}`;

    return new Promise<void>((resolve, reject) => {
      try {
        this.socket = new WebSocket(wsUrl, ["token", this.apiKey]);

        this.socket.onopen = () => {
          this.isConnected = true;
          this.emit("open");
          resolve();
        };

        this.socket.onmessage = (event) => {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        };

        this.socket.onerror = (error) => {
          this.emit("error", error);
          reject(error);
        };

        this.socket.onclose = () => {
          this.isConnected = false;
          this.emit("close");
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send audio data to Deepgram
   */
  sendAudio(audioData: ArrayBuffer) {
    if (this.socket && this.isConnected) {
      this.socket.send(audioData);
    }
  }

  /**
   * Handle incoming messages from Deepgram
   */
  private handleMessage(data: any) {
    if (data.type === "Results") {
      const transcript = data.channel?.alternatives?.[0]?.transcript || "";
      const isFinal = data.is_final;

      if (isFinal && transcript) {
        this.transcript += transcript + " ";
        this.interimTranscript = "";
        this.emit("transcript", {
          transcript: this.transcript.trim(),
          isFinal: true,
        });
      } else if (transcript) {
        this.interimTranscript = transcript;
        this.emit("transcript", {
          transcript: this.transcript.trim() + " " + this.interimTranscript,
          isFinal: false,
        });
      }
    } else if (data.type === "Metadata") {
      this.emit("metadata", data);
    }
  }

  /**
   * Add event listener
   */
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data?: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((callback) => callback(data));
    }
  }

  /**
   * Close connection
   */
  close() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.isConnected = false;
  }

  /**
   * Get current transcript
   */
  getTranscript(): string {
    return this.transcript.trim();
  }

  /**
   * Check if connected
   */
  get connected(): boolean {
    return this.isConnected;
  }
}

