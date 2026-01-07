/**
 * Map Terrain System
 * Provides colors, textures, and animation for the US map
 */

// Region definitions based on column position (0-100% of map width)
export type TerrainRegion = 'west_coast' | 'mountain' | 'plains' | 'midwest' | 'east' | 'coast';

// Terrain colors (RGB hex)
export const TERRAIN_COLORS: Record<TerrainRegion, string> = {
    west_coast: '#2d5a27',   // Dark forest green (Pacific Northwest, California coast)
    mountain: '#8b7355',     // Brown/tan (Rockies, desert Southwest)
    plains: '#6b8e23',       // Olive green (Great Plains)
    midwest: '#228b22',      // Forest green (Midwest farmland)
    east: '#2e8b57',         // Sea green (Eastern forests)
    coast: '#4682b4',        // Steel blue (coastal areas)
};

// Terrain textures using expressive Unicode characters
export const TERRAIN_TEXTURES: Record<TerrainRegion, string[]> = {
    west_coast: ['🌲', '♠', '🌲'],     // Forest/trees for Pacific Northwest
    mountain: ['▲', '🏔', '▲'],        // Mountains for Rockies (using simple triangle as fallback)
    plains: ['·', '░', '·'],            // Sparse dots for Great Plains
    midwest: ['♣', '·', '♣'],           // Farmland/trees
    east: ['🌲', '♠', '♣'],             // Dense forest for Eastern US
    coast: ['≈', '🌊', '≈'],            // Waves for coastal areas
};

// Wave animation frames for coastal areas
export const WAVE_FRAMES = ['≈', '🌊', '∼', '～'];

/**
 * Determine terrain region based on column position
 * @param col Column position (0 to mapWidth)
 * @param mapWidth Total map width
 * @param row Row position for coastal detection
 * @param mapHeight Total map height
 */
export function getTerrainRegion(col: number, mapWidth: number, row: number, mapHeight: number): TerrainRegion {
    const xPercent = (col / mapWidth) * 100;
    const yPercent = (row / mapHeight) * 100;

    // Coastal detection (edges of the map that would be ocean)
    // Left edge (Pacific) or right edge (Atlantic) or bottom-right (Florida/Gulf)
    const isLeftEdge = xPercent < 5;
    const isRightEdge = xPercent > 92;
    const isGulfCoast = yPercent > 75 && xPercent > 50 && xPercent < 75;

    if (isLeftEdge || isRightEdge || isGulfCoast) {
        return 'coast';
    }

    // Pacific Northwest and California coast
    if (xPercent < 12) {
        return 'west_coast';
    }

    // Rocky Mountains and Southwest
    if (xPercent < 35) {
        return 'mountain';
    }

    // Great Plains
    if (xPercent < 55) {
        return 'plains';
    }

    // Midwest
    if (xPercent < 75) {
        return 'midwest';
    }

    // Eastern US
    return 'east';
}

/**
 * Get the texture character for a terrain position
 * @param region Terrain region
 * @param col Column for variation
 * @param animFrame Animation frame (0-3) for wave effect
 */
export function getTerrainChar(region: TerrainRegion, col: number, animFrame: number = 0): string {
    if (region === 'coast') {
        return WAVE_FRAMES[animFrame % WAVE_FRAMES.length] ?? '≈';
    }
    const textures = TERRAIN_TEXTURES[region];
    return textures[col % textures.length] ?? '░';
}

/**
 * Get the color for a terrain region
 */
export function getTerrainColor(region: TerrainRegion): string {
    return TERRAIN_COLORS[region];
}
