
'use server';

import 'dotenv/config';
import { extractOrderData } from "@/ai/flows/extract-order-flow";
import { extractReportText as extractReportTextFlow } from "@/ai/flows/extract-report-text-flow";
import { generateSilenceRequestAudio as generateSilenceRequestAudioFlow, generateTurnCallAudio as generateTurnCallAudioFlow } from "@/ai/flows/tts-flow";
import { transcribeAudio as transcribeAudioFlow, type TranscribeInput } from "@/ai/flows/stt-flow";
import { db, storage } from "@/lib/firebase";
import type { Study, UserProfile, OrderData, StudyStatus, GeneralService, SubServiceArea, OperationalStatus, StudyWithCompletedBy, Message, ContrastType, InventoryItem, InventoryCategory, OperationalExpense, ConsumedItem, Specialist, InventoryStockEntry, InventoryConsumption, RemissionStatus, Remission, TechnologistShift, ShiftAssignableRole, QualityReport } from '@/lib/types';
import { addDoc, collection, doc, serverTimestamp, updateDoc, setDoc, deleteDoc, deleteField, getDocs, query, where, Timestamp, getDoc, arrayUnion, arrayRemove, orderBy, runTransaction, increment, writeBatch, or, limit } from "firebase/firestore";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { z } from "zod";
import { CalendarModalities, GeneralServices, InventoryCategories, Modalities, ShiftTypes, SubServiceAreas, QualityReportTypes, QualityReportCategories, QualityReportInvolvedRoles, QualityReportAreas } from "@/lib/types";
import { format, differenceInYears, startOfDay, endOfDay, subHours, parse } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { getAuth, sendPasswordResetEmail as firebaseSendPasswordResetEmail, signInWithCustomToken } from "firebase/auth";
import { getAdminAuth } from "@/lib/firebase-admin";
import { firebaseConfig } from '@/lib/firebaseConfig';
import { PDFDocument, rgb, StandardFonts, PageSizes } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';
import { appendOrderToSheet, appendOrUpdateRemissionSheet, appendInventoryEntriesToSheet, appendQualityReportToSheet, deleteRowsByColumnValues } from '@/services/google-sheets';
import { EXPORT_COLUMNS, REMISSION_EXPORT_COLUMNS, INVENTORY_EXPORT_COLUMNS } from '@/services/export-columns';
import { exportStudiesToExcel } from '@/services/excel-export';
import { sendWhatsAppMessage } from '@/services/twilio';
import { google } from 'googleapis';
import { sheets_v4 } from 'googleapis';
import { generateTechnologistMonthlyShifts, getShiftTimingForDate } from '@/lib/technologist-shift-generator';
const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const REMISSIONS_SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID_REMISSIONS;
const INVENTORY_SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID_INVENTORY;
const QUALITY_REPORTS_SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID_QUALITY_REPORTS;

export async function extractStudyDataAction(input: { medicalOrderDataUri: string }) {
    try {
        const result = await extractOrderData(input);
        return { success: true, data: result };
    } catch(error: any) {
        console.error("AI extraction error:", error);
        return { success: false, error: error.message || "Failed to extract data from the document." };
    }
}

const technologistShiftInputSchema = z.object({
    technologistId: z.string().min(1, 'technologistId is required'),
    year: z.number().int().min(2020).max(2100),
    month: z.number().int().min(1).max(12),
    startSequenceIndex: z.number().int().min(0).max(3).default(0),
    holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    notesByDate: z.record(z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.string()).optional(),
    manualOverrides: z.array(z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        shiftType: z.enum(ShiftTypes),
        modality: z.enum(CalendarModalities),
        note: z.string().max(280).optional(),
    })).optional(),
    assignedUserName: z.string().min(1).optional(),
    assignedRole: z.enum(['tecnologo', 'transcriptora'] as const).optional(),
});

export async function generateTechnologistShiftsAction(input: z.infer<typeof technologistShiftInputSchema>) {
    const params = technologistShiftInputSchema.safeParse(input);
    if (!params.success) {
        return { success: false, error: params.error.issues.map(issue => issue.message).join(', ') };
    }

    try {
        const shifts = generateTechnologistMonthlyShifts({
            technologistId: params.data.technologistId,
            year: params.data.year,
            month: params.data.month,
            startSequenceIndex: params.data.startSequenceIndex,
            holidays: params.data.holidays,
            notesByDate: params.data.notesByDate,
            manualOverrides: params.data.manualOverrides,
        });

        if (!shifts.length) {
            return { success: false, error: 'No se generaron turnos.' };
        }

        const batch = writeBatch(db);
        const collectionRef = collection(db, 'technologistShifts');

        for (const shift of shifts) {
            const docRef = doc(collectionRef);
            batch.set(docRef, {
                ...shift,
                assignedUserId: params.data.technologistId,
                assignedUserName: params.data.assignedUserName,
                assignedRole: params.data.assignedRole ?? 'tecnologo',
                createdAt: serverTimestamp() as any,
                updatedAt: serverTimestamp() as any,
            } satisfies TechnologistShift);
        }

        await batch.commit();

        return { success: true, inserted: shifts.length };
    } catch (error: any) {
        console.error('Failed to generate technologist shifts:', error);
        return { success: false, error: error.message || 'No se pudieron generar los turnos.' };
    }
}

const calendarShiftSchema = z.object({
    shiftId: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    shiftType: z.enum(ShiftTypes),
    modality: z.enum(CalendarModalities),
    assignedUserId: z.string().min(1),
    assignedUserName: z.string().min(1),
    assignedRole: z.enum(['tecnologo', 'transcriptora'] as const),
    notes: z.string().max(280).optional(),
});

export async function upsertCalendarShiftAction(input: z.infer<typeof calendarShiftSchema>) {
    const parsed = calendarShiftSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues.map(issue => issue.message).join(', ') };
    }

    try {
        const { shiftId, date, shiftType, modality, assignedUserId, assignedUserName, assignedRole, notes } = parsed.data;
        const { startTime, endTime, hours } = getShiftTimingForDate(date, shiftType);
        const baseData: Partial<TechnologistShift> = {
            technologistId: assignedUserId,
            assignedUserId,
            assignedUserName,
            assignedRole,
            date,
            shiftType,
            modality,
            sequenceOrder: 0,
            startTime,
            endTime,
            hours,
            holiday: false,
            status: 'assigned',
            metadata: {
                modality,
                manualEntry: true,
            },
        };

        if (notes !== undefined) {
            baseData.notes = notes;
        }

        if (shiftId) {
            const ref = doc(db, 'technologistShifts', shiftId);
            await updateDoc(ref, {
                ...baseData,
                updatedAt: serverTimestamp(),
            });
            return { success: true, id: shiftId };
        }

        const collectionRef = collection(db, 'technologistShifts');
        const ref = doc(collectionRef);
        await setDoc(ref, {
            ...baseData,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
        return { success: true, id: ref.id };
    } catch (error: any) {
        console.error('Failed to save calendar shift:', error);
        return { success: false, error: error.message || 'No se pudo guardar el turno.' };
    }
}

const deleteCalendarShiftSchema = z.object({
    shiftId: z.string().min(1),
});

export async function deleteCalendarShiftAction(input: z.infer<typeof deleteCalendarShiftSchema>) {
    const parsed = deleteCalendarShiftSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues.map(issue => issue.message).join(', ') };
    }

    try {
        const ref = doc(db, 'technologistShifts', parsed.data.shiftId);
        await deleteDoc(ref);
        return { success: true };
    } catch (error: any) {
        console.error('Failed to delete calendar shift:', error);
        return { success: false, error: error.message || 'No se pudo eliminar el turno.' };
    }
}



const qualityReportInputSchema = z.object({
    reportType: z.enum(QualityReportTypes),
    category: z.enum(QualityReportCategories),
    modality: z.enum(QualityReportAreas),
    involvedRole: z.enum(QualityReportInvolvedRoles),
    involvedUserId: z.string().trim().max(120).optional(),
    involvedUserName: z.string().trim().max(120).optional(),
    otherPersonName: z.string().trim().max(120).optional(),
    referenceId: z.string().trim().max(80).optional(),
    patientId: z.string().trim().max(80).optional(),
    patientName: z.string().trim().max(120).optional(),
    description: z.string().trim().min(10, 'Describe brevemente la novedad.').max(2000),
}).superRefine((data, ctx) => {
    if (data.involvedRole === 'Tecnólogo') {
        if (!data.involvedUserId) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['involvedUserId'], message: 'Selecciona al tecnólogo relacionado.' });
        }
        if (!data.involvedUserName) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['involvedUserName'], message: 'El nombre del tecnólogo es requerido.' });
        }
    } else if (data.involvedRole !== 'N/A' && !data.otherPersonName?.trim()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['otherPersonName'], message: 'Indica el nombre del personal involucrado.' });
    }
});

export async function submitQualityReportAction(
    input: z.infer<typeof qualityReportInputSchema>,
    userProfile: UserProfile | null,
) {
    if (!userProfile) {
        return { success: false, error: 'Usuario no autenticado.' };
    }

    const parsed = qualityReportInputSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues.map(issue => issue.message).join(', ') };
    }

    try {
        const docRef = doc(collection(db, 'qualityReports'));
        const createdAt = Timestamp.fromDate(new Date());
        const sanitized = {
            ...parsed.data,
            involvedUserId: parsed.data.involvedUserId?.trim() || undefined,
            involvedUserName: parsed.data.involvedUserName?.trim() || undefined,
            otherPersonName: parsed.data.otherPersonName?.trim() || undefined,
            referenceId: parsed.data.referenceId?.trim() || undefined,
            patientId: parsed.data.patientId?.trim() || undefined,
            patientName: parsed.data.patientName?.trim() || undefined,
        };
        const cleaned = Object.fromEntries(
            Object.entries(sanitized).filter(([, value]) => value !== undefined),
        ) as typeof sanitized;

        const payload: Omit<QualityReport, 'id'> = {
            ...cleaned,
            status: 'Pendiente',
            reportedBy: {
                uid: userProfile.uid,
                name: userProfile.nombre,
                role: userProfile.rol,
            },
            createdAt,
        };

        await setDoc(docRef, payload);
        await appendQualityReportToSheet({ ...payload, id: docRef.id });
        return { success: true, id: docRef.id };
    } catch (error: any) {
        console.error('[Quality Report] Error creating report:', error);
        return { success: false, error: error.message || 'No se pudo registrar la novedad.' };
    }
}

const resetContrastStockSchema = z.object({
    currentTotalMl: z.number().finite(),
});

export async function resetContrastStockCounterAction(
    input: z.infer<typeof resetContrastStockSchema>,
    userProfile: UserProfile | null,
) {
    if (!userProfile || userProfile.rol !== 'administrador') {
        return { success: false, error: 'No autorizado.' };
    }

    const parsed = resetContrastStockSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: parsed.error.errors.map(issue => issue.message).join(', ') };
    }

    try {
        const metaRef = doc(db, 'inventorySettings', 'contrastStock');
        await setDoc(metaRef, {
            offsetMl: parsed.data.currentTotalMl,
            updatedAt: serverTimestamp(),
            updatedBy: {
                uid: userProfile.uid,
                name: userProfile.nombre,
            },
        }, { merge: true });

        return { success: true };
    } catch (error: any) {
        console.error('[Contrast Stock] Failed to reset counter:', error);
        return { success: false, error: 'No se pudo reiniciar el contador.' };
    }
}

