"use server";

import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';

const DRIVE_PARENT_FOLDER_ID = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const DRIVE_GET_FIELDS = 'id,name,webViewLink,webContentLink';

export type DriveUploadResult = {
    id: string;
    name?: string;
    webViewLink?: string;
    webContentLink?: string;
};

export type DriveUploadOptions = {
    fileName: string;
    mimeType: string;
    data: Buffer;
    folderSegments?: string[];
    description?: string;
    makePublic?: boolean;
};

export type DriveBase64UploadOptions = Omit<DriveUploadOptions, 'data'> & {
    base64Data: string;
};

const formatPrivateKey = (key?: string) => key?.replace(/\\n/g, '\n');

async function getDriveClient(): Promise<drive_v3.Drive | null> {
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = formatPrivateKey(process.env.GOOGLE_PRIVATE_KEY);

    if (!clientEmail || !privateKey) {
        console.warn('[Google Drive Warning] Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY.');
        return null;
    }

    try {
        const auth = new google.auth.JWT({
            email: clientEmail,
            key: privateKey,
            scopes: [DRIVE_SCOPE],
        });
        await auth.getAccessToken();
        return google.drive({ version: 'v3', auth });
    } catch (error: any) {
        console.error('[Google Drive Error] Unable to initialize JWT client:', error.message);
        return null;
    }
}

const sanitizeSegment = (segment: string) =>
    segment
        .normalize('NFD')
        .replace(/[^a-zA-Z0-9\s_-]/g, '')
        .trim()
        .replace(/\s+/g, '_')
        || 'UNASSIGNED';

const assertFolderAccess = async (drive: drive_v3.Drive, folderId: string) => {
    try {
        await drive.files.get({
            fileId: folderId,
            fields: 'id,name',
            supportsAllDrives: true,
        });
    } catch (error: any) {
        throw new Error(`No se pudo acceder a la carpeta ${folderId} en Google Drive. Verifica que la unidad compartida esté compartida con la cuenta de servicio.`);
    }
};

async function ensureChildFolder(drive: drive_v3.Drive, parentId: string, segment: string): Promise<string> {
    const folderName = sanitizeSegment(segment);
    const escapedName = folderName.replace(/'/g, "\\'");
    const query = `"${parentId}" in parents and name = '${escapedName}' and mimeType = '${FOLDER_MIME_TYPE}' and trashed = false`;

    const existing = await drive.files.list({
        q: query,
        spaces: 'drive',
        fields: 'files(id,name)',
        pageSize: 1,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
    });

    const foundId = existing.data.files?.[0]?.id;
    if (foundId) {
        return foundId;
    }

    const created = await drive.files.create({
        requestBody: {
            name: folderName,
            mimeType: FOLDER_MIME_TYPE,
            parents: [parentId],
        },
        fields: 'id',
        supportsAllDrives: true,
    });

    if (!created.data.id) {
        throw new Error(`No se pudo crear la carpeta ${folderName} en Google Drive.`);
    }

    return created.data.id;
}

async function resolveTargetFolder(drive: drive_v3.Drive, folderSegments?: string[]): Promise<string> {
    if (!DRIVE_PARENT_FOLDER_ID) {
        throw new Error('GOOGLE_DRIVE_PARENT_FOLDER_ID no está definido.');
    }

    let currentParentId = DRIVE_PARENT_FOLDER_ID;
    await assertFolderAccess(drive, currentParentId);
    if (!folderSegments || folderSegments.length === 0) {
        return currentParentId;
    }

    for (const rawSegment of folderSegments) {
        if (!rawSegment) continue;
        currentParentId = await ensureChildFolder(drive, currentParentId, rawSegment);
    }

    return currentParentId;
}

const bufferToReadable = (buffer: Buffer) => {
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);
    return readable;
};

export async function uploadBufferToDrive(options: DriveUploadOptions): Promise<DriveUploadResult> {
    const drive = await getDriveClient();
    if (!drive) {
        throw new Error('No se pudo inicializar el cliente de Google Drive.');
    }

    const parentId = await resolveTargetFolder(drive, options.folderSegments);

    const requestBody: drive_v3.Schema$File = {
        name: options.fileName,
        parents: [parentId],
        description: options.description,
    };

    const media = {
        mimeType: options.mimeType || 'application/octet-stream',
        body: bufferToReadable(options.data),
    };

    const { data } = await drive.files.create({
        requestBody,
        media,
        fields: DRIVE_GET_FIELDS,
        supportsAllDrives: true,
    });

    if (!data.id) {
        throw new Error('Google Drive no devolvió un ID de archivo.');
    }

    let resolvedData = data;

    if (options.makePublic !== false) {
        await drive.permissions.create({
            fileId: data.id,
            requestBody: { role: 'reader', type: 'anyone' },
            supportsAllDrives: true,
        });

        const refreshed = await drive.files.get({
            fileId: data.id,
            fields: DRIVE_GET_FIELDS,
            supportsAllDrives: true,
        });
        resolvedData = refreshed.data;
    }

    return {
        id: data.id,
        name: resolvedData.name ?? options.fileName,
        webViewLink: resolvedData.webViewLink ?? data.webViewLink ?? undefined,
        webContentLink: resolvedData.webContentLink ?? data.webContentLink ?? undefined,
    };
}

export async function uploadBase64FileToDrive(options: DriveBase64UploadOptions): Promise<DriveUploadResult> {
    try {
        const buffer = Buffer.from(options.base64Data, 'base64');
        return await uploadBufferToDrive({ ...options, data: buffer });
    } catch (error: any) {
        console.error('[Google Drive Error] Falló la conversión o carga del archivo:', error.message);
        throw error;
    }
}
