
import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { getGameStatusInfo, type Game, type GameOdds } from '../services/apiClient.js';
import { WinProbabilityBar } from './WinProbabilityBar.js';
import { TEAM_BG_COLORS } from '../data/teamColors.js';

interface GameDetailProps {
    game: Game;
    odds?: GameOdds;
    currentIndex: number;
    totalGames: number;
    spoilerFree?: boolean;
}

/**
 * Determine game type based on date
 * - Preseason: Before ~Oct 20
 * - Regular Season: Oct 20 - mid April
 * - Playoffs: mid April - June
 * - Summer League: July
 */
function getGameTypeLabel(gameTimeUTC: string): { label: string; color: string } {
    if (!gameTimeUTC) return { label: '🏀 Regular Season', color: 'gray' };

    const gameDate = new Date(gameTimeUTC);
    if (Number.isNaN(gameDate.getTime())) {
        return { label: '🏀 Regular Season', color: 'gray' };
    }
    const month = gameDate.getMonth(); // 0-indexed (0=Jan ... 3=Apr ... 9=Oct)
    const day = gameDate.getDate();

    if (month === 9 && day < 20) {
        return { label: '🏋️ Preseason', color: 'yellow' };
    }

    if ((month === 3 && day >= 15) || (month >= 4 && month <= 5)) {
        return { label: '🏆 Playoffs', color: 'magenta' };
    }

    if (month === 6) {
        return { label: '☀️ Summer League', color: 'cyan' };
    }

    return { label: '🏀 Regular Season', color: 'gray' };
}

// Selected game detail panel
export function GameDetail({ game, odds, currentIndex, totalGames, spoilerFree = false }: GameDetailProps) {
    const { text: statusText, isLive } = getGameStatusInfo(game);
    const isFuture = game.gameStatus === 1;

    const [dotVisible, setDotVisible] = useState(true);
    useEffect(() => {
        if (!isLive) return;
        const timer = setInterval(() => {
            setDotVisible(v => !v);
        }, 500);
        return () => clearInterval(timer);
    }, [isLive]);

    const { label: gameTypeLabel, color: gameTypeColor } = getGameTypeLabel(game.gameTimeUTC);
    const borderColor = TEAM_BG_COLORS[game.homeTeam.teamTricode] || 'cyan';

    const scoreDisplay = isFuture
        ? 'vs'
        : spoilerFree
            ? '? - ?'
            : `${game.awayTeam.score} - ${game.homeTeam.score}`;

    return (
        <Box
            borderStyle="round"
            borderColor={borderColor}
            paddingX={2}
            marginTop={1}
            justifyContent="center"
        >
            <Box flexDirection="column" alignItems="center">
                <Box marginBottom={0}>
                    <Text dimColor>◀ </Text>
                    <Text bold color="yellow">{currentIndex + 1}</Text>
                    <Text dimColor>/{totalGames}</Text>
                    <Text dimColor> ▶  </Text>
                    <Text dimColor color={gameTypeColor}>{gameTypeLabel}</Text>
                </Box>

                <Text bold color="cyan">
                    {game.awayTeam.teamCity} {game.awayTeam.teamName} @ {game.homeTeam.teamCity} {game.homeTeam.teamName}
                </Text>
                <Box gap={2}>
                    <Text bold>{game.awayTeam.teamTricode}</Text>
                    <Text
                        bold
                        color={isLive && !spoilerFree ? 'white' : undefined}
                        backgroundColor={isLive && !spoilerFree ? 'green' : undefined}
                    >
                        {' '}{scoreDisplay}{' '}
                    </Text>
                    <Text bold>{game.homeTeam.teamTricode}</Text>
                </Box>

                {isFuture && !spoilerFree && odds && odds.homeProb > 0 && (
                    <Box marginTop={1}>
                        <WinProbabilityBar
                            awayProb={odds.awayProb}
                            homeProb={odds.homeProb}
                            awayTricode={game.awayTeam.teamTricode}
                            homeTricode={game.homeTeam.teamTricode}
                        />
                    </Box>
                )}
                <Text color={isLive ? 'green' : 'gray'}>
                    {isLive && (dotVisible ? '● ' : '○ ')}{isLive && 'LIVE '}{statusText}
                </Text>
            </Box>
        </Box>
    );
}
