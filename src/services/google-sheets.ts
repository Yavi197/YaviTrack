
'use server';

import { google, sheets_v4 } from 'googleapis';
import { Study, StudyWithCompletedBy, OrderData, QualityReport, Remission, TechnologistShift } from '@/lib/types';
import { formatInTimeZone } from 'date-fns-tz';
import { EXPORT_COLUMNS, REMISSION_EXPORT_COLUMNS, INVENTORY_EXPORT_COLUMNS } from './export-columns';
import { differenceInYears } from 'date-fns';

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
const REMISSIONS_SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID_REMISSIONS;
const MODALITY_SPREADSHEET_OVERRIDES: Record<string, string | undefined> = {
    RX: process.env.GOOGLE_SHEET_ID_RX,
    ECO: process.env.GOOGLE_SHEET_ID_ECO,
    TAC: process.env.GOOGLE_SHEET_ID_TAC,
};
const MONTHLY_MODALITY_SHEETS = new Set(['RX', 'ECO', 'TAC']);
const INVENTORY_SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID_INVENTORY;
const QUALITY_REPORTS_SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID_QUALITY_REPORTS;
const STAFF_SHIFTS_SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID_STAFF_SHIFTS;
const QUALITY_REPORT_HEADERS = [
    'Fecha creación',
    'Estado',
    'Categoría',
    'Subcategoría',
    'Prioridad',
    'Turno',
    'Impacto',
    'Área / Modalidad',
    'Rol involucrado',
    'Personal',
    'Paciente',
    'ID Paciente',
    'Historia Clínica',
    'Descripción',
    'Acción Inmediata',
    'Reportado por',
    'Rol reportante',
    'ID Reporte',
];
const makeSheetKey = (spreadsheetId: string, sheetName: string) => `${spreadsheetId}:${sheetName}`;
const SPANISH_MONTHS_SHORT = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

const ensuredSheets = new Set<string>();
const sheetCache = new Map<string, { rows: string[][]; fetchedAt: number }>();
const SHEET_CACHE_TTL_MS = 60 * 1000; // 1 minuto
const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'America/Bogota'
};

const getColumnLetter = (index: number) => {
    if (index <= 0) return 'A';
    let dividend = index;
    let columnName = '';

    while (dividend > 0) {
        const modulo = (dividend - 1) % 26;
        columnName = String.fromCharCode(65 + modulo) + columnName;
        dividend = Math.floor((dividend - modulo - 1) / 26);
    }

    return columnName;
};

const buildSheetRange = (sheetName: string, headerCount: number, rowLimit = 1000) => {
    const lastColumn = getColumnLetter(Math.max(headerCount, 1));
    return `${sheetName}!A1:${lastColumn}${rowLimit}`;
};

const getSpreadsheetIdForModality = (modality?: string) => {
    if (modality) {
        const override = MODALITY_SPREADSHEET_OVERRIDES[modality.toUpperCase()];
        if (override) return override;
    }
    return SPREADSHEET_ID;
};

const getMonthlySheetName = (date?: Date | null) => {
    const baseDate = date ?? new Date();
    const monthLabel = SPANISH_MONTHS_SHORT[baseDate.getMonth()] || 'MES';
    return monthLabel;
};

const resolveSheetNameForModality = (modality: string, referenceDate: Date | null) => {
    const normalized = modality?.toUpperCase() || '';
    if (MONTHLY_MODALITY_SHEETS.has(normalized)) {
        const date = referenceDate ?? new Date();
        return getMonthlySheetName(date);
    }
    return modality;
};

const isQuotaError = (error: any) => {
    const message = error?.message || error?.response?.data?.error?.message || '';
    return /quota exceeded/i.test(message);
};

async function withSheetsRetry<T>(operation: () => Promise<T>, attempts = 3, delayMs = 1000): Promise<T> {
    try {
        return await operation();
    } catch (error) {
        if (attempts > 1 && isQuotaError(error)) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
            return withSheetsRetry(operation, attempts - 1, delayMs * 2);
        }
        throw error;
    }
}

const MIN_WRITE_INTERVAL_MS = 250;
const WRITE_WINDOW_MS = 60 * 1000;
const MAX_WRITES_PER_WINDOW = 55;
let lastWriteTimestamp = 0;
let writeQueue: Promise<void> = Promise.resolve();
const writeHistory: number[] = [];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const waitForQuotaSlot = async () => {
    while (true) {
        const now = Date.now();
        while (writeHistory.length && now - writeHistory[0] > WRITE_WINDOW_MS) {
            writeHistory.shift();
        }
        if (writeHistory.length < MAX_WRITES_PER_WINDOW) {
            writeHistory.push(now);
            return;
        }
        const earliest = writeHistory[0];
        const waitMs = Math.max(WRITE_WINDOW_MS - (now - earliest), MIN_WRITE_INTERVAL_MS);
        await sleep(waitMs);
    }
};

const queueSheetsWrite = async <T,>(operation: () => Promise<T>): Promise<T> => {
    const task = writeQueue.then(async () => {
        const now = Date.now();
        const waitMs = Math.max(0, MIN_WRITE_INTERVAL_MS - (now - lastWriteTimestamp));
        if (waitMs > 0) {
            await sleep(waitMs);
        }
        await waitForQuotaSlot();
        lastWriteTimestamp = Date.now();
        return withSheetsRetry(operation);
    });

    writeQueue = task.then(() => undefined).catch(() => undefined);
    return task;
};

