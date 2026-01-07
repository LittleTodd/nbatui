import React, { memo } from 'react';
import { Text } from 'ink';
import type { Game, GameOdds } from '../services/apiClient.js';
import type { HeatData } from '../hooks/useSocialHeat.js';
import { TEAM_BG_COLORS, TEAM_TEXT_COLORS } from '../data/teamColors.js';
import { createGameMarker, type GameColor } from '../utils/mapRendering.js';
import { getOddsKey as fetchOddsKey } from '../services/apiClient.js';
import { US_MAP_WIDTH, US_MAP_HEIGHT } from '../data/usMap.js';
import { getTerrainRegion, getTerrainColor, getTerrainChar } from '../data/mapTerrain.js';

interface MapLineProps {
    line: string;
    rowIndex: number;
    gameColors: Map<number, GameColor>;
    games: Game[];
    odds: Record<string, GameOdds>;
    liveDotVisible: boolean;
    waveFrame?: number;  // Animation frame for wave effect (0-3)
}

function MapLineComponent({ line, rowIndex, gameColors, games, odds, liveDotVisible, waveFrame = 0 }: MapLineProps) {
    const markersOnRow: Array<{ col: number; length: number; isLive: boolean; isSelected: boolean; isHighlighted: boolean; gameIdx: number; content: string; heat?: HeatData; isCrunchTime?: boolean }> = [];

    gameColors.forEach((pos, gameIdx) => {
        if (pos.row === rowIndex) {
            const game = games[gameIdx];
            if (!game) return;
            const gameDate = game.gameTimeUTC?.slice(0, 10) || '';
            let gameOdds = odds[fetchOddsKey(game.awayTeam.teamTricode, game.homeTeam.teamTricode, gameDate)];

            if (!gameOdds && gameDate) {
                const nextDay = new Date(gameDate);
                nextDay.setDate(nextDay.getDate() + 1);
                const nextDayStr = nextDay.toISOString().slice(0, 10);
                gameOdds = odds[fetchOddsKey(game.awayTeam.teamTricode, game.homeTeam.teamTricode, nextDayStr)];
            }

            const marker = createGameMarker(game, pos.isSelected, pos.isHighlighted, gameOdds, pos.heat, pos.isCrunchTime);
            markersOnRow.push({
                col: pos.col,
                length: marker.length,
                isLive: pos.isLive,
                isSelected: pos.isSelected,
                isHighlighted: pos.isHighlighted,
                gameIdx,
                content: marker,
                heat: pos.heat,
                isCrunchTime: pos.isCrunchTime
            });
        }
    });

    // Helper to render a segment with terrain colors
    const renderTerrainSegment = (text: string, startCol: number, key: string): React.ReactNode[] => {
        const nodes: React.ReactNode[] = [];
        let currentRegion = getTerrainRegion(startCol, US_MAP_WIDTH, rowIndex, US_MAP_HEIGHT);
        let currentColor = getTerrainColor(currentRegion);
        let buffer = '';
        let bufferStart = startCol;

        for (let i = 0; i < text.length; i++) {
            const col = startCol + i;
            const char = text[i];
            const region = getTerrainRegion(col, US_MAP_WIDTH, rowIndex, US_MAP_HEIGHT);
            const color = getTerrainColor(region);

            // Check if this is an interior texture character (dot or space inside map)
            const isInterior = char === '·' || char === ' ';
            const displayChar = isInterior && char === '·'
                ? getTerrainChar(region, col, waveFrame)
                : char;

            if (color !== currentColor && buffer) {
                // Flush buffer with previous color
                nodes.push(
                    <Text key={`${key}-${bufferStart}`} color={currentColor} dimColor>
                        {buffer}
                    </Text>
                );
                buffer = displayChar ?? '';
                bufferStart = col;
                currentColor = color;
                currentRegion = region;
            } else {
                buffer += displayChar ?? '';
            }
        }

        // Flush remaining buffer
        if (buffer) {
            nodes.push(
                <Text key={`${key}-${bufferStart}`} color={currentColor} dimColor>
                    {buffer}
                </Text>
            );
        }

        return nodes;
    };

    if (markersOnRow.length === 0) {
        return <Text>{renderTerrainSegment(line, 0, 'bg')}</Text>;
    }

    markersOnRow.sort((a, b) => a.col - b.col);

    const segments: React.ReactNode[] = [];
    let lastEnd = 0;

    markersOnRow.forEach((marker, i) => {
        if (marker.col > lastEnd) {
            segments.push(
                <Text key={`dim-${i}`}>
                    {renderTerrainSegment(line.slice(lastEnd, marker.col), lastEnd, `bg-${i}`)}
                </Text>
            );
        }

        const rawContent = marker.content;
        const game = games[marker.gameIdx];
        if (!game) return null;

        const away = game.awayTeam.teamTricode;
        const home = game.homeTeam.teamTricode;

        const awayColor = TEAM_BG_COLORS[away] || '#333';
        const homeColor = TEAM_BG_COLORS[home] || '#333';

        const markerElements: React.ReactNode[] = [];

        const renderText = (text: string, key: string, bg?: string, teamCode?: string) => {
            if (!text) return null;

            const isFinal = game.gameStatus === 3;
            const isFuture = game.gameStatus === 1;

            let finalColor = marker.isLive ? 'green' : (isFinal ? 'blue' : 'gray');
            let finalBg = undefined;
            let finalBold = marker.isSelected;
            let finalDim = isFuture && !marker.isHighlighted && !marker.isSelected;

            if (marker.isHighlighted) {
                finalColor = TEAM_TEXT_COLORS[teamCode] || '#ffffff';
                finalBold = true;
                finalDim = false;
            } else if (bg && teamCode) {
                // Team Color Block - use team-specific text color
                finalBg = bg;
                finalColor = TEAM_TEXT_COLORS[teamCode] || '#ffffff';
                finalBold = true;
                finalDim = false;
            } else if (marker.heat?.level === 'fire' || marker.heat?.level === 'hot') {
                finalColor = marker.heat.level === 'fire' ? 'red' : 'orange';
                finalBold = true;
                if (marker.isSelected) {
                    finalColor = 'cyan';
                }
            } else if (marker.isCrunchTime) {
                if (liveDotVisible) {
                    finalColor = 'white';
                    finalBg = 'red';
                } else {
                    finalColor = 'red';
                }
                finalBold = true;
            } else if (marker.isSelected) {
                finalColor = 'cyan';
                finalBold = true;
                finalDim = false;
            }

            return (
                <Text
                    key={key}
                    color={finalColor}
                    backgroundColor={finalBg}
                    bold={finalBold}
                    dimColor={finalDim}
                >
                    {text}
                </Text>
            );
        };

        let displayContent = rawContent;
        if (marker.isLive && rawContent.startsWith('●●')) {
            const dot = liveDotVisible ? '●' : '○';
            displayContent = dot + rawContent.slice(2);
        }

        const parts1 = displayContent.split(away);

        if (parts1.length >= 2) {
            const preAway = parts1[0] || '';
            const postAway = parts1.slice(1).join(away);

            markerElements.push(renderText(preAway, `pre-${i}`));
            markerElements.push(renderText(` ${away} `, `away-${i}`, awayColor, away));

            const parts2 = postAway.split(home);
            if (parts2.length >= 2) {
                const mid = parts2[0] || '';
                const postHome = parts2.slice(1).join(home);

                markerElements.push(renderText(mid, `mid-${i}`));
                markerElements.push(renderText(` ${home} `, `home-${i}`, homeColor, home));
                markerElements.push(renderText(postHome, `post-${i}`));
            } else {
                markerElements.push(renderText(postAway, `rest-${i}`));
            }
        } else {
            markerElements.push(renderText(displayContent, `full-${i}`));
        }

        segments.push(
            <Text key={`marker-wrap-${i}`}>
                {markerElements}
            </Text>
        );

        lastEnd = marker.col + marker.length;
    });

    if (lastEnd < line.length) {
        segments.push(
            <Text key="dim-end">
                {renderTerrainSegment(line.slice(lastEnd), lastEnd, 'bg-end')}
            </Text>
        );
    }

    return <Text>{segments}</Text>;
}

