
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

let adminApp: admin.app.App | null = null;

export function getAdminApp(): admin.app.App | null {
  const fs = require('fs');
  const path = require('path');

  // Return existing app if already initialized
  if (adminApp) {
    return adminApp;
  }

  // Check if already initialized by admin SDK
  if (admin.apps.length > 0) {
    return admin.apps[0];
  }

  let projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  let clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  // Try to find the JSON file in root to avoid PEM formatting issues with .env.local
  const rootDir = process.cwd();
  const jsonFiles = fs.readdirSync(rootDir).filter((f: string) => f.endsWith('.json') && f.startsWith('yavitrack-'));
  
  if (jsonFiles.length > 0) {
    try {
      const jsonPath = path.join(rootDir, jsonFiles[0]);
      const credentials = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      projectId = credentials.project_id;
      clientEmail = credentials.client_email;
      privateKey = credentials.private_key;
      console.log(`[Firebase Admin] Usando archivo de credenciales directo: ${jsonFiles[0]}`);
    } catch (error) {
      console.warn("[Firebase Admin] Error al leer el archivo JSON, probando con .env:", error);
    }
  }

  if (!projectId || !clientEmail || !privateKey) {
    console.warn('[Firebase Admin] Missing credentials:', { projectId: !!projectId, clientEmail: !!clientEmail, privateKey: !!privateKey });
    return null;
  }

  try {
    const formattedKey = privateKey.replace(/\\n/g, '\n').replace(/"/g, '').trim();
    
    adminApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: formattedKey,
      }),
    });

    console.log('[Firebase Admin] Successfully initialized');
    return adminApp;
  } catch (error) {
    console.error('[Firebase Admin Error]', error);
    return null;
  }
}

export function getAdminAuth(): admin.auth.Auth | null {
  const app = getAdminApp();
  return app ? admin.auth(app) : null;
}

export function getAdminFirestore(): admin.firestore.Firestore | null {
  const app = getAdminApp();
  return app ? getFirestore(app, 'san-sebastian-ips') : (null as any);
}