export async function deleteRowsByColumnValues({ sheetName, headers, columnHeader, values, spreadsheetId }: { sheetName: string; headers: string[]; columnHeader: string; values: Set<string>; spreadsheetId?: string; }) {
    const targetSpreadsheetId = spreadsheetId || SPREADSHEET_ID;
    if (!targetSpreadsheetId || values.size === 0) return;
    const sheets = await getSheetsClient();
    if (!sheets) return;
    await ensureSheetExists(sheets, targetSpreadsheetId, sheetName, headers);

    const range = buildSheetRange(sheetName, headers.length);
    const [spreadsheet, valuesRes] = await Promise.all([
        sheets.spreadsheets.get({ spreadsheetId: targetSpreadsheetId }),
        sheets.spreadsheets.values.get({ spreadsheetId: targetSpreadsheetId, range })
    ]);

    const rows = valuesRes.data.values || [];
    if (rows.length === 0) return;
    const headerRow = rows[0] || headers;
    const columnIndex = headerRow.indexOf(columnHeader);
    if (columnIndex === -1) return;

    const normalizedValues = new Set(Array.from(values).filter(Boolean).map(v => v.trim()));
    if (normalizedValues.size === 0) return;

    const rowsToDelete: number[] = [];
    for (let i = 1; i < rows.length; i++) {
        const candidate = rows[i]?.[columnIndex]?.trim();
        if (candidate && normalizedValues.has(candidate)) {
            rowsToDelete.push(i);
        }
    }

    if (rowsToDelete.length === 0) return;

    const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === sheetName);
    const sheetId = sheet?.properties?.sheetId;
    if (typeof sheetId !== 'number') return;

    const requests = rowsToDelete
        .sort((a, b) => b - a)
        .map(rowIndex => ({
            deleteDimension: {
                range: {
                    sheetId,
                    dimension: 'ROWS',
                    startIndex: rowIndex,
                    endIndex: rowIndex + 1,
                }
            }
        }));

    await withSheetsRetry(() => sheets.spreadsheets.batchUpdate({
        spreadsheetId: targetSpreadsheetId!,
        requestBody: { requests },
    }));

    sheetCache.delete(makeSheetKey(targetSpreadsheetId, sheetName));
}

const formatBogotaDate = (date: Date) => {
    return new Intl.DateTimeFormat('es-CO', DATE_FORMAT_OPTIONS).format(date).replace(',', '');
};

const parseLegacyDateString = (value: string): Date | null => {
    if (!value) return null;
    const normalized = value
        .replace(/\u00A0/g, ' ')
        .replace(/,\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const prepared = normalized
        .replace(/a\.?\s*m\.?/gi, 'am')
        .replace(/p\.?\s*m\.?/gi, 'pm');

    const match = prepared.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}) (\d{1,2}):(\d{2})(?::(\d{2}))?(?: (am|pm))?$/i);
    if (!match) return null;

    const [, dayStr, monthStr, yearStr, hourStr, minuteStr, secondStr, ampm] = match;
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10) - 1;
    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    const second = secondStr ? parseInt(secondStr, 10) : 0;

    if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(hour) || Number.isNaN(minute) || Number.isNaN(second)) {
        return null;
    }

    if (ampm) {
        const marker = ampm.toLowerCase();
        if (marker === 'am' && hour === 12) {
            hour = 0;
        } else if (marker === 'pm' && hour < 12) {
            hour += 12;
        }
    }

    const parsedDate = new Date(Number(yearStr), month, day, hour, minute, second);
    return isNaN(parsedDate.getTime()) ? null : parsedDate;
};

const coerceValueToDate = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date) {
        return isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'number') {
        const date = new Date(value);
        return isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const direct = new Date(trimmed);
        if (!isNaN(direct.getTime())) {
            return direct;
        }
        return parseLegacyDateString(trimmed);
    }
    if (value && typeof value === 'object') {
        if (typeof value.toDate === 'function') {
            const date = value.toDate();
            return date instanceof Date && !isNaN(date.getTime()) ? date : null;
        }
        if (typeof value.seconds === 'number') {
            return new Date(value.seconds * 1000);
        }
    }
    return null;
};

export async function appendQualityReportToSheet(report: QualityReport & { id?: string }) {
    if (!QUALITY_REPORTS_SPREADSHEET_ID) {
        console.warn('[Google Sheets Warning] GOOGLE_SHEET_ID_QUALITY_REPORTS no está definido. Se omite la exportación de reportes de calidad.');
        return;
    }

    const sheets = await getSheetsClient();
    if (!sheets) {
        console.warn('[Google Sheets Warning] Cliente de Sheets no disponible.');
        return;
    }

    try {
        const createdAtDate = coerceValueToDate(report.createdAt) || new Date();
        const sheetName = getMonthlySheetName(createdAtDate);
        await ensureSheetExists(sheets, QUALITY_REPORTS_SPREADSHEET_ID, sheetName, QUALITY_REPORT_HEADERS);
        const cleanDescription = (report.description || '').replace(/\s+/g, ' ').trim();
        const row = [
            formatBogotaDate(createdAtDate),
            report.status,
            report.category,
            (report as any).subcategory || '',
            (report as any).priority || '',
            (report as any).shift || '',
            (report as any).impact || '',
            report.modality,
            report.involvedRole,
            report.involvedUserName || report.otherPersonName || '',
            report.patientName || '',
            report.referenceId || '',
            report.patientId || '',
            cleanDescription,
            (report as any).immediateAction || '',
            report.reportedBy?.name || '',
            report.reportedBy?.role || '',
            report.id || '',
        ];

        await queueSheetsWrite(() =>
            sheets.spreadsheets.values.append({
                spreadsheetId: QUALITY_REPORTS_SPREADSHEET_ID,
                range: `${sheetName}!A:A`,
                valueInputOption: 'RAW',
                requestBody: { values: [row] },
            })
        );
    } catch (error: any) {
        console.error('[Google Sheets Error] No se pudo exportar el reporte de calidad:', error?.message || error);
    }
}

