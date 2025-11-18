import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, push, onValue } from 'firebase/database';
import './App.css';

// Firebase configuration - USER WILL NEED TO REPLACE THESE
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

// Player codes system - Code maps to player name AUTHORIZED_PLAYERS AS NOTED BELOW
// Pool Manager: Add entries as players pay
// Format: "code": "First Name Last Name"
const PLAYER_CODES = {
  "1000": "John Smith",
  "1001": "Jane Doe",
  "1002": "Mike Johnson",
  "1003": "Sarah Williams",
  "1004": "David Brown",
  "9904": "Neema Dadmand"
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
  const [playerCode, setPlayerCode] = useState(''); // NEW
  const [codeValidated, setCodeValidated] = useState(false); // NEW
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
        const picksArray = Object.values(data);
        setAllPicks(picksArray);
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
      alert('Please enter your 4-digit player code');
      return;
    }
    
    if (code.length !== 4 || !/^\d{4}$/.test(code)) {
      alert('Invalid code format!\n\nPlayer codes must be exactly 4 digits.\nExample: 1234');
      return;
    }
    
    const playerNameForCode = PLAYER_CODES[code];
    
    if (!playerNameForCode) {
      alert('Invalid player code!\n\nThis code is not recognized.\n\nMake sure you:\n1. Paid your $20 entry fee\n2. Received your code from the pool manager\n3. Entered the code correctly\n\nContact: biletskifamily@shaw.ca');
      return;
    }
    
    // Check if this player already submitted for this week
    const alreadySubmitted = allPicks.some(
      pick => pick.playerName === playerNameForCode && pick.week === currentWeek
    );
    
    if (alreadySubmitted) {
      alert(`This player has already submitted picks for this week!\n\nPlayer: ${playerNameForCode}\nWeek: ${PLAYOFF_WEEKS[currentWeek].name}\n\nOnly ONE submission per player is allowed.`);
      return;
    }
    
    // Code is valid!
    setPlayerName(playerNameForCode);
    setCodeValidated(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!playerName.trim()) {
      alert('Please enter your name');
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
    
    alert(`🔒 SUBMISSIONS CLOSED\n\nPick submissions are not allowed from Friday 11:59 PM PST through Sunday.\n\nSubmissions will reopen: ${reopenTime}\n\nPlease submit your picks during the week.`);
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
      timestamp: Date.now()
    };

    try {
      const picksRef = ref(database, 'picks');
      await push(picksRef, pickData);
      setSubmitted(true);
      alert('Picks submitted successfully!');
      
      // Reset form
      setPredictions({});
      setPlayerName('');
      setTimeout(() => setSubmitted(false), 3000);
    } catch (error) {
      alert('Error submitting picks: ' + error.message);
    }
  };

  const currentWeekData = PLAYOFF_WEEKS[currentWeek];

  return (
    <div className="App">
      <header>
        <h1>🏈 NFL Playoff Pool 2025</h1>
        <p>Enter your score predictions for each game</p>
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
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Your Name:</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                required
              />
            </div>

            {currentWeekData.games.map(game => (
              <div key={game.id} className="game-prediction">
                <h3>Game {game.id}</h3>
                <div className="score-inputs">
                  <div className="team-score">
                    <label>{game.team1}</label>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={predictions[game.id]?.team1 || ''}
                      onChange={(e) => handleScoreChange(game.id, 'team1', e.target.value)}
                      required
                    />
                  </div>
                  <span className="vs">vs</span>
                  <div className="team-score">
                    <label>{game.team2}</label>
                    <input
                      type="number"
                      min="0"
                      max="99"
                      value={predictions[game.id]?.team2 || ''}
                      onChange={(e) => handleScoreChange(game.id, 'team2', e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>
            ))}

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
                ? '🔒 Closed - Reopens Monday' 
                : submitted 
                ? '✓ Submitted!' 
                : 'Submit Picks'
              }
            </button>
          </form>
        </div>

        {/* Display All Picks */}
        <div className="all-picks">
          <h2>All Player Picks - {currentWeekData.name}</h2>
          
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
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {allPicks
                    .filter(pick => pick.week === currentWeek)
                    .sort((a, b) => a.timestamp - b.timestamp)
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
                        <td className="timestamp">
                          {new Date(pick.timestamp).toLocaleString('en-US', {
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
