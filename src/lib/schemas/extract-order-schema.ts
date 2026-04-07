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
    fullName: z.string().describe("Nombre completo del paciente (ADES: 'Paciente', eMEDICO: 'Nombre')."),
    id: z.string().describe("Número de identificación del paciente (Solo dígitos)."),
    idType: z.string().optional().describe("Tipo de documento (CC, TI, RC)."),
    entidad: z.string().describe("Aseguradora (ADES: 'Administradora', eMEDICO: 'Afiliación' o 'Programa')."),
    birthDate: z.string().optional().describe("Fecha de nacimiento (DD/MM/AAAA)."),
    sex: z.string().optional().describe("Sexo (M/F).")
  }),
  orderingPhysician: z.object({
    name: z.string().nullable().describe("Médico tratante."),
    register: z.string().nullable().describe("Registro médico."),
  }).nullable().optional(),
  studies: z.array(
    z.object({
      nombre: z.string().describe("Nombre del estudio o servicio solicitado."),
      cups: z.string().describe("Código CUPS o SOAT del estudio."),
      modality: z.string().describe("Modalidad (RX, TAC, ECO, RMN, MAMO, CONSULTA)."),
      details: z.string().optional().describe("Observaciones del estudio.")
    })
  ),
  diagnosis: z.object({
    code: z.string().describe("Código CIE-10."),
    description: z.string().describe("Descripción del diagnóstico.")
  }),
  service: z.enum(['URG', 'HOSP', 'UCI', 'C.EXT']).optional().describe("Servicio: URGENCIAS=URG, HOSPITALIZACIÓN=HOSP, UCI=UCI, CONSULTA EXTERNA=C.EXT."),
  subService: z.string().optional().describe("Subservicio o área específica."),
  bedNumber: z.string().optional().describe("Número de cama si aplica."),
  orderDate: z.string().optional().describe("Fecha de la orden (DD/MM/AAAA)."),
  admissionNumber: z.string().optional().describe("Número de admisión (ADES: 'Admission No', eMEDICO: 'No. OSS')."),
  referenceNumber: z.string().optional().describe("Referencia/Ref de la orden."),
  requiresCreatinine: z.boolean().optional().describe("True solo si menciona CONTRASTE, IV o CONTRASTADO."),
  bajoSedacion: z.boolean().optional().describe("True si menciona SEDACIÓN."),
});

export type ExtractOrderInput = z.infer<typeof ExtractOrderInputSchema>;
export type ExtractOrderOutput = z.infer<typeof OrderDataSchema>;
