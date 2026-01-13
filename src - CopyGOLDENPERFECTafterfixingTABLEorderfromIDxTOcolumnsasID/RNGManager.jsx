import React, { useState, useEffect } from 'react';
import './RNGManager.css';

/**
 * RNG Manager Component (Pool Manager Only)
 * 
 * Features:
 * - View players missing picks
 * - Select paid players for RNG generation
 * - Generate random picks (10-50)
 * - Track notifications (email/text)
 * - Backup before/after RNG
 * - Download RNG logs
 */

function RNGManager({
  currentWeek,
  games,
  allPicks,
  players,
  onGenerateRNG,
  onBackupPicks,
  onUpdateNotifications,
  rngLogs
}) {
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [showNotificationPopup, setShowNotificationPopup] = useState(false);
  const [generatedPlayers, setGeneratedPlayers] = useState([]);
  const [notifications, setNotifications] = useState({});

  // Get players missing picks for current week
  const getMissingPicksPlayers = () => {
    if (!players || players.length === 0) return [];

    return players.filter(player => {
      // Check if player has picks for current week
      const hasPicks = allPicks.some(pick => 
        pick.playerCode === player.code && pick.week === currentWeek
      );

      return !hasPicks;
    });
  };

  const missingPlayers = getMissingPicksPlayers();

  // Toggle player selection
  const handlePlayerToggle = (playerCode) => {
    setSelectedPlayers(prev => {
      if (prev.includes(playerCode)) {
        return prev.filter(code => code !== playerCode);
      } else {
        return [...prev, playerCode];
      }
    });
  };

  // Select all paid players
  const handleSelectAllPaid = () => {
    const paidMissingPlayers = missingPlayers
      .filter(p => p.paid)
      .map(p => p.code);
    setSelectedPlayers(paidMissingPlayers);
  };

  // Generate RNG picks
  const handleGenerateRNG = async () => {
    if (selectedPlayers.length === 0) {
      alert('Please select at least one player');
      return;
    }

    // Confirm action
    const confirmed = window.confirm(
      `Generate RNG picks for ${selectedPlayers.length} player(s)?\n\n` +
      `This will create random scores (10-50) for all games in ${currentWeek}.`
    );

    if (!confirmed) return;

    // Backup before RNG
    const backupConfirmed = window.confirm('Backup all picks before generating RNG?');
    if (backupConfirmed) {
      await onBackupPicks('before-rng');
    }

    // Generate RNG
    const playersToGenerate = missingPlayers.filter(p => 
      selectedPlayers.includes(p.code)
    );

    const generated = await onGenerateRNG(playersToGenerate, currentWeek, games);

    // Show notification popup
    setGeneratedPlayers(generated);
    setShowNotificationPopup(true);
  };

  // Save notifications
  const handleSaveNotifications = async () => {
    await onUpdateNotifications(currentWeek, notifications);
    
    // Prompt for backup after RNG
    const backupConfirmed = window.confirm(
      'RNG picks generated successfully!\n\n' +
      'Backup all picks (including RNG) now?'
    );

    if (backupConfirmed) {
      await onBackupPicks('after-rng');
    }

    setShowNotificationPopup(false);
    setGeneratedPlayers([]);
    setSelectedPlayers([]);
    setNotifications({});
  };

  // Update notification status
  const handleNotificationChange = (playerCode, field, value) => {
    setNotifications(prev => ({
      ...prev,
      [playerCode]: {
        ...prev[playerCode],
        [field]: value
      }
    }));
  };

  return (
    <div className="rng-manager">
      <div className="rng-header">
        <h3>🎲 RNG Pick Generation - {currentWeek.toUpperCase()}</h3>
        <div className="rng-status">
          {missingPlayers.length > 0 ? (
            <span className="status-warning">
              ⚠️ {missingPlayers.length} player(s) missing picks
            </span>
          ) : (
            <span className="status-success">
              ✅ All players have submitted picks
            </span>
          )}
        </div>
      </div>

      {/* Backup Section */}
      <div className="rng-backup-section">
        <button
          className="backup-btn"
          onClick={() => onBackupPicks('manual')}
        >
          💾 Backup All Picks to Cloud
        </button>
        <p className="backup-info">
          Always backup before generating RNG picks!
        </p>
      </div>

      {/* Missing Picks Report */}
      {missingPlayers.length > 0 && (
        <div className="missing-picks-report">
          <h4>Missing Picks Report:</h4>

          <div className="select-actions">
            <button
              className="select-all-btn"
              onClick={handleSelectAllPaid}
            >
              ☑ Select All PAID Players
            </button>
          </div>

          <table className="missing-players-table">
            <thead>
              <tr>
                <th>Select</th>
                <th>Code</th>
                <th>Name</th>
                <th>Paid?</th>
                <th>Has Picks?</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {missingPlayers.map(player => (
                <tr key={player.code} className={player.paid ? '' : 'unpaid-row'}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedPlayers.includes(player.code)}
                      onChange={() => handlePlayerToggle(player.code)}
                      disabled={!player.paid}
                    />
                  </td>
                  <td>{player.code}</td>
                  <td>{player.name}</td>
                  <td>
                    {player.paid ? (
                      <span className="paid-badge">✓ Yes</span>
                    ) : (
                      <span className="unpaid-badge">✗ No</span>
                    )}
                  </td>
                  <td>
                    <span className="no-picks-badge">✗ No</span>
                  </td>
                  <td>
                    <span className={player.paid ? 'action-gen' : 'action-skip'}>
                      {player.paid ? 'Generate' : 'Skip'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="rng-generate-section">
            <button
              className="generate-rng-btn"
              onClick={handleGenerateRNG}
              disabled={selectedPlayers.length === 0}
            >
              🎲 Generate RNG for Selected Players ({selectedPlayers.length})
            </button>
          </div>
        </div>
      )}

      {/* RNG History */}
      {rngLogs && rngLogs[currentWeek] && Object.keys(rngLogs[currentWeek]).length > 0 && (
        <div className="rng-history">
          <h4>RNG History & Notifications:</h4>
          
          {Object.values(rngLogs[currentWeek]).map(log => (
            <div key={log.playerCode} className="rng-history-item">
              <div className="history-player">
                <strong>{log.playerCode} - {log.playerName}</strong>
              </div>
              <div className="history-picks">
                Picks: {log.gameScores}
              </div>
              <div className="history-notifications">
                Notified: 
                {log.notifiedEmail && <span className="notif-badge">✓ Email</span>}
                {log.notifiedText && <span className="notif-badge">✓ Text</span>}
                {!log.notifiedEmail && !log.notifiedText && <span className="notif-badge-none">Not yet</span>}
              </div>
              {log.notes && (
                <div className="history-notes">
                  Notes: {log.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Notification Popup */}
      {showNotificationPopup && (
        <div className="notification-popup-overlay">
          <div className="notification-popup">
            <h3>✅ RNG Picks Generated Successfully</h3>
            <p>RNG picks created for {generatedPlayers.length} player(s):</p>

            <div className="notification-players-list">
              {generatedPlayers.map(player => (
                <div key={player.code} className="notification-player-item">
                  <div className="notif-player-header">
                    <strong>Player: {player.name} ({player.code})</strong>
                  </div>
                  <div className="notif-player-picks">
                    Week: {currentWeek.toUpperCase()}
                  </div>

                  <div className="notif-checkboxes">
                    <label>
                      <input
                        type="checkbox"
                        checked={notifications[player.code]?.email || false}
                        onChange={(e) => handleNotificationChange(player.code, 'email', e.target.checked)}
                      />
                      Email
                    </label>
                    <label>
                      <input
                        type="checkbox"
                        checked={notifications[player.code]?.text || false}
                        onChange={(e) => handleNotificationChange(player.code, 'text', e.target.checked)}
                      />
                      Text
                    </label>
                  </div>

                  <div className="notif-notes">
                    <input
                      type="text"
                      placeholder="Notes (optional)"
                      value={notifications[player.code]?.notes || ''}
                      onChange={(e) => handleNotificationChange(player.code, 'notes', e.target.value)}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="notification-popup-actions">
              <button
                className="save-notif-btn"
                onClick={handleSaveNotifications}
              >
                Save Notification Status
              </button>
              <button
                className="skip-notif-btn"
                onClick={() => {
                  setShowNotificationPopup(false);
                  setGeneratedPlayers([]);
                }}
              >
                Skip - I'll update later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RNGManager;
