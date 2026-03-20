
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const fs = require('fs');
const path = require('path');

// Try to find the JSON file in root 
const rootDir = path.join(__dirname, '..');
const jsonFiles = fs.readdirSync(rootDir).filter(f => f.endsWith('.json') && f.startsWith('yavitrack-'));
let credentials;

if (jsonFiles.length > 0) {
  const jsonPath = path.join(rootDir, jsonFiles[0]);
  credentials = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
} else {
    console.error('❌ Error: No se encontró el archivo JSON de credenciales.');
    process.exit(1);
}

const projectId = credentials.project_id;
const clientEmail = credentials.client_email;
const privateKey = credentials.private_key;

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

const db = getFirestore('san-sebastian-ips');

async function createMaria() {
  const uid = 'ESZ5rsP8u4Z590ICQl4mFBZ398x1';
  try {
    const userRef = db.collection('users').doc(uid);
    await userRef.set({
      uid,
      email: 'mcarrascal@css.com',
      nombre: 'Maria A. Carrascal',
      rol: 'transcriptora',
      activo: true,
      servicioAsignado: 'ECO',
      subServicioAsignado: '',
      operadorActivo: 'Dr. Pastrana',
      operadores: [
        'Dra. Serpa',
        'Dr. Pastrana',
        'Dr. Pinto',
        'Dr. Severiche',
        'Dr. Rojas'
      ],
      operationalStatus: '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`\n✅ Usuario 'Maria A. Carrascal' creado exitosamente!`);
    console.log(`   Database: san-sebastian-ips`);
    console.log(`   Rol: transcriptora`);
    console.log(`   Servicio: ECO`);
  } catch (error) {
    console.error('❌ Error al crear el documento en Firestore:', error.message);
  }
}

createMaria();