const getAgeFromBirthDate = (birthDateString?: string): number | null => {
    if (!birthDateString) return null;
    try {
        const dateParts = birthDateString.split(/[-/]/);
        if (dateParts.length !== 3) return null;
        
        let day, month, year;
        
        if (dateParts[0].length === 4) { // YYYY-MM-DD
            year = parseInt(dateParts[0], 10);
            month = parseInt(dateParts[1], 10) - 1;
            day = parseInt(dateParts[2], 10);
        } else if (dateParts[2].length === 4) { // DD/MM/YYYY or MM/DD/YYYY
            day = parseInt(dateParts[0], 10);
            month = parseInt(dateParts[1], 10) - 1;
            year = parseInt(dateParts[2], 10);
        } else {
            return null; // Unsupported format
        }

        if (isNaN(day) || isNaN(month) || isNaN(year)) return null;

        // Simple heuristic to differentiate DD/MM from MM/DD
        if (month > 11) {
             [day, month] = [month+1, day-1];
        }

        const birthDate = new Date(year, month, day);
        if (isNaN(birthDate.getTime())) return null;

        return differenceInYears(new Date(), birthDate);
    } catch { 
        return null; 
    }
}

type CreateStudyOptions = {
    creatinine?: number;
    service?: GeneralService;
    subService?: SubServiceArea;
    skipDuplicateCheck?: boolean;
};

export async function createStudyAction(
    data: OrderData, 
    userProfile: UserProfile | null,
    options: CreateStudyOptions = {}
): Promise<{ 
    success: boolean; 
    error?: string; 
    studyCount?: number; 
    requiresConfirmation?: boolean; 
    duplicateStudyName?: string; 
}> {
    if (!userProfile) {
        return { success: false, error: "User profile not available." };
    }

    // Role-based restriction for Remissions and Consultations
    const serviceString = options.service as string;
    const assignedServiceString = userProfile.servicioAsignado as string;
    const isRestrictedModule = serviceString === 'REMISIONES' || serviceString === 'CONSULTAS' || 
                              (!options.service && (assignedServiceString === 'REMISIONES' || assignedServiceString === 'CONSULTAS'));
    
    if (isRestrictedModule && userProfile.rol !== 'administrador') {
        return { success: false, error: "Solo el administrador puede crear solicitudes en este módulo." };
    }

    try {
        const studiesToCreate = data.studies;

        if (studiesToCreate.length === 0) {
            return { success: false, error: "No se encontraron estudios o consultas en la orden." };
        }
        
        if (!options.skipDuplicateCheck && studiesToCreate.length > 0) {
            const firstStudy = studiesToCreate[0];
            const twentyFourHoursAgo = Timestamp.fromDate(subHours(new Date(), 24));

            const q = query(
                collection(db, "studies"),
                where("patient.id", "==", data.patient.id),
                where("studies.0.nombre", "==", firstStudy.nombre),
                where("requestDate", ">=", twentyFourHoursAgo)
            );

            const duplicateSnapshot = await getDocs(q);
            if (!duplicateSnapshot.empty) {
                return { 
                    success: false, 
                    requiresConfirmation: true,
                    duplicateStudyName: firstStudy.nombre,
                    error: `Ya existe un estudio de '${firstStudy.nombre}' para este paciente creado en las últimas 24 horas.`
                };
            }
        }

        let service: Study['service'];
        let subService: Study['subService'];

        if (options.service && options.subService) {
            service = options.service;
            subService = options.subService;
        } else if (GeneralServices.includes(userProfile.servicioAsignado as any)) {
            service = userProfile.servicioAsignado as Study['service'];
            subService = userProfile.subServicioAsignado || "AMB";
        } else {
            service = "C.EXT";
            subService = "AMB";
        }
        
        const batch = writeBatch(db);
        const sheetSyncQueue: Study[] = [];

        for (const singleStudy of studiesToCreate) {
            const newStudyRef = doc(collection(db, "studies"));
            
            const studyData: Partial<Study> & {patient: OrderData['patient']} = {
                patient: {
                    ...data.patient,
                    idType: data.patient.idType,
                },
                diagnosis: data.diagnosis,
                studies: [singleStudy], 
                service,
                subService,
                status: "Pendiente",
                requestDate: serverTimestamp() as Timestamp,
                admissionNumber: data.admissionNumber || 'INGRESO MANUAL',
                referenceNumber: data.referenceNumber || undefined,
            };

            if (data.orderDate) {
                const parseOrderDate = (raw: string) => {
                    const candidates = ['dd/MM/yyyy', 'd/M/yyyy', 'yyyy-MM-dd', 'dd-MM-yyyy'];
                    for (const mask of candidates) {
                        try {
                            const parsed = parse(raw.trim(), mask, new Date());
                            if (!isNaN(parsed.getTime())) {
                                return parsed;
                            }
                        } catch {/* ignore and try next format */}
                    }
                    return null;
                };

                const parsedDate = parseOrderDate(data.orderDate);
                if (parsedDate) {
                    parsedDate.setUTCHours(12, 0, 0, 0); // keep same calendar day regardless of viewer timezone
                    studyData.orderDate = Timestamp.fromDate(parsedDate);
                } else {
                    console.warn(`Could not parse orderDate: ${data.orderDate}`);
                }
            }

            if (data.orderingPhysician) {
                studyData.orderingPhysician = data.orderingPhysician;
            }
            
            if (data.requiresCreatinine && options.creatinine) {
                studyData.contrastType = 'IV';
                studyData.creatinine = options.creatinine;
                const age = getAgeFromBirthDate(data.patient.birthDate);
                studyData.contrastBilledMl = (age !== null && age < 10) ? 50 : 100;
            }

            batch.set(newStudyRef, studyData);

            const sheetPayload: Study = {
                ...(studyData as Study),
                id: newStudyRef.id,
                requestDate: serverTimestamp() as any,
                completionDate: undefined,
                readingDate: undefined,
            };
            sheetSyncQueue.push(sheetPayload);
        }
        
        await batch.commit();

        if (sheetSyncQueue.length > 0) {
            const syncResults = await Promise.allSettled(sheetSyncQueue.map(study => appendOrderToSheet(study)));
            syncResults.forEach(result => {
                if (result.status === 'rejected') {
                    console.error('[ACTION LOG] Error creating Sheets entry during study creation:', result.reason);
                }
            });
        }
        
        return { success: true, studyCount: studiesToCreate.length };
    } catch (error: any) {
        console.error("Failed to create study:", error);
        return { success: false, error: `Failed to create study: ${error.message}` };
    }
}


export async function updateStudyAction(studyId: string, data: OrderData) {
    if (!Array.isArray(data.studies) || data.studies.length === 0) {
        return { success: false, error: 'Debes seleccionar al menos un estudio.' };
    }

    try {
        const studyRef = doc(db, 'studies', studyId);
        const existingSnapshot = await getDoc(studyRef);

        if (!existingSnapshot.exists()) {
            return { success: false, error: 'El estudio que intentas actualizar no existe.' };
        }

        const existingData = existingSnapshot.data() as Study;
        const [primaryStudy, ...additionalStudies] = data.studies;
        const batch = writeBatch(db);
        const sheetSyncQueue: Study[] = [];
        const toDateValue = (value: any) => {
            if (!value) return undefined;
            if (value instanceof Timestamp) return value.toDate();
            if (typeof value.toDate === 'function') return value.toDate();
            return value as Date | undefined;
        };

        const primaryUpdate: Partial<Study> & { patient: OrderData['patient']; diagnosis: OrderData['diagnosis']; studies: Study['studies'] } = {
            patient: data.patient,
            diagnosis: data.diagnosis,
            studies: [primaryStudy],
        };

        batch.update(studyRef, primaryUpdate);

        let createdEntries = 0;

        for (const extraStudy of additionalStudies) {
            const newStudyRef = doc(collection(db, 'studies'));
            const newStudyData: Partial<Study> & {
                patient: OrderData['patient'];
                diagnosis: OrderData['diagnosis'];
                studies: Study['studies'];
                service: Study['service'];
                subService: Study['subService'];
                status: Study['status'];
                requestDate: Study['requestDate'];
            } = {
                patient: data.patient,
                diagnosis: data.diagnosis,
                studies: [extraStudy],
                service: existingData.service,
                subService: existingData.subService,
                status: 'Pendiente',
                requestDate: serverTimestamp() as Timestamp,
                admissionNumber: existingData.admissionNumber || 'INGRESO MANUAL',
                referenceNumber: existingData.referenceNumber || undefined,
            };

            if (existingData.orderDate) newStudyData.orderDate = existingData.orderDate;
            if (existingData.orderingPhysician) newStudyData.orderingPhysician = existingData.orderingPhysician;
            if (existingData.specialist) newStudyData.specialist = existingData.specialist;
            if (existingData.medicalRecord) newStudyData.medicalRecord = existingData.medicalRecord;
            if (existingData.observaciones) newStudyData.observaciones = existingData.observaciones;
            if (existingData.observation) newStudyData.observation = existingData.observation;
            if (existingData.observations) newStudyData.observations = existingData.observations;
            if (existingData.turnNumber) newStudyData.turnNumber = existingData.turnNumber;
            if (existingData.bedNumber) newStudyData.bedNumber = existingData.bedNumber;
            if (existingData.assignedSpecialistId) newStudyData.assignedSpecialistId = existingData.assignedSpecialistId;

            batch.set(newStudyRef, newStudyData);
            createdEntries += 1;

            const sheetPayload: Study = {
                ...existingData,
                id: newStudyRef.id,
                patient: data.patient,
                diagnosis: data.diagnosis,
                studies: [extraStudy],
                service: existingData.service,
                subService: existingData.subService,
                status: 'Pendiente',
                requestDate: serverTimestamp() as any,
                completionDate: undefined,
                readingDate: undefined,
                orderDate: toDateValue(existingData.orderDate),
            } as Study;

            sheetSyncQueue.push(sheetPayload);
        }

        await batch.commit();

        if (sheetSyncQueue.length > 0) {
            const syncResults = await Promise.allSettled(sheetSyncQueue.map(study => appendOrderToSheet(study)));
            syncResults.forEach(result => {
                if (result.status === 'rejected') {
                    console.error('[ACTION LOG] Error creating Sheets entry during study edit:', result.reason);
                }
            });
        }

        return { success: true, createdEntries };
    } catch (error: any) {
        console.error('Failed to update study:', error);
        return { success: false, error: `Failed to update study: ${error.message}` };
    }
}

