
'use server';

import { GenerativeModel, GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { ExtractOrderInputSchema, OrderDataSchema, type ExtractOrderInput, type ExtractOrderOutput } from '@/lib/schemas/extract-order-schema';
import { mapStudyToCUPS, getModalityFromCUPS } from '@/lib/cups-codes';
import sharp from 'sharp';

let genAI: GoogleGenerativeAI | undefined;
let model: GenerativeModel | undefined;
const ORDER_EXTRACTION_MODEL = 'gemini-2.5-flash';

// Native Gemini Schema for maximum reliability
const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    patient: {
      type: SchemaType.OBJECT,
      properties: {
        fullName: { type: SchemaType.STRING },
        id: { type: SchemaType.STRING },
        idType: { type: SchemaType.STRING },
        entidad: { type: SchemaType.STRING },
        birthDate: { type: SchemaType.STRING },
        sex: { type: SchemaType.STRING },
      },
      required: ['fullName', 'id', 'entidad'],
    },
    orderingPhysician: {
      type: SchemaType.OBJECT,
      properties: {
        name: { type: SchemaType.STRING },
        register: { type: SchemaType.STRING },
      },
    },
    studies: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          nombre: { type: SchemaType.STRING },
          cups: { type: SchemaType.STRING },
          modality: { type: SchemaType.STRING },
          details: { type: SchemaType.STRING },
        },
        required: ['nombre', 'cups', 'modality'],
      },
    },
    diagnosis: {
      type: SchemaType.OBJECT,
      properties: {
        code: { type: SchemaType.STRING },
        description: { type: SchemaType.STRING },
      },
      required: ['code', 'description'],
    },
    service: { type: SchemaType.STRING },
    subService: { type: SchemaType.STRING },
    bedNumber: { type: SchemaType.STRING },
    orderDate: { type: SchemaType.STRING },
    admissionNumber: { type: SchemaType.STRING },
    requiresCreatinine: { type: SchemaType.BOOLEAN },
    bajoSedacion: { type: SchemaType.BOOLEAN },
  },
  required: ['patient', 'studies', 'diagnosis'],
};

function getInferenceModel(): GenerativeModel {
  if (model) return model;
  const apiKey = process.env.GENKIT_GOOGLE_GENAI_API_KEY;
  if (!apiKey) throw new Error('GENKIT_GOOGLE_GENAI_API_KEY not set');
  if (!genAI) genAI = new GoogleGenerativeAI(apiKey);
  
  model = genAI.getGenerativeModel({ 
    model: ORDER_EXTRACTION_MODEL,
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: responseSchema as any,
    }
  }, { apiVersion: 'v1beta' });
  
  return model;
}

const systemPrompt = `Extract medical order data into the provided JSON schema.
- ADES: "Administradora" -> entidad, "Admission No" -> admissionNumber. "Procedimientos" -> studies.
- eMEDICO: "Afiliación/Programa" -> entidad, "No. OSS" -> admissionNumber. "Servicios" -> studies.
- Modalidad MUST be one of: RX, TAC, ECO, RMN, MAMO, CONSULTA.
- Identify service (URG, HOSP, UCI, C.EXT).
- requiresCreatinine: true only if "CONTRASTE", "IV" or "CONTRASTADO" is present.
- bajoSedacion: true if "SEDACION" is mentioned.`;

async function compressImage(base64Data: string, mimeType: string): Promise<{ data: string; mimeType: string }> {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    let format: 'jpeg' | 'png' | 'webp' = 'jpeg';
    if (mimeType.includes('png')) format = 'png';
    if (mimeType.includes('webp')) format = 'webp';
    if (mimeType.includes('pdf')) return { data: base64Data, mimeType };

    const compressed = await sharp(buffer)
      .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
      .toFormat(format, { quality: 80 })
      .toBuffer();

    return { data: compressed.toString('base64'), mimeType: `image/${format}` };
  } catch (error) {
    return { data: base64Data, mimeType };
  }
}

export async function extractOrderData(input: ExtractOrderInput): Promise<ExtractOrderOutput> {
  try {
    const mimeMatch = input.medicalOrderDataUri.match(/data:([^;]+)/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'application/pdf';
    const base64Data = input.medicalOrderDataUri.split(',')[1] || '';

    if (!base64Data) throw new Error('Invalid data URI');

    const { data: compressedBase64, mimeType: compressedMimeType } = await compressImage(base64Data, mimeType);

    const inferenceModel = getInferenceModel();
    const response = await inferenceModel.generateContent([
      systemPrompt,
      { inlineData: { mimeType: compressedMimeType as any, data: compressedBase64 } },
      `Extract data from ${input.orderType || 'GENERAL'} order.`
    ]);

    const output = JSON.parse(response.response.text());

    // Final normalization to ensure enums match exactly
    if (output.studies) {
      output.studies = output.studies.map((s: any) => ({
        ...s,
        modality: (s.modality || 'RX').toUpperCase().replace('T.A.C', 'TAC').replace('RADIO', 'RX'),
        cups: s.cups || mapStudyToCUPS(s.nombre) || '0'
      }));
    }

    if (output.service) {
      const s = output.service.toUpperCase();
      if (s.includes('URG')) output.service = 'URG';
      else if (s.includes('HOSP')) output.service = 'HOSP';
      else if (s.includes('UCI')) output.service = 'UCI';
      else output.service = 'C.EXT';
    }

    return OrderDataSchema.parse(output);
  } catch (error: any) {
    console.error('[Extract Order Error]', error.message);
    throw new Error('Error al extraer datos. Verifica que la imagen sea legible.');
  }
}




