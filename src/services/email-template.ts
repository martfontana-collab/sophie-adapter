import type { FicheProspect } from '../types/fiche.js';
import type { Bien } from '../types/bien.js';
import type { PartialInfo } from './partial-transcript-parser.js';

interface ScoreTheme {
  bg: string;
  text: string;
  label: string;
}

const THEMES: Record<FicheProspect['score'], ScoreTheme> = {
  chaud: { bg: '#C0392B', text: '#FFFFFF', label: 'PROSPECT CHAUD' },
  tiede: { bg: '#D4A855', text: '#1B3A5C', label: 'PROSPECT TIÈDE' },
  froid: { bg: '#7FA8C9', text: '#FFFFFF', label: 'PROSPECT FROID' },
};

function esc(s: string | number | null | undefined): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isEmpty(v: string | null | undefined): boolean {
  if (!v) return true;
  const s = v.toLowerCase().trim();
  return (
    s === '' ||
    s === 'non communique' ||
    s === 'non communiqué' ||
    s === 'non_mentionne' ||
    s === 'non mentionné' ||
    s === 'non precise' ||
    s === 'non précisé' ||
    s === 'inconnu'
  );
}

const VALUE_MAP: Record<string, string> = {
  // type_appel
  bien_specifique: 'bien spécifique',
  recherche_generale: 'recherche générale',
  renseignement: 'renseignement',
  // financement
  pre_accord_bancaire: 'pré-accord bancaire',
  pret_en_cours: 'prêt en cours',
  pret_valide: 'prêt validé',
  apport_seul: 'apport seul',
  au_comptant: 'au comptant',
  en_cours: 'en cours',
  // timing (enum Retell: urgent, 3_mois, 6_mois, sans_pression + variantes hors enum)
  '3_mois': 'sous 3 mois',
  '6_mois': "d'ici 6 mois",
  sans_pression: 'sans urgence',
  sous_3_mois: 'sous 3 mois',
  d_ici_6_mois: "d'ici 6 mois",
  // profil
  primo_accedant: 'primo-accédant',
  investisseur: 'investisseur',
  residence_principale: 'résidence principale',
  residence_secondaire: 'résidence secondaire',
  investissement_locatif: 'investissement locatif',
  deja_proprietaire: 'déjà propriétaire',
  // common
  non_mentionne: 'non mentionné',
  a_classer: 'à classer',
};

function humanize(v: string): string {
  const key = v.toLowerCase().trim();
  return VALUE_MAP[key] ?? v.replace(/_/g, ' ');
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec === 0 ? `${min} min` : `${min} min ${sec}s`;
}