export async function updateStudyStatusAction(
    studyId: string, 
    status: Study['status'], 
    userProfile: UserProfile | null, 
    params?: { 
        kV?: number; 
        mA?: number; 
        timeMs?: number; 
        ctdi?: number;
        dlp?: number;
        consumedItems?: ConsumedItem[];
        contrastAdministeredMl?: number;
    }, 
    completedByOperator?: string,
    cancellationReason?: string
) {
    if (!userProfile) {
        return { success: false, error: "User profile not available." };
    }

    // Security Audit: Only admin can revert to Pendiente
    if (status === 'Pendiente' && userProfile.rol !== 'administrador') {
        return { success: false, error: "Solo el administrador puede revertir un estudio a pendiente." };
    }

    // Security Audit: Cancellation restrictions
    if (status === 'Cancelado') {
        const allowedToCancel = ['administrador', 'tecnologo', 'admisionista', 'transcriptora'];
        if (!allowedToCancel.includes(userProfile.rol)) {
            return { success: false, error: "No tiene permisos para cancelar estudios." };
        }
    }

    const studyRef = doc(db, 'studies', studyId);
    console.log("[ACTION LOG] updateStudyStatusAction called for study", studyId, "to status", status);

    try {
        await runTransaction(db, async (transaction) => {
            const studyDoc = await transaction.get(studyRef);
            if (!studyDoc.exists()) {
                throw new Error("El estudio no existe.");
            }
            const studyData = studyDoc.data() as Study;

            const updateData: any = { status };
            
            if (status === 'Completado') {
                updateData.completionDate = serverTimestamp() as any;
                updateData.readingDate = deleteField();
                updateData.cancellationReason = deleteField();

                if (completedByOperator) {
                    updateData.completedBy = completedByOperator;
                } else if (userProfile.rol === 'tecnologo' || userProfile.rol === 'transcriptora') {
                    const userDoc = await transaction.get(doc(db, 'users', userProfile.uid));
                    const userData = userDoc.data() as UserProfile | undefined;
                    if (userData?.operadorActivo) {
                        updateData.completedBy = userData.operadorActivo;
                    } else {
                        updateData.completedBy = userProfile.nombre; // Fallback
                    }
                } else if (userProfile.rol === 'administrador') {
                    updateData.completedBy = "Francisco Vergara";
                }

                if (params) {
                    if(params.kV) updateData.kV = params.kV;
                    if(params.mA) updateData.mA = params.mA;
                    if(params.timeMs) updateData.timeMs = params.timeMs;
                    if(params.ctdi) updateData.ctdi = params.ctdi;
                    if(params.dlp) updateData.dlp = params.dlp;

                    if (params.contrastAdministeredMl !== undefined) {
                        updateData.contrastAdministeredMl = params.contrastAdministeredMl;
                        updateData.contrastRemainingMl = (studyData.contrastBilledMl || 0) - params.contrastAdministeredMl;
                    }
                }
                updateData.consumedSupplies = params?.consumedItems || [];

                if (params?.consumedItems && params.consumedItems.length > 0) {
                    for (const item of params.consumedItems) {
                        if (item.id && item.amount > 0) {
                            const newConsumptionRef = doc(collection(db, "inventoryConsumptions"));
                            const consumptionData: Omit<InventoryConsumption, 'id'> = {
                                studyId: studyId,
                                itemId: item.id,
                                itemName: item.name,
                                amountConsumed: item.amount,
                                consumedBy: {
                                    uid: userProfile.uid,
                                    name: userProfile.nombre,
                                },
                                date: serverTimestamp() as Timestamp,
                            };
                            transaction.set(newConsumptionRef, consumptionData);
                        }
                    }
                }
            } else if (status === 'Leído') {
                updateData.readingDate = serverTimestamp();
            } else if (status === 'Cancelado') {
                updateData.cancellationReason = cancellationReason || 'No especificado';
                updateData.completionDate = deleteField();
                updateData.readingDate = deleteField();
                updateData.completedBy = deleteField();
                updateData.consumedSupplies = deleteField();
            }

            if (userProfile.rol === 'administrador' && status === 'Pendiente') {
                updateData.completionDate = deleteField();
                updateData.readingDate = deleteField();
                updateData.kV = deleteField();
                updateData.mA = deleteField();
                updateData.timeMs = deleteField();
                updateData.ctdi = deleteField();
                updateData.dlp = deleteField();
                updateData.completedBy = deleteField();
                updateData.cancellationReason = deleteField();
                updateData.contrastType = deleteField();
                updateData.creatinine = deleteField();
                updateData.consumedSupplies = deleteField();
            }

            transaction.update(studyRef, updateData);
        });

        const finalStudyDoc = await getDoc(studyRef);
        if (finalStudyDoc.exists()) {
            const finalStudyData = { id: finalStudyDoc.id, ...finalStudyDoc.data() } as Study;
            const toDateValue = (value: any) => {
                if (!value) return undefined;
                if (value instanceof Timestamp) return value.toDate();
                if (typeof value.toDate === 'function') return value.toDate();
                return value;
            };
            const sanitizedStudyData: Study = {
                ...finalStudyData,
                requestDate: toDateValue(finalStudyData.requestDate),
                completionDate: toDateValue(finalStudyData.completionDate),
                readingDate: toDateValue(finalStudyData.readingDate),
                orderDate: toDateValue(finalStudyData.orderDate),
            };

            try {
                await appendOrderToSheet(sanitizedStudyData);
                console.log(`[ACTION LOG] Updated Google Sheets for study ${studyId} (status ${status}).`);
            } catch (sheetError) {
                console.error("[ACTION LOG] Error updating Google Sheets:", sheetError);
            }
        }

        return { success: true };
    } catch(error) {
        console.error("Error updating study status:", error);
        return { success: false, error: "Failed to update study status." };
    }
}

export async function updateStudyServiceAction(studyId: string, service: GeneralService, subService: SubServiceArea) {
    try {
        const studyRef = doc(db, 'studies', studyId);
        await updateDoc(studyRef, {
            service,
            subService,
        });
        return { success: true };
    } catch(error: any) {
        console.error("Error updating study service:", error);
        return { success: false, error: "Fallo al actualizar el servicio del estudio." };
    }
}

export async function updateStudyTurnNumberAction(studyId: string, turnNumber: string) {
    try {
        const studyRef = doc(db, 'studies', studyId);
        await updateDoc(studyRef, {
            turnNumber,
        });
        return { success: true };
    } catch(error: any) {
        console.error("Error updating turn number:", error);
        return { success: false, error: "Fallo al actualizar el número de turno." };
    }
}

export async function updateStudyBedNumberAction(studyId: string, bedNumber: string) {
    try {
        const studyRef = doc(db, 'studies', studyId);
        await updateDoc(studyRef, {
            bedNumber,
        });
        return { success: true };
    } catch(error: any) {
        console.error("Error updating bed number:", error);
        return { success: false, error: "Fallo al actualizar el número de cama." };
    }
}


export async function setStudyContrastAction(
    studyId: string, 
    contrastType: ContrastType | null, 
    params?: { 
        creatinine?: number,
    }
) {
    try {
        const studyRef = doc(db, 'studies', studyId);
        
        if (contrastType === null) {
            await updateDoc(studyRef, {
                contrastType: deleteField(),
                creatinine: deleteField(),
                contrastBilledMl: deleteField(),
                contrastAdministeredMl: deleteField(),
                contrastRemainingMl: deleteField(),
            });
        } else {
            const studyDoc = await getDoc(studyRef);
            if (!studyDoc.exists()) {
                 return { success: false, error: "El estudio no existe." };
            }
            const studyData = studyDoc.data() as Study;

            const updateData: { [key: string]: any } = { contrastType };

            if (contrastType === 'IV') {
                const age = getAgeFromBirthDate(studyData.patient.birthDate);
                const billedMl = (age !== null && age < 10) ? 50 : 100;
                updateData.contrastBilledMl = billedMl;
                
                if (params?.creatinine) updateData.creatinine = params.creatinine;

            } else if (contrastType === 'Bario') {
                updateData.creatinine = deleteField();
                updateData.contrastBilledMl = deleteField();
                updateData.contrastAdministeredMl = deleteField();
                updateData.contrastRemainingMl = deleteField();
            }
            await updateDoc(studyRef, updateData);
        }
        return { success: true };
    } catch (error: any) {
        console.error("Error updating contrast status:", error);
        return { success: false, error: `Fallo al cambiar el estado de contraste: ${error.message}` };
    }
}


export async function cancelStudyAction(studyId: string, reason: string, userProfile: UserProfile | null) {
    return updateStudyStatusAction(studyId, 'Cancelado', userProfile, undefined, undefined, reason);
}

export async function deleteStudyAction(studyId: string, userProfile: UserProfile | null) {
    if (!userProfile || userProfile.rol !== 'administrador') {
        return { success: false, error: "Solo el administrador puede eliminar estudios." };
    }
    try {
        const studyRef = doc(db, 'studies', studyId);
        await deleteDoc(studyRef);
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting study:", error);
        return { success: false, error: "No se pudo eliminar el estudio." };
    }
}

export async function extractReportTextAction(reportDataUri: string) {
    try {
        const { reportText } = await extractReportTextFlow({ reportDataUri });
        return { success: true, text: reportText };
    } catch (error: any) {
        console.error("Error extracting report text:", error);
        return { success: false, error: `Error al extraer texto: ${error.message}` };
    }
}

export async function saveReportDataAction(studyId: string, reportUrl: string | undefined, reportText: string) {
    try {
        const studyRef = doc(db, 'studies', studyId);
        
        await updateDoc(studyRef, {
            reportUrl: reportUrl || deleteField(),
            reportText: reportText, 
            status: 'Leído',
            readingDate: serverTimestamp(),
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error saving report data:", error);
        return { success: false, error: `Error al guardar el informe: ${error.message}` };
    }
}


const signupSchema = z.object({
  nombre: z.string(),
  email: z.string().email(),
  password: z.string(),
  rol: z.string(),
  servicioAsignado: z.string(),
  subServicioAsignado: z.string().optional(),
});

export async function signupUserAction(data: z.infer<typeof signupSchema>) {
    try {
        const adminAuth = getAdminAuth();
        if (!adminAuth) {
            console.error("Firebase Admin SDK is not initialized. Cannot create user.");
            return { success: false, error: "La creación de usuarios está temporalmente deshabilitada. Contacte al soporte." };
        }

        const userRecord = await adminAuth.createUser({
            email: data.email,
            password: data.password,
            displayName: data.nombre,
        });

        const userProfile: Omit<UserProfile, 'uid'> = {
            nombre: data.nombre,
            email: data.email,
            rol: data.rol as UserProfile['rol'],
            servicioAsignado: data.servicioAsignado as UserProfile['servicioAsignado'],
            subServicioAsignado: data.subServicioAsignado as UserProfile['subServicioAsignado'],
            activo: true,
            operationalStatus: data.rol === 'tecnologo' || data.rol === 'transcriptora' ? 'Disponible' : 'No Disponible',
            operadores: [],
            operadorActivo: null,
            activeSurgerySessionId: null,
        };

        await setDoc(doc(db, "users", userRecord.uid), userProfile);
        
        return { success: true, userId: userRecord.uid };
    } catch (error: any) {
        console.error("Signup error:", error);
        let errorMessage = "Ocurrió un error inesperado.";
        if (error.code === 'auth/email-already-exists') {
            errorMessage = "Este correo electrónico ya está en uso.";
        }
        return { success: false, error: errorMessage };
    }
}

export async function updateUserOperationalStatusAction(userId: string, newStatus: OperationalStatus) {
    try {
        await runTransaction(db, async (transaction) => {
            const userRef = doc(db, 'users', userId);
            const userSnap = await transaction.get(userRef);

            if (!userSnap.exists()) {
                throw new Error("Usuario no encontrado");
            }
            const currentUserData = userSnap.data() as UserProfile;
            const oldStatus = currentUserData.operationalStatus;

            if (currentUserData.rol === 'tecnologo' && currentUserData.servicioAsignado === 'RX') {
                if (newStatus === 'En Cirugía') {
                    const historyRef = doc(collection(db, 'operationalStatusHistory'));
                    transaction.set(historyRef, {
                        userId: userId,
                        userName: currentUserData.nombre,
                        startTime: serverTimestamp(),
                        endTime: null,
                        durationMinutes: null,
                        status: 'En Cirugía'
                    });
                    transaction.update(userRef, { 
                        operationalStatus: newStatus,
                        activeSurgerySessionId: historyRef.id
                    });
                } else if (oldStatus === 'En Cirugía' && newStatus === 'Disponible') {
                    const activeSessionId = currentUserData.activeSurgerySessionId;
                    if (activeSessionId) {
                        const historyDocRef = doc(db, 'operationalStatusHistory', activeSessionId);
                        const historyDocSnap = await transaction.get(historyDocRef);

                        if (historyDocSnap.exists()) {
                            const entryData = historyDocSnap.data();
                            const startTime = (entryData.startTime as Timestamp).toDate();
                            const endTime = new Date();
                            const durationMinutes = (endTime.getTime() - startTime.getTime()) / (1000 * 60);

                            transaction.update(historyDocRef, {
                                endTime: Timestamp.fromDate(endTime),
                                durationMinutes: Math.round(durationMinutes)
                            });
                        }
                    }
                    transaction.update(userRef, { 
                        operationalStatus: newStatus,
                        activeSurgerySessionId: null
                    });
                } else {
                    transaction.update(userRef, { operationalStatus: newStatus });
                }
            } else {
                 transaction.update(userRef, { operationalStatus: newStatus });
            }
        });

        return { success: true };
    } catch(error: any) {
        console.error("Error updating operational status:", error);
        return { success: false, error: `Failed to update operational status: ${error.message}` };
    }
}


export async function setActiveOperatorAction(userId: string, operatorName: string) {
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            operadorActivo: operatorName,
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error setting active operator:", error);
        return { success: false, error: `Failed to set active operator: ${error.message}` };
    }
}

export async function exportStudiesAction(input: any) {
    try {
        const fileBuffer = await exportStudiesToExcel(input);
        return { success: true, fileBuffer };
    } catch (error: any) {
        console.error("Error exporting studies:", error);
        return { success: false, error: "Ocurrió un error al exportar los datos." };
    }
}


export async function addOperatorAction(userId: string, operatorName: string) {
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            operadores: arrayUnion(operatorName)
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error adding operator:", error);
        return { success: false, error: `Failed to add operator: ${error.message}` };
    }
}

