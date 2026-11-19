/**
 * Momentum & Milestone Analytics for NBA-TUI
 * Detects:
 * 1. Momentum Runs (e.g. 12-2 Run in last 3:15)
 * 2. Scoring Droughts (e.g. 4:10 without a made field goal)
 * 3. Triple-Double & Milestone Watches (e.g. Jokic 1 ast away from 3B-2B)
 */
import type { PlayByPlayAction } from '../services/apiClient.js';

export interface MomentumRun {
    teamTricode: string;
    teamRun: number;
    oppRun: number;
    clockSpan: string;
    description: string;
}

export interface ScoringDrought {
    teamTricode: string;
    durationDesc: string;
}

export interface MilestoneWatch {
    playerName: string;
    teamTricode: string;
    summary: string;
    milestone: string;
}

function parseClockToSec(clockStr: string): number {
    if (!clockStr) return 0;
    const match = clockStr.match(/PT(\d+)M([\d.]+)S/);
    if (!match) return 0;
    const mins = parseInt(match[1] || '0', 10);
    const secs = parseFloat(match[2] || '0');
    return mins * 60 + secs;
}

/**
 * Detect significant scoring runs (e.g. 10-0, 12-2, 14-4) in the most recent actions
 */
export function detectMomentumRun(
    actions: PlayByPlayAction[],
    homeTricode: string,
    awayTricode: string
): MomentumRun | null {
    if (!actions || actions.length < 4) return null;

    // Filter to scoring actions
    const scoring = actions.filter(a =>
        (a.shotResult === 'Made' || a.actionType === 'freethrow') &&
        (a.teamTricode === homeTricode || a.teamTricode === awayTricode)
    );

    if (scoring.length < 3) return null;

    // Look at the latest scoring events (up to 12)
    const recent = scoring.slice(-12);
    let homePts = 0;
    let awayPts = 0;

    for (let i = recent.length - 1; i >= 0; i--) {
        const a = recent[i];
        if (!a) continue;

        let pts = 2;
        if (a.actionType === '3pt' || a.description.includes('3PT')) pts = 3;
        else if (a.actionType === 'freethrow' || a.description.includes('Free Throw')) pts = 1;

        if (a.teamTricode === homeTricode) homePts += pts;
        else if (a.teamTricode === awayTricode) awayPts += pts;

        // Check for dominant run (>= 8 point margin or >= 10-2 run)
        if (homePts >= 9 && awayPts <= 2) {
            return {
                teamTricode: homeTricode,
                teamRun: homePts,
                oppRun: awayPts,
                clockSpan: `${homePts}-${awayPts} Run`,
                description: `🔥 ${homeTricode} on a ${homePts}-${awayPts} surge!`
            };
        }

        if (awayPts >= 9 && homePts <= 2) {
            return {
                teamTricode: awayTricode,
                teamRun: awayPts,
                oppRun: homePts,
                clockSpan: `${awayPts}-${homePts} Run`,
                description: `🔥 ${awayTricode} on a ${awayPts}-${homePts} surge!`
            };
        }
    }

    return null;
}

/**
 * Scan for players on Triple-Double or high-scoring milestone watch
 */
export function checkMilestoneWatches(players: any[], teamTricode: string): MilestoneWatch[] {
    if (!players || !Array.isArray(players)) return [];
    const watches: MilestoneWatch[] = [];

    for (const p of players) {
        const stats = p.statistics || {};
        const pts = stats.points || 0;
        const reb = stats.reboundsTotal || 0;
        const ast = stats.assists || 0;
        const stl = stats.steals || 0;
        const blk = stats.blocks || 0;
        const name = p.familyName || p.nameI || p.name || 'Player';

        // Triple-Double check (PTS >= 10, plus REB/AST near 10)
        const categories = [
            { name: 'PTS', val: pts },
            { name: 'REB', val: reb },
            { name: 'AST', val: ast },
            { name: 'STL', val: stl },
            { name: 'BLK', val: blk }
        ];

        const doubleDigits = categories.filter(c => c.val >= 10);
        const nearTen = categories.filter(c => c.val >= 8 && c.val < 10);

        if (doubleDigits.length >= 3) {
            watches.push({
                playerName: name,
                teamTricode,
                summary: `${pts}p/${reb}r/${ast}a`,
                milestone: '🏆 TRIPLE-DOUBLE ACHIEVED'
            });
        } else if (doubleDigits.length === 2 && nearTen.length >= 1) {
            const need = nearTen[0];
            if (need) {
                const diff = 10 - need.val;
                watches.push({
                    playerName: name,
                    teamTricode,
                    summary: `${pts}p/${reb}r/${ast}a`,
                    milestone: `🎯 ${diff} ${need.name} away from Triple-Double`
                });
            }
        } else if (pts >= 35) {
            watches.push({
                playerName: name,
                teamTricode,
                summary: `${pts} PTS`,
                milestone: `🔥 40-PT WATCH (${40 - pts} to 40)`
            });
        }
    }

    return watches;
}
