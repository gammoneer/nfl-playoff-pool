import React, { useState, useEffect } from 'react';
import './PlayoffTeamsSetup.css';

/**
 * Playoff Teams Setup Component
 * 
 * Week 1: Manual selection of 14 playoff teams with seeding
 * Week 2-4: MANUAL selection of matchups with clear visual distinction
 */

// All 32 NFL Teams (using 2-3 character abbreviations)
const NFL_TEAMS = [
  { id: 1, name: 'ARI', fullName: 'Arizona Cardinals' },
  { id: 2, name: 'ATL', fullName: 'Atlanta Falcons' },
  { id: 3, name: 'BAL', fullName: 'Baltimore Ravens' },
  { id: 4, name: 'BUF', fullName: 'Buffalo Bills' },
  { id: 5, name: 'CAR', fullName: 'Carolina Panthers' },
  { id: 6, name: 'CHI', fullName: 'Chicago Bears' },
  { id: 7, name: 'CIN', fullName: 'Cincinnati Bengals' },
  { id: 8, name: 'CLE', fullName: 'Cleveland Browns' },
  { id: 9, name: 'DAL', fullName: 'Dallas Cowboys' },
  { id: 10, name: 'DEN', fullName: 'Denver Broncos' },
  { id: 11, name: 'DET', fullName: 'Detroit Lions' },
  { id: 12, name: 'GB', fullName: 'Green Bay Packers' },
  { id: 13, name: 'HOU', fullName: 'Houston Texans' },
  { id: 14, name: 'IND', fullName: 'Indianapolis Colts' },
  { id: 15, name: 'JAC', fullName: 'Jacksonville Jaguars' },
  { id: 16, name: 'KC', fullName: 'Kansas City Chiefs' },
  { id: 17, name: 'LV', fullName: 'Las Vegas Raiders' },
  { id: 18, name: 'LAC', fullName: 'Los Angeles Chargers' },
  { id: 19, name: 'LAR', fullName: 'Los Angeles Rams' },
  { id: 20, name: 'MIA', fullName: 'Miami Dolphins' },
  { id: 21, name: 'MIN', fullName: 'Minnesota Vikings' },
  { id: 22, name: 'NE', fullName: 'New England Patriots' },
  { id: 23, name: 'NO', fullName: 'New Orleans Saints' },
  { id: 24, name: 'NYG', fullName: 'New York Giants' },
  { id: 25, name: 'NYJ', fullName: 'New York Jets' },
  { id: 26, name: 'PHI', fullName: 'Philadelphia Eagles' },
  { id: 27, name: 'PIT', fullName: 'Pittsburgh Steelers' },
  { id: 28, name: 'SF', fullName: 'San Francisco 49ers' },
  { id: 29, name: 'SEA', fullName: 'Seattle Seahawks' },
  { id: 30, name: 'TB', fullName: 'Tampa Bay Buccaneers' },
  { id: 31, name: 'TEN', fullName: 'Tennessee Titans' },
  { id: 32, name: 'WAS', fullName: 'Washington Commanders' }
];

