/**
 * NovaControl - UI component for connecting and controlling Lumenate Nova device
 */

import { useState, useEffect } from 'react';
import { novaController } from '../../audio/NovaController';
import type { NovaState } from '../../audio/NovaController';

export function NovaControl() {
  const [state, setState] = useState<NovaState>(novaController.getState());
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Subscribe to state changes
    novaController.setOnStateChange((newState) => {
      setState(newState);
      setError(null);
    });

    // Get initial state
    setState(novaController.getState());
  }, []);

  const handleConnect = async () => {
    if (!novaController.isAvailable()) {
      setError('Web Bluetooth is not available in this browser. Try Chrome, Edge, or Opera.');
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      await novaController.connect();
    } catch (err: any) {
      setError(err.message || 'Failed to connect to Nova device');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await novaController.disconnect();
    } catch (err: any) {
      setError(err.message || 'Failed to disconnect');
    }
  };

  if (!novaController.isAvailable()) {
    return (
      <div className="text-xs text-[var(--color-text-muted)]">
        Nova: Not available (requires Web Bluetooth)
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {!state.isConnected ? (
        <button
          onClick={handleConnect}
          disabled={isConnecting}
          className="px-3 py-1.5 rounded-lg bg-[var(--color-surface-light)] hover:bg-[var(--color-primary)] text-[var(--color-text)] text-xs font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          title="Connect to Lumenate Nova device"
        >
          {isConnecting ? (
            <>
              <span className="w-3 h-3 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
              Connecting...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
              Connect Nova
            </>
          )}
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button
            onClick={handleDisconnect}
            className="px-3 py-1.5 rounded-lg bg-[var(--color-surface-light)] hover:bg-[var(--color-error)] text-[var(--color-text)] text-xs font-medium transition-colors"
            title="Disconnect Nova device"
          >
            Disconnect
          </button>
          <div className="flex items-center gap-1.5 text-xs">
            <span className={`w-2 h-2 rounded-full ${state.isFlickering ? 'bg-[var(--color-success)] animate-pulse' : 'bg-[var(--color-text-muted)]'}`} />
            <span className="text-[var(--color-text-muted)]">
              {state.isFlickering 
                ? `Nova: ${state.currentFrequency} Hz`
                : 'Nova: Ready'
              }
            </span>
          </div>
        </div>
      )}
      
      {error && (
        <div className="text-xs text-[var(--color-error)] max-w-xs truncate" title={error}>
          {error}
        </div>
      )}
    </div>
  );
}
