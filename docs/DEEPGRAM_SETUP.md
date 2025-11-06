# Configuración de Deepgram

## ⚠️ Importante: Seguridad de API Keys

**NUNCA compartas tu API key públicamente.** Si ya la compartiste, revócala inmediatamente y genera una nueva en el [Dashboard de Deepgram](https://console.deepgram.com/get-started/api-keys).

## Configuración Rápida

1. **Obtén tu API Key:**
   - Ve a [Deepgram Console](https://console.deepgram.com/get-started/api-keys)
   - Crea una nueva API key o usa una existente
   - Copia la key

2. **Obtén tu Project ID:**
   - Ve a [Deepgram Projects](https://console.deepgram.com/projects)
   - Copia el Project ID de tu proyecto

3. **Configura las variables de entorno:**
   
   Crea o actualiza tu archivo `.env` con:
   ```env
   DEEPGRAM_API_KEY=tu_api_key_aqui
   DEEPGRAM_PROJECT_ID=tu_project_id_aqui
   ```

## Deepgram Voice Agent API

Ahora usamos **Deepgram Voice Agent API**, que proporciona una solución todo-en-uno similar a Retell AI:

- ✅ Transcripción en tiempo real (STT)
- ✅ Text-to-Speech (TTS)
- ✅ Integración con LLM (OpenAI)
- ✅ WebSocket para comunicación en tiempo real
- ✅ Tier gratuito generoso (12,000 min/mes)
- ✅ Más económico que Retell AI

## Costos

### Deepgram Voice Agent API
- Tier gratuito: **12,000 minutos/mes** (800 entrevistas de 15 min)
- Después del tier gratuito: Precios competitivos
- **Ahorro significativo comparado con Retell AI**

## Implementación

La implementación está completa y usa:
- **Deepgram Voice Agent API** para STT, TTS y orquestación
- **OpenAI** como proveedor de LLM (requerido)
- **WebSocket** para comunicación en tiempo real
- **Web Audio API** para captura y reproducción de audio

