/**
 * WinProbabilityBar Component
 * Displays a horizontal bar showing win probability for each team
 */
import React from 'react';
import { Box, Text } from 'ink';
import { TEAM_BG_COLORS } from '../data/teamColors.js';

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
    const awayBars = Math.round((awayPct / 100) * barWidth);
    const homeBars = barWidth - awayBars;

    const awayColor = TEAM_BG_COLORS[awayTricode] || '#666666';
    const homeColor = TEAM_BG_COLORS[homeTricode] || '#666666';

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

                {/* Away team tricode */}
                <Box marginLeft={1}>
                    <Text backgroundColor={awayColor} color="#ffffff" bold> {awayTricode} </Text>
                </Box>

                {/* Probability bar */}
                <Box marginX={1}>
                    <Text>
                        <Text backgroundColor={awayColor}>{' '.repeat(awayBars)}</Text>
                        <Text backgroundColor={homeColor}>{' '.repeat(homeBars)}</Text>
                    </Text>
                </Box>

                {/* Home team tricode */}
                <Box>
                    <Text backgroundColor={homeColor} color="#ffffff" bold> {homeTricode} </Text>
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
