const admin = require('firebase-admin');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

// Initialize Firebase Admin SDK
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT_PATH not set in .env.local');
  console.log('You need to download your service account key from Firebase Console');
  process.exit(1);
}

const serviceAccount = require(path.resolve(serviceAccountPath));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});

const db = admin.firestore();

async function setupUser() {
  const userId = process.argv[2];
  const email = process.argv[3];
  const nombre = process.argv[4];

  if (!userId || !email || !nombre) {
    console.error('Usage: node setup-user.js <userId> <email> <nombre>');
    console.error('Example: node setup-user.js 61oyJUBrOQbrHxs18pOLUQilKdb2 test@example.com "Test User"');
    process.exit(1);
  }

  try {
    console.log(`\n📝 Creating user document for: ${email}`);
    
    const userDoc = {
      activo: true,
      email: email,
      nombre: nombre,
      operadorActivo: null,
      operadores: [],
      rol: 'administrador',
      servicioAsignado: 'C.EXT',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('users').doc(userId).set(userDoc);
    
    console.log('✅ User document created successfully!');
    console.log(`   UID: ${userId}`);
    console.log(`   Email: ${email}`);
    console.log(`   Name: ${nombre}`);
    console.log('\n Now reload http://localhost:3000 to see your profile\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating user document:', error.message);
    process.exit(1);
  }
}

setupUser();
