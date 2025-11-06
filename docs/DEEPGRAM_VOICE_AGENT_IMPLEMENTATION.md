# Implementación de Deepgram Voice Agent API

## ✅ Implementación Completada

Se ha completado la migración de Retell AI a Deepgram Voice Agent API. La implementación incluye:

### Archivos Creados

1. **`src/services/deepgram-agent.service.ts`**
   - Servicio para manejar la conexión con Deepgram Voice Agent API
   - Configuración dinámica del agente basada en datos de la entrevista
   - Captura de audio del micrófono
   - Manejo de eventos del agente

2. **`src/lib/audio-player.ts`**
   - Utilidad para reproducir audio del agente
   - Convierte PCM (linear16) a formato Web Audio API
   - Manejo de buffer de audio para reproducción continua

### Archivos Actualizados

1. **`src/components/call/index.tsx`**
   - Reemplazado `RetellWebClient` con `DeepgramAgentService`
   - Event handlers actualizados para eventos de Deepgram
   - Integración con AudioPlayer para reproducción de audio
   - Configuración del agente con datos de la entrevista

2. **`README.md`**
   - Actualizado con instrucciones para `NEXT_PUBLIC_DEEPGRAM_API_KEY`

## 🔧 Configuración Requerida

### Variables de Entorno

Agrega estas variables a tu archivo `.env`:

```env
# Deepgram API Key (cliente - requerido para Voice Agent)
NEXT_PUBLIC_DEEPGRAM_API_KEY=tu_api_key_aqui

# Deepgram API Key (servidor - opcional)
DEEPGRAM_API_KEY=tu_api_key_aqui

# Deepgram Project ID (opcional, solo para token generation)
DEEPGRAM_PROJECT_ID=tu_project_id_aqui

# OpenAI API Key (requerido para el agente de voz)
OPENAI_API_KEY=tu_openai_key_aqui
```

**Nota:** Deepgram Voice Agent API actualmente soporta OpenAI y Anthropic como proveedores de LLM. Mistral no está soportado directamente, pero puedes usar OpenAI o configurar una integración personalizada.

## 🎯 Características Implementadas

### ✅ Funcionalidades Completadas

1. **Conexión con Deepgram Voice Agent**
   - WebSocket connection establecida
   - Keep-alive messages automáticos

2. **Configuración del Agente**
   - Prompt dinámico basado en datos de la entrevista
   - Personalidad del entrevistador (empatía, rapport, exploración, velocidad)
   - Preguntas y objetivo de la entrevista

3. **Captura de Audio**
   - Acceso al micrófono del usuario
   - Conversión a formato linear16 (PCM)
   - Envío en tiempo real a Deepgram

4. **Reproducción de Audio**
   - Recepción de audio del agente
   - Conversión de PCM a Web Audio API
   - Reproducción continua sin interrupciones

5. **Transcripción en Tiempo Real**
   - Actualización de texto del entrevistador
   - Actualización de texto del usuario
   - Indicadores visuales de turno

6. **Manejo de Eventos**
   - Conexión abierta/cerrada
   - Inicio/fin de habla del usuario
   - Audio del agente recibido
   - Errores y manejo de excepciones

## 🔄 Flujo de la Entrevista

1. **Usuario inicia entrevista**
   - Se solicita acceso al micrófono
   - Se crea instancia de `DeepgramAgentService`
   - Se configura el agente con datos de la entrevista

2. **Conexión establecida**
   - WebSocket se conecta a Deepgram
   - Evento `Welcome` recibido
   - Agente se configura automáticamente

3. **Durante la entrevista**
   - Audio del usuario se captura y envía a Deepgram
   - Deepgram transcribe y envía al LLM
   - LLM genera respuesta
   - Deepgram sintetiza voz y envía audio
   - Audio se reproduce al usuario
   - Transcripción se actualiza en tiempo real

4. **Fin de la entrevista**
   - Usuario termina o tiempo se agota
   - Conexión se cierra
   - Audio se detiene
   - Datos se guardan

## ⚠️ Consideraciones Importantes

### 1. API Key en el Cliente

La API key de Deepgram debe estar disponible en el cliente (`NEXT_PUBLIC_DEEPGRAM_API_KEY`). Esto es seguro porque:
- Deepgram usa la key solo para autenticación
- No expone datos sensibles
- Es la forma recomendada por Deepgram para Voice Agent API

### 2. Proveedor de LLM

Actualmente configurado para usar OpenAI (`gpt-4o-mini`). Para usar otro proveedor:
- Deepgram soporta: OpenAI, Anthropic
- Mistral requiere integración personalizada (no soportado directamente)

### 3. Formato de Audio

- **Input**: linear16, 24kHz, mono
- **Output**: linear16, 16kHz, mono, WAV container
- El audio se convierte automáticamente en el cliente

### 4. Permisos del Navegador

El navegador solicitará permiso para acceder al micrófono. Asegúrate de:
- Permitir el acceso cuando se solicite
- Usar HTTPS en producción (requerido para getUserMedia)

## 🧪 Pruebas

Para probar la implementación:

1. **Configura las variables de entorno**
   ```bash
   NEXT_PUBLIC_DEEPGRAM_API_KEY=tu_key
   OPENAI_API_KEY=tu_openai_key
   ```

2. **Inicia el servidor**
   ```bash
   yarn dev
   ```

3. **Crea una entrevista**
   - Ve a `/dashboard`
   - Crea una nueva entrevista
   - Selecciona un entrevistador

4. **Inicia una entrevista de prueba**
   - Comparte el link de la entrevista
   - Ingresa nombre y email
   - Haz clic en "Start Interview"
   - Permite acceso al micrófono
   - Habla con el agente

## 🐛 Troubleshooting

### Error: "Deepgram API key not configured"
- Verifica que `NEXT_PUBLIC_DEEPGRAM_API_KEY` esté en `.env`
- Reinicia el servidor después de agregar la variable

### Error: "Failed to start interview"
- Verifica que tengas acceso al micrófono
- Verifica que `OPENAI_API_KEY` esté configurado
- Revisa la consola del navegador para más detalles

### No se escucha audio
- Verifica que el volumen del navegador esté activado
- Verifica permisos de audio del navegador
- Revisa la consola para errores de AudioContext

### Transcripción no se actualiza
- Verifica que el evento `ConversationText` esté siendo manejado
- Revisa la consola para ver si los eventos se están recibiendo

## 📚 Recursos Adicionales

- [Deepgram Voice Agent API Docs](https://developers.deepgram.com/docs/voice-agent-api)
- [Deepgram Voice Agent Demo](https://github.com/deepgram-devs/deepgram-voice-agent-demo)
- [API Reference](https://developers.deepgram.com/reference/voice-agent-api)

## 🎉 Próximos Pasos

1. ✅ Implementación básica completada
2. ⏳ Probar con entrevistas reales
3. ⏳ Ajustar configuración según feedback
4. ⏳ Optimizar latencia y calidad de audio
5. ⏳ Agregar soporte para grabación de entrevistas

