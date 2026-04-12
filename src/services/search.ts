import Fuse from 'fuse.js';
import type { Bien, BienSafe, SearchResponse } from '../types/bien.js';
import { resolveAlias } from '../utils/normalize.js';
import { getCachedBiens } from './sheets.js';

const MAX_RESULTS = 3;

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
}): SearchResponse {
  const allBiens = getCachedBiens();

  // 1. Reference exact match (case-insensitive)
  if (args.reference) {
    const refUpper = args.reference.toUpperCase();
    const match = allBiens.find(
      (b) => b.reference.toUpperCase() === refUpper
    );
    return formatResponse(match ? [match] : []);
  }

  // 2. Start with all biens as candidates
  let candidates = [...allBiens];

  // 3. Sector filter via alias resolution + Fuse.js fuzzy search
  if (args.secteur) {
    const resolved = resolveAlias(args.secteur);
    const fuse = new Fuse(candidates, {
      keys: ['secteur'],
      threshold: 0.4,
      ignoreLocation: true,
      minMatchCharLength: 3,
    });
    const fuseResults = fuse.search(resolved);
    candidates = fuseResults.map((r) => r.item);
  }

  // 4. Type filter (case-insensitive includes)
  if (args.type_bien && candidates.length > 1) {
    const typeNorm = args.type_bien.toLowerCase();
    const filtered = candidates.filter(
      (b) => b.type.toLowerCase().includes(typeNorm)
    );
    if (filtered.length > 0) {
      candidates = filtered;
    }
  }

  // 5. Price filter (+/- 15% margin)
  if (args.prix_approx && candidates.length > 1) {
    const minPrice = args.prix_approx * 0.85;
    const maxPrice = args.prix_approx * 1.15;
    const filtered = candidates.filter(
      (b) => b.prix >= minPrice && b.prix <= maxPrice
    );
    if (filtered.length > 0) {
      candidates = filtered;
    }
  }

  // 6. Cap results at MAX_RESULTS
  candidates = candidates.slice(0, MAX_RESULTS);

  return formatResponse(candidates);
}
