
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

const users = [
  {
    uid: 'evZQ9hmDLmcpkjwcS7IOG2h5B9G3',
    email: 'gpayares@css.com',
    nombre: 'Gabriel Payares',
    rol: 'tecnologo',
    servicioAsignado: 'RX',
    operadores: ['Gabriel Payares'],
    operationalStatus: 'Disponible'
  },
  {
    uid: 'zgQ8nU7DQohaU9q3nJMSgs3uWLR2',
    email: 'nmarsiglia@css.com',
    nombre: 'Nora Marsiglia',
    rol: 'tecnologo',
    servicioAsignado: 'RX',
    operadores: ['Nora Marsiglia'],
    operationalStatus: 'Disponible'
  },
  {
    uid: 'ChVUaaLioNbeaRn0NXSvuVWxns83',
    email: 'opadilla@css.com',
    nombre: 'Onasis Padilla',
    rol: 'tecnologo',
    servicioAsignado: 'RX',
    operadores: ['Onasis Padilla'],
    operadorActivo: 'Onasis Padilla',
    operationalStatus: 'Disponible'
  },
  {
    uid: '0XsYI8iBDNamHmoQfOEtHCjUkrW2',
    email: 'hrhenals@css.com',
    nombre: 'Hernan Rhenals',
    rol: 'tecnologo',
    servicioAsignado: 'RX',
    operadores: ['Hernan Rhenals'],
    operationalStatus: 'Disponible'
  },
  {
    uid: 'xixrGYfmJIRJa8urS8SDsQBZ6Al1',
    email: 'mpadilla@css.com',
    nombre: 'Mario Padilla',
    rol: 'tecnologo',
    servicioAsignado: 'RX',
    operadores: ['Hernan Rhenals'],
    operationalStatus: 'Disponible'
  }
];

async function createBatch() {
  console.log(`\n⏳ Iniciando creación de ${users.length} usuarios...`);
  
  for (const user of users) {
    try {
      const userRef = db.collection('users').doc(user.uid);
      await userRef.set({
        uid: user.uid,
        email: user.email,
        nombre: user.nombre,
        rol: user.rol,
        activo: true,
        servicioAsignado: user.servicioAsignado,
        subServicioAsignado: '',
        operadorActivo: user.operadorActivo || null,
        operadores: user.operadores,
        operationalStatus: user.operationalStatus,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`✅ Usuario '${user.nombre}' creado.`);
    } catch (error) {
      console.error(`❌ Error con usuario '${user.nombre}':`, error.message);
    }
  }
  
  console.log(`\n✨ Proceso completado exitosamente.\n`);
}

createBatch();
