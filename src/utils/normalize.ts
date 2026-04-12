const ALIASES: Record<string, string> = {
  'val escur': 'Valescure',
  'valescur': 'Valescure',
  'boulouri': 'Boulouris',
  'boulourie': 'Boulouris',
  'saint raph': 'Saint-Raphael',
  'st raphael': 'Saint-Raphael',
  'st raph': 'Saint-Raphael',
  'le dramont': 'Dramont',
  'agay': 'Agay',
  'frejus': 'Frejus',
  'frejusse': 'Frejus',
};

export function resolveAlias(input: string): string {
  const normalized = input.toLowerCase().trim();
  return ALIASES[normalized] || input;
}
