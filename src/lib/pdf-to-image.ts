/**
 * Utility to convert files to data URLs for AI extraction
 */

export async function fileToDataUri(file: File): Promise<string> {
  // For all file types (PDF, images), convert to data URL
  // Gemini API can handle PDFs directly
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Error reading file'));
  });
}
