# Skip Authentication (Development Mode)

## 🔓 Bypass de Autenticación

Para desarrollo y testing, puedes habilitar un modo que salta la autenticación completamente.

## ⚙️ Configuración

Agrega estas variables a tu archivo `.env`:

```env
# Skip authentication (development only)
SKIP_AUTH=true
NEXT_PUBLIC_SKIP_AUTH=true
```

## 📝 Qué hace

Cuando `SKIP_AUTH=true`:

1. **Middleware**: No requiere autenticación para acceder a rutas protegidas
2. **Contextos**: Usa un usuario mock en lugar de autenticación real
3. **Navbar**: Muestra el usuario mock
4. **Todas las rutas**: Accesibles sin login

## 👤 Usuario Mock

El sistema usa un usuario de desarrollo con:
- **ID**: `dev-user-123`
- **Email**: `dev@example.com`
- **Organization ID**: `dev-org-123`
- **Organization Name**: `Development Organization`

## ⚠️ IMPORTANTE

**NUNCA uses esto en producción:**

1. Solo para desarrollo local
2. No commitees `.env` con `SKIP_AUTH=true` a producción
3. Asegúrate de que `SKIP_AUTH=false` o no esté definido en producción

## 🔄 Deshabilitar

Para volver a la autenticación normal:

```env
# Comenta o elimina estas líneas
# SKIP_AUTH=true
# NEXT_PUBLIC_SKIP_AUTH=true
```

O simplemente elimínalas del `.env` y reinicia el servidor.

## 🧪 Uso

1. Agrega las variables al `.env`
2. Reinicia el servidor: `yarn dev`
3. Accede directamente a `/dashboard` sin login
4. Todas las funcionalidades funcionarán con el usuario mock

