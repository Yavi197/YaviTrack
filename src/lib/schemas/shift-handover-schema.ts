import { z } from 'zod';

// Equipment status types
export const EquipmentStatus = z.enum(['B', 'R', 'M']); // Bueno, Regular, Malo
export type EquipmentStatus = z.infer<typeof EquipmentStatus>;

// Equipment checklist
export const EquipmentChecklistSchema = z.object({
  rayosXFijo: EquipmentStatus,
  rayosXPortatil: EquipmentStatus,
  arcoCinematico: EquipmentStatus,
  computadores: EquipmentStatus,
  monitores: EquipmentStatus,
  puestoTrabajo: EquipmentStatus,
});
export type EquipmentChecklist = z.infer<typeof EquipmentChecklistSchema>;

// Plate inventory
export const PlateInventorySchema = z.object({
  chasis14x17: z.number().int().min(0),
  chasis10x14: z.number().int().min(0),
  chasis10x12: z.number().int().min(0),
  chasis8x10: z.number().int().min(0),
});
export type PlateInventory = z.infer<typeof PlateInventorySchema>;

// Pending studies item
export const PendingStudySchema = z.object({
  id: z.string().optional(),
  servicio: z.string().min(1, "Servicio requerido"),
  cantidad: z.number().int().min(1, "Cantidad mínima 1"),
  motivo: z.string().min(1, "Motivo requerido"),
});
export type PendingStudy = z.infer<typeof PendingStudySchema>;

// Shift type
export const ShiftType = z.enum(['morning', 'evening']); // 7 AM or 7 PM
export type ShiftType = z.infer<typeof ShiftType>;

// Main shift handover schema
export const ShiftHandoverSchema = z.object({
  // Metadata
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD format
  shift: ShiftType,
  hora: z.string().regex(/^\d{2}:\d{2}$/), // HH:MM format
  modality: z.string().optional().default('RX'),
  
  // Handover information
  handoverTechnicianId: z.string().min(1, "Técnico que entrega requerido"),
  handoverTechnicianName: z.string().min(1, "Nombre del técnico que entrega requerido"),
  
  // Equipment checklist
  equipment: EquipmentChecklistSchema,
  equipmentObservations: z.string().optional().default(""),
  
  // Plate inventory
  inventory: PlateInventorySchema,
  chasisObservations: z.string().optional().default("TODOS LOS CHASIS LIMPIOS, COMPLETOS Y FUNCIONALES"),
  
  // Pending studies
  tieneEstudiosPendientes: z.boolean(),
  estudiosPendientes: z.array(PendingStudySchema).optional().default([]),
  estudiosPendientesObservations: z.string().optional().default("NO QUEDAN ESTUDIOS PENDIENTES"),
  
  // General observations/pending items
  novedades: z.string().optional().default(""),
  
  // Receipt (optional, filled by receiving technician)
  receipt: z.object({
    receivedTechnicianId: z.string().optional(),
    receivedTechnicianName: z.string().optional(),
    receivedAt: z.number().optional(), // Timestamp
    observedIssues: z.string().optional(),
    confirmed: z.boolean().optional().default(false),
  }).optional(),
  
  // System fields
  createdAt: z.number().optional(), // Timestamp
  googleSheetId: z.string().optional(),
});

export type ShiftHandover = z.infer<typeof ShiftHandoverSchema>;

// Input schema (without system fields)
export const ShiftHandoverInputSchema = ShiftHandoverSchema.omit({
  createdAt: true,
  googleSheetId: true,
});
export type ShiftHandoverInput = z.infer<typeof ShiftHandoverInputSchema>;
