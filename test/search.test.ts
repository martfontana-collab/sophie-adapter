import { describe, it, expect, beforeAll } from 'vitest';
import { loadTestData } from '../src/services/sheets.js';
import { searchBiens, formatResponse } from '../src/services/search.js';
import type { Bien } from '../src/types/bien.js';

const TEST_BIENS: Bien[] = [
  {
    reference: 'EM-2026-001', type: 'Villa', secteur: 'Boulouris',
    surface_m2: 120, pieces: 4, chambres: 3, prix: 485000,
    statut: 'Disponible', arguments: 'Vue mer, jardin 500m2, garage double',
    acces_libre: true, visitable: true,
  },
  {
    reference: 'EM-2026-002', type: 'Appartement', secteur: 'Valescure',
    surface_m2: 75, pieces: 3, chambres: 2, prix: 295000,
    statut: 'Disponible', arguments: 'Residence calme, balcon sud, parking',
    acces_libre: true, visitable: true,
  },
  {
    reference: 'EM-2026-003', type: 'Maison', secteur: 'Frejus',
    surface_m2: 95, pieces: 4, chambres: 3, prix: 380000,
    statut: 'Sous compromis', arguments: 'Centre-ville, renovee, terrasse',
    acces_libre: false, visitable: false,
  },
  {
    reference: 'EM-2026-004', type: 'Appartement', secteur: 'Boulouris',
    surface_m2: 55, pieces: 2, chambres: 1, prix: 220000,
    statut: 'Disponible', arguments: 'Vue partielle mer, dernier etage',
    acces_libre: true, visitable: true,
  },
  {
    reference: 'EM-2026-005', type: 'Villa', secteur: 'Saint-Raphael',
    surface_m2: 200, pieces: 6, chambres: 4, prix: 750000,
    statut: 'Vendu', arguments: 'Piscine, vue panoramique, calme absolu',
    acces_libre: false, visitable: false,
  },
];

beforeAll(() => {
  loadTestData(TEST_BIENS);
});

describe('searchBiens', () => {
  it('finds exact reference EM-2026-001', () => {
    const result = searchBiens({ reference: 'EM-2026-001' });
    expect(result.result_count).toBe(1);
    expect(result.biens[0].reference).toBe('EM-2026-001');
  });

  it('finds 2 results for secteur "Boulouris"', () => {
    const result = searchBiens({ secteur: 'Boulouris' });
    expect(result.result_count).toBe(2);
    const refs = result.biens.map(b => b.reference).sort();
    expect(refs).toEqual(['EM-2026-001', 'EM-2026-004']);
  });

  it('finds 2 results for fuzzy/alias secteur "boulouri"', () => {
    const result = searchBiens({ secteur: 'boulouri' });
    expect(result.result_count).toBe(2);
  });

  it('filters by secteur + type_bien', () => {
    const result = searchBiens({ secteur: 'Boulouris', type_bien: 'villa' });
    expect(result.result_count).toBe(1);
    expect(result.biens[0].reference).toBe('EM-2026-001');
  });

  it('filters by secteur + prix_approx within 15%', () => {
    const result = searchBiens({ secteur: 'Boulouris', prix_approx: 230000 });
    expect(result.result_count).toBe(1);
    expect(result.biens[0].reference).toBe('EM-2026-004');
  });

  it('returns 0 results with message for no matches', () => {
    const result = searchBiens({ secteur: 'Nowhere' });
    expect(result.result_count).toBe(0);
    expect(result.message).toBe('Aucun bien ne correspond dans le portefeuille actuel.');
  });

  it('never contains prix field in response biens', () => {
    const result = searchBiens({ secteur: 'Boulouris' });
    for (const bien of result.biens) {
      expect(bien).not.toHaveProperty('prix');
    }
  });

  it('caps results at 3 items max', () => {
    // Load 5 properties all in same sector to test cap
    const manyBiens: Bien[] = Array.from({ length: 5 }, (_, i) => ({
      reference: `EM-TEST-${i}`, type: 'Villa', secteur: 'TestZone',
      surface_m2: 100, pieces: 3, chambres: 2, prix: 300000,
      statut: 'Disponible', arguments: 'Test', acces_libre: true, visitable: true,
    }));
    loadTestData(manyBiens);
    const result = searchBiens({ secteur: 'TestZone' });
    expect(result.biens.length).toBeLessThanOrEqual(3);
    // Restore original test data
    loadTestData(TEST_BIENS);
  });

  // --- Bug fix 2026-04-24 : adresse param + filtre statut sur requêtes vagues ---

  it('returns 0 when adresse param is provided (no sheet column)', () => {
    const result = searchBiens({ adresse: 'rue Charles Goujon', secteur: 'Saint-Raphael' });
    expect(result.result_count).toBe(0);
  });

  it('returns the bien with statut intact when matched by reference (Sous compromis)', () => {
    const result = searchBiens({ reference: 'EM-2026-003' });
    expect(result.result_count).toBe(1);
    expect(result.biens[0].reference).toBe('EM-2026-003');
    expect(result.biens[0].statut).toBe('Sous compromis');
  });

  it('returns the bien with statut intact when matched by reference (Vendu)', () => {
    const result = searchBiens({ reference: 'EM-2026-005' });
    expect(result.result_count).toBe(1);
    expect(result.biens[0].reference).toBe('EM-2026-005');
    expect(result.biens[0].statut).toBe('Vendu');
  });

  it('vague query on Frejus filters out Sous compromis EM-2026-003', () => {
    const result = searchBiens({ secteur: 'Frejus' });
    expect(result.result_count).toBe(0);
    const refs = result.biens.map(b => b.reference);
    expect(refs).not.toContain('EM-2026-003');
  });

  it('vague query on Saint-Raphael filters out Vendu EM-2026-005', () => {
    const result = searchBiens({ secteur: 'Saint-Raphael' });
    expect(result.result_count).toBe(0);
    const refs = result.biens.map(b => b.reference);
    expect(refs).not.toContain('EM-2026-005');
  });

  it('vague query on Boulouris still returns the 2 Disponible biens', () => {
    const result = searchBiens({ secteur: 'Boulouris' });
    expect(result.result_count).toBe(2);
    const refs = result.biens.map(b => b.reference).sort();
    expect(refs).toEqual(['EM-2026-001', 'EM-2026-004']);
    for (const b of result.biens) {
      expect(b.statut).toBe('Disponible');
    }
  });

  it('vague query with type "maison" + secteur Frejus returns 0 (Sous compromis filtered)', () => {
    const result = searchBiens({ secteur: 'Frejus', type_bien: 'maison' });
    expect(result.result_count).toBe(0);
  });

  it('reproduces call_0ced bug scenario: Cas B exploratoire returns 0 instead of EM-2026-005', () => {
    const result = searchBiens({ secteur: 'Saint-Raphael', type_bien: 'maison', prix_approx: 850000 });
    expect(result.result_count).toBe(0);
    const refs = result.biens.map(b => b.reference);
    expect(refs).not.toContain('EM-2026-005');
  });
});

describe('formatResponse', () => {
  it('strips prix from output even if present in input Bien', () => {
    const response = formatResponse([TEST_BIENS[0]]);
    expect(response.biens[0]).not.toHaveProperty('prix');
    expect(response.biens[0]).not.toHaveProperty('visitable');
    expect(response.biens[0]).not.toHaveProperty('dpe');
    expect(response.biens[0]).not.toHaveProperty('charges');
    expect(response.biens[0]).not.toHaveProperty('taxe_fonciere');
  });
});
