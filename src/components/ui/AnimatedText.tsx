import React, { useState, useEffect } from 'react';
import { Text } from 'ink';

export type AnimationType = 'glitch' | 'neon' | 'pulse' | 'none';

// ═══════════════════════════════════════════════════════════════
// Custom Glitch Effect
// ═══════════════════════════════════════════════════════════════

/**
 * Custom Glitch Effect - randomly replaces characters while keeping original color
 */
export function GlitchText({
    text,
    color,
    isActive,
    speed = 150 // Default to Medium speed
}: {
    text: string;
    color?: string;
    isActive: boolean;
    speed?: number;
}) {
    const [displayText, setDisplayText] = useState(text);
    const glitchChars = '!@#$%^&*()_+-=[]{}|;:,.<>?~`░▒▓█▄▀■□●○◆◇';

    useEffect(() => {
        if (!isActive) {
            setDisplayText(text);
            return;
        }

        const timer = setInterval(() => {
            // Randomly glitch 1-3 characters
            const chars = text.split('');
            const numGlitches = Math.floor(Math.random() * 3) + 1;

            for (let i = 0; i < numGlitches; i++) {
                const pos = Math.floor(Math.random() * chars.length);
                if (Math.random() > 0.3) {
                    // Replace with glitch character
                    const glitchIndex = Math.floor(Math.random() * glitchChars.length);
                    chars[pos] = glitchChars.charAt(glitchIndex);
                } else if (Math.random() > 0.5) {
                    // Delete character (show space)
                    chars[pos] = ' ';
                }
                // Otherwise keep original
            }

            // Occasionally show original text for readability (70% chance)
            if (Math.random() > 0.7) {
                setDisplayText(text);
            } else {
                setDisplayText(chars.join(''));
            }
        }, speed);

        return () => clearInterval(timer);
    }, [isActive, text, speed]);

    return (
        <Text color={color} bold>
            {displayText}
        </Text>
    );
}

// ═══════════════════════════════════════════════════════════════
// Custom Neon Effect
// ═══════════════════════════════════════════════════════════════

/**
 * Custom Neon Effect - flashes between bright and dim with glow simulation
 */
export function NeonText({
    text,
    isActive,
    speed = 150
}: {
    text: string;
    isActive: boolean;
    speed?: number;
}) {
    const [phase, setPhase] = useState(0);
    // Neon color cycle: bright green -> cyan -> bright green -> dim
    const colors: string[] = ['greenBright', 'cyanBright', 'greenBright', 'green', 'greenBright'];

    useEffect(() => {
        if (!isActive) {
            setPhase(0);
            return;
        }

        const timer = setInterval(() => {
            setPhase(p => (p + 1) % colors.length);
        }, speed);

        return () => clearInterval(timer);
    }, [isActive, speed]);

    const currentColor = colors[phase] || 'green';
    const isBright = currentColor.includes('Bright');

    return (
        <Text color={currentColor} bold={isBright} dimColor={!isBright && phase === 3}>
            {text}
        </Text>
    );
}

// ═══════════════════════════════════════════════════════════════
// Main Animated Text Component
// ═══════════════════════════════════════════════════════════════

/**
 * Animated Text - dispatches to appropriate effect based on type
 */
export function AnimatedText({
    text,
    animationType,
    isActive,
    fallbackColor = 'white',
    speed = 150
}: {
    text: string;
    animationType: AnimationType;
    isActive: boolean;
    fallbackColor?: string;
    speed?: number;
}) {
    if (!isActive || animationType === 'none') {
        return <Text color={fallbackColor} bold>{text}</Text>;
    }

    if (animationType === 'neon') {
        return <NeonText text={text} isActive={isActive} speed={speed} />;
    }

    // Default to glitch for type 'glitch'
    return <GlitchText text={text} color={fallbackColor} isActive={isActive} speed={speed} />;
}

export default AnimatedText;
