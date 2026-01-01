
import React from 'react';
import { Text } from 'ink';
import type { Game, GameOdds } from '../services/apiClient.js';
import type { HeatData } from '../hooks/useSocialHeat.js';
import { TEAM_BG_COLORS } from '../data/teamColors.js';
import { createGameMarker } from '../utils/mapRendering.js';
import { getOddsKey as fetchOddsKey } from '../services/apiClient.js';


// Actually let's just use the one from apiClient if it exists, or duplicate/move it.
// To avoid circular deps or confusion, let's assume it is exported from apiClient as before.

interface MapLineProps {
    line: string;
    rowIndex: number;
    gameColors: Map<number, import('../utils/mapRendering.js').GameColor>;
    games: Game[];
    odds: Record<string, GameOdds>;
    liveDotVisible: boolean;
}

export function MapLine({ line, rowIndex, gameColors, games, odds, liveDotVisible }: MapLineProps) {
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

    if (markersOnRow.length === 0) {
        return <Text dimColor>{line}</Text>;
    }

    markersOnRow.sort((a, b) => a.col - b.col);

    const segments: React.ReactNode[] = [];
    let lastEnd = 0;

    markersOnRow.forEach((marker, i) => {
        if (marker.col > lastEnd) {
            segments.push(
                <Text key={`dim-${i}`} dimColor>
                    {line.slice(lastEnd, marker.col)}
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

        const renderText = (text: string, key: string, bg?: string) => {
            if (!text) return null;

            const isFinal = game.gameStatus === 3;
            const isFuture = game.gameStatus === 1;

            let finalColor = marker.isLive ? 'green' : (isFinal ? 'blue' : 'gray');
            let finalBg = undefined;
            let finalBold = marker.isSelected;
            let finalDim = isFuture && !marker.isHighlighted && !marker.isSelected;

            if (marker.isHighlighted) {
                finalBg = 'yellow';
                finalColor = 'black';
                finalBold = true;
                finalDim = false;
            } else if (bg) {
                // Team Color Block - Always prioritize this for the tricode background
                finalBg = bg;
                finalColor = '#ffffff'; // White text on team color
                finalBold = true;
                finalDim = false;
            } else if (marker.heat?.level === 'fire' || marker.heat?.level === 'hot') {
                // Hot games get special text color for scores/info
                finalColor = marker.heat.level === 'fire' ? 'red' : 'orange';
                finalBold = true;
                if (marker.isSelected) {
                    finalColor = 'cyan';
                }
            } else if (marker.isCrunchTime) {
                // Crunch Time: Flashing Red/Bold
                if (liveDotVisible) { // Reuse the blinking timer for a blink effect
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
            markerElements.push(renderText(` ${away} `, `away-${i}`, awayColor));

            const parts2 = postAway.split(home);
            if (parts2.length >= 2) {
                const mid = parts2[0] || '';
                const postHome = parts2.slice(1).join(home);

                markerElements.push(renderText(mid, `mid-${i}`));
                markerElements.push(renderText(` ${home} `, `home-${i}`, homeColor));
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
            <Text key="dim-end" dimColor>
                {line.slice(lastEnd)}
            </Text>
        );
    }

    return <Text>{segments}</Text>;
}
