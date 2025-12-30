/**
 * StatusBar Component
 * Shows connection status, refresh info, and help text
 */
import { useStore } from '../store';

export function StatusBar() {
    const { dataServiceConnected, isLoading, error, games } = useStore();

    return (
        <box justifyContent="space-between" paddingX={1}>
            {/* Left: Connection status */}
            <box>
                <text color={dataServiceConnected ? 'green' : 'red'}>
                    {dataServiceConnected ? '● Connected' : '● Disconnected'}
                </text>
                {isLoading && <text color="yellow"> ⟳ Loading...</text>}
                {error && <text color="red"> ✗ {error}</text>}
            </box>

            {/* Center: Game count */}
            <box>
                <text dimColor>
                    {games.length} game{games.length !== 1 ? 's' : ''} today
                </text>
            </box>

            {/* Right: Help text */}
            <box>
                <text dimColor>
                    ←→: navigate | r: refresh | q: quit
                </text>
            </box>
        </box>
    );
}
