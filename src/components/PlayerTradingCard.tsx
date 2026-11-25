/**
 * PlayerTradingCard Component
 * 90s NBA Jam Arcade Style ASCII Collectible Trading Card
 *
 * Features:
 * - Retro card frame with holographic colors
 * - "HE'S ON FIRE!" heat streak indicator
 * - 5-Dimensional Skill Radar Bars (Scoring, Defense, Playmaking, Rebounding, Clutch)
 * - 1-Key OSC 52 Clipboard Copy ([y]) to share directly to Discord/Slack!
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { copyToClipboardOSC52 } from '../utils/terminalTitle.js';
import { TEAM_BG_COLORS, TEAM_TEXT_COLORS } from '../data/teamColors.js';

export interface TradingCardPlayer {
    personId: number;
    name: string;
    jerseyNum: string;
    position: string;
    teamTricode: string;
    statistics: {
        points?: number;
        reboundsTotal?: number;
        assists?: number;
        steals?: number;
        blocks?: number;
        turnovers?: number;
        foulsPersonal?: number;
        plusMinusPoints?: number;
        fieldGoalsMade?: number;
        fieldGoalsAttempted?: number;
        threePointersMade?: number;
        threePointersAttempted?: number;
        freeThrowsMade?: number;
        freeThrowsAttempted?: number;
        minutes?: string;
    };
}

interface PlayerTradingCardProps {
    player: TradingCardPlayer;
    onClose: () => void;
}

function renderBar(value: number, max: number = 100, length: number = 10): string {
    const safeVal = Number.isFinite(value) ? value : 0;
    const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
    const ratio = Math.max(0, Math.min(1, safeVal / safeMax));
    const filled = Math.round(ratio * length);
    return '█'.repeat(filled) + '░'.repeat(length - filled);
}

export function PlayerTradingCard({ player, onClose }: PlayerTradingCardProps) {
    const [copiedToast, setCopiedToast] = useState(false);
    const [flameFrame, setFlameFrame] = useState(0);

    // Defensively normalize all fields (NBA Live API frequently omits position/jerseyNum for bench players)
    const playerName = String(player?.name || 'Player');
    const jerseyNum = String(player?.jerseyNum ?? '-');
    const position = String(player?.position || 'N/A');
    const teamTricode = String(player?.teamTricode || 'NBA');

    const rawStats = player?.statistics || {};
    const stats = useMemo(() => ({
        points: Number(rawStats.points) || 0,
        reboundsTotal: Number(rawStats.reboundsTotal) || 0,
        assists: Number(rawStats.assists) || 0,
        steals: Number(rawStats.steals) || 0,
        blocks: Number(rawStats.blocks) || 0,
        turnovers: Number(rawStats.turnovers) || 0,
        foulsPersonal: Number(rawStats.foulsPersonal) || 0,
        plusMinusPoints: Number(rawStats.plusMinusPoints) || 0,
        fieldGoalsMade: Number(rawStats.fieldGoalsMade) || 0,
        fieldGoalsAttempted: Number(rawStats.fieldGoalsAttempted) || 0,
        threePointersMade: Number(rawStats.threePointersMade) || 0,
        threePointersAttempted: Number(rawStats.threePointersAttempted) || 0,
        freeThrowsMade: Number(rawStats.freeThrowsMade) || 0,
        freeThrowsAttempted: Number(rawStats.freeThrowsAttempted) || 0,
    }), [rawStats]);

    const teamBg = TEAM_BG_COLORS[teamTricode] || '#1D428A';
    const teamText = TEAM_TEXT_COLORS[teamTricode] || '#FFFFFF';

    // Calculate rating metrics from in-game performance
    const ratings = useMemo(() => {
        const fgPct = stats.fieldGoalsAttempted > 0 ? (stats.fieldGoalsMade / stats.fieldGoalsAttempted) : 0.45;
        const scoring = Math.max(1, Math.min(99, Math.round(65 + stats.points * 1.5 + (fgPct >= 0.5 ? 10 : 0))));
        const defense = Math.max(1, Math.min(99, Math.round(60 + stats.steals * 7 + stats.blocks * 8 + (stats.foulsPersonal <= 2 ? 5 : 0))));
        const playmaking = Math.max(1, Math.min(99, Math.round(60 + stats.assists * 4.5 - stats.turnovers * 3)));
        const rebounding = Math.max(1, Math.min(99, Math.round(60 + stats.reboundsTotal * 3.8)));
        const clutch = Math.max(1, Math.min(99, Math.round(70 + (stats.plusMinusPoints > 0 ? stats.plusMinusPoints * 1.5 : 0) + (stats.points >= 20 ? 12 : 0))));
        const overall = Math.round((scoring + defense + playmaking + rebounding + clutch) / 5);

        return { scoring, defense, playmaking, rebounding, clutch, overall };
    }, [stats]);

    const isHot = stats.points >= 18 || stats.threePointersMade >= 4 || ratings.overall >= 88;

    // Heat flame animation
    useEffect(() => {
        if (!isHot) return;
        const timer = setInterval(() => {
            setFlameFrame(f => (f + 1) % 3);
        }, 300);
        return () => clearInterval(timer);
    }, [isHot]);

    // Build plain ASCII text card representation for clipboard
    const asciiCardText = useMemo(() => {
        return [
            `╔════════════════════════════════════════════════╗`,
            `║ 🏀 NBA-TUI COLLECTIBLE TRADING CARD            ║`,
            `║ #${jerseyNum.padStart(2, ' ')} ${playerName.slice(0, 25).padEnd(25, ' ')} [${teamTricode}] [OVR: ${ratings.overall}] ║`,
            `╠════════════════════════════════════════════════╣`,
            `║ Position: ${position.slice(0, 6).padEnd(6, ' ')}  ${isHot ? "🔥 HE'S ON FIRE! BOOMSHAKALAKA!" : "Classic Edition"} ║`,
            `║ ── SKILL RATINGS ───────────────────────────── ║`,
            `║ 🎯 SCORING    [${renderBar(ratings.scoring)}] ${ratings.scoring}                     ║`,
            `║ 🛡️ DEFENSE    [${renderBar(ratings.defense)}] ${ratings.defense}                     ║`,
            `║ ⚡ PLAYMAKING [${renderBar(ratings.playmaking)}] ${ratings.playmaking}                     ║`,
            `║ 🏀 REBOUNDING [${renderBar(ratings.rebounding)}] ${ratings.rebounding}                     ║`,
            `║ ⏳ CLUTCH     [${renderBar(ratings.clutch)}] ${ratings.clutch}                     ║`,
            `║ ── TODAY'S STATS ───────────────────────────── ║`,
            `║ PTS: ${stats.points.toString().padStart(2, ' ')}  REB: ${stats.reboundsTotal.toString().padStart(2, ' ')}  AST: ${stats.assists.toString().padStart(2, ' ')}  STL: ${stats.steals.toString().padStart(2, ' ')}  BLK: ${stats.blocks.toString().padStart(2, ' ')}  +/-: ${(stats.plusMinusPoints >= 0 ? '+' : '') + stats.plusMinusPoints} ║`,
            `║ FG: ${stats.fieldGoalsMade}/${stats.fieldGoalsAttempted}  3PT: ${stats.threePointersMade}/${stats.threePointersAttempted}  FT: ${stats.freeThrowsMade}/${stats.freeThrowsAttempted}  PF: ${stats.foulsPersonal}          ║`,
            `╚════════════════════════════════════════════════╝`
        ].join('\n');
    }, [jerseyNum, playerName, teamTricode, position, stats, ratings, isHot]);

    const toastTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        return () => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        };
    }, []);

    useInput((input, key) => {
        if (key.escape || input === 'v' || input === 'q') {
            onClose();
            return;
        }
        if (input === 'y') {
            copyToClipboardOSC52(asciiCardText);
            setCopiedToast(true);
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
            toastTimerRef.current = setTimeout(() => setCopiedToast(false), 2000);
        }
    });

    const flameColors = ['yellow', 'redBright', 'cyan'];
    const badgeName = playerName.toUpperCase().slice(0, 24);

    return (
        <Box flexDirection="column" borderStyle="double" borderColor={isHot ? 'yellow' : 'cyan'} paddingX={2} paddingY={0} width={54}>
            {/* Top Badge */}
            <Box justifyContent="space-between">
                <Text backgroundColor={teamBg} color={teamText} bold>
                    {' '}{teamTricode} #{jerseyNum} {badgeName}{' '}
                </Text>
                <Text bold backgroundColor="yellow" color="black">
                    {' '}OVR: {ratings.overall}{' '}
                </Text>
            </Box>

            {/* Fire Banner */}
            {isHot && (
                <Box justifyContent="center" marginTop={1}>
                    <Text bold color={flameColors[flameFrame]}>
                        🔥 HE'S ON FIRE! BOOMSHAKALAKA! 🔥
                    </Text>
                </Box>
            )}

            {/* Attributes Section */}
            <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
                <Text bold underline color="cyan">Attribute Radar</Text>
                <Box justifyContent="space-between">
                    <Text>Scoring:    </Text>
                    <Text color="yellow">[{renderBar(ratings.scoring)}] {ratings.scoring}</Text>
                </Box>
                <Box justifyContent="space-between">
                    <Text>Defense:    </Text>
                    <Text color="green">[{renderBar(ratings.defense)}] {ratings.defense}</Text>
                </Box>
                <Box justifyContent="space-between">
                    <Text>Playmaking: </Text>
                    <Text color="cyan">[{renderBar(ratings.playmaking)}] {ratings.playmaking}</Text>
                </Box>
                <Box justifyContent="space-between">
                    <Text>Rebounding: </Text>
                    <Text color="blue">[{renderBar(ratings.rebounding)}] {ratings.rebounding}</Text>
                </Box>
                <Box justifyContent="space-between">
                    <Text>Clutch:     </Text>
                    <Text color="red">[{renderBar(ratings.clutch)}] {ratings.clutch}</Text>
                </Box>
            </Box>

            {/* Live Performance */}
            <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="gray" paddingX={1}>
                <Text bold underline>Game Performance</Text>
                <Box justifyContent="space-between">
                    <Text bold color="yellow">{stats.points} PTS</Text>
                    <Text bold>{stats.reboundsTotal} REB</Text>
                    <Text bold>{stats.assists} AST</Text>
                    <Text bold color={stats.plusMinusPoints >= 0 ? 'green' : 'red'}>
                        {stats.plusMinusPoints >= 0 ? '+' : ''}{stats.plusMinusPoints} +/-
                    </Text>
                </Box>
                <Box justifyContent="space-between" marginTop={0}>
                    <Text dimColor>FG: {stats.fieldGoalsMade}/{stats.fieldGoalsAttempted}</Text>
                    <Text dimColor>3PT: {stats.threePointersMade}/{stats.threePointersAttempted}</Text>
                    <Text dimColor>PF: {stats.foulsPersonal}</Text>
                </Box>
            </Box>

            {/* Footer / Clipboard */}
            <Box justifyContent="space-between" marginTop={1}>
                {copiedToast ? (
                    <Text color="green" bold>✅ Copied to clipboard via OSC 52!</Text>
                ) : (
                    <Text dimColor><Text bold color="cyan">[y]</Text> Copy Card to Clipboard • <Text bold color="cyan">[Esc]</Text> Close</Text>
                )}
            </Box>
        </Box>
    );
}
