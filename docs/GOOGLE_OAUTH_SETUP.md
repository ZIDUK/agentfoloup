# Configuración de Google OAuth con Supabase

## ✅ Migración Completada

El proyecto ha sido migrado de Clerk a Google Sign In usando Supabase Auth.

## 🔧 Configuración en Supabase Dashboard

### 1. Habilitar Google OAuth Provider

1. Ve a tu [Dashboard de Supabase](https://supabase.com/dashboard/project/murfeotrigphabsklxjw)
2. Navega a **Authentication** > **Providers** en el menú lateral
3. Busca **Google** en la lista de proveedores
4. Haz clic en el toggle para **habilitar** Google

### 2. Configurar Google OAuth Credentials

Necesitas crear credenciales OAuth en Google Cloud Console:

#### Paso 1: Crear Proyecto en Google Cloud Console

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Ve a **APIs & Services** > **Credentials**

#### Paso 2: Crear OAuth 2.0 Client ID

1. Haz clic en **Create Credentials** > **OAuth client ID**
2. Si es la primera vez, configura la **OAuth consent screen**:
   - Tipo de usuario: **External** (o Internal si tienes Google Workspace)
   - App name: **FoloUp**
   - User support email: tu email
   - Developer contact: tu email
   - Guarda y continúa

3. Crea el **OAuth Client ID**:
   - Application type: **Web application**
   - Name: **FoloUp Web Client**
   - **Authorized JavaScript origins**:
     ```
     http://localhost:3000
     https://murfeotrigphabsklxjw.supabase.co
     ```
   - **Authorized redirect URIs**:
     ```
     https://murfeotrigphabsklxjw.supabase.co/auth/v1/callback
     http://localhost:3000/auth/callback
     ```

4. Copia el **Client ID** y **Client Secret**

#### Paso 3: Configurar en Supabase

1. En el Dashboard de Supabase, ve a **Authentication** > **Providers** > **Google**
2. Ingresa:
   - **Client ID (for OAuth)**: Pega el Client ID de Google
   - **Client Secret (for OAuth)**: Pega el Client Secret de Google
3. Haz clic en **Save**

### 3. Configurar Redirect URLs

En Supabase Dashboard:
1. Ve a **Authentication** > **URL Configuration**
2. Asegúrate de que estas URLs estén configuradas:
   - **Site URL**: `http://localhost:3000` (para desarrollo)
   - **Redirect URLs**: 
     ```
     http://localhost:3000/auth/callback
     https://tu-dominio.com/auth/callback
     ```

## 📝 Variables de Entorno

No necesitas agregar variables adicionales. El sistema usa las variables de Supabase que ya tienes:

```env
NEXT_PUBLIC_SUPABASE_URL=https://murfeotrigphabsklxjw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

## 🧪 Probar la Autenticación

1. Inicia el servidor: `yarn dev`
2. Ve a `http://localhost:3000/sign-in`
3. Haz clic en **"Continue with Google"**
4. Deberías ser redirigido a Google para autenticarte
5. Después de autenticarte, serás redirigido al dashboard

## 🔄 Cambios Realizados

### Archivos Modificados:

1. **src/middleware.ts** - Reemplazado Clerk middleware con Supabase Auth
2. **src/app/(client)/layout.tsx** - Removido ClerkProvider
3. **src/app/(user)/layout.tsx** - Removido ClerkProvider
4. **src/app/(client)/sign-in/[[...sign-in]]/page.tsx** - Nueva página con Google OAuth
5. **src/app/auth/callback/route.ts** - Nuevo callback handler para OAuth
6. **src/components/navbar.tsx** - Actualizado para usar Supabase Auth
7. **src/contexts/clients.context.tsx** - Migrado de Clerk a Supabase

### Componentes Nuevos:

- **src/components/ui/dropdown-menu.tsx** - Componente de menú dropdown

## ⚠️ Notas Importantes

1. **Organizaciones**: El sistema actual usa el ID del usuario como organización por defecto. Puedes extender esto más adelante para soportar múltiples organizaciones.

2. **User Metadata**: Los datos del usuario de Google se almacenan en `user.user_metadata`:
   - `avatar_url`: Foto de perfil de Google
   - `email`: Email del usuario
   - `full_name`: Nombre completo

3. **Producción**: Cuando despliegues a producción:
   - Actualiza las URLs autorizadas en Google Cloud Console
   - Actualiza las Redirect URLs en Supabase
   - Cambia el Site URL en Supabase a tu dominio de producción

## 🐛 Solución de Problemas

### Error: "redirect_uri_mismatch"
- Verifica que las Redirect URLs en Google Cloud Console coincidan exactamente con las configuradas en Supabase
- Asegúrate de incluir `http://localhost:3000/auth/callback` para desarrollo

### Error: "Invalid client"
- Verifica que el Client ID y Client Secret estén correctos en Supabase
- Asegúrate de que Google OAuth esté habilitado en Supabase

### No redirige después de login
- Verifica que la ruta `/auth/callback` esté funcionando
- Revisa la consola del navegador para errores

## 📚 Recursos

- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth Setup](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Next.js Auth Helpers](https://supabase.com/docs/guides/auth/auth-helpers/nextjs)

