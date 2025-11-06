import { Mistral } from "@mistralai/mistralai";

/**
 * Mistral AI Service
 * Wrapper around Mistral AI SDK to provide OpenAI-compatible interface
 */
export class MistralService {
  private client: Mistral;

  constructor(apiKey?: string) {
    this.client = new Mistral({
      apiKey: apiKey || process.env.MISTRAL_API_KEY || "",
    });
  }

  /**
   * Create chat completion (compatible with OpenAI API)
   */
  async createChatCompletion(params: {
    model?: string;
    messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }>;
    response_format?: { type: "json_object" };
    temperature?: number;
    max_tokens?: number;
  }) {
    const {
      model = "mistral-large-latest",
      messages,
      response_format,
      temperature = 0.7,
      max_tokens,
    } = params;

    // Convert messages format
    const mistralMessages = messages.map((msg) => ({
      role: msg.role as "system" | "user" | "assistant",
      content: msg.content,
    }));

    // Prepare request
    const request: any = {
      model,
      messages: mistralMessages,
      temperature,
    };

    // Add JSON mode if requested
    // Mistral AI uses responseFormat with type "json_object"
    // Note: Some Mistral models may not support JSON mode, so we'll try without it if it fails
    if (response_format?.type === "json_object") {
      // Try the new format first (responseFormat)
      request.responseFormat = { type: "json_object" };
      // Also add it to the system message as a fallback
      const systemMessage = mistralMessages.find(m => m.role === "system");
      if (systemMessage) {
        systemMessage.content += "\n\nIMPORTANT: You must respond with valid JSON only. Do not include any text outside of the JSON object.";
      }
    }

    if (max_tokens) {
      request.maxTokens = max_tokens;
    }

    console.log("Mistral API request:", {
      model: request.model,
      messageCount: request.messages.length,
      hasResponseFormat: !!request.responseFormat,
      temperature: request.temperature,
    });

    let response;
    try {
      response = await this.client.chat.complete(request);
      console.log("Mistral API response received:", {
        hasChoices: !!response.choices,
        choiceCount: response.choices?.length || 0,
        hasContent: !!response.choices?.[0]?.message?.content,
      });
    } catch (error: any) {
      console.error("Mistral API error:", {
        message: error?.message,
        status: error?.status,
        statusText: error?.statusText,
        code: error?.code,
        details: error,
      });
      
      // If error is related to responseFormat, try without it
      if (request.responseFormat && (
        error?.message?.includes("responseFormat") || 
        error?.message?.includes("response_format") ||
        error?.message?.includes("json_object") ||
        error?.status === 400
      )) {
        console.log("Retrying without responseFormat...");
        const retryRequest = { ...request };
        delete retryRequest.responseFormat;
        try {
          response = await this.client.chat.complete(retryRequest);
          console.log("Mistral API response received (without responseFormat):", {
            hasChoices: !!response.choices,
            choiceCount: response.choices?.length || 0,
            hasContent: !!response.choices?.[0]?.message?.content,
          });
        } catch (retryError: any) {
          console.error("Mistral API retry error:", retryError);
          throw retryError;
        }
      } else {
        throw error;
      }
    }

    // Convert response to OpenAI-compatible format
    return {
      choices: [
        {
          message: {
            role: response.choices[0]?.message.role || "assistant",
            content: response.choices[0]?.message.content || "",
          },
          finish_reason: response.choices[0]?.finishReason || "stop",
        },
      ],
      usage: {
        prompt_tokens: response.usage?.promptTokens || 0,
        completion_tokens: response.usage?.completionTokens || 0,
        total_tokens: response.usage?.totalTokens || 0,
      },
    };
  }
}

/**
 * Get Mistral client instance
 */
export function getMistralClient() {
  return new MistralService();
}

