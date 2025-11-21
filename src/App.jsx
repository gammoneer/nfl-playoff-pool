import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, onValue, set } from 'firebase/database';
import './App.css';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDr3PPXC90wvQW_LG8TkAyR9K-7e0loQ3A",
  authDomain: "nfl-playoff-pool-2025-scores.firebaseapp.com",
  databaseURL: "https://nfl-playoff-pool-2025-scores-default-rtdb.firebaseio.com",
  projectId: "nfl-playoff-pool-2025-scores",
  storageBucket: "nfl-playoff-pool-2025-scores.firebasestorage.app",
  messagingSenderId: "844539772456",
  appId: "1:844539772456:web:9bbfcf523195a5eedfff1d"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// Player codes system - Code maps to player name
// Pool Manager: Add entries as players pay
// Format: "code": "First Name Last Name"
const PLAYER_CODES = {
  "100099": "John Smith",
  "100199": "Jane Doe",
  "100299": "Mike Johnson",
  "100399": "Sarah Williams",
  "100499": "David Brown",
  "990499": "Neema Dadmand",
  "990099": "Richard Biletski",
  "999000": "Dallas Pylypow",
  // Add more as people pay...
  // Codes can be 1000-9999
};

// Playoff structure - update these with actual matchups when known
const PLAYOFF_WEEKS = {
  wildcard: {
    name: "Wild Card Round January 13, 2026",
    games: [
      { id: 1, team1: "AFC #7", team2: "AFC #2" },
      { id: 2, team1: "AFC #6", team2: "AFC #3" },
      { id: 3, team1: "AFC #5", team2: "AFC #4" },
      { id: 4, team1: "NFC #7", team2: "NFC #2" },
      { id: 5, team1: "NFC #6", team2: "NFC #3" },
      { id: 6, team1: "NFC #5", team2: "NFC #4" }
    ]
  },
  divisional: {
    name: "Divisional Round",
    games: [
      { id: 7, team1: "AFC Winner 1", team2: "AFC #1" },
      { id: 8, team1: "AFC Winner 2", team2: "AFC Winner 3" },
      { id: 9, team1: "NFC Winner 1", team2: "NFC #1" },
      { id: 10, team1: "NFC Winner 2", team2: "NFC Winner 3" }
    ]
  },
  conference: {
    name: "Conference Championships",
    games: [
      { id: 11, team1: "AFC Winner A", team2: "AFC Winner B" },
      { id: 12, team1: "NFC Winner A", team2: "NFC Winner B" }
    ]
  },
  superbowl: {
    name: "Super Bowl LIX",
    games: [
      { id: 13, team1: "AFC Champion", team2: "NFC Champion" }
    ]
  }
};

