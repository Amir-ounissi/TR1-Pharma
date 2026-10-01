import "server-only";

const SEARCH_ENDPOINT = "https://recherche-entreprises.api.gouv.fr/search";
const FRENCH_VAT = /^FR[A-Z0-9]{2}[0-9]{9}$/i;
const SIRET = /^[0-9]{14}$/;

type EnterpriseEstablishment = {
  siret?: unknown;
  code_postal?: unknown;
  etat_administratif?: unknown;
  nom_commercial?: unknown;
  enseigne?: unknown;
  liste_enseignes?: unknown;
};

type EnterpriseSearchResult = {
  siren?: unknown;
  nom_complet?: unknown;
  nom_raison_sociale?: unknown;
  tva?: unknown;
  siege?: EnterpriseEstablishment | null;
  matching_etablissements?: unknown;
};

type EnterpriseSearchResponse = {
  results?: unknown;
};

export type FrenchVatLookupInput = {
  siret?: string | null;
  legalName?: string | null;
  tradeName?: string | null;
  postalCode?: string | null;
  city?: string | null;
};

export type FrenchVatLookupResult =
  | {
      status: "found";
      vatNumber: string;
      siren: string;
      siret: string | null;
      companyName: string;
      source: "annuaire-entreprises";
    }
  | {
      status: "not_found" | "ambiguous";
      reason: string;
    };

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function siretMatchesSiren(siret?: string | null, siren?: string | null) {
  const normalizedSiret = String(siret ?? "").replace(/\D/g, "");
  const normalizedSiren = String(siren ?? "").replace(/\D/g, "");
  return SIRET.test(normalizedSiret)
    && /^[0-9]{9}$/.test(normalizedSiren)
    && normalizedSiret.slice(0, 9) === normalizedSiren;
}

function normalizePostalCode(value?: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 4) return digits.padStart(5, "0");
  return digits.length === 5 ? digits : "";
}

function normalizeName(value?: string | null) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\b(SASU?|SARL|SELARL|SELAS|SNC|EURL|SCM|SCP|SA|SOCIETE|OFFICINE)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function distinctiveTokens(value: string) {
  const generic = new Set([
    "PHARMACIE",
    "GRANDE",
    "DE",
    "DU",
    "DES",
    "LA",
    "LE",
    "LES",
    "D",
    "L",
    "A",
    "AU",
    "AUX",
  ]);
  return normalizeName(value)
    .split(" ")
    .filter((token) => token.length >= 2 && !generic.has(token));
}

function nameScore(target: string, candidate: string) {
  const left = normalizeName(target);
  const right = normalizeName(candidate);
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.9;

  const a = new Set(distinctiveTokens(left));
  const b = new Set(distinctiveTokens(right));
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

function establishments(result: EnterpriseSearchResult) {
  const entries: EnterpriseEstablishment[] = [];
  if (result.siege && typeof result.siege === "object") entries.push(result.siege);
  if (Array.isArray(result.matching_etablissements)) {
    for (const entry of result.matching_etablissements) {
      if (entry && typeof entry === "object" && !Array.isArray(entry)) {
        entries.push(entry as EnterpriseEstablishment);
      }
    }
  }
  return entries;
}

function establishmentNames(entry: EnterpriseEstablishment) {
  const names = [
    textValue(entry.nom_commercial),
    textValue(entry.enseigne),
    ...(Array.isArray(entry.liste_enseignes)
      ? entry.liste_enseignes.map(textValue)
      : []),
  ];
  return names.filter(Boolean);
}

function resultNames(result: EnterpriseSearchResult) {
  return [
    textValue(result.nom_complet),
    textValue(result.nom_raison_sociale),
    ...establishments(result).flatMap(establishmentNames),
  ].filter(Boolean);
}

function validVatNumbers(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map(textValue)
        .map((entry) => entry.replace(/\s+/g, "").toUpperCase())
        .filter((entry) => FRENCH_VAT.test(entry)),
    ),
  ];
}

function bestEstablishmentSiret(
  result: EnterpriseSearchResult,
  postalCode: string,
  requestedSiret: string,
) {
  const candidates = establishments(result).filter((entry) => {
    const siret = textValue(entry.siret);
    if (!SIRET.test(siret)) return false;
    if (requestedSiret) return siret === requestedSiret;
    const entryPostalCode = normalizePostalCode(textValue(entry.code_postal));
    return !postalCode || entryPostalCode === postalCode;
  });
  const unique = [...new Set(candidates.map((entry) => textValue(entry.siret)))];
  return unique.length === 1 ? unique[0] : null;
}

