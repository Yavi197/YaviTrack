
'use server';
/**
 * @fileOverview Refactored consultation extraction to use the same optimized 
 * Gemini 1.5 Flash workflow as imaging.
 */

import { ExtractOrderInput, ExtractOrderOutput } from '@/lib/schemas/extract-order-schema';
import { extractOrderData } from './extract-order-flow';

/**
 * Directs consultation extraction to the unified optimized flow.
 * No longer uses Genkit to reduce overhead.
 */
export async function extractConsultationData(input: ExtractOrderInput): Promise<ExtractOrderOutput> {
  // Use the same core high-speed logic but we set the prompt context
  // The systemPrompt in extract-order-flow already handles the generic extraction
  // covering both imaging and consultations.
  return extractOrderData(input);
}