/**
 * Busca un reporte de calidad por su ID en todas las hojas mensuales
 * y actualiza la columna Estado + registra el cambio con fecha.
 */
export async function updateQualityReportStatusInSheet(
    reportId: string,
    newStatus: string,
    updatedByName?: string,
) {
    if (!QUALITY_REPORTS_SPREADSHEET_ID) {
        console.warn('[Google Sheets Warning] GOOGLE_SHEET_ID_QUALITY_REPORTS no está definido.');
        return;
    }

    const sheets = await getSheetsClient();
    if (!sheets) {
        console.warn('[Google Sheets Warning] Cliente de Sheets no disponible.');
        return;
    }

    try {
        // Get all sheet names in the spreadsheet
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: QUALITY_REPORTS_SPREADSHEET_ID });
        const sheetNames = spreadsheet.data.sheets?.map(s => s.properties?.title || '').filter(Boolean) || [];

        const idColumnIndex = QUALITY_REPORT_HEADERS.indexOf('ID Reporte');   // last col
        const statusColumnIndex = QUALITY_REPORT_HEADERS.indexOf('Estado');    // col B (index 1)
        const statusColumnLetter = getColumnLetter(statusColumnIndex + 1);
        const idColumnLetter = getColumnLetter(idColumnIndex + 1);

        for (const sheetName of sheetNames) {
            const range = buildSheetRange(sheetName, QUALITY_REPORT_HEADERS.length);
            let rows: string[][];
            try {
                const res = await sheets.spreadsheets.values.get({
                    spreadsheetId: QUALITY_REPORTS_SPREADSHEET_ID,
                    range,
                });
                rows = (res.data.values || []) as string[][];
            } catch {
                continue; // Sheet may not have data yet
            }

            // Find the row with the matching ID (skip header row at index 0)
            const rowIndex = rows.findIndex((row, i) => i > 0 && row[idColumnIndex] === reportId);

            if (rowIndex === -1) continue; // Not in this sheet, try next

            // rowIndex is 0-based, but Sheets rows are 1-based and have a header, so +1 for header
            const sheetRow = rowIndex + 1; // 1-based index for Sheets API

            const updatedAt = formatBogotaDate(new Date());
            const statusValue = updatedByName
                ? `${newStatus} (${updatedByName} · ${updatedAt})`
                : `${newStatus} (${updatedAt})`;

            await queueSheetsWrite(() =>
                sheets.spreadsheets.values.update({
                    spreadsheetId: QUALITY_REPORTS_SPREADSHEET_ID!,
                    range: `${sheetName}!${statusColumnLetter}${sheetRow}`,
                    valueInputOption: 'RAW',
                    requestBody: { values: [[statusValue]] },
                })
            );

            console.log(`[Google Sheets] Quality report ${reportId} status updated to "${newStatus}" in sheet "${sheetName}" row ${sheetRow}.`);
            return; // Found and updated — no need to search further
        }

        console.warn(`[Google Sheets Warning] No se encontró el reporte ${reportId} en ninguna hoja. El estado no fue actualizado en Sheets.`);
    } catch (error: any) {
        console.error('[Google Sheets Error] No se pudo actualizar el estado del reporte:', error?.message || error);
    }
}

const getAgeFromBirthDateGSheet = (birthDateString?: string): number | null => {
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
        if (month > 11) { [day, month] = [month + 1, day - 1]; }

        const birthDate = new Date(year, month, day);
        if (isNaN(birthDate.getTime())) return null;

        return differenceInYears(new Date(), birthDate);
    } catch { 
        return null; 
    }
}

