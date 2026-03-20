/**
 * CUPS (Código Único de Procedimientos en Salud) - Colombian medical procedure codes
 * Used to map study descriptions to standardized codes
 */

import { GENERATED_CUPS_METADATA } from './generated/cups.generated';
import type { CupsModality } from './generated/cups.generated';

const LEGACY_CODES: Record<string, string> = {
    // Nuevos CUPS Ecografía Nov 2025
    '881620': 'ECOGRAFIA ARTICULAR DE RODILLA',
    '881511': 'ULTRASONOGRAFIA TESTICULAR CON ANALISIS DOPPLER',
    '881331': 'ULTRASONOGRAFIA DE RIÑONES, BAZO, AORTA O ADRENALES',
  // TAC (Tomografía Axial Computarizada)
  '21701': 'Cráneo simple',
  '21702': 'Cráneo con contraste',
  '21703': 'Cráneo simple y con contraste',
  '21704': 'Cisternografía',
  '21705': 'Silla turca u oído',
  '21706': 'Senos paranasales o rinofaringe',
  '21707': 'Órbitas',
  '21708': 'Columna cervical, dorsal o lumbar (hasta tres espacios)',
  '21709': 'Columna cervical, dorsal o lumbar (espacio adicional)',
  '21710': 'Laringe o cuello',
  '21711': 'Laringe y cuello',
  '21712': 'Tórax',
  '21713': 'Abdomen superior',
  '21714': 'Pelvis',
  '21715': 'Abdomen total',
  '21716': 'Extremidades y articulaciones',
  '21717': 'Articulación temporo mandibular',
  '21718': 'Osteodensitometría',
  '21719': 'Complemento a mielografía',
  '21720': 'Anteversión femoral o tibial',
  '21721': 'Guía escanográfica para procedimientos intervencionistas',
  '21722': 'Reconstrucción tridimensional',
  '21723': 'Peñasco, conductos auditivos internos',

  // RX (Radiografía)
  '21101': 'Mano, dedos, puño, codo, pie, clavícula',
  '21102': 'Brazo, pierna, rodilla, fémur, hombro',
  '21103': 'Test de Farill, estudio de pie plano',
  '21104': 'Test de anteversión femoral',
  '21105': 'Pelvis, cadera, articulaciones sacro ilíacas',
  '21106': 'Comparativas de las regiones anteriores',
  '21107': 'Tomografía osteoarticular',
  '21108': 'Proyección adicional',
  '21109': 'Tangencial rótula',
  '21110': 'Panorámica en miembros inferiores',
  '21111': 'Estudio de huesos largos AP',
  '21112': 'Fotopodografía',
  '21113': 'Osteodensitometría por absorción dual',
  '21120': 'Cara, malar, arco cigomático, huesos nasales',
  '21121': 'Senos paranasales, maxilar inferior, órbitas',
  '21122': 'Cráneo simple',
  '21123': 'Cráneo simple más base de cráneo',
  '21124': 'Mastoides comparativas, peñascos',
  '21125': 'Tomografía lineal de las regiones anteriores',
  '21126': 'Proyecciones adicionales',
  '21127': 'Politomografía de conductos auditivos internos',
  '21128': 'Politomografía unilateral de mastoides',
  '21129': 'Politomografía bilateral de mastoides',
  // Códigos ISS y ADES actualizados
  '870001': 'RADIOGRAFÍA DE CRÁNEO SIMPLE',
  '870003': 'RADIOGRAFÍA DE BASE DE CRÁNEO',
  '870004': 'RADIOGRAFÍA DE SILLA TURCA',
  '870005': 'RADIOGRAFÍA DE MASTOIDES COMPARATIVAS',
  '870006': 'RADIOGRAFÍA DE PEÑASCOS',
  '870007': 'RADIOGRAFÍA DE CONDUCTO AUDITIVO INTERNO',
  '870101': 'RADIOGRAFÍA DE CARA (PERFILOGRAMA)',
  '870102': 'RADIOGRAFÍA DE ÓRBITAS',
  '870103': 'RADIOGRAFÍA DE AGUJEROS ÓPTICOS',
  '870104': 'RADIOGRAFÍA DE MALAR',
  '870105': 'RADIOGRAFÍA DE ARCO CIGOMATICO',
  '870107': 'RADIOGRAFÍA DE HUESOS NASALES',
  '870108': 'RADIOGRAFÍA DE SENOS PARANASALES',
  '870112': 'RADIOGRAFÍA DE MAXILAR SUPERIOR',
  '870113': 'RADIOGRAFÍA DE MAXILAR INFERIOR',
  '870131': 'RADIOGRAFÍA DE ARTICULACIÓN TEMPOROMAXILAR [ATM]',
  '870601': 'RADIOGRAFÍA DE TEJIDOS BLANDOS DE CUELLO',
  '870602': 'RADIOGRAFÍA DE CAVUM FARÍNGEO',
  '870603': 'RADIOGRAFÍA DE FARINGE [FARINGOGRAFÍA]',
  '871010': 'RADIOGRAFÍA DE COLUMNA CERVICAL',
  '871019': 'RADIOGRAFÍA DE COLUMNA UNIÓN CERVICO DORSAL',
  '871020': 'RADIOGRAFÍA DE COLUMNA TORÁCICA',
  '871030': 'RADIOGRAFÍA DE COLUMNA DORSOLUMBAR',
  '871040': 'RADIOGRAFÍA DE COLUMNA LUMBOSACRA',
  '871050': 'RADIOGRAFÍA DE SACRO CÓCCIX',
  '871060': 'RADIOGRAFÍA DE COLUMNA VERTEBRAL TOTAL',
  '871070': 'RADIOGRAFÍA DINÁMICA DE COLUMNA VERTEBRAL',
  '871091': 'RADIOGRAFÍA DE ARTICULACIONES SACROILIACAS',
  '871111': 'RADIOGRAFÍA DE REJA COSTAL',
  '871112': 'RADIOGRAFÍA DE ESTERNÓN',
  '871121': 'RADIOGRAFÍA DE TÓRAX (P.A. O A.P. Y LATERAL, DECÚBITO LATERAL, OBLICUAS O LATERAL)',
  '871129': 'RADIOGRAFÍA DE ARTICULACIONES ESTERNOCLAVICULARES',
  '871202': 'APICOGRAMA',
  '871320': 'RADIOGRAFÍA DE ESÓFAGO',
  '872002': 'RADIOGRAFÍA DE ABDOMEN SIMPLE',
  '872011': 'RADIOGRAFÍA DE ABDOMEN SIMPLE CON PROYECCIONES ADICIONALES (SERIE DE ABDOMEN AGUDO)',
  '872101': 'RADIOGRAFÍA DE TRÁNSITO INTESTINAL CONVENCIONAL',
  '872103': 'RADIOGRAFÍA DE TRÁNSITO INTESTINAL CON MARCADORES',
  '872104': 'RADIOGRAFÍA DE COLON POR ENEMA O COLON POR INGESTA',
  '872121': 'RADIOGRAFÍA DE VÍAS DIGESTIVAS ALTAS (ESÓFAGO, ESTÓMAGO Y DUODENO)',
  '872123': 'RADIOGRAFÍA DE VÍAS DIGESTIVAS ALTAS (ESÓFAGO, ESTÓMAGO Y DUODENO) Y TRÁNSITO INTESTINAL',
  '873001': 'RADIOGRAFÍA PARA SERIE ESQUELÉTICA',
  '873002': 'RADIOGRAFÍA DE HUESOS LARGOS SERIE COMPLETA (ESQUELETO AXIAL Y APENDICULAR)',
  '873003': 'RADIOGRAFÍA PARA ESTUDIOS DE LONGITUD DE LOS HUESOS (ORTORRADIOGRAFÍA Y ESCANOGRAMA)',
  '873004': 'RADIOGRAFÍA PARA DETECTAR EDAD ÓSEA [CARPOGRAMA]',
  '873111': 'RADIOGRAFÍA DE OMOPLATO',
  '873112': 'RADIOGRAFÍA DE CLAVICULA',
  '873121': 'RADIOGRAFÍA DE HÚMERO',
  '873122': 'RADIOGRAFÍA DE ANTEBRAZO',
  '873123': 'RADIOGRAFIAS COMPARATIVAS DE EXTREMIDADES SUPERIORES',
  '873202': 'RADIOGRAFÍA DE ARTICULACIONES ACROMIO CLAVICULARES COMPARATIVAS',
  '873204': 'RADIOGRAFÍA DE HOMBRO',
  '873205': 'RADIOGRAFÍA DE CODO',
  '873206': 'RADIOGRAFÍA DE PUÑO O MUÑECA',
  '873210': 'RADIOGRAFÍA DE MANO',
  '873302': 'RADIOGRAFÍA PARA MEDICIÓN DE MIEMBROS INFERIORES [ESTUDIO DE FARILL U OSTEOMETRÍA]',
  '873312': 'RADIOGRAFÍA DE FÉMUR (AP, LATERAL)',
  '873313': 'RADIOGRAFÍA DE PIERNA (AP, LATERAL)',
  '873314': 'RADIOGRAFÍA DE ANTEVERSIÓN TIBIAL',
  '873333': 'RADIOGRAFÍA DE PIE (AP, LATERAL Y OBLICUA)',
  '873335': 'RADIOGRAFÍA DE CALCÁNEO (AXIAL Y LATERAL)',
  '873340': 'RADIOGRAFÍA DE MIEMBRO INFERIOR (AP, LATERAL)',
  '873411': 'RADIOGRAFÍA DE CADERA O ARTICULACIÓN COXO-FEMORAL (AP, LATERAL)',
  '873412': 'RADIOGRAFÍA DE CADERA COMPARATIVA',
  '873420': 'RADIOGRAFÍA DE RODILLA (AP, LATERAL)',
  '873422': 'RADIOGRAFÍA DE RODILLAS COMPARATIVAS POSICIÓN VERTICAL (ÚNICAMENTE VISTA ANTEROPOSTERIOR)',
  '873423': 'RADIOGRAFÍA TANGENCIAL O AXIAL DE RÓTULA',
  '873431': 'RADIOGRAFÍA DE TOBILLO (AP, LATERAL Y ROTACIÓN INTERNA)',
  '873443': 'RADIOGRAFÍAS COMPARATIVAS DE EXTREMIDADES INFERIORES',
  '873444': 'RADIOGRAFÍAS EN EXTREMIDADES PROYECCIONES ADICIONALES (STRESS, TUNEL, OBLICUAS)',
  'M87000': 'EQUIPO DE RADIOLOGIA PORTATIL SIMPLE',
  '872102': 'RADIOGRAFIA DE TRANSITO INTESTINAL DOBLE CONTRASTE',
  '872122': 'RADIOGRAFIA DE VIAS DIGESTIVAS ALTAS (ESOFAGO, ESTOMAGO Y DUODENO) CON DOBLE CONTRASTE',
  // ...continúa con los códigos de TOMOGRAFIA, ECOGRAFIA, MAMOGRAFIA, RESONANCIA...
  '883440': 'Resonancia Magnética de Pelvis',
  '883110': 'Resonancia Magnética de Senos Paranasales o Cara',
  '883590': 'Resonancia Magnética de Sistema Músculo Esquelético',
  '883301': 'Resonancia Magnética del Tórax',
  '883430': 'Resonancia Nuclear Magnética de Vías Biliares',

  // TAC (Tomografía Computada) - ISS codes
  '879141': 'Tomografía Axial Computada de Maxilares',
  '879990': 'Tomografía Computada como Guía para Procedimientos',
  '879920': 'Tomografía Computada con Modalidad Dinámica',
  '879410': 'Tomografía Computada de Abdomen Superior',
  '879420': 'Tomografía Computada de Abdomen y Pelvis',
  '879205': 'Tomografía Computada de Columna (Complemento a Mielografía)',
  '879201': 'Tomografía Computada de Columna (Tres Espacios)',
  '879112': 'Tomografía Computada de Cráneo con Contraste',
  '879111': 'Tomografía Computada de Cráneo Simple',
  '879113': 'Tomografía Computada de Cráneo Simple y con Contraste',
  '879161': 'Tomografía Computada de Cuello',
  '879162': 'Tomografía Computada de Laringe',
  '879522': 'Tomografía Computada de Miembros Inferiores (Anteversión Femoral)',
  '879523': 'Tomografía Computada de Miembros Inferiores (Axiales de Rótula)',
  '879520': 'Tomografía Computada de Miembros Inferiores y Articulaciones',
  '879510': 'Tomografía Computada de Miembros Superiores y Articulaciones',
  '879122': 'Tomografía Computada de Oído, Peñasco y Conducto Auditivo',
  '879121': 'Tomografía Computada de Órbitas',
  '879460': 'Tomografía Computada de Pelvis',
  '879132': 'Tomografía Computada de Rinofaringe',
  '879131': 'Tomografía Computada de Senos Paranasales o Cara',
  '879116': 'Tomografía Computada de Silla Turca (Hipófisis)',
  '879301': 'Tomografía Computada de Tórax',
  '879391': 'Tomografía Computada de Tórax Extendido al Abdomen Superior',
  '879901': 'Tomografía Computada de Vasos',
  '879430': 'Tomografía Computada de Vías Urinarias',
  '879910': 'Tomografía Computada en Reconstrucción Tridimensional',

  // ECO (Ecografía) - ISS codes
  '882308': 'Doppler de Vasos Arteriales de Miembros Inferiores',
  '882307': 'Doppler de Vasos Arteriales de Miembros Superiores',
  '882318': 'Doppler de Vasos Venosos de Miembros Inferiores',
  '882309': 'Doppler de Vasos Venosos de Miembros Superiores',
  '881701': 'Ecografía como Guía para Procedimientos',
  '881702': 'Ecografía como Guía para Procedimientos con Marcación',
  '881305': 'Ecografía de Abdomen Superior',
  '881302': 'Ecografía de Abdomen Total',
  '881132': 'Ecografía de Cuello',
  '881131': 'Ecografía de Glándulas Salivales',
  '881151': 'Ecografía de Ganglios Cervicales (Mapeo)',
  '881306': 'Ecografía de Hígado, Páncreas y Vía Biliar',
  '881201': 'Ecografía de Mama',
  '881212': 'Ecografía de Otros Sitios Torácicos',
  '881521': 'Ecografía de Pene',
  '881501': 'Ecografía de Próstata Transabdominal',
  '881502': 'Ecografía de Próstata Transrectal',
  '881362': 'Ecografía de Tejidos Blandos de Abdomen con Análisis Doppler',
  '881301': 'Ecografía de Tejidos Blandos de Pared Abdominal y Pelvis',
  '881602': 'Ecografía de Tejidos Blandos en Extremidades Inferiores',
  '881601': 'Ecografía de Tejidos Blandos en Extremidades Superiores',
  '881141': 'Ecografía de Tiroides',
  '881211': 'Ecografía de Tórax (Pericardio o Pleura)',
  '881332': 'Ecografía de Vías Urinarias',
  '881390': 'Ecografía del Abdomen y Pelvis como Guía de Procedimiento',
  '882296': 'Ecografía Doppler con Evaluación de Flujo en Hipertensión Portal',
  '882222': 'Ecografía Doppler de Arterias Renales',
  '882272': 'Ecografía Doppler de Vasos del Pene',
  '881317': 'Ecografía Endoscópica Biliopancreática',
  '881314': 'Ecografía Endoscópica de Estómago o Duodeno',
  '881319': 'Ecografía Endoscópica de Recto',
  '881360': 'Ecografía Pélvica con Análisis Doppler',
  '881410': 'Ecografía Pélvica Ginecológica',
  '881510': 'Ecografía Testicular',
  '881437': 'Ecografía Obstétrica con Detalle Anatómico',
  '881436': 'Ecografía Obstétrica con Translucencia Nucal',
  '881438': 'Ecocardiografía Fetal',
  '881434': 'Perfil Biofísico',
  '882298': 'Ecografía Doppler Obstétrica con Evaluación de Circulación Placentaria',
  '872105': 'RADIOGRAFÍA DE COLON POR ENEMA CON DOBLE CONTRASTE',
  '871062': 'RADIOGRAFIA PANORAMICA DE COLUMNA (NIÑOS)',
  '871061': 'RADIOGRAFIA PANORAMICA DE COLUMNA (ADULTOS)',
  '870114': 'RADIOGRAFIA PANORAMICA DE MAXILARES',
  '873305': 'RADIOGRAFIA PANORAMICA DE MIEMBROS INFERIORES',

  '877862': 'Uretrocistografía Miccional',
  '877863': 'Uretrocistografía Retrógrada',
  '877871': 'Uretrografía Retrógrada',
  '879431': 'Urografía con Tomografía Computada',
  '877802': 'Urografía Intravenosa',

  // MAMO (Mamografía) - ISS codes
  '876802': 'Mamografía Bilateral',
  '876801': 'Mamografía Unilateral o de Pieza Quirúrgica',

  // DENSITOMETRIA - ISS codes
  '886012': 'Osteodensitometría por Absorción Dual',
  '886013': 'Osteodensitometría y Composición Corporal',
};