export async function removeOperatorAction(userId: string, operatorName: string) {
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            operadores: arrayRemove(operatorName)
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error removing operator:", error);
        return { success: false, error: `Failed to remove operator: ${error.message}` };
    }
}

export async function toggleUserStatusAction(userId: string, currentStatus: boolean) {
    try {
        const userRef = doc(db, 'users', userId);
        await updateDoc(userRef, {
            activo: !currentStatus
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error toggling user status:", error);
        return { success: false, error: `Failed to toggle user status: ${error.message}` };
    }
}


export async function sendMessageAction(sender: UserProfile, recipientRole: 'tecnologo' | 'transcriptora', content: string) {
    if (!content.trim()) {
        return { success: false, error: "El mensaje no puede estar vacío." };
    }
    try {
        const messageData: Omit<Message, 'id'> = {
            senderId: sender.uid,
            senderName: sender.nombre,
            recipientRole,
            content,
            createdAt: serverTimestamp() as Timestamp,
            read: false,
        };
        await addDoc(collection(db, "messages"), messageData);
        return { success: true };
    } catch (error: any) {
        console.error("Error sending message:", error);
        return { success: false, error: `Error al enviar mensaje: ${error.message}` };
    }
}

export async function markMessagesAsReadAction(messageIds: string[]) {
    try {
        const batch = writeBatch(db);
        for (const id of messageIds) {
            const messageRef = doc(db, 'messages', id);
            batch.update(messageRef, { read: true });
        }
        await batch.commit();
        return { success: true };
    } catch (error: any) {
        console.error("Error marking messages as read:", error);
        return { success: false, error: `Error al marcar mensajes como leídos: ${error.message}` };
    }
}


export async function getRadiologistOperatorsAction(): Promise<string[]> {
    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("rol", "==", "transcriptora"));
        const querySnapshot = await getDocs(q);
        
        const allOperators = new Set<string>();
        querySnapshot.forEach((doc) => {
            const user = doc.data() as UserProfile;
            if (user.operadores && user.operadores.length > 0) {
                user.operadores.forEach(op => allOperators.add(op));
            }
        });
        
        return Array.from(allOperators);
    } catch (error) {
        console.error("Error fetching radiologist operators:", error);
        return [];
    }
}

export async function getInventoryItemsAction(itemNames: string[]): Promise<InventoryItem[]> {
    if (itemNames.length === 0) return [];
    try {
        const itemsToQuery = [...itemNames];
        const contrastQuery = query(collection(db, "inventoryItems"), where("isContrast", "==", true));
        const [snapshotByFlag] = await Promise.all([getDocs(contrastQuery)]);

        const itemsMap = new Map<string, InventoryItem>();
        
        snapshotByFlag.forEach(doc => {
             if (!itemsMap.has(doc.id)) {
                itemsMap.set(doc.id, { id: doc.id, ...doc.data() } as InventoryItem);
            }
        });

        const remainingNames = itemsToQuery.filter(name => ![...itemsMap.values()].some(item => item.name === name));
        
        if (remainingNames.length > 0) {
            const qByName = query(collection(db, "inventoryItems"), where("name", "in", remainingNames));
            const snapshotByName = await getDocs(qByName);
            snapshotByName.forEach(doc => {
                itemsMap.set(doc.id, { id: doc.id, ...doc.data() } as InventoryItem);
            });
        }

        return Array.from(itemsMap.values());
    } catch (error) {
        console.error("Error fetching inventory items:", error);
        return [];
    }
}

const newItemSchema = z.object({
    name: z.string().min(3),
    category: z.enum(InventoryCategories),
    presentation: z.enum(['Caja', 'Frasco', 'Unidad']),
    content: z.number().min(1),
    contentUnit: z.enum(['unidades', 'ml', 'g']),
    specification: z.string().optional(),
    stock: z.number().min(0),
    price: z.number().optional(),
});

export async function createInventoryItemAction(data: z.infer<typeof newItemSchema>): Promise<{ success: boolean, error?: string }> {
    try {
        const newItemRef = doc(collection(db, "inventoryItems"));

        const itemData: Omit<InventoryItem, 'id'> = {
            name: data.name,
            category: data.category as InventoryCategory,
            presentation: data.presentation,
            content: data.content,
            contentUnit: data.contentUnit,
            specification: data.specification,
            stock: 0, 
            price: data.price,
            isContrast: data.category === 'contraste',
        };
        await setDoc(newItemRef, itemData);
        return { success: true };
    } catch (error: any) {
        console.error("Error creating inventory item:", error);
        return { success: false, error: "No se pudo crear el nuevo insumo." };
    }
}

export async function updateInventoryItemPriceAction(itemId: string, price: number): Promise<{ success: boolean, error?: string }> {
    try {
        const itemRef = doc(db, "inventoryItems", itemId);
        await updateDoc(itemRef, {
            price: price
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error updating item price:", error);
        return { success: false, error: "No se pudo actualizar el precio del insumo." };
    }
}

const addOperationalExpenseSchema = z.object({
    category: z.enum(['Sueldos', 'Servicios', 'Arriendo', 'Insumos', 'Otro']),
    description: z.string().min(3),
    amount: z.number().min(1),
});

export async function addOperationalExpenseAction(data: z.infer<typeof addOperationalExpenseSchema>): Promise<{ success: boolean, error?: string }> {
    try {
        const newExpenseRef = doc(collection(db, "operationalExpenses"));

        const expenseData: Omit<OperationalExpense, 'id'> = {
            ...data,
            date: serverTimestamp() as Timestamp,
        };
        await setDoc(newExpenseRef, expenseData);
        return { success: true };
    } catch (error: any) {
        console.error("Error creating operational expense:", error);
        return { success: false, error: "No se pudo registrar el gasto." };
    }
}

const updateOperationalExpenseSchema = addOperationalExpenseSchema.extend({
    id: z.string(),
});

export async function updateOperationalExpenseAction(data: z.infer<typeof updateOperationalExpenseSchema>): Promise<{ success: boolean, error?: string }> {
    try {
        const expenseRef = doc(db, "operationalExpenses", data.id);
        await updateDoc(expenseRef, {
            category: data.category,
            description: data.description,
            amount: data.amount,
        });
        return { success: true };
    } catch (error: any) {
        console.error("Error updating operational expense:", error);
        return { success: false, error: "No se pudo actualizar el gasto." };
    }
}

export async function deleteOperationalExpenseAction(id: string): Promise<{ success: boolean, error?: string }> {
    try {
        const expenseRef = doc(db, "operationalExpenses", id);
        await deleteDoc(expenseRef);
        return { success: true };
    } catch (error: any) {
        console.error("Error deleting operational expense:", error);
        return { success: false, error: "No se pudo eliminar el gasto." };
    }
}

export async function resetContrastStockAction(): Promise<{ success: boolean; error?: string }> {
    try {
        const q = query(collection(db, "inventoryItems"), where("isContrast", "==", true));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            return { success: false, error: "No se encontró ningún item de contraste para reiniciar." };
        }

        const batch = writeBatch(db);
        querySnapshot.forEach(docSnap => {
            batch.update(docSnap.ref, { stock: 0 });
        });

        await batch.commit();
        return { success: true };
    } catch (error: any) {
        console.error('Error resetting contrast stock:', error);
        return { success: false, error: 'Failed to reset contrast stock.' };
    }
}

export type GeneralAlarm = {
    id: string;
    triggeredBy: {
        uid: string;
        name: string;
        rol: UserProfile['rol']
    },
    createdAt: Timestamp;
}
export async function sendGeneralAlarmAction(user: UserProfile) {
    if(!user) return { success: false, error: "Usuario no autenticado." };

    try {
        const alarmData = {
             triggeredBy: {
                uid: user.uid,
                name: user.nombre,
                rol: user.rol,
            },
            createdAt: serverTimestamp()
        };
        await addDoc(collection(db, "generalAlarms"), alarmData);
        return { success: true };
    } catch (error: any) {
        console.error("Error sending general alarm:", error);
        return { success: false, error: "No se pudo enviar la alarma general." };
    }
}


export async function clearCtdiDataAction(): Promise<{ success: boolean, error?: string, count?: number }> {
    try {
        const studiesCollection = collection(db, 'studies');
        const snapshot = await getDocs(studiesCollection);

        if (snapshot.empty) {
            return { success: true, count: 0 };
        }

        const batch = writeBatch(db);
        snapshot.docs.forEach(doc => {
            batch.update(doc.ref, { dlp: deleteField() });
        });

        await batch.commit();
        return { success: true, count: snapshot.size };
    } catch (error: any) {
        console.error("Error clearing ctdivol data:", error);
        return { success: false, error: "No se pudieron limpiar los datos de CTDIvol." };
    }
}


export async function sendPasswordResetEmailAction(email: string) {
    try {
        // This function requires Firebase Admin to be initialized, which is temporarily disabled.
        // if (!admin.apps.length) {
            console.error("Firebase Admin SDK is not initialized. Cannot send password reset email.");
            return { success: false, error: "El envío de correos está temporalmente deshabilitado. Contacte al soporte." };
        // }
        // In a real scenario, you'd generate a link and use a mail service.
        // For this example, we simulate success.
        // const link = await admin.auth().generatePasswordResetLink(email);
        // await sendEmailWithLink(email, link); // Fictional email function
        
        console.log(`Simulating password reset email sent to ${email}`);
        return { success: true };
    } catch (error: any) {
        console.error("Password reset error:", error);
        return { success: false, error: "No se pudo enviar el correo de restablecimiento." };
    }
}

const serializeDates = (obj: any): any => {
    if (!obj) return obj;
    if (obj instanceof Timestamp) {
        return obj.toDate().toISOString();
    }
    if (Array.isArray(obj)) {
        return obj.map(item => serializeDates(item));
    }
    if (typeof obj === 'object') {
        const newObj: { [key: string]: any } = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                newObj[key] = serializeDates(obj[key]);
            }
        }
        return newObj;
    }
    return obj;
};

