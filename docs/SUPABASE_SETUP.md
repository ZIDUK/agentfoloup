# Configuración de Supabase Cloud

## ✅ Proyecto Conectado

El proyecto está conectado a Supabase Cloud:
- **Project ID**: `murfeotrigphabsklxjw`
- **Project Name**: FoloUp
- **Region**: East US (North Virginia)

## 🔧 Variables de Entorno Necesarias

Para obtener las credenciales correctas:

1. Ve a tu [Dashboard de Supabase](https://supabase.com/dashboard/project/murfeotrigphabsklxjw)
2. Haz clic en **Settings** (⚙️) en el menú lateral
3. Selecciona **API** en la sección de configuración
4. Copia los siguientes valores:

### Variables Requeridas:

```env
# URL de la API de Supabase (formato: https://[project-ref].supabase.co)
NEXT_PUBLIC_SUPABASE_URL=https://murfeotrigphabsklxjw.supabase.co

# Anon/Public Key (visible en Settings > API > Project API keys)
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_aqui
```

### Obtener las Keys:

1. En el Dashboard, ve a **Settings** > **API**
2. En la sección **Project API keys**, encontrarás:
   - **anon/public** key - Úsala para `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key - Solo para uso en servidor (no exponer en cliente)

## 📋 Migraciones Aplicadas

Las siguientes migraciones han sido aplicadas a la base de datos:

- ✅ `20240101000000_initial_schema.sql` - Esquema inicial con todas las tablas

### Tablas Creadas:

- `organization` - Organizaciones/empresas
- `user` - Usuarios
- `interviewer` - Entrevistadores de IA
- `interview` - Entrevistas
- `response` - Respuestas de candidatos
- `feedback` - Feedback de candidatos

## 🔍 Verificar Conexión

Para verificar que todo está funcionando:

```bash
# Verificar estado del proyecto
supabase projects list

# Ver migraciones aplicadas
supabase db remote list

# Conectarse a la base de datos
supabase db remote connect
```

## ⚠️ Problema Actual

**Las variables de entorno en `.env` tienen valores incorrectos:**

- `NEXT_PUBLIC_SUPABASE_URL` contiene un JWT token en lugar de una URL
- Necesitas actualizar estas variables con los valores correctos del Dashboard

## 📝 Pasos para Corregir

1. Abre tu archivo `.env`
2. Reemplaza las variables de Supabase con los valores del Dashboard:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://murfeotrigphabsklxjw.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=[obtener del dashboard]
   ```
3. Reinicia el servidor de desarrollo: `yarn dev`

## 🔗 Enlaces Útiles

- [Dashboard del Proyecto](https://supabase.com/dashboard/project/murfeotrigphabsklxjw)
- [Documentación de Supabase](https://supabase.com/docs)
- [Guía de Conexión](https://supabase.com/docs/guides/database/connecting-to-postgres/serverless-drivers)

