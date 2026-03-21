# SETUP GUÍA - Medi-Track

## ✅ Lo que ya está hecho

1. **Estructura del proyecto completa**
   - Carpetas de Next.js organizadas
   - Componentes estructurados
   - Hooks personalizados
   - Servicios y contextos

2. **Firebase Configurado**
   - `firebaseConfig.ts` con variables de entorno
   - `firebase.ts` con inicialización segura
   - Error handling mejorado
   - AuthContext para gestión de usuarios

3. **Seguridad Implementada**
   - ✅ Credenciales movidas a `.env.local`
   - ✅ Rules de Firestore con RBAC
   - ✅ Archivos movidos a Google Drive (sin Firebase Storage)
   - ✅ Audit logs implementados

4. **Dependencias Instaladas**
   - Next.js 14, React 18, TypeScript
   - Firebase SDKs
   - Tailwind CSS
   - Todas las herramientas necesarias

## 🔧 Pasos para empezar a desarrollar

### 1. **Crear proyecto en Firebase Console**

```bash
# Ir a https://console.firebase.google.com
# 1. Clic en "Crear proyecto"
# 2. Nombre: "Med-iTrack"
# 3. Habilitar Google Analytics (opcional)
# 4. Crear proyecto
```

### 2. **Obtener credenciales Firebase**

```bash
# En Firebase Console:
# 1. Ir a Project Settings (engranaje)
# 2. Ir a "Tu apps" → "Agregar app"
# 3. Seleccionar "Web" (</> )
# 4. Copiar las credenciales
# 5. Reemplazar en .env.local:

NEXT_PUBLIC_FIREBASE_API_KEY=<tu_api_key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<tu_auth_domain>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<tu_project_id>
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=<tu_sender_id>
NEXT_PUBLIC_FIREBASE_APP_ID=<tu_app_id>
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=<tu_measurement_id>
```

### 3. **Habilitar Authentication**

```bash
# En Firebase Console:
# 1. Ir a Authentication
# 2. Clic en "Comenzar"
# 3. Habilitar "Email/Contraseña"
# 4. Habilitar "Google" (opcional)
```

### 4. **Crear Firestore Database**

```bash
# En Firebase Console:
# 1. Ir a Firestore Database
# 2. Clic en "Crear base de datos"
# 3. Modo de inicio: "Comenzar en modo de prueba" (por ahora)
# 4. Ubicación: Seleccionar la más cercana
# 5. Crear base de datos
```

### 5. **Configurar Google Drive (archivos)**

Firebase Storage ya no se utiliza en Med-iTrack. Todos los archivos clínicos (órdenes, remisiones, informes) se suben directamente a Google Drive usando las funciones de `src/services/google-drive.ts`. Solo asegúrate de tener creada la carpeta padre (`GOOGLE_DRIVE_PARENT_FOLDER_ID`) y dale permisos al servicio de App Hosting.

### 6. **Desplegar Rules de Seguridad**

```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Autenticarse
firebase login

# Inicializar proyecto local
firebase init
# Seleccionar: Firestore (Storage no es necesario)
# Elegir proyecto existente
# Confirmar archivos default

# Desplegar rules
firebase deploy --only firestore:rules
```

### 7. **Crear colecciones iniciales en Firestore**

```bash
# En Firebase Console, crear estas colecciones:

1. users/
   - Estructura:
   {
     email: "user@example.com",
     name: "John Doe",
     role: "doctor", // admin, doctor, technician, patient
     createdAt: timestamp,
     updatedAt: timestamp
   }

2. patients/
   - Estructura:
   {
     userId: "uid_del_usuario",
     firstName: "Juan",
     lastName: "Pérez",
     dateOfBirth: "1990-01-15",
     gender: "M",
     medicalHistory: ["diabetes", "hipertensión"],
     createdAt: timestamp,
     updatedAt: timestamp
   }

3. appointments/
   - Estructura:
   {
     patientId: "patient_uid",
     doctorId: "doctor_uid",
     dateTime: timestamp,
     duration: 30, // minutos
     status: "scheduled", // completed, cancelled
     reason: "Consulta general",
     notes: "",
     createdAt: timestamp,
     updatedAt: timestamp
   }

4. audit_logs/
   - Se crea automáticamente con middleware
```

