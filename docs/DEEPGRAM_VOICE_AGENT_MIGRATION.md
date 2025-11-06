# Migración a Deepgram Voice Agent API

## ✅ ¿Por qué usar Deepgram Voice Agent API?

La **Deepgram Voice Agent API** es perfecta para reemplazar Retell AI porque:

1. **Todo-en-uno**: Proporciona transcripción, LLM (generación de respuestas), y TTS (síntesis de voz) en una sola API
2. **Más económico**: Comparado con Retell AI
3. **Open Source friendly**: Mejor para proyectos open source
4. **Ya tienes el SDK**: `@deepgram/sdk` ya está instalado

## 🔄 Diferencias con Retell AI

### Retell AI (actual)
- Usa `RetellWebClient` del lado del cliente
- Requiere `agent_id` creado previamente
- Maneja todo el flujo de llamadas

### Deepgram Voice Agent API (nuevo)
- Usa WebSocket connection directamente
- Configuración dinámica del agente
- Más control sobre el flujo de conversación
- Soporta múltiples LLM providers (OpenAI, Mistral, etc.)

## 📋 Plan de Migración

### 1. Actualizar el componente Call

El componente `src/components/call/index.tsx` necesita cambios significativos:

**Antes (Retell AI):**
```typescript
import { RetellWebClient } from "retell-client-js-sdk";
const webClient = new RetellWebClient();

await webClient.startCall({
  accessToken: registerCallResponse.data.registerCallResponse.access_token,
});
```

**Después (Deepgram Voice Agent):**
```typescript
import { createClient, AgentEvents } from "@deepgram/sdk";

const deepgram = createClient(process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY);
const connection = deepgram.agent();

connection.on(AgentEvents.Welcome, () => {
  connection.configure({
    audio: {
      input: { encoding: "linear16", sample_rate: 24000 },
      output: { encoding: "linear16", sample_rate: 16000, container: "wav" },
    },
    agent: {
      language: "en",
      listen: {
        provider: { type: "deepgram", model: "nova-3" },
      },
      think: {
        provider: { type: "open_ai", model: "gpt-4o-mini" },
        prompt: "You are an interviewer...",
      },
      speak: {
        provider: { type: "deepgram", model: "aura-2-thalia-en" },
      },
      greeting: "Hello! Let's start the interview.",
    },
  });
});
```

### 2. Actualizar la API `/api/register-call`

Ya no necesitas crear un `agent_id` previamente. En su lugar:

1. **Opción A**: Generar un token temporal de Deepgram (ya implementado)
2. **Opción B**: Usar la API key directamente del cliente (más simple)

### 3. Configurar el Agente con datos de la entrevista

El prompt del agente debe incluir:
- Nombre del entrevistado
- Objetivo de la entrevista
- Preguntas a hacer
- Duración esperada

```typescript
connection.configure({
  agent: {
    think: {
      provider: {
        type: process.env.MISTRAL_API_KEY ? "mistral" : "open_ai",
        model: process.env.MISTRAL_API_KEY 
          ? "mistral-large-latest" 
          : "gpt-4o-mini",
      },
      prompt: `
        You are an interviewer conducting an interview.
        The candidate's name is ${name}.
        The interview objective is: ${objective}
        Questions to ask: ${questions.join(", ")}
        Keep the interview to ${duration} minutes.
        Ask follow-up questions based on responses.
      `,
    },
  },
});
```

### 4. Manejar eventos de audio

```typescript
// Capturar audio del usuario (microphone)
const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
const audioContext = new AudioContext({ sampleRate: 24000 });
const source = audioContext.createMediaStreamSource(mediaStream);
const processor = audioContext.createScriptProcessor(4096, 1, 1);

processor.onaudioprocess = (e) => {
  const audioData = e.inputBuffer.getChannelData(0);
  const int16Array = new Int16Array(audioData.length);
  for (let i = 0; i < audioData.length; i++) {
    int16Array[i] = Math.max(-32768, Math.min(32767, audioData[i] * 32768));
  }
  connection.send(int16Array.buffer);
};

// Recibir audio del agente
connection.on(AgentEvents.Audio, (audioData) => {
  // Reproducir audio usando Web Audio API
  playAudio(audioData);
});

// Transcripción en tiempo real
connection.on(AgentEvents.ConversationText, (data) => {
  // data contiene el texto de la conversación
  setLastInterviewerResponse(data.agent?.text || "");
  setLastUserResponse(data.user?.text || "");
});
```

