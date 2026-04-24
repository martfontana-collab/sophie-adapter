import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('[parser] Missing ANTHROPIC_API_KEY');
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export interface PartialInfo {
  name: string | null;
  phone: string | null;
  property_mentioned: string | null;
  intent: string | null;
}

const EMPTY: PartialInfo = {
  name: null,
  phone: null,
  property_mentioned: null,
  intent: null,
};

const SYSTEM = `Tu extrais des informations d'une transcription partielle d'appel telephonique entre Sophie (l'assistante IA d'une agence immobiliere) et un appelant qui a raccroche avant la fin.

Tu retournes UNIQUEMENT un objet JSON valide, sans markdown, sans commentaire, avec ces cles exactes :
- name: le nom de l'appelant si il s'est presente (string ou null)
- phone: le numero de telephone si mentionne explicitement (string ou null)
- property_mentioned: le bien mentionne (reference, secteur, ou description courte) (string ou null)
- intent: ce que l'appelant voulait (une phrase courte en francais) (string ou null)

Regles strictes :
- Mets null si l'info n'a pas ete donnee. Ne devine JAMAIS.
- Ne complete pas un nom partiel ("Jean..." reste null, pas "Jean Dupont").
- Ne reformule pas l'intent au-dela de ce qui est dit.

Exemple de sortie valide :
{"name": "Jean Dupont", "phone": null, "property_mentioned": "villa a Boulouris", "intent": "visiter un bien vu sur SeLoger"}`;

export async function parsePartialTranscript(transcript: string): Promise<PartialInfo> {
  if (!transcript?.trim()) return EMPTY;

  try {
    const res = await getClient().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      system: SYSTEM,
      messages: [{ role: 'user', content: transcript.slice(0, 4000) }],
    });

    const text = res.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[parser] no JSON found in response:', text.slice(0, 200));
      return EMPTY;
    }
    const parsed = JSON.parse(jsonMatch[0]) as Partial<PartialInfo>;
    return {
      name: parsed.name || null,
      phone: parsed.phone || null,
      property_mentioned: parsed.property_mentioned || null,
      intent: parsed.intent || null,
    };
  } catch (err) {
    console.error('[parser] extraction failed:', err);
    return EMPTY;
  }
}
