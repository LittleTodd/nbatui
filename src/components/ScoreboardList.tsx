import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { type Game, type GameOdds, findGameOdds, getGameStatusInfo } from '../services/apiClient.js';
import { TEAM_BG_COLORS, TEAM_TEXT_COLORS } from '../data/teamColors.js';
import { evaluateGameClutch } from './ClutchTicker.js';
import { checkGameMatchesFilter } from '../utils/mapRendering.js';

interface ScoreboardListProps {
    games: Game[];
    odds: Record<string, GameOdds>;
    selectedIndex: number;
    searchFilter?: string;
    spoilerFree?: boolean;
    liveDotVisible: boolean;
    maxWidth: number;
}

/**
 * Compact Scoreboard List View
 * Sorted by Live (highest clutch leverage first) -> Upcoming -> Final.
 * Used both when toggling 'm' and automatically on narrow/split terminals.
 */
export function ScoreboardList({
    games,
    odds,
    selectedIndex,
    searchFilter = '',
    spoilerFree = false,
    liveDotVisible,
    maxWidth
}: ScoreboardListProps) {
    const sortedRows = useMemo(() => {
        return games
            .map((game, originalIndex) => {
                const clutch = evaluateGameClutch(game, originalIndex);
                // Priority: 0 = Live, 1 = Upcoming, 2 = Final
                const statusOrder = game.gameStatus === 2 ? 0 : game.gameStatus === 1 ? 1 : 2;
                return { game, originalIndex, statusOrder, leverage: clutch.leverageScore, isCrunch: clutch.isCrunchTime };
            })
            .sort((a, b) => {
                if (a.statusOrder !== b.statusOrder) return a.statusOrder - b.statusOrder;
                if (a.leverage !== b.leverage) return b.leverage - a.leverage;
                return a.originalIndex - b.originalIndex;
            });
    }, [games]);

    const boxWidth = Math.max(46, Math.min(76, maxWidth - 4));

    return (
        <Box
            flexDirection="column"
            borderStyle="round"
            borderColor="cyan"
            paddingX={1}
            width={boxWidth}
        >
            <Box justifyContent="space-between" marginBottom={1}>
                <Text bold color="cyan">📋 SCOREBOARD LIST</Text>
                <Text dimColor>[m] Switch to Map</Text>
            </Box>

            {sortedRows.map(({ game, originalIndex, isCrunch }) => {
                const isSelected = originalIndex === selectedIndex;
                const isHighlighted = checkGameMatchesFilter(game, searchFilter);
                const { text: statusText, isLive, isFinal } = getGameStatusInfo(game);
                const away = game.awayTeam.teamTricode;
                const home = game.homeTeam.teamTricode;
                const awayBg = TEAM_BG_COLORS[away] || '#333';
                const homeBg = TEAM_BG_COLORS[home] || '#333';
                const awayText = TEAM_TEXT_COLORS[away] || '#fff';
                const homeText = TEAM_TEXT_COLORS[home] || '#fff';

                const gameDate = game.localDate || game.gameDateET || game.gameTimeUTC?.slice(0, 10) || '';
                const gameOdds = findGameOdds(odds, away, home, gameDate);

                const awayScoreStr = game.gameStatus === 1
                    ? '  -'
                    : spoilerFree
                        ? '  ?'
                        : String(game.awayTeam.score).padStart(3, ' ');
                const homeScoreStr = game.gameStatus === 1
                    ? '-  '
                    : spoilerFree
                        ? '?  '
                        : String(game.homeTeam.score).padEnd(3, ' ');

                const prefix = isSelected ? '▶ ' : isHighlighted ? '» ' : '  ';
                const statusBadge = isLive
                    ? `${liveDotVisible ? '●' : '○'} ${isCrunch ? 'CLUTCH ' : ''}${statusText}`
                    : isFinal
                        ? 'FINAL'
                        : statusText;

                return (
                    <Box key={game.gameId} justifyContent="space-between">
                        <Box>
                            <Text bold={isSelected} color={isSelected ? 'cyan' : isHighlighted ? 'yellow' : undefined}>
                                {prefix}
                            </Text>
                            <Text backgroundColor={awayBg} color={awayText} bold>{` ${away} `}</Text>
                            <Text bold={isSelected || isLive} color={isSelected ? 'cyan' : undefined}>
                                {' '}{awayScoreStr} - {homeScoreStr}{' '}
                            </Text>
                            <Text backgroundColor={homeBg} color={homeText} bold>{` ${home} `}</Text>
                        </Box>

                        <Box>
                            {game.gameStatus === 1 && gameOdds && !spoilerFree && gameOdds.homeProb > 0 && (
                                <Text dimColor>
                                    {gameOdds.homeProb > gameOdds.awayProb ? home : away} {Math.round(Math.max(gameOdds.homeProb, gameOdds.awayProb))}%{'  '}
                                </Text>
                            )}
                            <Text
                                bold={isLive || isSelected}
                                color={isCrunch ? 'red' : isLive ? 'green' : isFinal ? 'blue' : 'gray'}
                            >
                                {statusBadge}
                            </Text>
                        </Box>
                    </Box>
                );
            })}
        </Box>
    );
}