## 🚀 Implementación Paso a Paso

### Paso 1: Crear servicio de Deepgram Voice Agent

Crear `src/services/deepgram-agent.service.ts`:

```typescript
import { createClient, AgentEvents } from "@deepgram/sdk";

export class DeepgramAgentService {
  private connection: any;
  private deepgram: any;

  constructor(apiKey: string) {
    this.deepgram = createClient(apiKey);
    this.connection = this.deepgram.agent();
  }

  configure(config: {
    name: string;
    objective: string;
    questions: string[];
    duration: string;
  }) {
    this.connection.on(AgentEvents.Welcome, () => {
      this.connection.configure({
        audio: {
          input: { encoding: "linear16", sample_rate: 24000 },
          output: { encoding: "linear16", sample_rate: 16000, container: "wav" },
        },
        agent: {
          language: "en",
          listen: {
            provider: { type: "deepgram", model: "nova-3" },
          },
          think: {
            provider: {
              type: process.env.MISTRAL_API_KEY ? "mistral" : "open_ai",
              model: process.env.MISTRAL_API_KEY 
                ? "mistral-large-latest" 
                : "gpt-4o-mini",
            },
            prompt: this.buildPrompt(config),
          },
          speak: {
            provider: { type: "deepgram", model: "aura-2-thalia-en" },
          },
          greeting: `Hello ${config.name}! Let's start the interview.`,
        },
      });
    });
  }

  private buildPrompt(config: {
    name: string;
    objective: string;
    questions: string[];
    duration: string;
  }): string {
    return `You are an interviewer conducting an interview.
The candidate's name is ${config.name}.
The interview objective is: ${config.objective}
Questions to ask: ${config.questions.join(", ")}
Keep the interview to ${config.duration} minutes.
Ask follow-up questions based on responses.
Be professional and friendly.`;
  }

  on(event: string, callback: Function) {
    this.connection.on(event, callback);
  }

  send(data: ArrayBuffer) {
    this.connection.send(data);
  }

  keepAlive() {
    this.connection.keepAlive();
  }

  close() {
    this.connection.close();
  }
}
```

### Paso 2: Actualizar el componente Call

Reemplazar `RetellWebClient` con `DeepgramAgentService`.

### Paso 3: Actualizar variables de entorno

```env
# Deepgram Voice Agent
NEXT_PUBLIC_DEEPGRAM_API_KEY=your_api_key_here
DEEPGRAM_API_KEY=your_api_key_here

# Opcional: Si usas Mistral para el agente
MISTRAL_API_KEY=your_mistral_key
```

## ⚠️ Consideraciones

1. **WebRTC vs WebSocket**: Deepgram Voice Agent usa WebSocket, no WebRTC como Retell
2. **Audio Processing**: Necesitarás manejar el audio del micrófono y la reproducción manualmente
3. **Costo**: Verifica los costos de Deepgram Voice Agent API vs Retell AI
4. **Latencia**: Puede haber diferencias en la latencia

## 📚 Recursos

- [Deepgram Voice Agent API Docs](https://developers.deepgram.com/docs/voice-agent-api)
- [Deepgram Voice Agent Demo](https://github.com/deepgram-devs/deepgram-voice-agent-demo)
- [API Reference](https://developers.deepgram.com/reference/voice-agent-api)

## 🎯 Próximos Pasos

1. ✅ Ya tienes `@deepgram/sdk` instalado
2. ⏳ Crear el servicio `DeepgramAgentService`
3. ⏳ Migrar el componente `Call`
4. ⏳ Probar con una entrevista simple
5. ⏳ Ajustar configuración según necesidades

