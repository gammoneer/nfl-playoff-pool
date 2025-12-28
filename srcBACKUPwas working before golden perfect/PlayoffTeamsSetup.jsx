import React, { useState, useEffect } from 'react';
import './PlayoffTeamsSetup.css';

/**
 * Playoff Teams Setup Component
 * 
 * Week 1: Manual selection of 14 playoff teams with seeding
 * Weeks 2-4: Auto-generate matchups based on winners, with Pool Manager confirmation
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
  isPoolManager 
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

  // Week 2-4 proposed matchups
  const [proposedWeek2, setProposedWeek2] = useState(null);
  const [proposedWeek3, setProposedWeek3] = useState(null);
  const [proposedWeek4, setProposedWeek4] = useState(null);

  // Manual override mode
  const [overrideMode, setOverrideMode] = useState({
    week2: false,
    week3: false,
    week4: false
  });

  // Load existing playoff teams from Firebase
  useEffect(() => {
    if (playoffTeams?.week1) {
      setWeek1Teams(playoffTeams.week1);
    }
  }, [playoffTeams]);

  // Check if Week 1 is configured
  const isWeek1Configured = () => {
    if (!playoffTeams?.week1) return false;
    const afc = playoffTeams.week1.afc || {};
    const nfc = playoffTeams.week1.nfc || {};
    
    // Check if all 14 seeds are filled
    for (let i = 1; i <= 7; i++) {
      if (!afc[`seed${i}`] || !nfc[`seed${i}`]) return false;
    }
    return true;
  };

  // Handle Week 1 team selection
  const handleTeamSelect = (conference, seed, teamId) => {
    const selectedTeam = NFL_TEAMS.find(t => t.id === parseInt(teamId));
    setWeek1Teams(prev => ({
      ...prev,
      [conference]: {
        ...prev[conference],
        [seed]: selectedTeam
      }
    }));
  };

  // Save Week 1 teams
  const handleSaveWeek1 = () => {
    // Validate all teams selected
    for (let i = 1; i <= 7; i++) {
      if (!week1Teams.afc[`seed${i}`] || !week1Teams.nfc[`seed${i}`]) {
        alert('Please select all 14 teams before saving!');
        return;
      }
    }

    const data = {
      week1: {
        ...week1Teams,
        configured: true
      }
    };

    onSavePlayoffTeams(data);
    alert('✅ Week 1 playoff teams saved successfully!');
  };

  // Generate Week 2 matchups based on Week 1 results
  const generateWeek2Matchups = () => {
    if (!actualScores?.wildcard) {
      alert('⚠️ Week 1 scores not yet entered. Cannot generate Week 2 matchups.');
      return;
    }

    // Determine Week 1 winners
    const week1Results = determineWeek1Winners();
    if (!week1Results) {
      alert('⚠️ Not all Week 1 games have been scored. Cannot generate Week 2 matchups.');
      return;
    }

    // Apply reseeding logic
    const week2Matchups = applyReseeding(week1Results);
    setProposedWeek2(week2Matchups);
  };

  // Determine Week 1 winners from actual scores
  const determineWeek1Winners = () => {
    const scores = actualScores.wildcard;
    if (!scores) return null;

    const winners = {
      afc: [],
      nfc: []
    };

    // Game 1: AFC #2 vs #7
    if (scores[1]) {
      const game1Winner = parseInt(scores[1].team2) > parseInt(scores[1].team1) 
        ? week1Teams.afc.seed2 
        : week1Teams.afc.seed7;
      if (game1Winner) winners.afc.push({ ...game1Winner, originalSeed: parseInt(scores[1].team2) > parseInt(scores[1].team1) ? 2 : 7 });
    }

    // Game 2: AFC #3 vs #6
    if (scores[2]) {
      const game2Winner = parseInt(scores[2].team2) > parseInt(scores[2].team1)
        ? week1Teams.afc.seed3
        : week1Teams.afc.seed6;
      if (game2Winner) winners.afc.push({ ...game2Winner, originalSeed: parseInt(scores[2].team2) > parseInt(scores[2].team1) ? 3 : 6 });
    }

    // Game 3: AFC #4 vs #5
    if (scores[3]) {
      const game3Winner = parseInt(scores[3].team2) > parseInt(scores[3].team1)
        ? week1Teams.afc.seed4
        : week1Teams.afc.seed5;
      if (game3Winner) winners.afc.push({ ...game3Winner, originalSeed: parseInt(scores[3].team2) > parseInt(scores[3].team1) ? 4 : 5 });
    }

    // Game 4: NFC #2 vs #7
    if (scores[4]) {
      const game4Winner = parseInt(scores[4].team2) > parseInt(scores[4].team1)
        ? week1Teams.nfc.seed2
        : week1Teams.nfc.seed7;
      if (game4Winner) winners.nfc.push({ ...game4Winner, originalSeed: parseInt(scores[4].team2) > parseInt(scores[4].team1) ? 2 : 7 });
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

  // Apply NFL reseeding rules for Week 2
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
    // Other two play each other
    const matchups = {
      afc: [
        { team1: afcTeams[0], team2: afcTeams[3] }, // #1 vs lowest
        { team1: afcTeams[1], team2: afcTeams[2] }  // Other two
      ],
      nfc: [
        { team1: nfcTeams[0], team2: nfcTeams[3] }, // #1 vs lowest
        { team1: nfcTeams[1], team2: nfcTeams[2] }  // Other two
      ]
    };

    return matchups;
  };

  // Confirm Week 2 matchups
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

  // Generate Week 3 matchups
  const generateWeek3Matchups = () => {
    if (!actualScores?.divisional) {
      alert('⚠️ Week 2 scores not yet entered.');
      return;
    }

    const scores = actualScores.divisional;
    
    // Determine Week 2 winners (games 7-10)
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

  // Confirm Week 3
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

  // Generate Week 4 (Super Bowl)
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

  // Confirm Week 4
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
          <div className="status-item">
            <strong>Week 2:</strong> {playoffTeams?.week2 ? '✅ Set' : '⏸️ Waiting'}
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

      {/* WEEK 2 - Auto-Generate */}
      {isWeek1Configured() && (
        <div className="setup-section">
          <h3>🏈 WEEK 2 - Divisional Round (Auto-Generate)</h3>
          <p>Generate matchups based on Week 1 results with NFL reseeding rules.</p>

          {!proposedWeek2 && !playoffTeams?.week2 && (
            <button className="generate-btn" onClick={generateWeek2Matchups}>
              ⚡ Generate Week 2 Matchups
            </button>
          )}

          {proposedWeek2 && (
            <div className="proposed-matchups">
              <h4>Proposed Week 2 Matchups:</h4>
              <div className="matchup-list">
                <p><strong>AFC Game 1:</strong> {proposedWeek2.afc[0].team1.name} vs {proposedWeek2.afc[0].team2.name}</p>
                <p><strong>AFC Game 2:</strong> {proposedWeek2.afc[1].team1.name} vs {proposedWeek2.afc[1].team2.name}</p>
                <p><strong>NFC Game 1:</strong> {proposedWeek2.nfc[0].team1.name} vs {proposedWeek2.nfc[0].team2.name}</p>
                <p><strong>NFC Game 2:</strong> {proposedWeek2.nfc[1].team1.name} vs {proposedWeek2.nfc[1].team2.name}</p>
              </div>
              <button className="confirm-btn" onClick={confirmWeek2}>
                ✅ Confirm Week 2 Matchups
              </button>
            </div>
          )}

          {playoffTeams?.week2 && (
            <div className="confirmed-status">
              ✅ Week 2 matchups confirmed and saved!
            </div>
          )}
        </div>
      )}

      {/* WEEK 3 - Auto-Generate */}
      {playoffTeams?.week2 && (
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
              <p><strong>AFC Championship:</strong> {proposedWeek3.afcChampionship.team1.name} vs {proposedWeek3.afcChampionship.team2.name}</p>
              <p><strong>NFC Championship:</strong> {proposedWeek3.nfcChampionship.team1.name} vs {proposedWeek3.nfcChampionship.team2.name}</p>
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

      {/* WEEK 4 - Super Bowl */}
      {playoffTeams?.week3 && (
        <div className="setup-section">
          <h3>🏆 WEEK 4 - Super Bowl LIX (Auto-Generate)</h3>
          
          {!proposedWeek4 && !playoffTeams?.week4 && (
            <button className="generate-btn" onClick={generateWeek4Matchup}>
              ⚡ Generate Super Bowl Matchup
            </button>
          )}

          {proposedWeek4 && (
            <div className="proposed-matchups">
              <h4>Proposed Super Bowl Matchup:</h4>
              <p><strong>Super Bowl LIX:</strong> {proposedWeek4.superBowl.team1.name} vs {proposedWeek4.superBowl.team2.name}</p>
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