function rankResult(
  result: EnterpriseSearchResult,
  targetNames: string[],
  postalCode: string,
  requestedSiret: string,
) {
  const siren = textValue(result.siren);
  if (!/^[0-9]{9}$/.test(siren)) return null;
  if (requestedSiret && siren !== requestedSiret.slice(0, 9)) return null;

  const vats = validVatNumbers(result.tva);
  if (vats.length !== 1) return null;

  const entries = establishments(result);
  const postalMatch =
    !postalCode ||
    entries.some((entry) => normalizePostalCode(textValue(entry.code_postal)) === postalCode);
  if (!requestedSiret && !postalMatch) return null;

  const names = resultNames(result);
  const score = requestedSiret
    ? 1
    : Math.max(
        0,
        ...targetNames.flatMap((target) => names.map((candidate) => nameScore(target, candidate))),
      );

  return {
    score,
    vatNumber: vats[0],
    siren,
    siret: bestEstablishmentSiret(result, postalCode, requestedSiret),
    companyName: textValue(result.nom_raison_sociale) || textValue(result.nom_complet) || targetNames[0] || "Entreprise",
  };
}

export async function lookupFrenchVatNumber(
  input: FrenchVatLookupInput,
  fetcher: typeof fetch = fetch,
): Promise<FrenchVatLookupResult> {
  const requestedSiret = textValue(input.siret).replace(/\D/g, "");
  const hasSiret = SIRET.test(requestedSiret);
  const postalCode = normalizePostalCode(input.postalCode);
  const targetNames = [...new Set([textValue(input.tradeName), textValue(input.legalName)].filter(Boolean))];

  if (!hasSiret && !targetNames.length) {
    return { status: "not_found", reason: "Nom de pharmacie insuffisant pour lancer la recherche officielle." };
  }
  if (!hasSiret && !postalCode) {
    return { status: "not_found", reason: "Code postal manquant ou invalide pour sécuriser la recherche officielle." };
  }

  const params = new URLSearchParams({
    q: hasSiret ? requestedSiret : targetNames[0],
    page: "1",
    per_page: "10",
    minimal: "true",
    include: "siege,matching_etablissements,tva,score",
    etat_administratif: "A",
  });
  if (!hasSiret) params.set("code_postal", postalCode);

  let response: Response;
  try {
    response = await fetcher(`${SEARCH_ENDPOINT}?${params.toString()}`, {
      headers: {
        Accept: "application/json",
        "User-Agent": "TR1-Pharma/1.0",
      },
      signal: AbortSignal.timeout(7000),
      cache: "no-store",
    });
  } catch {
    return { status: "not_found", reason: "Le service officiel des entreprises est momentanément indisponible." };
  }

  if (!response.ok) {
    return { status: "not_found", reason: "Le service officiel des entreprises n’a pas pu répondre à la recherche." };
  }

  let payload: EnterpriseSearchResponse;
  try {
    payload = (await response.json()) as EnterpriseSearchResponse;
  } catch {
    return { status: "not_found", reason: "La réponse du service officiel des entreprises est illisible." };
  }

  const results = Array.isArray(payload.results)
    ? payload.results.filter(
        (entry): entry is EnterpriseSearchResult =>
          Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
      )
    : [];

  const ranked = results
    .map((result) => rankResult(result, targetNames, postalCode, hasSiret ? requestedSiret : ""))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) {
    return {
      status: "not_found",
      reason: "Aucune TVA française active n’a été trouvée avec suffisamment de certitude.",
    };
  }

  const best = ranked[0];
  if (!hasSiret) {
    if (best.score < 0.6) {
      return {
        status: "ambiguous",
        reason: "Une société a été trouvée, mais son nom ne correspond pas assez précisément à la pharmacie.",
      };
    }
    const second = ranked[1];
    if (second && second.score >= best.score - 0.15 && second.siren !== best.siren) {
      return {
        status: "ambiguous",
        reason: "Plusieurs sociétés correspondent à cette pharmacie. Saisissez le SIRET exact dans la recherche officielle puis relancez-la.",
      };
    }
  }

  return {
    status: "found",
    vatNumber: best.vatNumber,
    siren: best.siren,
    siret: best.siret,
    companyName: best.companyName,
    source: "annuaire-entreprises",
  };
}

export const frenchVatLookupInternals = {
  normalizePostalCode,
  normalizeName,
  nameScore,
  validVatNumbers,
  siretMatchesSiren,
};
