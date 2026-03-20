export const MODALITY_ORDER = [
  'RX',
  'TAC',
  'ECO',
  'RMN',
  'MG',
  'DENSITO',
  'HEMODINAMIA',
  'OTROS',
];

const MODALITY_LABELS: Record<string, string> = {
  RX: 'RAYOS X',
  TAC: 'TOMOGRAFIA',
  ECO: 'ECOGRAFIA',
  RMN: 'RESONANCIA',
  MG: 'MAMOGRAFIA',
  DENSITO: 'DENSITOMETRIA',
  HEMODINAMIA: 'HEMODINAMIA',
  OTROS: 'OTROS',
};

const NORMALIZATION_MAP: Record<string, string> = {
  RX: 'RX',
  RAYOS: 'RX',
  'RAYOS X': 'RX',
  TAC: 'TAC',
  TOMOGRAFIA: 'TAC',
  ECO: 'ECO',
  ECOGRAFIA: 'ECO',
  RMN: 'RMN',
  RESONANCIA: 'RMN',
  MG: 'MG',
  MAMO: 'MG',
  MAMOGRAFIA: 'MG',
  DENSITO: 'DENSITO',
  DENSITOMETRIA: 'DENSITO',
  HEMODINAMIA: 'HEMODINAMIA',
  'SIN MODALIDAD': 'OTROS',
  OTROS: 'OTROS',
  '': 'OTROS',
};

export const normalizeModalityCode = (value: string | undefined | null): string => {
  const normalized = (value || '').trim().toUpperCase();
  return NORMALIZATION_MAP[normalized] || normalized || 'OTROS';
};

export const getModalityLabel = (value: string): string => {
  const normalized = normalizeModalityCode(value);
  return MODALITY_LABELS[normalized] || normalized || 'OTROS';
};

export const getModalitySortIndex = (value: string): number => {
  const normalized = normalizeModalityCode(value);
  const index = MODALITY_ORDER.indexOf(normalized);
  return index === -1 ? MODALITY_ORDER.length : index;
};
