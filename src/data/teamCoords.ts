/**
 * NBA Team City Coordinates
 * Maps team tricode to position on ASCII map (percentage-based, 0-100)
 * 
 * Coordinate system:
 * - x: 0 = left (West coast ~124°W), 100 = right (East coast ~70°W)
 * - y: 0 = top (North ~49°N), 100 = bottom (South ~25°N)
 * 
 * Based on actual US geographic proportions:
 * - Longitude range: ~124°W to ~70°W (54° span)
 * - Latitude range: ~49°N to ~25°N (24° span)
 */

export interface TeamCoord {
  x: number;
  y: number;
  offsetX?: number; // For teams sharing cities
  offsetY?: number;
  city: string;
}

// Helper to convert lat/long to percentage
// Longitude: -124 (0%) to -70 (100%)
// Latitude: 49 (0%) to 25 (100%)
function geoToPercent(lat: number, lon: number): { x: number; y: number } {
  const x = ((lon + 124) / 54) * 100;
  const y = ((49 - lat) / 24) * 100;
  return { x: Math.round(x), y: Math.round(y) };
}

export const teamCoords: Record<string, TeamCoord> = {
  // ============ WESTERN CONFERENCE ============

  // Pacific Division
  LAL: { ...geoToPercent(34.05, -118.24), offsetX: -3, city: 'Los Angeles' },     // Los Angeles Lakers
  LAC: { ...geoToPercent(34.05, -118.24), offsetX: 3, city: 'Los Angeles' },      // Los Angeles Clippers (Inglewood)
  GSW: { ...geoToPercent(37.77, -122.42), city: 'San Francisco' },                // Golden State Warriors
  SAC: { ...geoToPercent(38.58, -121.49), city: 'Sacramento' },                   // Sacramento Kings
  PHX: { ...geoToPercent(33.45, -112.07), city: 'Phoenix' },                      // Phoenix Suns

  // Northwest Division
  DEN: { ...geoToPercent(39.74, -104.99), city: 'Denver' },                       // Denver Nuggets
  MIN: { ...geoToPercent(44.98, -93.27), city: 'Minneapolis' },                   // Minnesota Timberwolves
  OKC: { ...geoToPercent(35.47, -97.52), city: 'Oklahoma City' },                 // Oklahoma City Thunder
  POR: { ...geoToPercent(45.52, -122.68), offsetX: 5, city: 'Portland' },                     // Portland Trail Blazers (offset right to stay on map)
  UTA: { ...geoToPercent(40.77, -111.89), city: 'Salt Lake City' },               // Utah Jazz

  // Southwest Division
  DAL: { ...geoToPercent(32.78, -96.80), city: 'Dallas' },                        // Dallas Mavericks
  HOU: { ...geoToPercent(29.76, -95.36), city: 'Houston' },                       // Houston Rockets
  MEM: { ...geoToPercent(35.15, -90.05), city: 'Memphis' },                       // Memphis Grizzlies
  NOP: { ...geoToPercent(29.95, -90.08), city: 'New Orleans' },                   // New Orleans Pelicans
  SAS: { ...geoToPercent(29.42, -98.49), city: 'San Antonio' },                   // San Antonio Spurs

  // ============ EASTERN CONFERENCE ============

  // Atlantic Division
  BOS: { ...geoToPercent(42.36, -71.06), city: 'Boston' },                        // Boston Celtics
  BKN: { ...geoToPercent(40.68, -73.97), offsetY: 2, city: 'Brooklyn' },          // Brooklyn Nets
  NYK: { ...geoToPercent(40.75, -73.99), offsetY: -2, city: 'New York' },         // New York Knicks
  PHI: { ...geoToPercent(39.95, -75.17), city: 'Philadelphia' },                  // Philadelphia 76ers
  TOR: { ...geoToPercent(43.64, -79.38), city: 'Toronto' },                       // Toronto Raptors

  // Central Division
  CHI: { ...geoToPercent(41.88, -87.63), city: 'Chicago' },                       // Chicago Bulls
  CLE: { ...geoToPercent(41.50, -81.69), city: 'Cleveland' },                     // Cleveland Cavaliers
  DET: { ...geoToPercent(42.33, -83.05), city: 'Detroit' },                       // Detroit Pistons
  IND: { ...geoToPercent(39.77, -86.16), city: 'Indianapolis' },                  // Indiana Pacers
  MIL: { ...geoToPercent(43.04, -87.91), city: 'Milwaukee' },                     // Milwaukee Bucks

  // Southeast Division
  ATL: { ...geoToPercent(33.75, -84.39), city: 'Atlanta' },                       // Atlanta Hawks
  CHA: { ...geoToPercent(35.23, -80.84), city: 'Charlotte' },                     // Charlotte Hornets
  MIA: { ...geoToPercent(25.76, -80.19), city: 'Miami' },                         // Miami Heat
  ORL: { ...geoToPercent(28.54, -81.38), city: 'Orlando' },                       // Orlando Magic
  WAS: { ...geoToPercent(38.91, -77.02), city: 'Washington DC' },                 // Washington Wizards
};

/**
 * Get the display position for a team, accounting for offsets
 */
export function getTeamPosition(tricode: string): { x: number; y: number } {
  const coord = teamCoords[tricode];
  if (!coord) {
    console.warn(`Unknown team tricode: ${tricode}`);
    return { x: 50, y: 50 }; // Default to center if unknown
  }
  return {
    x: coord.x + (coord.offsetX || 0),
    y: coord.y + (coord.offsetY || 0),
  };
}

/**
 * Get team city name
 */
export function getTeamCity(tricode: string): string {
  return teamCoords[tricode]?.city || 'Unknown';
}
