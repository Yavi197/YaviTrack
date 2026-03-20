const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin with the credentials from your .env or Google Cloud
const projectId = 'med-itrack-ai';
const databaseId = 'san-sebastian-ips';

// Get access token from gcloud
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function createUserDocument() {
  try {
    // Get the access token from gcloud
    const { stdout } = await execPromise('gcloud auth application-default print-access-token');
    const accessToken = stdout.trim();

    // User data - CHANGE THESE VALUES
    const userId = '61oyJUBrOQbrHxs18pOLUQilKdb2'; // The UID from your login (from console log)
    const email = 'admin@med-itrack.com'; // Change to your email
    const nombre = 'Francisco Vergara'; // Change to your name

    const userData = {
      fields: {
        activo: { booleanValue: true },
        email: { stringValue: email },
        nombre: { stringValue: nombre },
        operadorActivo: { nullValue: null },
        operadores: { arrayValue: { values: [] } },
        rol: { stringValue: 'administrador' },
        servicioAsignado: { stringValue: 'C.EXT' },
      }
    };

    // Make REST API call to create the document
    const fetch = (await import('node-fetch')).default;
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/users/${userId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ Error creating document:', response.status, error);
      process.exit(1);
    }

    console.log('\n✅ User document created successfully!');
    console.log(`   UID: ${userId}`);
    console.log(`   Email: ${email}`);
    console.log(`   Name: ${nombre}`);
    console.log(`\n📍 Now reload http://localhost:3000 to see your profile\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

createUserDocument();
