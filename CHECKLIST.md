# 📋 CHECKLIST DE CONFIGURACIÓN - Medi-Track

## ✅ FASE 1: PROYECTO LOCAL (COMPLETADA)

- [x] Estructura de carpetas creada
- [x] Configuración de Next.js (next.config.mjs)
- [x] Configuración de TypeScript (tsconfig.json)
- [x] Configuración de Tailwind CSS (tailwind.config.ts)
- [x] Variables de entorno template (.env.local.example)
- [x] Archivos Firebase configurados
- [x] Autenticación Context implementado
- [x] Páginas básicas creadas
- [x] Dependencias instaladas (npm install)
- [x] Documentación completa

**PRÓXIMO PASO:** → Ve a Fase 2

---

## ⏳ FASE 2: FIREBASE CONSOLE SETUP (POR HACER)

### Paso 1: Crear Proyecto en Firebase
- [ ] Ir a https://console.firebase.google.com
- [ ] Clic en "Crear proyecto"
- [ ] Nombre: `Med-iTrack`
- [ ] Aceptar términos
- [ ] Desmarcar "Habilitar Google Analytics" (opcional)
- [ ] Clic en "Crear proyecto"
- [ ] Esperar a que termine (2-3 minutos)

### Paso 2: Obtener Credenciales
- [ ] En Firebase Console → Project Settings (engranaje ⚙️)
- [ ] Pestaña "Tu apps" → "Agregar app" → Web (`</>`)
- [ ] Copiar el objeto de configuración (firebaseConfig)
- [ ] Llenar `.env.local` con estos valores:
  ```
  NEXT_PUBLIC_FIREBASE_API_KEY=paste_here
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=paste_here
  NEXT_PUBLIC_FIREBASE_PROJECT_ID=paste_here
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=paste_here
  NEXT_PUBLIC_FIREBASE_APP_ID=paste_here
  NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=paste_here
  ```

### Paso 3: Habilitar Autenticación
- [ ] Firebase Console → Authentication
- [ ] Clic en "Comenzar"
- [ ] Seleccionar "Email/Contraseña"
- [ ] Habilitar (toggle "Habilitado")
- [ ] Guardar

### Paso 4: Crear Firestore Database

### Paso 5: Configurar carpeta en Drive
- [ ] Revisa `GOOGLE_DRIVE_PARENT_FOLDER_ID`
- [ ] Comparte la carpeta con la cuenta de App Hosting
- [ ] Usa los scripts de `src/services/google-drive.ts`

**PRÓXIMO PASO:** → Ve a Fase 3

---

## ⏳ FASE 3: DESPLEGAR SECURITY RULES (POR HACER)

### Paso 1: Instalar Firebase CLI
```bash
npm install -g firebase-tools
```

### Paso 2: Autenticarse
```bash
firebase login
```

### Paso 3: Inicializar Firebase en el proyecto
```bash
firebase init
```
Respuestas:
- Select features: **Firestore** (Storage ya no se usa)
- Use existing project: **Select your Med-iTrack project**
- Firestore rules: **Just press Enter** (usar archivos existentes)

### Paso 4: Verificar archivos

### Paso 5: Desplegar Rules
firebase deploy --only firestore:rules
firebase deploy --only firestore:rules

**Output esperado:**
```
✔ Deploying firestore rules...
✔ Firestore rules have been deployed successfully.
```

**PRÓXIMO PASO:** → Ve a Fase 4

---

## ⏳ FASE 4: CREAR COLECCIONES EN FIRESTORE (POR HACER)

### Crear Colecciones Manualmente en Firebase Console

#### Colección 1: `users`
- [ ] Firestore → Crear colección → Nombre: `users`
- [ ] Primer documento: ID automático
- [ ] Agregar campos:
  ```json
  {
    "email": "doctor@test.com",
    "name": "Dr. Juan Pérez",
    "role": "doctor",
    "createdAt": (timestamp actual),
    "updatedAt": (timestamp actual)
  }
  ```

