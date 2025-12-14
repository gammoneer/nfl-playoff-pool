// ============================================
// WEEK SELECTOR - STYLED FOR RICHARD'S DESIGN
// Simple button bar matching purple theme
// ============================================

import React from 'react';
import './WeekSelector_Richard.css';

const WEEK_INFO = {
  wildcard: {
    name: 'Wildcard',
    emoji: '🏈',
    deadline: 'Fri Jan 9, 11:59 PM'
  },
  divisional: {
    name: 'Divisional',
    emoji: '🏈',
    deadline: 'Fri Jan 16, 11:59 PM'
  },
  conference: {
    name: 'Conference',
    emoji: '🏈',
    deadline: 'Fri Jan 23, 11:59 PM'
  },
  superbowl: {
    name: 'Super Bowl',
    emoji: '🏆',
    deadline: 'Fri Feb 6, 11:59 PM'
  }
};

function WeekSelector({ 
  currentWeek, 
  onWeekChange, 
  weekLockStatus = {},
  hasUnsavedChanges = false
}) {

  const handleWeekClick = (week) => {
    if (weekLockStatus[week]?.locked) {
      return; // Can't switch to locked week
    }
    
    if (hasUnsavedChanges) {
      // Let parent handle unsaved changes
      if (window.confirm('You have unsaved changes. Switch anyway?')) {
        onWeekChange(week);
      }
    } else {
      onWeekChange(week);
    }
  };

  return (
    <div className="week-selector-container">
      <div className="week-selector-buttons">
        {Object.keys(WEEK_INFO).map(week => {
          const info = WEEK_INFO[week];
          const isActive = currentWeek === week;
          const isLocked = weekLockStatus[week]?.locked || false;

          return (
            <button
              key={week}
              className={`week-btn ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
              onClick={() => handleWeekClick(week)}
              disabled={isLocked}
            >
              <span className="week-btn-emoji">{info.emoji}</span>
              <span className="week-btn-name">{info.name}</span>
              <span className="week-btn-deadline">{info.deadline}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default WeekSelector;
