import Twilio from 'twilio';
import type { FicheProspect } from '../types/fiche.js';

let _client: ReturnType<typeof Twilio> | null = null;
function getClient() {
  if (!_client) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      throw new Error('[whatsapp] Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
    }
    _client = Twilio(sid, token);
  }
  return _client;
}

export async function sendWhatsApp(fiche: FicheProspect): Promise<boolean> {
  try {
    const rdvLine = fiche.rdv_programme && fiche.rdv_date
      ? `\nRDV : ${fiche.rdv_date}`
      : '';

    const resumeWithRdv = fiche.resume + rdvLine;

    await getClient().messages.create({
      contentSid: process.env.TWILIO_WHATSAPP_TEMPLATE_SID!,
      contentVariables: JSON.stringify({
        '1': fiche.nom,
        '2': fiche.score.toUpperCase(),
        '3': fiche.telephone,
        '4': fiche.bien,
        '5': fiche.budget || 'Non communique',
        '6': fiche.timing === 'non_mentionne' ? 'Non communique' : fiche.timing.replace(/_/g, ' '),
        '7': resumeWithRdv,
      }),
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
      to: `whatsapp:${process.env.EMILIE_WHATSAPP_NUMBER}`,
    });

    console.log(`[whatsapp] Fiche sent for ${fiche.nom} (${fiche.score})`);
    return true;
  } catch (error) {
    console.error('[whatsapp] Send failed:', error);
    return false;
  }
}
