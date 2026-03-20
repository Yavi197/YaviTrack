'use server';
/**
 * @fileOverview This file defines a Genkit flow to extract structured data about medical consultations from orders.
 * Supports both ADES and eMEDICO order systems with specialized prompts.
 *
 * - extractConsultationData - An async function that takes a medical order and optional orderType, returns structured consultation data.
 */

import {ai} from '@/ai/genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { ExtractOrderInputSchema, OrderDataSchema, type ExtractOrderInput, type ExtractOrderOutput } from '@/lib/schemas/extract-order-schema';

type OrderType = 'ADES' | 'EMEDICO';

export async function extractConsultationData(input: ExtractOrderInput): Promise<ExtractOrderOutput> {
  const orderType = input.orderType || 'ADES';
  
  if (orderType === 'EMEDICO') {
    return extractConsultationFlowEMedico(input);
  }
  return extractConsultationFlowAdes(input);
}

// ADES Specialized Prompt
const promptAdes = ai.definePrompt({
  name: 'extractConsultationPromptAdes',
  input: {schema: ExtractOrderInputSchema},
  output: {schema: OrderDataSchema},
  model: googleAI.model('gemini-2.5-flash'),
  prompt: `Analiza esta ORDEN ADES y extrae la información en JSON.

CAMPOS PRINCIPALES ADES:
- "Administradora": Nombre de la aseguradora/EPS
- "Admission No" o "Número de Admisión": Identificador de la orden
- "Documento" o "Cédula": ID del paciente (ej. 1234567890)
- "CUPS": Código de servicio (formato 5-6 dígitos, ej. 410000, 430000)

PASOS DE EXTRACCION:
1. Paciente: fullName (busca "Nombres" o "Paciente"), id (número de documento), idType (CC, TI, etc.), entidad ("Administradora"), birthDate, sex
2. Médico: name y register (número de colegiado)
3. Orden: orderDate (formato DD/MM/AAAA), admissionNumber ("Admission No" o similar)
4. Servicios: TODOS los que aparezcan con sus CUPS códigos
5. Diagnóstico: code (CIE-10) y description
6. service: Identify if order is for Urgencias (URG), Hospitalización (HOSP), UCI (UCI) or Consulta Externa (C.EXT).
7. requiresCreatinine: true SOLO si el estudio menciona explícitamente "CONTRASTADO", "CONTRASTE", "IV" o "CON CONTRASTE". De lo contrario, DEBE ser false.

MUY IMPORTANTE:
- En ADES, busca "Administradora" NO "Afiliación"
- El número de orden está en "Admission No", no en "No. OSS"
- Los códigos son CUPS (5-6 dígitos)
- Modalidad debe estar en MAYUSCULAS SIN TILDES: RX, TAC, ECO, RMN, MAMO, CONSULTA

Medical Order: {{media url=medicalOrderDataUri}}

Return valid JSON only.
`,
});

// eMEDICO Specialized Prompt
const promptEmedico = ai.definePrompt({
  name: 'extractConsultationPromptEmedico',
  input: {schema: ExtractOrderInputSchema},
  output: {schema: OrderDataSchema},
  model: googleAI.model('gemini-2.5-flash'),
  prompt: `Analiza esta ORDEN eMEDICO y extrae la información en JSON.

CAMPOS PRINCIPALES eMEDICO:
- "Afiliación" o "Programa": Sistema/programa del paciente (ej. "SOAT", "POS", etc.)
- "No. OSS" o "Número OSS": Identificador de la orden
- "Documento" o "ID": Identificación del paciente (ej. 1234567890)
- "SOAT": Código de tarifa SOAT (formato diferente a CUPS)

PASOS DE EXTRACCION:
1. Paciente: fullName (busca "Nombres" o "Afiliado"), id (número de documento), idType (CC, TI, etc.), entidad ("Afiliación"/"Programa"), birthDate, sex
2. Médico: name y register (número profesional)
3. Orden: orderDate (formato DD/MM/AAAA), admissionNumber ("No. OSS" o similar)
4. Servicios: TODOS los que aparezcan con sus códigos SOAT
5. Diagnóstico: code (CIE-10) y description
6. service: Identify if order is for Urgencias (URG), Hospitalización (HOSP), UCI (UCI) or Consulta Externa (C.EXT).
7. requiresCreatinine: true SOLO si el estudio menciona explícitamente "CONTRASTADO", "CONTRASTE", "IV" o "CON CONTRASTE". De lo contrario, DEBE ser false.

MUY IMPORTANTE:
- En eMEDICO, busca "Afiliación" o "Programa", NO "Administradora"
- El número de orden está en "No. OSS" o "Número OSS", no en "Admission No"
- Los códigos son SOAT (diferentes a CUPS), mantén el formato original
- Modalidad debe estar en MAYUSCULAS SIN TILDES: RX, TAC, ECO, RMN, MAMO, CONSULTA

Medical Order: {{media url=medicalOrderDataUri}}

Return valid JSON only.
`,
});

const normalizeString = (str: string) => {
    if (!str) return '';
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
};

const extractConsultationFlowAdes = ai.defineFlow(
  {
    name: 'extractConsultationFlowAdes',
    inputSchema: ExtractOrderInputSchema,
    outputSchema: OrderDataSchema,
  },
  async (input) => {
    const { output } = await promptAdes(input);
    if (!output) {
      throw new Error('El modelo de IA no pudo generar un resultado válido. Verifica que la orden ADES sea clara.');
    }
    // Ensure modality is uppercase and normalized
    if (output.studies) {
      output.studies.forEach(study => {
        if (study.modality) {
          study.modality = normalizeString(study.modality);
        }
      });
    }
    return output;
  }
);

const extractConsultationFlowEMedico = ai.defineFlow(
  {
    name: 'extractConsultationFlowEmedico',
    inputSchema: ExtractOrderInputSchema,
    outputSchema: OrderDataSchema,
  },
  async (input) => {
    const { output } = await promptEmedico(input);
    if (!output) {
      throw new Error('El modelo de IA no pudo generar un resultado válido. Verifica que la orden eMEDICO sea clara.');
    }
    // Ensure modality is uppercase and normalized
    if (output.studies) {
      output.studies.forEach(study => {
        if (study.modality) {
          study.modality = normalizeString(study.modality);
        }
      });
    }
    return output;
  }
);
