/**
 * WinProbabilityBar Component
 * Displays a horizontal bar showing win probability for each team
 */
import React from 'react';
import { Box, Text } from 'ink';
import { TEAM_BG_COLORS, TEAM_TEXT_COLORS } from '../data/teamColors.js';

interface WinProbabilityBarProps {
    awayProb: number;  // 0-100
    homeProb: number;  // 0-100
    awayTricode: string;
    homeTricode: string;
    barWidth?: number;
}

export function WinProbabilityBar({
    awayProb,
    homeProb,
    awayTricode,
    homeTricode,
    barWidth = 30
}: WinProbabilityBarProps) {
    // Normalize probabilities to ensure they add up to 100
    const total = awayProb + homeProb || 1;
    const awayPct = Math.round((awayProb / total) * 100);
    const homePct = 100 - awayPct;

    // Calculate bar segments
    // Calculate bar segments
    const awayBars = Math.round((awayPct / 100) * barWidth);
    const homeBars = barWidth - awayBars;

    const awayBg = TEAM_BG_COLORS[awayTricode] || '#666666';
    const homeBg = TEAM_BG_COLORS[homeTricode] || '#666666';

    let awayBarColor = awayBg;
    let homeBarColor = homeBg;

    // Threshold increased to 120 to catch dark-on-dark cases
    const COLLISION_THRESHOLD = 120;

    if (getColorDistance(awayBarColor, homeBarColor) < COLLISION_THRESHOLD) {
        const awayText = TEAM_TEXT_COLORS[awayTricode] || '#ffffff';
        if (getColorDistance(awayText, homeBarColor) > COLLISION_THRESHOLD) {
            awayBarColor = awayText;
        } else {
            const homeText = TEAM_TEXT_COLORS[homeTricode] || '#ffffff';
            if (getColorDistance(awayBarColor, homeText) > COLLISION_THRESHOLD) {
                homeBarColor = homeText;
            } else {
                awayBarColor = '#CCCCCC';
            }
        }
    }

    // Determine favorite
    const awayIsFavorite = awayPct > homePct;
    const homeIsFavorite = homePct > awayPct;

    return (
        <Box flexDirection="column" alignItems="center">
            <Text dimColor>Win Probability</Text>
            <Box marginTop={0}>
                {/* Away team percentage */}
                <Box width={6} justifyContent="flex-end">
                    <Text bold={awayIsFavorite} color={awayIsFavorite ? 'green' : 'white'}>
                        {awayPct}%
                    </Text>
                </Box>

                {/* Away team tricode - USE ORIGINAL BG */}
                <Box marginLeft={1}>
                    <Text backgroundColor={awayBg} color={TEAM_TEXT_COLORS[awayTricode] || '#ffffff'} bold> {awayTricode} </Text>
                </Box>

                {/* Probability bar - USE BAR COLOR */}
                <Box marginX={1}>
                    <Text>
                        <Text backgroundColor={awayBarColor}>{' '.repeat(awayBars)}</Text>
                        <Text backgroundColor={homeBarColor}>{' '.repeat(homeBars)}</Text>
                    </Text>
                </Box>

                {/* Home team tricode - USE ORIGINAL BG */}
                <Box>
                    <Text backgroundColor={homeBg} color={TEAM_TEXT_COLORS[homeTricode] || '#ffffff'} bold> {homeTricode} </Text>
                </Box>

                {/* Home team percentage */}
                <Box width={6} marginLeft={1} justifyContent="flex-start">
                    <Text bold={homeIsFavorite} color={homeIsFavorite ? 'green' : 'white'}>
                        {homePct}%
                    </Text>
                </Box>
            </Box>
        </Box>
    );
}

// Color utility functions
function hexToRgb(hex: string): { r: number, g: number, b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result || !result[1] || !result[2] || !result[3]) return null;
    return {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    };
}

function getColorDistance(hex1: string, hex2: string): number {
    const rgb1 = hexToRgb(hex1);
    const rgb2 = hexToRgb(hex2);
    if (!rgb1 || !rgb2) return 1000;
    return Math.sqrt(
        Math.pow(rgb1.r - rgb2.r, 2) +
        Math.pow(rgb1.g - rgb2.g, 2) +
        Math.pow(rgb1.b - rgb2.b, 2)
    );
}
