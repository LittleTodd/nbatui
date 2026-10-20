import { useState, useEffect } from 'react';
import type { Game } from '../services/apiClient.js';
import { fetchGameHeat, findGameOdds, type SocialHeat, type GameOdds } from '../services/apiClient.js';

export interface HeatData {
    level: 'hot' | 'warm' | 'cold' | 'fire';
    count: number;
    url?: string;
}

/**
 * Hook to get social heat data for games
 * Polling real API endpoints
 */
export const useSocialHeat = (games: Game[], odds: Record<string, GameOdds> = {}) => {
    const [heatMap, setHeatMap] = useState<Record<string, HeatData>>({});

    useEffect(() => {
        if (!games.length) return;

        const loadHeat = async () => {
            // Only fetch for relevant games (Live or Final recently)
            // For now, fetch for all valid games to show stats
            const relevantGames = games.filter(g => g.gameStatus >= 1);

            const promises = relevantGames.map(async (game) => {
                // Use tricode for search (e.g. LAL, BOS)
                // Or team names? Reddit search is better with team names usually
                // but let's try tricode first as it is stable. 
                // Wait, finding "LAL" on reddit might be ambitious. 
                // Better use full team name or city + name. 
                // game.homeTeam.teamName is "Lakers"
                // game.homeTeam.teamCity is "Los Angeles"
                const team1 = game.awayTeam.teamName;
                const team2 = game.homeTeam.teamName;

                // Calculate Score-based Heat (Entertainment Value)
                let scoreHeatVal = 0; // 0=Cold, 1=Warm, 2=Hot, 3=Fire
                let scoreConf: HeatData = { level: 'cold', count: 0 };

                const isLiveOrFinal = game.gameStatus === 2 || game.gameStatus === 3;
                if (isLiveOrFinal) {
                    const diff = Math.abs(game.awayTeam.score - game.homeTeam.score);
                    const simulatedCount = Math.max(0, 1000 - (diff * 20));

                    if (diff <= 3) {
                        scoreHeatVal = 3;
                        scoreConf = { level: 'fire', count: simulatedCount + 500 };
                    } else if (diff <= 8) {
                        scoreHeatVal = 2;
                        scoreConf = { level: 'hot', count: simulatedCount + 200 };
                    } else if (diff <= 15) {
                        scoreHeatVal = 1;
                        scoreConf = { level: 'warm', count: simulatedCount };
                    } else {
                        scoreHeatVal = 0;
                        scoreConf = { level: 'cold', count: 0 };
                    }
                }

                // Use Polymarket volume as a strong signal.
                const dateStr = game.localDate || game.gameDateET || game.gameTimeUTC?.slice(0, 10);
                const gameOdds = findGameOdds(
                    odds,
                    game.awayTeam.teamTricode,
                    game.homeTeam.teamTricode,
                    dateStr
                );
                const gameVolume = gameOdds?.volume || 0;

                let volHeatVal = 0;
                let volConf: HeatData = { level: 'cold', count: 0 };

                if (gameVolume > 500000) {
                    volHeatVal = 3;
                    volConf = { level: 'fire', count: Math.round(gameVolume / 100) };
                } else if (gameVolume > 100000) {
                    volHeatVal = 2;
                    volConf = { level: 'hot', count: Math.round(gameVolume / 100) };
                } else if (gameVolume > 25000) {
                    volHeatVal = 1;
                    volConf = { level: 'warm', count: Math.round(gameVolume / 100) };
                }

                // Get Real API Data
                // Note: We swallow errors inside fetchGameHeat
                const data = await fetchGameHeat(team1, team2);

                if (data && data.count > 0) {
                    return {
                        gameId: game.gameId,
                        data: {
                            level: data.level,
                            count: data.count,
                            url: data.url
                        }
                    };
                }

                // Fallback: Max(ScoreHeat, VolumeHeat)
                // If the game is a blowout but has HUGE betting volume, it's hot.
                // If the game has low betting but is a nail-biter, it's hot.
                if (volHeatVal >= scoreHeatVal && volHeatVal > 0) {
                    return { gameId: game.gameId, data: { level: volConf.level, count: volConf.count, url: 'polymarket' } };
                } else if (scoreHeatVal > 0) {
                    return { gameId: game.gameId, data: { level: scoreConf.level, count: scoreConf.count, url: 'score' } };
                }

                return null;
            });

            const results = await Promise.all(promises);

            setHeatMap(prev => {
                const next = { ...prev };
                results.forEach(res => {
                    if (res) next[res.gameId] = res.data;
                });
                return next;
            });
        };

        loadHeat();
        // Poll every 60s to avoid rate limits
        const interval = setInterval(loadHeat, 60000);
        return () => clearInterval(interval);

    }, [games, odds]); // Add odds to dependency array

    return heatMap;
};
