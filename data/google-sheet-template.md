# Google Sheet Template -- Portefeuille Emilie

## Column Structure (Row 1 = Headers, EXACT names required)

| Column | Header Name | Type | Values / Validation |
|--------|------------|------|---------------------|
| A | Reference | Text | Format: EM-YYYY-NNN (ex: EM-2026-001) |
| B | Type | Dropdown | Appartement, Maison, Villa, Terrain |
| C | Secteur | Text | Quartier ou ville (ex: Boulouris, Valescure, Frejus) |
| D | Surface | Number | Surface en m2 (entier positif) |
| E | Pieces | Number | Nombre de pieces (entier positif) |
| F | Chambres | Number | Nombre de chambres (entier positif) |
| G | Prix | Number | Prix en euros (entier, pas de decimales) |
| H | Statut | Dropdown | Disponible, Sous compromis, Vendu |
| I | Arguments | Text | Arguments de vente en texte libre |
| J | Acces libre | Dropdown | Oui, Non |
| K | Visitable | Dropdown | Oui, Non |

## Test Data (5 properties)

| Reference | Type | Secteur | Surface | Pieces | Chambres | Prix | Statut | Arguments | Acces libre | Visitable |
|-----------|------|---------|---------|--------|----------|------|--------|-----------|-------------|-----------|
| EM-2026-001 | Villa | Boulouris | 120 | 4 | 3 | 485000 | Disponible | Vue mer, jardin 500m2, garage double | Oui | Oui |
| EM-2026-002 | Appartement | Valescure | 75 | 3 | 2 | 295000 | Disponible | Residence calme, balcon sud, parking | Oui | Oui |
| EM-2026-003 | Maison | Frejus | 95 | 4 | 3 | 380000 | Sous compromis | Centre-ville, renovee, terrasse | Non | Non |
| EM-2026-004 | Appartement | Boulouris | 55 | 2 | 1 | 220000 | Disponible | Vue partielle mer, dernier etage | Oui | Oui |
| EM-2026-005 | Villa | Saint-Raphael | 200 | 6 | 4 | 750000 | Vendu | Piscine, vue panoramique, calme absolu | Non | Non |

## Setup Steps

1. Create a new Google Sheet named "Portefeuille Emilie - Sophie"
2. Set row 1 headers EXACTLY as shown above (case-sensitive)
3. Add data validation for dropdown columns:
   - Type (B): Appartement, Maison, Villa, Terrain
   - Statut (H): Disponible, Sous compromis, Vendu
   - Acces libre (J): Oui, Non
   - Visitable (K): Oui, Non
4. Add the 5 test properties from the table above
5. Share the sheet with the service account email (Viewer access)
6. Copy the Sheet ID from the URL: https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit
