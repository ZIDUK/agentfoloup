# Configuración de Mistral AI

## Migración de OpenAI a Mistral AI

Este proyecto ha sido migrado de OpenAI a Mistral AI para generar preguntas de entrevistas y analizar respuestas.

## Configuración

### 1. Obtener API Key de Mistral AI

1. Crea una cuenta en [Mistral AI Console](https://console.mistral.ai/)
2. Ve a [API Keys](https://console.mistral.ai/api-keys)
3. Crea una nueva API key
4. Copia la key

### 2. Configurar Variables de Entorno

Agrega las siguientes variables a tu archivo `.env`:

```env
# Mistral AI (requerido)
MISTRAL_API_KEY=tu_api_key_aqui

# Modelo de Mistral a usar (opcional, por defecto: mistral-large-latest)
MISTRAL_MODEL=mistral-large-latest
```

### 3. Modelos Disponibles

Mistral AI ofrece varios modelos. Puedes configurar `MISTRAL_MODEL` con uno de estos:

- `mistral-tiny` - Modelo más rápido y económico
- `mistral-small` - Balance entre velocidad y calidad
- `mistral-medium` - Mayor calidad
- `mistral-large-latest` - Modelo más avanzado (recomendado)
- `pixtral-12b-2409` - Modelo multimodal

## Archivos Modificados

Los siguientes archivos han sido actualizados para usar Mistral AI:

1. **src/services/mistral.service.ts** - Nuevo servicio de Mistral AI
2. **src/services/analytics.service.ts** - Análisis de entrevistas
3. **src/app/api/generate-interview-questions/route.ts** - Generación de preguntas
4. **src/app/api/generate-insights/route.ts** - Generación de insights
5. **src/app/api/analyze-communication/route.ts** - Análisis de comunicación

## Compatibilidad

El servicio de Mistral está diseñado para ser compatible con la API de OpenAI, por lo que el código existente funciona sin cambios mayores.

## Fallback a OpenAI

Si prefieres seguir usando OpenAI, simplemente configura `OPENAI_API_KEY` en lugar de `MISTRAL_API_KEY`. El sistema detectará automáticamente qué servicio usar.

## Costos

Mistral AI generalmente ofrece precios más competitivos que OpenAI:

- **Mistral Large**: ~$0.002/1K tokens de entrada, ~$0.006/1K tokens de salida
- **Mistral Medium**: ~$0.001/1K tokens de entrada, ~$0.003/1K tokens de salida
- **Mistral Small**: ~$0.0002/1K tokens de entrada, ~$0.0006/1K tokens de salida

Comparado con GPT-4o de OpenAI:
- **GPT-4o**: ~$0.0025/1K tokens de entrada, ~$0.01/1K tokens de salida

## Pruebas

Para probar la configuración:

1. Asegúrate de que `MISTRAL_API_KEY` esté configurado en tu `.env`
2. Inicia el servidor: `yarn dev`
3. Intenta crear una nueva entrevista
4. Verifica que las preguntas se generen correctamente

## Solución de Problemas

### Error: "Mistral API key not configured"
- Verifica que `MISTRAL_API_KEY` esté en tu archivo `.env`
- Asegúrate de que el archivo `.env` esté en la raíz del proyecto
- Reinicia el servidor después de agregar la variable

### Error: "Invalid API key"
- Verifica que la API key sea correcta
- Asegúrate de que no haya espacios extra en el `.env`
- Verifica que la API key esté activa en el dashboard de Mistral

### Error: "Model not found"
- Verifica que el modelo especificado en `MISTRAL_MODEL` sea válido
- Usa `mistral-large-latest` como valor por defecto