function formatCallDate(): string {
  return new Date().toLocaleString('fr-FR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  });
}

function formatPrice(prix: number): string {
  return new Intl.NumberFormat('fr-FR').format(prix) + ' €';
}

export function renderProspectEmail(
  fiche: FicheProspect,
  bien?: Bien,
): { subject: string; html: string; text: string } {
  const theme = THEMES[fiche.score];
  return {
    subject: buildSubject(fiche, bien),
    html: buildHtml(fiche, theme, bien),
    text: buildText(fiche, theme, bien),
  };
}

function buildSubject(fiche: FicheProspect, bien?: Bien): string {
  const bienLabel = bien ? bien.reference : null;

  if (fiche.score === 'chaud') {
    const budget = !isEmpty(fiche.budget) ? ` — Budget ${fiche.budget}` : '';
    const bienPart = bienLabel ? ` — ${bienLabel}` : '';
    return `Prospect CHAUD${bienPart}${budget}`;
  }
  if (fiche.score === 'tiede') {
    const info = !isEmpty(fiche.timing)
      ? humanize(fiche.timing)
      : !isEmpty(fiche.budget)
        ? `Budget ${fiche.budget}`
        : 'à qualifier';
    const bienPart = bienLabel ? ` — ${bienLabel}` : '';
    return `Prospect TIÈDE${bienPart} — ${info}`;
  }
  const bienPart = bienLabel ? ` — ${bienLabel}` : '';
  return `Prospect FROID${bienPart} — À classer`;
}

function buildHtml(fiche: FicheProspect, theme: ScoreTheme, bien?: Bien): string {
  const callDate = formatCallDate();
  const duration = formatDuration(fiche.duree_secondes);
  const qualifRows = buildQualifRows(fiche);
  const bienBlock = bien ? buildBienBlock(bien) : '';
  const rdvBlock = fiche.rdv_programme ? buildRdvBlock(fiche) : '';
  const preheader = `${esc(fiche.nom)} — ${esc(fiche.telephone)}`;
  const telHref = esc(fiche.telephone.replace(/\s/g, ''));

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>Fiche prospect</title>
</head>
<body style="margin:0;padding:0;background-color:#F5EFE6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#2C3E50;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#F5EFE6;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F5EFE6" style="background-color:#F5EFE6;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(27,58,92,0.08);">

      <tr><td style="padding:28px 32px 16px 32px;border-bottom:1px solid #EDE4D3;">
        <div style="font-size:22px;font-weight:700;color:#1B3A5C;letter-spacing:-0.3px;">Sophie</div>
        <div style="font-size:13px;color:#8B7968;margin-top:2px;">Assistante d'Emilie Catinella</div>
      </td></tr>

      <tr><td style="background-color:${theme.bg};color:${theme.text};padding:16px 32px;text-align:center;">
        <div style="font-size:16px;font-weight:700;letter-spacing:1.5px;">${theme.label}</div>
      </td></tr>

      <tr><td style="padding:24px 32px 16px 32px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#8B7968;margin-bottom:8px;">Prospect</div>
        <div style="font-size:20px;font-weight:700;color:#1B3A5C;margin-bottom:6px;">${esc(fiche.nom)}</div>
        <div style="font-size:14px;color:#2C3E50;line-height:1.6;">
          <a href="tel:${telHref}" style="color:#D97040;text-decoration:none;font-weight:600;">${esc(fiche.telephone)}</a><br>
          <span style="color:#8B7968;font-size:12px;">Appel reçu le ${esc(callDate)} — ${esc(duration)}</span>
        </div>
      </td></tr>

      ${bienBlock}

      ${qualifRows
        ? `<tr><td style="padding:8px 32px 16px 32px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#8B7968;margin-bottom:12px;">Qualification</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${qualifRows}
        </table>
      </td></tr>`
        : ''}

      <tr><td style="padding:8px 32px 16px 32px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#8B7968;margin-bottom:8px;">Résumé de l'appel</div>
        <div style="font-size:14px;color:#2C3E50;line-height:1.6;background-color:#FAF6EE;padding:14px 16px;border-left:3px solid #D97040;border-radius:2px;">
          ${esc(fiche.resume)}
        </div>
      </td></tr>

      ${rdvBlock}

      <tr><td style="padding:20px 32px;border-top:1px solid #EDE4D3;background-color:#FAF6EE;text-align:center;">
        <div style="font-size:12px;color:#8B7968;">Sophie, ton assistante IA</div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function buildQualifRows(fiche: FicheProspect): string {
  const rows: Array<[string, string]> = [];
  if (!isEmpty(fiche.budget)) rows.push(['Budget', fiche.budget]);
  if (!isEmpty(fiche.financement)) rows.push(['Financement', humanize(fiche.financement)]);
  if (!isEmpty(fiche.timing)) rows.push(['Timing', humanize(fiche.timing)]);
  if (!isEmpty(fiche.profil)) rows.push(['Profil', humanize(fiche.profil)]);
  if (!isEmpty(fiche.type_appel)) rows.push(["Type d'appel", humanize(fiche.type_appel)]);

  return rows
    .map(
      ([label, value]) => `<tr>
      <td width="40%" style="font-size:13px;color:#8B7968;padding:6px 12px 6px 0;vertical-align:top;">${esc(label)}</td>
      <td style="font-size:14px;color:#2C3E50;font-weight:600;padding:6px 0;vertical-align:top;">${esc(value)}</td>
    </tr>`,
    )
    .join('');
}

function buildBienBlock(bien: Bien): string {
  const attrs: string[] = [];
  if (bien.surface_m2) attrs.push(`${bien.surface_m2} m²`);
  if (bien.pieces) attrs.push(`${bien.pieces} pièces`);
  if (bien.chambres) attrs.push(`${bien.chambres} chambres`);
  const prix = bien.prix ? formatPrice(bien.prix) : '';
  const meta = [bien.type, bien.secteur].filter(Boolean).join(' — ');
  const attrsLine = attrs.join(' · ');

  return `<tr><td style="padding:8px 32px 16px 32px;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#8B7968;margin-bottom:10px;">Bien concerné</div>
    <div style="background-color:#FAF6EE;border:1px solid #EDE4D3;border-radius:6px;padding:16px;">
      <div style="font-size:16px;font-weight:700;color:#1B3A5C;margin-bottom:4px;">Réf. ${esc(bien.reference)}</div>
      ${meta ? `<div style="font-size:13px;color:#8B7968;margin-bottom:4px;">${esc(meta)}</div>` : ''}
      ${attrsLine || prix
        ? `<div style="font-size:14px;color:#2C3E50;margin-top:8px;">${esc(attrsLine)}${prix ? `<span style="color:#D97040;font-weight:700;margin-left:8px;">${esc(prix)}</span>` : ''}</div>`
        : ''}
    </div>
  </td></tr>`;
}

function buildRdvBlock(fiche: FicheProspect): string {
  const rdvStr = fiche.rdv_date ? esc(fiche.rdv_date) : 'À confirmer';
  return `<tr><td style="padding:8px 32px 16px 32px;">
    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#8B7968;margin-bottom:10px;">Rendez-vous proposé</div>
    <div style="background-color:#FFF8E8;border:2px solid #D4A855;border-radius:6px;padding:16px;text-align:center;">
      <div style="font-size:16px;font-weight:700;color:#1B3A5C;margin-bottom:14px;">${rdvStr}</div>
      <a href="#" style="display:inline-block;background-color:#D97040;color:#FFFFFF;font-size:13px;font-weight:600;text-decoration:none;padding:10px 20px;border-radius:4px;">Ajouter à mon agenda</a>
    </div>
  </td></tr>`;
}

function buildText(fiche: FicheProspect, theme: ScoreTheme, bien?: Bien): string {
  const lines: string[] = [theme.label, ''];
  lines.push(`Prospect : ${fiche.nom}`);
  lines.push(`Téléphone : ${fiche.telephone}`);
  lines.push(`Appel : ${formatCallDate()} — ${formatDuration(fiche.duree_secondes)}`);
  lines.push('');

  if (bien) {
    lines.push(`Bien concerné : Réf. ${bien.reference}`);
    const meta = [bien.type, bien.secteur].filter(Boolean).join(' — ');
    if (meta) lines.push(`  ${meta}`);
    const attrs: string[] = [];
    if (bien.surface_m2) attrs.push(`${bien.surface_m2} m²`);
    if (bien.pieces) attrs.push(`${bien.pieces} pièces`);
    if (bien.chambres) attrs.push(`${bien.chambres} chambres`);
    if (attrs.length) lines.push(`  ${attrs.join(' · ')}`);
    if (bien.prix) lines.push(`  ${formatPrice(bien.prix)}`);
    lines.push('');
  }

  const qualif: string[] = [];
  if (!isEmpty(fiche.budget)) qualif.push(`Budget : ${fiche.budget}`);
  if (!isEmpty(fiche.financement)) qualif.push(`Financement : ${humanize(fiche.financement)}`);
  if (!isEmpty(fiche.timing)) qualif.push(`Timing : ${humanize(fiche.timing)}`);
  if (!isEmpty(fiche.profil)) qualif.push(`Profil : ${humanize(fiche.profil)}`);
  if (qualif.length) {
    lines.push(...qualif);
    lines.push('');
  }

  lines.push('Résumé :');
  lines.push(fiche.resume);

  if (fiche.rdv_programme) {
    lines.push('');
    lines.push(`Rendez-vous proposé : ${fiche.rdv_date || 'à confirmer'}`);
  }

  lines.push('', '—', 'Sophie, ton assistante IA');
  return lines.join('\n');
}

// ============================================================================
// MISSED CALL (<5s) — Cas C from FIX 5
// ============================================================================

export interface MissedCallInfo {
  callerId: string | null;
  durationSec: number;
  callDate: string; // ISO or formatted; we format inside
}

export function renderMissedCallEmail(info: MissedCallInfo): {
  subject: string;
  html: string;
  text: string;
} {
  const { formatted, hour } = formatCallDateParts(info.callDate);
  const duration = formatDuration(info.durationSec);
  const phoneLine = info.callerId
    ? `<a href="tel:${esc(info.callerId.replace(/\s/g, ''))}" style="color:#D97040;text-decoration:none;font-weight:600;">${esc(info.callerId)}</a>`
    : `<span style="color:#8B7968;font-style:italic;">Numéro masqué</span>`;
  const preheader = `Appel raté à ${hour}${info.callerId ? ` — ${esc(info.callerId)}` : ''}`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>Appel raté</title>
</head>
<body style="margin:0;padding:0;background-color:#F5EFE6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#2C3E50;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#F5EFE6;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F5EFE6" style="background-color:#F5EFE6;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(27,58,92,0.08);">

      <tr><td style="padding:28px 32px 16px 32px;border-bottom:1px solid #EDE4D3;">
        <div style="font-size:22px;font-weight:700;color:#1B3A5C;letter-spacing:-0.3px;">Sophie</div>
        <div style="font-size:13px;color:#8B7968;margin-top:2px;">Assistante d'Emilie Catinella</div>
      </td></tr>

      <tr><td style="background-color:#555555;color:#FFFFFF;padding:16px 32px;text-align:center;">
        <div style="font-size:16px;font-weight:700;letter-spacing:1.5px;">APPEL RATÉ</div>
      </td></tr>

      <tr><td style="padding:24px 32px 24px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="40%" style="font-size:13px;color:#8B7968;padding:6px 12px 6px 0;vertical-align:top;">Heure</td>
            <td style="font-size:14px;color:#2C3E50;font-weight:600;padding:6px 0;vertical-align:top;">${esc(formatted)}</td>
          </tr>
          <tr>
            <td width="40%" style="font-size:13px;color:#8B7968;padding:6px 12px 6px 0;vertical-align:top;">Durée</td>
            <td style="font-size:14px;color:#2C3E50;font-weight:600;padding:6px 0;vertical-align:top;">${esc(duration)}</td>
          </tr>
          <tr>
            <td width="40%" style="font-size:13px;color:#8B7968;padding:6px 12px 6px 0;vertical-align:top;">Téléphone</td>
            <td style="font-size:14px;padding:6px 0;vertical-align:top;">${phoneLine}</td>
          </tr>
        </table>
      </td></tr>

      <tr><td style="padding:20px 32px;border-top:1px solid #EDE4D3;background-color:#FAF6EE;text-align:center;">
        <div style="font-size:12px;color:#8B7968;">Sophie, ton assistante IA</div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

  const text = [
    'APPEL RATÉ',
    '',
    `Heure : ${formatted}`,
    `Durée : ${duration}`,
    `Téléphone : ${info.callerId ?? 'Numéro masqué'}`,
    '',
    '—',
    'Sophie, ton assistante IA',
  ].join('\n');

  return {
    subject: `Appel raté — ${hour}`,
    html,
    text,
  };
}

// ============================================================================
// INTERRUPTED CALL (>=5s, no call_analyzed) — Cas B from FIX 5
// ============================================================================

export interface InterruptedCallInfo {
  callerId: string | null;
  durationSec: number;
  callDate: string;
  partial: PartialInfo;
  transcript: string;
}

export function renderInterruptedCallEmail(info: InterruptedCallInfo): {
  subject: string;
  html: string;
  text: string;
} {
  const { formatted } = formatCallDateParts(info.callDate);
  const duration = formatDuration(info.durationSec);
  const nameLine = info.partial.name
    ? `<div style="font-size:20px;font-weight:700;color:#1B3A5C;margin-bottom:6px;">${esc(info.partial.name)}</div>`
    : '';
  const phoneHref = info.callerId
    ? `<a href="tel:${esc(info.callerId.replace(/\s/g, ''))}" style="color:#D97040;text-decoration:none;font-weight:600;">${esc(info.callerId)}</a>`
    : info.partial.phone
      ? `<a href="tel:${esc(info.partial.phone.replace(/\s/g, ''))}" style="color:#D97040;text-decoration:none;font-weight:600;">${esc(info.partial.phone)}</a> <span style="color:#8B7968;font-size:11px;">(mentionné)</span>`
      : `<span style="color:#8B7968;font-style:italic;">Numéro masqué</span>`;

  const notedRows: Array<[string, string]> = [];
  if (info.partial.intent) notedRows.push(['Intention', info.partial.intent]);
  if (info.partial.property_mentioned) notedRows.push(['Bien évoqué', info.partial.property_mentioned]);

  const notedBlock = notedRows.length
    ? `<tr><td style="padding:8px 32px 16px 32px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#8B7968;margin-bottom:12px;">Ce que j'ai pu noter</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${notedRows
            .map(
              ([label, value]) => `<tr>
            <td width="35%" style="font-size:13px;color:#8B7968;padding:6px 12px 6px 0;vertical-align:top;">${esc(label)}</td>
            <td style="font-size:14px;color:#2C3E50;font-weight:600;padding:6px 0;vertical-align:top;">${esc(value)}</td>
          </tr>`,
            )
            .join('')}
        </table>
      </td></tr>`
    : '';

  const transcriptExcerpt = info.transcript?.trim().slice(0, 500) ?? '';
  const transcriptBlock = transcriptExcerpt
    ? `<tr><td style="padding:8px 32px 16px 32px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#8B7968;margin-bottom:8px;">Extrait de conversation</div>
        <div style="font-size:13px;color:#2C3E50;line-height:1.6;background-color:#FAF6EE;padding:14px 16px;border-left:3px solid #D97040;border-radius:2px;font-style:italic;">${esc(transcriptExcerpt)}${info.transcript.length > 500 ? '…' : ''}</div>
      </td></tr>`
    : '';

  const preheader = info.partial.name
    ? `Appel interrompu — ${esc(info.partial.name)}`
    : `Appel interrompu — ${duration}`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>Appel interrompu</title>
</head>
<body style="margin:0;padding:0;background-color:#F5EFE6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#2C3E50;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#F5EFE6;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F5EFE6" style="background-color:#F5EFE6;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background-color:#FFFFFF;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(27,58,92,0.08);">

      <tr><td style="padding:28px 32px 16px 32px;border-bottom:1px solid #EDE4D3;">
        <div style="font-size:22px;font-weight:700;color:#1B3A5C;letter-spacing:-0.3px;">Sophie</div>
        <div style="font-size:13px;color:#8B7968;margin-top:2px;">Assistante d'Emilie Catinella</div>
      </td></tr>

      <tr><td style="background-color:#D97040;color:#FFFFFF;padding:16px 32px;text-align:center;">
        <div style="font-size:16px;font-weight:700;letter-spacing:1.5px;">APPEL INTERROMPU</div>
      </td></tr>

      <tr><td style="padding:24px 32px 16px 32px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.2px;color:#8B7968;margin-bottom:8px;">Appelant</div>
        ${nameLine}
        <div style="font-size:14px;color:#2C3E50;line-height:1.6;">
          ${phoneHref}<br>
          <span style="color:#8B7968;font-size:12px;">${esc(formatted)} — ${esc(duration)}</span>
        </div>
      </td></tr>

      ${notedBlock}

      ${transcriptBlock}

      <tr><td style="padding:8px 32px 24px 32px;">
        <div style="background-color:#FFF4EC;border:1px solid #F2C9AE;border-radius:6px;padding:14px 16px;">
          <div style="font-size:13px;color:#8B4513;line-height:1.5;">
            Tu peux rappeler ce numéro pour savoir si c'était un prospect sérieux.
          </div>
        </div>
      </td></tr>

      <tr><td style="padding:20px 32px;border-top:1px solid #EDE4D3;background-color:#FAF6EE;text-align:center;">
        <div style="font-size:12px;color:#8B7968;">Sophie, ton assistante IA</div>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

  const textLines: string[] = ['APPEL INTERROMPU', ''];
  if (info.partial.name) textLines.push(`Appelant : ${info.partial.name}`);
  textLines.push(`Téléphone : ${info.callerId ?? info.partial.phone ?? 'Numéro masqué'}`);
  textLines.push(`Appel : ${formatted} — ${duration}`);
  textLines.push('');
  if (info.partial.intent) textLines.push(`Intention : ${info.partial.intent}`);
  if (info.partial.property_mentioned) textLines.push(`Bien évoqué : ${info.partial.property_mentioned}`);
  if (transcriptExcerpt) {
    textLines.push('', 'Extrait de conversation :', transcriptExcerpt);
  }
  textLines.push('', 'Tu peux rappeler ce numéro pour savoir si c\'était un prospect sérieux.');
  textLines.push('', '—', 'Sophie, ton assistante IA');

  return {
    subject: `Appel interrompu — ${duration}`,
    html,
    text: textLines.join('\n'),
  };
}

function formatCallDateParts(iso: string): { formatted: string; hour: string } {
  const d = new Date(iso);
  const formatted = d.toLocaleString('fr-FR', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  });
  const hour = d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Paris',
  });
  return { formatted, hour };
}
