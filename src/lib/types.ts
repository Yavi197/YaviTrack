

import { type Timestamp } from "firebase/firestore";
import { type OrderDataSchema } from "./schemas/extract-order-schema";
import { z } from "zod";


export const UserRoles = ["administrador", "enfermero", "tecnologo", "transcriptora", "adminisonista"] as const;
export type UserRole = typeof UserRoles[number];

export const Modalities = ["TAC", "RX", "ECO", "MAMO", "DENSITOMETRIA", "RMN"] as const;
export type Modality = typeof Modalities[number];

export const ShiftTypes = ['CORRIDO', 'NOCHE', 'POSTURNO', 'LIBRE', 'MANANA_TARDE', 'MANANA'] as const;
export type ShiftType = typeof ShiftTypes[number];

export const CalendarModalities = ['RX', 'ECO', 'TAC'] as const;
export type CalendarModality = typeof CalendarModalities[number];
export type ShiftAssignableRole = 'tecnologo' | 'transcriptora';

export const GeneralServices = ["URG", "HOSP", "UCI", "C.EXT"] as const;
export type GeneralService = typeof GeneralServices[number];

export const SubServiceAreas: Record<GeneralService, readonly string[]> = {
    URG: ["TRIAGE", "OBSERVACION 1", "OBSERVACION 2"],
    HOSP: ["HOSPITALIZACION 2", "HOSPITALIZACION 4"],
    UCI: ["UCI 2", "UCI 3", "UCI NEO"],
    "C.EXT": ["AMB"],
};
export type SubServiceArea = typeof SubServiceAreas[keyof typeof SubServiceAreas][number];

export type OperationalStatus = 
    'Disponible' | 
    'En Cirugía' | 
    'No Disponible';

export type UserProfile = {
    uid: string;
    nombre: string;
    email: string;
    rol: UserRole;
    servicioAsignado: Modality | GeneralService | "General"; 
    subServicioAsignado?: SubServiceArea;
    activo: boolean;
    operationalStatus?: OperationalStatus;
    operadores?: string[];
    operadorActivo?: string | null;
    activeSurgerySessionId?: string | null;
    lastShiftHandoverAt?: Timestamp | number | null;
};
    
export type StudyStatus = "Pendiente" | "Completado" | "Leído" | "Cancelado" | "Anulado";

export type TechnologistShiftStatus = 'assigned' | 'swapped' | 'pending';

export type TechnologistShift = {
    id?: string;
    technologistId: string;
    date: string; // YYYY-MM-DD (zona Colombia)
    shiftType: ShiftType;
    sequenceOrder: number; // 1-4 según el ciclo Corrido-Noche-Posturno-Libre
    startTime: Timestamp | any;
    endTime: Timestamp | any;
    hours: number;
    holiday?: boolean;
    status: TechnologistShiftStatus;
    notes?: string;
    assignedUserId?: string;
    assignedUserName?: string;
    assignedRole?: ShiftAssignableRole;
    modality?: CalendarModality;
    metadata?: Record<string, string | number | boolean>;
    createdAt?: Timestamp | any;
    updatedAt?: Timestamp;
};

export type ShiftSequenceTemplate = {
    technologistId: string;
    pattern: ShiftType[]; // e.g. ['CORRIDO','NOCHE','POSTURNO','LIBRE']
    effectiveFrom: string; // YYYY-MM-DD
    initialOffset?: number; // índice 0-3 para indicar en qué punto del ciclo inicia
    overrides?: Record<string, ShiftType>; // fechas específicas -> tipo
};

export type OrderData = z.infer<typeof OrderDataSchema>;

export type ContrastType = 'IV' | 'Bario';

export type Patient = {
    fullName: string;
    id: string;
    idType?: string;
    entidad: string;
    birthDate?: string;
    sex?: string;
};

export type Study = {
    id: string;
    status: StudyStatus;
    service: GeneralService;
    subService: SubServiceArea;
    patient: Patient;
    orderingPhysician?: {
        name: string;
        register: string;
    };
    specialist?: string;
    medicalRecord?: string;
    observaciones?: string;
    observation?: string;
    observations?: string;
    studies: {
        nombre: string;
        cups: string;
        modality: string;
        details?: string;
    }[];
    diagnosis: {
        code: string;
        description: string;
    };
    orderDate?: Timestamp;
    admissionNumber?: string;
    referenceNumber?: string;
    requestDate: Timestamp;
    completionDate?: Timestamp;
    readingDate?: Timestamp;
    cancellationReason?: string;
    kV?: number;
    mA?: number;
    timeMs?: number;
    ctdi?: number;
    dlp?: number;
    contrastType?: ContrastType | null;
    creatinine?: number;
    contrastBilledMl?: number;
    contrastAdministeredMl?: number;
    contrastRemainingMl?: number;
    consumedSupplies?: ConsumedItem[];
    reportText?: string;
    reportUrl?: string;
    turnNumber?: string;
    bedNumber?: string;
    assignedSpecialistId?: string;
};

