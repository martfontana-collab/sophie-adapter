import { Router } from 'express';
import type { Request, Response } from 'express';
import { verify as retellVerify } from 'retell-sdk';
import type { RetellWebhookPayload, FicheProspect } from '../types/fiche.js';
import { scoreProspect } from '../services/scoring.js';
import { sendWhatsApp } from '../services/whatsapp.js';
import {
  sendProspectEmail,
  sendMissedCallEmail,
  sendInterruptedCallEmail,
} from '../services/email.js';
import { writeProspect, getCachedBiens } from '../services/sheets.js';
import { schedulePendingCall, markCallAnalyzed } from '../services/call-state.js';
import { parsePartialTranscript } from '../services/partial-transcript-parser.js';

const router = Router();

const SHORT_CALL_THRESHOLD_SEC = 5;

/**
 * Authenticate an incoming webhook request. Two accepted paths:
 *   (1) Retell HMAC signature in `x-retell-signature` over the raw body,
 *       HMAC-SHA256 with RETELL_API_KEY. Used by production Retell calls.
 *   (2) Bearer token in `authorization` matching WEBHOOK_SECRET. Used by
 *       admin / dev testing (e.g. manual curl).
 * Returns true if either path succeeds. Uses timingSafeEqual to avoid
 * timing side-channels on token comparison.
 */
async function authenticate(req: Request): Promise<boolean> {
  const signature = req.headers['x-retell-signature'] as string | undefined;
  if (signature) {
    const apiKey = process.env.RETELL_API_KEY;
    const rawBody = (req as Request & { rawBody?: string }).rawBody;
    if (!apiKey || !rawBody) {
      console.warn(`[auth] Missing apiKey=${!!apiKey} rawBody=${!!rawBody}`);
      return false;
    }
    try {
      // Retell signs as "v=<timestamp>,d=<hmac-sha256(body+timestamp)>"
      // with a ±5min freshness window. Use the SDK's verify to match exactly.
      const ok = await retellVerify(rawBody, apiKey, signature);
      if (!ok) {
        console.warn(
          `[auth] Retell signature rejected. sig=${signature.slice(0, 24)}... bodyLen=${rawBody.length}`,
        );
      }
      return ok;
    } catch (err) {
      console.error('[auth] Retell verify error:', err);
      return false;
    }
  }

  const authHeader = req.headers['authorization'] as string | undefined;
  const expectedToken = process.env.WEBHOOK_SECRET;
  if (authHeader && expectedToken) {
    return authHeader === `Bearer ${expectedToken}`;
  }

  return false;
}

router.post('/webhook/call-ended', async (req: Request, res: Response) => {
  if (!(await authenticate(req))) {
    res.sendStatus(401);
    return;
  }

  const payload = req.body as RetellWebhookPayload;

  if (!payload?.event || !payload?.call?.call_id) {
    console.warn('[webhook] Malformed payload received');
    res.sendStatus(400);
    return;
  }

  // Ignore events we don't care about (e.g. call_started)
  if (payload.event !== 'call_ended' && payload.event !== 'call_analyzed') {
    res.sendStatus(200);
    return;
  }

  // Respond immediately to avoid Retell 10-second timeout
  res.sendStatus(200);

  try {
    if (payload.event === 'call_ended') {
      await handleCallEnded(payload);
    } else {
      await handleCallAnalyzed(payload);
    }
  } catch (error) {
    console.error('[webhook]', error);
  }
});

async function handleCallEnded(payload: RetellWebhookPayload): Promise<void> {
  const call = payload.call;
  const callId = call.call_id;
  const durationSec = Math.round((call.duration_ms ?? 0) / 1000);
  const callerId = call.from_number ?? null;
  const callDate = new Date().toISOString();

  console.log(`[webhook] call_ended: ${callId} duration=${durationSec}s`);

  // Cas C — very short call, send "missed" email immediately
  if (durationSec < SHORT_CALL_THRESHOLD_SEC) {
    await sendMissedCallEmail({ callerId, durationSec, callDate });
    return;
  }

  // Cas A or B — arm a fallback timer. If call_analyzed arrives within
  // the timeout (Cas A → full fiche), the timer is cancelled. Otherwise
  // the timer fires (Cas B → interrupted email with parsed partial).
  const transcript = call.transcript ?? '';
  schedulePendingCall(callId, async () => {
    console.log(`[webhook] Fallback firing for ${callId} — call_analyzed never arrived`);
    const partial = await parsePartialTranscript(transcript);
    await sendInterruptedCallEmail({
      callerId,
      durationSec,
      callDate,
      partial,
      transcript,
    });
  });
}

async function handleCallAnalyzed(payload: RetellWebhookPayload): Promise<void> {
  const call = payload.call;
  const callId = call.call_id;

  // Dedup — mark analyzed. If call_ended arrives AFTER call_analyzed
  // (observed in prod), schedulePendingCall() will see analyzedAt and skip
  // the timer. If call_ended arrived first, this cancels the pending timer.
  markCallAnalyzed(callId);

  console.log(`[webhook] Processing call_analyzed: ${callId}`);

  const analysis = call.call_analysis;
  if (!analysis?.custom_analysis_data) {
    console.warn(`[webhook] No custom_analysis_data for call: ${callId}`);
    return;
  }

  const data = analysis.custom_analysis_data;

  const nom = data.nom_prospect ?? 'Inconnu';
  const telephone = data.telephone ?? call.from_number ?? 'Non communique';
  const bien = data.bien_reference ?? 'Non precise';
  const type_appel = data.type_appel ?? 'autre';
  const budget = data.budget ?? 'Non communique';
  const financement = data.financement ?? 'non_mentionne';
  const timing = data.timing ?? 'non_mentionne';
  const profil = data.profil ?? 'non_mentionne';
  const rdv_programme = data.rdv_programme ?? false;
  const rdv_date = data.rdv_date ?? null;
  const resume = data.resume ?? analysis.call_summary ?? 'Pas de resume disponible';
  const transfert_effectue = data.transfert_effectue ?? false;
  const duree_secondes = Math.round((call.duration_ms ?? 0) / 1000);

  const score = scoreProspect({ budget, financement, timing });

  const fiche: FicheProspect = {
    nom,
    telephone,
    bien,
    type_appel,
    budget,
    financement,
    timing,
    profil,
    score,
    rdv_programme,
    rdv_date,
    resume,
    transfert_effectue,
    duree_secondes,
  };

  try {
    await writeProspect(fiche);
  } catch (sheetErr) {
    console.error('[webhook] Failed to write prospect to Sheets:', sheetErr);
  }

  const bienDetails = bien && bien !== 'Non precise'
    ? getCachedBiens().find((b) => b.reference === bien)
    : undefined;

  const [emailSent, whatsappSent] = await Promise.all([
    sendProspectEmail(fiche, bienDetails),
    sendWhatsApp(fiche),
  ]);

  if (!emailSent && !whatsappSent) {
    console.error('[CRITICAL] Both email and WhatsApp failed for prospect:', fiche.nom, fiche.telephone);
  }
}

export default router;
