
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

// Ensure API key is available
if (!process.env.GENKIT_GOOGLE_GENAI_API_KEY) {
  console.warn('[Genkit Warning] GENKIT_GOOGLE_GENAI_API_KEY not set. AI features will not work.');
}

export const ai = genkit({
  plugins: [
    googleAI({
      apiVersion: 'v1',
      apiKey: process.env.GENKIT_GOOGLE_GENAI_API_KEY,
    }),
  ],
});
