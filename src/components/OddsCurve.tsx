import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import { fetchTokenHistory, type PricePoint } from '../services/apiClient.js';
import { LeadTrackerChart } from './charts/LeadTrackerChart.js';
import { getChartColor, detectLightBackground, getContrastRatio, TEAM_TEXT_COLORS } from '../data/teamColors.js';

interface OddsCurveProps {
    clobId: string;
    teamTricode: string;
    oppTricode?: string;
}

export const OddsCurve: React.FC<OddsCurveProps> = ({ clobId, teamTricode, oppTricode }) => {
    const [history, setHistory] = useState<PricePoint[]>([]);
    const [loading, setLoading] = useState(true);

    // Detect terminal background and select high-contrast colors
    const isLight = detectLightBackground();
    let teamColor = getChartColor(teamTricode, isLight);
    let oppColor = oppTricode ? getChartColor(oppTricode, isLight) : '#888888';

    // If team and opponent colors are too similar (very low contrast), use text color for opponent
    // Threshold 1.5: BKN/NOP (1.3) triggers, CLE/PHI (1.9) does not
    // Also avoid using white (#FFFFFF) or black (#000000) as they don't work well in terminals
    if (oppTricode && getContrastRatio(teamColor, oppColor) < 1.5) {
        const textColor = TEAM_TEXT_COLORS[oppTricode];
        // Only use text color if it's not white or black
        if (textColor && textColor !== '#FFFFFF' && textColor !== '#000000') {
            oppColor = textColor;
        }
    }

    useEffect(() => {
        let mounted = true;
        const loadHistory = async () => {
            if (!clobId) return;
            setLoading(true);
            const data = await fetchTokenHistory(clobId);
            if (mounted) {
                setHistory(data);
                setLoading(false);
            }
        };
        loadHistory();
        return () => { mounted = false; };
    }, [clobId]);

    if (loading) {
        return <Text dimColor>Loading curve...</Text>;
    }

    if (!history || history.length === 0) {
        return <Text dimColor>No history data available.</Text>;
    }

    // Process and downsample data
    const sortedHistory = [...history].sort((a, b) => a.t - b.t);

    // Convert to centered values (50% = 0)
    const allData: number[] = sortedHistory
        .map(h => {
            const p = typeof h.p === 'number' && !isNaN(h.p) ? h.p : 0.5;
            return (p * 100) - 50;
        })
        .filter(v => isFinite(v));

    // Downsample to 80 points for more detailed view
    const maxPoints = 80;
    let chartData: number[] = [];

    if (allData.length <= maxPoints) {
        chartData = [...allData];
    } else {
        const step = allData.length / maxPoints;
        for (let i = 0; i < maxPoints; i++) {
            const idx = Math.floor(i * step);
            const val = allData[idx];
            if (val !== undefined) {
                chartData.push(val);
            }
        }
    }

    if (chartData.length < 2) {
        const firstVal = chartData[0];
        if (chartData.length === 1 && firstVal !== undefined) chartData.push(firstVal);
        else return <Text dimColor>No valid data points.</Text>;
    }

    return (
        <Box flexDirection="column" marginTop={1} width="100%" alignItems="center">
            <Box justifyContent="center" marginBottom={1}>
                <Text bold color="cyan">📈 Win Probability Tracker</Text>
            </Box>

            <LeadTrackerChart
                data={chartData}
                height={11}
                teamColor={teamColor}
                oppColor={oppColor}
                teamLabel={teamTricode}
                oppLabel={oppTricode || 'OPP'}
                width={80}
            />
        </Box>
    );
};

