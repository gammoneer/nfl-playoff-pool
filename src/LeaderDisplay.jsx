// ============================================
// LEADER DISPLAY COMPONENT - FINAL VERSION
// Shows ALL tied leaders + ALL players
// Black text on yellow backgrounds
// Official winner badge ONLY when Pool Manager declares
// ============================================

import React, { useState, useEffect } from 'react';
import './LeaderDisplay.css';

const PRIZE_INFO = {
  1: { name: 'Most Correct Winners', week: 'wildcard', weekName: 'Week 1' },
  2: { name: 'Closest Total Points', week: 'wildcard', weekName: 'Week 1' },
  3: { name: 'Most Correct Winners', week: 'divisional', weekName: 'Week 2' },
  4: { name: 'Closest Total Points', week: 'divisional', weekName: 'Week 2' },
  5: { name: 'Most Correct Winners', week: 'conference', weekName: 'Week 3' },
  6: { name: 'Closest Total Points', week: 'conference', weekName: 'Week 3' },
  7: { name: 'Most Correct Winners', week: 'superbowl', weekName: 'Week 4' },
  8: { name: 'Closest Total Points', week: 'superbowl', weekName: 'Week 4' },
  9: { name: 'Overall Most Correct Winners', week: 'all', weekName: 'All Weeks' },
  10: { name: 'Overall Closest Total Points', week: 'all', weekName: 'All Weeks' }
};

/**
 * Calculate game status for a prize
 * Returns: { status: 'NOT_STARTED' | 'LIVE' | 'COMPLETE', gamesCompleted, totalGames, message }
 */
function calculateGameStatus(prizeInfo, actualScores, weekData) {
  if (prizeInfo.week === 'all') {
    // Overall prize - check all weeks
    let totalGames = 0;
    let gamesCompleted = 0;
    
    Object.keys(weekData).forEach(weekKey => {
      const weekGames = weekData[weekKey].games;
      totalGames += weekGames.length;
      
      weekGames.forEach(game => {
        const score = actualScores[weekKey]?.[game.id];
        if (score && (score.team1 !== undefined || score.team2 !== undefined)) {
          gamesCompleted++;
        }
      });
    });
    
    if (gamesCompleted === 0) {
      return {
        status: 'NOT_STARTED',
        gamesCompleted: 0,
        totalGames,
        message: 'First game Saturday, January 11, 2026! Standings will update as games finish.'
      };
    } else if (gamesCompleted < totalGames) {
      return {
        status: 'LIVE',
        gamesCompleted,
        totalGames,
        message: `LIVE NOW! ${gamesCompleted} of ${totalGames} playoff games completed. Standings updating in real-time!`
      };
    } else {
      return {
        status: 'COMPLETE',
        gamesCompleted,
        totalGames,
        message: 'Playoffs complete! Final standings shown above.'
      };
    }
  } else {
    // Single week prize
    const weekGames = weekData[prizeInfo.week]?.games || [];
    const totalGames = weekGames.length;
    let gamesCompleted = 0;
    
    weekGames.forEach(game => {
      const score = actualScores[prizeInfo.week]?.[game.id];
      if (score && (score.team1 !== undefined || score.team2 !== undefined)) {
        gamesCompleted++;
      }
    });
    
    if (gamesCompleted === 0) {
      return {
        status: 'NOT_STARTED',
        gamesCompleted: 0,
        totalGames,
        message: 'Games not started yet. Standings will update as games finish!'
      };
    } else if (gamesCompleted < totalGames) {
      return {
        status: 'LIVE',
        gamesCompleted,
        totalGames,
        message: `LIVE NOW! ${gamesCompleted} of ${totalGames} games completed. Standings changing in real-time!`
      };
    } else {
      return {
        status: 'COMPLETE',
        gamesCompleted,
        totalGames,
        message: 'All games complete! Final standings shown above.'
      };
    }
  }
}

