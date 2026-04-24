import { describe, it, expect } from 'vitest';
import { scoreProspect } from './scoring.js';

describe('scoreProspect', () => {
  it('returns chaud for budget + pre_accord_bancaire + urgent (5 points)', () => {
    expect(scoreProspect({ budget: '300000', financement: 'pre_accord_bancaire', timing: 'urgent' })).toBe('chaud');
  });

  it('returns chaud for budget + pret_en_cours + 3_mois (4 points)', () => {
    expect(scoreProspect({ budget: '250000', financement: 'pret_en_cours', timing: '3_mois' })).toBe('chaud');
  });

  it('returns froid for empty budget + apport_seul + 6_mois (1 point)', () => {
    expect(scoreProspect({ budget: '', financement: 'apport_seul', timing: '6_mois' })).toBe('froid');
  });

  it('returns froid for all non_mentionne (0 points)', () => {
    expect(scoreProspect({ budget: '', financement: 'non_mentionne', timing: 'non_mentionne' })).toBe('froid');
  });

  it('returns tiede for budget + non_mentionne + urgent (3 points)', () => {
    expect(scoreProspect({ budget: '200000', financement: 'non_mentionne', timing: 'urgent' })).toBe('tiede');
  });

  it('returns tiede for budget + apport_seul + 3_mois (3 points)', () => {
    expect(scoreProspect({ budget: '200000', financement: 'apport_seul', timing: '3_mois' })).toBe('tiede');
  });

  it('handles undefined/null values without throwing', () => {
    expect(() => scoreProspect({
      budget: undefined as unknown as string,
      financement: null as unknown as string,
      timing: undefined as unknown as string,
    })).not.toThrow();
  });

  it('returns froid for undefined/null values (0 points)', () => {
    const result = scoreProspect({
      budget: undefined as unknown as string,
      financement: null as unknown as string,
      timing: undefined as unknown as string,
    });
    expect(result).toBe('froid');
  });
});
