import type { StudyData } from './data';
import { CUPS_CODES } from './cups-codes';
import { GENERATED_CUPS_METADATA } from './generated/cups.generated';
import { normalizeModalityCode } from './modality-labels';

// Convert CUPS codes to StudyData format
const generateStudiesFromCUPS = (): StudyData[] => {
  const removeAccents = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const detectModalityFromCode = (rawCode: string): string => {
    if (!rawCode) return 'OTROS';

    const normalizedCode = rawCode.trim().toUpperCase();
    if (normalizedCode.startsWith('M')) {
      // Equipos móviles y códigos con prefijo M pertenecen a RX
      return 'RX';
    }

    const digitsOnly = normalizedCode.replace(/[^0-9]/g, '');
    const code = digitsOnly ? parseInt(digitsOnly, 10) : Number.NaN;

    if (Number.isNaN(code)) return 'OTROS';
    if (code >= 21701 && code <= 21723) return 'TAC';
    if (code >= 21101 && code <= 21602) return 'RX';
    if (code >= 31100 && code <= 31201) return 'ECO';
    if (code >= 31301 && code <= 31307) return 'RMN';
    if (code >= 879000 && code <= 879999) return 'TAC';
    if (code >= 870000 && code <= 877999) return 'RX';
    if (code >= 881000 && code <= 882999) return 'ECO';
    if (code >= 883000 && code <= 883999) return 'RMN';
    if (code >= 876000 && code <= 876999) return 'MG';
    if (code >= 886000 && code <= 886999) return 'DENSITO';
    return 'OTROS';
  };

  return Object.entries(CUPS_CODES).map(([cupsCode, description]) => {
    const metadata = GENERATED_CUPS_METADATA[cupsCode];
    const resolvedDescription = metadata?.description || description;
    const modality = normalizeModalityCode(metadata?.modality || detectModalityFromCode(cupsCode));

    return {
      cups: cupsCode.toUpperCase(),
      nombre: removeAccents(resolvedDescription.toUpperCase()),
      modalidad: modality,
    };
  });
};

export const ALL_STUDIES: StudyData[] = generateStudiesFromCUPS();