export async function generateReportFromTemplateAction(studyId: string) {
    try {
        const studyRef = doc(db, 'studies', studyId);
        const studySnap = await getDoc(studyRef);

        if (!studySnap.exists()) {
            return { success: false, error: "Estudio no encontrado." };
        }

        const studyData = { id: studySnap.id, ...studySnap.data() } as StudyWithCompletedBy;
        
        let radiologist = { name: 'Radiólogo No Asignado', specialty: 'Médico Radiólogo', register: '' };
        if (studyData.completedBy) {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("operadores", "array-contains", studyData.completedBy), where("rol", "==", "transcriptora"), limit(1));
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
                const radiologistProfile = querySnapshot.docs[0].data() as UserProfile;
                radiologist = {
                    name: radiologistProfile.nombre || studyData.completedBy,
                    specialty: 'Médico Radiólogo',
                    register: radiologistProfile.servicioAsignado || '' 
                };
            } else {
                radiologist.name = studyData.completedBy;
            }
        }

        let reportText = studyData.reportText || "No se encontró texto de informe para este estudio.";
        
        if (studyData.reportUrl && !studyData.reportText) {
             try {
                const response = await fetch(studyData.reportUrl);
                if (response.ok) {
                    reportText = await response.text();
                } else {
                    reportText = `No se pudo cargar el contenido del informe desde la URL. Puede intentar abrirlo manualmente: ${studyData.reportUrl}`;
                }
            } catch (e) {
                reportText = `Error al cargar el contenido del informe.`;
            }
        }

        const serializedStudy = serializeDates(studyData);
        
        return {
            success: true,
            data: {
                study: serializedStudy,
                reportText: reportText,
                radiologist: radiologist,
            },
        };
    } catch (error: any) {
        console.error("Error in generateReportFromTemplateAction:", error);
        return { success: false, error: error.message || "Error desconocido al generar el informe." };
    }
}


export async function searchStudiesAction(searchTerm: string): Promise<{ success: boolean; data?: any[]; error?: string }> {
    if (!searchTerm || searchTerm.trim() === '') {
        return { success: false, error: "El término de búsqueda no puede estar vacío." };
    }

    try {
        const studiesRef = collection(db, 'studies');
        
        const nameQuery = query(
            studiesRef,
            where('patient.fullName', '>=', searchTerm.toUpperCase()),
            where('patient.fullName', '<=', searchTerm.toUpperCase() + '\uf8ff')
        );

        const idQuery = query(
            studiesRef,
            where('patient.id', '==', searchTerm)
        );

        const [nameSnapshot, idSnapshot] = await Promise.all([
            getDocs(nameQuery),
            getDocs(idQuery),
        ]);

        const studiesMap = new Map<string, Study>();

        nameSnapshot.forEach(doc => {
            studiesMap.set(doc.id, { id: doc.id, ...doc.data() } as Study);
        });

        idSnapshot.forEach(doc => {
            studiesMap.set(doc.id, { id: doc.id, ...doc.data() } as Study);
        });

        let combinedStudies = Array.from(studiesMap.values());
        combinedStudies.sort((a, b) => b.requestDate.toMillis() - a.requestDate.toMillis());
        
        const serializedStudies = combinedStudies.map(study => serializeDates({ ...study }));

        return { success: true, data: serializedStudies };
    } catch (error) {
        console.error("Error searching studies:", error);
        return { success: false, error: "No se pudieron buscar los estudios." };
    }
}

const addMultipleInventoryEntriesSchema = z.object({
  entries: z.array(z.object({
    itemId: z.string(),
    itemName: z.string(),
    presentation: z.string(),
    service: z.enum(['RX', 'TAC', 'ECO', 'General']),
    quantity: z.number().min(1),
    lote: z.string().optional(),
    price: z.number().optional(),
    unidad: z.string().optional(),
    fechaVencimiento: z.string().optional(),
    proveedor: z.string().optional(),
    observaciones: z.string().optional(),
  })),
  userProfile: z.custom<UserProfile>(),
});

export async function addMultipleInventoryEntriesAction(data: z.infer<typeof addMultipleInventoryEntriesSchema>): Promise<{ success: boolean; error?: string }> {
    const { entries, userProfile } = data;
    if (!userProfile) {
        return { success: false, error: 'Usuario no autenticado.' };
    }

    const batch = writeBatch(db);
    const sheetEntries: any[] = [];

    try {
        for (const entry of entries) {
            const newEntryRef = doc(collection(db, 'inventoryEntries'));
            const newEntry: Omit<InventoryStockEntry, 'id'> = {
                itemId: entry.itemId,
                itemName: entry.itemName,
                presentation: entry.presentation,
                service: entry.service,
                amountAdded: entry.quantity,
                date: serverTimestamp() as Timestamp,
                addedBy: {
                    uid: userProfile.uid,
                    name: userProfile.nombre,
                },
                lote: entry.lote,
                priceAtEntry: entry.price || 0,
                unidad: entry.unidad,
                fechaVencimiento: entry.fechaVencimiento,
                proveedor: entry.proveedor,
                observaciones: entry.observaciones,
            };
            batch.set(newEntryRef, newEntry);
            sheetEntries.push({
                ...newEntry,
                date: new Date(), // Fecha del cliente
            });
        }

        await batch.commit();
        // Registrar en Google Sheets
        await appendInventoryEntriesToSheet(sheetEntries);
        return { success: true };
    } catch (error: any) {
        console.error('Error adding multiple inventory entries:', error);
        return { success: false, error: 'No se pudieron registrar las entradas de insumos.' };
    }
}

export async function generateSilenceRequestAudioAction(): Promise<{ success: boolean, audioDataUri?: string, error?: string }> {
    try {
        const result = await generateSilenceRequestAudioFlow();
        return { success: true, audioDataUri: result.audioDataUri };
    } catch (error: any) {
        console.error("Error generating silence request audio:", error);
        return { success: false, error: `No se pudo generar el audio: ${error.message}` };
    }
}

export async function generateTurnCallAudioAction(turnDisplay: string, modalityName: string): Promise<{ success: boolean, audioDataUri?: string, error?: string }> {
    try {
        const result = await generateTurnCallAudioFlow({ turnDisplay, modalityName });
        return { success: true, audioDataUri: result.audioDataUri };
    } catch (error: any) {
        console.error("Error generating turn call audio:", error);
        return { success: false, error: `No se pudo generar el audio de llamado: ${error.message}` };
    }
}

export async function callPatientAction(studyId: string, modality: 'ECO' | 'RX' | 'TAC'): Promise<{ success: boolean, error?: string }> {
    try {
        const turneroRef = doc(db, 'turnero', modality);
        await setDoc(turneroRef, { 
            lastCalledStudyId: studyId,
            calledAt: serverTimestamp(),
        }, { merge: true });
        return { success: true };
    } catch (error: any) {
        console.error("Error calling patient:", error);
        return { success: false, error: "No se pudo realizar el llamado del paciente." };
    }
}

export async function uploadDicomFileAction(base64Dicom: string): Promise<{ success: boolean; error?: string }> {
    console.warn("DICOM upload functionality is disabled.");
    return { success: false, error: "La funcionalidad de carga DICOM ha sido deshabilitada." };
}

const specialistSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3),
  specialty: z.string().min(1),
  phoneNumber: z.string().min(10),
});

export async function addSpecialistAction(data: Omit<z.infer<typeof specialistSchema>, 'id'>): Promise<{ success: boolean, error?: string }> {
    try {
        await addDoc(collection(db, "specialists"), data);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: "No se pudo crear el especialista." };
    }
}

export async function updateSpecialistAction(data: z.infer<typeof specialistSchema>): Promise<{ success: boolean, error?: string }> {
    if (!data.id) return { success: false, error: "ID del especialista es requerido." };
    try {
        const { id, ...specialistData } = data;
        await updateDoc(doc(db, "specialists", id), specialistData);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: "No se pudo actualizar el especialista." };
    }
}

export async function deleteSpecialistAction(id: string): Promise<{ success: boolean, error?: string }> {
    try {
        await deleteDoc(doc(db, "specialists", id));
        return { success: true };
    } catch (error: any) {
        return { success: false, error: "No se pudo eliminar el especialista." };
    }
}

export async function transcribeAudioAction(input: TranscribeInput): Promise<{ success: boolean, text?: string, error?: string }> {
    try {
        const result = await transcribeAudioFlow(input);
        return { success: true, text: result.text };
    } catch (error: any) {
        console.error("Audio transcription error:", error);
        return { success: false, error: `No se pudo transcribir el audio: ${error.message}` };
    }
}

