import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import type { Bien } from '../types/bien.js';

let cachedBiens: Bien[] = [];
let lastRefresh: Date | null = null;

export function getCachedBiens(): Bien[] {
  return cachedBiens;
}

export function getLastRefresh(): Date | null {
  return lastRefresh;
}

export function loadTestData(biens: Bien[]): void {
  cachedBiens = biens;
  lastRefresh = new Date();
}

export async function refreshCache(): Promise<void> {
  try {
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const sheetId = process.env.GOOGLE_SHEET_ID;

    if (!email || !key || !sheetId) {
      console.warn('[sheets] Missing Google credentials -- skipping refresh');
      return;
    }

    const auth = new JWT({
      email,
      key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const doc = new GoogleSpreadsheet(sheetId, auth);
    await doc.loadInfo();

    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    cachedBiens = rows.map((row) => ({
      reference: row.get('Reference') || '',
      type: row.get('Type') || '',
      secteur: row.get('Secteur') || '',
      surface_m2: parseInt(row.get('Surface'), 10) || 0,
      pieces: parseInt(row.get('Pieces'), 10) || 0,
      chambres: parseInt(row.get('Chambres'), 10) || 0,
      prix: parseInt(row.get('Prix'), 10) || 0,
      statut: row.get('Statut') || '',
      arguments: row.get('Arguments') || '',
      acces_libre: row.get('Acces libre') === 'Oui',
      visitable: row.get('Visitable') === 'Oui',
    }));

    lastRefresh = new Date();
    console.log(`[sheets] Cache refreshed: ${cachedBiens.length} biens loaded`);
  } catch (error) {
    // On error, keep existing cache (stale data better than no data)
    console.error('[sheets] Cache refresh failed:', error);
  }
}

export function startCacheRefresh(intervalMs: number): NodeJS.Timeout {
  refreshCache();
  return setInterval(refreshCache, intervalMs);
}
