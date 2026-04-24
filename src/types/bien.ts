// Full property from Google Sheet (internal only)
export interface Bien {
  reference: string;      // EM-XXXX-XXX format
  type: string;           // Appartement | Maison | Villa | Terrain
  secteur: string;        // Boulouris, Valescure, Frejus, etc.
  surface_m2: number;
  pieces: number;
  chambres: number;
  prix: number;           // Used for search filtering ONLY
  statut: string;         // Disponible | Sous compromis | Vendu
  arguments: string;      // Selling points (free text)
  acces_libre: boolean;
  visitable: boolean;
}

// Safe property for API response -- NO prix, NO restricted fields (PORT-06)
export interface BienSafe {
  reference: string;
  type: string;
  secteur: string;
  surface_m2: number;
  pieces: number;
  chambres: number;
  statut: string;
  arguments: string;
  acces_libre: boolean;
}

export interface SearchRequest {
  name: string;            // Tool name from Retell
  args: {
    secteur?: string;
    type_bien?: string;
    prix_approx?: number;
    reference?: string;
    adresse?: string;      // Specific street/address — forces result_count=0 (no sheet column)
  };
  call?: Record<string, unknown>;  // Retell call context (ignored)
}

export interface SearchResponse {
  result_count: number;
  has_multiple: boolean;
  message: string;
  biens: BienSafe[];
}
