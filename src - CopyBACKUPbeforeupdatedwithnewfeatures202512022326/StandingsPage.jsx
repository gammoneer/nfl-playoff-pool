import React, { useMemo } from 'react';
import './StandingsPage.css';

// Import scoring functions (we'll integrate these)
// For now, we'll include the logic directly

function StandingsPage({ allPicks, actualScores, currentWeek, playerName, playerCode, isPoolManager, onLogout }) {
  
  // ============================================
  // SCORING CALCULATION FUNCTIONS
  // ============================================
  
  /**
   * Calculate how many games a player predicted the winner correctly
   */
  const calculateCorrectWinners = (playerPicks, actualScores, week) => {
    if (!playerPicks || !actualScores || !actualScores[week]) {
      return 0;
    }

    let correctCount = 0;
    const weekScores = actualScores[week];

    Object.keys(playerPicks).forEach(gameId => {
      const prediction = playerPicks[gameId];
      const actual = weekScores[gameId];

      if (!prediction || !actual) return;

      const predTeam1 = parseInt(prediction.team1);
      const predTeam2 = parseInt(prediction.team2);
      const actualTeam1 = parseInt(actual.team1);
      const actualTeam2 = parseInt(actual.team2);

      if (isNaN(predTeam1) || isNaN(predTeam2) || isNaN(actualTeam1) || isNaN(actualTeam2)) {
        return;
      }

      // Determine winners
      const predWinner = predTeam1 > predTeam2 ? 'team1' : predTeam2 > predTeam1 ? 'team2' : 'tie';
      const actualWinner = actualTeam1 > actualTeam2 ? 'team1' : actualTeam2 > actualTeam1 ? 'team2' : 'tie';

      if (predWinner === actualWinner && actualWinner !== 'tie') {
        correctCount++;
      }
    });

    return correctCount;
  };

  /**
   * Calculate absolute difference between predicted and actual total points
   */
  const calculatePointsDifference = (playerPicks, actualScores, week) => {
    if (!playerPicks || !actualScores || !actualScores[week]) {
      return null;
    }

    let predictedTotal = 0;
    let actualTotal = 0;
    const weekScores = actualScores[week];

    Object.keys(playerPicks).forEach(gameId => {
      const prediction = playerPicks[gameId];
      const actual = weekScores[gameId];

      if (!prediction || !actual) return;

      const predTeam1 = parseInt(prediction.team1);
      const predTeam2 = parseInt(prediction.team2);
      const actualTeam1 = parseInt(actual.team1);
      const actualTeam2 = parseInt(actual.team2);

      if (isNaN(predTeam1) || isNaN(predTeam2) || isNaN(actualTeam1) || isNaN(actualTeam2)) {
        return;
      }

      predictedTotal += predTeam1 + predTeam2;
      actualTotal += actualTeam1 + actualTeam2;
    });

    return Math.abs(predictedTotal - actualTotal);
  };

  /**
   * Calculate cumulative stats across multiple weeks
   */
  const calculateCumulativeStats = (playerPicks, actualScores, weeks) => {
    let totalCorrectWinners = 0;
    let totalPointsDifference = 0;

    weeks.forEach(week => {
      const weekPick = playerPicks[week];
      if (weekPick) {
        totalCorrectWinners += calculateCorrectWinners(weekPick, actualScores, week);
        const weekDiff = calculatePointsDifference(weekPick, actualScores, week);
        if (weekDiff !== null) {
          totalPointsDifference += weekDiff;
        }
      }
    });

    return {
      correctWinners: totalCorrectWinners,
      pointsDifference: totalPointsDifference
    };
  };

  // ============================================
  // PROCESS DATA FOR STANDINGS
  // ============================================

  const weekMapping = {
    'wildcard': 'Week 1',
    'divisional': 'Week 2',
    'conference': 'Week 3',
    'superbowl': 'Week 4'
  };

  // Group picks by player
  const playerData = useMemo(() => {
    const players = {};

    allPicks.forEach(pick => {
      const playerName = pick.playerName;
      if (!players[playerName]) {
        players[playerName] = {
          wildcard: null,
          divisional: null,
          conference: null,
          superbowl: null
        };
      }
      players[playerName][pick.week] = pick.predictions;
    });

    return players;
  }, [allPicks]);

  // ============================================
  // CALCULATE PRIZE LEADERS
  // ============================================

  const prizeLeaders = useMemo(() => {
    const prizes = [];

    const weeks = ['wildcard', 'divisional', 'conference', 'superbowl'];

    // Prizes 1-6: Weekly prizes
    weeks.slice(0, 3).forEach((week, weekIndex) => {
      const weekName = weekMapping[week];
      
      // Most Correct Winners
      const correctWinnersData = Object.entries(playerData)
        .map(([playerName, picks]) => ({
          playerName,
          score: calculateCorrectWinners(picks[week], actualScores, week)
        }))
        .filter(p => p.score > 0)
        .sort((a, b) => b.score - a.score);

      prizes.push({
        prizeNumber: weekIndex * 2 + 1,
        name: `${weekName} - Most Correct Winners`,
        week: week,
        type: 'correctWinners',
        leaders: correctWinnersData.slice(0, 5) // Top 5
      });

      // Closest Total Points
      const pointsData = Object.entries(playerData)
        .map(([playerName, picks]) => ({
          playerName,
          score: calculatePointsDifference(picks[week], actualScores, week)
        }))
        .filter(p => p.score !== null)
        .sort((a, b) => a.score - b.score);

      prizes.push({
        prizeNumber: weekIndex * 2 + 2,
        name: `${weekName} - Closest Total Points`,
        week: week,
        type: 'pointsDifference',
        leaders: pointsData.slice(0, 5) // Top 5
      });
    });

    // Week 4 (Super Bowl) - 4 prizes
    const superBowlWeek = 'superbowl';
    
    // Prize 7: Week 4 Most Correct Winners
    const sb7Data = Object.entries(playerData)
      .map(([playerName, picks]) => ({
        playerName,
        score: calculateCorrectWinners(picks[superBowlWeek], actualScores, superBowlWeek)
      }))
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score);

    prizes.push({
      prizeNumber: 7,
      name: 'Week 4 - Most Correct Winners',
      week: superBowlWeek,
      type: 'correctWinners',
      leaders: sb7Data.slice(0, 5)
    });

    // Prize 8: Week 4 Closest Total Points
    const sb8Data = Object.entries(playerData)
      .map(([playerName, picks]) => ({
        playerName,
        score: calculatePointsDifference(picks[superBowlWeek], actualScores, superBowlWeek)
      }))
      .filter(p => p.score !== null)
      .sort((a, b) => a.score - b.score);

    prizes.push({
      prizeNumber: 8,
      name: 'Week 4 - Closest Total Points',
      week: superBowlWeek,
      type: 'pointsDifference',
      leaders: sb8Data.slice(0, 5)
    });

    // Prize 9: Cumulative Most Correct Winners (All 4 Weeks)
    const cumulativeWinnersData = Object.entries(playerData)
      .map(([playerName, picks]) => {
        const stats = calculateCumulativeStats(picks, actualScores, weeks);
        return {
          playerName,
          score: stats.correctWinners
        };
      })
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score);

    prizes.push({
      prizeNumber: 9,
      name: 'Cumulative (All 4 Weeks) - Most Correct Winners',
      week: 'all',
      type: 'correctWinners',
      leaders: cumulativeWinnersData.slice(0, 5)
    });

    // Prize 10: Cumulative Closest Total Points (All 4 Weeks)
    const cumulativePointsData = Object.entries(playerData)
      .map(([playerName, picks]) => {
        const stats = calculateCumulativeStats(picks, actualScores, weeks);
        return {
          playerName,
          score: stats.pointsDifference
        };
      })
      .filter(p => p.score !== null && p.score >= 0)
      .sort((a, b) => a.score - b.score);

    prizes.push({
      prizeNumber: 10,
      name: 'Cumulative (All 4 Weeks) - Closest Total Points',
      week: 'all',
      type: 'pointsDifference',
      leaders: cumulativePointsData.slice(0, 5)
    });

    return prizes;
  }, [playerData, actualScores]);

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className="standings-page">
      <div className="container">
        {/* Player Info and Logout Button */}
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '20px',
          color: 'white'
        }}>
          <div style={{fontSize: '0.9rem', marginBottom: '5px'}}>
            ✓ VERIFIED
          </div>
          <div style={{fontSize: '1.2rem', fontWeight: 'bold', marginBottom: '5px'}}>
            Viewing as: {playerName}
          </div>
          {isPoolManager && (
            <div style={{
              fontSize: '0.9rem',
              marginBottom: '10px',
              color: '#ffd700',
              fontWeight: '600'
            }}>
              👑 POOL MANAGER
            </div>
          )}
          <button 
            onClick={onLogout}
            style={{
              background: 'white',
              color: '#764ba2',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              fontSize: '0.95rem',
              fontWeight: '600',
              cursor: 'pointer',
              marginTop: '10px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}
          >
            🚪 Logout / Switch Entry
          </button>
          <p style={{
            fontSize: '0.85rem',
            marginTop: '10px',
            opacity: 0.9,
            fontStyle: 'italic'
          }}>
            💡 Playing with multiple entries? Logout to switch between your codes.
          </p>
        </div>

        <h1 className="standings-title">🏆 Standings & Prize Leaders</h1>
        
        <div className="prizes-grid">
          {prizeLeaders.map(prize => (
            <div key={prize.prizeNumber} className="prize-card">
              <div className="prize-header">
                <div className="prize-number">Prize #{prize.prizeNumber}</div>
                <div className="prize-name">{prize.name}</div>
              </div>
              
              <div className="prize-leaders">
                {prize.leaders.length === 0 ? (
                  <div className="no-data">No data available yet</div>
                ) : (
                  <table className="leaders-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Player</th>
                        <th>{prize.type === 'correctWinners' ? 'Correct' : 'Difference'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prize.leaders.map((leader, idx) => {
                        // Determine if tied with previous
                        const isTied = idx > 0 && leader.score === prize.leaders[idx - 1].score;
                        const displayRank = isTied ? '=' : idx + 1;
                        
                        return (
                          <tr key={idx} className={idx === 0 && !isTied ? 'leader-first' : ''}>
                            <td className="rank">{displayRank}</td>
                            <td className="player-name">{leader.playerName}</td>
                            <td className="score">
                              {prize.type === 'correctWinners' 
                                ? `${leader.score} correct` 
                                : `${leader.score} pts`
                              }
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="standings-note">
          <p><strong>Note:</strong> Tied players are shown with "=" rank. Pool Manager will resolve ties manually using Excel if needed for prize distribution.</p>
        </div>
      </div>
    </div>
  );
}

export default StandingsPage;
