'use server';
/**
 * @fileOverview This file defines Genkit flows for text-to-speech conversion.
 *
 * - generateSilenceRequestAudio: An async function that returns audio data for a predefined silence request message.
 * - generateTurnCallAudio: An async function that generates audio for calling a specific turn.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import wav from 'wav';

// Helper function to convert PCM audio buffer to WAV format (Base64)
async function toWav(
  pcmData: Buffer,
  channels = 1,
  rate = 24000,
  sampleWidth = 2
): Promise<string> {
  return new Promise((resolve, reject) => {
    const writer = new wav.Writer({
      channels,
      sampleRate: rate,
      bitDepth: sampleWidth * 8,
    });

    const bufs: any[] = [];
    writer.on('error', reject);
    writer.on('data', function (d) {
      bufs.push(d);
    });
    writer.on('end', function () {
      resolve(Buffer.concat(bufs).toString('base64'));
    });

    writer.write(pcmData);
    writer.end();
  });
}

// Generic output schema for TTS flows
const TtsOutputSchema = z.object({
  audioDataUri: z.string().describe("The generated audio as a data URI in WAV format."),
});
export type TtsOutput = z.infer<typeof TtsOutputSchema>;


// --- Flow for Silence Request ---
const silenceRequestFlow = ai.defineFlow(
  {
    name: 'silenceRequestFlow',
    inputSchema: z.void(),
    outputSchema: TtsOutputSchema,
  },
  async () => {
    const text = "Atención, por favor. Para poder escuchar el llamado de los turnos, les solicitamos amablemente modular el tono de voz y poner sus dispositivos móviles en silencio. Agradecemos su colaboración.";
    const { media } = await ai.generate({
      model: 'googleai/gemini-2.5-flash-preview-tts',
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'algenib' }, 
          },
        },
      },
      prompt: text,
    });

    if (!media) {
      throw new Error("No se pudo generar el audio.");
    }
    
    const audioBuffer = Buffer.from(
      media.url.substring(media.url.indexOf(',') + 1),
      'base64'
    );
    
    const wavBase64 = await toWav(audioBuffer);
    
    return {
      audioDataUri: 'data:audio/wav;base64,' + wavBase64,
    };
  }
);

export async function generateSilenceRequestAudio(): Promise<TtsOutput> {
  return silenceRequestFlow();
}

// --- Flow for Turn Calling ---
const TurnCallInputSchema = z.object({
    turnDisplay: z.string().describe("El número de turno a llamar, ej. 'T01'."),
    modalityName: z.string().describe("El nombre de la modalidad a la que se debe dirigir el paciente, ej. 'Tomografía'.")
});
export type TurnCallInput = z.infer<typeof TurnCallInputSchema>;

const turnCallFlow = ai.defineFlow(
  {
    name: 'turnCallFlow',
    inputSchema: TurnCallInputSchema,
    outputSchema: TtsOutputSchema,
  },
  async ({ turnDisplay, modalityName }) => {
    // Spell out the turn number for clearer pronunciation, e.g., T01 -> T-cero-uno
    const spelledOutTurn = turnDisplay.split('').join('-');

    const text = `Paciente con turno ${spelledOutTurn}, por favor dirigirse a ${modalityName}.`;
    
    const { media } = await ai.generate({
      model: 'googleai/gemini-2.5-flash-preview-tts',
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'algenib' }, 
          },
        },
      },
      prompt: text,
    });

    if (!media) {
      throw new Error("No se pudo generar el audio para el llamado.");
    }
    
    const audioBuffer = Buffer.from(
      media.url.substring(media.url.indexOf(',') + 1),
      'base64'
    );
    
    const wavBase64 = await toWav(audioBuffer);
    
    return {
      audioDataUri: 'data:audio/wav;base64,' + wavBase64,
    };
  }
);

export async function generateTurnCallAudio(input: TurnCallInput): Promise<TtsOutput> {
    return turnCallFlow(input);
}
