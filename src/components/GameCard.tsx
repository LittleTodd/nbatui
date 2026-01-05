/**
 * GameCard Component
 * Displays a single NBA game with scores and status
 */
import * as React from 'react';
import { Box, Text } from 'ink';
import type { Game } from '../services/apiClient';
import { getGameStatusInfo } from '../services/apiClient';
import { HeatIndicator, type HeatLevel } from './HeatIndicator';

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

// Export the component implementation for memoization
function GameCardImpl({ game, isSelected = false, compact = false, heat }: GameCardProps) {
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
                <Text bold>{game.homeTeam.teamTricode}</text>
                <Text bold>{game.homeTeam.score}</text>
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

// Custom comparison function for React.memo
function arePropsEqual(prevProps: GameCardProps, nextProps: GameCardProps) {
    // 1. Check basic scalar props
    if (prevProps.isSelected !== nextProps.isSelected) return false;
    if (prevProps.compact !== nextProps.compact) return false;

    // 2. Check game identity (assuming game objects are mostly stable or we care about ID)
    // NOTE: If game object references change on every fetch even if content is same, 
    // we should check ID + Score + Status to avoid missing updates.
    // Let's do a safe check on key fields that affect rendering.
    if (prevProps.game.gameId !== nextProps.game.gameId) return false;
    if (prevProps.game.gameStatus !== nextProps.game.gameStatus) return false;
    if (prevProps.game.homeTeam.score !== nextProps.game.homeTeam.score) return false;
    if (prevProps.game.awayTeam.score !== nextProps.game.awayTeam.score) return false;
    if (prevProps.game.gameClock !== nextProps.game.gameClock) return false;

    // 3. Check heat data
    const prevHeat = prevProps.heat;
    const nextHeat = nextProps.heat;

    // If exact reference match (both undefined or same object), return true partial
    if (prevHeat === nextHeat) return true;

    // If one is missing and other isn't, changed
    if (!prevHeat || !nextHeat) return false;

    // Deep check heat fields
    if (prevHeat.level !== nextHeat.level) return false;
    if (prevHeat.count !== nextHeat.count) return false;

    return true;
}

export const GameCard = React.memo(GameCardImpl, arePropsEqual);
