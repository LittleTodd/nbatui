/**
 * PlayByPlayStream Component
 * Displays a scrolling stream of play-by-play events
 * Classic terminal color scheme - readable and easy on the eyes
 */
import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { TEAM_BG_COLORS, TEAM_TEXT_COLORS } from '../data/teamColors.js';

export interface PlayByPlayAction {
    actionNumber: number;
    clock: string;
    period: number;
    periodType: string;
    description: string;
    teamTricode?: string;
    playerNameI?: string;
    scoreHome: string;
    scoreAway: string;
    actionType: string;
    shotResult?: string;
}

interface DisplayAction {
    id: string;
    period: number;
    periodType: string;
    clock: string;
    teamTricode?: string;
    description: string;
    actionType: string;
    shotResult?: string;
    scoreHome: string;
    scoreAway: string;
    subIn?: string[];
    subOut?: string[];
}

interface PlayByPlayStreamProps {
    actions: PlayByPlayAction[];
    homeTricode: string;
    awayTricode: string;
    homeName?: string;    // Team nickname, e.g., "Rockets"
    awayName?: string;    // Team nickname, e.g., "Nuggets"
    homeScore?: number;
    awayScore?: number;
    isLive?: boolean;
    maxItems?: number;
}

// Victory message templates - randomly selected
const VICTORY_TEMPLATES = [
    (winner: string) => `${winner} Win! 🎉`,
    (winner: string) => `${winner} take the W! 💪`,
    (winner: string) => `Victory for ${winner}! 🏆`,
    (winner: string) => `${winner} get it done! ✅`,
    (winner: string) => `What a game! ${winner} prevail! 🔥`,
    (winner: string) => `${winner} seal the deal! 👏`,
];

// Defeat message templates - randomly selected
const DEFEAT_TEMPLATES = [
    (loser: string) => `${loser} fall short 😢`,
    (loser: string) => `Tough loss for ${loser} 💔`,
    (loser: string) => `${loser} can't hold on 😞`,
    (loser: string) => `Not ${loser}'s night 🌙`,
    (loser: string) => `${loser} go down fighting 👎`,
    (loser: string) => `Heartbreak for ${loser} 💫`,
];

