// ============================================
// VALIDATION POPUPS COMPONENT
// All confirmation dialogs and error messages
// ============================================

import React from 'react';
import './ValidationPopups.css';

/**
 * Unsaved Changes Popup
 * Shown when user tries to switch weeks with unsaved edits
 */
export function UnsavedChangesPopup({ currentWeek, onDiscard, onSaveAndSwitch, onCancel }) {
  const weekNames = {
    wildcard: 'Week 1',
    divisional: 'Week 2',
    conference: 'Week 3',
    superbowl: 'Week 4'
  };

  return (
    <div className="popup-overlay">
      <div className="popup-container warning-popup">
        <div className="popup-header warning">
          <span className="popup-icon">⚠️</span>
          <h3>UNSAVED CHANGES</h3>
        </div>

        <div className="popup-body">
          <p>You have unsaved changes for {weekNames[currentWeek]}.</p>
          <p>What would you like to do?</p>
        </div>

        <div className="popup-buttons">
          <button 
            className="popup-btn btn-secondary"
            onClick={onDiscard}
          >
            Discard Changes
          </button>
          <button 
            className="popup-btn btn-primary"
            onClick={onSaveAndSwitch}
          >
            Save & Switch
          </button>
          <button 
            className="popup-btn btn-neutral"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Discard Changes Popup
 * Shown when user clicks Cancel with unsaved edits
 */
export function DiscardChangesPopup({ onKeepEditing, onDiscard }) {
  return (
    <div className="popup-overlay">
      <div className="popup-container warning-popup">
        <div className="popup-header warning">
          <span className="popup-icon">⚠️</span>
          <h3>DISCARD CHANGES?</h3>
        </div>

        <div className="popup-body">
          <p>Your changes will not be saved.</p>
          <p>Your previously saved picks will remain unchanged in the system.</p>
        </div>

        <div className="popup-buttons">
          <button 
            className="popup-btn btn-primary"
            onClick={onKeepEditing}
          >
            Keep Editing
          </button>
          <button 
            className="popup-btn btn-danger"
            onClick={onDiscard}
          >
            Discard Changes
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Incomplete Entry Error
 * Shown when user tries to save without filling all games
 */
export function IncompleteEntryError({ missingGames, totalGames, onClose }) {
  return (
    <div className="popup-overlay">
      <div className="popup-container error-popup">
        <div className="popup-header error">
          <span className="popup-icon">❌</span>
          <h3>CANNOT SAVE - INCOMPLETE ENTRY</h3>
        </div>

        <div className="popup-body">
          <p>You must predict scores for ALL games.</p>
          <p className="count-text">
            Completed: <strong>{totalGames - missingGames.length}</strong> of <strong>{totalGames}</strong> games ⚠️
          </p>
          
          <div className="missing-games-list">
            <p><strong>Missing scores for:</strong></p>
            <ul>
              {missingGames.map((game, index) => (
                <li key={index}>
                  • Game {index + 1}: {game.team1} vs {game.team2}
                </li>
              ))}
            </ul>
          </div>

          <p className="instruction-text">
            Please fill in all games before saving.
          </p>
        </div>

        <div className="popup-buttons">
          <button 
            className="popup-btn btn-primary"
            onClick={onClose}
          >
            OK - Go Back and Complete
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Invalid Scores Error
 * Shown when user tries to save with scores outside 10-50 range
 */
export function InvalidScoresError({ invalidScores, onClose }) {
  return (
    <div className="popup-overlay">
      <div className="popup-container error-popup">
        <div className="popup-header error">
          <span className="popup-icon">❌</span>
          <h3>INVALID SCORES</h3>
        </div>

        <div className="popup-body">
          <p>All scores must be between 10 and 50.</p>
          
          <div className="invalid-scores-list">
            <p><strong>Invalid scores:</strong></p>
            <ul>
              {invalidScores.map((item, index) => (
                <li key={index}>
                  • Game {index + 1} ({item.team}): <strong>{item.score}</strong> ({item.score < 10 ? 'too low' : 'too high'})
                </li>
              ))}
            </ul>
          </div>

          <p className="instruction-text">
            Please fix these scores.
          </p>
        </div>

        <div className="popup-buttons">
          <button 
            className="popup-btn btn-primary"
            onClick={onClose}
          >
            OK - Go Back and Fix
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Success Confirmation
 * Shown after successful save
 */
export function SuccessConfirmation({ weekName, deadline, onClose }) {
  return (
    <div className="popup-overlay">
      <div className="popup-container success-popup">
        <div className="popup-header success">
          <span className="popup-icon">✅</span>
          <h3>PICKS SAVED SUCCESSFULLY!</h3>
        </div>

        <div className="popup-body">
          <p>Your {weekName} picks have been saved.</p>
          <p>You can edit them anytime before the deadline:</p>
          <p className="deadline-text"><strong>{deadline}</strong></p>
        </div>

        <div className="popup-buttons">
          <button 
            className="popup-btn btn-success"
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * No Changes Info
 * Shown when user tries to save with no changes
 */
export function NoChangesInfo({ onClose }) {
  return (
    <div className="popup-overlay">
      <div className="popup-container info-popup">
        <div className="popup-header info">
          <span className="popup-icon">ℹ️</span>
          <h3>NO CHANGES TO SAVE</h3>
        </div>

        <div className="popup-body">
          <p>You haven't made any changes to your picks.</p>
          <p>Your picks are already saved.</p>
        </div>

        <div className="popup-buttons">
          <button 
            className="popup-btn btn-primary"
            onClick={onClose}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Tied Games Error
 * Shown when user tries to submit picks with tied scores
 * Playoff games NEVER end in a tie - they go to overtime!
 */
export function TiedGamesError({ tiedGames, gameData, onClose }) {
  return (
    <div className="popup-overlay">
      <div className="popup-container error-popup">
        <div className="popup-header error">
          <span className="popup-icon">🚫</span>
          <h3>PLAYOFF GAMES CANNOT END IN A TIE!</h3>
        </div>

        <div className="popup-body">
          <p style={{fontWeight: 'bold', marginBottom: '15px'}}>
            The following game(s) have tied scores:
          </p>
          <ul style={{listStyle: 'none', padding: 0, marginBottom: '15px'}}>
            {tiedGames.map(gameId => {
              const game = gameData.find(g => g.id === gameId);
              return (
                <li key={gameId} style={{
                  padding: '8px',
                  background: '#ffebee',
                  border: '1px solid #ef5350',
                  borderRadius: '4px',
                  marginBottom: '8px',
                  color: '#c62828'
                }}>
                  ⚠️ {game.team1} vs. {game.team2}
                </li>
              );
            })}
          </ul>
          <p style={{fontStyle: 'italic', color: '#666'}}>
            NFL Playoff games go to overtime until there's a winner!
          </p>
          <p style={{fontWeight: 'bold'}}>
            Please change the scores so one team wins.
          </p>
        </div>

        <div className="popup-buttons">
          <button 
            className="popup-btn btn-primary"
            onClick={onClose}
          >
            Fix Scores
          </button>
        </div>
      </div>
    </div>
  );
}

export default {
  UnsavedChangesPopup,
  DiscardChangesPopup,
  IncompleteEntryError,
  InvalidScoresError,
  SuccessConfirmation,
  NoChangesInfo,
  TiedGamesError
};
