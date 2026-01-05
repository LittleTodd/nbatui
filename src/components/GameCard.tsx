/**
 * GameCard Component
 * Displays a single NBA game with scores and status
 */
import type { Game } from '../services/apiClient';
import { getGameStatusInfo } from '../services/apiClient';
import { getTeamColors } from '../data/teamColors';
import { HeatIndicator, type HeatLevel } from './HeatIndicator';
import { Box, Text } from 'ink';
import React, { memo } from 'react';

export interface HeatData {
    level: HeatLevel;
    count: number;
}

interface GameCardProps {
    game: Game;
    isSelected?: boolean;
    compact?: boolean;
    heat?: HeatData;
}

function GameCardComponent({ game, isSelected = false, compact = false, heat }: GameCardProps) {
    const { text: statusText, isLive, isFinal } = getGameStatusInfo(game);

    // Determine border color based on state and heat
    const getBorderColor = () => {
        if (isSelected) return 'cyan';

        // High heat overrides standard colors (except selected)
        if (heat?.level === 'fire') return 'red';
        if (heat?.level === 'hot') return 'orange';

        if (isLive) return 'green';
        if (isFinal) return 'gray';
        return 'white';
    };

    if (compact) {
        // Compact mode for smaller terminals
        return (
            <Box
                borderStyle="round"
                borderColor={getBorderColor()}
                paddingX={1}
            >
                <Text>
                    <Text bold>{game.awayTeam.teamTricode}</Text>
                    <Text> {game.awayTeam.score}</Text>
                    <Text dimColor> @ </Text>
                    <Text bold>{game.homeTeam.teamTricode}</Text>
                    <Text> {game.homeTeam.score}</Text>
                    <Text dimColor> {statusText}</Text>
                    {heat && heat.level !== 'cold' && (
                        <HeatIndicator level={heat.level} count={heat.count} compact={true} />
                    )}
                </Text>
            </Box>
        );
    }

    return (
        <Box
            flexDirection="column"
            borderStyle="round"
            borderColor={getBorderColor()}
            paddingX={1}
            minWidth={20}
        >
            {/* Status bar */}
            <Box justifyContent="center">
                <Text
                    color={isLive ? 'green' : (isFinal ? 'gray' : 'yellow')}
                    bold={isLive}
                >
                    {isLive ? '● LIVE ' : ''}{statusText}
                </Text>
                {heat && (
                    <Box marginLeft={1}>
                        <HeatIndicator level={heat.level} count={heat.count} />
                    </Box>
                )}
            </Box>

            {/* Away team */}
            <Box justifyContent="space-between">
                <Text bold>{game.awayTeam.teamTricode}</Text>
                <Text bold>{game.awayTeam.score}</Text>
            </Box>

            {/* Home team */}
            <Box justifyContent="space-between">
                <Text bold>{game.homeTeam.teamTricode}</Text>
                <Text bold>{game.homeTeam.score}</Text>
            </Box>

            {/* City names */}
            <Box justifyContent="center">
                <Text dimColor>
                    {game.awayTeam.teamCity} @ {game.homeTeam.teamCity}
                </Text>
            </Box>
        </Box>
    );
}

export const GameCard = memo(GameCardComponent, (prev, next) => {
    return (
        prev.isSelected === next.isSelected &&
        prev.compact === next.compact &&
        prev.game === next.game && // Reference equality is sufficient for game object from store
        prev.heat === next.heat
    );
});
