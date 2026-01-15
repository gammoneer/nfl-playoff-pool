import React, { useState, useEffect } from 'react';
import './ESPNControls.css';

/**
 * ESPN API Controls Component (Pool Manager Only)
 * 
 * Features:
 * - Manual "Fetch Scores Now" button
 * - Auto-refresh toggle (every 5 minutes)
 * - Global pause/resume API
 * - Per-game override controls (lock/unlock)
 * - Status indicators (API vs Manual)
 */

function ESPNControls({ 
  currentWeek,
  games,
  actualScores,
  teamCodes,
  onScoresFetched,
  onGameLockToggle,
  gameLocks,
  espnAutoRefresh
}) {
  const [isFetching, setIsFetching] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState(null);
  const [fetchStatus, setFetchStatus] = useState(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const [apiPaused, setApiPaused] = useState(false);

  // Handle manual fetch
  const handleFetchNow = async () => {
    if (isFetching || apiPaused) return;

    setIsFetching(true);
    setFetchStatus({ type: 'loading', message: 'Fetching scores from ESPN...' });

    try {
      // This will be called from parent component
      await onScoresFetched();
      
      setLastFetchTime(new Date());
      setFetchStatus({ type: 'success', message: 'Scores updated successfully!' });
      
      // Clear success message after 3 seconds
      setTimeout(() => setFetchStatus(null), 3000);
    } catch (error) {
      setFetchStatus({ type: 'error', message: `Error: ${error.message}` });
    } finally {
      setIsFetching(false);
    }
  };

  // Toggle auto-refresh
  const handleAutoRefreshToggle = () => {
    if (autoRefreshEnabled) {
      espnAutoRefresh.stop();
      setAutoRefreshEnabled(false);
      setFetchStatus({ type: 'info', message: 'Auto-refresh stopped' });
    } else {
      espnAutoRefresh.start();
      setAutoRefreshEnabled(true);
      setFetchStatus({ type: 'info', message: 'Auto-refresh started (every 5 minutes)' });
    }
    
    setTimeout(() => setFetchStatus(null), 3000);
  };

  // Pause/Resume API globally
  const handleGlobalPauseToggle = () => {
    if (apiPaused) {
      setApiPaused(false);
      setFetchStatus({ type: 'info', message: 'API resumed - fetching enabled' });
    } else {
      setApiPaused(true);
      if (autoRefreshEnabled) {
        espnAutoRefresh.stop();
        setAutoRefreshEnabled(false);
      }
      setFetchStatus({ type: 'warning', message: 'API paused - all fetching disabled' });
    }
    
    setTimeout(() => setFetchStatus(null), 3000);
  };

  // Check if game has manual override (locked from API updates)
  const isGameLocked = (gameId) => {
    return gameLocks?.[currentWeek]?.[gameId] === true;
  };

  // Check if game score came from ESPN API
  const isFromAPI = (gameId) => {
    return actualScores?.[currentWeek]?.[gameId]?.source === 'espn';
  };

  return (
    <div className="espn-controls">
      <div className="espn-header">
        <h3>📡 ESPN API Controls</h3>
        <div className="espn-status-badges">
          {apiPaused && (
            <span className="status-badge paused">⏸️ API PAUSED</span>
          )}
          {autoRefreshEnabled && !apiPaused && (
            <span className="status-badge active">🔄 AUTO-REFRESH ON</span>
          )}
          {lastFetchTime && (
            <span className="status-badge info">
              Last fetch: {lastFetchTime.toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Global Controls */}
      <div className="espn-global-controls">
        <button
          className="espn-btn fetch-now"
          onClick={handleFetchNow}
          disabled={isFetching || apiPaused}
        >
          {isFetching ? '⏳ Fetching...' : '🔄 Fetch Scores Now'}
        </button>

        <button
          className={`espn-btn auto-refresh ${autoRefreshEnabled ? 'active' : ''}`}
          onClick={handleAutoRefreshToggle}
          disabled={apiPaused}
        >
          {autoRefreshEnabled ? '⏹️ Stop Auto-Refresh' : '▶️ Start Auto-Refresh (5 min)'}
        </button>

        <button
          className={`espn-btn pause-api ${apiPaused ? 'paused' : ''}`}
          onClick={handleGlobalPauseToggle}
        >
          {apiPaused ? '▶️ Resume API' : '⏸️ Pause API'}
        </button>
      </div>

      {/* Fetch Status Message */}
      {fetchStatus && (
        <div className={`fetch-status ${fetchStatus.type}`}>
          {fetchStatus.message}
        </div>
      )}

      {/* Per-Game Override Controls */}
      <div className="game-overrides">
        <h4>Game Override Controls</h4>
        <p className="override-info">
          🔒 Lock = Manual entry only (ignore API)<br/>
          🔓 Unlock = Auto-update from ESPN API
        </p>

        <div className="game-override-list">
          {games.map(game => {
            const locked = isGameLocked(game.id);
            const fromAPI = isFromAPI(game.id);
            const hasScore = actualScores?.[currentWeek]?.[game.id];
            const team1Code = teamCodes?.[currentWeek]?.[game.id]?.team1 || game.team1;
            const team2Code = teamCodes?.[currentWeek]?.[game.id]?.team2 || game.team2;

            return (
              <div key={game.id} className="game-override-item">
                <div className="game-info">
                  <span className="game-matchup">
                    {team1Code} vs {team2Code}
                  </span>
                  {hasScore && (
                    <span className="game-scores">
                      {actualScores[currentWeek][game.id].team1} - {actualScores[currentWeek][game.id].team2}
                    </span>
                  )}
                </div>

                <div className="game-status-badges">
                  {fromAPI && !locked && (
                    <span className="game-badge api">📡 From API</span>
                  )}
                  {locked && (
                    <span className="game-badge manual">✏️ Manual Entry</span>
                  )}
                  {!hasScore && (
                    <span className="game-badge no-score">No Score</span>
                  )}
                </div>

                <button
                  className={`lock-btn ${locked ? 'locked' : 'unlocked'}`}
                  onClick={() => onGameLockToggle(game.id)}
                  title={locked ? 'Unlock to allow API updates' : 'Lock to prevent API updates'}
                >
                  {locked ? '🔒 Locked' : '🔓 Unlocked'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Help Text */}
      <div className="espn-help">
        <h4>ℹ️ How It Works:</h4>
        <ul>
          <li><strong>Fetch Now:</strong> Manually fetch latest scores from ESPN</li>
          <li><strong>Auto-Refresh:</strong> Automatically fetch every 5 minutes</li>
          <li><strong>Pause API:</strong> Stop all API fetching (use manual entry only)</li>
          <li><strong>Lock Game:</strong> Prevent API from overwriting your manual score for that game</li>
          <li><strong>Unlock Game:</strong> Allow API to update score automatically</li>
        </ul>
        <p className="help-note">
          <strong>Tip:</strong> Lock a game if you need to manually correct a score that ESPN has wrong.
        </p>
      </div>
    </div>
  );
}

export default ESPNControls;