function PlayoffTeamsSetup({ 
  playoffTeams, 
  actualScores,
  onSavePlayoffTeams,
  isPoolManager,
  database,
  weekCompletionStatus = {},
  playoffDates,
  onSavePlayoffDates
}) {
  // Playoff Dates State
  const [dates, setDates] = useState({
    firstFriday: playoffDates?.firstFriday || '',
    lastMonday: playoffDates?.lastMonday || '',
    wildcard: playoffDates?.autoLockDates?.wildcard || '',
    divisional: playoffDates?.autoLockDates?.divisional || '',
    conference: playoffDates?.autoLockDates?.conference || '',
    superbowl: playoffDates?.autoLockDates?.superbowl || ''
  });

  // Update dates state when playoffDates prop changes (loaded from Firebase)
  useEffect(() => {
    if (playoffDates) {
      setDates({
        firstFriday: playoffDates.firstFriday || '',
        lastMonday: playoffDates.lastMonday || '',
        wildcard: playoffDates.autoLockDates?.wildcard || '',
        divisional: playoffDates.autoLockDates?.divisional || '',
        conference: playoffDates.autoLockDates?.conference || '',
        superbowl: playoffDates.autoLockDates?.superbowl || ''
      });
    }
  }, [playoffDates]);

  // Handle date input changes
  const handleDateChange = (field, value) => {
    setDates(prev => ({ ...prev, [field]: value }));
  };

  // Calculate and show what Friday each game date locks on
  const getLockFriday = (dateStr) => {
    if (!dateStr) return 'Not set';
    const gameDay = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = gameDay.getDay();
    const daysBackToFriday = dayOfWeek === 6 ? 1 : dayOfWeek === 0 ? 2 : (dayOfWeek - 5 + 7) % 7;
    const friday = new Date(gameDay);
    friday.setDate(friday.getDate() - daysBackToFriday);
    return friday.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  // Get day name for a date
  const getDayName = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  };

  // Save playoff dates to Firebase
  const handleSaveDates = async () => {
    // Validate all dates are filled
    if (!dates.firstFriday || !dates.lastMonday || !dates.wildcard || !dates.divisional || !dates.conference || !dates.superbowl) {
      alert('⚠️ Please fill in ALL date fields before saving!');
      return;
    }

    // Confirm before saving
    if (!window.confirm(
      '⚠️ CONFIRM SAVE PLAYOFF DATES\n\n' +
      'This will change lock dates for ALL players!\n\n' +
      'First Friday: ' + getDayName(dates.firstFriday) + '\n' +
      'Last Monday: ' + getDayName(dates.lastMonday) + '\n' +
      'Wild Card: ' + getDayName(dates.wildcard) + ' → Locks ' + getLockFriday(dates.wildcard) + '\n' +
      'Divisional: ' + getDayName(dates.divisional) + ' → Locks ' + getLockFriday(dates.divisional) + '\n' +
      'Conference: ' + getDayName(dates.conference) + ' → Locks ' + getLockFriday(dates.conference) + '\n' +
      'Super Bowl: ' + getDayName(dates.superbowl) + ' → Locks ' + getLockFriday(dates.superbowl) + '\n\n' +
      'Are you sure?'
    )) {
      return;
    }

    try {
      const { ref, set } = await import('firebase/database');
      const playoffDatesData = {
        firstFriday: dates.firstFriday,
        lastMonday: dates.lastMonday,
        autoLockDates: {
          wildcard: dates.wildcard,
          divisional: dates.divisional,
          conference: dates.conference,
          superbowl: dates.superbowl
        }
      };
      await set(ref(database, 'playoffDates'), playoffDatesData);
      if (onSavePlayoffDates) {
        onSavePlayoffDates(playoffDatesData);
      }
      alert('✅ Playoff dates saved successfully!\n\nLock dates will update automatically for all players.');
    } catch (error) {
      console.error('Error saving playoff dates:', error);
      alert('⚠️ Error saving dates. Check console.');
    }
  };

  // Week 1 Manual Setup State
  const [week1Teams, setWeek1Teams] = useState({
    afc: {
      seed1: null, seed2: null, seed3: null, seed4: null, seed5: null, seed6: null, seed7: null
    },
    nfc: {
      seed1: null, seed2: null, seed3: null, seed4: null, seed5: null, seed6: null, seed7: null
    }
  });

  // Week 2 Manual Setup State (4 games)
  const [week2Games, setWeek2Games] = useState({
    game7: { away: null, home: null },
    game8: { away: null, home: null },
    game9: { away: null, home: null },
    game10: { away: null, home: null }
  });

  // Week 3 Manual Setup State (2 games - Conference Championships)
  const [week3Games, setWeek3Games] = useState({
    game11: { away: null, home: null },  // AFC Championship
    game12: { away: null, home: null }   // NFC Championship
  });

  // Week 4 Manual Setup State (1 game - Super Bowl)
  const [week4Game, setWeek4Game] = useState({
    game13: { away: null, home: null }  // Super Bowl (neutral site but still have order)
  });

  // Load existing playoff teams from Firebase
  useEffect(() => {
    if (playoffTeams?.week1) {
      setWeek1Teams(playoffTeams.week1);
    }
    if (playoffTeams?.week2Manual) {
      setWeek2Games(playoffTeams.week2Manual);
    }
    if (playoffTeams?.week3Manual) {
      setWeek3Games(playoffTeams.week3Manual);
    }
    if (playoffTeams?.week4Manual) {
      setWeek4Game(playoffTeams.week4Manual);
    }
  }, [playoffTeams]);

  // Check configuration status
  const isWeek1Configured = () => {
    if (!playoffTeams?.week1) return false;
    const afc = playoffTeams.week1.afc || {};
    const nfc = playoffTeams.week1.nfc || {};
    for (let i = 1; i <= 7; i++) {
      if (!afc[`seed${i}`] || !nfc[`seed${i}`]) return false;
    }
    return true;
  };

  const isWeek2Configured = () => {
    if (!playoffTeams?.week2Manual) return false;
    const games = playoffTeams.week2Manual;
    return games.game7?.away && games.game7?.home &&
           games.game8?.away && games.game8?.home &&
           games.game9?.away && games.game9?.home &&
           games.game10?.away && games.game10?.home;
  };

  const isWeek3Configured = () => {
    if (!playoffTeams?.week3Manual) return false;
    const games = playoffTeams.week3Manual;
    return games.game11?.away && games.game11?.home &&
           games.game12?.away && games.game12?.home;
  };

  const isWeek4Configured = () => {
    if (!playoffTeams?.week4Manual) return false;
    const game = playoffTeams.week4Manual;
    return game.game13?.away && game.game13?.home;
  };

  // Handle Week 1 team selection
  const handleTeamSelect = (conference, seed, teamId) => {
    const selectedTeam = NFL_TEAMS.find(t => t.id === parseInt(teamId));
    setWeek1Teams(prev => ({
      ...prev,
      [conference]: {
        ...prev[conference],
        [seed]: selectedTeam || null
      }
    }));
  };

  // Handle Week 2 team selection
  const handleWeek2TeamSelect = (gameId, position, teamCode) => {
    const selectedTeam = NFL_TEAMS.find(t => t.name === teamCode);
    setWeek2Games(prev => ({
      ...prev,
      [gameId]: {
        ...prev[gameId],
        [position]: selectedTeam || null
      }
    }));
  };

  // Handle Week 3 team selection
  const handleWeek3TeamSelect = (gameId, position, teamCode) => {
    const selectedTeam = NFL_TEAMS.find(t => t.name === teamCode);
    setWeek3Games(prev => ({
      ...prev,
      [gameId]: {
        ...prev[gameId],
        [position]: selectedTeam || null
      }
    }));
  };

  // Handle Week 4 team selection
  const handleWeek4TeamSelect = (gameId, position, teamCode) => {
    const selectedTeam = NFL_TEAMS.find(t => t.name === teamCode);
    setWeek4Game(prev => ({
      ...prev,
      [gameId]: {
        ...prev[gameId],
        [position]: selectedTeam || null
      }
    }));
  };

  // Save Week 1
  const handleSaveWeek1 = () => {
    const data = { week1: week1Teams };
    onSavePlayoffTeams(data);
    alert('✅ Week 1 playoff teams saved!');
  };

  // Save Week 2
  const handleSaveWeek2Manual = async () => {
    if (!week2Games.game7.away || !week2Games.game7.home ||
        !week2Games.game8.away || !week2Games.game8.home ||
        !week2Games.game9.away || !week2Games.game9.home ||
        !week2Games.game10.away || !week2Games.game10.home) {
      alert('⚠️ Please select both teams for all 4 games!');
      return;
    }

    const { ref, set } = await import('firebase/database');
    const playoffData = { week2Manual: week2Games };
    onSavePlayoffTeams(playoffData);

    try {
      await set(ref(database, 'teamCodes/divisional'), {
        7: { team1: week2Games.game7.away.name, team2: week2Games.game7.home.name },
        8: { team1: week2Games.game8.away.name, team2: week2Games.game8.home.name },
        9: { team1: week2Games.game9.away.name, team2: week2Games.game9.home.name },
        10: { team1: week2Games.game10.away.name, team2: week2Games.game10.home.name }
      });
      alert('✅ Week 2 teams saved successfully!\n\nPlease refresh your browser (Ctrl+Shift+R) to see the changes.');
    } catch (error) {
      console.error('Error saving team codes:', error);
      alert('⚠️ Error saving to database. Check console.');
    }
  };

  // Save Week 3
  const handleSaveWeek3Manual = async () => {
    if (!week3Games.game11.away || !week3Games.game11.home ||
        !week3Games.game12.away || !week3Games.game12.home) {
      alert('⚠️ Please select both teams for both games!');
      return;
    }

    const { ref, set } = await import('firebase/database');
    const playoffData = { week3Manual: week3Games };
    onSavePlayoffTeams(playoffData);

    try {
      await set(ref(database, 'teamCodes/conference'), {
        11: { team1: week3Games.game11.away.name, team2: week3Games.game11.home.name },
        12: { team1: week3Games.game12.away.name, team2: week3Games.game12.home.name }
      });
      alert('✅ Week 3 teams saved successfully!\n\nPlease refresh your browser (Ctrl+Shift+R) to see the changes.');
    } catch (error) {
      console.error('Error saving team codes:', error);
      alert('⚠️ Error saving to database. Check console.');
    }
  };

  // Save Week 4
  const handleSaveWeek4Manual = async () => {
    if (!week4Game.game13.away || !week4Game.game13.home) {
      alert('⚠️ Please select both teams for Super Bowl!');
      return;
    }

    const { ref, set } = await import('firebase/database');
    const playoffData = { week4Manual: week4Game };
    onSavePlayoffTeams(playoffData);

    try {
      await set(ref(database, 'teamCodes/superbowl'), {
        13: { team1: week4Game.game13.away.name, team2: week4Game.game13.home.name }
      });
      alert('✅ Super Bowl teams saved successfully!\n\nPlease refresh your browser (Ctrl+Shift+R) to see the changes.');
    } catch (error) {
      console.error('Error saving team codes:', error);
      alert('⚠️ Error saving to database. Check console.');
    }
  };

  if (!isPoolManager) {
    return (
      <div className="playoff-setup-container">
        <h2>⚙️ Playoff Teams Setup</h2>
        <p>Only the Pool Manager can access this page.</p>
      </div>
    );
  }

  // Reusable Game Selector Component with better visual distinction
  const GameSelector = ({ gameNumber, gameLabel, awayTeam, homeTeam, onAwayChange, onHomeChange }) => (
    <div className="game-setup" style={{
      border: '2px solid #ddd',
      borderRadius: '8px',
      padding: '15px',
      marginBottom: '15px',
      backgroundColor: '#f9f9f9'
    }}>
      <h4 style={{marginBottom: '15px'}}>{gameLabel}</h4>
      <div style={{display: 'flex', gap: '20px', alignItems: 'center', justifyContent: 'space-between'}}>
        {/* AWAY TEAM - Left side with blue background */}
        <div style={{
          flex: 1,
          padding: '15px',
          backgroundColor: '#e3f2fd',
          borderRadius: '8px',
          border: '2px solid #2196f3'
        }}>
          <label style={{
            display: 'block',
            fontWeight: 'bold',
            marginBottom: '8px',
            color: '#1976d2',
            fontSize: '1.1rem'
          }}>
            🏃 AWAY TEAM (Visiting)
          </label>
          <select
            value={awayTeam?.name || ''}
            onChange={(e) => onAwayChange(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '1rem',
              border: '2px solid #2196f3',
              borderRadius: '4px'
            }}
          >
            <option value="">-- Select Away Team --</option>
            {NFL_TEAMS.map(team => (
              <option key={team.id} value={team.name}>
                {team.name} - {team.fullName}
              </option>
            ))}
          </select>
        </div>

        {/* VS separator */}
        <div style={{
          fontSize: '2rem',
          fontWeight: 'bold',
          color: '#666',
          padding: '0 10px'
        }}>
          @
        </div>

        {/* HOME TEAM - Right side with green background */}
        <div style={{
          flex: 1,
          padding: '15px',
          backgroundColor: '#e8f5e9',
          borderRadius: '8px',
          border: '2px solid #4caf50'
        }}>
          <label style={{
            display: 'block',
            fontWeight: 'bold',
            marginBottom: '8px',
            color: '#2e7d32',
            fontSize: '1.1rem'
          }}>
            🏠 HOME TEAM
          </label>
          <select
            value={homeTeam?.name || ''}
            onChange={(e) => onHomeChange(e.target.value)}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '1rem',
              border: '2px solid #4caf50',
              borderRadius: '4px'
            }}
          >
            <option value="">-- Select Home Team --</option>
            {NFL_TEAMS.map(team => (
              <option key={team.id} value={team.name}>
                {team.name} - {team.fullName}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="playoff-setup-container">
      <h2>⚙️ Playoff Dates/Teams Setup</h2>

      {/* 📅 SECTION 1: PLAYOFF DATES */}
      <div className="setup-section" style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
        color: 'white'
      }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.3rem' }}>📅 PLAYOFF DATES</h3>
        <p style={{ margin: '0 0 20px 0', opacity: 0.85, fontSize: '0.9rem' }}>
          Set the game day dates below. Lock dates (Friday 11:59 PM) are calculated automatically.
        </p>

        {/* Season Setup Row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          {/* First Friday */}
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '16px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '0.85rem', opacity: 0.9 }}>
              📌 First Friday (Season Start)
            </label>
            <input
              type="date"
              value={dates.firstFriday}
              onChange={(e) => handleDateChange('firstFriday', e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: 'none', fontSize: '1rem', boxSizing: 'border-box' }}
            />
            {dates.firstFriday && (
              <div style={{ fontSize: '0.78rem', marginTop: '4px', opacity: 0.8 }}>
                {getDayName(dates.firstFriday)}
              </div>
            )}
          </div>

          {/* Last Monday */}
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '16px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '0.85rem', opacity: 0.9 }}>
              🏁 Last Monday (Season End)
            </label>
            <input
              type="date"
              value={dates.lastMonday}
              onChange={(e) => handleDateChange('lastMonday', e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: 'none', fontSize: '1rem', boxSizing: 'border-box' }}
            />
            {dates.lastMonday && (
              <div style={{ fontSize: '0.78rem', marginTop: '4px', opacity: 0.8 }}>
                {getDayName(dates.lastMonday)}
              </div>
            )}
          </div>
        </div>

        {/* Game Day Dates Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          {/* Wild Card */}
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '16px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '0.85rem', opacity: 0.9 }}>
              🏈 Week 1 - Wild Card Game Day
            </label>
            <input
              type="date"
              value={dates.wildcard}
              onChange={(e) => handleDateChange('wildcard', e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: 'none', fontSize: '1rem', boxSizing: 'border-box' }}
            />
            {dates.wildcard && (
              <div style={{ fontSize: '0.78rem', marginTop: '4px', opacity: 0.8 }}>
                {getDayName(dates.wildcard)} → 🔒 Locks {getLockFriday(dates.wildcard)} @ 11:59 PM
              </div>
            )}
          </div>

          {/* Divisional */}
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '16px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '0.85rem', opacity: 0.9 }}>
              🏈 Week 2 - Divisional Game Day
            </label>
            <input
              type="date"
              value={dates.divisional}
              onChange={(e) => handleDateChange('divisional', e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: 'none', fontSize: '1rem', boxSizing: 'border-box' }}
            />
            {dates.divisional && (
              <div style={{ fontSize: '0.78rem', marginTop: '4px', opacity: 0.8 }}>
                {getDayName(dates.divisional)} → 🔒 Locks {getLockFriday(dates.divisional)} @ 11:59 PM
              </div>
            )}
          </div>

          {/* Conference */}
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '16px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '0.85rem', opacity: 0.9 }}>
              🏈 Week 3 - Conference Game Day
            </label>
            <input
              type="date"
              value={dates.conference}
              onChange={(e) => handleDateChange('conference', e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: 'none', fontSize: '1rem', boxSizing: 'border-box' }}
            />
            {dates.conference && (
              <div style={{ fontSize: '0.78rem', marginTop: '4px', opacity: 0.8 }}>
                {getDayName(dates.conference)} → 🔒 Locks {getLockFriday(dates.conference)} @ 11:59 PM
              </div>
            )}
          </div>

          {/* Super Bowl */}
          <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '8px', padding: '16px' }}>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '0.85rem', opacity: 0.9 }}>
              🏆 Week 4 - Super Bowl Game Day
            </label>
            <input
              type="date"
              value={dates.superbowl}
              onChange={(e) => handleDateChange('superbowl', e.target.value)}
              style={{ width: '100%', padding: '10px', borderRadius: '6px', border: 'none', fontSize: '1rem', boxSizing: 'border-box' }}
            />
            {dates.superbowl && (
              <div style={{ fontSize: '0.78rem', marginTop: '4px', opacity: 0.8 }}>
                {getDayName(dates.superbowl)} → 🔒 Locks {getLockFriday(dates.superbowl)} @ 11:59 PM
              </div>
            )}
          </div>
        </div>

        {/* Save Dates Button */}
        <button
          onClick={handleSaveDates}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            background: 'white',
            color: '#667eea',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          💾 Save Playoff Dates
        </button>
      </div>

      {/* 🏈 SECTION 2: PLAYOFF TEAMS (existing code below) */}
      <div style={{ borderTop: '2px solid #ddd', paddingTop: '24px' }}>
      <h3 style={{ marginTop: 0 }}>🏈 PLAYOFF TEAMS</h3>
        <h3>📊 Current Status</h3>
        <div className="status-grid">
          <div className={`status-item ${isWeek1Configured() ? 'configured' : 'not-configured'}`}>
            <strong>Week 1:</strong> {isWeek1Configured() ? '✅ Configured' : '⚠️ Not Configured'}
          </div>
          <div className={`status-item ${isWeek2Configured() ? 'configured' : 'not-configured'}`}>
            <strong>Week 2:</strong> {isWeek2Configured() ? '✅ Configured' : '⚠️ Not Configured'}
          </div>
          <div className={`status-item ${isWeek3Configured() ? 'configured' : 'not-configured'}`}>
            <strong>Week 3:</strong> {isWeek3Configured() ? '✅ Configured' : '⚠️ Not Configured'}
          </div>
          <div className={`status-item ${isWeek4Configured() ? 'configured' : 'not-configured'}`}>
            <strong>Week 4:</strong> {isWeek4Configured() ? '✅ Configured' : '⚠️ Not Configured'}
          </div>
        </div>
      </div>

      {/* WEEK 1 - Manual Setup */}
      <div className="setup-section">
        <h3>🏈 WEEK 1 - Wild Card Round (Manual Setup)</h3>
        <p>Select the 14 playoff teams and assign their seeds.</p>

        <div className="conference-setup">
          <div className="conference-column">
            <h4>AFC Teams</h4>
            {[1, 2, 3, 4, 5, 6, 7].map(seed => (
              <div key={`afc-${seed}`} className="seed-selector">
                <label>AFC #{seed} Seed:</label>
                <select
                  value={week1Teams.afc[`seed${seed}`]?.id || ''}
                  onChange={(e) => handleTeamSelect('afc', `seed${seed}`, e.target.value)}
                >
                  <option value="">Select Team</option>
                  {NFL_TEAMS.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name} - {team.fullName}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="conference-column">
            <h4>NFC Teams</h4>
            {[1, 2, 3, 4, 5, 6, 7].map(seed => (
              <div key={`nfc-${seed}`} className="seed-selector">
                <label>NFC #{seed} Seed:</label>
                <select
                  value={week1Teams.nfc[`seed${seed}`]?.id || ''}
                  onChange={(e) => handleTeamSelect('nfc', `seed${seed}`, e.target.value)}
                >
                  <option value="">Select Team</option>
                  {NFL_TEAMS.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name} - {team.fullName}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        <button className="save-btn" onClick={handleSaveWeek1}>
          💾 Save Week 1 Playoff Teams
        </button>
      </div>

      {/* WEEK 2 - MANUAL SETUP */}
      {/* WEEK 2 - Only shows after Week 1 is closed OR Week 2 is already configured */}
      {(isWeek1Configured() && (weekCompletionStatus.wildcard || isWeek2Configured())) && (
        <div className="setup-section">
          <h3>🏈 WEEK 2 - Divisional Round (Manual Setup)</h3>

          {!weekCompletionStatus.wildcard && (
            <p style={{color: '#ff9800', fontWeight: 'bold', marginBottom: '10px',backgroundColor: '#fff3cd', padding: '10px', borderRadius: '4px'}}>
              ⏳ Week 1 must be closed before you can configure Week 2 teams.<br/>
              (Pool Manager: Use "Close Week 1" button after all games are FINAL)
            </p>
          )}
          <p style={{color: '#d63031', fontWeight: 'bold', marginBottom: '20px'}}>
            ⚠️ Blue box = AWAY team (visiting) | Green box = HOME team
          </p>

          <GameSelector
            gameNumber={7}
            gameLabel="Game 7 - Saturday 1:30 PM PST"
            awayTeam={week2Games.game7.away}
            homeTeam={week2Games.game7.home}
            onAwayChange={(code) => handleWeek2TeamSelect('game7', 'away', code)}
            onHomeChange={(code) => handleWeek2TeamSelect('game7', 'home', code)}
          />

          <GameSelector
            gameNumber={8}
            gameLabel="Game 8 - Saturday 5:00 PM PST"
            awayTeam={week2Games.game8.away}
            homeTeam={week2Games.game8.home}
            onAwayChange={(code) => handleWeek2TeamSelect('game8', 'away', code)}
            onHomeChange={(code) => handleWeek2TeamSelect('game8', 'home', code)}
          />

          <GameSelector
            gameNumber={9}
            gameLabel="Game 9 - Sunday 12:00 PM PST"
            awayTeam={week2Games.game9.away}
            homeTeam={week2Games.game9.home}
            onAwayChange={(code) => handleWeek2TeamSelect('game9', 'away', code)}
            onHomeChange={(code) => handleWeek2TeamSelect('game9', 'home', code)}
          />

          <GameSelector
            gameNumber={10}
            gameLabel="Game 10 - Sunday 3:30 PM PST"
            awayTeam={week2Games.game10.away}
            homeTeam={week2Games.game10.home}
            onAwayChange={(code) => handleWeek2TeamSelect('game10', 'away', code)}
            onHomeChange={(code) => handleWeek2TeamSelect('game10', 'home', code)}
          />

          <button className="save-btn" onClick={handleSaveWeek2Manual}
            style={{marginTop: '20px', fontSize: '1.1rem', padding: '12px 30px'}}>
            💾 Save Week 2 Teams
          </button>

          {isWeek2Configured() && (
            <div className="confirmed-status" style={{marginTop: '15px'}}>
              ✅ Week 2 teams configured and saved!
            </div>
          )}
        </div>
      )}

      {/* WEEK 3 - MANUAL SETUP */}
      {/* WEEK 3 - Only shows after Week 2 is closed OR Week 3 is already configured */}
      {(isWeek2Configured() && (weekCompletionStatus.divisional || isWeek3Configured())) && (
        <div className="setup-section">
          <h3>🏈 WEEK 3 - Conference Championships (Manual Setup)</h3>
          {!weekCompletionStatus.divisional && (
            <p style={{color: '#ff9800', fontWeight: 'bold', marginBottom: '10px',backgroundColor: '#fff3cd', padding: '10px', borderRadius: '4px'}}>
              ⏳ Week 2 must be closed before you can configure Week 3 teams.<br/>
              (Pool Manager: Use "Close Week 2" button after all games are FINAL)
            </p>
          )}
          <p style={{color: '#d63031', fontWeight: 'bold', marginBottom: '20px'}}>
            ⚠️ Blue box = AWAY team (visiting) | Green box = HOME team
          </p>

          <GameSelector
            gameNumber={11}
            gameLabel="Game 11 - AFC Championship (Sunday TBD)"
            awayTeam={week3Games.game11.away}
            homeTeam={week3Games.game11.home}
            onAwayChange={(code) => handleWeek3TeamSelect('game11', 'away', code)}
            onHomeChange={(code) => handleWeek3TeamSelect('game11', 'home', code)}
          />

          <GameSelector
            gameNumber={12}
            gameLabel="Game 12 - NFC Championship (Sunday TBD)"
            awayTeam={week3Games.game12.away}
            homeTeam={week3Games.game12.home}
            onAwayChange={(code) => handleWeek3TeamSelect('game12', 'away', code)}
            onHomeChange={(code) => handleWeek3TeamSelect('game12', 'home', code)}
          />

          <button className="save-btn" onClick={handleSaveWeek3Manual}
            style={{marginTop: '20px', fontSize: '1.1rem', padding: '12px 30px'}}>
            💾 Save Week 3 Teams
          </button>

          {isWeek3Configured() && (
            <div className="confirmed-status" style={{marginTop: '15px'}}>
              ✅ Week 3 teams configured and saved!
            </div>
          )}
        </div>
      )}

      {/* WEEK 4 - MANUAL SETUP */}
      {/* WEEK 4 - Only shows after Week 3 is closed OR Week 4 is already configured */}
      {(isWeek3Configured() && (weekCompletionStatus.conference || isWeek4Configured())) && (
        <div className="setup-section">
          <h3>🏆 WEEK 4 - Super Bowl (Manual Setup)</h3>
          {!weekCompletionStatus.conference && (
            <p style={{color: '#ff9800', fontWeight: 'bold', marginBottom: '10px',backgroundColor: '#fff3cd', padding: '10px', borderRadius: '4px'}}>
              ⏳ Week 3 must be closed before you can configure Week 4 teams.<br/>
              (Pool Manager: Use "Close Week 3" button after all games are FINAL)
            </p>
          )}
          <p style={{color: '#d63031', fontWeight: 'bold', marginBottom: '20px'}}>
            ⚠️ Blue box = Team 1 (listed first) | Green box = Team 2 (listed second)
          </p>

          <GameSelector
            gameNumber={13}
            gameLabel="Game 13 - Super Bowl LIX (Sunday, February 8, 2026)"
            awayTeam={week4Game.game13.away}
            homeTeam={week4Game.game13.home}
            onAwayChange={(code) => handleWeek4TeamSelect('game13', 'away', code)}
            onHomeChange={(code) => handleWeek4TeamSelect('game13', 'home', code)}
          />

          <button className="save-btn" onClick={handleSaveWeek4Manual}
            style={{marginTop: '20px', fontSize: '1.1rem', padding: '12px 30px'}}>
            💾 Save Super Bowl Teams
          </button>

          {isWeek4Configured() && (
            <div className="confirmed-status" style={{marginTop: '15px'}}>
              ✅ Super Bowl teams configured and saved!
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

export default PlayoffTeamsSetup;
