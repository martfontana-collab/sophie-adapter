import { Router } from 'express';
import type { Request, Response } from 'express';
import type { FicheProspect, Score } from '../types/fiche.js';
import {
  sendProspectEmail,
  sendMissedCallEmail,
  sendInterruptedCallEmail,
} from '../services/email.js';
import {
  renderProspectEmail,
  renderMissedCallEmail,
  renderInterruptedCallEmail,
} from '../services/email-template.js';
import { getCachedBiens } from '../services/sheets.js';

const router = Router();

function sampleFiche(score: Score, bienRef?: string): FicheProspect {
  const samples: Record<Score, Partial<FicheProspect>> = {
    chaud: {
      nom: 'Jean Dupont',
      telephone: '+33 6 12 34 56 78',
      budget: '450-500k€',
      financement: 'pret_en_cours',
      timing: 'sous_3_mois',
      profil: 'residence_principale',
      resume:
        'Jean cherche une résidence principale à Saint-Raphaël pour sa famille. Son prêt est en cours de validation, il souhaite visiter rapidement. Très motivé, fourchette budgétaire claire, disponible les après-midis en semaine.',
      rdv_programme: true,
      rdv_date: 'Mercredi 23 avril à 15h00',
    },
    tiede: {
      nom: 'Claire Martin',
      telephone: '+33 6 98 76 54 32',
      budget: '300-350k€',
      financement: 'non_mentionne',
      timing: 'd_ici_6_mois',
      profil: 'investissement_locatif',
      resume:
        "Claire explore le marché pour un investissement locatif. Pas de financement confirmé pour l'instant, timing flexible. A demandé des informations complémentaires sur 2 biens.",
      rdv_programme: false,
      rdv_date: null,
    },
    froid: {
      nom: 'Pierre Leblanc',
      telephone: '+33 6 11 22 33 44',
      budget: 'Non communique',
      financement: 'non_mentionne',
      timing: 'non_mentionne',
      profil: 'non_mentionne',
      resume:
        "Pierre a appelé par curiosité suite à une annonce vue en vitrine. Pas de projet défini, pas de budget arrêté. A demandé si l'agence propose des estimations gratuites.",
      rdv_programme: false,
      rdv_date: null,
    },
  };

  const base = samples[score];
  return {
    nom: base.nom!,
    telephone: base.telephone!,
    bien: bienRef || 'V123',
    type_appel: 'achat',
    budget: base.budget!,
    financement: base.financement!,
    timing: base.timing!,
    profil: base.profil!,
    score,
    rdv_programme: base.rdv_programme!,
    rdv_date: base.rdv_date ?? null,
    resume: base.resume!,
    transfert_effectue: false,
    duree_secondes: 168,
  };
}