export async function sendConsultationSummaryAction(specialist: Specialist): Promise<{ success: boolean; messageSent: boolean; error?: string; }> {
    try {
        const allPendingQuery = query(collection(db, "studies"), where('status', '==', 'Pendiente'));
        const snapshot = await getDocs(allPendingQuery);

        if (snapshot.empty) {
            return { success: true, messageSent: false };
        }

        const normalizeString = (str: string) => {
            if (!str) return '';
            return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
        };

        const normalizedSpecialistSpecialty = normalizeString(specialist.specialty);

        const pendingStudiesForSpecialist = snapshot.docs
            .map(doc => doc.data() as Study)
            .filter(study => {
                const modality = study.studies[0]?.modality;
                return modality && normalizeString(modality) === normalizedSpecialistSpecialty;
            });

        if (pendingStudiesForSpecialist.length === 0) {
            return { success: true, messageSent: false };
        }

        const pendingCount = pendingStudiesForSpecialist.length;
        const studiesByService = pendingStudiesForSpecialist.reduce((acc, study) => {
            acc[study.service] = (acc[study.service] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const summaryText = Object.entries(studiesByService)
            .map(([service, count]) => `${service}: ${count}`)
            .join(' | ');
        
        const result = await sendWhatsAppMessage({
            to: specialist.phoneNumber,
            template: process.env.TWILIO_WHATSAPP_TEMPLATE_SID,
            templateVariables: {
                '1': specialist.name.split(' ')[0] || 'Doctor(a)',
                '2': String(pendingCount),
                '3': summaryText,
            },
        });

        if (result.success) {
            return { success: true, messageSent: true };
        } else {
            throw new Error(result.error);
        }

    } catch (error: any) {
        console.error(`[Notification Error] for ${specialist.name}:`, error);
        return { success: false, messageSent: false, error: `No se pudo enviar la notificación: ${error.message}` };
    }
}


export async function updateFinanceConfigAction(cost: number): Promise<{ success: boolean; error?: string }> {
    try {
        const configRef = doc(db, 'appConfig', 'finance');
        await setDoc(configRef, { costPerContrastVial: cost }, { merge: true });
        return { success: true };
    } catch (error: any) {
        console.error('Error updating finance config:', error);
        return { success: false, error: 'No se pudo guardar el costo.' };
    }
}

type RemissionRequest = {
    studyData: Omit<Study, 'id' | 'requestDate' | 'status'>;
    remissionData?: {
        notaCargoUrl?: string;
        ordenMedicaUrl?: string;
        evolucionUrl?: string;
        authorizationUrl?: string;
        recordatorioUrl?: string;
        informeUrl?: string;
    };
    userProfile: UserProfile;
    service?: GeneralService;
    subService?: SubServiceArea;
    requiresContrast?: boolean;
    bajoSedacion?: boolean;
};


export async function createRemissionAction(data: RemissionRequest): Promise<{ success: boolean; error?: string; firestoreSuccess?: boolean }> {
    const { studyData, remissionData, userProfile, service, subService, requiresContrast = false, bajoSedacion = false } = data;
    if (!userProfile) {
        return { success: false, error: 'Usuario no autenticado.' };
    }

    if (userProfile.rol !== 'administrador') {
        return { success: false, error: "Solo el administrador puede crear solicitudes de remisión." };
    }

    try {
        const typedStudyData = studyData as Study;
        const studyId = typedStudyData.id;
        if (!studyId) {
            throw new Error("El ID del estudio es indefinido.");
        }
        
        const remissionRef = doc(db, "remissions", studyId);
        
        // Use single timestamp for consistency
        const timestamp = serverTimestamp();

        const resolvedService = service || typedStudyData.service;
        const fallbackSubService = SubServiceAreas[resolvedService]?.[0] || 'AMB';
        const resolvedSubService = (subService || typedStudyData.subService || fallbackSubService) as SubServiceArea;
        const studyPayload = { ...typedStudyData, service: resolvedService, subService: resolvedSubService } as Study;
        const studyDataAny = studyPayload as any;
        const orderingPhysician = studyPayload.orderingPhysician;
        const resolvedSpecialist = (studyDataAny?.specialist || orderingPhysician?.name || '').trim();
        const resolvedMedicalRecord = (studyDataAny?.medicalRecord || orderingPhysician?.register || '').trim();
        const resolvedObservaciones = (
            studyDataAny?.observaciones ||
            studyDataAny?.observation ||
            studyDataAny?.observations ||
            studyPayload.studies?.[0]?.details ||
            studyPayload.diagnosis?.description ||
            ''
        ).trim();

        const remissionFiles: Remission['remissionFileUrls'] = {
            notaCargoUrl: remissionData?.notaCargoUrl || '',
            ordenMedicaUrl: remissionData?.ordenMedicaUrl || '',
            evolucionUrl: remissionData?.evolucionUrl || ''
        };

        if (remissionData?.authorizationUrl) {
            remissionFiles.authorizationUrl = remissionData.authorizationUrl;
        }
        if (remissionData?.recordatorioUrl) {
            remissionFiles.recordatorioUrl = remissionData.recordatorioUrl;
        }
        if (remissionData?.informeUrl) {
            remissionFiles.informeUrl = remissionData.informeUrl;
        }
        
        const remissionDocument = {
            ...studyPayload,
            requiereContraste: requiresContrast,
            bajoSedacion,
            remissionFileUrls: remissionFiles,
            specialist: resolvedSpecialist,
            medicalRecord: resolvedMedicalRecord,
            observaciones: resolvedObservaciones,
            createdAt: timestamp,
            updatedAt: timestamp,
            pendienteAutAt: timestamp,
            createdBy: {
                uid: userProfile.uid,
                name: userProfile.nombre,
                email: userProfile.email
            },
            status: "Pendiente Aut"
        };
        
        // Save to Firestore first (critical operation)
        await setDoc(remissionRef, remissionDocument, { merge: true });

        // Prepare data for Sheets (convert timestamp to ISO string for sheets)
        const sheetsData = {
            ...studyPayload,
            requiereContraste: requiresContrast,
            bajoSedacion,
            remissionFileUrls: remissionFiles,
            specialist: resolvedSpecialist,
            medicalRecord: resolvedMedicalRecord,
            observaciones: resolvedObservaciones,
            createdAt: new Date(),
            updatedAt: new Date(),
            pendienteAutAt: new Date(),
            createdBy: {
                uid: userProfile.uid,
                name: userProfile.nombre,
                email: userProfile.email
            },
            status: "Pendiente Aut"
        };

        // Update sheets with retry logic
        try {
            await appendOrUpdateRemissionSheet(sheetsData as any, studyId);
            return { success: true, firestoreSuccess: true };
        } catch (sheetsError: any) {
            // Log sheets error but don't fail the whole operation
            console.warn(`[Sheets Warning] Failed to update sheets for remission ${studyId}:`, sheetsError);
            // Return success since Firestore was saved, but warn about sheets
            return { 
                success: true, 
                firestoreSuccess: true,
                error: `Remisión guardada pero no se pudo actualizar la hoja de cálculo: ${sheetsError.message}`
            };
        }
        return { success: true, firestoreSuccess: true };

    } catch (error: any) {
        console.error("Error creating remission:", error);
        return { success: false, firestoreSuccess: false, error: `No se pudo procesar la remisión: ${error.message}` };
    }
}

export async function updateRemissionStatusAction(remissionId: string, status: RemissionStatus): Promise<{ success: boolean, error?: string }> {
    try {
        const remissionRef = doc(db, 'remissions', remissionId);
        
        const updateData: { status: RemissionStatus; [key: string]: any } = { status };
        const now = serverTimestamp();

        if (status === 'Solicitado') {
            updateData.solicitadoAt = now;
        } else if (status === 'Autorizado') {
            updateData.autorizadoAt = now;
        } else if (status === 'Cupo Solicitado') {
            updateData.cupoSolicitadoAt = now;
        } else if (status === 'Programado') {
            updateData.programadoAt = now;
        } else if (status === 'Realizado') {
            updateData.realizadoAt = now;
        } else if (status === 'Informado') {
            updateData.informadoAt = now;
        } else if (status === 'Pendiente Aut') {
            updateData.pendienteAutAt = now;
        }

        await updateDoc(remissionRef, updateData);
        
        const updatedDoc = await getDoc(remissionRef);
        if (updatedDoc.exists() && updatedDoc.data().status === 'Informado') {
             await appendOrUpdateRemissionSheet(updatedDoc.data() as any, remissionId);
        }

        return { success: true };
    } catch (error: any) {
        console.error(`Error updating remission status for ${remissionId}:`, error);
        return { success: false, error: `Failed to update remission status: ${error.message}` };
    }
}

export async function uploadAuthorizationAndUpdateRemissionAction(remissionId: string, fileDataUri: string, idToken: string): Promise<{ success: boolean, error?: string }> {
    if (!remissionId || !fileDataUri || !idToken) {
        return { success: false, error: "ID de remisión, archivo o token de usuario no proporcionado." };
    }

    try {
        // This admin-dependent logic is temporarily disabled.
        // if (!admin.apps.length) {
            return { success: false, error: "La funcionalidad de carga de archivos está temporalmente deshabilitada." };
        // }
        /*
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;
        
        const customToken = await admin.auth().createCustomToken(uid);
        
        const tempAuth = getAuth();
        await signInWithCustomToken(tempAuth, customToken);

        const remissionRef = doc(db, 'remissions', remissionId);
        const remissionSnap = await getDoc(remissionRef);
        if (!remissionSnap.exists()) {
            throw new Error("La remisión no existe.");
        }
        const remissionData = remissionSnap.data() as Remission;

        const safePatientName = remissionData.patient.fullName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').toUpperCase();
        const patientFolder = `${safePatientName}_${remissionData.patient.id}`;
        const fileName = `authorization_${Date.now()}.pdf`;
        const folderPath = `remissions/${patientFolder}`;
        const storageRef = ref(storage, `${folderPath}/${fileName}`);

        const uploadResult = await uploadString(storageRef, fileDataUri, 'data_url', { contentType: 'application/pdf' });
        const downloadURL = await getDownloadURL(uploadResult.ref);

        await updateDoc(remissionRef, {
            'remissionFileUrls.authorizationUrl': downloadURL,
            status: 'Autorizado',
            autorizadoAt: serverTimestamp(),
        });
        
        const updatedDoc = await getDoc(remissionRef);
        if (updatedDoc.exists() && updatedDoc.data().status === 'Informado') {
            await appendOrUpdateRemissionSheet(updatedDoc.data() as any, remissionId);
        }
        
        await tempAuth.signOut();

        return { success: true };
        */
    } catch (error: any) {
        console.error("Error uploading authorization:", error);
        return { success: false, error: `No se pudo subir la autorización: ${error.message}` };
    }
}

export async function uploadReminderAndUpdateRemissionAction(remissionId: string, fileDataUri: string, idToken: string): Promise<{ success: boolean; error?: string }> {
    if (!remissionId || !fileDataUri || !idToken) {
        return { success: false, error: "ID de remisión, archivo o token de usuario no proporcionado." };
    }

    try {
        // if (!admin.apps.length) {
             return { success: false, error: "La funcionalidad de carga de archivos está temporalmente deshabilitada." };
        // }
        /*
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;
        const customToken = await admin.auth().createCustomToken(uid);
        
        const tempAuth = getAuth();
        await signInWithCustomToken(tempAuth, customToken);

        const remissionRef = doc(db, 'remissions', remissionId);
        const remissionSnap = await getDoc(remissionRef);
        if (!remissionSnap.exists()) {
            throw new Error("La remisión no existe.");
        }
        const remissionData = remissionSnap.data() as Remission;

        const safePatientName = remissionData.patient.fullName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').toUpperCase();
        const patientFolder = `${safePatientName}_${remissionData.patient.id}`;
        const fileName = `reminder_${Date.now()}`;
        const folderPath = `remissions/${patientFolder}`;
        const storageRef = ref(storage, `${folderPath}/${fileName}`);
        
        const uploadResult = await uploadString(storageRef, fileDataUri, 'data_url');
        const downloadURL = await getDownloadURL(uploadResult.ref);

        await updateDoc(remissionRef, {
            'remissionFileUrls.recordatorioUrl': downloadURL,
            status: 'Programado',
            programadoAt: serverTimestamp(),
        });
        
        const updatedDoc = await getDoc(remissionRef);
        if (updatedDoc.exists() && updatedDoc.data().status === 'Informado') {
            await appendOrUpdateRemissionSheet(updatedDoc.data() as any, remissionId);
        }

        await tempAuth.signOut();

        return { success: true };
        */
    } catch (error: any) {
        console.error("Error uploading reminder:", error);
        return { success: false, error: `No se pudo subir el recordatorio: ${error.message}` };
    }
}

export async function uploadReportAndUpdateRemissionAction(remissionId: string, fileDataUri: string, idToken: string): Promise<{ success: boolean; error?: string }> {
    if (!remissionId || !fileDataUri || !idToken) {
        return { success: false, error: "ID de remisión, archivo o token de usuario no proporcionado." };
    }

    try {
        // if (!admin.apps.length) {
             return { success: false, error: "La funcionalidad de carga de archivos está temporalmente deshabilitada." };
        // }
        /*
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;
        const customToken = await admin.auth().createCustomToken(uid);
        
        const tempAuth = getAuth();
        await signInWithCustomToken(tempAuth, customToken);

        const remissionRef = doc(db, 'remissions', remissionId);
        const remissionSnap = await getDoc(remissionRef);
        if (!remissionSnap.exists()) {
            throw new Error("La remisión no existe.");
        }
        const remissionData = remissionSnap.data() as Remission;

        const safePatientName = remissionData.patient.fullName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').toUpperCase();
        const patientFolder = `${safePatientName}_${remissionData.patient.id}`;
        const fileName = `informe_${Date.now()}`;
        const folderPath = `remissions/${patientFolder}`;
        const storageRef = ref(storage, `${folderPath}/${fileName}`);
        
        const uploadResult = await uploadString(storageRef, fileDataUri, 'data_url');
        const downloadURL = await getDownloadURL(uploadResult.ref);

        await updateDoc(remissionRef, {
            'remissionFileUrls.informeUrl': downloadURL,
            status: 'Realizado',
            realizadoAt: serverTimestamp(),
        });
        
        const updatedDoc = await getDoc(remissionRef);
        if (updatedDoc.exists() && updatedDoc.data().status === 'Informado') {
            await appendOrUpdateRemissionSheet(updatedDoc.data() as any, remissionId);
        }
        
        await tempAuth.signOut();

        return { success: true };
        */
    } catch (error: any) {
        console.error("Error uploading report:", error);
        return { success: false, error: `No se pudo subir el informe: ${error.message}` };
    }
}


export async function scheduleRemissionAppointmentAction(remissionId: string, appointmentDate: string): Promise<{ success: boolean; error?: string }> {
    if (!remissionId || !appointmentDate) {
        return { success: false, error: "Faltan datos para agendar la cita." };
    }
    try {
        const remissionRef = doc(db, 'remissions', remissionId);
        const appointmentTimestamp = Timestamp.fromDate(new Date(appointmentDate));

        await updateDoc(remissionRef, {
            appointmentDate: appointmentTimestamp,
            status: 'Programado',
            programadoAt: serverTimestamp(),
        });
        
        const updatedDoc = await getDoc(remissionRef);
        if (updatedDoc.exists() && updatedDoc.data().status === 'Informado') {
            await appendOrUpdateRemissionSheet(updatedDoc.data() as any, remissionId);
        }

        return { success: true };
    } catch (error: any) {
        console.error("Error scheduling appointment:", error);
        return { success: false, error: "No se pudo guardar la fecha de la cita." };
    }
}

export async function updateRemissionBedNumberAction(remissionId: string, bedNumber: string, userProfile: UserProfile | null): Promise<{ success: boolean; error?: string }> {
    if (!remissionId) return { success: false, error: "ID de remisión faltante" };
    if (!userProfile || userProfile.rol !== 'administrador') {
        return { success: false, error: "Solo el administrador puede editar el número de cama." };
    }
    try {
        const remissionRef = doc(db, 'remissions', remissionId);
        await updateDoc(remissionRef, {
            bedNumber: bedNumber.trim(),
            updatedAt: serverTimestamp(),
        });
        
        // Update Sheets too
        const updatedDoc = await getDoc(remissionRef);
        if (updatedDoc.exists() && updatedDoc.data().status === 'Informado') {
            await appendOrUpdateRemissionSheet(updatedDoc.data() as any, remissionId);
        }

        return { success: true };
    } catch (error: any) {
        console.error("Error updating remission bed number:", error);
        return { success: false, error: error.message || "No se pudo actualizar la cama." };
    }
}

// ============================================================================
// SHIFT HANDOVER ACTIONS
// ============================================================================


import { ShiftHandoverInput } from "@/lib/schemas/shift-handover-schema";
import { ensureSheetExists, getSheetsClient } from "@/services/google-sheets";

const HANDOVER_SHEET_IDS: Record<string, string | undefined> = {
    RX: process.env.GOOGLE_SHEET_ID_RX_HANDOVER,
    ECO: process.env.GOOGLE_SHEET_ID_ECO_HANDOVER,
    TAC: process.env.GOOGLE_SHEET_ID_TAC_HANDOVER,
};
const MONTH_LABELS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

const formatHandoverDate = (dateString: string) => {
    const parsed = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return dateString;
    const day = parsed.getDate().toString().padStart(2, '0');
    const month = (parsed.getMonth() + 1).toString().padStart(2, '0');
    const year = parsed.getFullYear();
    return `${day}/${month}/${year}`;
};

const resolveMonthlySheetName = (dateString: string) => {
    const parsed = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return MONTH_LABELS[new Date().getMonth()] ?? 'MES';
    return MONTH_LABELS[parsed.getMonth()] ?? 'MES';
};

const SHIFT_HANDOVER_HEADERS = [
    'Fecha', 'Turno', 'Hora',
    'Rayos X Fijo', 'Rayos X Portátil', 'Arco en C', 'Computadores', 'Monitores', 'Puesto Trabajo',
    'Observación Equipos',
    '14x17', '10x14', '10x12', '8x10',
    'Estudios Pendientes', 'Novedades',
    'Entrega', 'Recibe',
];

async function appendShiftHandoverToSheet(handoverData: ShiftHandoverInput, handoverId: string): Promise<void> {
    const modality = (handoverData.modality ?? 'RX').toUpperCase();
    const spreadsheetId = HANDOVER_SHEET_IDS[modality];
    if (!spreadsheetId) {
        console.warn(`[Shift Handover] Missing sheet ID for modality ${modality}, skipping`);
        return;
    }

    const sheets = await getSheetsClient();
    if (!sheets) {
        console.warn('[Shift Handover] Sheets client unavailable');
        return;
    }

    try {
        const sheetName = resolveMonthlySheetName(handoverData.date);
        await ensureSheetExists(sheets, spreadsheetId, sheetName, SHIFT_HANDOVER_HEADERS);

        const values = [
            formatHandoverDate(handoverData.date),
            handoverData.shift === 'morning' ? 'Mañana' : 'Noche',
            handoverData.hora,
            'LIMPIO, FUNCIONAL Y EN BUEN ESTADO', // Rayos X Fijo
            'LIMPIO, FUNCIONAL Y EN BUEN ESTADO', // Rayos X Portátil
            'LIMPIO, FUNCIONAL Y EN BUEN ESTADO', // Arco en C
            'LIMPIO, FUNCIONAL Y EN BUEN ESTADO', // Computadores
            'LIMPIO, FUNCIONAL Y EN BUEN ESTADO', // Monitores
            'ORDENADO Y LIMPIO', // Puesto de trabajo
            'TODOS LOS EQUIPOS Y CHASIS: LIMPIOS, COMPLETOS, EN SU SITIO, FUNCIONALES Y EN BUENAS CONDICIONES',
            2, // 14x17
            2, // 10x14
            3, // 10x12
            1, // 8x10
            'NINGUNO',
            'TODO SIN NOVEDAD',
            handoverData.handoverTechnicianName,
            handoverData.receipt?.receivedTechnicianName || 'Pendiente',
        ];

        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: [values] },
        });

        console.log(`[Shift Handover] ${modality} entry appended`, { sheetName, values });
    } catch (error: any) {
        console.error(`[Shift Handover] Error appending ${modality} entry:`, error);
    }
}