function parseGameClock(clock: string): string {
    if (!clock) return '--:--';
    const match = clock.match(/PT(\d+)M([\d.]+)S/);
    if (!match) return clock;
    const minutes = match[1] || '0';
    const seconds = Math.floor(parseFloat(match[2] || '0'));
    return `${minutes.padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatPeriod(period: number, periodType: string): string {
    if (periodType === 'OVERTIME' || period > 4) {
        return `OT${period - 4}`;
    }
    return `Q${period}`;
}

function consolidateActions(actions: PlayByPlayAction[]): DisplayAction[] {
    const result: DisplayAction[] = [];
    const subsMap = new Map<string, { subIn: string[], subOut: string[], period: number, clock: string, team: string }>();

    for (const action of actions) {
        if (action.actionType === 'substitution' || action.description?.toUpperCase().includes('SUB')) {
            const key = `${action.teamTricode || 'UNKNOWN'}_${action.period}_${action.clock}`;

            const subEntry = subsMap.get(key) || {
                subIn: [],
                subOut: [],
                period: action.period,
                clock: action.clock,
                team: action.teamTricode || 'UNKNOWN'
            };
            if (!subsMap.has(key)) subsMap.set(key, subEntry);

            const desc = action.description || '';
            const playerName = action.playerNameI || '';

            if (desc.toUpperCase().includes('SUB IN') || desc.toUpperCase().includes('ENTERS')) {
                const name = playerName || desc.replace(/SUB\s*(in|IN)?:?\s*/i, '').trim();
                if (name) subEntry.subIn.push(name);
            } else if (desc.toUpperCase().includes('SUB OUT') || desc.toUpperCase().includes('EXITS')) {
                const name = playerName || desc.replace(/SUB\s*(out|OUT)?:?\s*/i, '').trim();
                if (name) subEntry.subOut.push(name);
            } else if (desc.includes('for')) {
                const match = desc.match(/(.+?)\s+for\s+(.+)/i);
                if (match) {
                    subEntry.subIn.push(match[1].trim());
                    subEntry.subOut.push(match[2].trim());
                }
            }
        } else {
            result.push({
                id: `${action.actionNumber}`,
                period: action.period,
                periodType: action.periodType,
                clock: action.clock,
                teamTricode: action.teamTricode,
                description: action.description,
                actionType: action.actionType,
                shotResult: action.shotResult,
                scoreHome: action.scoreHome,
                scoreAway: action.scoreAway
            });
        }
    }

    for (const [key, subs] of subsMap) {
        if (subs.subIn.length === 0 && subs.subOut.length === 0) continue;
        result.push({
            id: `sub_${key}`,
            period: subs.period,
            periodType: 'REGULAR',
            clock: subs.clock,
            teamTricode: subs.team !== 'UNKNOWN' ? subs.team : undefined,
            description: '',
            actionType: 'substitution',
            shotResult: undefined,
            scoreHome: '',
            scoreAway: '',
            subIn: subs.subIn,
            subOut: subs.subOut
        });
    }

    // Sort: newest first
    // - Higher period first (Q4 before Q3)
    // - Within same period: lower clock first (00:05 happened after 12:00)
    result.sort((a, b) => {
        if (a.period !== b.period) return b.period - a.period;
        return a.clock.localeCompare(b.clock);  // Lower clock = happened later = show first
    });

    return result;
}

export function PlayByPlayStream({
    actions,
    homeTricode,
    awayTricode,
    homeName,
    awayName,
    homeScore,
    awayScore,
    isLive = false,
    maxItems = 10
}: PlayByPlayStreamProps) {
    const [scrollOffset, setScrollOffset] = useState(0);

    const displayActions = useMemo(() => {
        const filtered = actions.filter(a =>
            a.description &&
            !a.description.includes('Period Start') &&
            !a.description.includes('Period End') &&
            !a.description.includes('Game End') &&
            a.actionType !== 'stoppage' &&
            a.actionType !== 'period' &&
            a.actionType !== 'game'
        );
        return consolidateActions(filtered);
    }, [actions]);

    useInput((input, key) => {
        if (key.upArrow) setScrollOffset(prev => Math.max(0, prev - 1));
        if (key.downArrow) setScrollOffset(prev => Math.min(Math.max(0, displayActions.length - maxItems), prev + 1));
    });

    const visibleActions = displayActions.slice(scrollOffset, scrollOffset + maxItems);

    if (visibleActions.length === 0) {
        return (
            <Box flexDirection="column" paddingX={1}>
                <Text dimColor>No play-by-play data available.</Text>
            </Box>
        );
    }

    const homeColor = TEAM_BG_COLORS[homeTricode] || '#444444';
    const awayColor = TEAM_BG_COLORS[awayTricode] || '#666666';

    const finalResultMsg = useMemo(() => {
        if (isLive) return '';

        const hasScore = homeScore !== undefined && awayScore !== undefined;
        if (!hasScore) return '';

        const winnerName = homeScore > awayScore ? (homeName || homeTricode) : (awayName || awayTricode);
        const loserName = homeScore > awayScore ? (awayName || awayTricode) : (homeName || homeTricode);

        // Randomly choose between victory or defeat message
        const useVictory = Math.random() > 0.5;
        if (useVictory && winnerName) {
            const template = VICTORY_TEMPLATES[Math.floor(Math.random() * VICTORY_TEMPLATES.length)];
            return template ? template(winnerName) : '';
        } else if (loserName) {
            const template = DEFEAT_TEMPLATES[Math.floor(Math.random() * DEFEAT_TEMPLATES.length)];
            return template ? template(loserName) : '';
        }
        return '';
    }, [isLive, homeScore, awayScore, homeName, homeTricode, awayName, awayTricode]);

    return (
        <Box flexDirection="column">
            {/* Header */}


            {/* Event Stream */}
            <Box flexDirection="column">
                {/* Game End indicator - shows first since it's chronologically last */}
                {/* Game End indicator - shows first since it's chronologically last */}
                {!isLive && displayActions.length > 0 && finalResultMsg && (() => {
                    const lastAction = displayActions[0];
                    const endPeriodStr = lastAction ? formatPeriod(lastAction.period, lastAction.periodType) : 'Q4';
                    return (
                        <Box>
                            <Text dimColor>[{endPeriodStr} 00:00]</Text>
                            <Text> </Text>
                            <Text bold color="yellow">🏀 FINAL</Text>
                            <Text bold color="white"> {awayScore}-{homeScore}</Text>
                            <Text>, </Text>
                            <Text color="cyan">{finalResultMsg}</Text>
                        </Box>
                    );
                })()}
                {visibleActions.map((action, idx) => {
                    const isHomeTeam = action.teamTricode === homeTricode;
                    const teamBgColor = action.teamTricode
                        ? (isHomeTeam ? homeColor : awayColor)
                        : '#333333';

                    const isScoring = action.shotResult === 'Made' &&
                        (action.actionType === '2pt' || action.actionType === '3pt' || action.actionType === 'freethrow');

                    let descColor = 'white';
                    if (action.shotResult === 'Made') {
                        descColor = 'green';
                    } else if (action.shotResult === 'Missed') {
                        descColor = 'gray';
                    } else if (action.actionType === 'turnover') {
                        descColor = 'red';
                    } else if (action.actionType === 'foul') {
                        descColor = 'yellow';
                    } else if (action.actionType === 'rebound') {
                        descColor = 'cyan';
                    }

                    return (
                        <Box key={`${action.id}-${idx}`} justifyContent="space-between">
                            {/* Left side: time, team, event */}
                            <Box>
                                <Text dimColor>
                                    [{formatPeriod(action.period, action.periodType)} {parseGameClock(action.clock)}]
                                </Text>
                                <Text> </Text>

                                {action.teamTricode ? (
                                    <Box>
                                        <Text backgroundColor={teamBgColor} color={TEAM_TEXT_COLORS[action.teamTricode] || '#ffffff'} bold>
                                            {' '}{action.teamTricode}{' '}
                                        </Text>
                                    </Box>
                                ) : (
                                    <Text dimColor> --- </Text>
                                )}
                                <Text> </Text>

                                {action.actionType === 'substitution' ? (
                                    <Box>
                                        {action.subIn && action.subIn.length > 0 && (
                                            <>
                                                <Text color="green">↑ {action.subIn.join(', ')}</Text>
                                                {action.subOut && action.subOut.length > 0 && <Text> </Text>}
                                            </>
                                        )}
                                        {action.subOut && action.subOut.length > 0 && (
                                            <Text color="red">↓ {action.subOut.join(', ')}</Text>
                                        )}
                                    </Box>
                                ) : (
                                    <>
                                        <Text color={descColor} wrap="truncate-end">{action.description}</Text>
                                        {action.shotResult === 'Made' && action.actionType === '3pt' && (
                                            <Text color="green" bold> +3</Text>
                                        )}
                                        {action.shotResult === 'Made' && action.actionType === '2pt' && (
                                            <Text color="green"> +2</Text>
                                        )}
                                        {action.shotResult === 'Made' && action.actionType === 'freethrow' && (
                                            <Text color="green"> +1</Text>
                                        )}
                                    </>
                                )}
                            </Box>

                            {/* Right side: score (right-aligned, bold, no parentheses) */}
                            {isScoring && action.scoreAway && action.scoreHome && (
                                <Text bold>{action.scoreAway}-{action.scoreHome}</Text>
                            )}
                        </Box>
                    );
                })}
            </Box>

            {/* Footer - always maintain same height for layout stability */}
            <Box marginTop={1} justifyContent="flex-end" height={1}>
                {displayActions.length > maxItems ? (
                    <Text dimColor>
                        [{scrollOffset + 1}-{Math.min(scrollOffset + maxItems, displayActions.length)}/{displayActions.length}] ↑↓
                    </Text>
                ) : (
                    <Text> </Text>
                )}
            </Box>
        </Box>
    );
}
