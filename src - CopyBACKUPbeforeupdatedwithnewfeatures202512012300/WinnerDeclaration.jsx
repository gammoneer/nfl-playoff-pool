// ============================================
// WINNER DECLARATION COMPONENT
// Pool Manager selects and announces official winners
// ============================================

import React, { useState } from 'react';
import './WinnerDeclaration.css';
import { getPrizeLeaders } from './winnerService';

const PRIZE_INFO = {
  1: { name: 'Most Correct Winners', week: 'Week 1', amount: '$200' },
  2: { name: 'Closest Total Points', week: 'Week 1', amount: '$100' },
  3: { name: 'Most Correct Winners', week: 'Week 2', amount: '$200' },
  4: { name: 'Closest Total Points', week: 'Week 2', amount: '$100' },
  5: { name: 'Most Correct Winners', week: 'Week 3', amount: '$200' },
  6: { name: 'Closest Total Points', week: 'Week 3', amount: '$100' },
  7: { name: 'Most Correct Winners', week: 'Week 4', amount: '$200' },
  8: { name: 'Closest Total Points', week: 'Week 4', amount: '$100' },
  9: { name: 'Overall Most Correct', week: 'All Weeks', amount: '$400' },
  10: { name: 'Overall Closest Points', week: 'All Weeks', amount: '$200' }
};

/**
 * Single Prize Winner Selection
 */
function PrizeWinnerSelector({ 
  prizeNumber, 
  allPicks,
  actualScores,
  games,
  currentWinner,
  onDeclareWinner 
}) {
  const [selectedPlayer, setSelectedPlayer] = useState(currentWinner?.playerCode || '');
  const [showConfirm, setShowConfirm] = useState(false);

  const prizeInfo = PRIZE_INFO[prizeNumber];
  
  // Get current leaders
  const leaders = getPrizeLeaders(prizeNumber, allPicks, actualScores, games);

  const handleDeclare = () => {
    if (!selectedPlayer) {
      alert('Please select a winner first.');
      return;
    }

    const player = leaders.leaders.find(l => l.playerCode === selectedPlayer);
    if (!player) {
      alert('Selected player not found.');
      return;
    }

    setShowConfirm(true);
  };

  const confirmDeclaration = () => {
    const player = leaders.leaders.find(l => l.playerCode === selectedPlayer);
    onDeclareWinner(prizeNumber, player);
    setShowConfirm(false);
  };

  return (
    <div className="prize-selector">
      <div className="prize-selector-header">
        <div className="prize-info-block">
          <h3>Prize #{prizeNumber}</h3>
          <p className="prize-type">{prizeInfo.name} - {prizeInfo.week}</p>
          <p className="prize-amount">{prizeInfo.amount}</p>
        </div>
        
        {currentWinner && (
          <div className="current-winner-badge">
            <span className="badge-label">Current Winner:</span>
            <span className="badge-name">{currentWinner.playerName}</span>
          </div>
        )}
      </div>

      <div className="prize-selector-body">
        {leaders.isTie && (
          <div className="tie-alert">
            <span className="alert-icon">⚠️</span>
            <span className="alert-text">
              {leaders.tiedCount}-way tie detected - Apply tie-breaker rules
            </span>
          </div>
        )}

        <div className="leader-list">
          <h4>Current Leaders:</h4>
          {leaders.leaders.slice(0, 10).map((leader, index) => (
            <label 
              key={leader.playerCode}
              className={`leader-option ${leader.isLeading ? 'is-leading' : ''}`}
            >
              <input
                type="radio"
                name={`prize-${prizeNumber}`}
                value={leader.playerCode}
                checked={selectedPlayer === leader.playerCode}
                onChange={(e) => setSelectedPlayer(e.target.value)}
              />
              <div className="leader-option-content">
                <span className="leader-rank">#{leader.rank}</span>
                <span className="leader-name">{leader.playerName}</span>
                <span className="leader-score">
                  {prizeNumber % 2 === 1 
                    ? `${leader.score} correct`
                    : `${leader.score} diff`
                  }
                </span>
                {leader.isLeading && (
                  <span className="leading-flag">LEADING</span>
                )}
              </div>
            </label>
          ))}
        </div>

        <div className="selector-actions">
          <button
            className="declare-btn"
            onClick={handleDeclare}
            disabled={!selectedPlayer}
          >
            {currentWinner ? 'Update Winner' : 'Declare Winner'}
          </button>
          {currentWinner && (
            <button
              className="remove-btn"
              onClick={() => onDeclareWinner(prizeNumber, null)}
            >
              Remove Winner
            </button>
          )}
        </div>
      </div>

      {showConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-modal">
            <h3>Confirm Winner Declaration</h3>
            <p>
              You are about to declare <strong>{leaders.leaders.find(l => l.playerCode === selectedPlayer)?.playerName}</strong> as 
              the official winner of Prize #{prizeNumber}.
            </p>
            <p className="confirm-details">
              {prizeInfo.name} - {prizeInfo.week}<br />
              Prize Amount: {prizeInfo.amount}
            </p>
            <p className="confirm-warning">
              This will notify all players. Are you sure?
            </p>
            <div className="confirm-buttons">
              <button 
                className="btn-confirm"
                onClick={confirmDeclaration}
              >
                Yes, Declare Winner
              </button>
              <button 
                className="btn-cancel"
                onClick={() => setShowConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Main WinnerDeclaration Component
 * Pool Manager interface for all prizes
 */
function WinnerDeclaration({ 
  allPicks,
  actualScores,
  games,
  officialWinners = {},
  onDeclareWinner,
  isPoolManager = false
}) {

  if (!isPoolManager) {
    return (
      <div className="winner-declaration-container">
        <div className="access-denied">
          <h2>🔒 Access Restricted</h2>
          <p>Only the Pool Manager can declare winners.</p>
        </div>
      </div>
    );
  }

  const announcedCount = Object.keys(officialWinners).length;

  return (
    <div className="winner-declaration-container">
      <div className="declaration-header">
        <h2>🏆 WINNER DECLARATION</h2>
        <p className="subtitle">
          Select official winners for each prize. Players will be notified when winners are announced.
        </p>
        <div className="progress-bar">
          <span className="progress-text">
            {announcedCount} of 10 prizes announced
          </span>
          <div className="progress-fill" style={{ width: `${announcedCount * 10}%` }}>
          </div>
        </div>
      </div>

      <div className="prize-selectors-grid">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(prizeNum => (
          <PrizeWinnerSelector
            key={prizeNum}
            prizeNumber={prizeNum}
            allPicks={allPicks}
            actualScores={actualScores}
            games={games}
            currentWinner={officialWinners[prizeNum]}
            onDeclareWinner={onDeclareWinner}
          />
        ))}
      </div>

      <div className="declaration-footer">
        <button 
          className="notify-all-btn"
          disabled={announcedCount === 0}
          onClick={() => {
            if (window.confirm('Send notification to all players about announced winners?')) {
              alert('Notifications sent! (Feature coming in Step 6)');
            }
          }}
        >
          📢 Notify All Players ({announcedCount} winners)
        </button>
      </div>
    </div>
  );
}

export default WinnerDeclaration;