function App() {
  const [playerName, setPlayerName] = useState('');
  const [playerCode, setPlayerCode] = useState('');
  const [codeValidated, setCodeValidated] = useState(false);
  const [currentWeek, setCurrentWeek] = useState('wildcard');
  const [predictions, setPredictions] = useState({});
  const [allPicks, setAllPicks] = useState([]);
  const [submitted, setSubmitted] = useState(false);

  // Load all picks from Firebase
  useEffect(() => {
    const picksRef = ref(database, 'picks');
    onValue(picksRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Convert to array and include Firebase keys for updating
        const picksArray = Object.keys(data).map(key => ({
          ...data[key],
          firebaseKey: key
        }));
        setAllPicks(picksArray);
      } else {
        setAllPicks([]);
      }
    });
  }, []);

  const handleScoreChange = (gameId, team, score) => {
    setPredictions(prev => ({
      ...prev,
      [gameId]: {
        ...prev[gameId],
        [team]: score
      }
    }));
  };

  // Check if submissions are allowed based on day/time (PST)
  const isSubmissionAllowed = () => {
    const now = new Date();
    
    // Convert to Pacific Time
    const pstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
    
    const day = pstTime.getDay(); // 0=Sunday, 1=Monday, ..., 5=Friday, 6=Saturday
    const hours = pstTime.getHours();
    const minutes = pstTime.getMinutes();
    
    // Block on Friday after 11:59 PM (starting Saturday 00:00)
    if (day === 5 && (hours === 23 && minutes >= 59)) {
      return false;
    }
    
    // Block all day Saturday (day 6)
    if (day === 6) {
      return false;
    }
    
    // Block all day Sunday (day 0)
    if (day === 0) {
      return false;
    }
    
    // Block Monday until 12:01 AM (first minute of Monday)
    if (day === 1 && hours === 0 && minutes === 0) {
      return false;
    }
    
    // All other times are allowed
    return true;
  };

  // Validate player code and set player name
  const handleCodeValidation = () => {
    const code = playerCode.trim();
    
    if (!code) {
      alert('Please enter your 6-digit player code');
      return;
    }
    
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      alert('Invalid code format!\n\nPlayer codes must be exactly 6 digits.\nExample: 123456');
      return;
    }
    
    const playerNameForCode = PLAYER_CODES[code];
    
    if (!playerNameForCode) {
      alert('Invalid player code!\n\nThis code is not recognized.\n\nMake sure you:\n1. Paid your $20 entry fee\n2. Received your code from the pool manager\n3. Entered the code correctly\n\nContact: biletskifamily@shaw.ca');
      return;
    }
    
    // Check if this player already has picks for this week
    const existingPick = allPicks.find(
      pick => pick.playerName === playerNameForCode && pick.week === currentWeek
    );
    
    if (existingPick) {
      // Load their existing picks into the form
      setPredictions(existingPick.predictions || {});
      alert(`Welcome back, ${playerNameForCode}!\n\nYour existing picks for ${PLAYOFF_WEEKS[currentWeek].name} have been loaded.\n\nYou can edit and resubmit as many times as you want until Friday 11:59 PM PST.`);
    }
    
    // Code is valid!
    setPlayerName(playerNameForCode);
    setCodeValidated(true);
  };

  // Download picks as CSV spreadsheet
  const downloadPicksAsCSV = () => {
    const weekPicks = allPicks.filter(pick => pick.week === currentWeek);
    
    if (weekPicks.length === 0) {
      alert('No picks to download for this week.');
      return;
    }

    // Create CSV header - First row with game numbers
    let csv = ','; // Empty cell for player name column
    currentWeekData.games.forEach(game => {
      csv += `Game ${game.id},Game ${game.id},`;
    });
    csv += '\n';

    // Second header row with team names
    csv += 'Player Name,';
    currentWeekData.games.forEach(game => {
      csv += `${game.team1} Score,${game.team2} Score,`;
    });
    
    // Add week breakdown columns for Super Bowl
    if (currentWeek === 'superbowl') {
      csv += 'Week 4 Total,Week 3 Total,Week 2 Total,Week 1 Total,GRAND TOTAL,';
    } else {
      csv += 'Total Points,';
    }
    csv += 'Submitted At\n';

    // Add data rows
    weekPicks
      .sort((a, b) => (b.lastUpdated || b.timestamp) - (a.lastUpdated || a.timestamp))
      .forEach(pick => {
        csv += `"${pick.playerName}",`;
        currentWeekData.games.forEach(game => {
          const team1Score = pick.predictions[game.id]?.team1 || '-';
          const team2Score = pick.predictions[game.id]?.team2 || '-';
          csv += `${team1Score},${team2Score},`;
        });
        const date = new Date(pick.lastUpdated || pick.timestamp).toLocaleString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
        // Calculate total points
        const totalPoints = currentWeekData.games.reduce((total, game) => {
          const team1Score = parseInt(pick.predictions[game.id]?.team1) || 0;
          const team2Score = parseInt(pick.predictions[game.id]?.team2) || 0;
          return total + team1Score + team2Score;
        }, 0);
        
        // Add totals based on week
        if (currentWeek === 'superbowl') {
          // Calculate each week's total
          const week4Total = (() => {
            const w4Pick = allPicks.find(p => p.playerName === pick.playerName && p.week === 'superbowl');
            if (!w4Pick) return 0;
            let sum = 0;
            PLAYOFF_WEEKS.superbowl.games.forEach(game => {
              const pred = w4Pick.predictions[game.id];
              if (pred) sum += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
            });
            return sum;
          })();
          
          const week3Total = (() => {
            const w3Pick = allPicks.find(p => p.playerName === pick.playerName && p.week === 'conference');
            if (!w3Pick) return 0;
            let sum = 0;
            PLAYOFF_WEEKS.conference.games.forEach(game => {
              const pred = w3Pick.predictions[game.id];
              if (pred) sum += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
            });
            return sum;
          })();
          
          const week2Total = (() => {
            const w2Pick = allPicks.find(p => p.playerName === pick.playerName && p.week === 'divisional');
            if (!w2Pick) return 0;
            let sum = 0;
            PLAYOFF_WEEKS.divisional.games.forEach(game => {
              const pred = w2Pick.predictions[game.id];
              if (pred) sum += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
            });
            return sum;
          })();
          
          const week1Total = (() => {
            const w1Pick = allPicks.find(p => p.playerName === pick.playerName && p.week === 'wildcard');
            if (!w1Pick) return 0;
            let sum = 0;
            PLAYOFF_WEEKS.wildcard.games.forEach(game => {
              const pred = w1Pick.predictions[game.id];
              if (pred) sum += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
            });
            return sum;
          })();
          
          const grandTotal = week4Total + week3Total + week2Total + week1Total;
          
          csv += `${week4Total},${week3Total},${week2Total},${week1Total},${grandTotal},"${date}"\n`;
        } else {
          csv += `${totalPoints},"${date}"\n`;
        }
      });

    // Create download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NFL-Playoff-Pool-${currentWeekData.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!playerName || !codeValidated) {
      alert('Please validate your player code first');
      return;
    }

    // Check if submissions are allowed (time-based restriction)
    if (!isSubmissionAllowed()) {
      const now = new Date();
      const pstTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' }));
      const day = pstTime.getDay();
      
      let reopenTime = '';
      if (day === 5 || day === 6) {
        reopenTime = 'Monday at 12:01 AM PST';
      } else if (day === 0) {
        reopenTime = 'Monday at 12:01 AM PST';
      } else if (day === 1) {
        reopenTime = 'Monday at 12:01 AM PST';
      }
      
      alert(`🔒 SUBMISSIONS CLOSED\n\nPick submissions are not allowed from Friday 11:59 PM PST through Sunday.\n\nYour picks are now locked for this week.\n\nSubmissions will reopen: ${reopenTime}`);
      return;
    }

    const weekGames = PLAYOFF_WEEKS[currentWeek].games;
    const incompletePredictions = weekGames.some(game => 
      !predictions[game.id]?.team1 || !predictions[game.id]?.team2
    );

    if (incompletePredictions) {
      alert('Please enter scores for all games');
      return;
    }

    // Check for tied scores (not allowed in playoffs)
    const gamesWithTies = weekGames.filter(game => 
      predictions[game.id]?.team1 && 
      predictions[game.id]?.team2 && 
      predictions[game.id].team1 === predictions[game.id].team2
    );

    if (gamesWithTies.length > 0) {
      const tiedGames = gamesWithTies.map(g => `Game ${g.id}`).join(', ');
      alert(`NFL playoff games cannot end in a tie!\n\nPlease change your scores for: ${tiedGames}\n\nOne team must win each game.`);
      return;
    }

    const pickData = {
      playerName: playerName.trim(),
      week: currentWeek,
      weekName: PLAYOFF_WEEKS[currentWeek].name,
      predictions: predictions,
      timestamp: Date.now(),
      lastUpdated: Date.now()
    };

    try {
      const picksRef = ref(database, 'picks');
      
      // Check if player already has an entry for this week
      const existingPick = allPicks.find(
        pick => pick.playerName === playerName && pick.week === currentWeek
      );
      
      if (existingPick && existingPick.firebaseKey) {
        // UPDATE existing entry
        const pickRef = ref(database, `picks/${existingPick.firebaseKey}`);
        await set(pickRef, pickData);
        setSubmitted(true);
        alert('✅ PICKS UPDATED SUCCESSFULLY!\n\n' +
              '✓ Your updated picks have been saved\n' +
              '✓ You can see them in the table below\n' +
              '✓ You can edit and resubmit anytime until Friday 11:59 PM PST\n\n' +
              'Your picks are now visible to all players!');
      } else {
        // CREATE new entry
        await push(picksRef, pickData);
        setSubmitted(true);
        alert('✅ PICKS SUBMITTED SUCCESSFULLY!\n\n' +
              '✓ Your picks have been saved\n' +
              '✓ You can see them in the table below\n' +
              '✓ You can edit and resubmit anytime until Friday 11:59 PM PST\n' +
              '✓ Your picks are locked Friday 11:59 PM PST\n\n' +
              'Good luck!');
      }
      
      setTimeout(() => setSubmitted(false), 3000);
    } catch (error) {
      alert('Error submitting picks: ' + error.message);
    }
  };

  const currentWeekData = PLAYOFF_WEEKS[currentWeek];

  return (
    <div className="App">
      <header>
        <h1>🏈 Richard's NFL Playoff Pool 2025</h1>
        <p>Enter your score predictions for each NFL Playoff 2025 game</p>
      </header>

      <div className="container">
        {/* Week Selector */}
        <div className="week-selector">
          <button 
            className={currentWeek === 'wildcard' ? 'active' : ''} 
            onClick={() => setCurrentWeek('wildcard')}
          >
            Wild Card
          </button>
          <button 
            className={currentWeek === 'divisional' ? 'active' : ''} 
            onClick={() => setCurrentWeek('divisional')}
          >
            Divisional
          </button>
          <button 
            className={currentWeek === 'conference' ? 'active' : ''} 
            onClick={() => setCurrentWeek('conference')}
          >
            Conference
          </button>
          <button 
            className={currentWeek === 'superbowl' ? 'active' : ''} 
            onClick={() => setCurrentWeek('superbowl')}
          >
            Super Bowl
          </button>
        </div>

        {/* Prediction Form */}
        <div className="prediction-form">
          <h2>{currentWeekData.name}</h2>
          
          {!isSubmissionAllowed() && (
            <div className="closed-warning">
              ⚠️ SUBMISSIONS CLOSED - Pool reopens Monday 12:01 AM PST
            </div>
          )}
          
          {!codeValidated ? (
            // STEP 1: Code Entry
            <div className="code-entry-section">
              <h3>🔐 Enter Your Player Code</h3>
              <p style={{color: '#666', marginBottom: '20px'}}>
                Enter the 6-digit code you received after paying your $20 entry fee.
              </p>
              
              <div className="code-input-group">
                <label>Player Code:</label>
                <input
                  type="text"
                  value={playerCode}
                  onChange={(e) => setPlayerCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  maxLength="6"
                  className="code-input"
                  autoFocus
                />
                <button 
                  onClick={handleCodeValidation} 
                  className="validate-btn"
                  type="button"
                >
                  Validate Code
                </button>
              </div>
              
              <div style={{marginTop: '20px', padding: '15px', background: '#f8f9fa', borderRadius: '8px', fontSize: '0.9rem', color: '#666'}}>
                <strong>Don't have a code?</strong>
                <br />
                You must pay $20 to receive your player code.
                <br />
                Contact: <strong>biletskifamily@shaw.ca</strong>
              </div>
            </div>
          ) : (
            // STEP 2: Confirmation & Pick Entry
            <>
              <div className="player-confirmed">
                <div className="confirmation-badge">
                  ✓ Code Validated - You're Logged In!
                </div>
                <h3>Playing as: <span className="player-name-highlight">{playerName}</span></h3>
                <button 
                  onClick={() => {
                    setCodeValidated(false);
                    setPlayerCode('');
                    setPlayerName('');
                    setPredictions({});
                  }}
                  style={{
                    marginTop: '10px',
                    padding: '8px 16px',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '0.9rem'
                  }}
                >
                  🔄 Enter Different Code
                </button>
                
                {allPicks.some(pick => pick.playerName === playerName && pick.week === currentWeek) ? (
                  <div style={{color: '#856404', fontWeight: 'bold', marginTop: '15px', background: '#fff3cd', padding: '15px', borderRadius: '8px', border: '2px solid #ffc107'}}>
                    <div style={{fontSize: '1.1rem', marginBottom: '8px'}}>✏️ EDITING YOUR PICKS</div>
                    <div style={{fontSize: '0.95rem', fontWeight: 'normal'}}>
                      Your previous picks have been loaded below. You can change any scores and resubmit as many times as you want until <strong>Friday 11:59 PM PST</strong>.
                    </div>
                  </div>
                ) : (
                  <div style={{color: '#155724', fontWeight: 'bold', marginTop: '15px', background: '#d1ecf1', padding: '15px', borderRadius: '8px', border: '2px solid #17a2b8'}}>
                    <div style={{fontSize: '1.1rem', marginBottom: '8px'}}>📝 ENTER YOUR PICKS</div>
                    <div style={{fontSize: '0.95rem', fontWeight: 'normal'}}>
                      Fill in your predicted final score for each game below. <strong>Away team</strong> is on the left, <strong>Home team</strong> is on the right. You can edit and resubmit until <strong>Friday 11:59 PM PST</strong>.
                    </div>
                  </div>
                )}
                
                <p style={{color: '#666', fontSize: '0.85rem', marginTop: '10px', fontStyle: 'italic'}}>
                  Wrong player? Refresh the page and enter the correct code.
                </p>
              </div>
              
              <form onSubmit={handleSubmit}>
                {currentWeekData.games.map(game => (
                  <div key={game.id} className="game-prediction">
                    <h3>
                      Game {game.id}
                      <span style={{fontSize: '0.85rem', fontWeight: 'normal', color: '#666', marginLeft: '10px'}}>
                        {game.team1} @ {game.team2}
                      </span>
                    </h3>
                    <div className="score-inputs">
                      <div className="team-score">
                        <label>
                          <span className="team-designation">AWAY TEAM</span>
                          <span className="team-name-label">{game.team1}</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="99"
                          value={predictions[game.id]?.team1 || ''}
                          onChange={(e) => handleScoreChange(game.id, 'team1', e.target.value)}
                          placeholder="Score"
                          required
                        />
                      </div>
                      <span className="vs">@</span>
                      <div className="team-score">
                        <label>
                          <span className="team-designation">HOME TEAM</span>
                          <span className="team-name-label">{game.team2}</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="99"
                          value={predictions[game.id]?.team2 || ''}
                          onChange={(e) => handleScoreChange(game.id, 'team2', e.target.value)}
                          placeholder="Score"
                          required
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {/* Progress Indicator */}
                <div className="progress-indicator">
                  <div style={{fontSize: '0.95rem', color: '#666', marginBottom: '5px'}}>
                    <strong>Progress:</strong> {Object.keys(predictions).filter(gameId => 
                      predictions[gameId]?.team1 && predictions[gameId]?.team2
                    ).length} of {currentWeekData.games.length} games completed
                  </div>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{
                        width: `${(Object.keys(predictions).filter(gameId => 
                          predictions[gameId]?.team1 && predictions[gameId]?.team2
                        ).length / currentWeekData.games.length) * 100}%`
                      }}
                    ></div>
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="submit-btn"
                  disabled={!isSubmissionAllowed()}
                  style={!isSubmissionAllowed() ? {
                    backgroundColor: '#ccc',
                    cursor: 'not-allowed'
                  } : {}}
                >
                  {!isSubmissionAllowed() 
                    ? '🔒 Picks Locked Until Monday' 
                    : submitted 
                    ? '✓ Picks Saved Successfully!' 
                    : allPicks.some(pick => pick.playerName === playerName && pick.week === currentWeek)
                    ? '💾 Update My Picks (You Can Edit Anytime Until Friday 11:59 PM PST)'
                    : '✓ Submit My Picks (You Can Edit Later Until Friday 11:59 PM PST)'
                  }
                </button>
                
                {!isSubmissionAllowed() && (
                  <p style={{textAlign: 'center', color: '#d63031', marginTop: '15px', fontWeight: 'bold'}}>
                    Submissions are closed. Your picks for this week are final.
                    <br />
                    Reopens Monday 12:01 AM PST for next round.
                  </p>
                )}
              </form>
            </>
          )}
        </div>

        {/* Display All Picks */}
        <div className="all-picks">
          <h2>All Player Picks - {currentWeekData.name}</h2>
                    <button 
                      onClick={() => {
                        const picksRef = ref(database, 'picks');
                        onValue(picksRef, (snapshot) => {
                          const data = snapshot.val();
                          if (data) {
                            const picksArray = Object.keys(data).map(key => ({
                              ...data[key],
                              firebaseKey: key
                            }));
                            setAllPicks(picksArray);
                          }
                        });
                      }}
                      style={{
                        padding: '10px 20px',
                        background: '#4caf50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        marginBottom: '20px',
                        display: 'block',
                        margin: '0 auto 20px auto'
                      }}
                    >
                      🔄 Refresh Picks Table
                    </button>
          
          {allPicks.filter(pick => pick.week === currentWeek).length === 0 ? (
            <p className="no-picks">No picks submitted yet for this week.</p>
          ) : (
            <div className="picks-table-container">
              <table className="picks-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    {currentWeekData.games.map(game => (
                      <th key={game.id} colSpan="2">
                        Game {game.id}<br/>
                        <small>{game.team1} vs {game.team2}</small>
                      </th>
                    ))}
                    {currentWeek === 'superbowl' ? (
                      <>
                        <th>Week 4<br/><small>Total</small></th>
                        <th>Week 3<br/><small>Total</small></th>
                        <th>Week 2<br/><small>Total</small></th>
                        <th>Week 1<br/><small>Total</small></th>
                        <th style={{background: '#4caf50'}}>GRAND<br/><small>TOTAL</small></th>
                      </>
                    ) : (
                      <th>Total<br/><small>Points</small></th>
                    )}
                    <th>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {allPicks
                    .filter(pick => pick.week === currentWeek)
                    .sort((a, b) => (b.lastUpdated || b.timestamp) - (a.lastUpdated || a.timestamp))
                    .map((pick, idx) => (
                      <tr key={idx}>
                        <td className="player-name">{pick.playerName}</td>
                        {currentWeekData.games.map(game => {
                          const team1Score = pick.predictions[game.id]?.team1;
                          const team2Score = pick.predictions[game.id]?.team2;
                          const team1Wins = team1Score && team2Score && parseInt(team1Score) > parseInt(team2Score);
                          const team2Wins = team1Score && team2Score && parseInt(team2Score) > parseInt(team1Score);
                          
                          return (
                            <React.Fragment key={game.id}>
                              <td className={team1Wins ? "score score-winner" : "score"}>
                                {team1Score ?? '-'}
                              </td>
                              <td className={team2Wins ? "score score-winner" : "score"}>
                                {team2Score ?? '-'}
                              </td>
                            </React.Fragment>
                          );
                        })}
                        {currentWeek === 'superbowl' ? (
                          <>
                            {/* Week 4 Total (Super Bowl) */}
                            <td className="total-points">
                              {(() => {
                                const w4Pick = allPicks.find(p => p.playerName === pick.playerName && p.week === 'superbowl');
                                if (!w4Pick) return <span>0</span>;
                                if (!w4Pick.predictions) return <span>0</span>;
                                let sum = 0;
                                PLAYOFF_WEEKS.superbowl.games.forEach(game => {
                                  const pred = w4Pick.predictions[game.id];
                                  if (pred) sum += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
                                });
                                return <span>{sum}</span>;
                              })()}
                            </td>
                            
                            {/* Week 3 Total (Conference) */}
                            <td className="total-points">
                              {(() => {
                                const w3Pick = allPicks.find(p => p.playerName === pick.playerName && p.week === 'conference');
                                if (!w3Pick) return <span>0</span>;
                                if (!w3Pick.predictions) return <span>0</span>;
                                let sum = 0;
                                PLAYOFF_WEEKS.conference.games.forEach(game => {
                                  const pred = w3Pick.predictions[game.id];
                                  if (pred) sum += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
                                });
                                return <span>{sum}</span>;
                              })()}
                            </td>
                            
                            {/* Week 2 Total (Divisional) */}
                            <td className="total-points">
                              {(() => {
                                const w2Pick = allPicks.find(p => p.playerName === pick.playerName && p.week === 'divisional');
                                if (!w2Pick) return <span>0</span>;
                                if (!w2Pick.predictions) return <span>0</span>;
                                let sum = 0;
                                PLAYOFF_WEEKS.divisional.games.forEach(game => {
                                  const pred = w2Pick.predictions[game.id];
                                  if (pred) sum += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
                                });
                                return <span>{sum}</span>;
                              })()}
                            </td>
                            
                            {/* Week 1 Total (Wild Card) */}
                            <td className="total-points">
                              {(() => {
                                const w1Pick = allPicks.find(p => p.playerName === pick.playerName && p.week === 'wildcard');
                                if (!w1Pick) return <span>0</span>;
                                if (!w1Pick.predictions) return <span>0</span>;
                                let sum = 0;
                                PLAYOFF_WEEKS.wildcard.games.forEach(game => {
                                  const pred = w1Pick.predictions[game.id];
                                  if (pred) sum += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
                                });
                                return <span>{sum}</span>;
                              })()}
                            </td>
                            
                            {/* GRAND TOTAL (All 4 Weeks) */}
                            <td className="grand-total">
                              {(() => {
                                const w4Pick = allPicks.find(p => p.playerName === pick.playerName && p.week === 'superbowl');
                                const w3Pick = allPicks.find(p => p.playerName === pick.playerName && p.week === 'conference');
                                const w2Pick = allPicks.find(p => p.playerName === pick.playerName && p.week === 'divisional');
                                const w1Pick = allPicks.find(p => p.playerName === pick.playerName && p.week === 'wildcard');
                                
                                let week4Total = 0;
                                if (w4Pick && w4Pick.predictions) {
                                  PLAYOFF_WEEKS.superbowl.games.forEach(game => {
                                    const pred = w4Pick.predictions[game.id];
                                    if (pred) week4Total += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
                                  });
                                }
                                
                                let week3Total = 0;
                                if (w3Pick && w3Pick.predictions) {
                                  PLAYOFF_WEEKS.conference.games.forEach(game => {
                                    const pred = w3Pick.predictions[game.id];
                                    if (pred) week3Total += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
                                  });
                                }
                                
                                let week2Total = 0;
                                if (w2Pick && w2Pick.predictions) {
                                  PLAYOFF_WEEKS.divisional.games.forEach(game => {
                                    const pred = w2Pick.predictions[game.id];
                                    if (pred) week2Total += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
                                  });
                                }
                                
                                let week1Total = 0;
                                if (w1Pick && w1Pick.predictions) {
                                  PLAYOFF_WEEKS.wildcard.games.forEach(game => {
                                    const pred = w1Pick.predictions[game.id];
                                    if (pred) week1Total += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
                                  });
                                }
                                
                                return <span>{week4Total + week3Total + week2Total + week1Total}</span>;
                              })()}
                            </td>
                          </>
                        ) : (
                          <td className="total-points">
                            {(() => {
                              const weekPick = allPicks.find(p => p.playerName === pick.playerName && p.week === currentWeek);
                              if (!weekPick) return <span>0</span>;
                              if (!weekPick.predictions) return <span>0</span>;
                              let sum = 0;
                              PLAYOFF_WEEKS[currentWeek].games.forEach(game => {
                                const pred = weekPick.predictions[game.id];
                                if (pred) sum += (Number(pred.team1) || 0) + (Number(pred.team2) || 0);
                              });
                              return <span>{sum}</span>;
                            })()}
                          </td>
                        )}
                        <td className="timestamp">
                          {new Date(pick.lastUpdated || pick.timestamp).toLocaleString('en-US', {
                            month: '2-digit',
                            day: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: true,
                            timeZoneName: 'short'
                          })}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
                    
                    <button 
                      onClick={downloadPicksAsCSV}
                      style={{
                        marginTop: '20px',
                        padding: '12px 24px',
                        background: '#4caf50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: '600',
                        display: 'block',
                        margin: '20px auto 0 auto',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                      }}
                    >
                      📥 Download Picks to Excel
                    </button>
                  </div>
                )}
              </div>
            </div>

      <footer>
        <p>NFL Playoff Pool 2025 • Updates in real-time</p>
      </footer>
    </div>
  );
}

export default App;