const GENERATED_CUPS_DESCRIPTIONS: Record<string, string> = Object.fromEntries(
  Object.entries(GENERATED_CUPS_METADATA).map(([code, metadata]) => [code, metadata.description])
);

export const CUPS_CODES: Record<string, string> = {
  ...LEGACY_CODES,
  ...GENERATED_CUPS_DESCRIPTIONS,
};

type SupportedModality = 'RX' | 'TAC' | 'ECO' | 'RMN' | 'MAMO';

const MODALITY_MAPPING: Record<CupsModality, SupportedModality> = {
  RX: 'RX',
  TAC: 'TAC',
  ECO: 'ECO',
  RMN: 'RMN',
  MG: 'MAMO',
  DENSITO: 'RX',
  HEMODINAMIA: 'RX',
};

type KeywordEntry = {
  code: string;
  keywords: string[];
};

const EXACT_MATCHES = new Map<string, string>();
const KEYWORD_INDEX: KeywordEntry[] = [];

function normalizeText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function registerKeywords(code: string, phrase: string) {
  const normalized = normalizeText(phrase);
  if (!normalized) return;

  EXACT_MATCHES.set(normalized, code);

  const keywords = normalized
    .split(/[^a-z0-9]+/i)
    .map(token => token.trim())
    .filter(token => token.length > 2);

  if (keywords.length) {
    KEYWORD_INDEX.push({ code, keywords });
  }
}

