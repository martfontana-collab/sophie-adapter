import { Resend } from 'resend';
import type { FicheProspect } from '../types/fiche.js';
import type { Bien } from '../types/bien.js';
import {
  renderProspectEmail,
  renderMissedCallEmail,
  renderInterruptedCallEmail,
  type MissedCallInfo,
  type InterruptedCallInfo,
} from './email-template.js';

let _resend: Resend | null = null;

function getResendClient(): Resend {
  if (!_resend) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error('[email] Missing RESEND_API_KEY');
    _resend = new Resend(apiKey);
  }
  return _resend;
}

function resolveRecipient(): { to: string; bcc?: string[] } {
  const override = process.env.TEST_EMAIL_OVERRIDE?.trim();
  const emilie = process.env.EMILIE_EMAIL?.trim();
  const monitor = process.env.MONITOR_BCC?.trim();

  const to = override || emilie;
  if (!to) throw new Error('[email] Missing EMILIE_EMAIL (and no TEST_EMAIL_OVERRIDE)');

  const bcc = !override && monitor ? [monitor] : undefined;
  return { to, bcc };
}

async function sendWithRendered(
  rendered: { subject: string; html: string; text: string },
  logLabel: string,
): Promise<boolean> {
  try {
    const { to, bcc } = resolveRecipient();
    await getResendClient().emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Sophie <onboarding@resend.dev>',
      to,
      bcc,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
    const mode = process.env.TEST_EMAIL_OVERRIDE ? 'test' : 'prod';
    console.log(`[email] ${logLabel} sent (${mode}) → ${to}`);
    return true;
  } catch (error) {
    console.error('[email] Send failed:', error);
    return false;
  }
}

export async function sendProspectEmail(fiche: FicheProspect, bien?: Bien): Promise<boolean> {
  return sendWithRendered(
    renderProspectEmail(fiche, bien),
    `Prospect email: ${fiche.nom} (${fiche.score})`,
  );
}

export async function sendMissedCallEmail(info: MissedCallInfo): Promise<boolean> {
  return sendWithRendered(
    renderMissedCallEmail(info),
    `Missed call (${info.durationSec}s)`,
  );
}

export async function sendInterruptedCallEmail(info: InterruptedCallInfo): Promise<boolean> {
  return sendWithRendered(
    renderInterruptedCallEmail(info),
    `Interrupted call (${info.durationSec}s, name=${info.partial.name ?? 'null'})`,
  );
}