export async function getSheetsClient(): Promise<sheets_v4.Sheets | null> {
    const fs = await import('fs');
    const path = await import('path');

    let clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let privateKey = process.env.GOOGLE_PRIVATE_KEY;

    // Try to find the JSON file in root to avoid PEM formatting issues with .env.local
    const rootDir = process.cwd();
    const jsonFiles = fs.readdirSync(rootDir).filter(f => f.endsWith('.json') && f.startsWith('yavitrack-'));
    
    if (jsonFiles.length > 0) {
        try {
            const jsonPath = path.join(rootDir, jsonFiles[0]);
            const credentials = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
            clientEmail = credentials.client_email;
            privateKey = credentials.private_key;
            console.log(`[Google Sheets Auth] Usando archivo de credenciales directo: ${jsonFiles[0]}`);
        } catch (error) {
            console.warn("[Google Sheets Auth] Error al leer el archivo JSON de credenciales, probando con .env:", error);
        }
    }

    if (!clientEmail || !privateKey) {
        console.warn("[Google Sheets Auth Warning] GOOGLE_SERVICE_ACCOUNT_EMAIL o GOOGLE_PRIVATE_KEY no están definidas en el entorno. La funcionalidad de Google Sheets estará deshabilitada.");
        return null;
    }
    
    // Apply common fixes for PEM format from environment variables
    const formattedPrivateKey = privateKey.replace(/\\n/g, '\n').replace(/"/g, '').trim();

    try {
        const auth = new google.auth.JWT({
            email: clientEmail,
            key: formattedPrivateKey,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        
        await auth.getAccessToken(); // Verify that auth works
        return google.sheets({ version: 'v4', auth });
    } catch (error: any) {
        console.error("[Google Sheets Auth Error] No se pudo crear el cliente de JWT. Verifica las credenciales:", error.message);
        return null;
    }
}

export async function ensureSheetExists(
    sheets: sheets_v4.Sheets,
    spreadsheetId: string | undefined,
    sheetName: string,
    headers: string[]
) {
    if (!spreadsheetId) throw new Error("Spreadsheet ID is not defined.");

    try {
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        const sheet = spreadsheet.data.sheets?.find(s => s.properties?.title === sheetName);
        if (!sheet) {
            // Si la hoja no existe, la creamos y agregamos encabezados
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [{ addSheet: { properties: { title: sheetName } } }],
                },
            });
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${sheetName}!A1`,
                valueInputOption: 'RAW',
                requestBody: { values: [headers] },
            });
        } else {
            // Si la hoja existe, revisamos los encabezados
            const headerRange = `${sheetName}!A1:${getColumnLetter(headers.length)}1`;
            const headerRes = await sheets.spreadsheets.values.get({
                spreadsheetId,
                range: headerRange
            });
            const currentHeaders = headerRes.data.values?.[0] || [];
            // Si los encabezados no coinciden, los actualizamos
            if (headers.some((h, i) => currentHeaders[i] !== h)) {
                await sheets.spreadsheets.values.update({
                    spreadsheetId,
                    range: `${sheetName}!A1`,
                    valueInputOption: 'RAW',
                    requestBody: { values: [headers] },
                });
            }
        }
    } catch (error: any) {
        // Si el error es porque la hoja ya existe, lo ignoramos y continuamos
        if (error?.response?.data?.error?.message?.includes('A sheet with the name') && error?.response?.data?.error?.message?.includes('already exists')) {
            console.warn(`[Google Sheets Warning] La hoja "${sheetName}" ya existe, continuando...`);
            return;
        }
        console.error(`[Google Sheets Error] Failed to ensure sheet "${sheetName}" exists:`, error);
        throw error;
    }
}

export async function appendOrderToSheet(studyData: Study): Promise<void> {
    const singleStudy = studyData.studies[0] || {};
    const modality = (singleStudy.modality || 'OTROS') as string;
    const spreadsheetId = getSpreadsheetIdForModality(modality);

    if (!spreadsheetId) {
        console.warn(`[Google Sheets Warning] No hay un Spreadsheet configurado para la modalidad ${modality}.`);
        return;
    }

    const sheets = await getSheetsClient();
    if (!sheets) {
        console.warn("[Google Sheets Warning] El cliente de Sheets no pudo ser inicializado. Saltando la escritura en la hoja.");
        return;
    }

    try {
        const headers = EXPORT_COLUMNS;
        const completionDate = coerceValueToDate(studyData.completionDate);
        const requestDate = coerceValueToDate(studyData.requestDate) || new Date();
        const fallbackDate = requestDate || new Date();
        const candidateSheetNames = Array.from(new Set([
            resolveSheetNameForModality(modality, completionDate ?? fallbackDate),
            resolveSheetNameForModality(modality, fallbackDate),
        ]));
        let sheetName = candidateSheetNames[0];
        let sheetKey = makeSheetKey(spreadsheetId, sheetName);

        const loadRows = async (targetSheetName: string, targetKey: string) => {
            const cacheEntry = sheetCache.get(targetKey);
            let sheetRows = cacheEntry?.rows || [];
            const needsRefresh = !cacheEntry || (Date.now() - cacheEntry.fetchedAt) > SHEET_CACHE_TTL_MS;

            if (needsRefresh) {
                const range = buildSheetRange(targetSheetName, headers.length);
                try {
                    const getRes = await withSheetsRetry(() => sheets.spreadsheets.values.get({
                        spreadsheetId,
                        range,
                    }));
                    sheetRows = getRes.data.values || [];
                } catch (error: any) {
                    const message = error?.response?.data?.error?.message || '';
                    const notFound = /not found/i.test(message) || /unable to parse/i.test(message);
                    if (!notFound) {
                        throw error;
                    }
                    sheetRows = [];
                }
                if (sheetRows.length === 0) {
                    sheetRows.push([...headers]);
                }
                sheetCache.set(targetKey, { rows: sheetRows, fetchedAt: Date.now() });
            } else if (sheetRows.length === 0) {
                sheetRows.push([...headers]);
                sheetCache.set(targetKey, { rows: sheetRows, fetchedAt: Date.now() });
            }

            return sheetRows;
        };

        const locateRowIndex = (rows: string[][], studyId?: string) => {
            if (!studyId) return -1;
            const headerRow = rows[0] || headers;
            const firestoreIdIndex = headerRow.indexOf('ID FIRESTORE');
            if (firestoreIdIndex === -1) return -1;
            for (let i = 1; i < rows.length; i++) {
                if (rows[i]?.[firestoreIdIndex] === studyId) {
                    return i;
                }
            }
            return -1;
        };

        let rows = await loadRows(sheetName, sheetKey);
        let existingRowIndex = locateRowIndex(rows, studyData.id);

        if (existingRowIndex === -1 && candidateSheetNames.length > 1) {
            for (const candidate of candidateSheetNames.slice(1)) {
                const candidateKey = makeSheetKey(spreadsheetId, candidate);
                const candidateRows = await loadRows(candidate, candidateKey);
                const candidateRowIndex = locateRowIndex(candidateRows, studyData.id);
                if (candidateRowIndex > 0) {
                    sheetName = candidate;
                    sheetKey = candidateKey;
                    rows = candidateRows;
                    existingRowIndex = candidateRowIndex;
                    break;
                }
            }
        }

        await ensureSheetExists(sheets, spreadsheetId, sheetName, headers);

        const formattedDate = requestDate ? formatBogotaDate(requestDate) : '';
        const age = getAgeFromBirthDateGSheet(studyData.patient.birthDate);
        const studyWithCompletedBy = studyData as StudyWithCompletedBy;

        let kv = studyData.kV?.toString() || '';
        let ma = studyData.mA?.toString() || '';
        let timeMs = studyData.timeMs?.toString() || '';
        let dlp = studyData.dlp?.toString() || '';
        let ctdi = studyData.ctdi?.toString() || '';
        let numExposiciones = 'N/A';

        if (modality === 'TAC') {
            kv = studyData.kV?.toString() || '120';
            ma = 'Smart mA';
            numExposiciones = 'N/A';
            timeMs = 'N/A';
        } else if (modality === 'RX') {
            numExposiciones = '2';
            ctdi = 'N/A';
            dlp = 'N/A';
        } else if (modality === 'ECO' || modality === 'RMN') {
            numExposiciones = 'N/A';
            timeMs = 'N/A';
            kv = 'N/A';
            ma = 'N/A';
            ctdi = 'N/A';
            dlp = 'N/A';
        }

        const statusLabel = studyData.status || 'Pendiente';
        const patient = studyData.patient ?? ({} as Study['patient']);
        const diagnosis = studyData.diagnosis ?? ({} as Study['diagnosis']);

        const newRow = [
            formattedDate,
            patient.idType || '',
            patient.id || '',
            patient.fullName || '',
            patient.sex || '',
            patient.entidad || '',
            patient.birthDate || '',
            age !== null ? age : '',
            singleStudy.cups || '',
            singleStudy.nombre || '',
            diagnosis.code || '',
            diagnosis.description || '',
            studyData.service || '',
            numExposiciones,
            timeMs,
            kv,
            ma,
            ctdi,
            dlp,
            '0',
            'N/A',
            '0',
            'N/A',
            studyWithCompletedBy.completedBy || '',
            studyData.contrastType || 'No',
            studyData.contrastAdministeredMl || '',
            singleStudy.details || '',
            studyData.id || '',
            statusLabel,
        ];

        const cachedRow = newRow.map(value => {
            if (value === null || value === undefined) return '';
            return typeof value === 'string' ? value : String(value);
        });

        if (existingRowIndex > 0) {
            const updateRange = `${sheetName}!A${existingRowIndex + 1}`;
            await queueSheetsWrite(() => sheets.spreadsheets.values.update({
                spreadsheetId,
                range: updateRange,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [newRow] },
            }));
            rows[existingRowIndex] = cachedRow;
            console.log(`[Google Sheets] Updated row for study ${studyData.id}.`);
        } else {
            await queueSheetsWrite(() => sheets.spreadsheets.values.append({
                spreadsheetId,
                range: `${sheetName}!A1`,
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                requestBody: { values: [newRow] },
            }));
            rows.push(cachedRow);
            console.log(`[Google Sheets] Successfully appended row for study ${studyData.id}.`);
        }

        sheetCache.set(sheetKey, { rows, fetchedAt: Date.now() });

    } catch (error) {
        console.error(`[Google Sheets Error] Failed to append data for study ${studyData.id}:`, error);
    }
}

export async function appendOrUpdateRemissionSheet(data: OrderData & { 
    remissionFileUrls?: { [key: string]: string },
    bajoSedacion?: boolean,
    requiereContraste?: boolean,
    status?: string,
    statusDate?: any
}, studyId: string): Promise<void> {
    const spreadsheetId = REMISSIONS_SPREADSHEET_ID || SPREADSHEET_ID;
    if (!spreadsheetId) {
        console.warn("[Google Sheets Warning] GOOGLE_SHEET_ID no está definido. Saltando la escritura en la hoja.");
        return;
    }
    const sheets = await getSheetsClient();
    if (!sheets) {
        console.warn("[Google Sheets Warning] El cliente de Sheets no pudo ser inicializado. Saltando la escritura en la hoja.");
        return;
    }
    const createdAtSource = (data as any).createdAt ?? (data as any).requestDate ?? null;
    const createdAtDate = coerceValueToDate(createdAtSource) || new Date();
    const sheetName = getMonthlySheetName(createdAtDate);
    const headers = REMISSION_EXPORT_COLUMNS;
    const sheetKey = makeSheetKey(spreadsheetId, sheetName);
    if (!ensuredSheets.has(sheetKey)) {
        await ensureSheetExists(sheets, spreadsheetId, sheetName, headers);
        ensuredSheets.add(sheetKey);
    }

    const cacheEntry = sheetCache.get(sheetKey);
    const needsRefresh = !cacheEntry || (Date.now() - cacheEntry.fetchedAt) > SHEET_CACHE_TTL_MS;
    let rows = cacheEntry?.rows ?? [];

    if (needsRefresh) {
        const range = buildSheetRange(sheetName, headers.length);
        const getRes = await withSheetsRetry(() => sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        }));
        rows = getRes.data.values || [];
        sheetCache.set(sheetKey, { rows, fetchedAt: Date.now() });
    }

    if (rows.length === 0) {
        rows.push(headers);
    }

    const headerRow = rows[0] || headers;
    const idIndex = headerRow.indexOf('ID FIRESTORE');
    const rowIndex = rows.findIndex(row => row[idIndex] === studyId);

    // Helper para formatear Firestore Timestamp
    const formatTimestamp = (ts: any, fallbackToNow = false) => {
        const resolvedDate = coerceValueToDate(ts);
        if (!resolvedDate) {
            if (typeof ts === 'string' && ts.trim().length > 0) {
                return ts;
            }
            if (!fallbackToNow) return '';
            return formatBogotaDate(new Date());
        }
        return formatBogotaDate(resolvedDate);
    };

    const getAge = (birthDateString?: string) => {
        if (!birthDateString) return '';
        try {
            const dateParts = birthDateString.split(/[-\/]/);
            let year, month, day;
            if (dateParts.length === 3) {
                if (dateParts[2].length === 4) {
                    day = parseInt(dateParts[0]);
                    month = parseInt(dateParts[1]);
                    year = parseInt(dateParts[2]);
                } else if (dateParts[0].length === 4) {
                    year = parseInt(dateParts[0]);
                    month = parseInt(dateParts[1]);
                    day = parseInt(dateParts[2]);
                } else {
                    return '';
                }
                if (month > 12) {
                    [day, month] = [month, day];
                }
                const birthDate = new Date(year, month - 1, day);
                if (!isNaN(birthDate.getTime())) {
                    const age = new Date().getFullYear() - birthDate.getFullYear();
                    return age;
                }
            }
        } catch {
            return '';
        }
        return '';
    };

    const remissionFileUrls = data.remissionFileUrls || {};
    // Asignar cada documento a su columna específica
    const notaDeCargoUrl = remissionFileUrls.notaDeCargo || '';
    const ordenMedicaUrl = remissionFileUrls.ordenMedica || '';
    const evolucionUrl = remissionFileUrls.evolucion || '';
    const autorizacionUrl = remissionFileUrls.autorizacion || '';
    const informesUrl = remissionFileUrls.informes || '';

    const resolvedObservaciones = (
        (data as any).observaciones ||
        (data as any).observation ||
        (data as any).observations ||
        data.studies?.[0]?.details ||
        data.diagnosis?.description ||
        ''
    ).trim();

    const resolvedSpecialist = ((data as any).specialist || data.orderingPhysician?.name || '').toString().trim();
    const resolvedMedicalRecord = ((data as any).medicalRecord || data.orderingPhysician?.register || '').toString().trim();

    const newRow = [
        formatTimestamp(createdAtSource, true), // FECHA/HORA
        data.patient?.idType || '', // TIPO DE DOCUMENTO
        data.patient?.id || studyId, // N° ID
        data.patient?.fullName || '', // NOMBRE COMPLETO DEL PACIENTE
        data.patient?.sex || '', // SEXO
        data.patient?.entidad || '', // ENTIDAD EPS
        data.patient?.birthDate || '', // FECHA DE NACIMIENTO
        getAge(data.patient?.birthDate), // EDAD
        data.studies?.[0]?.cups || '', // CUPS
        data.studies?.[0]?.nombre || '', // NOMBRE DEL ESTUDIO REALIZADO
        data.diagnosis?.code || '', // CIE10
        data.diagnosis?.description || '', // DIAGNOSTICO
        resolvedObservaciones, // OBSERVACIONES
        resolvedSpecialist, // ESPECIALISTA
        resolvedMedicalRecord, // REGISTRO MEDICO
        data.requiereContraste ? 'Si' : 'No', // CONTRASTADO
        data.bajoSedacion ? 'Si' : 'No', // SEDACION
        notaDeCargoUrl, // NOTA DE CARGO (R)
        ordenMedicaUrl, // ORDEN MEDICA (S)
        evolucionUrl, // EVOLUCION (T)
        autorizacionUrl, // AUTORIZACION (U)
        informesUrl, // INFORMES (V)
        data.status || '', // ESTADO REMISION (W)
        formatTimestamp(data.statusDate), // FECHA ESTADO (X)
        studyId // ID FIRESTORE (Y)
    ];

    // Si existe la fila, actualizarla; si no, agregarla
    if (rowIndex > 0) {
        const range = `${sheetName}!A${rowIndex + 1}:Z${rowIndex + 1}`;
        await queueSheetsWrite(() => sheets.spreadsheets.values.update({
            spreadsheetId,
            range,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [newRow] },
        }));
        rows[rowIndex] = newRow;
        sheetCache.set(sheetKey, { rows, fetchedAt: Date.now() });
        console.log(`[Google Sheets] Remisión actualizada en fila ${rowIndex + 1}`);
    } else {
        await queueSheetsWrite(() => sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: [newRow] },
        }));
        rows.push(newRow);
        sheetCache.set(sheetKey, { rows, fetchedAt: Date.now() });
        console.log(`[Google Sheets] Remisión agregada como nueva fila`);
    }
}
export async function appendInventoryEntriesToSheet(entries: Array<{
    itemId: string;
    itemName: string;
    presentation: string;
    service: string;
    amountAdded: number;
    lote?: string;
    priceAtEntry?: number;
    unidad?: string;
    fechaVencimiento?: string;
    proveedor?: string;
    observaciones?: string;
    date?: any;
    addedBy?: { uid: string; name: string };
}>): Promise<void> {
    const spreadsheetId = INVENTORY_SPREADSHEET_ID || SPREADSHEET_ID;
    if (!spreadsheetId) {
        console.warn("[Google Sheets Warning] GOOGLE_SHEET_ID no está definido. Saltando la escritura en la hoja.");
        return;
    }

    const sheets = await getSheetsClient();
    if (!sheets) {
        console.warn("[Google Sheets Warning] El cliente de Sheets no pudo ser inicializado. Saltando la escritura en la hoja.");
        return;
    }

    if (!entries || entries.length === 0) {
        return;
    }

    const headers = INVENTORY_EXPORT_COLUMNS;
    const rowsBySheet = new Map<string, string[][]>();

    for (const entry of entries) {
        const resolvedDate = coerceValueToDate(entry.date) || new Date();
        const sheetName = getMonthlySheetName(resolvedDate);
        const timestamp = formatInTimeZone(resolvedDate, 'America/Bogota', 'dd/MM/yyyy HH:mm:ss');
        const row = [
            timestamp,
            entry.itemId || '',
            entry.itemName || '',
            entry.presentation || '',
            entry.service || '',
            entry.amountAdded || '',
            entry.lote || '',
            entry.priceAtEntry || '',
            entry.unidad || '',
            entry.fechaVencimiento || '',
            entry.proveedor || '',
            entry.observaciones || '',
            entry.addedBy?.name || '',
            entry.addedBy?.uid || ''
        ];

        if (!rowsBySheet.has(sheetName)) {
            rowsBySheet.set(sheetName, []);
        }
        rowsBySheet.get(sheetName)!.push(row as string[]);
    }

    for (const [sheetName, rows] of rowsBySheet.entries()) {
        const sheetKey = makeSheetKey(spreadsheetId, sheetName);
        if (!ensuredSheets.has(sheetKey)) {
            await ensureSheetExists(sheets, spreadsheetId, sheetName, headers);
            ensuredSheets.add(sheetKey);
        }

        await queueSheetsWrite(() => sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${sheetName}!A1`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            requestBody: { values: rows },
        }));
        console.log(`[Google Sheets] Successfully appended ${rows.length} inventory entries to ${sheetName}.`);
    }
}