export async function createShiftHandoverAction(handoverData: ShiftHandoverInput): Promise<{ success: boolean; error?: string }> {
    try {
        if (!handoverData.handoverTechnicianId) {
            return { success: false, error: "Técnico no identificado" };
        }

        const handoverDoc = await addDoc(collection(db, 'shiftHandovers'), {
            ...handoverData,
            createdAt: serverTimestamp(),
            status: 'handed-over',
        });

        // Attempt to append to Google Sheets
        await appendShiftHandoverToSheet(handoverData, handoverDoc.id);

        // Update technician's last handover timestamp
        const technicianRef = doc(db, 'users', handoverData.handoverTechnicianId);
        await updateDoc(technicianRef, {
            lastShiftHandoverAt: serverTimestamp(),
        }).catch(() => {
            // User doc might not have this field, that's ok
        });

        return { success: true };
    } catch (error: any) {
        console.error("[Shift Handover] Error creating handover:", error);
        return { success: false, error: error.message || "No se pudo guardar la entrega de turno" };
    }
}

export async function registerQuickRxHandoverAction({
    technologistId,
    technologistName,
}: {
    technologistId: string;
    technologistName: string;
}): Promise<{ success: boolean; error?: string }> {
    if (!technologistId || !technologistName) {
        return { success: false, error: "No se pudo identificar al tecnólogo" };
    }

    const now = new Date();
    const shift: ShiftHandoverInput['shift'] = now.getHours() >= 7 && now.getHours() < 19 ? 'morning' : 'evening';
    const date = format(now, 'yyyy-MM-dd');
    const hora = format(now, 'HH:mm');

    const handoverData: ShiftHandoverInput = {
        date,
        shift,
        hora,
        modality: 'RX',
        handoverTechnicianId: technologistId,
        handoverTechnicianName: technologistName,
        equipment: {
            rayosXFijo: 'B',
            rayosXPortatil: 'B',
            arcoCinematico: 'B',
            computadores: 'B',
            monitores: 'B',
            puestoTrabajo: 'B',
        },
        equipmentObservations: 'TODOS LOS EQUIPOS Y CHASIS: LIMPIOS, COMPLETOS, EN SU SITIO, FUNCIONALES Y EN BUENAS CONDICIONES',
        inventory: {
            chasis14x17: 2,
            chasis10x14: 2,
            chasis10x12: 3,
            chasis8x10: 1,
        },
        chasisObservations: 'TODOS LOS EQUIPOS Y CHASIS: LIMPIOS, COMPLETOS, EN SU SITIO, FUNCIONALES Y EN BUENAS CONDICIONES',
        tieneEstudiosPendientes: false,
        estudiosPendientes: [],
        estudiosPendientesObservations: 'NO QUEDAN ESTUDIOS PENDIENTES',
        novedades: 'TODO SIN NOVEDAD',
    };

    return createShiftHandoverAction(handoverData);
}

// Eliminada función duplicada, se usa la importada de services/google-sheets.ts

// Eliminada función duplicada, se usa la importada de services/google-sheets.ts

// ============================================================================
// SHIFT HANDOVER RECEIPT ACTIONS
// ============================================================================

export async function getLatestShiftHandover(): Promise<(ShiftHandoverInput & { id: string; createdAt: any }) | null> {
    try {
        // Get the latest handover without inequality filters (to avoid requiring composite indexes)
        // Filter unconfirmed handovers in memory instead
        const q = query(
            collection(db, 'shiftHandovers'),
            orderBy('createdAt', 'desc'),
            limit(5)  // Get last 5 to find first unconfirmed
        );

        const snapshot = await getDocs(q);
        if (snapshot.empty) return null;

        // Find the first unconfirmed handover
        const unconfirmedDoc = snapshot.docs.find(doc => !doc.data().receipt?.confirmed);
        
        if (!unconfirmedDoc) return null;

        const data = unconfirmedDoc.data();
        const createdAt = data.createdAt;
        // Serialize Firestore timestamp to plain object for Client Components
        const serializedCreatedAt = createdAt ? {
            seconds: createdAt.seconds || 0,
            nanoseconds: createdAt.nanoseconds || 0,
        } : new Date().getTime();

        return {
            id: unconfirmedDoc.id,
            ...(data as ShiftHandoverInput),
            createdAt: serializedCreatedAt,
        };
    } catch (error: any) {
        console.error('[Shift Handover] Error getting latest handover:', error);
        return null;
    }
}

export async function updateShiftHandoverReceipt(
    handoverId: string,
    receivedTechnicianId: string,
    receivedTechnicianName: string,
    previousTechnicianId: string,
    observedIssues?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const handoverRef = doc(db, 'shiftHandovers', handoverId);
        
        // Update handover receipt info
        await updateDoc(handoverRef, {
            'receipt.receivedTechnicianId': receivedTechnicianId,
            'receipt.receivedTechnicianName': receivedTechnicianName,
            'receipt.receivedAt': serverTimestamp(),
            'receipt.observedIssues': observedIssues || '',
            'receipt.confirmed': true,
        });

        // Get updated document to send to Sheets
        const updatedDoc = await getDoc(handoverRef);
        if (updatedDoc.exists()) {
            await updateShiftHandoverInSheet(updatedDoc.data() as any, handoverId, receivedTechnicianName);
        }

        // Ya no es necesario actualizar operadorActivo, cada tecnólogo tiene su propio usuario.

        return { success: true };
    } catch (error: any) {
        console.error('[Shift Handover] Error updating receipt:', error);
        return { success: false, error: error.message || 'No se pudo registrar la recepción' };
    }
}

