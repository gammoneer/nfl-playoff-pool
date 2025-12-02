// ============================================
// WEEK SELECTOR COMPONENT
// Large, obvious week selection interface
// ============================================

import React from 'react';
import './WeekSelector.css';

const PLAYOFF_WEEKS = {
  wildcard: {
    name: 'Week 1 - Wildcard Round',
    shortName: 'Wildcard',
    deadline: 'Fri Jan 10, 11:59 PM PST',
    number: 1
  },
  divisional: {
    name: 'Week 2 - Divisional Round',
    shortName: 'Divisional',
    deadline: 'Fri Jan 17, 11:59 PM PST',
    number: 2
  },
  conference: {
    name: 'Week 3 - Conference Championships',
    shortName: 'Conference',
    deadline: 'Fri Jan 24, 11:59 PM PST',
    number: 3
  },
  superbowl: {
    name: 'Week 4 - Super Bowl LIX',
    shortName: 'Super Bowl',
    deadline: 'Sun Feb 9, 3:30 PM PT',
    number: 4
  }
};

/**
 * Get week status indicator
 * @param {string} weekKey - Week identifier
 * @param {object} picks - Player picks for this week
 * @param {boolean} isLocked - Week is locked
 * @param {boolean} isCurrentWeek - Currently viewing this week
 * @returns {object} Status with icon, text, and color
 */
function getWeekStatus(weekKey, picks, isLocked, isCurrentWeek) {
  if (isLocked) {
    return { icon: '🔒', text: 'LOCKED', color: 'gray', className: 'locked' };
  }
  
  if (isCurrentWeek) {
    return { icon: '📝', text: 'EDITING NOW', color: 'purple', className: 'editing' };
  }
  
  // Check if picks are complete (all games filled)
  if (picks && picks.complete) {
    return { icon: '✅', text: 'ALL PICKS SAVED', color: 'green', className: 'saved' };
  }
  
  return { icon: '🏈', text: 'READY TO PICK', color: 'blue', className: 'ready' };
}

/**
 * WeekSelector Component
 * Displays large, obvious week selection cards
 */
function WeekSelector({
  currentWeek,
  onWeekChange,
  weekPicks = {},
  weekLockStatus = {},
  hasUnsavedChanges = false
}) {

  const handleWeekClick = (weekKey) => {
    if (weekKey === currentWeek) return; // Already on this week
    
    // If has unsaved changes, parent component will show popup
    // Parent component should handle onWeekChange and show confirmation if needed
    onWeekChange(weekKey);
  };

  return (
    <div className="week-selector-container">
      <div className="week-selector-header">
        <h2>📅 SELECT WEEK TO MAKE/EDIT YOUR PICKS</h2>
        {hasUnsavedChanges && (
          <div className="unsaved-indicator">
            ⚠️ You have unsaved changes
          </div>
        )}
      </div>

      <div className="week-cards">
        {Object.entries(PLAYOFF_WEEKS).map(([weekKey, weekInfo]) => {
          const isCurrentWeek = weekKey === currentWeek;
          const isLocked = weekLockStatus[weekKey]?.locked || false;
          const picks = weekPicks[weekKey];
          
          const status = getWeekStatus(weekKey, picks, isLocked, isCurrentWeek);

          return (
            <div
              key={weekKey}
              className={`week-card ${status.className} ${isCurrentWeek ? 'current' : ''}`}
              onClick={() => handleWeekClick(weekKey)}
              role="button"
              tabIndex={0}
              onKeyPress={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleWeekClick(weekKey);
                }
              }}
            >
              <div className="week-card-header">
                <div className="week-number">WEEK {weekInfo.number}</div>
                {isCurrentWeek && (
                  <div className="current-indicator">► YOU ARE HERE ◄</div>
                )}
              </div>

              <div className="week-card-title">
                {weekKey === 'superbowl' ? '🏆' : '🏈'} {weekInfo.shortName}
              </div>

              <div className="week-card-deadline">
                {weekKey === 'superbowl' ? 'Game Day: ' : 'Deadline: '}
                {weekInfo.deadline}
              </div>

              <div className={`week-card-status status-${status.className}`}>
                <span className="status-icon">{status.icon}</span>
                <span className="status-text">{status.text}</span>
              </div>

              {isLocked && (
                <div className="locked-overlay">
                  <div className="locked-message">
                    🔒 Cannot Edit
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="week-selector-footer">
        <p className="info-text">
          ℹ️ You can make picks for all weeks in advance, even if teams aren't known yet.
        </p>
      </div>
    </div>
  );
}

export default WeekSelector;