/**
 * Calculate leaders for a specific prize
 */
function calculatePrizeLeaders(prizeNumber, allPicks, actualScores, weekData) {
  const prizeInfo = PRIZE_INFO[prizeNumber];
  const isCorrectWinners = [1, 3, 5, 7, 9].includes(prizeNumber);
  
  // Get picks for the specific week(s)
  let relevantPicks = [];
  let relevantScores = {};
  let games = [];
  
  if (prizeInfo.week === 'all') {
    // Overall prizes - GROUP by playerCode and combine all weeks
    relevantPicks = allPicks;
    relevantScores = actualScores;
    // Combine all games
    Object.keys(weekData).forEach(weekKey => {
      games = games.concat(weekData[weekKey].games.map(g => ({...g, week: weekKey})));
    });
    
    // GROUP picks by playerCode for overall prizes
    // This ensures ONE entry per player combining all their weeks
    const playerMap = {};
    relevantPicks.forEach(pick => {
      if (!playerMap[pick.playerCode]) {
        playerMap[pick.playerCode] = {
          playerCode: pick.playerCode,
          playerName: pick.playerName,
          weeklyPicks: []
        };
      }
      playerMap[pick.playerCode].weeklyPicks.push(pick);
    });
    
    // Convert back to array format but keeping weekly picks grouped
    relevantPicks = Object.values(playerMap);
  } else {
    // Single week prize
    relevantPicks = allPicks.filter(p => p.week === prizeInfo.week);
    relevantScores = actualScores[prizeInfo.week] || {};
    games = weekData[prizeInfo.week]?.games || [];
  }
  
  if (relevantPicks.length === 0) {
    return { leaders: [], allPlayers: [], hasTie: false, tieCount: 0 };
  }
  
  if (isCorrectWinners) {
    // Calculate Most Correct Winners
    const results = relevantPicks.map(pick => {
      let correctCount = 0;
      
      // For overall prizes, pick has weeklyPicks array
      // For single week prizes, pick is the direct pick object
      const picksToCheck = pick.weeklyPicks || [pick];
      
      picksToCheck.forEach(weekPick => {
        games.forEach(game => {
          const playerPrediction = weekPick.predictions?.[game.id];
          const actualScore = prizeInfo.week === 'all' 
            ? actualScores[game.week]?.[game.id]
            : relevantScores[game.id];
          
          if (!playerPrediction || !actualScore) return;
          
          const playerWinner = parseInt(playerPrediction.team1) > parseInt(playerPrediction.team2) ? 'team1' : 'team2';
          const actualWinner = parseInt(actualScore.team1) > parseInt(actualScore.team2) ? 'team1' : 'team2';
          
          if (playerWinner === actualWinner) {
            correctCount++;
          }
        });
      });
      
      return {
        playerCode: pick.playerCode,
        playerName: pick.playerName,
        score: correctCount
      };
    });
    
    // Sort by correct count (highest first)
    results.sort((a, b) => b.score - a.score);
    
    const topScore = results[0]?.score || 0;
    const tiedLeaders = results.filter(r => r.score === topScore);
    
    return {
      leaders: tiedLeaders,
      allPlayers: results,
      hasTie: tiedLeaders.length > 1,
      tieCount: tiedLeaders.length
    };
    
  } else {
    // Calculate Closest Total Points
    let actualTotal = 0;
    
    games.forEach(game => {
      const score = prizeInfo.week === 'all'
        ? actualScores[game.week]?.[game.id]
        : relevantScores[game.id];
      
      if (score) {
        actualTotal += (parseInt(score.team1) || 0) + (parseInt(score.team2) || 0);
      }
    });
    
    const results = relevantPicks.map(pick => {
      let playerTotal = 0;
      
      // For overall prizes, pick has weeklyPicks array
      // For single week prizes, pick is the direct pick object
      const picksToCheck = pick.weeklyPicks || [pick];
      
      picksToCheck.forEach(weekPick => {
        games.forEach(game => {
          const prediction = weekPick.predictions?.[game.id];
          if (prediction) {
            playerTotal += (parseInt(prediction.team1) || 0) + (parseInt(prediction.team2) || 0);
          }
        });
      });
      
      const difference = Math.abs(playerTotal - actualTotal);
      
      return {
        playerCode: pick.playerCode,
        playerName: pick.playerName,
        score: playerTotal,
        actualTotal,
        difference
      };
    });
    
    // Sort by smallest difference
    results.sort((a, b) => a.difference - b.difference);
    
    const topDifference = results[0]?.difference || 0;
    const tiedLeaders = results.filter(r => r.difference === topDifference);
    
    return {
      leaders: tiedLeaders,
      allPlayers: results,
      hasTie: tiedLeaders.length > 1,
      tieCount: tiedLeaders.length,
      actualTotal
    };
  }
}

