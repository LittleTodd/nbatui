/**
 * MapBackground Component
 * Renders the ASCII US map as a dim background layer
 */
import { getCleanMap } from '../data/usMap';

interface MapBackgroundProps {
    width?: number;
    height?: number;
}

export function MapBackground({ width, height }: MapBackgroundProps) {
    const mapLines = getCleanMap();

    return (
        <box
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            width={width}
            height={height}
        >
            {mapLines.map((line, index) => (
                <text key={index} dimColor>
                    {line}
                </text>
            ))}
        </box>
    );
}
