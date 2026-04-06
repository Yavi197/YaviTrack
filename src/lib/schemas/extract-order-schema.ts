/**
 * @fileOverview Schemas for extracting data from medical orders.
 *
 * - OrderDataSchema: Zod schema for the structured data extracted from a medical order.
 * - ExtractOrderInputSchema: Zod schema for the input to the extraction flow.
 * - OrderData: TypeScript type for the order data.
 * - ExtractOrderInput: TypeScript type for the extraction flow input.
 */
import { z } from 'zod';

export const ExtractOrderInputSchema = z.object({
  medicalOrderDataUri: z
    .string()
    .describe(
      "A medical order document (image or PDF) as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  orderType: z.enum(['ADES', 'EMEDICO']).optional().describe("Type of medical order system: ADES or eMEDICO"),
});

export const OrderDataSchema = z.object({
  patient: z.object({
    fullName: z.string().describe("Nombre completo del paciente, incluyendo apellidos."),
    id: z.string().describe("Número de identificación del paciente (cédula, tarjeta de identidad, etc.)."),
    idType: z.string().optional().describe("Tipo de documento de identificación (ej. CC, TI, RC)."),
    entidad: z.string().describe("Nombre de la aseguradora o EPS del paciente."),
    birthDate: z.string().optional().describe("Fecha de nacimiento del paciente si está disponible."),
    sex: z.string().optional().describe("Sexo del paciente si está disponible (M o F).")
  }),
  orderingPhysician: z.object({
    name: z.string().nullable().describe("Nombre completo del médico que solicita el estudio."),
    register: z.string().nullable().describe("Número de registro médico del profesional que solicita."),
  }).nullable().optional().describe("Información del médico que ordena el estudio. Extraer si está disponible en la orden."),
  studies: z.array(
    z.object({
      nombre: z.string().describe("Nombre descriptivo completo del estudio solicitado."),
      cups: z.string().describe("Código CUPS del estudio. Si no está explícito, infiérelo del nombre."),
      modality: z.string().describe("Modalidad principal del estudio (TAC, RX, ECO, RMN)."),
      details: z.string().optional().describe("Cualquier detalle adicional o especificación sobre el estudio.")
    })
  ).describe("Una lista COMPLETA de todos los estudios de imagen o consultas solicitados en la orden."),
  diagnosis: z.object({
    code: z.string().describe("Código del diagnóstico (ej. CIE-10) si está presente."),
    description: z.string().describe("Descripción textual del diagnóstico o la razón clínica del estudio.")
  }),
  service: z.enum(['URG', 'HOSP', 'UCI', 'C.EXT']).optional().describe("Servicio de origen del paciente (URGENCIAS, HOSPITALIZACIÓN, UCI, C. EXTERNA)."),
  subService: z.string().optional().describe("Subservicio o área específica dentro del servicio."),
  bedNumber: z.string().optional().describe("Número de cama si el paciente está hospitalizado."),
  orderDate: z.string().optional().describe("Fecha en que se emitió la orden médica, si está disponible en la orden. Formato DD/MM/AAAA."),
  admissionNumber: z.string().optional().describe("Número de admisión o atención del paciente, si está disponible en la orden."),
  referenceNumber: z.string().optional().describe("Número de referencia o 'Ref' de la orden, si está disponible."),
  requiresCreatinine: z.boolean().optional().describe("Set to true if any study details indicate IV contrast is needed."),
  bajoSedacion: z.boolean().optional().describe("Set to true if the study requires sedation."),
});

export type ExtractOrderInput = z.infer<typeof ExtractOrderInputSchema>;
export type ExtractOrderOutput = z.infer<typeof OrderDataSchema>;
