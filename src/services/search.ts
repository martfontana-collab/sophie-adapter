import Fuse from 'fuse.js';
import type { Bien, BienSafe, SearchResponse } from '../types/bien.js';
import { resolveAlias } from '../utils/normalize.js';
import { getCachedBiens } from './sheets.js';

const MAX_RESULTS = 3;

// Colloquial type synonyms. A prospect who says "maison" at the phone
// colloquially includes "Villa" (both are standalone houses in French
// real-estate usage). "appartement" covers apartments including studios.
const TYPE_SYNONYMS: Record<string, string[]> = {
  maison: ['maison', 'villa'],
  villa: ['villa', 'maison'],
  appartement: ['appartement', 'studio', 't1', 't2', 't3', 't4', 't5'],
};

function typeMatches(candidate: string, query: string): boolean {
  const cand = candidate.toLowerCase();
  const q = query.toLowerCase().trim();
  const synonyms = TYPE_SYNONYMS[q] ?? [q];
  return synonyms.some((s) => cand.includes(s));
}

export function formatResponse(biens: Bien[]): SearchResponse {
  return {
    result_count: biens.length,
    has_multiple: biens.length > 1,
    message: biens.length === 0
      ? 'Aucun bien ne correspond dans le portefeuille actuel.'
      : '',
    biens: biens.map((b): BienSafe => ({
      reference: b.reference,
      type: b.type,
      secteur: b.secteur,
      surface_m2: b.surface_m2,
      pieces: b.pieces,
      chambres: b.chambres,
      statut: b.statut,
      arguments: b.arguments,
      acces_libre: b.acces_libre,
      // prix EXCLUDED (REGL-01)
      // DPE, charges, taxe_fonciere, diagnostics EXCLUDED (PORT-06)
    })),
  };
}

export function searchBiens(args: {
  secteur?: string;
  type_bien?: string;
  prix_approx?: number;
  reference?: string;
  adresse?: string;
}): SearchResponse {
  const allBiens = getCachedBiens();

  // 1. PRECISE PARAM (reference) → exact match, return WITH statut intact
  //    (allows downstream flow to detect Sous compromis / Vendu via {{bien_statut}})
  if (args.reference) {
    const refUpper = args.reference.toUpperCase();
    const match = allBiens.find(
      (b) => b.reference.toUpperCase() === refUpper
    );
    return formatResponse(match ? [match] : []);
  }

  // 1b. PRECISE PARAM (adresse/rue) → no matching column in the sheet, so we
  //     honestly return empty. Sophie will then say "ce bien-là je ne le retrouve pas".
  if (args.adresse) {
    return formatResponse([]);
  }

  // 2. Guard: reject purely vague queries. Need at least one identifying
  // signal: sector OR a specific price. type_bien alone ("maison") would
  // still scatter-shoot. A price like 485000 is specific enough to use as
  // sole anchor (±15% tolerance).
  if (!args.secteur && !args.prix_approx) {
    return formatResponse([]);
  }

  // 3. VAGUE PARAMS path: filter STRICT statut === "Disponible" before any
  //    other filter. Prevents Sophie from actively presenting a Sous compromis
  //    or Vendu bien on an imprecise query (Cas B exploratoire bug).
  let candidates = allBiens.filter((b) => b.statut === 'Disponible');

  // 4. Sector filter via alias resolution + Fuse.js fuzzy search
  if (args.secteur) {
    const resolved = resolveAlias(args.secteur);
    const fuse = new Fuse(candidates, {
      keys: ['secteur'],
      threshold: 0.3,
      ignoreLocation: true,
      minMatchCharLength: 3,
    });
    const fuseResults = fuse.search(resolved);
    candidates = fuseResults.map((r) => r.item);
  }

  // 5. Type filter with colloquial synonyms (maison matches Villa, etc.)
  // Only narrow if still multiple; never narrow to zero.
  if (args.type_bien && candidates.length > 1) {
    const filtered = candidates.filter((b) => typeMatches(b.type, args.type_bien!));
    if (filtered.length > 0) {
      candidates = filtered;
    }
  }

  // 6. Price filter (+/- 15% margin). If we have no other signal (price-only
  // query), this is the PRIMARY filter — apply strictly even if one candidate
  // left, to avoid returning everything.
  if (args.prix_approx) {
    const minPrice = args.prix_approx * 0.85;
    const maxPrice = args.prix_approx * 1.15;
    const filtered = candidates.filter(
      (b) => b.prix >= minPrice && b.prix <= maxPrice,
    );
    // Strict when price is the only signal — if 0 results, that's the answer.
    // Otherwise narrow if filtered is non-empty.
    if (!args.secteur || filtered.length > 0) {
      candidates = filtered;
    }
  }

  // 7. Cap results at MAX_RESULTS
  candidates = candidates.slice(0, MAX_RESULTS);

  return formatResponse(candidates);
}
