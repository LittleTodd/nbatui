import React from 'react';
import { Box, Text } from 'ink';
import { TeamBackground, RetiredNumber, HallOfFamer } from '../../services/apiClient.js';

interface InfoTabProps {
    background: TeamBackground | null;
    championships: { year: number }[];
    retiredNumbers: RetiredNumber[];
    hallOfFame: HallOfFamer[];
    loading: boolean;
}

export const InfoTab = ({ background, championships, retiredNumbers, hallOfFame, loading }: InfoTabProps) => {
    if (loading) {
        return (
            <Box flexDirection="column" alignItems="center" justifyContent="center" height={15}>
                <Text color="yellow">Loading team info...</Text>
            </Box>
        );
    }

    if (!background) {
        return (
            <Box flexDirection="column" alignItems="center" justifyContent="center" height={15}>
                <Text dimColor>No team info available</Text>
            </Box>
        );
    }

    return (
        <Box flexDirection="column">
            {/* Team Header */}
            <Box flexDirection="column" marginBottom={1}>
                <Box>
                    <Text bold color="white">
                        {background.city} {background.nickname}
                    </Text>
                    <Text dimColor>  Est. {background.yearFounded}</Text>
                </Box>
            </Box>

            {/* Basic Info */}
            <Box flexDirection="column" marginBottom={1}>
                <Box>
                    <Text dimColor>Arena: </Text>
                    <Text>{background.arena}</Text>
                    {background.arenaCapacity && (
                        <Text dimColor> ({background.arenaCapacity})</Text>
                    )}
                </Box>
                <Box>
                    <Text dimColor>Owner: </Text>
                    <Text>{background.owner || 'N/A'}</Text>
                </Box>
                <Box>
                    <Text dimColor>GM: </Text>
                    <Text>{background.gm || 'N/A'}</Text>
                    <Text>  </Text>
                    <Text dimColor>Coach: </Text>
                    <Text>{background.headCoach || 'N/A'}</Text>
                </Box>
                {background.dLeagueAffiliate && (
                    <Box>
                        <Text dimColor>G League: </Text>
                        <Text>{background.dLeagueAffiliate}</Text>
                    </Box>
                )}
            </Box>

            {/* Championships */}
            {championships && championships.length > 0 && (
                <Box flexDirection="column" marginBottom={1}>
                    <Box>
                        <Text bold color="yellow">🏆 Championships ({championships.length})</Text>
                    </Box>
                    <Box flexWrap="wrap" width={48}>
                        <Text>
                            {championships
                                .map(c => c.year)
                                .sort((a, b) => b - a)
                                .slice(0, 12)
                                .join(', ')}
                            {championships.length > 12 ? '...' : ''}
                        </Text>
                    </Box>
                </Box>
            )}

            {/* Retired Numbers */}
            {retiredNumbers && retiredNumbers.length > 0 && (
                <Box flexDirection="column" marginBottom={1}>
                    <Box>
                        <Text bold color="cyan">Retired Numbers</Text>
                    </Box>
                    <Box flexDirection="row" flexWrap="wrap">
                        {retiredNumbers.slice(0, 8).map((r, idx) => (
                            <Box key={idx} marginRight={2}>
                                <Text color="yellow">#{r.jersey}</Text>
                                <Text dimColor> {r.player?.split(' ').pop()}</Text>
                            </Box>
                        ))}
                        {retiredNumbers.length > 8 && (
                            <Text dimColor>+{retiredNumbers.length - 8} more</Text>
                        )}
                    </Box>
                </Box>
            )}

            {/* Hall of Fame */}
            {hallOfFame && hallOfFame.length > 0 && (
                <Box flexDirection="column">
                    <Box>
                        <Text bold color="magenta">Hall of Fame ({hallOfFame.length})</Text>
                    </Box>
                    <Box flexDirection="row" flexWrap="wrap">
                        {hallOfFame.slice(0, 6).map((h, idx) => (
                            <Box key={idx} marginRight={2}>
                                <Text>{h.player?.split(' ').pop()}</Text>
                            </Box>
                        ))}
                        {hallOfFame.length > 6 && (
                            <Text dimColor>+{hallOfFame.length - 6} more</Text>
                        )}
                    </Box>
                </Box>
            )}
        </Box>
    );
};
