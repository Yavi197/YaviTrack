// Script to sync Firebase Auth users to Firestore
// Run with: node scripts/sync-auth-users.js

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccount = require(path.join(__dirname, '../firebase-service-account.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'med-itrack-hyyat'
});

const auth = admin.auth();
const db = admin.firestore();

async function syncAuthUsersToFirestore() {
  try {
    console.log('Starting sync of Auth users to Firestore...');
    
    // Get all users from Firebase Auth
    const listUsersResult = await auth.listUsers(1000);
    
    let createdCount = 0;
    let skippedCount = 0;
    
    for (const userRecord of listUsersResult.users) {
      const uid = userRecord.uid;
      const email = userRecord.email;
      const displayName = userRecord.displayName || email.split('@')[0];
      
      // Check if user already exists in Firestore
      const userDoc = await db.collection('users').doc(uid).get();
      
      if (userDoc.exists) {
        console.log(`⏭️  User ${email} already exists in Firestore`);
        skippedCount++;
      } else {
        // Create user document in Firestore with default values
        await db.collection('users').doc(uid).set({
          uid: uid,
          email: email,
          nombre: displayName,
          rol: 'tecnologo', // Default role - change as needed
          activo: true,
          operadores: [],
          operadorActivo: null,
          servicioAsignado: 'C.EXT',
          operationalStatus: 'Disponible',
          createdAt: new Date(),
          updatedAt: new Date()
        });
        console.log(`✅ Created user ${email} in Firestore`);
        createdCount++;
      }
    }
    
    console.log(`\n✅ Sync complete!`);
    console.log(`   Created: ${createdCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log(`   Total: ${createdCount + skippedCount}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error syncing users:', error);
    process.exit(1);
  }
}

syncAuthUsersToFirestore();
