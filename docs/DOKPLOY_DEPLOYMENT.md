# Despliegue en Dokploy

Esta guía te ayudará a desplegar FoloUp en Dokploy.

## 📋 Requisitos Previos

1. Una instancia de Dokploy configurada y funcionando
2. Acceso al repositorio Git: `https://github.com/ZIDUK/agentfoloup.git`
3. Todas las API keys necesarias (ver sección de Variables de Entorno)

## 🚀 Pasos para Desplegar

### 1. Crear Nueva Aplicación en Dokploy

1. Inicia sesión en tu instancia de Dokploy
2. Haz clic en **"New Application"** o **"Nueva Aplicación"**
3. Selecciona **"Git Repository"** como fuente

### 2. Configurar Repositorio Git

- **Repository URL**: `https://github.com/ZIDUK/agentfoloup.git`
- **Branch**: `main`
- **Build Type**: `Dockerfile`
- **Dockerfile Path**: `Dockerfile` (por defecto)
- **Port**: `3000` (puerto interno del contenedor)

### 3. Configurar Variables de Entorno

Agrega todas las siguientes variables de entorno en la sección de configuración de Dokploy:

#### Supabase (Requerido)
```env
NEXT_PUBLIC_SUPABASE_URL=https://murfeotrigphabsklxjw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

#### Deepgram (Requerido para Voice Agent)
```env
NEXT_PUBLIC_DEEPGRAM_API_KEY=tu_deepgram_api_key_aqui
DEEPGRAM_API_KEY=tu_deepgram_api_key_aqui
DEEPGRAM_PROJECT_ID=tu_deepgram_project_id_aqui
```

#### OpenAI (Requerido para Deepgram Voice Agent LLM)
```env
OPENAI_API_KEY=tu_openai_api_key_aqui
```

#### Mistral AI (Requerido para Analytics)
```env
MISTRAL_API_KEY=tu_mistral_api_key_aqui
MISTRAL_MODEL=mistral-large-latest
```

#### Opcional - Skip Auth (Solo para desarrollo)
```env
SKIP_AUTH=true
SKIP_AUTH_USER_ID=tu_user_id_aqui
SKIP_AUTH_ORGANIZATION_ID=tu_organization_id_aqui
```

#### Next.js (Opcional)
```env
NODE_ENV=production
```

### 4. Configurar Puerto y Dominio

- **Internal Port**: `3000` (puerto expuesto por el contenedor)
- **External Port**: Configura según tus necesidades (ej: 80, 443, o un puerto personalizado)
- **Domain**: Configura tu dominio personalizado si lo tienes

### 5. Configuraciones Adicionales

#### Health Check (Opcional)
- **Path**: `/api/health` (si tienes un endpoint de health check)
- **Interval**: `30s`

#### Resource Limits (Recomendado)
- **Memory**: Mínimo 512MB, recomendado 1GB
- **CPU**: 0.5 - 1 CPU core

#### Restart Policy
- Configura como **"Always"** o **"Unless Stopped"**

### 6. Desplegar

1. Haz clic en **"Deploy"** o **"Desplegar"**
2. Dokploy comenzará a construir la imagen Docker
3. El proceso puede tardar varios minutos la primera vez
4. Monitorea los logs para ver el progreso

## 🔍 Verificar el Despliegue

Una vez desplegado, verifica que:

1. ✅ El contenedor está corriendo
2. ✅ Los logs no muestran errores críticos
3. ✅ Puedes acceder a la aplicación en la URL configurada
4. ✅ Las variables de entorno están correctamente configuradas

## 📝 Notas Importantes

### Build Time
- El build inicial puede tardar 5-10 minutos
- Los builds subsecuentes serán más rápidos gracias al cache de Docker

### Variables de Entorno
- **NUNCA** commits las variables de entorno al repositorio
- Usa siempre la sección de Variables de Entorno de Dokploy
- Las variables que empiezan con `NEXT_PUBLIC_` son expuestas al cliente

### Actualizaciones
- Dokploy puede configurarse para auto-desplegar en cada push a `main`
- O puedes desplegar manualmente desde el dashboard

## 🐛 Troubleshooting

### Error: "Port already in use"
- Verifica que no haya otra aplicación usando el mismo puerto
- Cambia el puerto externo en la configuración

### Error: "Build failed"
- Revisa los logs de build en Dokploy
- Verifica que todas las variables de entorno estén configuradas
- Asegúrate de que el Dockerfile esté en la raíz del repositorio

### Error: "Application not starting"
- Revisa los logs del contenedor
- Verifica que todas las variables de entorno requeridas estén configuradas
- Asegúrate de que el puerto interno sea 3000

### Error: "Cannot connect to database"
- Verifica las credenciales de Supabase
- Asegúrate de que `NEXT_PUBLIC_SUPABASE_URL` sea una URL válida (no un JWT token)
- Verifica que la base de datos esté accesible desde el servidor de Dokploy

## 📚 Recursos Adicionales

- [Documentación de Dokploy](https://dokploy.com/docs)
- [Configuración de Supabase](./SUPABASE_SETUP.md)
- [Configuración de Deepgram](./DEEPGRAM_SETUP.md)
- [Configuración de Mistral AI](./MISTRAL_SETUP.md)