export async function softDeleteRemissionSheet(remission: Remission): Promise<void> {
    const spreadsheetId = REMISSIONS_SPREADSHEET_ID || SPREADSHEET_ID;
    if (!spreadsheetId) return;

    const sheets = await getSheetsClient();
    if (!sheets) return;

    try {
        const createdAtDate = coerceValueToDate(remission.createdAt) || new Date();
        const sheetName = getMonthlySheetName(createdAtDate);
        const headers = REMISSION_EXPORT_COLUMNS;
        const sheetKey = makeSheetKey(spreadsheetId, sheetName);

        // We need to find the row to update its status to 'ELIMINADO'
        const range = buildSheetRange(sheetName, headers.length);
        const getRes = await withSheetsRetry(() => sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        }));

        const rows = getRes.data.values || [];
        if (rows.length === 0) return;

        const headerRow = rows[0] || headers;
        const idIndex = headerRow.indexOf('ID FIRESTORE');
        const statusIndex = headerRow.indexOf('ESTADO REMISION');
        const dateIndex = headerRow.indexOf('FECHA ESTADO');

        if (idIndex === -1 || statusIndex === -1) return;

        const rowIndex = rows.findIndex(row => row[idIndex] === remission.id);
        if (rowIndex === -1) {
            console.warn(`[Google Sheets] Could not find remission ${remission.id} in sheet ${sheetName} for deletion.`);
            return;
        }

        const updateRow = rows[rowIndex];
        updateRow[statusIndex] = 'ELIMINADO';
        if (dateIndex !== -1) {
            updateRow[dateIndex] = formatBogotaDate(new Date());
        }

        const updateRange = `${sheetName}!A${rowIndex + 1}`;
        await queueSheetsWrite(() => sheets.spreadsheets.values.update({
            spreadsheetId,
            range: updateRange,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [updateRow] },
        }));

        // Invalidate cache
        sheetCache.delete(sheetKey);
        console.log(`[Google Sheets] Successfully marked remission ${remission.id} as ELIMINADO.`);

    } catch (error) {
        console.error(`[Google Sheets Error] Failed to soft delete remission ${remission.id}:`, error);
    }
}
    
