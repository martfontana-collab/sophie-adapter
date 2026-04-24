import type { Score } from '../types/fiche.js';

export function scoreProspect(data: {
  budget: string;
  financement: string;
  timing: string;
}): Score {
  let points = 0;

  // Budget: mentioned and not empty = +1
  if (data.budget && data.budget !== '' && data.budget !== 'non_mentionne') {
    points++;
  }

  // Financement: pre-accord or pret en cours = +2, apport seul = +1
  if (data.financement === 'pre_accord_bancaire' || data.financement === 'pret_en_cours') {
    points += 2;
  } else if (data.financement === 'apport_seul') {
    points += 1;
  }

  // Timing: urgent = +2, 3 mois = +1
  if (data.timing === 'urgent') {
    points += 2;
  } else if (data.timing === '3_mois') {
    points += 1;
  }

  // Score mapping: 4-5 = chaud, 2-3 = tiede, 0-1 = froid
  if (points >= 4) return 'chaud';
  if (points >= 2) return 'tiede';
  return 'froid';
}
