
'use server';

import ExcelJS from 'exceljs';
import { collection, query, where, Timestamp, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Study, StudyWithCompletedBy, Modality, GeneralService } from '@/lib/types';
import { Modalities } from '@/lib/types';
import { format, differenceInYears, startOfDay, endOfDay } from 'date-fns';
import { z } from 'zod';
import { EXCEL_HEADERS } from './export-columns';

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

        if (month > 11) {
             [day, month] = [month+1, day-1];
        }

        const birthDate = new Date(year, month, day);
        if (!isNaN(birthDate.getTime())) {
            return differenceInYears(new Date(), birthDate);
        }
    } catch { 
        return null; 
    }
    return null;
};

const exportStudiesSchema = z.object({
    dateRange: z.object({
        from: z.coerce.date().optional(),
        to: z.coerce.date().optional(),
    }).optional(),
    filters: z.object({
        service: z.string().optional(),
        modality: z.string().optional(),
        status: z.string().optional(),
    }).optional(),
});

type ExportStudiesInput = z.infer<typeof exportStudiesSchema>;

async function getStudiesForExport(input?: ExportStudiesInput): Promise<Study[]> {
    const studiesCollection = collection(db, 'studies');
    let q = query(studiesCollection, orderBy('requestDate', 'desc'));

    if (input?.dateRange?.from) {
        const fromDate = startOfDay(new Date(input.dateRange.from));
        q = query(q, where('requestDate', '>=', Timestamp.fromDate(fromDate)));
    }
    if (input?.dateRange?.to) {
        const toDate = endOfDay(new Date(input.dateRange.to));
        q = query(q, where('requestDate', '<=', Timestamp.fromDate(toDate)));
    } else if (input?.dateRange?.from && !input?.dateRange?.to) {
        const toDate = endOfDay(new Date(input.dateRange.from));
        q = query(q, where('requestDate', '<=', Timestamp.fromDate(toDate)));
    }

    const studiesSnapshot = await getDocs(q);
    
    let studies: Study[] = [];
    studiesSnapshot.forEach(doc => {
        studies.push({ id: doc.id, ...doc.data() } as Study);
    });

    const serviceFilter = input?.filters?.service && input.filters.service !== 'TODOS' ? input.filters.service : null;
    const modalityFilter = input?.filters?.modality && input.filters.modality !== 'TODOS' ? input.filters.modality : null;
    const statusFilter = input?.filters?.status && input.filters.status !== 'TODOS' ? input.filters.status : null;

    if (serviceFilter) studies = studies.filter(s => s.service === serviceFilter);
    if (modalityFilter) studies = studies.filter(s => s.studies.some(sd => sd.modality === modalityFilter));
    if (statusFilter) studies = studies.filter(s => s.status === statusFilter);

    return studies;
}

const headers = EXCEL_HEADERS;

export async function exportStudiesToExcel(input: ExportStudiesInput): Promise<string> {
    const studies = await getStudiesForExport(input);
    if (studies.length === 0) {
        throw new Error("No hay estudios para exportar con los filtros seleccionados.");
    }

    const workbook = new ExcelJS.Workbook();
    const allModalities = [...Modalities, 'CONSULTA'];
    const studiesByModality: Record<string, StudyWithCompletedBy[]> = {};

    studies.forEach(study => {
        const modality = study.studies[0]?.modality || 'OTROS';
        const key = allModalities.includes(modality as any) ? modality : 'CONSULTA';
        if (!studiesByModality[key]) {
            studiesByModality[key] = [];
        }
        studiesByModality[key].push(study as StudyWithCompletedBy);
    });

    for (const modality of Object.keys(studiesByModality)) {
        const worksheet = workbook.addWorksheet(modality);
        worksheet.columns = headers;

        const rows = studiesByModality[modality].map(s => {
            const singleStudy = s.studies[0] || {};
            const age = getAgeFromBirthDate(s.patient.birthDate);
            let entidad = s.patient.entidad;
            if (entidad && entidad.toLowerCase().includes('cajacopi')) {
                entidad = 'CAJACOPI EPS S.A.S.';
            }

            let kv = s.kV?.toString() || '';
            let ma = s.mA?.toString() || '';
            let timeMs = s.timeMs?.toString() || '';
            let dlp = s.dlp?.toString() || '';
            let ctdi = s.ctdi?.toString() || '';
            let numExposiciones = 'N/A';
            let dosis = 'N/A';

            if (singleStudy.modality === 'TAC') {
                kv = s.kV?.toString() || '120';
                ma = 'Smart mA';
                numExposiciones = 'N/A';
                timeMs = 'N/A';
                dosis = 'N/A';
            } else if (singleStudy.modality === 'RX') {
                numExposiciones = '2';
                dosis = 'N/A';
                ctdi = 'N/A';
                dlp = 'N/A';
            } else if (singleStudy.modality === 'ECO' || singleStudy.modality === 'RMN') {
                numExposiciones = 'N/A';
                timeMs = 'N/A';
                dosis = 'N/A';
                kv = 'N/A';
                ma = 'N/A';
                ctdi = 'N/A';
                dlp = 'N/A';
            }
            
            return {
                fecha: s.completionDate ? format((s.completionDate as any).toDate(), 'dd/MM/yyyy HH:mm') : '',
                idType: s.patient.idType,
                id: s.patient.id,
                fullName: s.patient.fullName,
                sex: s.patient.sex || '',
                entidad: entidad,
                birthDate: s.patient.birthDate,
                age: age,
                cups: singleStudy.cups,
                studyName: singleStudy.nombre,
                diagCode: s.diagnosis.code, 
                diagDesc: s.diagnosis.description,
                service: s.service,
                numExposiciones: numExposiciones,
                tiempoExposicion: timeMs,
                dosis: dosis,
                kV: kv,
                mA: ma,
                ctdi: ctdi,
                dlp: dlp,
                numImagRechazadas: '0',
                causasRechazo: 'N/A',
                numEstudiosRepetidos: '0',
                causasRepetidos: 'N/A',
                responsable: (s as StudyWithCompletedBy).completedBy || '',
                contraste: s.contrastType || 'No',
                mlAdmin: s.contrastAdministeredMl || '',
                observaciones: singleStudy.details || '',
            };
        });
        worksheet.addRows(rows);
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer).toString('base64');
}
    
