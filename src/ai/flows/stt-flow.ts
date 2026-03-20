
'use server';
/**
 * @fileOverview This file defines a Genkit flow for speech-to-text transcription.
 *
 * - transcribeAudio: An async function that takes an audio file and returns its text transcription and token usage.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';

const TranscribeInputSchema = z.object({
  audioDataUri: z
    .string()
    .describe(
      "An audio file as a data URI. Expected format: 'data:audio/webm;codecs=opus;base64,<encoded_data>'."
    ),
});
export type TranscribeInput = z.infer<typeof TranscribeInputSchema>;

const TranscribeOutputSchema = z.object({
  text: z.string().describe("The transcribed text from the audio."),
  inputTokens: z.number().optional().describe("Number of tokens used in the input."),
  outputTokens: z.number().optional().describe("Number of tokens generated in the output."),
});
export type TranscribeOutput = z.infer<typeof TranscribeOutputSchema>;


export async function transcribeAudio(input: TranscribeInput): Promise<TranscribeOutput> {
  return transcribeAudioFlow(input);
}

const prompt = ai.definePrompt(
  {
    name: 'transcribeAudioPrompt',
    input: { schema: TranscribeInputSchema },
    output: { schema: z.object({ text: z.string() }) }, // The model itself only needs to output text
    model: googleAI.model('gemini-2.5-flash'), // Updated to the correct model
    prompt: `Transcribe el siguiente audio. El audio es un dictado de un informe radiológico en español. Asegúrate de que la transcripción sea precisa, incluyendo terminología médica.

Audio: {{media url=audioDataUri}}
`,
  },
);

const transcribeAudioFlow = ai.defineFlow(
  {
    name: 'transcribeAudioFlow',
    inputSchema: TranscribeInputSchema,
    outputSchema: TranscribeOutputSchema,
  },
  async (input) => {
    const response = await prompt(input);
    const output = response.output;
    const usage = response.usage;

    if (!output) {
      throw new Error('El modelo de IA no pudo transcribir el audio.');
    }
    
    return {
      text: output.text,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
    };
  }
);