// Precompute lookup tables so we only normalize strings once
Object.entries(CUPS_CODES).forEach(([code, description]) => {
  registerKeywords(code, description);
});

Object.entries(GENERATED_CUPS_METADATA).forEach(([code, metadata]) => {
  metadata.aliases.forEach(alias => registerKeywords(code, alias));
});

/**
 * Map study description to CUPS code
 * Tries to find best match based on keywords and aliases
 */
export function mapStudyToCUPS(studyDescription: string): string {
  if (!studyDescription) return '0';

  const normalized = normalizeText(studyDescription);
  if (!normalized) return '0';

  const exactMatch = EXACT_MATCHES.get(normalized);
  if (exactMatch) {
    return exactMatch;
  }

  let bestCode = '0';
  let bestScore = 0;

  for (const entry of KEYWORD_INDEX) {
    const score = entry.keywords.reduce((count, keyword) => (normalized.includes(keyword) ? count + 1 : count), 0);
    if (score > bestScore) {
      bestScore = score;
      bestCode = entry.code;
    }
  }

  return bestCode;
}

/**
 * Get modality (RX, TAC, ECO, RMN, MAMO) from CUPS code
 */
export function getModalityFromCUPS(cupsCode: string): SupportedModality {
  if (!cupsCode) return 'RX';

  const metadata = GENERATED_CUPS_METADATA[cupsCode];
  if (metadata) {
    return MODALITY_MAPPING[metadata.modality] ?? 'RX';
  }

  const code = parseInt(cupsCode, 10);
  if (Number.isNaN(code)) return 'RX';

  // SOAT codes (old format)
  if (code >= 21701 && code <= 21723) return 'TAC';
  if (code >= 21101 && code <= 21602) return 'RX';
  if (code >= 31100 && code <= 31201) return 'ECO';
  if (code >= 31301 && code <= 31307) return 'RMN';

  // ISS codes (new format) - TAC
  if (code >= 879000 && code <= 879999) return 'TAC';
  // ISS codes - RX
  if (code >= 870000 && code <= 877999) return 'RX';
  // ISS codes - ECO
  if (code >= 881000 && code <= 882999) return 'ECO';
  // ISS codes - RMN
  if (code >= 883000 && code <= 883999) return 'RMN';
  // ISS codes - MAMO
  if (code >= 876000 && code <= 876999) return 'MAMO';

  // Default to RX
  return 'RX';
}
