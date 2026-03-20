
'use server';
/**
 * @fileOverview This file defines a Genkit flow to extract raw text from a PDF document.
 *
 * - extractReportText: An async function that takes a PDF and returns its text content.
 */

import {ai} from '@/ai/genkit';
import {z} from 'zod';
import { googleAI } from '@genkit-ai/google-genai';

const ExtractReportTextInputSchema = z.object({
  reportDataUri: z
    .string()
    .describe(
      "A PDF document as a data URI. Expected format: 'data:application/pdf;base64,<encoded_data>'."
    ),
});
export type ExtractReportTextInput = z.infer<typeof ExtractReportTextInputSchema>;

const ExtractReportTextOutputSchema = z.object({
  reportText: z.string().describe("The full text content extracted from the PDF document."),
});
export type ExtractReportTextOutput = z.infer<typeof ExtractReportTextOutputSchema>;


export async function extractReportText(input: ExtractReportTextInput): Promise<ExtractReportTextOutput> {
  return extractReportTextFlow(input);
}

const prompt = ai.definePrompt({
  name: 'extractReportTextPrompt',
  input: {schema: ExtractReportTextInputSchema},
  output: {schema: ExtractReportTextOutputSchema},
  model: googleAI.model('gemini-2.0-flash-lite-001'),
  prompt: `Extract all text from the provided document.

Document: {{media url=reportDataUri}}

Return the full extracted text.
`,
});

const extractReportTextFlow = ai.defineFlow(
  {
    name: 'extractReportTextFlow',
    inputSchema: ExtractReportTextInputSchema,
    outputSchema: ExtractReportTextOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error('El modelo de IA no pudo extraer el texto del documento.');
    }
    return output;
  }
);
