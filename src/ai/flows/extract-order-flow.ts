

'use server';
/**
 * @fileOverview This file defines a function to extract structured data from medical orders using Gemini API.
 * Optimized with image compression for cost reduction.
 */

import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
import { ExtractOrderInputSchema, OrderDataSchema, type ExtractOrderInput, type ExtractOrderOutput } from '@/lib/schemas/extract-order-schema';
import { mapStudyToCUPS, getModalityFromCUPS } from '@/lib/cups-codes';
import sharp from 'sharp';

let genAI: GoogleGenerativeAI | undefined;
let model: GenerativeModel | undefined;
const ORDER_EXTRACTION_MODEL = process.env.GENKIT_ORDER_EXTRACTION_MODEL || 'gemini-3-flash-preview';

function getInferenceModel(): GenerativeModel {
  if (model) return model;

  const apiKey = process.env.GENKIT_GOOGLE_GENAI_API_KEY;
  if (!apiKey) {
    throw new Error('GENKIT_GOOGLE_GENAI_API_KEY environment variable is not set');
  }
  
  if (!genAI) {
    genAI = new GoogleGenerativeAI(apiKey);
  }
  
  model = genAI.getGenerativeModel({ 
    model: ORDER_EXTRACTION_MODEL,
    generationConfig: {
      temperature: 0.1,
      topP: 0.8,
      topK: 40,
    }
  }, { apiVersion: 'v1beta' });
  
  return model;
}

// System prompt - cached for cost reduction
const systemPrompt = `Extract medical order data. Return ONLY valid JSON.
Fields: patient (fullName, id, idType, entidad, birthDate, sex), studies (array of {nombre, cups, modality: RX|TAC|ECO|RMN|MAMO|CONSULTA, details}), diagnosis (code, description), service (URG|HOSP|UCI|C.EXT), orderingPhysician (name, register), orderDate, admissionNumber, referenceNumber, requiresCreatinine (boolean).

SPECIAL RULES:
- ADES: Look for "Administradora" for "entidad". "Admission No" for admissionNumber.
- eMEDICO: Look for "Afiliación" or "Programa" for "entidad". "No. OSS" for admissionNumber.
- Modalidad: Must be RX, TAC, ECO, RMN, MAMO or CONSULTA (uppercase).
- Service: Identify if order is for Urgencias (URG), Hospitalización (HOSP), UCI (UCI) or Consulta Externa (C.EXT).
- requiresCreatinine: Establecer en true SOLO si el estudio menciona explícitamente "CONTRASTADO", "CONTRASTE", "IV" o "CON CONTRASTE". Si no se menciona explícitamente, DEBE ser false.
- Llena todos los campos. Usa llaves en inglés para el JSON.`;

/**
 * Compress image to reduce token usage
 * Reduces file size by 50-70% while maintaining OCR quality
 */
