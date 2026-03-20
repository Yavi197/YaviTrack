import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Patient } from "@/lib/types";

const PATIENTS_COLLECTION = "patients";

export const patientsApi = {
  // Get all patients
  async getPatients(): Promise<Patient[]> {
    try {
      const patientsRef = collection(db, PATIENTS_COLLECTION);
      const snapshot = await getDocs(patientsRef);
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Patient));
    } catch (error: unknown) {
      handleServiceError('fetching patients', error);
      throw error;
    }
  },

  // Get patient by ID
  async getPatient(id: string): Promise<Patient | null> {
    try {
      const docRef = doc(db, PATIENTS_COLLECTION, id);
      const docSnap = await getDocs(query(collection(db, PATIENTS_COLLECTION), where('__name__', '==', id)));
      const patientDoc = docSnap.docs[0];
      return patientDoc ? ({ id: patientDoc.id, ...patientDoc.data() } as Patient) : null;
    } catch (error: unknown) {
      handleServiceError('fetching patient', error);
      throw error;
    }
  },

  // Create patient
  async createPatient(patient: Omit<Patient, "id" | "createdAt" | "updatedAt">): Promise<Patient> {
    try {
      const now = new Date();
      const docRef = await addDoc(collection(db, PATIENTS_COLLECTION), {
        ...patient,
        createdAt: now,
        updatedAt: now,
      });
      return { id: docRef.id, ...patient, createdAt: now, updatedAt: now } as Patient;
    } catch (error: unknown) {
      handleServiceError('creating patient', error);
      throw error;
    }
  },

  // Update patient
  async updatePatient(id: string, updates: Partial<Patient>): Promise<void> {
    try {
      const docRef = doc(db, PATIENTS_COLLECTION, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: new Date(),
      });
    } catch (error: unknown) {
      handleServiceError('updating patient', error);
      throw error;
    }
  },

  // Delete patient
  async deletePatient(id: string): Promise<void> {
    try {
      const docRef = doc(db, PATIENTS_COLLECTION, id);
      await deleteDoc(docRef);
    } catch (error: unknown) {
      handleServiceError('deleting patient', error);
      throw error;
    }
  },
};

function handleServiceError(action: string, error: unknown) {
  // Centraliza el manejo de errores para servicios
  if (error instanceof Error) {
    // Aquí podrías enviar el error a un sistema externo, logger, etc.
    if (process.env.NODE_ENV === 'development') {
      console.error(`[Patients Service Error] Error ${action}:`, error.message);
    }
  } else {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[Patients Service Error] Error ${action}:`, error);
    }
  }
}
