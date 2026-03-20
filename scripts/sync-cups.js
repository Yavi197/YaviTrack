#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SOURCE_PATH = path.resolve(PROJECT_ROOT, "data/cups/cups-sispro.xlsx");
const OUTPUT_DIR = path.resolve(PROJECT_ROOT, "src/lib/generated");
const OUTPUT_PATH = path.resolve(OUTPUT_DIR, "cups.generated.ts");

const ALLOWED_MODALITIES = new Set(["RX", "TAC", "ECO", "RMN", "MG", "DENSITO", "HEMODINAMIA"]);

function readWorkbook(source) {
  if (!fs.existsSync(source)) {
    throw new Error(`No se encontro el archivo de origen en ${source}`);
  }
  return XLSX.readFile(source, { cellDates: false });
}

function normalizeString(value) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function normalizeModality(raw) {
  const modality = normalizeString(raw).toUpperCase();
  if (!modality) return "RX";
  if (ALLOWED_MODALITIES.has(modality)) return modality;
  return "RX";
}

function normalizeAliases(raw) {
  const text = normalizeString(raw);
  if (!text) return [];
  return text
    .split(/[;,/|\n]/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function buildMetadata(rows) {
  const entries = new Map();

  rows.forEach((row) => {
    const code = normalizeString(row.CUPS || row.cups);
    const description = normalizeString(row.NOMBRE || row.Nombre || row.DESCRIPCION);
    if (!code || !description) return;

    const modality = normalizeModality(row.MODALIDAD || row.Modalidad);
    const aliases = normalizeAliases(row.ALIAS || row.Alias);

    entries.set(code, {
      description,
      modality,
      aliases,
    });
  });

  return Object.fromEntries(
    Array.from(entries.entries()).sort(([a], [b]) => a.localeCompare(b, "es", { numeric: true }))
  );
}

function emitFile(metadata) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const timestamp = new Date().toISOString();
  const fileHeader = `/**\n * AUTO-GENERATED FILE. DO NOT EDIT.\n * Source: data/cups/cups-sispro.xlsx\n * Generated: ${timestamp}\n */\n\nexport type CupsModality = "RX" | "TAC" | "ECO" | "RMN" | "MG" | "DENSITO" | "HEMODINAMIA";\n\nexport type CupsMetadataEntry = {\n  description: string;\n  modality: CupsModality;\n  aliases: string[];\n};\n\nexport const GENERATED_CUPS_METADATA: Record<string, CupsMetadataEntry> = `;
  const body = JSON.stringify(metadata, null, 2);
  const fileFooter = ` as const;\n`;
  fs.writeFileSync(OUTPUT_PATH, `${fileHeader}${body}${fileFooter}`, "utf8");
}

function main() {
  const workbook = readWorkbook(SOURCE_PATH);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  const metadata = buildMetadata(rows);
  emitFile(metadata);
  console.log(`CUPS generados: ${Object.keys(metadata).length}`);
  console.log(`Archivo creado en ${path.relative(PROJECT_ROOT, OUTPUT_PATH)}`);
}

main();