export async function syncStaffShiftsToSheet(shifts: TechnologistShift[], monthName: string, year: number) {
    if (!STAFF_SHIFTS_SPREADSHEET_ID) {
        console.warn('[Google Sheets Warning] GOOGLE_SHEET_ID_STAFF_SHIFTS no está definido.');
        return { success: false, error: 'ID de hoja de turnos no configurado.' };
    }

    const sheets = await getSheetsClient();
    if (!sheets) return { success: false, error: 'No se pudo conectar con Drive.' };

    try {
        const fullMonthName = monthName.toUpperCase(); // MARZO
        const shortMonthName = monthName.substring(0, 3).toUpperCase(); // MAR
        
        // 1. Obtener lista de hojas para asegurar que escribimos en la correcta
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: STAFF_SHIFTS_SPREADSHEET_ID });
        const sheetTitles = spreadsheet.data.sheets?.map(s => s.properties?.title || '') || [];
        
        // Prioridad: Exacto (MARZO) -> Corto (MAR) -> Contiene (MARZO 2026) -> Primero disponible
        let targetSheet = sheetTitles.find(t => t.toUpperCase() === fullMonthName) || 
                          sheetTitles.find(t => t.toUpperCase() === shortMonthName) ||
                          sheetTitles.find(t => t.toUpperCase().includes(fullMonthName)) ||
                          sheetTitles[0];

        if (!targetSheet) return { success: false, error: 'No se encontró una pestaña válida en el Excel.' };

        console.log(`[Google Sheets] Sincronizando en pestaña: "${targetSheet}"`);

        const range = `${targetSheet}!A1:AJ60`; 
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: STAFF_SHIFTS_SPREADSHEET_ID,
            range,
        });

        const rows = response.data.values || [];
        if (rows.length === 0) return { success: false, error: 'Hoja de cálculo vacía.' };

        const updateRequests: sheets_v4.Schema$ValueRange[] = [];
        const shiftsByStaff = new Map<string, TechnologistShift[]>();
        
        // Log de lo que recibimos
        console.log(`[Google Sheets] Recibidos ${shifts.length} turnos para procesar.`);

        shifts.forEach(s => {
            const name = s.assignedUserName;
            if (!name) return;
            if (!shiftsByStaff.has(name)) shiftsByStaff.set(name, []);
            shiftsByStaff.get(name)!.push(s);
        });

        console.log(`[Google Sheets] Personal detectado en Med-iTrack: ${Array.from(shiftsByStaff.keys()).join(', ')}`);

        for (const [staffName, staffShifts] of shiftsByStaff.entries()) {
            const normalizedTarget = staffName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
            
            let staffRowIndex = -1;
            console.log(`[Google Sheets] Buscando a "${staffName}" (normalizado: "${normalizedTarget}")`);

            for (let i = 0; i < rows.length; i++) {
                const cellA = rows[i]?.[0]; // A
                if (!cellA) continue;

                const normalizedCell = cellA.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
                
                // Si el nombre de Med-iTrack está contenido en la celda o viceversa
                if (normalizedCell.includes(normalizedTarget) || normalizedTarget.includes(normalizedCell)) {
                    staffRowIndex = i;
                    console.log(`[Google Sheets] ¡Encontrado! "${staffName}" en fila ${i + 1}`);
                    break;
                }
            }

            if (staffRowIndex === -1) {
                console.warn(`[Google Sheets] ADVERTENCIA: No se pudo mapear a "${staffName}" en el Excel.`);
                continue;
            }

            const shiftRowNumber = staffRowIndex + 1;
            const hoursRowNumber = shiftRowNumber + 1;

            for (const shift of staffShifts) {
                const day = new Date(shift.date + 'T00:00:00').getDate();
                const colIndex = 4 + (day - 1); // E=4
                const colLetter = getColumnLetter(colIndex + 1);

                let code = '';
                let hoursValue: any = 0;

                switch (shift.shiftType) {
                    case 'CORRIDO': code = 'C'; hoursValue = 12; break;
                    case 'NOCHE': code = 'N'; hoursValue = 12; break;
                    case 'POSTURNO': code = 'P'; hoursValue = 0; break;
                    case 'LIBRE': code = 'L'; hoursValue = 0; break;
                    case 'MANANA': code = 'M'; hoursValue = 8; break;
                    case 'MANANA_TARDE': code = 'M/T'; hoursValue = 8; break;
                    case 'VACACIONES': code = 'V'; hoursValue = 0; break;
                    case 'LICENCIA': code = 'Lic'; hoursValue = 0; break;
                    case 'CALAMIDAD': code = 'Cal'; hoursValue = 0; break;
                    case 'PERMISO': code = 'Per'; hoursValue = 0; break;
                    default: code = (shift.shiftType as string).substring(0, 1); hoursValue = 0;
                }

                updateRequests.push({
                    range: `${targetSheet}!${colLetter}${shiftRowNumber}`,
                    values: [[code]]
                });
                updateRequests.push({
                    range: `${targetSheet}!${colLetter}${hoursRowNumber}`,
                    values: [[hoursValue]]
                });
            }
        }

        if (updateRequests.length > 0) {
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId: STAFF_SHIFTS_SPREADSHEET_ID,
                requestBody: {
                    valueInputOption: 'USER_ENTERED',
                    data: updateRequests
                }
            });
        }

        return { success: true, count: shifts.length };
    } catch (error: any) {
        console.error('[Google Sheets Error] Sync:', error);
        return { success: false, error: error.message };
    }
}