export type StudyWithCompletedBy = Study & {
    completedBy?: string;
};

export type RemissionStatus = "Pendiente" | "Pendiente Aut" | "Solicitado" | "Autorizado" | "Cupo Solicitado" | "Programado" | "Vencido" | "Realizado" | "Informado";

export type Remission = Study & {
    status: RemissionStatus;
    remissionFileUrls: {
        notaCargoUrl: string;
        ordenMedicaUrl: string;
        evolucionUrl: string;
        authorizationUrl?: string;
        recordatorioUrl?: string;
        informeUrl?: string;
    };
    requiereContraste: boolean;
    bajoSedacion: boolean;
    createdBy: {
        uid: string;
        name: string;
    };
    createdAt: Timestamp; // This should exist on Remission
    solicitadoAt?: Timestamp;
    autorizadoAt?: Timestamp;
    cupoSolicitadoAt?: Timestamp;
    programadoAt?: Timestamp;
    realizadoAt?: Timestamp;
    informadoAt?: Timestamp;
    pendienteAutAt?: Timestamp;
    appointmentDate?: Timestamp;
};


export type Message = {
    id: string;
    senderId: string;
    senderName: string;
    recipientRole: 'tecnologo' | 'transcriptora';
    content: string;
    createdAt: Timestamp;
    read: boolean;
};
    
export const InventoryCategories = ["contraste", "insumo"] as const;
export type InventoryCategory = typeof InventoryCategories[number];

export type InventoryItem = {
    id: string;
    name: string;
    category: InventoryCategory;
    presentation: 'Caja' | 'Frasco' | 'Unidad';
    content: number; // e.g., 100 (for 100 units in a box or 100ml in a vial)
    contentUnit: 'unidades' | 'ml' | 'g';
    specification?: string; // e.g., '#24', '100ml'
    stock: number; // Deprecated, but keep for now
    price?: number; // Price per presentation (e.g., cost of one box)
    isContrast?: boolean;
}

export type InventoryStockEntry = {
    id: string;
    itemId: string;
    itemName: string;
    amountAdded: number;
    presentation: InventoryItem['presentation'] | string;
    service: 'RX' | 'TAC' | 'ECO' | 'General';
    date: Timestamp;
    addedBy: {
        uid: string;
        name: string;
    };
    lote?: string;
    priceAtEntry?: number;
    unidad?: string;
    fechaVencimiento?: string;
    proveedor?: string;
    observaciones?: string;
};

export type InventoryConsumption = {
    id: string;
    studyId: string;
    itemId: string;
    itemName: string;
    amountConsumed: number; // The amount in the item's native unit (e.g., ml, units)
    consumedBy: {
        uid: string;
        name: string;
    };
    date: Timestamp;
};


export type OperationalExpense = {
    id: string;
    category: 'Sueldos' | 'Servicios' | 'Arriendo' | 'Insumos' | 'Otro';
    description: string;
    amount: number;
    date: Timestamp;
};

export type ConsumedItem = {
    id: string; // ID of the InventoryItem
    name: string; // Name of the item for billing record
    amount: number; // Amount consumed (in units or ml)
};

export type Specialist = {
    id: string;
    name: string;
    specialty: string;
    phoneNumber: string;
};

export const QualityReportTypes = [
    'Problema con un estudio',
    'Queja',
    'Sugerencia',
] as const;
export type QualityReportType = typeof QualityReportTypes[number];

export const QualityReportCategories = [
    'Calidad de imagen',
    'Estudio incompleto',
    'Estudio no realizado',
    'Atención al paciente',
    'Tiempos de espera',
] as const;
export type QualityReportCategory = typeof QualityReportCategories[number];

export const QualityReportAreas = ['RX', 'TAC', 'ECO'] as const;
export type QualityReportArea = typeof QualityReportAreas[number];

export const QualityReportInvolvedRoles = ['Tecnólogo', 'Transcriptora', 'Otro', 'N/A'] as const;
export type QualityReportInvolvedRole = typeof QualityReportInvolvedRoles[number];

export type QualityReportStatus = 'Pendiente' | 'En revisión' | 'Cerrado';

export type QualityReport = {
    id: string;
    reportType: QualityReportType;
    category: QualityReportCategory;
    modality: QualityReportArea;
    involvedRole: QualityReportInvolvedRole;
    involvedUserId?: string;
    involvedUserName?: string;
    otherPersonName?: string;
    referenceId?: string;
    patientId?: string;
    patientName?: string;
    description: string;
    status: QualityReportStatus;
    reportedBy: {
        uid: string;
        name: string;
        role: UserRole;
    };
    createdAt: Timestamp;
    updatedAt?: Timestamp;
};
