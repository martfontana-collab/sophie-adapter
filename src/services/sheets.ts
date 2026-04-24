import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import type { Bien } from '../types/bien.js';
import type { FicheProspect } from '../types/fiche.js';

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

function getAuth(): JWT {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!email || !key) throw new Error('Missing Google credentials');
  return new JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

function getDoc(): GoogleSpreadsheet {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error('Missing GOOGLE_SHEET_ID');
  return new GoogleSpreadsheet(sheetId, getAuth());
}

export async function refreshCache(): Promise<void> {
  try {
    const doc = getDoc();
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
    console.error('[sheets] Cache refresh failed:', error);
  }
}

export function startCacheRefresh(intervalMs: number): NodeJS.Timeout {
  refreshCache();
  return setInterval(refreshCache, intervalMs);
}

// --- Prospect writing ---

const PROSPECT_HEADERS = [
  'Date', 'Nom', 'Telephone', 'Bien', 'Type', 'Budget',
  'Financement', 'Timing', 'Score', 'Resume', 'RDV', 'Date RDV', 'Retour visite',
];

async function ensureProspectsSheet(doc: GoogleSpreadsheet) {
  let sheet = doc.sheetsByTitle['Prospects'];
  if (!sheet) {
    sheet = await doc.addSheet({ title: 'Prospects', headerValues: PROSPECT_HEADERS });
    console.log('[sheets] Created Prospects tab');
  }
  return sheet;
}

export async function writeProspect(fiche: FicheProspect): Promise<void> {
  const doc = getDoc();
  await doc.loadInfo();
  const sheet = await ensureProspectsSheet(doc);

  await sheet.addRow({
    Date: new Date().toLocaleDateString('fr-FR'),
    Nom: fiche.nom,
    Telephone: fiche.telephone,
    Bien: fiche.bien,
    Type: fiche.type_appel,
    Budget: fiche.budget,
    Financement: fiche.financement,
    Timing: fiche.timing,
    Score: fiche.score,
    Resume: fiche.resume,
    RDV: fiche.rdv_programme ? 'Oui' : 'Non',
    'Date RDV': fiche.rdv_date || '',
    'Retour visite': '',
  });

  console.log(`[sheets] Prospect written: ${fiche.nom} | ${fiche.bien}`);
}

// --- Prospect stats ---

export interface ProspectStats {
  [reference: string]: {
    appels: number;
    visites_planifiees: number;
    prospects_chauds: number;
  };
}

export async function getProspectStats(afterDate?: Date): Promise<ProspectStats> {
  const doc = getDoc();
  await doc.loadInfo();

  const sheet = doc.sheetsByTitle['Prospects'];
  if (!sheet) return {};

  const rows = await sheet.getRows();
  const stats: ProspectStats = {};

  for (const row of rows) {
    const bien = row.get('Bien') || '';
    if (!bien || bien === 'Non precise') continue;

    // Filter by date if provided
    if (afterDate) {
      const dateStr = row.get('Date') || '';
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const rowDate = new Date(+parts[2], +parts[1] - 1, +parts[0]);
        if (rowDate < afterDate) continue;
      }
    }

    if (!stats[bien]) {
      stats[bien] = { appels: 0, visites_planifiees: 0, prospects_chauds: 0 };
    }

    stats[bien].appels++;

    if ((row.get('RDV') || '').toLowerCase() === 'oui') {
      stats[bien].visites_planifiees++;
    }

    if ((row.get('Score') || '').toLowerCase() === 'chaud') {
      stats[bien].prospects_chauds++;
    }
  }

  return stats;
}