async function updateShiftHandoverInSheet(handoverData: any, handoverId: string, receivedTechnicianName: string): Promise<void> {
    const sheets = await getSheetsClient();
    if (!sheets || !SPREADSHEET_ID) {
        console.warn('[Shift Handover] Google Sheets not configured, skipping sheet update');
        return;
    }

    try {
        const sheetName = 'Entregas';
        
        // Get all values to find the row to update
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: SPREADSHEET_ID,
            range: `${sheetName}!Q:Q`, // Technician column
        });

        const values = response.data.values || [];
        const rowIndex = values.findIndex(row => 
            row[0]?.includes(handoverData.handoverTechnicianName)
        );

        if (rowIndex > -1) {
            // Update columns R (Técnico que Recibe)
            const updateRange = `${sheetName}!R${rowIndex + 1}`;
            await sheets.spreadsheets.values.update({
                spreadsheetId: SPREADSHEET_ID,
                range: updateRange,
                valueInputOption: 'RAW',
                requestBody: { values: [[receivedTechnicianName]] },
            });

            console.log('[Shift Handover] Successfully updated receipt in Google Sheet');
        }
    } catch (error: any) {
        console.error('[Shift Handover] Error updating sheet receipt:', error);
        // Don't throw - continue even if sheet update fails
    }
}

/**
 * Sincroniza todos los estudios completados desde una fecha a Google Sheets
 * Útil para recuperar datos que no se hayan copiado anteriormente
 */
const syncSheetsInputSchema = z.object({
    entity: z.enum(['studies', 'remissions', 'inventory']),
    fromDate: z.string(),
    toDate: z.string().optional(),
    modality: z.string().optional(),
    replaceStrategy: z.enum(['merge', 'replace']).default('merge'),
    syncId: z.string().optional(),
    studyStatus: z.string().optional(),
});

const toJsDate = (value: any): Date | undefined => {
    if (!value) return undefined;
    if (value instanceof Date) return value;
    if (typeof value.toDate === 'function') return value.toDate();
    if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
    return undefined;
};

export async function syncSheetsDataAction(input: z.infer<typeof syncSheetsInputSchema>): Promise<{ success: boolean; synced: number; failed: number; message: string }> {
    const params = syncSheetsInputSchema.parse(input);
    const syncLabel = params.syncId ? `[UID ${params.syncId}] ` : '';
    const from = startOfDay(new Date(params.fromDate));
    const to = endOfDay(params.toDate ? new Date(params.toDate) : new Date(params.fromDate));

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
        return { success: false, synced: 0, failed: 0, message: 'Fechas inválidas para la sincronización.' };
    }
    if (from > to) {
        return { success: false, synced: 0, failed: 0, message: 'La fecha inicial no puede ser mayor que la final.' };
    }

    const replaceAll = params.replaceStrategy === 'replace';

    const rangeFilters = {
        from: Timestamp.fromDate(from),
        to: Timestamp.fromDate(to),
    };

    let syncedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    try {
        if (params.entity === 'studies') {
            const studiesQuery = query(
                collection(db, 'studies'),
                where('status', '==', 'Completado'),
                where('completionDate', '>=', rangeFilters.from),
                where('completionDate', '<=', rangeFilters.to),
                orderBy('completionDate', 'asc')
            );

            const snapshot = await getDocs(studiesQuery);
            const modalityFilter = params.modality && params.modality !== 'ALL'
                ? params.modality.toUpperCase()
                : null;

            const studiesToSync: Array<{ study: Study; sheetName: string; rowKey?: string }> = [];

            for (const docSnap of snapshot.docs) {
                const studyData = docSnap.data() as Study;
                if (modalityFilter) {
                    const matchesModality = studyData.studies?.some(study => (study.modality || '').toUpperCase() === modalityFilter);
                    if (!matchesModality) continue;
                }

                const sanitizedStudy: Study = {
                    ...studyData,
                    id: docSnap.id,
                    requestDate: toJsDate(studyData.requestDate) as any,
                    completionDate: toJsDate(studyData.completionDate) as any,
                    readingDate: toJsDate(studyData.readingDate) as any,
                    orderDate: toJsDate(studyData.orderDate) as any,
                };

                const firstNestedStudy = sanitizedStudy.studies?.[0];
                const sheetName = firstNestedStudy && firstNestedStudy.modality && firstNestedStudy.modality.length > 0
                    ? firstNestedStudy.modality
                    : 'OTROS';
                const patientIdValue = sanitizedStudy.patient?.id;
                const rowKey = patientIdValue ? patientIdValue.trim() : undefined;

                studiesToSync.push({ study: sanitizedStudy, sheetName, rowKey });
            }

            if (replaceAll && studiesToSync.length > 0) {
                const rowsBySheet = new Map<string, Set<string>>();
                for (const payload of studiesToSync) {
                    if (!payload.rowKey) continue;
                    const sheet = payload.sheetName || 'OTROS';
                    if (!rowsBySheet.has(sheet)) {
                        rowsBySheet.set(sheet, new Set());
                    }
                    rowsBySheet.get(sheet)!.add(payload.rowKey);
                }

                const deletionTasks = Array.from(rowsBySheet.entries())
                    .filter(([, values]) => values.size > 0)
                    .map(([sheetName, values]) =>
                        deleteRowsByColumnValues({
                            sheetName,
                            headers: EXPORT_COLUMNS,
                            columnHeader: 'N° ID',
                            values,
                        })
                    );

                if (deletionTasks.length > 0) {
                    await Promise.all(deletionTasks);
                }
            }

            for (const payload of studiesToSync) {
                try {
                    await appendOrderToSheet(payload.study);
                    syncedCount++;
                } catch (error: any) {
                    failedCount++;
                    errors.push(`${syncLabel}Estudio ${payload.study.id}: ${error.message}`);
                }
            }
        } else if (params.entity === 'remissions') {
            const remissionsSheetId = process.env.GOOGLE_SHEET_ID_REMISSIONS || process.env.GOOGLE_SHEET_ID;
            const remissionsQuery = query(
                collection(db, 'remissions'),
                where('createdAt', '>=', rangeFilters.from),
                where('createdAt', '<=', rangeFilters.to),
                orderBy('createdAt', 'asc')
            );

            const snapshot = await getDocs(remissionsQuery);
            const remissionsToSync = snapshot.docs.map(docSnap => {
                const data = docSnap.data() as any;
                const fallbackId = data?.patient?.id || docSnap.id;
                const rowKey = fallbackId ? String(fallbackId).trim() : undefined;
                const createdAtDate = toJsDate(data?.createdAt) || toJsDate((data as any)?.requestDate) || new Date();
                const sheetName = getMonthlySheetLabel(createdAtDate);
                return { data, docId: docSnap.id, rowKey, sheetName };
            });

            if (replaceAll && remissionsToSync.length > 0) {
                const rowsBySheet = new Map<string, Set<string>>();
                for (const payload of remissionsToSync) {
                    if (!payload.rowKey) continue;
                    if (!rowsBySheet.has(payload.sheetName)) {
                        rowsBySheet.set(payload.sheetName, new Set());
                    }
                    rowsBySheet.get(payload.sheetName)!.add(payload.rowKey);
                }

                const deletionTasks = Array.from(rowsBySheet.entries())
                    .filter(([, values]) => values.size > 0)
                    .map(([sheetName, values]) =>
                        deleteRowsByColumnValues({
                            sheetName,
                            headers: REMISSION_EXPORT_COLUMNS,
                            columnHeader: 'N° ID',
                            values,
                            spreadsheetId: remissionsSheetId,
                        })
                    );

                if (deletionTasks.length > 0) {
                    await Promise.all(deletionTasks);
                }
            }

            for (const payload of remissionsToSync) {
                try {
                    await appendOrUpdateRemissionSheet(payload.data as any, payload.docId);
                    syncedCount++;
                } catch (error: any) {
                    failedCount++;
                    errors.push(`${syncLabel}Remisión ${payload.docId}: ${error.message}`);
                }
            }
        } else if (params.entity === 'inventory') {
            const inventorySheetId = process.env.GOOGLE_SHEET_ID_INVENTORY || process.env.GOOGLE_SHEET_ID;
            const inventoryQuery = query(
                collection(db, 'inventoryEntries'),
                where('date', '>=', rangeFilters.from),
                where('date', '<=', rangeFilters.to),
                orderBy('date', 'asc')
            );

            const snapshot = await getDocs(inventoryQuery);
            const entries = snapshot.docs.map(docSnap => {
                const data = docSnap.data() as InventoryStockEntry;
                const resolvedDate = toJsDate(data.date) || new Date();
                const sheetName = getMonthlySheetLabel(resolvedDate);
                const formattedTimestamp = formatInTimeZone(resolvedDate, 'America/Bogota', 'dd/MM/yyyy HH:mm:ss');
                return {
                    ...data,
                    date: resolvedDate,
                    sheetName,
                    formattedTimestamp,
                };
            });

            if (entries.length > 0) {
                if (replaceAll) {
                    const rowsBySheet = new Map<string, Set<string>>();
                    for (const entry of entries) {
                        if (!rowsBySheet.has(entry.sheetName)) {
                            rowsBySheet.set(entry.sheetName, new Set());
                        }
                        rowsBySheet.get(entry.sheetName)!.add(entry.formattedTimestamp);
                    }

                    const deletionTasks = Array.from(rowsBySheet.entries())
                        .filter(([, values]) => values.size > 0)
                        .map(([sheetName, values]) =>
                            deleteRowsByColumnValues({
                                sheetName,
                                headers: INVENTORY_EXPORT_COLUMNS,
                                columnHeader: 'FECHA/HORA',
                                values,
                                spreadsheetId: inventorySheetId,
                            })
                        );

                    if (deletionTasks.length > 0) {
                        await Promise.all(deletionTasks);
                    }
                }

                try {
                    await appendInventoryEntriesToSheet(entries);
                    syncedCount += entries.length;
                } catch (error: any) {
                    failedCount += entries.length;
                    errors.push(`${syncLabel}Insumos: ${error.message}`);
                }
            }
        }
    } catch (error: any) {
        const message = `${syncLabel}Error en sincronización: ${error.message}`;
        console.error('[Sync Sheets] Error:', error);
        return { success: false, synced: 0, failed: 0, message };
    }

    const entityLabel = params.entity === 'studies'
        ? 'estudios'
        : params.entity === 'remissions'
            ? 'remisiones'
            : 'entradas de insumos';
    const baseMessage = `Sincronizados ${syncedCount} ${entityLabel}. Errores: ${failedCount}.`;
    const detailMessage = errors.length ? ` ${errors.join('; ')}` : '';
    const message = `${syncLabel}${baseMessage}${detailMessage}`.trim();

    return {
        success: failedCount === 0,
        synced: syncedCount,
        failed: failedCount,
        message,
    };
}

const MONTH_SHEET_LABELS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const getMonthlySheetLabel = (date?: Date | null) => {
    const baseDate = date ?? new Date();
    return MONTH_SHEET_LABELS[baseDate.getMonth()] || 'MES';
};