async function compressImage(base64Data: string, mimeType: string): Promise<{ data: string; mimeType: string }> {
  try {
    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Determine image format
    let format: 'jpeg' | 'png' | 'webp' = 'jpeg';
    if (mimeType.includes('png')) format = 'png';
    if (mimeType.includes('webp')) format = 'webp';
    if (mimeType.includes('pdf')) {
      // For PDFs, return as-is (Gemini handles PDFs natively)
      return { data: base64Data, mimeType };
    }

    // Compress using sharp
    const compressed = await sharp(buffer)
      .resize(1024, 1024, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .toFormat(format, { quality: 80, progressive: true })
      .toBuffer();

    const compressedBase64 = compressed.toString('base64');
    console.log(`[Compression] Original: ${Math.round(buffer.length / 1024)}KB → Compressed: ${Math.round(compressed.length / 1024)}KB`);
    
    return {
      data: compressedBase64,
      mimeType: `image/${format}`
    };
  } catch (error) {
    console.warn('[Compression Failed] Using original image:', error);
    return { data: base64Data, mimeType };
  }
}

export async function extractOrderData(input: ExtractOrderInput): Promise<ExtractOrderOutput> {
  try {
    // Extract MIME type and base64 data
    const mimeMatch = input.medicalOrderDataUri.match(/data:([^;]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/pdf';
    
    const base64Match = input.medicalOrderDataUri.match(/base64,(.+)/);
    const base64Data = base64Match ? base64Match[1] : '';

    if (!base64Data) {
      throw new Error('Invalid data URI format');
    }

    // Compress image to reduce token usage (Option 2)
    const { data: compressedBase64, mimeType: compressedMimeType } = await compressImage(base64Data, mimeType);

    // Call Gemini API with compression (Option 2)
    const inferenceModel = getInferenceModel();
    const response = await inferenceModel.generateContent([
      systemPrompt,
      {
        inlineData: {
          mimeType: compressedMimeType as any,
          data: compressedBase64,
        },
      },
      `Extract and return the JSON data from this medical order. System Context: ${input.orderType || 'GENERAL'}`
    ]);

    const responseText = response.response.text();
    
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = responseText.trim();
    
    // Remove markdown code blocks if present
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    
    // Parse JSON
    let output = JSON.parse(jsonStr);
    
    // Ensure diagnosis is an object, not an array
    if (Array.isArray(output.diagnosis)) {
      output.diagnosis = output.diagnosis[0] || { code: 'Unknown', description: 'Unknown diagnosis' };
    }
    
    // Ensure studies is an array
    if (!Array.isArray(output.studies)) {
      output.studies = output.studies ? [output.studies] : [];
    }
    
    // Fix null/missing values in studies
    output.studies = output.studies.map((study: any) => {
      // Map study description to CUPS code if not provided
      const cups = study.cups || mapStudyToCUPS(study.nombre);
      const modality = study.modality || getModalityFromCUPS(cups);
      
      return {
        nombre: study.nombre || 'Study',
        cups: cups || '0',
        modality: modality.toUpperCase(),
        details: study.details || ''
      };
    });
    
    // Provide defaults for missing required fields
    if (!output.patient) {
      output.patient = {
        fullName: 'Unknown Patient',
        id: 'Unknown',
        entidad: 'Unknown'
      };
    } else {
      // Fix null values in patient
      output.patient = {
        fullName: output.patient.fullName || 'Unknown',
        id: output.patient.id || 'Unknown',
        idType: output.patient.idType || undefined,
        entidad: output.patient.entidad || 'Unknown',
        birthDate: output.patient.birthDate || undefined,
        sex: output.patient.sex || undefined
      };
    }
    
    if (!output.diagnosis) {
      output.diagnosis = {
        code: 'Unknown',
        description: 'Unknown diagnosis'
      };
    }
    
    // Ensure all optional fields have defaults
    if (!output.orderDate) output.orderDate = undefined;
    if (!output.admissionNumber) output.admissionNumber = undefined;
    if (!output.referenceNumber) output.referenceNumber = undefined;
    if (!output.requiresCreatinine) output.requiresCreatinine = false;
    
    // Normalize service to the expected enum values
    if (output.service) {
      const s = output.service.toString().toUpperCase();
      if (s.includes('URG')) output.service = 'URG';
      else if (s.includes('HOSP')) output.service = 'HOSP';
      else if (s.includes('UCI')) output.service = 'UCI';
      else if (s.includes('EXT') || s.includes('CONSULTA')) output.service = 'C.EXT';
      else output.service = undefined; // Fallback for invalid values
    } else {
      output.service = undefined; // Handle null/empty
    }
    
    // Validate output against schema
    const validatedOutput = OrderDataSchema.parse(output);
    
    return validatedOutput;
  } catch (error: any) {
    console.error('[Extract Order Error]', error.message);
    throw new Error(error.message || 'Error al extraer datos de la orden. Por favor, intenta de nuevo.');
  }
}




