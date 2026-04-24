export type Score = 'chaud' | 'tiede' | 'froid';

export interface FicheProspect {
  nom: string;
  telephone: string;
  bien: string;
  type_appel: string;
  budget: string;
  financement: string;
  timing: string;
  profil: string;
  score: Score;
  rdv_programme: boolean;
  rdv_date: string | null;
  resume: string;
  transfert_effectue: boolean;
  duree_secondes: number;
}

export interface RetellWebhookPayload {
  event: 'call_started' | 'call_ended' | 'call_analyzed';
  call: {
    call_id: string;
    call_type: 'phone_call' | 'web_call';
    call_status: string;
    duration_ms: number;
    transcript: string;
    transcript_object: Array<{ role: string; content: string }>;
    recording_url: string;
    disconnection_reason: string;
    from_number?: string;
    to_number?: string;
    call_analysis?: {
      call_summary: string;
      in_voicemail: boolean;
      user_sentiment: 'Positive' | 'Negative' | 'Neutral' | 'Unknown';
      call_successful: boolean;
      custom_analysis_data: Record<string, any>;
    };
  };
}
