const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'med-itrack-ai'
});

const db = admin.firestore();

db.collection('users').doc('ou2Kiz5ODZcsemMWWtsUBJ4z4jj1').set({
  activo: true,
  email: 'admin@med-itrack.com',
  nombre: 'Francisco Vergara',
  operadorActivo: null,
  operadores: [],
  rol: 'administrador',
  servicioAsignado: 'C.EXT'
}).then(() => {
  console.log('✅ Usuario creado en Firestore');
  process.exit(0);
}).catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