### 8. **Instalar Firebase CLI en el proyecto** (opcional)

```bash
npm install firebase firebase-tools -D
```

## 🚀 Ejecutar el proyecto

```bash
# En desarrollo
npm run dev
# Acceder a http://localhost:3000

# Build para producción
npm run build

# Iniciar en producción
npm start

# Validar tipos
npm run type-check
```

## 📋 Archivos importantes

| Archivo | Propósito |
|---------|-----------|
| `.env.local` | Variables de entorno (NO COMMITEAR) |
| `firestore.rules` | Reglas de seguridad Firestore |
| `src/lib/firebase.ts` | Inicialización Firebase |
| `src/context/auth-context.tsx` | Contexto de autenticación |
| `src/app/layout.tsx` | Layout principal |

## 🔐 Seguridad - IMPORTANTE

### ✅ Está bien:
- Variables de entorno en `.env.local`
- Credenciales en Firebase Console protegidas
- Rules de Firestore restrictivas por defecto
- Roles y permisos implementados

### ❌ NUNCA hagas:
- Commitear `.env.local`
- Cambiar rules a `allow read, write: if true`
- Compartir credenciales en Slack/Email
- Usar la misma contraseña para múltiples servicios

## 🛠️ Estructura de Carpetas

```
src/
├── app/                      # Rutas Next.js
│   ├── (dashboard)/         # Rutas protegidas
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── patients/
│   │   ├── imaging/
│   │   └── consultations/
│   ├── landing/             # Página pública
│   ├── login/               # Login
│   ├── layout.tsx           # Layout raíz
│   ├── page.tsx             # Home
│   ├── globals.css
│   └── manifest.ts
├── components/              # Componentes React
│   ├── ui/                  # Componentes básicos
│   └── app/                 # Componentes de aplicación
├── context/                 # Context API
│   └── auth-context.tsx
├── hooks/                   # Custom hooks
│   ├── use-auth.ts
│   ├── use-mobile.tsx
│   ├── use-interval.ts
│   ├── use-toast.ts
│   └── use-shift-change-reminder.ts
├── lib/                     # Utilidades
│   ├── firebase.ts          # Inicialización
│   ├── firebaseConfig.ts    # Config
│   ├── firebase.ts
│   ├── types.ts             # TypeScript interfaces
│   ├── utils.ts
│   └── schemas/
├── firebase/                # Firebase utils
│   ├── errors.ts
│   └── error-emitter.ts
├── services/                # API services
│   ├── patients-service.ts
│   ├── excel-export.ts
│   ├── google-sheets.ts
│   └── twilio.ts
├── ai/                      # Genkit flows
│   ├── genkit.ts
│   └── flows/
│       ├── extract-consultation-flow.ts
│       ├── extract-order-flow.ts
│       ├── extract-report-text-flow.ts
│       ├── stt-flow.ts
│       └── tts-flow.ts
└── public/                  # Assets estáticos
    ├── icons/
    ├── docs/
    └── templates/
```

## 📚 Próximos pasos

1. **Crear primeros usuarios de prueba** en Firebase Console
2. **Implementar páginas de dashboard** (patients, imaging, consultations)
3. **Conectar servicios de Genkit** para IA
4. **Configurar notificaciones** (Twilio SMS, etc)
5. **Testing** - Agregar tests unitarios
6. **Deployment** - Desplegar en Firebase Hosting

## 💡 Tips

- Usa `npm run dev` durante desarrollo
- Abre `http://localhost:3000` en el navegador
- Abre DevTools (F12) para ver logs
- Firebase Console → Firestore → Leer datos en tiempo real
- Usa Postman para testing de APIs

## ❓ Problemas Comunes

### Error: "Firebase config incomplete"
→ Verifica `.env.local` tenga todas las variables

### Error: "Permission denied"
→ Verifica que las rules de Firestore estén desplegadas

### Error: "Module not found"
→ Corre `npm install` nuevamente

### Error: "CORS"
→ Firebase hosting debe estar configurado

## 📞 Soporte

Para más info:
- Firebase Docs: https://firebase.google.com/docs
- Next.js Docs: https://nextjs.org/docs
- TypeScript: https://www.typescriptlang.org/docs/

---

**¡El proyecto está listo para desarrollar! 🚀**
