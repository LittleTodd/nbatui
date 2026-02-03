import React from 'react';
import { Box, Text } from 'ink';
import type { GameLogEntry, TeamSeasonInfo, TeamSeasonRanks } from '../../services/apiClient.js';
import { TEAM_BG_COLORS, TEAM_TEXT_COLORS } from '../../data/teamColors.js';

interface RecordTabProps {
    games: GameLogEntry[];
    seasonInfo: TeamSeasonInfo | null;
    seasonRanks: TeamSeasonRanks | null;
    streak: number;
    streakType: string;
    loading: boolean;
}

export const RecordTab = ({ games, seasonInfo, seasonRanks, streak, streakType, loading }: RecordTabProps) => {
    if (loading) {
        return (
            <Box flexDirection="column" alignItems="center" justifyContent="center" height={15}>
                <Text color="yellow">Loading record...</Text>
            </Box>
        );
    }

    return (
        <Box flexDirection="column">
            {/* Season Overview */}
            {seasonInfo && (
                <Box flexDirection="column" marginBottom={1}>
                    <Box>
                        <Text bold color="white">
                            {seasonInfo.teamCity} {seasonInfo.teamName}
                        </Text>
                        <Text dimColor>  {seasonInfo.seasonYear}</Text>
                    </Box>
                    <Box marginTop={0}>
                        <Text color="green" bold>{seasonInfo.wins}-{seasonInfo.losses}</Text>
                        <Text dimColor> ({(seasonInfo.pct * 100).toFixed(1)}%)</Text>
                        <Text>  </Text>
                        <Text color="cyan">{seasonInfo.conference} #{seasonInfo.confRank}</Text>
                        <Text>  </Text>
                        <Text dimColor>{seasonInfo.division} #{seasonInfo.divRank}</Text>
                    </Box>
                </Box>
            )}

            {/* Streak and Rankings */}
            <Box marginBottom={1}>
                {streak > 0 && (
                    <Box marginRight={2}>
                        <Text dimColor>Streak: </Text>
                        <Text color={streakType === 'W' ? 'green' : 'red'} bold>
                            {streakType}{streak}
                        </Text>
                    </Box>
                )}
                {seasonRanks && (
                    <>
                        <Text dimColor>PPG: </Text>
                        <Text color="green">{seasonRanks.ptsPg?.toFixed(1)}</Text>
                        <Text dimColor> (#{seasonRanks.ptsRank})  </Text>
                        <Text dimColor>OPP: </Text>
                        <Text color="red">{seasonRanks.oppPtsPg?.toFixed(1)}</Text>
                        <Text dimColor> (#{seasonRanks.oppPtsRank})</Text>
                    </>
                )}
            </Box>

            {/* Recent Games Header */}
            <Box marginBottom={0}>
                <Text bold underline color="cyan">Recent Games</Text>
            </Box>

            {/* Games Header */}
            <Box>
                <Box width={8}><Text dimColor>Date</Text></Box>
                <Box width={16}><Text dimColor>Opponent</Text></Box>
                <Box width={4}><Text dimColor>W/L</Text></Box>
                <Box width={12}><Text dimColor>Score</Text></Box>
            </Box>

            {/* Divider */}
            <Box marginBottom={0}>
                <Text dimColor>{'─'.repeat(40)}</Text>
            </Box>

            {/* Recent Games - show 10 to fit in modal */}
            {games.slice(0, 10).map((game, idx) => {
                // Format date with timezone conversion
                // NBA API returns dates like "JAN 31, 2026" in Eastern Time
                // We need to convert to user's local timezone
                const dateStr = game.date || '';
                let shortDate = dateStr;
                const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
                const monthMap: Record<string, number> = {
                    'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
                    'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
                };

                try {
                    // Handle NBA format like "JAN 31, 2026" or "FEB 02, 2026"
                    const nbaDateMatch = dateStr.match(/^([A-Z]{3})\s+(\d{1,2}),\s*(\d{4})$/i);
                    if (nbaDateMatch && nbaDateMatch[1] && nbaDateMatch[2] && nbaDateMatch[3]) {
                        const monthStr = nbaDateMatch[1].toUpperCase();
                        const day = parseInt(nbaDateMatch[2], 10);
                        const year = parseInt(nbaDateMatch[3], 10);
                        const monthNum = monthMap[monthStr];

                        if (monthNum !== undefined && !isNaN(day) && !isNaN(year)) {
                            // Create date in ET (assume game ends around 10pm ET = 22:00)
                            // This helps convert to the correct local date for users in different timezones
                            const etDateStr = `${year}-${String(monthNum + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T22:00:00-05:00`;
                            const etDate = new Date(etDateStr);

                            if (!isNaN(etDate.getTime())) {
                                // Convert to local date
                                const localMonth = months[etDate.getMonth()];
                                const localDay = etDate.getDate();
                                shortDate = `${localMonth} ${localDay}`;
                            } else {
                                shortDate = `${monthStr} ${day}`;
                            }
                        }
                    }
                    // Handle ISO format (YYYY-MM-DD)
                    else if (dateStr.includes('-') && dateStr.length >= 10) {
                        const parts = dateStr.split('-');
                        if (parts.length >= 3 && parts[0] && parts[1] && parts[2]) {
                            const year = parseInt(parts[0], 10);
                            const month = parseInt(parts[1], 10);
                            const day = parseInt(parts[2].slice(0, 2), 10);

                            // Create date in ET
                            const etDateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T22:00:00-05:00`;
                            const etDate = new Date(etDateStr);

                            if (!isNaN(etDate.getTime())) {
                                const localMonth = months[etDate.getMonth()];
                                const localDay = etDate.getDate();
                                shortDate = `${localMonth} ${localDay}`;
                            } else {
                                shortDate = `${months[month - 1] || 'UNK'} ${day}`;
                            }
                        }
                    }
                } catch {
                    // Fallback: use raw date
                    shortDate = dateStr.slice(0, 6);
                }

                // Format score as "TeamPTS-OppPTS"
                // oppPoints may be missing from cached data, use plusMinus to calculate if available
                let oppScore = game.oppPoints;
                if (!oppScore && game.plusMinus !== undefined) {
                    oppScore = game.points - game.plusMinus;
                }
                const scoreDisplay = `${game.points}-${oppScore || '?'}`;

                // Extract opponent for styling
                const matchupStr = (game.matchup || '').replace(/^[A-Z]+\s+(@|vs\.)/, '$1');
                let prefix = matchupStr;
                let oppTeam = '';

                const match = matchupStr.match(/^(@|vs\.)\s+([A-Z]+)$/);
                if (match && match[1] && match[2]) {
                    prefix = match[1] === '@' ? '✈️' : '🏟️';
                    oppTeam = match[2];
                }

                const bgColor = oppTeam ? TEAM_BG_COLORS[oppTeam] : undefined;
                const textColor = oppTeam ? TEAM_TEXT_COLORS[oppTeam] : undefined;

                return (
                    <Box key={game.gameId || idx}>
                        <Box width={8}>
                            <Text dimColor>{shortDate}</Text>
                        </Box>
                        <Box width={16}>
                            {oppTeam && bgColor ? (
                                <Text>
                                    <Text>{prefix} </Text>
                                    <Text color={textColor} backgroundColor={bgColor}> {oppTeam} </Text>
                                </Text>
                            ) : (
                                <Text>{matchupStr.slice(0, 15)}</Text>
                            )}
                        </Box>
                        <Box width={4}>
                            <Text color={game.result === 'W' ? 'green' : 'red'} bold>
                                {game.result}
                            </Text>
                        </Box>
                        <Box width={12}>
                            <Text color={game.result === 'W' ? 'green' : 'red'}>
                                {scoreDisplay}
                            </Text>
                        </Box>
                    </Box>
                );
            })}
        </Box>
    );
};
