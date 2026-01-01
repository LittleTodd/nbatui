
import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { getGameStatusInfo, type Game, type GameOdds } from '../services/apiClient.js';
import { HeatIndicator } from './HeatIndicator.js';
import { type HeatData } from '../hooks/useSocialHeat.js';

interface GameDetailProps {
    game: Game;
    odds?: GameOdds;
    currentIndex: number;
    totalGames: number;
    heat?: HeatData;
}

// Selected game detail panel
export function GameDetail({ game, odds, currentIndex, totalGames, heat }: GameDetailProps) {
    const { text: statusText, isLive, isFinal } = getGameStatusInfo(game);
    const isFuture = game.gameStatus === 1;

    // Blinking animation for live indicator
    const [dotVisible, setDotVisible] = useState(true);
    useEffect(() => {
        if (!isLive) return;
        const timer = setInterval(() => {
            setDotVisible(v => !v);
        }, 500);
        return () => clearInterval(timer);
    }, [isLive]);

    // Border color reacts to heat
    let borderColor = 'cyan';
    if (heat?.level === 'fire') borderColor = 'red';
    else if (heat?.level === 'hot') borderColor = 'orange';

    return (
        <Box
            borderStyle="round"
            borderColor={borderColor}
            paddingX={2}
            marginTop={1}
            justifyContent="center"
        >
            <Box flexDirection="column" alignItems="center">
                {/* Pagination Indicator */}
                <Box marginBottom={1}>
                    <Text dimColor>◀ </Text>
                    <Text bold color="yellow">{currentIndex + 1}</Text>
                    <Text dimColor>/{totalGames}</Text>
                    <Text dimColor> ▶</Text>
                </Box>

                <Text bold color="cyan">
                    {game.awayTeam.teamCity} {game.awayTeam.teamName} @ {game.homeTeam.teamCity} {game.homeTeam.teamName}
                </Text>
                <Box gap={2}>
                    <Text bold>{game.awayTeam.teamTricode}</Text>
                    <Text bold color="white" backgroundColor={isLive ? "green" : undefined}>
                        {game.awayTeam.score} - {game.homeTeam.score}
                    </Text>
                    <Text bold>{game.homeTeam.teamTricode}</Text>
                </Box>

                {/* Social Heat Indicator */}
                {heat && heat.level !== 'cold' && (
                    <Box marginTop={0}>
                        <HeatIndicator level={heat.level} count={heat.count} />
                    </Box>
                )}

                {/* Show odds for future games */}
                {isFuture && odds && odds.awayOdds > 0 && (
                    <Box gap={1}>
                        <Text color="yellow">📊 Odds:</Text>
                        <Text color="white">{game.awayTeam.teamTricode}</Text>
                        <Text color="green" bold>{odds.awayOdds.toFixed(2)}</Text>
                        <Text color="gray">|</Text>
                        <Text color="green" bold>{odds.homeOdds.toFixed(2)}</Text>
                        <Text color="white">{game.homeTeam.teamTricode}</Text>
                    </Box>
                )}
                <Text color={isLive ? "green" : "gray"}>
                    {isLive && (dotVisible ? "● " : "○ ")}{isLive && "LIVE "}{statusText}
                </Text>
            </Box>
        </Box>
    );
}
