import React, { useMemo } from 'react';
import './RNGAlert.css';

/**
 * RNG Alert Component
 * Detects paid players with no picks and provides quick RNG options
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

  // Detect paid players who need RNG picks
  const playersNeedingRNG = useMemo(() => {
    if (!currentWeek || !weekData) return [];

    // Get all paid players
    const paidPlayers = players.filter(p => p.paymentStatus === 'PAID');

    // Check which paid players have NO picks for this week
    const playersWithoutPicks = paidPlayers.filter(player => {
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

  // Don't show alert if no players need RNG
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
      `This will generate random scores (10-50) for:\n` +
      playersNeedingRNG.map(p => `• ${p.playerName}`).join('\n') +
      `\n\nContinue?`
    )) {
      onApplyRNGToAll(playersNeedingRNG);
    }
  };

  return (
    <div className="rng-alert-container">
      <div className="rng-alert-header">
        <span className="alert-icon">⚠️</span>
        <h3>RNG ALERT: {playersNeedingRNG.length} PAID PLAYER{playersNeedingRNG.length !== 1 ? 'S' : ''} NEED PICKS</h3>
        <button className="dismiss-alert-btn" onClick={onDismiss} title="Dismiss Alert">
          ❌
        </button>
      </div>

      <div className="rng-alert-content">
        <div className="alert-week-info">
          <strong>Week:</strong> {getWeekDisplayName()}
        </div>

        <div className="players-list-section">
          <h4>📋 Players Missing Picks (Paid Players Only):</h4>
          <div className="players-missing-list">
            {playersNeedingRNG.map((player, index) => (
              <div key={player.playerCode} className="missing-player-item">
                <span className="player-number">{index + 1}.</span>
                <span className="player-name-rng">{player.playerName}</span>
                <span className="player-code-rng">({player.playerCode})</span>
                <span className="picks-status">0/{player.totalGames} picks</span>
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
          <strong>ℹ️ Note:</strong> This alert will reappear when you login until all paid players have submitted picks or you apply RNG.
        </div>
      </div>
    </div>
  );
};

export default RNGAlert;