router.post('/admin/test-email', async (req: Request, res: Response) => {
  const authHeader = req.headers['authorization'];
  const expected = process.env.WEBHOOK_SECRET;
  if (!expected || authHeader !== `Bearer ${expected}`) {
    res.sendStatus(401);
    return;
  }

  const template = (req.body?.template as string) || 'fiche';
  const dryRun = Boolean(req.body?.dry_run);

  if (template === 'missed') {
    const info = {
      callerId: (req.body?.caller_id as string | null) ?? '+33 7 12 34 56 78',
      durationSec: (req.body?.duration_sec as number) ?? 3,
      callDate: new Date().toISOString(),
    };
    if (dryRun) {
      const rendered = renderMissedCallEmail(info);
      res.json({
        ok: true,
        dry_run: true,
        template: 'missed',
        subject: rendered.subject,
        html_length: rendered.html.length,
        html_has_emoji: /[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/u.test(rendered.html),
        text_preview: rendered.text.slice(0, 300),
      });
      return;
    }
    const sent = await sendMissedCallEmail(info);
    res.status(sent ? 200 : 500).json({
      ok: sent,
      to: process.env.TEST_EMAIL_OVERRIDE || process.env.EMILIE_EMAIL,
      template: 'missed',
      subject: renderMissedCallEmail(info).subject,
    });
    return;
  }

  if (template === 'interrupted') {
    const info = {
      callerId: (req.body?.caller_id as string | null) ?? '+33 7 98 76 54 32',
      durationSec: (req.body?.duration_sec as number) ?? 12,
      callDate: new Date().toISOString(),
      partial: {
        name: (req.body?.partial?.name as string | null) ?? 'Jean Dupont',
        phone: (req.body?.partial?.phone as string | null) ?? null,
        property_mentioned: (req.body?.partial?.property_mentioned as string | null) ?? 'villa a Boulouris vue mer',
        intent: (req.body?.partial?.intent as string | null) ?? 'visiter un bien vu sur SeLoger',
      },
      transcript: (req.body?.transcript as string) ??
        "Sophie: Bonjour ! Agence Emilie Catinella, c'est Sophie, comment puis-je vous aider ?\nProspect: Oui bonjour, je vous appelle pour la villa a Boulouris que j'ai vue sur SeLoger, c'est encore disponible ?\nSophie: Alors, c'est celle avec vue mer ? Je regarde tout de suite.\nProspect: Oui c'est ca, c'est Jean Dupont par ailleurs.\n[Le prospect raccroche]",
    };
    if (dryRun) {
      const rendered = renderInterruptedCallEmail(info);
      res.json({
        ok: true,
        dry_run: true,
        template: 'interrupted',
        subject: rendered.subject,
        html_length: rendered.html.length,
        html_has_emoji: /[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/u.test(rendered.html),
        text_preview: rendered.text.slice(0, 400),
      });
      return;
    }
    const sent = await sendInterruptedCallEmail(info);
    res.status(sent ? 200 : 500).json({
      ok: sent,
      to: process.env.TEST_EMAIL_OVERRIDE || process.env.EMILIE_EMAIL,
      template: 'interrupted',
      subject: renderInterruptedCallEmail(info).subject,
    });
    return;
  }

  // Default: fiche prospect template
  const score: Score = (req.body?.score as Score) || 'chaud';
  if (!['chaud', 'tiede', 'froid'].includes(score)) {
    res.status(400).json({ error: 'score must be chaud, tiede, or froid' });
    return;
  }

  const bienRef = req.body?.bien_reference as string | undefined;
  const customFiche = req.body?.fiche as Partial<FicheProspect> | undefined;
  const fiche: FicheProspect = customFiche
    ? ({ ...sampleFiche(score, bienRef), ...customFiche } as FicheProspect)
    : sampleFiche(score, bienRef);

  const bien = getCachedBiens().find((b) => b.reference === fiche.bien);

  if (dryRun) {
    const { subject, html, text } = renderProspectEmail(fiche, bien);
    res.json({
      ok: true,
      dry_run: true,
      template: 'fiche',
      score,
      nom: fiche.nom,
      bien: fiche.bien,
      bien_enriched: Boolean(bien),
      subject,
      html_length: html.length,
      html_has_bien_block: html.includes('Bien concerné'),
      html_has_emoji: /[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/u.test(html),
      subject_has_emoji: /[\u{1F300}-\u{1FAFF}]|[\u{2600}-\u{27BF}]/u.test(subject),
      text_preview: text.slice(0, 300),
    });
    return;
  }

  const sent = await sendProspectEmail(fiche, bien);
  if (sent) {
    const { subject } = renderProspectEmail(fiche, bien);
    res.json({
      ok: true,
      to: process.env.TEST_EMAIL_OVERRIDE || process.env.EMILIE_EMAIL,
      template: 'fiche',
      score,
      nom: fiche.nom,
      bien: fiche.bien,
      bien_enriched: Boolean(bien),
      subject,
    });
  } else {
    res.status(500).json({ ok: false, error: 'email send failed -- check server logs' });
  }
});

export default router;
