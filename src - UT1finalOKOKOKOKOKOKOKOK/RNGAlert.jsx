import React, { useMemo } from 'react';
import './RNGAlert.css';
import { isPlayerEligible } from './eligibilityUtils';

/**
 * RNG Alert Component - WITH ELIGIBILITY FILTERING
 * Detects ELIGIBLE (paid+visible) players with no picks
 * Pool Manager only
 */
const RNGAlert = ({ 
  players = [],
  allPicks = [],
  currentWeek,
  weekData,
  onApplyRNGToAll,
  onReviewManually,
  onDismiss
}) => {

  // Detect ELIGIBLE players who need RNG picks
  const playersNeedingRNG = useMemo(() => {
    if (!currentWeek || !weekData) return [];

    // IMPORTANT: Only check ELIGIBLE players (paid + visible)
    const eligiblePlayers = players.filter(isPlayerEligible);

    // Check which eligible players have NO picks for this week
    const playersWithoutPicks = eligiblePlayers.filter(player => {
      const playerPick = allPicks.find(
        pick => pick.playerCode === player.playerCode && pick.week === currentWeek
      );
      
      // No pick found, or pick has no predictions
      if (!playerPick) return true;
      if (!playerPick.predictions) return true;
      
      // Check if predictions object is empty or all games are missing
      const predictions = playerPick.predictions;
      const gameIds = weekData.games.map(g => g.id);
      const hasSomePicks = gameIds.some(gameId => predictions[gameId] !== undefined);
      
      return !hasSomePicks;
    });

    return playersWithoutPicks.map(player => ({
      playerCode: player.playerCode,
      playerName: player.playerName,
      totalGames: weekData.games.length
    }));
  }, [players, allPicks, currentWeek, weekData]);

  // Don't show alert if no ELIGIBLE players need RNG
  if (playersNeedingRNG.length === 0) {
    return null;
  }

  // Get week display name
  const getWeekDisplayName = () => {
    const weekNames = {
      'wildcard': 'Week 1 (Wild Card)',
      'divisional': 'Week 2 (Divisional)',
      'conference': 'Week 3 (Conference)',
      'superbowl': 'Week 4 (Super Bowl)'
    };
    return weekNames[currentWeek] || currentWeek;
  };

  // Handle apply RNG to all
  const handleApplyAll = () => {
    if (confirm(
      `⚠️ APPLY RNG TO ${playersNeedingRNG.length} PLAYER(S)?\n\n` +
      `These players are ELIGIBLE (Paid + Visible) but have no picks:\n\n` +
      playersNeedingRNG.map(p => `• ${p.playerName}`).join('\n') +
      `\n\nThis will generate random scores (10-50) for all games.\n\n` +
      `Continue?`
    )) {
      onApplyRNGToAll(playersNeedingRNG);
    }
  };

  return (
    <div className="rng-alert-container">
      <div className="rng-alert-header">
        <span className="alert-icon">⚠️</span>
        <h3>RNG ALERT: {playersNeedingRNG.length} ELIGIBLE PLAYER{playersNeedingRNG.length !== 1 ? 'S' : ''} NEED PICKS</h3>
        <button className="dismiss-alert-btn" onClick={onDismiss} title="Dismiss Alert">
          ❌
        </button>
      </div>

      <div className="rng-alert-content">
        <div className="alert-week-info">
          <strong>Week:</strong> {getWeekDisplayName()}
        </div>

        <div className="eligibility-notice">
          <strong>ℹ️ Only Eligible Players:</strong> These players are PAID + VISIBLE (eligible to win prizes) but haven't submitted picks yet.
        </div>

        <div className="players-list-section">
          <h4>📋 Eligible Players Missing Picks:</h4>
          <div className="players-missing-list">
            {playersNeedingRNG.map((player, index) => (
              <div key={player.playerCode} className="missing-player-item">
                <span className="player-number">{index + 1}.</span>
                <span className="player-name-rng">{player.playerName}</span>
                <span className="player-code-rng">({player.playerCode})</span>
                <span className="picks-status">0/{player.totalGames} picks</span>
                <span className="eligibility-indicator">💰✅ ELIGIBLE</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rng-action-buttons">
          <button className="rng-btn apply-all-btn" onClick={handleApplyAll}>
            🎲 Apply RNG to All {playersNeedingRNG.length}
          </button>
          <button className="rng-btn review-btn" onClick={() => onReviewManually(playersNeedingRNG)}>
            🔍 Review Each Manually
          </button>
          <button className="rng-btn dismiss-btn" onClick={onDismiss}>
            ❌ Dismiss Alert
          </button>
        </div>

        <div className="rng-info-note">
          <strong>ℹ️ Note:</strong> This alert only shows ELIGIBLE players (Paid + Visible). Unpaid or hidden players are not included as they cannot win prizes.
        </div>
      </div>
    </div>
  );
};

export default RNGAlert;
