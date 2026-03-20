
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '../.env.local') });

// Try to find the JSON file in root to avoid PEM formatting issues with .env.local
const rootDir = path.join(__dirname, '..');
const jsonFiles = fs.readdirSync(rootDir).filter(f => f.endsWith('.json') && f.startsWith('yavitrack-'));
let credentials;

if (jsonFiles.length > 0) {
  const jsonPath = path.join(rootDir, jsonFiles[0]);
  console.log(`📂 Usando archivo de credenciales: ${jsonFiles[0]}`);
  credentials = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

const projectId = credentials ? credentials.project_id : process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = credentials ? credentials.client_email : process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
let privateKey = credentials ? credentials.private_key : process.env.GOOGLE_PRIVATE_KEY;

if (privateKey && !credentials) {
    // If reading from .env.local, apply common fixes
    privateKey = privateKey.replace(/\\n/g, '\n').replace(/"/g, '');
}

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ Error: Missing credentials in .env.local or JSON file');
  process.exit(1);
}

let app;
try {
  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
  console.log('✅ Firebase Admin initialized');
} catch (error) {
  console.error('❌ Error initializing Firebase Admin:', error.message);
  process.exit(1);
}

// Specify the database ID: san-sebastian-ips
const db = getFirestore('san-sebastian-ips');

async function createAdmin(uid, email, nombre) {
  if (!uid || !email || !nombre) {
    console.error('❌ Error: Debes proporcionar UID, email y nombre.');
    console.log('Uso: node scripts/create-admin.js <UID> <EMAIL> <NOMBRE>');
    process.exit(1);
  }

  try {
    const userRef = db.collection('users').doc(uid);
    await userRef.set({
      uid,
      email,
      nombre,
      rol: 'administrador',
      activo: true,
      servicioAsignado: 'General',
      operadores: [],
      operadorActivo: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`\n✅ Usuario creado exitosamente en Firestore!`);
    console.log(`   Poryecto: ${projectId}`);
    console.log(`   Database: san-sebastian-ips`);
    console.log(`   UID: ${uid}`);
    console.log(`   Email: ${email}`);
    console.log(`   Nombre: ${nombre}`);
    console.log(`   Rol: administrador\n`);
    console.log(`📍 Ahora puedes iniciar sesión en http://localhost:3000/login`);
  } catch (error) {
    console.error('❌ Error al crear el documento en Firestore:', error.message);
  }
}

// Get arguments from command line
const [,, uid, email, nombre] = process.argv;
createAdmin(uid, email, nombre);