export const MapLine = memo(MapLineComponent, (prev, next) => {
    // 1. Structural/Data Props that definitely require re-render if changed
    if (prev.rowIndex !== next.rowIndex) return false;
    if (prev.line !== next.line) return false;
    if (prev.games !== next.games) return false;

    // 2. Identify games on this row for detailed checking
    // We check if relevant GameColors changed
    let gameColorsChanged = false;

    if (prev.gameColors !== next.gameColors) {
        // Optimization: Instead of blindly re-rendering, check if games ON THIS ROW changed status.
        // If the map reference changed (which it does every embedGamesInMap call),
        // we must check if the subset of data for THIS row is different.

        const prevRowColors = new Map<number, GameColor>();
        for (const [idx, color] of prev.gameColors.entries()) {
            if (color.row === prev.rowIndex) prevRowColors.set(idx, color);
        }

        const nextRowColors = new Map<number, GameColor>();
        for (const [idx, color] of next.gameColors.entries()) {
            if (color.row === next.rowIndex) nextRowColors.set(idx, color);
        }

        if (prevRowColors.size !== nextRowColors.size) {
            gameColorsChanged = true;
        } else {
            for (const [idx, nextColor] of nextRowColors.entries()) {
                const prevColor = prevRowColors.get(idx);
                if (!prevColor) {
                    gameColorsChanged = true;
                    break;
                }

                // Check all visual properties
                if (prevColor.col !== nextColor.col ||
                    prevColor.isLive !== nextColor.isLive ||
                    prevColor.isSelected !== nextColor.isSelected ||
                    prevColor.isHighlighted !== nextColor.isHighlighted ||
                    prevColor.isCrunchTime !== nextColor.isCrunchTime ||
                    prevColor.heat?.level !== nextColor.heat?.level) {
                    gameColorsChanged = true;
                    break;
                }
            }
        }
    }

    if (gameColorsChanged) return false;

    // 3. Odds Check - Only matters if a game on this row is selected
    if (prev.odds !== next.odds) {
        let hasSelectedGame = false;
        for (const color of next.gameColors.values()) {
            if (color.row === next.rowIndex && color.isSelected) {
                hasSelectedGame = true;
                break;
            }
        }
        if (hasSelectedGame) return false;
    }

    // 4. Live Dot Check - Only matters if a game on this row is live
    if (prev.liveDotVisible !== next.liveDotVisible) {
        let hasLiveGame = false;
        for (const color of next.gameColors.values()) {
            if (color.row === next.rowIndex && (color.isLive || color.isCrunchTime)) {
                hasLiveGame = true;
                break;
            }
        }
        if (hasLiveGame) return false;
    }

    // 5. Wave Frame Check - Always re-render on wave frame change for coastal animation
    if (prev.waveFrame !== next.waveFrame) return false;

    return true;
});
