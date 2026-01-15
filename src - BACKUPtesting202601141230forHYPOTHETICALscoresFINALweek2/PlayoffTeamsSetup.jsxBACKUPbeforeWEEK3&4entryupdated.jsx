import React, { useState, useEffect } from 'react';
import './PlayoffTeamsSetup.css';

/**
 * Playoff Teams Setup Component
 * 
 * Week 1: Manual selection of 14 playoff teams with seeding
 * Week 2: MANUAL selection of 4 matchups (FIXED!)
 * Weeks 3-4: Auto-generate matchups based on winners
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
  database
}) {
  // Week 1 Manual Setup State
  const [week1Teams, setWeek1Teams] = useState({
    afc: {
      seed1: null,
      seed2: null,
      seed3: null,
      seed4: null,
      seed5: null,
      seed6: null,
      seed7: null
    },
    nfc: {
      seed1: null,
      seed2: null,
      seed3: null,
      seed4: null,
      seed5: null,
      seed6: null,
      seed7: null
    }
  });

  // ✅ NEW: Week 2 Manual Setup State
  const [week2Games, setWeek2Games] = useState({
    game7: { away: null, home: null },  // BUF @ DEN
    game8: { away: null, home: null },  // SF @ SEA
    game9: { away: null, home: null },  // HOU @ NE
    game10: { away: null, home: null }  // LAR @ CHI
  });

  // Week 2-4 proposed matchups
  const [proposedWeek2, setProposedWeek2] = useState(null);
  const [proposedWeek3, setProposedWeek3] = useState(null);
  const [proposedWeek4, setProposedWeek4] = useState(null);

  // Load existing playoff teams from Firebase
  useEffect(() => {
    if (playoffTeams?.week1) {
      setWeek1Teams(playoffTeams.week1);
    }
    
    // ✅ NEW: Load Week 2 manual teams if they exist
    if (playoffTeams?.week2Manual) {
      setWeek2Games(playoffTeams.week2Manual);
    }
  }, [playoffTeams]);

  // Check if Week 1 is configured
  const isWeek1Configured = () => {
    if (!playoffTeams?.week1) return false;
    const afc = playoffTeams.week1.afc || {};
    const nfc = playoffTeams.week1.nfc || {};
    
    // Check if all 14 seeds are filled
    for (let i = 1; i <= 7; i++) {
      if (!afc[`seed${i}`] || !nfc[`seed${i}`]) {
        return false;
      }
    }
    return true;
  };

  // ✅ NEW: Check if Week 2 is configured
  const isWeek2Configured = () => {
    if (!playoffTeams?.week2Manual) return false;
    const games = playoffTeams.week2Manual;
    
    // Check if all 4 games have both teams
    return games.game7?.away && games.game7?.home &&
           games.game8?.away && games.game8?.home &&
           games.game9?.away && games.game9?.home &&
           games.game10?.away && games.game10?.home;
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

  // ✅ NEW: Handle Week 2 team selection
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

  // Save Week 1 configuration
  const handleSaveWeek1 = () => {
    const data = {
      week1: week1Teams
    };
    onSavePlayoffTeams(data);
    alert('✅ Week 1 playoff teams saved!');
  };

  // ✅ NEW: Save Week 2 Manual Configuration
  const handleSaveWeek2Manual = async () => {
    // Validate all games have both teams
    if (!week2Games.game7.away || !week2Games.game7.home ||
        !week2Games.game8.away || !week2Games.game8.home ||
        !week2Games.game9.away || !week2Games.game9.home ||
        !week2Games.game10.away || !week2Games.game10.home) {
      alert('⚠️ Please select both teams for all 4 games!');
      return;
    }

    // Import Firebase functions
    const { ref, set } = await import('firebase/database');

    // Save to playoffTeams (for UI display)
    const playoffData = {
      week2Manual: week2Games
    };
    
    onSavePlayoffTeams(playoffData);

    // Save team codes to Firebase (for game display)
    try {
      await set(ref(database, 'teamCodes/divisional'), {
        7: {
          team1: week2Games.game7.away.name,
          team2: week2Games.game7.home.name
        },
        8: {
          team1: week2Games.game8.away.name,
          team2: week2Games.game8.home.name
        },
        9: {
          team1: week2Games.game9.away.name,
          team2: week2Games.game9.home.name
        },
        10: {
          team1: week2Games.game10.away.name,
          team2: week2Games.game10.home.name
        }
      });
      
      alert('✅ Week 2 teams saved successfully!\n\nPlease refresh your browser (Ctrl+Shift+R) to see the changes.');
    } catch (error) {
      console.error('Error saving team codes:', error);
      alert('⚠️ Error saving to database. Check console.');
    }
  };

  // Original Week 2 auto-generation (keep for reference)
  const generateWeek2Matchups = () => {
    if (!actualScores?.wildcard) {
      alert('⚠️ Week 1 scores not yet entered.');
      return;
    }

    const scores = actualScores.wildcard;
    const week1Winners = determineWeek1Winners(scores);
    
    if (!week1Winners) {
      alert('⚠️ Not all Week 1 games are scored yet.');
      return;
    }

    const matchups = applyReseeding(week1Winners);
    setProposedWeek2(matchups);
  };

  const determineWeek1Winners = (scores) => {
    const winners = { afc: [], nfc: [] };

    // Determine winners for all 6 games
    // Game 1: AFC #2 vs #7
    if (scores[1]) {
      const game1Winner = parseInt(scores[1].team2) > parseInt(scores[1].team1)
        ? week1Teams.afc.seed2
        : week1Teams.afc.seed7;
      if (game1Winner) winners.afc.push({ ...game1Winner, originalSeed: parseInt(scores[1].team2) > parseInt(scores[1].team1) ? 2 : 7 });
    }

    // Game 2: NFC #2 vs #7
    if (scores[2]) {
      const game2Winner = parseInt(scores[2].team2) > parseInt(scores[2].team1)
        ? week1Teams.nfc.seed2
        : week1Teams.nfc.seed7;
      if (game2Winner) winners.nfc.push({ ...game2Winner, originalSeed: parseInt(scores[2].team2) > parseInt(scores[2].team1) ? 2 : 7 });
    }

    // Game 3: AFC #3 vs #6
    if (scores[3]) {
      const game3Winner = parseInt(scores[3].team2) > parseInt(scores[3].team1)
        ? week1Teams.afc.seed3
        : week1Teams.afc.seed6;
      if (game3Winner) winners.afc.push({ ...game3Winner, originalSeed: parseInt(scores[3].team2) > parseInt(scores[3].team1) ? 3 : 6 });
    }

    // Game 4: AFC #4 vs #5
    if (scores[4]) {
      const game4Winner = parseInt(scores[4].team2) > parseInt(scores[4].team1)
        ? week1Teams.afc.seed4
        : week1Teams.afc.seed5;
      if (game4Winner) winners.afc.push({ ...game4Winner, originalSeed: parseInt(scores[4].team2) > parseInt(scores[4].team1) ? 4 : 5 });
    }

    // Game 5: NFC #3 vs #6
    if (scores[5]) {
      const game5Winner = parseInt(scores[5].team2) > parseInt(scores[5].team1)
        ? week1Teams.nfc.seed3
        : week1Teams.nfc.seed6;
      if (game5Winner) winners.nfc.push({ ...game5Winner, originalSeed: parseInt(scores[5].team2) > parseInt(scores[5].team1) ? 3 : 6 });
    }

    // Game 6: NFC #4 vs #5
    if (scores[6]) {
      const game6Winner = parseInt(scores[6].team2) > parseInt(scores[6].team1)
        ? week1Teams.nfc.seed4
        : week1Teams.nfc.seed5;
      if (game6Winner) winners.nfc.push({ ...game6Winner, originalSeed: parseInt(scores[6].team2) > parseInt(scores[6].team1) ? 4 : 5 });
    }

    // Verify we have all 6 winners
    if (winners.afc.length !== 3 || winners.nfc.length !== 3) {
      return null;
    }

    return winners;
  };

  const applyReseeding = (week1Winners) => {
    // Add #1 seeds to the mix
    const afcTeams = [
      { ...week1Teams.afc.seed1, originalSeed: 1 },
      ...week1Winners.afc
    ];
    const nfcTeams = [
      { ...week1Teams.nfc.seed1, originalSeed: 1 },
      ...week1Winners.nfc
    ];

    // Sort by original seed (ascending)
    afcTeams.sort((a, b) => a.originalSeed - b.originalSeed);
    nfcTeams.sort((a, b) => a.originalSeed - b.originalSeed);

    // #1 seed plays lowest remaining seed
    const matchups = {
      afc: [
        { team1: afcTeams[0], team2: afcTeams[3] },
        { team1: afcTeams[1], team2: afcTeams[2] }
      ],
      nfc: [
        { team1: nfcTeams[0], team2: nfcTeams[3] },
        { team1: nfcTeams[1], team2: nfcTeams[2] }
      ]
    };

    return matchups;
  };

  const confirmWeek2 = () => {
    if (!proposedWeek2) {
      alert('No proposed matchups to confirm!');
      return;
    }

    const data = {
      week2: {
        ...proposedWeek2,
        autoPopulated: true,
        manuallyOverridden: false
      }
    };

    onSavePlayoffTeams(data);
    setProposedWeek2(null);
    alert('✅ Week 2 matchups confirmed and saved!');
  };

  // Week 3 and 4 functions remain unchanged...
  const generateWeek3Matchups = () => {
    if (!actualScores?.divisional) {
      alert('⚠️ Week 2 scores not yet entered.');
      return;
    }

    const scores = actualScores.divisional;
    
    const afcWinner1 = scores[7] && parseInt(scores[7].team1) > parseInt(scores[7].team2) 
      ? playoffTeams.week2.afc[0].team1 
      : playoffTeams.week2.afc[0].team2;
    
    const afcWinner2 = scores[8] && parseInt(scores[8].team1) > parseInt(scores[8].team2)
      ? playoffTeams.week2.afc[1].team1
      : playoffTeams.week2.afc[1].team2;

    const nfcWinner1 = scores[9] && parseInt(scores[9].team1) > parseInt(scores[9].team2)
      ? playoffTeams.week2.nfc[0].team1
      : playoffTeams.week2.nfc[0].team2;

    const nfcWinner2 = scores[10] && parseInt(scores[10].team1) > parseInt(scores[10].team2)
      ? playoffTeams.week2.nfc[1].team1
      : playoffTeams.week2.nfc[1].team2;

    if (!afcWinner1 || !afcWinner2 || !nfcWinner1 || !nfcWinner2) {
      alert('⚠️ Not all Week 2 games scored yet.');
      return;
    }

    const matchups = {
      afcChampionship: { team1: afcWinner1, team2: afcWinner2 },
      nfcChampionship: { team1: nfcWinner1, team2: nfcWinner2 }
    };

    setProposedWeek3(matchups);
  };

  const confirmWeek3 = () => {
    if (!proposedWeek3) return;

    const data = {
      week3: {
        ...proposedWeek3,
        autoPopulated: true
      }
    };

    onSavePlayoffTeams(data);
    setProposedWeek3(null);
    alert('✅ Week 3 matchups confirmed!');
  };

  const generateWeek4Matchup = () => {
    if (!actualScores?.conference) {
      alert('⚠️ Week 3 scores not yet entered.');
      return;
    }

    const scores = actualScores.conference;

    const afcChampion = scores[11] && parseInt(scores[11].team1) > parseInt(scores[11].team2)
      ? playoffTeams.week3.afcChampionship.team1
      : playoffTeams.week3.afcChampionship.team2;

    const nfcChampion = scores[12] && parseInt(scores[12].team1) > parseInt(scores[12].team2)
      ? playoffTeams.week3.nfcChampionship.team1
      : playoffTeams.week3.nfcChampionship.team2;

    if (!afcChampion || !nfcChampion) {
      alert('⚠️ Not all Conference games scored yet.');
      return;
    }

    const matchup = {
      superBowl: { team1: afcChampion, team2: nfcChampion }
    };

    setProposedWeek4(matchup);
  };

  const confirmWeek4 = () => {
    if (!proposedWeek4) return;

    const data = {
      week4: {
        ...proposedWeek4,
        autoPopulated: true
      }
    };

    onSavePlayoffTeams(data);
    setProposedWeek4(null);
    alert('✅ Super Bowl matchup confirmed!');
  };

  if (!isPoolManager) {
    return (
      <div className="playoff-setup-container">
        <h2>⚙️ Playoff Teams Setup</h2>
        <p>Only the Pool Manager can access this page.</p>
      </div>
    );
  }

  return (
    <div className="playoff-setup-container">
      <h2>⚙️ Playoff Teams Setup</h2>
      
      <div className="setup-status">
        <h3>📊 Current Status</h3>
        <div className="status-grid">
          <div className={`status-item ${isWeek1Configured() ? 'configured' : 'not-configured'}`}>
            <strong>Week 1:</strong> {isWeek1Configured() ? '✅ Configured' : '⚠️ Not Configured'}
          </div>
          <div className={`status-item ${isWeek2Configured() ? 'configured' : 'not-configured'}`}>
            <strong>Week 2:</strong> {isWeek2Configured() ? '✅ Configured' : '⚠️ Not Configured'}
          </div>
          <div className="status-item">
            <strong>Week 3:</strong> {playoffTeams?.week3 ? '✅ Set' : '⏸️ Waiting'}
          </div>
          <div className="status-item">
            <strong>Week 4:</strong> {playoffTeams?.week4 ? '✅ Set' : '⏸️ Waiting'}
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

      {/* ✅ NEW: WEEK 2 - MANUAL SETUP */}
      {isWeek1Configured() && (
        <div className="setup-section">
          <h3>🏈 WEEK 2 - Divisional Round (Manual Setup)</h3>
          <p style={{color: '#d63031', fontWeight: 'bold'}}>
            ⚠️ Select teams manually for each game. Away team is on the left, Home team on the right.
          </p>

          <div className="week2-manual-setup">
            {/* Game 7 */}
            <div className="game-setup">
              <h4>Game 7 - Saturday 1:30 PM PST</h4>
              <div className="team-selectors">
                <div className="team-selector">
                  <label>AWAY Team:</label>
                  <select
                    value={week2Games.game7.away?.name || ''}
                    onChange={(e) => handleWeek2TeamSelect('game7', 'away', e.target.value)}
                  >
                    <option value="">Select Team</option>
                    {NFL_TEAMS.map(team => (
                      <option key={team.id} value={team.name}>
                        {team.name} - {team.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <span style={{fontSize: '1.5rem', margin: '0 10px'}}>@</span>
                <div className="team-selector">
                  <label>HOME Team:</label>
                  <select
                    value={week2Games.game7.home?.name || ''}
                    onChange={(e) => handleWeek2TeamSelect('game7', 'home', e.target.value)}
                  >
                    <option value="">Select Team</option>
                    {NFL_TEAMS.map(team => (
                      <option key={team.id} value={team.name}>
                        {team.name} - {team.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Game 8 */}
            <div className="game-setup">
              <h4>Game 8 - Saturday 5:00 PM PST</h4>
              <div className="team-selectors">
                <div className="team-selector">
                  <label>AWAY Team:</label>
                  <select
                    value={week2Games.game8.away?.name || ''}
                    onChange={(e) => handleWeek2TeamSelect('game8', 'away', e.target.value)}
                  >
                    <option value="">Select Team</option>
                    {NFL_TEAMS.map(team => (
                      <option key={team.id} value={team.name}>
                        {team.name} - {team.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <span style={{fontSize: '1.5rem', margin: '0 10px'}}>@</span>
                <div className="team-selector">
                  <label>HOME Team:</label>
                  <select
                    value={week2Games.game8.home?.name || ''}
                    onChange={(e) => handleWeek2TeamSelect('game8', 'home', e.target.value)}
                  >
                    <option value="">Select Team</option>
                    {NFL_TEAMS.map(team => (
                      <option key={team.id} value={team.name}>
                        {team.name} - {team.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Game 9 */}
            <div className="game-setup">
              <h4>Game 9 - Sunday 12:00 PM PST</h4>
              <div className="team-selectors">
                <div className="team-selector">
                  <label>AWAY Team:</label>
                  <select
                    value={week2Games.game9.away?.name || ''}
                    onChange={(e) => handleWeek2TeamSelect('game9', 'away', e.target.value)}
                  >
                    <option value="">Select Team</option>
                    {NFL_TEAMS.map(team => (
                      <option key={team.id} value={team.name}>
                        {team.name} - {team.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <span style={{fontSize: '1.5rem', margin: '0 10px'}}>@</span>
                <div className="team-selector">
                  <label>HOME Team:</label>
                  <select
                    value={week2Games.game9.home?.name || ''}
                    onChange={(e) => handleWeek2TeamSelect('game9', 'home', e.target.value)}
                  >
                    <option value="">Select Team</option>
                    {NFL_TEAMS.map(team => (
                      <option key={team.id} value={team.name}>
                        {team.name} - {team.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Game 10 */}
            <div className="game-setup">
              <h4>Game 10 - Sunday 3:30 PM PST</h4>
              <div className="team-selectors">
                <div className="team-selector">
                  <label>AWAY Team:</label>
                  <select
                    value={week2Games.game10.away?.name || ''}
                    onChange={(e) => handleWeek2TeamSelect('game10', 'away', e.target.value)}
                  >
                    <option value="">Select Team</option>
                    {NFL_TEAMS.map(team => (
                      <option key={team.id} value={team.name}>
                        {team.name} - {team.fullName}
                      </option>
                    ))}
                  </select>
                </div>
                <span style={{fontSize: '1.5rem', margin: '0 10px'}}>@</span>
                <div className="team-selector">
                  <label>HOME Team:</label>
                  <select
                    value={week2Games.game10.home?.name || ''}
                    onChange={(e) => handleWeek2TeamSelect('game10', 'home', e.target.value)}
                  >
                    <option value="">Select Team</option>
                    {NFL_TEAMS.map(team => (
                      <option key={team.id} value={team.name}>
                        {team.name} - {team.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <button 
            className="save-btn" 
            onClick={handleSaveWeek2Manual}
            style={{marginTop: '20px', fontSize: '1.1rem', padding: '12px 30px'}}
          >
            💾 Save Week 2 Teams
          </button>

          {isWeek2Configured() && (
            <div className="confirmed-status" style={{marginTop: '15px'}}>
              ✅ Week 2 teams configured and saved!
            </div>
          )}
        </div>
      )}

      {/* WEEK 3 - Auto-Generate */}
      {isWeek2Configured() && (
        <div className="setup-section">
          <h3>🏈 WEEK 3 - Conference Championships (Auto-Generate)</h3>
          
          {!proposedWeek3 && !playoffTeams?.week3 && (
            <button className="generate-btn" onClick={generateWeek3Matchups}>
              ⚡ Generate Week 3 Matchups
            </button>
          )}

          {proposedWeek3 && (
            <div className="proposed-matchups">
              <h4>Proposed Week 3 Matchups:</h4>
              <div className="matchup-list">
                <p><strong>AFC Championship:</strong> {proposedWeek3.afcChampionship.team1.name} vs {proposedWeek3.afcChampionship.team2.name}</p>
                <p><strong>NFC Championship:</strong> {proposedWeek3.nfcChampionship.team1.name} vs {proposedWeek3.nfcChampionship.team2.name}</p>
              </div>
              <button className="confirm-btn" onClick={confirmWeek3}>
                ✅ Confirm Week 3 Matchups
              </button>
            </div>
          )}

          {playoffTeams?.week3 && (
            <div className="confirmed-status">
              ✅ Week 3 matchups confirmed!
            </div>
          )}
        </div>
      )}

      {/* WEEK 4 - Auto-Generate */}
      {playoffTeams?.week3 && (
        <div className="setup-section">
          <h3>🏈 WEEK 4 - Super Bowl (Auto-Generate)</h3>
          
          {!proposedWeek4 && !playoffTeams?.week4 && (
            <button className="generate-btn" onClick={generateWeek4Matchup}>
              ⚡ Generate Super Bowl Matchup
            </button>
          )}

          {proposedWeek4 && (
            <div className="proposed-matchups">
              <h4>Proposed Super Bowl Matchup:</h4>
              <div className="matchup-list">
                <p><strong>Super Bowl:</strong> {proposedWeek4.superBowl.team1.name} vs {proposedWeek4.superBowl.team2.name}</p>
              </div>
              <button className="confirm-btn" onClick={confirmWeek4}>
                ✅ Confirm Super Bowl Matchup
              </button>
            </div>
          )}

          {playoffTeams?.week4 && (
            <div className="confirmed-status">
              ✅ Super Bowl matchup confirmed!
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PlayoffTeamsSetup;
