/**
 * @fileOverview PDF text extraction and parsing for medical orders
 * Supports 2 layouts: General (ADRES) and Transit (SOAT)
 * Note: PDF extraction happens in /api/extract-pdf route to avoid Next.js issues
 */

/**
 * Detect which layout template (General or Transit/SOAT)
 */
export function detectLayout(text: string): 'general' | 'transito' {
  const lowerText = text.toLowerCase();
  
  // Check for SOAT or transit keywords
  if (
    lowerText.includes('soat') ||
    lowerText.includes('tránsito') ||
    lowerText.includes('transito') ||
    lowerText.includes('accidente de tránsito') ||
    lowerText.includes('adres soat')
  ) {
    return 'transito';
  }
  
  return 'general';
}

/**
 * Extract field using regex with multiple patterns
 */
function extractField(text: string, patterns: RegExp[]): string {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return '';
}

/**
 * Parse General (ADRES) template
 * Fields: nombre, documento, fechaNacimiento, edad, entidad, noAdmision,
 *         fechaOrden, cups, nombreEstudio, observacion, cie10, diagnostico,
 *         noGresito, nombreEspecialista
 */
export function parseGeneralForm(text: string): Partial<any> {
  // Nombre del paciente
  const nombre = extractField(text, [
    /(?:paciente|nombre)[\s:]*([A-ZÀ-ÿ\s]{3,}?)(?:\n|$)/i,
    /^([A-ZÀ-ÿ\s]{3,}?)[\s]*(?:id|documento|cc|cedula)/im,
  ]);

  // Documento
  const documento = extractField(text, [
    /(?:documento|id|cedula|cc)[\s:]*([0-9]{5,})/i,
    /(?:cc|cedula)[\s:]*(\d{5,})/i,
  ]);

  // Fecha de nacimiento
  const fechaNacimiento = extractField(text, [
    /(?:nacimiento|fecha.*nac|dob)[\s:]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
  ]);

  // Edad
  const edad = extractField(text, [
    /(?:edad|age)[\s:]*(\d{1,3})\s*(?:años|years|a)/i,
  ]);

  // Entidad (EPS/ARL)
  const entidad = extractField(text, [
    /(?:entidad|eps|arl)[\s:]*([A-ZÀ-ÿ\s0-9]{2,}?)(?:\n|$)/i,
  ]);

  // No. Admisión
  const noAdmision = extractField(text, [
    /(?:admisión|admision|admission)[\s:]*([0-9]{4,})/i,
    /(?:no\.?\s*admisión)[\s:]*([0-9]{4,})/i,
  ]);

  // Fecha de orden
  const fechaOrden = extractField(text, [
    /(?:fecha.*orden|order date|fecha)[\s:]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
  ]);

  // CUPS
  const cups = extractField(text, [
    /(?:cups|code)[\s:]*([0-9]{5,})/i,
  ]);

  // Nombre del estudio
  const nombreEstudio = extractField(text, [
    /(?:estudio|study|examen)[\s:]*([A-ZÀ-ÿ0-9\s]{3,}?)(?:\n|$)/i,
  ]);

  // Observación
  const observacion = extractField(text, [
    /(?:observación|observacion|notes)[\s:]*([^\n]{3,}?)(?:\n|$)/i,
  ]);

  // CIE-10
  const cie10 = extractField(text, [
    /(?:cie[\s\-]?10|icd[\s\-]?10)[\s:]*([A-Z0-9]{3,})/i,
  ]);

  // Diagnóstico
  const diagnostico = extractField(text, [
    /(?:diagnóstico|diagnostico|diagnosis)[\s:]*([A-ZÀ-ÿ0-9\s]{3,}?)(?:\n|$)/i,
  ]);

  // No. Gresito
  const noGresito = extractField(text, [
    /(?:gresito|greso)[\s:]*([0-9]{4,})/i,
  ]);

  // Nombre especialista
  const nombreEspecialista = extractField(text, [
    /(?:especialista|physician|doctor)[\s:]*([A-ZÀ-ÿ\s]{3,}?)(?:\n|$)/i,
  ]);

  return {
    nombre,
    documento,
    fechaNacimiento,
    edad,
    entidad,
    noAdmision,
    fechaOrden,
    cups,
    nombreEstudio,
    observacion,
    cie10,
    diagnostico,
    noGresito,
    nombreEspecialista,
  };
}

/**
 * Parse Transit/SOAT template
 * Similar fields but specific to accident reports
 */
export function parseTransitoForm(text: string): Partial<any> {
  // For SOAT/Transit, most fields are similar to general form
  // but we might have additional accident-specific fields
  const base = parseGeneralForm(text);

  // Add transit-specific fields
  const noPoliza = extractField(text, [
    /(?:poliza|póliza|policy)[\s:]*([0-9]{4,})/i,
  ]);

  const aseguradora = extractField(text, [
    /(?:aseguradora|insurance)[\s:]*([A-ZÀ-ÿ\s0-9]{2,}?)(?:\n|$)/i,
  ]);

  return {
    ...base,
    noPoliza,
    aseguradora,
  };
}

/**
 * Main function to parse PDF text based on layout detection
 */
export function parsePDFText(text: string): Partial<any> {
  const layout = detectLayout(text);
  
  console.log(`[PDF Parser] Detected layout: ${layout}`);

  if (layout === 'transito') {
    return parseTransitoForm(text);
  }

  return parseGeneralForm(text);
}