#### Colección 2: `patients`
- [ ] Crear colección → Nombre: `patients`
- [ ] Primer documento: ID automático
- [ ] Agregar campos:
  ```json
  {
    "userId": "paste_user_id_here",
    "firstName": "Carlos",
    "lastName": "González",
    "dateOfBirth": "1990-05-15",
    "gender": "M",
    "medicalHistory": ["diabetes"],
    "createdAt": (timestamp actual),
    "updatedAt": (timestamp actual)
  }
  ```

#### Colección 3: `appointments`
- [ ] Crear colección → Nombre: `appointments`
- [ ] Saltar primer documento (crear después)

#### Colección 4: `audit_logs`
- [ ] Crear colección → Nombre: `audit_logs`
- [ ] Saltar primer documento (se crea automáticamente)

**PRÓXIMO PASO:** → Ve a Fase 5

---

## ⏳ FASE 5: INICIAR DESARROLLO (POR HACER)

### Paso 1: Inicia el servidor
```bash
cd "c:\Users\MI PC\Downloads\Med-iTrack-2-main"
npm run dev
```

### Paso 2: Abre en el navegador
- [ ] Abre http://localhost:3000
- [ ] Deberías ver la página de landing

### Paso 3: Prueba el login
- [ ] Clic en "Iniciar Sesión"
- [ ] Email: `doctor@test.com`
- [ ] Contraseña: `Test1234!`
- [ ] Deberías estar en el dashboard

### Paso 4: Prueba logout
- [ ] Clic en "Cerrar Sesión"
- [ ] Deberías ser redirigido a login

**PRÓXIMO PASO:** → Desarrollo de nuevas features

---

## 🚨 TROUBLESHOOTING

### Error: "Firebase configuration is incomplete"
**Causa:** `.env.local` no está correctamente configurado
**Solución:**
1. Abre `.env.local`
2. Verifica que TODAS las variables tengan valores
3. Reinicia el servidor con `npm run dev`

### Error: "Permission denied" al leer datos
**Causa:** Las rules de Firestore no están desplegadas
**Solución:**
```bash
firebase deploy --only firestore:rules
```

### Error: "Authentication required"
**Causa:** No estás autenticado en Firebase
**Solución:**
1. Asegúrate de haber creado usuarios en Firebase Console
2. Intenta login nuevamente
3. Verifica las credentials de test

### Error: "Module not found"
**Causa:** Las dependencias no se instalaron bien
**Solución:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Error: "CORS error"
**Causa:** Firebase Hosting no está configurado
**Solución:** Por ahora es normal. Desaparece cuando desplegues en Firebase Hosting

---

## 📱 DESARROLLO

Una vez completada la Fase 5, puedes:

1. **Crear nuevas páginas** en `src/app/(dashboard)/`
2. **Agregar componentes** en `src/components/`
3. **Crear servicios** en `src/services/`
4. **Agregar hooks** en `src/hooks/`

### Archivos para editar frecuentemente:
- `src/app/(dashboard)/page.tsx` - Dashboard home
- `src/components/app/` - Componentes específicos de la app
- `src/services/` - Lógica de negocio

### Never edit directly:
- `.env.local` (excepto para agregar credenciales)
- `firestore.rules` (sin saber qué haces)
- Integraciones de Google Drive (ver scripts) 

---

## ✨ PRÓXIMAS FEATURES A IMPLEMENTAR

- [ ] Página de gestión de pacientes
- [ ] Carga de imágenes médicas
- [ ] Integración con Genkit AI
- [ ] Sistema de notificaciones
- [ ] Exportación a Excel
- [ ] Reportes automáticos
- [ ] Sistema de citas
- [ ] Tests unitarios
- [ ] Deployment a Firebase Hosting

---

## 📞 RECURSOS

- **Firebase Docs:** https://firebase.google.com/docs
- **Next.js Docs:** https://nextjs.org/docs
- **TypeScript:** https://www.typescriptlang.org
- **Tailwind CSS:** https://tailwindcss.com/docs
- **Google Genkit:** https://genkit.dev

---

**¡Sigue este checklist paso a paso y tendrás tu Med-iTrack funcionando! 🚀**

**Última actualización:** Noviembre 13, 2025
