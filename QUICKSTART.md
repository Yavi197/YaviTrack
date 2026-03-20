# ⚡ QUICK START - MED-ITRACK

## 30 SEGUNDOS

```bash
# 1. Navega al proyecto
cd "c:\Users\MI PC\Downloads\Med-iTrack-2-main"

# 2. Lee esto primero
cat CHECKLIST.md

# 3. Haz setup en Firebase Console
# (Sigue Fase 2 en CHECKLIST.md)

# 4. Copia credenciales a .env.local
# (Sigue Fase 2 Step 2 en CHECKLIST.md)

# 5. Inicia desarrollo
npm run dev

# 6. Abre navegador
# http://localhost:3000
```

---

## 1 MINUTO

### Estado Actual ✅
- ✅ Código completamente estructurado
- ✅ Seguridad implementada
- ✅ Dependencias instaladas
- ✅ Documentación lista
- ⏳ **Espera:** Firebase Console setup

### Qué Falta
1. Crear proyecto en Firebase Console (5 min)
2. Obtener credenciales (2 min)
3. Configurar .env.local (2 min)
4. Desplegar rules (2 min)
5. Crear usuarios de prueba (5 min)

**Total:** ~15 minutos

---

## 5 MINUTOS

### Archivo Más Importante: `CHECKLIST.md`

Contiene:
- ✅ Lo que ya está hecho
- ⏳ Los pasos exactos por hacer
- 🚨 Troubleshooting
- 📱 Comandos útiles

**Lee esto primero → CHECKLIST.md**

---

## 15 MINUTOS

### Setup Firebase (Fase 2)

```
1. Ir a console.firebase.google.com
2. Crear proyecto "Med-iTrack"
3. Obtener credenciales
4. Llenar .env.local
5. Habilitar Auth, Firestore, Storage
6. Crear usuarios de prueba
```

**Guía detallada en:** `CHECKLIST.md` → Fase 2

---

## 20 MINUTOS

### Desplegar Rules (Fase 3)

```bash
# 1. Instalar CLI
npm install -g firebase-tools

# 2. Autenticarse
firebase login

# 3. Inicializar
firebase init

# 4. Desplegar
firebase deploy --only firestore:rules,storage
```

**Instrucciones en:** `CHECKLIST.md` → Fase 3

---

## 5 MINUTOS

### Crear Colecciones (Fase 4)

En Firebase Console:
1. Crear colección `users`
2. Crear colección `patients`
3. Crear colección `appointments`
4. Crear colección `audit_logs`

**Detalles en:** `CHECKLIST.md` → Fase 4

---

## 5 MINUTOS

### Iniciar Desarrollo (Fase 5)

```bash
npm run dev
# Abre: http://localhost:3000
```

**Test login:**
- Email: doctor@test.com
- Password: (la que creaste)

---

## ARCHIVOS IMPORTANTES

| Archivo | Propósito | Leer |
|---------|-----------|------|
| **CHECKLIST.md** | Pasos por hacer | 👈 PRIMERO |
| **README.md** | Descripción proyecto | Segundo |
| **.env.local** | Credenciales (PRIVADO) | Llenar con Firebase |
| **firestore.rules** | Seguridad DB | NO editar |
| **storage.rules** | Seguridad archivos | NO editar |

---

## COMANDOS FRECUENTES

```bash
# Desarrollo
npm run dev          # Iniciar servidor (localhost:3000)
npm run build        # Build para producción
npm run lint         # Chequear código

# Firebase
firebase deploy      # Desplegar todo
firebase login       # Autenticarse
firebase init        # Inicializar

# Limpiar
npm install          # Instalar dependencias nuevas
npm audit fix        # Arreglar vulnerabilidades
```

---

## 🚨 NO OLVIDES

1. **NO COMMITEAR .env.local**
   - Nunca subir credenciales a git
   - Ya está en .gitignore

2. **Usar SETUP.md para detalles**
   - CHECKLIST.md es resumen
   - SETUP.md es guía completa

3. **Seguir Fases en orden**
   - No saltarte ninguna
   - Cada una depende de la anterior

4. **Probar después de cada fase**
   - Firebase Console → verificar datos
   - npm run dev → verificar login

---

## ⏱️ TIMELINE

```
Ahora:     Lectura CHECKLIST.md       (5 min)
+5min:     Setup Firebase Console      (15 min)
+20min:    Desplegar rules            (5 min)
+25min:    Crear colecciones          (5 min)
+30min:    Iniciar desarrollo         (5 min)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total:     45-50 MINUTOS

Resultado: App funcionando ✅
```

---

## 🎯 AHORA MISMO

### Paso 1: Abre este archivo
```
CHECKLIST.md
```

### Paso 2: Ve a "Fase 2"
```
Sigue instrucciones Firebase Console
```

### Paso 3: Vuelve aquí cuando termines
```
Fase 3 (Desplegar Rules)
```

---

## ✨ ESTADO DEL PROYECTO

```
Componentes:       ✅ LISTO
Seguridad:         ✅ IMPLEMENTADA
Documentación:     ✅ COMPLETA
Dependencias:      ✅ INSTALADAS
Firebase Setup:    ⏳ TODO (15 min)
Rules Deploy:      ⏳ TODO (5 min)
Dev Server:        ⏳ TODO (2 min)
```

---

## ❓ AYUDA RÁPIDA

**Problema:** No sé por dónde empezar
→ **Solución:** Lee `CHECKLIST.md`

**Problema:** Quiero entender la arquitectura
→ **Solución:** Lee `ARQUITECTURA.md`

**Problema:** Error al ejecutar comando
→ **Solución:** Ve a `CHECKLIST.md` → Troubleshooting

**Problema:** No entiendo un paso
→ **Solución:** Mira `SETUP.md` para detalles

---

## 🚀 LET'S GO!

```
1. Abre: CHECKLIST.md
2. Ve a: Fase 2
3. Sigue: instrucciones paso a paso
4. Disfruta: tu app funcionando
```

---

**Última actualización:** Noviembre 13, 2025  
**Tiempo estimado:** 45-50 minutos  
**Dificultad:** ⭐⭐ (Muy fácil)  

**¡Adelante! 🚀**
