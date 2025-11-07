# ✅ Checklist de Variables de Entorno para Dokploy

Verifica que todas estas variables estén configuradas correctamente en Dokploy:

## 🔴 CRÍTICAS (Sin estas, la app no funcionará)

### Supabase (Requerido para base de datos)
```env
NEXT_PUBLIC_SUPABASE_URL=https://murfeotrigphabsklxjw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
```
**⚠️ IMPORTANTE:**
- `NEXT_PUBLIC_SUPABASE_URL` debe empezar con `https://` (NO debe ser un JWT token)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` debe ser la clave "anon/public" de Supabase

### Deepgram (Requerido para Voice Agent)
```env
NEXT_PUBLIC_DEEPGRAM_API_KEY=tu_deepgram_api_key
DEEPGRAM_API_KEY=tu_deepgram_api_key
DEEPGRAM_PROJECT_ID=tu_deepgram_project_id
```

### OpenAI (Requerido para Deepgram Voice Agent LLM)
```env
OPENAI_API_KEY=tu_openai_api_key
```

### Mistral AI (Requerido para Analytics y generación de preguntas)
```env
MISTRAL_API_KEY=tu_mistral_api_key
MISTRAL_MODEL=mistral-large-latest
```

### Next.js (Requerido para URLs)
```env
NEXT_PUBLIC_LIVE_URL=https://foloup.agenticdream.com
```
**⚠️ IMPORTANTE:** Debe ser la URL completa de tu aplicación desplegada (con https://)

## 🟡 OPCIONALES (Pero recomendadas)

### Node Environment
```env
NODE_ENV=production
```

### Skip Auth (Solo para desarrollo/testing)
```env
SKIP_AUTH=false
NEXT_PUBLIC_SKIP_AUTH=false
```

## 🔍 Cómo Verificar en Dokploy

1. Ve a tu aplicación en Dokploy
2. Busca la sección "Environment Variables" o "Variables de Entorno"
3. Verifica que cada variable esté presente y tenga el valor correcto
4. **NO incluyas comillas** alrededor de los valores
5. Asegúrate de que no haya espacios extra antes o después de los valores

## ❌ Errores Comunes

### Error: "Supabase client is not available"
- ✅ Verifica que `NEXT_PUBLIC_SUPABASE_URL` empiece con `https://`
- ✅ Verifica que `NEXT_PUBLIC_SUPABASE_ANON_KEY` no esté vacío
- ✅ Verifica que no haya espacios extra en los valores

### Error: "Interviewers return null"
- ✅ Verifica que Supabase esté configurado correctamente
- ✅ Verifica que la base de datos tenga las tablas creadas (ejecuta `supabase_schema.sql`)
- ✅ Revisa los logs del servidor en Dokploy para ver errores específicos

### Error: "Failed to create interviewers"
- ✅ Revisa los logs del servidor en Dokploy
- ✅ Verifica que la tabla `interviewer` exista en Supabase
- ✅ Verifica que el usuario tenga permisos para insertar en la tabla

## 📝 Notas Importantes

1. **Variables con `NEXT_PUBLIC_`**: Estas son expuestas al cliente (navegador). Úsalas solo para valores públicos.
2. **Variables sin `NEXT_PUBLIC_`**: Estas son solo del servidor y más seguras.
3. **Después de cambiar variables**: Debes **redesplegar** la aplicación para que los cambios surtan efecto.