/**
 * Single Prize Leader Card
 */
function PrizeLeaderCard({ 
  prizeNumber, 
  allPicks, 
  actualScores, 
  weekData,
  officialWinner = null
}) {
  const [leaderData, setLeaderData] = useState(null);
  const [loading, setLoading] = useState(true);

  const prizeInfo = PRIZE_INFO[prizeNumber];
  const isCorrectWinners = [1, 3, 5, 7, 9].includes(prizeNumber);

  useEffect(() => {
    try {
      const data = calculatePrizeLeaders(prizeNumber, allPicks, actualScores, weekData);
      setLeaderData(data);
      setLoading(false);
    } catch (error) {
      console.error(`Error calculating leaders for Prize ${prizeNumber}:`, error);
      setLoading(false);
    }
  }, [prizeNumber, allPicks, actualScores, weekData]);

  if (loading) {
    return (
      <div className="leader-card loading">
        <div className="leader-card-header">
          <h3>Prize #{prizeNumber} - {prizeInfo.name}</h3>
        </div>
        <div className="leader-card-body">
          <p>Calculating leaders...</p>
        </div>
      </div>
    );
  }

  if (!leaderData || leaderData.allPlayers.length === 0) {
    return (
      <div className="leader-card no-data">
        <div className="leader-card-header">
          <h3>Prize #{prizeNumber} - {prizeInfo.name}</h3>
          <span className="prize-week">{prizeInfo.weekName}</span>
        </div>
        <div className="leader-card-body">
          <p>No picks available yet.</p>
        </div>
      </div>
    );
  }

  const { leaders, allPlayers, hasTie, tieCount } = leaderData;
  
  // Calculate game status for this prize
  const gameStatus = calculateGameStatus(prizeInfo, actualScores, weekData);

  return (
    <div className={`leader-card ${hasTie ? 'has-tie' : ''}`}>
      <div className="leader-card-header">
        <h3>Prize #{prizeNumber} - {prizeInfo.name}</h3>
        <span className="prize-week">{prizeInfo.weekName}</span>
      </div>
      
      <div className="leader-card-body">
        {/* Game Status Indicator */}
        <div className={`game-status ${gameStatus.status.toLowerCase()}`}>
          <div className="status-badge">
            {gameStatus.status === 'NOT_STARTED' && '⏳ NOT STARTED'}
            {gameStatus.status === 'LIVE' && '🔴 LIVE'}
            {gameStatus.status === 'COMPLETE' && '✅ COMPLETE'}
          </div>
          <div className="status-details">
            {gameStatus.status !== 'NOT_STARTED' && (
              <span className="games-count">
                {gameStatus.gamesCompleted} of {gameStatus.totalGames} games
              </span>
            )}
          </div>
          <p className="status-message">{gameStatus.message}</p>
        </div>
        
        {/* Show tie warning with BLACK text on yellow */}
        {hasTie && (
          <div className="tie-warning">
            ⚠️ {tieCount}-WAY TIE FOR 1ST PLACE!
          </div>
        )}
        
        {/* Show ALL tied leaders */}
        {hasTie && (
          <div className="tied-leaders-section">
            <h4>🏆 TIED FOR 1ST PLACE:</h4>
            <div className="leaders-list">
              {leaders.map((leader, idx) => (
                <div 
                  key={idx} 
                  className={`leader-item ${officialWinner?.playerCode === leader.playerCode ? 'official-winner' : 'tied-leader'}`}
                >
                  <span className="leader-rank">{idx + 1}.</span>
                  <span className="leader-name">{leader.playerName}</span>
                  <span className="leader-score">
                    {isCorrectWinners 
                      ? `${leader.score} correct`
                      : `${leader.score} pts · Actual: ${leaderData?.actualTotal || 0} pts · Off by: ${leader.difference} pts`
                    }
                  </span>
                  {/* Show ONLY ONE badge - OFFICIAL WINNER if declared, otherwise LEADING */}
                  {officialWinner?.playerCode === leader.playerCode ? (
                    <span className="official-badge">👑 OFFICIAL WINNER</span>
                  ) : (
                    <span className="leading-badge">🏆 LEADING</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Show next 5-10 non-tied players after tied leaders */}
        {hasTie && allPlayers.length > tieCount && (
          <div className="next-in-line-section">
            <h4>📊 NEXT IN LINE:</h4>
            <div className="leaders-list">
              {allPlayers.slice(tieCount, tieCount + 10).map((player, idx) => (
                <div key={idx} className="leader-item">
                  <span className="leader-rank">{tieCount + idx + 1}.</span>
                  <span className="leader-name">{player.playerName}</span>
                  <span className="leader-score">
                    {isCorrectWinners 
                      ? `${player.score} correct`
                      : `${player.score} pts · Actual: ${leaderData?.actualTotal || 0} pts · Off by: ${player.difference} pts`
                    }
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Show ALL players if no tie (clear leader) */}
        {!hasTie && (
          <div className="all-players-section">
            <h4>📊 ALL PLAYERS RANKED:</h4>
            <div className="leaders-list">
              {allPlayers.map((player, idx) => (
                <div 
                  key={idx} 
                  className={`leader-item ${idx === 0 && officialWinner?.playerCode === player.playerCode ? 'official-winner' : ''}`}
                >
                  <span className="leader-rank">{idx + 1}.</span>
                  <span className="leader-name">{player.playerName}</span>
                  <span className="leader-score">
                    {isCorrectWinners 
                      ? `${player.score} correct`
                      : `${player.score} pts · Actual: ${leaderData?.actualTotal || 0} pts · Off by: ${player.difference} pts`
                    }
                  </span>
                  {/* Show badge for 1st place only - OFFICIAL WINNER if declared, otherwise LEADING */}
                  {idx === 0 && (
                    officialWinner?.playerCode === player.playerCode ? (
                      <span className="official-badge">👑 OFFICIAL WINNER</span>
                    ) : (
                      <span className="leading-badge">🏆 LEADING</span>
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Show official winner status */}
        {!officialWinner && (
          <div className="no-official-winner">
            <em>No official winner declared yet</em>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Main Leader Display Component
 */
function LeaderDisplay({ allPicks, actualScores, games, officialWinners, weekData }) {
  return (
    <div className="leaders-section">
      <h2>🏆 Prize Leaders</h2>
      <p className="leaders-description">
        Current standings for all 10 prizes. Winners will be officially announced by the Pool Manager.
      </p>
      
      <div className="prize-grid">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(prizeNum => (
          <PrizeLeaderCard
            key={prizeNum}
            prizeNumber={prizeNum}
            allPicks={allPicks}
            actualScores={actualScores}
            weekData={weekData}
            officialWinner={officialWinners?.[prizeNum]}
          />
        ))}
      </div>
    </div>
  );
}

export default LeaderDisplay;
