/**
 * BrailleCourt Component
 * High-Resolution Half-Court Shot Chart & Heatmap in the Terminal
 * 
 * Uses Unicode Braille patterns (U+2800 - U+28FF) for 2x4 sub-pixel precision.
 */
import React, { useState, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { BrailleCanvas } from '../utils/brailleCanvas.js';
import type { PlayByPlayAction } from '../services/apiClient.js';
import { TEAM_BG_COLORS, TEAM_TEXT_COLORS } from '../data/teamColors.js';

interface BrailleCourtProps {
    actions: PlayByPlayAction[];
    homeTricode: string;
    awayTricode: string;
    homeName?: string;
    awayName?: string;
    onClose?: () => void;
}

interface ShotPoint {
    px: number;
    py: number;
    isMake: boolean;
    team: string;
    player: string;
    distance: number;
    is3pt: boolean;
    zone: 'paint' | 'mid' | '3pt_corner' | '3pt_above';
}

// Convert NBA coordinates (-250..250, -50..420) or (0..100, 0..100) to Canvas (76 x 72)
function normalizeShotCoords(action: PlayByPlayAction, canvasWidth: number, canvasHeight: number): { px: number; py: number } | null {
    let x = action.x;
    let y = action.y;

    // If coordinates are explicitly given
    if (typeof x === 'number' && typeof y === 'number') {
        // Standard NBA Stats coordinates: x in [-250, 250], y in [-50, 420]
        if (Math.abs(x) > 50 || y > 100) {
            // Map -250..250 to 4..canvasWidth - 4
            const px = ((x + 250) / 500) * (canvasWidth - 8) + 4;
            // Hoop is near top (y=10 in canvas). In NBA stats, baseline is near -50
            const py = ((y + 50) / 470) * (canvasHeight - 12) + 6;
            return {
                px: Math.max(2, Math.min(canvasWidth - 3, px)),
                py: Math.max(2, Math.min(canvasHeight - 3, py))
            };
        }

        // Percentage or 0-100 coordinates:
        const px = (x / 100) * (canvasWidth - 8) + 4;
        const py = (y / 100) * (canvasHeight - 12) + 6;
        return {
            px: Math.max(2, Math.min(canvasWidth - 3, px)),
            py: Math.max(2, Math.min(canvasHeight - 3, py))
        };
    }

    // Fallback: estimate from description if x/y missing
    const desc = action.description || '';
    const distMatch = desc.match(/(\d+)'/);
    const dist = distMatch && distMatch[1] ? parseInt(distMatch[1], 10) : (action.shotDistance || 15);
    const is3 = action.actionType === '3pt' || desc.includes('3PT');

    // Pseudo-random angle based on actionNumber to distribute shots across the court
    const pseudoAngle = ((action.actionNumber * 37) % 140) + 20; // 20 to 160 degrees
    const rad = (pseudoAngle * Math.PI) / 180;
    const hoopX = canvasWidth / 2;
    const hoopY = 10;
    const scale = (canvasHeight - 16) / 30; // 30 feet visible
    const px = hoopX + Math.cos(rad) * (dist * scale * 0.9);
    const py = hoopY + Math.sin(rad) * (dist * scale);

    return {
        px: Math.max(4, Math.min(canvasWidth - 5, px)),
        py: Math.max(6, Math.min(canvasHeight - 4, py))
    };
}

export function BrailleCourt({
    actions,
    homeTricode,
    awayTricode,
    homeName,
    awayName,
    onClose
}: BrailleCourtProps) {
    const [teamFilter, setTeamFilter] = useState<'ALL' | 'AWAY' | 'HOME'>('ALL');
    const [showHeatmap, setShowHeatmap] = useState(false);
    const [shotFilter, setShotFilter] = useState<'all' | 'made' | 'missed'>('all');

    // Canvas dimensions in cells (each cell is 2x4 pixels)
    const CELL_W = 38;
    const CELL_H = 16;
    const PIXEL_W = CELL_W * 2; // 76
    const PIXEL_H = CELL_H * 4; // 64

    // Extract all field goal attempts
    const shotData = useMemo(() => {
        const fgActions = actions.filter(a =>
            a.shotResult === 'Made' ||
            a.shotResult === 'Missed' ||
            a.actionType === '2pt' ||
            a.actionType === '3pt' ||
            a.description.includes('Shot') ||
            a.description.includes('Layup') ||
            a.description.includes('Dunk') ||
            a.description.includes('3PT')
        );

        const list: ShotPoint[] = [];

        for (const action of fgActions) {
            const coords = normalizeShotCoords(action, PIXEL_W, PIXEL_H);
            if (!coords) continue;

            const isMake = action.shotResult === 'Made' || (!action.shotResult && !action.description.includes('MISS'));
            const is3pt = action.actionType === '3pt' || action.description.includes('3PT');
            const dist = action.shotDistance || 15;

            // Classify zone
            let zone: ShotPoint['zone'] = 'mid';
            if (coords.py <= 28 && coords.px >= 24 && coords.px <= 52) {
                zone = 'paint';
            } else if (is3pt) {
                if (coords.py <= 22) zone = '3pt_corner';
                else zone = '3pt_above';
            } else {
                zone = 'mid';
            }

            list.push({
                px: coords.px,
                py: coords.py,
                isMake,
                team: action.teamTricode || '',
                player: action.playerName || action.playerNameI || 'Player',
                distance: dist,
                is3pt,
                zone
            });
        }

        return list;
    }, [actions, PIXEL_W, PIXEL_H]);

    // Filtered shots
    const filteredShots = useMemo(() => {
        return shotData.filter(s => {
            if (teamFilter === 'HOME' && s.team !== homeTricode) return false;
            if (teamFilter === 'AWAY' && s.team !== awayTricode) return false;
            if (shotFilter === 'made' && !s.isMake) return false;
            if (shotFilter === 'missed' && s.isMake) return false;
            return true;
        });
    }, [shotData, teamFilter, homeTricode, awayTricode, shotFilter]);

    // Statistics calculations
    const stats = useMemo(() => {
        const total = filteredShots.length;
        const makes = filteredShots.filter(s => s.isMake).length;
        const pct = total > 0 ? ((makes / total) * 100).toFixed(1) : '0.0';

        const threes = filteredShots.filter(s => s.is3pt);
        const threeMakes = threes.filter(s => s.isMake).length;
        const threePct = threes.length > 0 ? ((threeMakes / threes.length) * 100).toFixed(1) : '0.0';

        const paint = filteredShots.filter(s => s.zone === 'paint');
        const paintMakes = paint.filter(s => s.isMake).length;
        const paintPct = paint.length > 0 ? ((paintMakes / paint.length) * 100).toFixed(1) : '0.0';

        const mid = filteredShots.filter(s => s.zone === 'mid');
        const midMakes = mid.filter(s => s.isMake).length;
        const midPct = mid.length > 0 ? ((midMakes / mid.length) * 100).toFixed(1) : '0.0';

        return {
            total, makes, pct,
            threes: threes.length, threeMakes, threePct,
            paint: paint.length, paintMakes, paintPct,
            mid: mid.length, midMakes, midPct
        };
    }, [filteredShots]);

    // Render Court to Braille Canvas
    const courtLines = useMemo(() => {
        const canvas = new BrailleCanvas(CELL_W, CELL_H);

        // 1. Outer Court Border (Sidelines, Baseline at top, Half-court line at bottom)
        canvas.drawRect(2, 2, PIXEL_W - 4, PIXEL_H - 4);

        // 2. Backboard (Horizontal line behind rim: y=6, x=33..43)
        canvas.drawLine(32, 6, 44, 6);

        // 3. Rim / Basket (Circle around (38, 9), radius 3)
        canvas.drawCircle(38, 9, 3);

        // 4. Restricted Area Arc (Radius 6 from rim)
        canvas.drawArc(38, 9, 6, 0, 180, 4);

        // 5. Paint / Key Rectangle (x=24..52, y=2..28)
        canvas.drawRect(24, 2, 28, 26);

        // 6. Free Throw Circle (Radius 10 from (38, 28))
        canvas.drawCircle(38, 28, 9);

        // 7. 3-Point Line
        // Corner 3 straight lines (x=7 and x=69, y=2..20)
        canvas.drawLine(8, 2, 8, 20);
        canvas.drawLine(PIXEL_W - 9, 2, PIXEL_W - 9, 20);
        // Arc connecting corner lines (center at rim (38, 9), radius ~30)
        canvas.drawArc(38, 9, 30, 22, 158, 2);

        // 8. Half-Court Center Circle at bottom center
        canvas.drawArc(38, PIXEL_H - 2, 10, 180, 360, 4);

        // 9. Overlay Shot Dots onto Braille Canvas
        for (const s of filteredShots) {
            // Plot 2x2 dot cluster for shot visibility
            canvas.setPixel(s.px, s.py, true);
            if (s.isMake) {
                // Made shots get a double pixel mark for weight
                canvas.setPixel(s.px + 1, s.py, true);
                canvas.setPixel(s.px, s.py + 1, true);
            }
        }

        return canvas.renderLines();
    }, [filteredShots, CELL_W, CELL_H, PIXEL_W, PIXEL_H]);

    useInput((input, key) => {
        if (key.escape || input === 'c' || input === 'q') {
            onClose?.();
            return;
        }
        if (input === 'h') {
            setShowHeatmap(prev => !prev);
        }
        if (input === 't') {
            setTeamFilter(prev => prev === 'ALL' ? 'AWAY' : prev === 'AWAY' ? 'HOME' : 'ALL');
        }
        if (input === 'm') {
            setShotFilter(prev => prev === 'all' ? 'made' : prev === 'made' ? 'missed' : 'all');
        }
    });

    const activeTeamLabel = teamFilter === 'ALL'
        ? 'Both Teams'
        : teamFilter === 'HOME'
            ? `${homeTricode} (${homeName || 'Home'})`
            : `${awayTricode} (${awayName || 'Away'})`;

    return (
        <Box flexDirection="column" borderStyle="round" borderColor="cyan" paddingX={1} paddingY={0}>
            {/* Header */}
            <Box justifyContent="space-between" width={CELL_W + 30} marginBottom={1}>
                <Box>
                    <Text bold color="cyan">🏀 BrailleCourt™ Shot Chart </Text>
                    <Text color="yellow">[{activeTeamLabel}]</Text>
                </Box>
                <Text dimColor>[Esc/c to close]</Text>
            </Box>

            {/* Main Court & Stats Side-by-Side */}
            <Box flexDirection="row">
                {/* Court Graphics */}
                <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
                    {courtLines.map((line, idx) => (
                        <Text key={idx} color={showHeatmap ? (idx < 7 ? 'yellow' : idx < 12 ? 'cyan' : 'green') : 'green'}>
                            {line}
                        </Text>
                    ))}
                    <Box justifyContent="space-between" marginTop={0}>
                        <Text dimColor>Left Corner</Text>
                        <Text dimColor>▲ Basket / Baseline</Text>
                        <Text dimColor>Right Corner</Text>
                    </Box>
                </Box>

                {/* Right Panel: Shot Breakdown & Zone Stats */}
                <Box flexDirection="column" marginLeft={2} width={28}>
                    <Text bold underline color="white">Shooting Breakdown</Text>
                    
                    <Box flexDirection="column" marginTop={1}>
                        <Box justifyContent="space-between">
                            <Text>Field Goals:</Text>
                            <Text bold color="yellow">{stats.makes}/{stats.total} ({stats.pct}%)</Text>
                        </Box>
                        <Box justifyContent="space-between">
                            <Text>3-Pointers:</Text>
                            <Text bold color="green">{stats.threeMakes}/{stats.threes} ({stats.threePct}%)</Text>
                        </Box>
                    </Box>

                    <Box marginTop={1} borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false} borderColor="gray" />

                    <Text bold color="cyan">Zone Efficiency</Text>
                    <Box flexDirection="column" marginTop={0}>
                        <Box justifyContent="space-between">
                            <Text dimColor>Paint / Rim:</Text>
                            <Text bold color={parseFloat(stats.paintPct) >= 55 ? 'green' : 'white'}>
                                {stats.paintMakes}/{stats.paint} ({stats.paintPct}%)
                            </Text>
                        </Box>
                        <Box justifyContent="space-between">
                            <Text dimColor>Mid-Range:</Text>
                            <Text bold color={parseFloat(stats.midPct) >= 45 ? 'green' : 'white'}>
                                {stats.midMakes}/{stats.mid} ({stats.midPct}%)
                            </Text>
                        </Box>
                        <Box justifyContent="space-between">
                            <Text dimColor>3PT Arc:</Text>
                            <Text bold color={parseFloat(stats.threePct) >= 38 ? 'green' : 'white'}>
                                {stats.threeMakes}/{stats.threes} ({stats.threePct}%)
                            </Text>
                        </Box>
                    </Box>

                    {/* Controls Guide */}
                    <Box flexDirection="column" marginTop={2} borderStyle="single" borderColor="gray" paddingX={1}>
                        <Text bold dimColor>Hotkeys</Text>
                        <Text><Text color="cyan" bold>[t]</Text> Team: <Text color="yellow">{teamFilter}</Text></Text>
                        <Text><Text color="cyan" bold>[m]</Text> Filter: <Text color="yellow">{shotFilter}</Text></Text>
                        <Text><Text color="cyan" bold>[h]</Text> Heatmap: <Text color={showHeatmap ? 'green' : 'gray'}>{showHeatmap ? 'ON' : 'OFF'}</Text></Text>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
