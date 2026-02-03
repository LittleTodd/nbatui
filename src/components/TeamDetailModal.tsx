import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { RosterTab } from './tabs/RosterTab.js';
import { RecordTab } from './tabs/RecordTab.js';
import { InfoTab } from './tabs/InfoTab.js';
import {
    fetchTeamRoster,
    fetchTeamGamelog,
    fetchTeamInfo,
} from '../services/apiClient.js';
import type {
    TeamRoster,
    TeamGamelog,
    TeamInfo,
} from '../services/apiClient.js';

interface StandingTeam {
    TeamID: number;
    TeamName: string;
    TeamCity?: string;
    Conference: string;
    WINS: number;
    LOSSES: number;
    PlayoffRank: number;
}

interface TeamDetailModalProps {
    team: StandingTeam | null;
    visible: boolean;
    onClose: () => void;
}

type TabType = 'roster' | 'record' | 'info';

export const TeamDetailModal = ({ team, visible, onClose }: TeamDetailModalProps) => {
    const [activeTab, setActiveTab] = useState<TabType>('roster');
    const [roster, setRoster] = useState<TeamRoster | null>(null);
    const [gamelog, setGamelog] = useState<TeamGamelog | null>(null);
    const [teamInfo, setTeamInfo] = useState<TeamInfo | null>(null);
    const [loading, setLoading] = useState<Record<TabType, boolean>>({
        roster: false,
        record: false,
        info: false,
    });

    // Handle keyboard input
    useInput((input, key) => {
        if (!visible) return;

        if (key.escape || input === 'q') {
            onClose();
            return;
        }

        // Tab switching with Tab key or number keys
        if (key.tab || key.rightArrow) {
            setActiveTab(prev => {
                if (prev === 'roster') return 'record';
                if (prev === 'record') return 'info';
                return 'roster';
            });
        }

        if (key.leftArrow || (key.shift && key.tab)) {
            setActiveTab(prev => {
                if (prev === 'info') return 'record';
                if (prev === 'record') return 'roster';
                return 'info';
            });
        }

        // Direct tab selection with number keys
        if (input === '1') setActiveTab('roster');
        if (input === '2') setActiveTab('record');
        if (input === '3') setActiveTab('info');
    });

    // Fetch data when tab changes or team changes
    useEffect(() => {
        if (!visible || !team) return;

        const teamId = team.TeamID;

        // Load data based on active tab
        if (activeTab === 'roster' && !roster) {
            setLoading(prev => ({ ...prev, roster: true }));
            fetchTeamRoster(teamId).then(data => {
                setRoster(data);
                setLoading(prev => ({ ...prev, roster: false }));
            });
        }

        if (activeTab === 'record' && !gamelog) {
            setLoading(prev => ({ ...prev, record: true }));
            Promise.all([
                fetchTeamGamelog(teamId),
                fetchTeamInfo(teamId), // Also fetch for season info
            ]).then(([logData, infoData]) => {
                setGamelog(logData);
                if (!teamInfo) setTeamInfo(infoData);
                setLoading(prev => ({ ...prev, record: false }));
            });
        }

        if (activeTab === 'info' && !teamInfo) {
            setLoading(prev => ({ ...prev, info: true }));
            fetchTeamInfo(teamId).then(data => {
                setTeamInfo(data);
                setLoading(prev => ({ ...prev, info: false }));
            });
        }
    }, [visible, team, activeTab, roster, gamelog, teamInfo]);

    // Reset state when team changes
    useEffect(() => {
        if (team) {
            setRoster(null);
            setGamelog(null);
            setTeamInfo(null);
            setActiveTab('roster');
        }
    }, [team?.TeamID]);

    if (!visible || !team) return null;

    const tabs: { key: TabType; label: string; emoji: string }[] = [
        { key: 'roster', label: 'Roster', emoji: '🏀' },
        { key: 'record', label: 'Record', emoji: '📊' },
        { key: 'info', label: 'Info', emoji: '🏆' },
    ];

    return (
        <Box
            flexDirection="column"
            borderStyle="double"
            borderColor="cyan"
            width={56}
            height={26}
            paddingX={1}
        >
            {/* Header */}
            <Box justifyContent="space-between" marginBottom={0}>
                <Box>
                    <Text bold color="white">
                        {team.TeamCity || ''} {team.TeamName}
                    </Text>
                    <Text dimColor>  {team.WINS}-{team.LOSSES}</Text>
                </Box>
                <Text dimColor>[Esc] Close</Text>
            </Box>

            {/* Tab Bar */}
            <Box marginBottom={1}>
                {tabs.map((tab, idx) => (
                    <Box key={tab.key} marginRight={2}>
                        <Text
                            color={activeTab === tab.key ? 'cyan' : 'gray'}
                            bold={activeTab === tab.key}
                            underline={activeTab === tab.key}
                        >
                            [{idx + 1}] {tab.emoji} {tab.label}
                        </Text>
                    </Box>
                ))}
            </Box>

            {/* Divider */}
            <Box marginBottom={0}>
                <Text dimColor>{'─'.repeat(52)}</Text>
            </Box>

            {/* Tab Content */}
            <Box flexDirection="column" flexGrow={1}>
                {activeTab === 'roster' && (
                    <RosterTab
                        players={roster?.players || []}
                        loading={loading.roster}
                    />
                )}
                {activeTab === 'record' && (
                    <RecordTab
                        games={gamelog?.games || []}
                        seasonInfo={teamInfo?.seasonInfo || null}
                        seasonRanks={teamInfo?.seasonRanks || null}
                        streak={gamelog?.streak || 0}
                        streakType={gamelog?.streakType || ''}
                        loading={loading.record}
                    />
                )}
                {activeTab === 'info' && (
                    <InfoTab
                        background={teamInfo?.background || null}
                        championships={teamInfo?.championships || []}
                        retiredNumbers={teamInfo?.retiredNumbers || []}
                        hallOfFame={teamInfo?.hallOfFame || []}
                        loading={loading.info}
                    />
                )}
            </Box>

            {/* Footer */}
            <Box marginTop={0}>
                <Text dimColor>← → Tab to switch • 1/2/3 for tabs • ↑/↓ Scroll</Text>
            </Box>
        </Box>
    );
};
