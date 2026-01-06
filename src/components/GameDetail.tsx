
import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { getGameStatusInfo, type Game, type GameOdds } from '../services/apiClient.js';
import { HeatIndicator } from './HeatIndicator.js';
import { WinProbabilityBar } from './WinProbabilityBar.js';
import { TEAM_BG_COLORS } from '../data/teamColors.js';
import { type HeatData } from '../hooks/useSocialHeat.js';

interface GameDetailProps {
    game: Game;
    odds?: GameOdds;
    currentIndex: number;
    totalGames: number;
    heat?: HeatData;
}

/**
 * Determine game type based on date
 * - Preseason: Before ~Oct 20
 * - Regular Season: Oct 20 - mid April
 * - Playoffs: mid April onwards
 */
function getGameTypeLabel(gameTimeUTC: string): { label: string; color: string } {
    if (!gameTimeUTC) return { label: 'Regular Season', color: 'gray' };

    const gameDate = new Date(gameTimeUTC);
    const month = gameDate.getMonth(); // 0-indexed
    const day = gameDate.getDate();

    // October (month 9) before day 20 = Preseason
    if (month === 9 && day < 20) {
        return { label: '🏋️ Preseason', color: 'yellow' };
    }

    // April (month 3) after day 15, or May onwards = Playoffs
    if ((month === 3 && day >= 15) || month >= 4) {
        return { label: '🏆 Playoffs', color: 'magenta' };
    }

    return { label: '🏀 Regular Season', color: 'gray' };
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

    // Game type label
    const { label: gameTypeLabel, color: gameTypeColor } = getGameTypeLabel(game.gameTimeUTC);

    // Border color: use home team color, but heat overrides
    let borderColor = TEAM_BG_COLORS[game.homeTeam.teamTricode] || 'cyan';
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
                <Box marginBottom={0}>
                    <Text dimColor>◀ </Text>
                    <Text bold color="yellow">{currentIndex + 1}</Text>
                    <Text dimColor>/{totalGames}</Text>
                    <Text dimColor> ▶</Text>
                </Box>

                {/* Game Type Label */}
                <Box marginBottom={1}>
                    <Text dimColor color={gameTypeColor}>{gameTypeLabel}</Text>
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

                {/* Win Probability Bar for future games */}
                {isFuture && odds && odds.homeProb > 0 && (
                    <Box marginTop={1}>
                        <WinProbabilityBar
                            awayProb={odds.awayProb}
                            homeProb={odds.homeProb}
                            awayTricode={game.awayTeam.teamTricode}
                            homeTricode={game.homeTeam.teamTricode}
                        />
                    </Box>
                )}
                <Text color={isLive ? "green" : "gray"}>
                    {isLive && (dotVisible ? "● " : "○ ")}{isLive && "LIVE "}{statusText}
                </Text>
            </Box>
        </Box>
    );
}
