
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

async function initializeCollections() {
  const collections = [
    { name: 'appConfig', doc: 'general', data: { lastUpdate: admin.firestore.FieldValue.serverTimestamp(), version: '1.0.0' } },
    { name: 'inventorySettings', doc: 'contrastStock', data: { offsetMl: 0 } },
    { name: 'inventoryItems', doc: 'placeholder', data: { name: 'Item de prueba', isContrast: false, content: 0 } },
    { name: 'inventoryEntries', doc: 'placeholder', data: { date: admin.firestore.FieldValue.serverTimestamp() } },
    { name: 'inventoryConsumptions', doc: 'placeholder', data: { date: admin.firestore.FieldValue.serverTimestamp() } },
    { name: 'messages', doc: 'placeholder', data: { createdAt: admin.firestore.FieldValue.serverTimestamp() } },
    { name: 'operationalExpenses', doc: 'placeholder', data: { date: admin.firestore.FieldValue.serverTimestamp() } },
    { name: 'operationalStatusHistory', doc: 'placeholder', data: { timestamp: admin.firestore.FieldValue.serverTimestamp() } },
    { name: 'remissions', doc: 'placeholder', data: { requestDate: admin.firestore.FieldValue.serverTimestamp() } },
    { name: 'shiftHandovers', doc: 'placeholder', data: { timestamp: admin.firestore.FieldValue.serverTimestamp() } },
    { name: 'specialists', doc: 'placeholder', data: { nombre: 'Especialista de prueba' } },
    { name: 'studies', doc: 'placeholder', data: { requestDate: admin.firestore.FieldValue.serverTimestamp(), status: 'Pendiente' } },
    { name: 'technologistShifts', doc: 'placeholder', data: { date: admin.firestore.FieldValue.serverTimestamp() } },
    { name: 'turnero', doc: 'placeholder', data: { lastNumber: 0, date: admin.firestore.FieldValue.serverTimestamp() } }
  ];

  console.log(`\n⏳ Inicializando ${collections.length} colecciones en 'san-sebastian-ips'...`);

  for (const coll of collections) {
    try {
      await db.collection(coll.name).doc(coll.doc).set(coll.data);
      console.log(`✅ Colección '${coll.name}' inicializada.`);
    } catch (error) {
      console.error(`❌ Error en '${coll.name}':`, error.message);
    }
  }

  console.log(`\n✨ Todas las colecciones han sido creadas exitosamente.\n`);
}

initializeCollections();
