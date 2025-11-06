"use server";

import { createClient } from "@deepgram/sdk";

const deepgram = createClient(process.env.DEEPGRAM_API_KEY || "");

export interface DeepgramTranscriptionOptions {
  model?: string;
  language?: string;
  punctuate?: boolean;
  interim_results?: boolean;
}

export class DeepgramService {
  /**
   * Create a live transcription connection
   */
  static async createLiveConnection(
    options: DeepgramTranscriptionOptions = {}
  ) {
    const connection = deepgram.listen.live({
      model: options.model || "nova-2",
      language: options.language || "en-US",
      punctuate: options.punctuate ?? true,
      interim_results: options.interim_results ?? true,
      smart_format: true,
    });

    return connection;
  }

  /**
   * Transcribe audio file
   */
  static async transcribeAudio(
    audioBuffer: Buffer,
    options: DeepgramTranscriptionOptions = {}
  ) {
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      audioBuffer,
      {
        model: options.model || "nova-2",
        language: options.language || "en-US",
        punctuate: options.punctuate ?? true,
        smart_format: true,
      }
    );

    if (error) {
      throw error;
    }

    return result;
  }

  /**
   * Get transcription from a URL
   */
  static async transcribeUrl(
    url: string,
    options: DeepgramTranscriptionOptions = {}
  ) {
    const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
      url,
      {
        model: options.model || "nova-2",
        language: options.language || "en-US",
        punctuate: options.punctuate ?? true,
        smart_format: true,
      }
    );

    if (error) {
      throw error;
    }

    return result;
  }
}

