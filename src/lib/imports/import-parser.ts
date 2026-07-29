import { DEFAULT_IMPORT_LIMITS, type ImportLimits, type ParsedImportRow } from "./import-types";

export type ParsedCsv = {
  delimiter: "," | ";";
  headers: string[];
  rows: ParsedImportRow[];
};

function parseRecords(content: string, delimiter: "," | ";") {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (character === '"' && quoted && content[index + 1] === '"') {
      field += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      record.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && content[index + 1] === "\n") index += 1;
      record.push(field);
      if (record.some((value) => value.trim())) records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("Champ CSV entre guillemets non fermé.");
  record.push(field);
  if (record.some((value) => value.trim())) records.push(record);
  return records;
}

export function detectDelimiter(headerLine: string): "," | ";" {
  const commas = [...headerLine].filter((character) => character === ",").length;
  const semicolons = [...headerLine].filter((character) => character === ";").length;
  return semicolons > commas ? ";" : ",";
}

export function parseImportCsv(content: string, limits: ImportLimits = DEFAULT_IMPORT_LIMITS, delimiter?: "," | ";"): ParsedCsv {
  if (new TextEncoder().encode(content).byteLength > limits.maxBytes) throw new Error("Le fichier dépasse la taille maximale autorisée.");
  if (content.includes("\uFFFD")) throw new Error("Encodage invalide : un fichier UTF-8 est requis.");
  const cleanContent = content.replace(/^\uFEFF/, "");
  const selectedDelimiter = delimiter ?? detectDelimiter(cleanContent.split(/\r?\n/, 1)[0] ?? "");
  const records = parseRecords(cleanContent, selectedDelimiter);
  if (records.length < 2) throw new Error("Le fichier doit contenir un en-tête et au moins une ligne.");
  if (records.length - 1 > limits.maxRows) throw new Error(`Le fichier dépasse la limite de ${limits.maxRows} lignes.`);
  const headers = records[0].map((header) => header.trim());
  if (headers.some((header) => !header)) throw new Error("Un en-tête de colonne est vide.");
  if (new Set(headers.map((header) => header.toLowerCase())).size !== headers.length) throw new Error("Les en-têtes doivent être uniques.");

  const rows = records.slice(1).map((values, index) => {
    if (values.length > headers.length) throw new Error(`La ligne ${index + 2} contient trop de colonnes.`);
    const raw = Object.fromEntries(headers.map((header, column) => {
      const value = (values[column] ?? "").trim();
      if (value.length > limits.maxFieldLength) throw new Error(`La ligne ${index + 2}, colonne ${header}, dépasse la longueur autorisée.`);
      return [header, value];
    }));
    return { lineNumber: index + 2, raw };
  });
  return { delimiter: selectedDelimiter, headers, rows };
}
