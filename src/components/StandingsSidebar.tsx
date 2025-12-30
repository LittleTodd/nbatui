import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { fetchStandings } from '../services/apiClient.js';

interface StandingsSidebarProps {
    visible: boolean;
}

export const StandingsSidebar = ({ visible }: StandingsSidebarProps) => {
    const [standings, setStandings] = useState<any[]>([]);

    useEffect(() => {
        if (visible) {
            fetchStandings().then(data => {
                if (data && data.standings) {
                    setStandings(data.standings);
                }
            });
        }
    }, [visible]);

    if (!visible) return null;

    if (!standings.length) {
        return (
            <Box borderStyle="single" flexDirection="column" paddingX={1}>
                <Text>Loading...</Text>
            </Box>
        );
    }

    // Split East/West and take top 15
    const east = standings.filter((t: any) => t.Conference === 'East').slice(0, 15);
    const west = standings.filter((t: any) => t.Conference === 'West').slice(0, 15);

    const renderTeamRow = (t: any) => {
        const rank = t.PlayoffRank;
        const record = `${t.WINS}-${t.LOSSES}`;
        let color = 'gray'; // 11-15 (Lottery)

        if (rank <= 6) color = 'green'; // Playoff
        else if (rank <= 10) color = 'yellow'; // Play-in

        // Compact name logic: City if short enough, otherwise Tricode? 
        // Or just City + Name truncated? Let's try City + Name truncated or just Name if City is long.
        // Actually, user suggested "前三位球队缩写来展示排名；如果空间足够显示球队的全名".
        // Let's stick to a fixed width layout.
        // Rank (3) | Team (14) | Record (7)
        // 14 chars for team name should fit most "City Name" combinations if we are careful, or just "Name".
        // Let's use TeamName (e.g. "Celtics") which is usually shorter than City+Name.
        // Wait, "Trail Blazers" is long. "Timberwolves" is long.
        // Let's use simpler logic: 
        // If (City + Name).length > 13 => use Tricode favored or just Name?
        // Let's try to fit "City Name" first, if > 16 chars, use Name. If Name > 16, use Tricode.

        let teamLabel = `${t.TeamCity} ${t.TeamName}`;
        if (teamLabel.length > 16) {
            teamLabel = t.TeamName; // Try just name
            if (teamLabel.length > 16) teamLabel = t.TeamCity; // Try just City
            if (teamLabel.length > 16) teamLabel = t.TeamTricode; // Fallback to Tricode
        }

        return (
            <Box key={t.TeamID} width={28}>
                <Box width={3}><Text color={color}>{rank}.</Text></Box>
                <Box width={17}><Text color={color}>{teamLabel}</Text></Box>
                <Box width={8} justifyContent="flex-end"><Text dimColor>{record}</Text></Box>
            </Box>
        );
    };

    return (
        <Box borderStyle="single" flexDirection="column" paddingX={1} marginLeft={1}>
            <Text bold underline>Standings</Text>

            <Box flexDirection="row" gap={4} marginTop={1}>
                {/* East */}
                <Box flexDirection="column">
                    <Box marginBottom={1}><Text color="cyan" bold>EAST</Text></Box>
                    {east.map(t => (
                        <Box flexDirection="column" key={t.TeamID}>
                            {renderTeamRow(t)}
                            {/* Spacers */}
                            {t.PlayoffRank === 6 && <Box height={1} />}
                            {t.PlayoffRank === 10 && <Box height={1} />}
                        </Box>
                    ))}
                </Box>

                {/* West */}
                <Box flexDirection="column">
                    <Box marginBottom={1}><Text color="green" bold>WEST</Text></Box>
                    {west.map(t => (
                        <Box flexDirection="column" key={t.TeamID}>
                            {renderTeamRow(t)}
                            {/* Spacers */}
                            {t.PlayoffRank === 6 && <Box height={1} />}
                            {t.PlayoffRank === 10 && <Box height={1} />}
                        </Box>
                    ))}
                </Box>
            </Box>

            <Box marginTop={1}>
                <Text dimColor>1-6:Playoff 7-10:Play-in</Text>
            </Box>
        </Box>
    );
};
