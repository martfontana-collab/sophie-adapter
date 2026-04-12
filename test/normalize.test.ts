import { describe, it, expect } from 'vitest';
import { resolveAlias } from '../src/utils/normalize.js';

describe('resolveAlias', () => {
  it('resolves "val escur" to "Valescure"', () => {
    expect(resolveAlias('val escur')).toBe('Valescure');
  });

  it('resolves "boulouri" to "Boulouris"', () => {
    expect(resolveAlias('boulouri')).toBe('Boulouris');
  });

  it('resolves "st raph" to "Saint-Raphael"', () => {
    expect(resolveAlias('st raph')).toBe('Saint-Raphael');
  });

  it('passes through "Frejus" unchanged (exact match, no alias needed)', () => {
    expect(resolveAlias('Frejus')).toBe('Frejus');
  });

  it('resolves "boulourie" to "Boulouris"', () => {
    expect(resolveAlias('boulourie')).toBe('Boulouris');
  });
});

describe('BienSafe type safety', () => {
  it('BienSafe does NOT include prix, dpe, charges, taxe_fonciere fields', async () => {
    const typeSource = await import('fs').then(fs =>
      fs.readFileSync(new URL('../src/types/bien.ts', import.meta.url), 'utf-8')
    );

    // Extract BienSafe interface block
    const bienSafeMatch = typeSource.match(/export interface BienSafe \{([^}]+)\}/);
    expect(bienSafeMatch).not.toBeNull();

    const bienSafeBody = bienSafeMatch![1];
    expect(bienSafeBody).not.toContain('prix');
    expect(bienSafeBody).not.toContain('dpe');
    expect(bienSafeBody).not.toContain('charges');
    expect(bienSafeBody).not.toContain('taxe_fonciere');
  });
});
