import React, { useMemo, useState } from 'react';
import './StandingsPage.css';

// Import scoring functions (we'll integrate these)
// For now, we'll include the logic directly

function StandingsPage({ allPicks, actualScores, gameStatus, currentWeek, playerName, playerCode, isPoolManager, prizePool, officialWinners, publishedWinners, onLogout }) {
  
  // Track which prize week sections are expanded
  const [expandedPrizeWeeks, setExpandedPrizeWeeks] = useState({
    'Week 1': true,  // Default: Week 1 open
    'Week 2': false,
    'Week 3': false,
    'Week 4': false,
    'Grand Prizes': false
  });

  // Toggle a specific prize week section
  const togglePrizeWeek = (weekKey) => {
    setExpandedPrizeWeeks(prev => ({
      ...prev,
      [weekKey]: !prev[weekKey]
    }));
  };

  // Expand all prize weeks
  const expandAllPrizeWeeks = () => {
    setExpandedPrizeWeeks({
      'Week 1': true,
      'Week 2': true,
      'Week 3': true,
      'Week 4': true,
      'Grand Prizes': true
    });
  };

  // Collapse all prize weeks
  const collapseAllPrizeWeeks = () => {
    setExpandedPrizeWeeks({
      'Week 1': false,
      'Week 2': false,
      'Week 3': false,
      'Week 4': false,
      'Grand Prizes': false
    });
  };
  
  // ============================================
  // CONVERT NEW WINNER FORMAT TO OLD FORMAT
  // ============================================
  const convertedWinners = useMemo(() => {
    if (!officialWinners || Object.keys(officialWinners).length === 0) {
      return {};
    }

    // Check if it's already in old format
    const firstKey = Object.keys(officialWinners)[0];
    if (firstKey.startsWith('prize')) {
      return officialWinners;
    }

    // New format - convert
    const converted = {};
    const prizeNames = {
      1: 'Prize #1 - Week 1 Most Correct Predictions',
      2: 'Prize #2 - Week 1 Closest Total Points',
      3: 'Prize #3 - Week 2 Most Correct Predictions',
      4: 'Prize #4 - Week 2 Closest Total Points',
      5: 'Prize #5 - Week 3 Most Correct Predictions',
      6: 'Prize #6 - Week 3 Closest Total Points',
      7: 'Prize #7 - Week 4 Most Correct Predictions',
      8: 'Prize #8 - Week 4 Closest Total Points',
      9: 'Prize #9 - Overall 4-Week Grand Total Most Correct Predictions',
      10: 'Prize #10 - Overall 4-Week Grand Total Closest Points'
    };

    Object.values(officialWinners).forEach(weekData => {
      if (weekData.prizes && Array.isArray(weekData.prizes)) {
        weekData.prizes.forEach(prize => {
          const prizeNum = prize.prizeNumber;
          
          let calculatedPrizeValue = 56;
          if (prizePool) {
            if (prizePool.prizeValue) {
              calculatedPrizeValue = prizePool.prizeValue;
            } else if (prizePool.totalFees) {
              calculatedPrizeValue = prizePool.totalFees * 0.1;
            }
          }
          
          converted[`prize${prizeNum}`] = {
            prizeNumber: prizeNum,
            prizeName: prizeNames[prizeNum] || `Prize #${prizeNum}`,
            prizeValue: calculatedPrizeValue,
            winners: prize.winners || [],
            declaredBy: weekData.publishedBy || 'POOL_MANAGER',
            declaredAt: weekData.publishedAt || new Date().toISOString()
          };
        });
      }
    });

    return converted;
  }, [officialWinners, prizePool]);
  
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
  // CHECK IF ALL GAMES ARE FINAL
  // ============================================
  
  /**
   * Check if all games for a specific week are final
   */
  const areAllGamesFinal = (week) => {
    if (!gameStatus || !gameStatus[week]) {
      return false;
    }
    
    const weekStatuses = gameStatus[week];
    const statusValues = Object.values(weekStatuses);
    
    // Return true only if ALL games have status 'final'
    return statusValues.length > 0 && statusValues.every(status => status === 'final');
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
      
      // Most Correct Predictions
      const correctWinnersData = Object.entries(playerData)
        .map(([playerName, picks]) => {
          const correctWinners = calculateCorrectWinners(picks[week], actualScores, week);
          const difference = calculatePointsDifference(picks[week], actualScores, week);
          return {
            playerName,
            score: correctWinners,
            difference: difference !== null ? difference : 9999
          };
        })
        .filter(p => p.score > 0)
        .sort((a, b) => {
          // Sort by correct winners first
          if (a.score !== b.score) {
            return b.score - a.score;
          }
          // If tied, sort by difference (tiebreaker)
          return a.difference - b.difference;
        });

      prizes.push({
        prizeNumber: weekIndex * 2 + 1,
        name: `${weekName} - Most Correct Predictions`,
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
    
    // Prize 7: Week 4 Most Correct Predictions
    const sb7Data = Object.entries(playerData)
      .map(([playerName, picks]) => ({
        playerName,
        score: calculateCorrectWinners(picks[superBowlWeek], actualScores, superBowlWeek)
      }))
      .filter(p => p.score > 0)
      .sort((a, b) => b.score - a.score);

    prizes.push({
      prizeNumber: 7,
      name: 'Week 4 - Most Correct Predictions',
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

    // Prize 9: Cumulative Most Correct Predictions (All 4 Weeks)
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
      name: 'Cumulative (All 4 Weeks) - Most Correct Predictions',
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
            onClick={() => {
              console.log('🚪 STANDINGS: Logout button clicked');
              console.log('🚪 STANDINGS: onLogout function:', onLogout);
              console.log('🚪 STANDINGS: Calling onLogout...');
              onLogout();
              console.log('🚪 STANDINGS: onLogout called');
            }}
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
        
        {/* Prize Pool Information */}
        {prizePool && prizePool.totalFees > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            padding: '25px',
            borderRadius: '12px',
            marginBottom: '30px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{margin: '0 0 20px 0', fontSize: '1.5rem'}}>💰 Prize Pool Information</h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '20px',
              marginBottom: '15px'
            }}>
              <div style={{background: 'rgba(255,255,255,0.2)', padding: '15px', borderRadius: '8px'}}>
                <div style={{fontSize: '0.9rem', opacity: 0.9, marginBottom: '5px'}}>Total Pool Fees</div>
                <div style={{fontSize: '2rem', fontWeight: 'bold'}}>${prizePool.totalFees.toFixed(2)}</div>
              </div>
              <div style={{background: 'rgba(255,255,255,0.2)', padding: '15px', borderRadius: '8px'}}>
                <div style={{fontSize: '0.9rem', opacity: 0.9, marginBottom: '5px'}}>Number of Players</div>
                <div style={{fontSize: '2rem', fontWeight: 'bold'}}>{prizePool.numberOfPlayers}</div>
              </div>
              <div style={{background: 'rgba(255,255,255,0.2)', padding: '15px', borderRadius: '8px'}}>
                <div style={{fontSize: '0.9rem', opacity: 0.9, marginBottom: '5px'}}>Entry Fee</div>
                <div style={{fontSize: '2rem', fontWeight: 'bold'}}>${prizePool.entryFee}</div>
              </div>
              <div style={{background: 'rgba(255,255,255,0.2)', padding: '15px', borderRadius: '8px'}}>
                <div style={{fontSize: '0.9rem', opacity: 0.9, marginBottom: '5px'}}>Each Prize (10%)</div>
                <div style={{fontSize: '2rem', fontWeight: 'bold'}}>${prizePool.prizeValue.toFixed(2)}</div>
              </div>
            </div>
            <div style={{fontSize: '0.9rem', opacity: 0.9}}>
              📊 10 prizes total • Equal 10% distribution • Ties split equally
            </div>
          </div>
        )}
        
        {/* Official Prize Awards - Declared by Pool Manager */}
        {convertedWinners && Object.keys(convertedWinners).length > 0 && (
          <div style={{
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            color: 'white',
            padding: '25px',
            borderRadius: '12px',
            marginBottom: '30px',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{margin: '0 0 5px 0', fontSize: '1.5rem'}}>🏆 OFFICIAL PRIZE AWARDS</h2>
            <div style={{fontSize: '0.9rem', opacity: 0.9, marginBottom: '20px', fontStyle: 'italic'}}>
              Declared by Pool Manager
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '20px'
            }}>
              {Object.entries(convertedWinners).sort((a, b) => {
                return a[1].prizeNumber - b[1].prizeNumber;
              }).map(([key, prize]) => (
                <div key={key} style={{
                  background: 'rgba(255,255,255,0.95)',
                  color: '#333',
                  padding: '20px',
                  borderRadius: '10px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}>
                  <div style={{
                    fontWeight: 'bold',
                    fontSize: '1.1rem',
                    marginBottom: '8px',
                    color: '#f5576c'
                  }}>
                    Prize #{prize.prizeNumber}
                  </div>
                  <div style={{
                    fontSize: '0.9rem',
                    color: '#666',
                    marginBottom: '12px'
                  }}>
                    {prize.prizeName.replace(`Prize #${prize.prizeNumber} - `, '')}
                  </div>
                  <div style={{
                    fontSize: '0.85rem',
                    fontWeight: '600',
                    color: '#999',
                    marginBottom: '12px'
                  }}>
                    Prize Value: ${prize.prizeValue.toFixed(2)}
                  </div>
                  <div style={{
                    borderTop: '2px solid #f093fb',
                    paddingTop: '12px'
                  }}>
                    {prize.winners.map((winner, idx) => (
                      <div key={idx} style={{
                        padding: '8px 0',
                        borderBottom: idx < prize.winners.length - 1 ? '1px solid #eee' : 'none'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px'
                        }}>
                          <div style={{
                            fontWeight: '700',
                            fontSize: '1rem',
                            color: '#333'
                          }}>
                            🏆 {winner.playerName}
                          </div>
                          <div style={{
                            fontSize: '0.95rem',
                            fontWeight: '600',
                            color: '#f5576c'
                          }}>
                            ${winner.amount.toFixed(2)}
                          </div>
                        </div>
                        <div style={{
                          fontSize: '0.8rem',
                          color: '#888',
                          marginTop: '2px'
                        }}>
                          {winner.percentage.toFixed(2)}% of prize
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Educational Banner */}
        <div style={{
          background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
          color: 'white',
          padding: '20px 25px',
          borderRadius: '12px',
          marginBottom: '25px',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          border: '2px solid rgba(255,255,255,0.3)'
        }}>
          <div style={{display: 'flex', alignItems: 'flex-start', gap: '15px'}}>
            <div style={{fontSize: '2rem', lineHeight: '1'}}>💡</div>
            <div style={{flex: 1}}>
              <h3 style={{margin: '0 0 10px 0', fontSize: '1.2rem', fontWeight: '700'}}>
                How Prize Leaders Work
              </h3>
              <div style={{fontSize: '0.95rem', lineHeight: '1.6', opacity: 0.95}}>
                <p style={{margin: '0 0 10px 0'}}>
                  This page shows <strong>current leaders</strong> for each prize category based on games scored so far.
                </p>
                <p style={{margin: '0 0 10px 0'}}>
                  <strong>⚠️ These are NOT final results!</strong> Rankings will change as more games are scored throughout the playoffs.
                </p>
                <p style={{margin: '0'}}>
                  <strong>Official prize awards</strong> will be declared by the Pool Manager after all games are completed and verified.
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Prize Week Controls */}
        <div style={{
          display: 'flex',
          gap: '15px',
          justifyContent: 'center',
          margin: '20px 0'
        }}>
          <button 
            onClick={expandAllPrizeWeeks}
            style={{
              padding: '10px 20px',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = '#5568d3'}
            onMouseOut={(e) => e.target.style.background = '#667eea'}
          >
            ▼ Expand All Weeks
          </button>
          <button 
            onClick={collapseAllPrizeWeeks}
            style={{
              padding: '10px 20px',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.95rem',
              fontWeight: '600',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => e.target.style.background = '#5568d3'}
            onMouseOut={(e) => e.target.style.background = '#667eea'}
          >
            ▲ Collapse All Weeks
          </button>
        </div>

        {/* Week 1 Prizes */}
        <div style={{marginBottom: '20px'}}>
          <h3 
            onClick={() => togglePrizeWeek('Week 1')}
            style={{
              cursor: 'pointer',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '15px 20px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              borderRadius: '8px',
              transition: 'all 0.3s',
              marginBottom: expandedPrizeWeeks['Week 1'] ? '20px' : '0',
              borderBottomLeftRadius: expandedPrizeWeeks['Week 1'] ? '0' : '8px',
              borderBottomRightRadius: expandedPrizeWeeks['Week 1'] ? '0' : '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateX(5px)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateX(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <span style={{fontSize: '1.2rem', transition: 'transform 0.3s'}}>
              {expandedPrizeWeeks['Week 1'] ? '▼' : '►'}
            </span>
            Week 1 Prizes (Wild Card Round)
          </h3>
          
          {expandedPrizeWeeks['Week 1'] && (
            <div className="prizes-grid">
              {prizeLeaders.filter(p => p.prizeNumber >= 1 && p.prizeNumber <= 2).map(prize => {
                const tooltipText = prize.type === 'correctWinners' 
                  ? 'Players who correctly predicted the most game outcomes (which team won)'
                  : 'Players whose predicted total scores were closest to the actual combined scores';
                
                return (
                  <div key={prize.prizeNumber} className="prize-card">
                    <div className="prize-header">
                      <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px'}}>
                        <div className="prize-number">PRIZE #{prize.prizeNumber}</div>
                        <div 
                          title={tooltipText}
                          style={{
                            cursor: 'help',
                            fontSize: '1.1rem',
                            opacity: 0.7,
                            transition: 'opacity 0.2s'
                          }}
                          onMouseOver={(e) => e.target.style.opacity = '1'}
                          onMouseOut={(e) => e.target.style.opacity = '0.7'}
                        >
                          ℹ️
                        </div>
                      </div>
                      <div className="prize-name">{prize.name}</div>
                      <div style={{
                        fontSize: '0.85rem',
                        color: '#666',
                        fontWeight: '600',
                        marginTop: '5px',
                        fontStyle: 'italic'
                      }}>
                        Current Leaders
                      </div>
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
                              const isTied = idx > 0 && leader.score === prize.leaders[idx - 1].score;
                              const displayRank = isTied ? '=' : idx + 1;
                              const isLeading = idx === 0 && !isTied;
                              
                              return (
                                <tr key={idx} className={isLeading ? 'leader-first' : ''}>
                                  <td className="rank">
                                    {displayRank}
                                    {isLeading && <span style={{marginLeft: '5px', fontSize: '0.8em'}}>👑</span>}
                                  </td>
                                  <td className="player-name">
                                    {leader.playerName}
                                    {isLeading && (() => {
                                      // Check if winners are officially published by prize number
                                      const pn = prize.prizeNumber;
                                      let isPublished = false;
                                      
                                      if (pn === 1 || pn === 2) {
                                        isPublished = publishedWinners?.week1_prize1 && publishedWinners?.week1_prize2;
                                      } else if (pn === 3 || pn === 4) {
                                        isPublished = publishedWinners?.week2_prize1 && publishedWinners?.week2_prize2;
                                      } else if (pn === 5 || pn === 6) {
                                        isPublished = publishedWinners?.week3_prize1 && publishedWinners?.week3_prize2;
                                      } else if (pn === 7 || pn === 8) {
                                        isPublished = publishedWinners?.week4_prize1 && publishedWinners?.week4_prize2;
                                      } else if (pn === 9 || pn === 10) {
                                        isPublished = publishedWinners?.grand_prize1 && publishedWinners?.grand_prize2;
                                      }
                                      
                                      return (
                                        <span style={{
                                          marginLeft: '8px',
                                          fontSize: '0.7rem',
                                          background: isPublished ? '#28a745' : '#4facfe',
                                          color: 'white',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontWeight: '600'
                                        }}>
                                          {isPublished ? 'WINNER' : 'LEADING'}
                                        </span>
                                      );
                                    })()}
                                  </td>
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
                );
              })}
            </div>
          )}
        </div>

        {/* Week 2 Prizes */}
        <div style={{marginBottom: '20px'}}>
          <h3 
            onClick={() => togglePrizeWeek('Week 2')}
            style={{
              cursor: 'pointer',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '15px 20px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              borderRadius: '8px',
              transition: 'all 0.3s',
              marginBottom: expandedPrizeWeeks['Week 2'] ? '20px' : '0',
              borderBottomLeftRadius: expandedPrizeWeeks['Week 2'] ? '0' : '8px',
              borderBottomRightRadius: expandedPrizeWeeks['Week 2'] ? '0' : '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateX(5px)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateX(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <span style={{fontSize: '1.2rem', transition: 'transform 0.3s'}}>
              {expandedPrizeWeeks['Week 2'] ? '▼' : '►'}
            </span>
            Week 2 Prizes (Divisional Round)
          </h3>
          
          {expandedPrizeWeeks['Week 2'] && (
            <div className="prizes-grid">
              {prizeLeaders.filter(p => p.prizeNumber >= 3 && p.prizeNumber <= 4).map(prize => {
                const tooltipText = prize.type === 'correctWinners' 
                  ? 'Players who correctly predicted the most game outcomes (which team won)'
                  : 'Players whose predicted total scores were closest to the actual combined scores';
                
                return (
                  <div key={prize.prizeNumber} className="prize-card">
                    <div className="prize-header">
                      <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px'}}>
                        <div className="prize-number">PRIZE #{prize.prizeNumber}</div>
                        <div 
                          title={tooltipText}
                          style={{
                            cursor: 'help',
                            fontSize: '1.1rem',
                            opacity: 0.7,
                            transition: 'opacity 0.2s'
                          }}
                          onMouseOver={(e) => e.target.style.opacity = '1'}
                          onMouseOut={(e) => e.target.style.opacity = '0.7'}
                        >
                          ℹ️
                        </div>
                      </div>
                      <div className="prize-name">{prize.name}</div>
                      <div style={{
                        fontSize: '0.85rem',
                        color: '#666',
                        fontWeight: '600',
                        marginTop: '5px',
                        fontStyle: 'italic'
                      }}>
                        Current Leaders
                      </div>
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
                              const isTied = idx > 0 && leader.score === prize.leaders[idx - 1].score;
                              const displayRank = isTied ? '=' : idx + 1;
                              const isLeading = idx === 0 && !isTied;
                              
                              return (
                                <tr key={idx} className={isLeading ? 'leader-first' : ''}>
                                  <td className="rank">
                                    {displayRank}
                                    {isLeading && <span style={{marginLeft: '5px', fontSize: '0.8em'}}>👑</span>}
                                  </td>
                                  <td className="player-name">
                                    {leader.playerName}
                                    {isLeading && (() => {
                                      // Week 4 is prizes 7-8
                                      const isPublished = publishedWinners?.week4_prize1 && publishedWinners?.week4_prize2;
                                      
                                      return (
                                        <span style={{
                                          marginLeft: '8px',
                                          fontSize: '0.7rem',
                                          background: isPublished ? '#28a745' : '#4facfe',
                                          color: 'white',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontWeight: '600'
                                        }}>
                                          {isPublished ? 'WINNER' : 'LEADING'}
                                        </span>
                                      );
                                    })()}
                                  </td>
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
                );
              })}
            </div>
          )}
        </div>

        {/* Week 3 Prizes */}
        <div style={{marginBottom: '20px'}}>
          <h3 
            onClick={() => togglePrizeWeek('Week 3')}
            style={{
              cursor: 'pointer',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '15px 20px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              borderRadius: '8px',
              transition: 'all 0.3s',
              marginBottom: expandedPrizeWeeks['Week 3'] ? '20px' : '0',
              borderBottomLeftRadius: expandedPrizeWeeks['Week 3'] ? '0' : '8px',
              borderBottomRightRadius: expandedPrizeWeeks['Week 3'] ? '0' : '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateX(5px)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateX(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <span style={{fontSize: '1.2rem', transition: 'transform 0.3s'}}>
              {expandedPrizeWeeks['Week 3'] ? '▼' : '►'}
            </span>
            Week 3 Prizes (Conference Championships)
          </h3>
          
          {expandedPrizeWeeks['Week 3'] && (
            <div className="prizes-grid">
              {prizeLeaders.filter(p => p.prizeNumber >= 5 && p.prizeNumber <= 6).map(prize => {
                const tooltipText = prize.type === 'correctWinners' 
                  ? 'Players who correctly predicted the most game outcomes (which team won)'
                  : 'Players whose predicted total scores were closest to the actual combined scores';
                
                return (
                  <div key={prize.prizeNumber} className="prize-card">
                    <div className="prize-header">
                      <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px'}}>
                        <div className="prize-number">PRIZE #{prize.prizeNumber}</div>
                        <div 
                          title={tooltipText}
                          style={{
                            cursor: 'help',
                            fontSize: '1.1rem',
                            opacity: 0.7,
                            transition: 'opacity 0.2s'
                          }}
                          onMouseOver={(e) => e.target.style.opacity = '1'}
                          onMouseOut={(e) => e.target.style.opacity = '0.7'}
                        >
                          ℹ️
                        </div>
                      </div>
                      <div className="prize-name">{prize.name}</div>
                      <div style={{
                        fontSize: '0.85rem',
                        color: '#666',
                        fontWeight: '600',
                        marginTop: '5px',
                        fontStyle: 'italic'
                      }}>
                        Current Leaders
                      </div>
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
                              const isTied = idx > 0 && leader.score === prize.leaders[idx - 1].score;
                              const displayRank = isTied ? '=' : idx + 1;
                              const isLeading = idx === 0 && !isTied;
                              
                              return (
                                <tr key={idx} className={isLeading ? 'leader-first' : ''}>
                                  <td className="rank">
                                    {displayRank}
                                    {isLeading && <span style={{marginLeft: '5px', fontSize: '0.8em'}}>👑</span>}
                                  </td>
                                  <td className="player-name">
                                    {leader.playerName}
                                    {isLeading && (() => {
                                      // Grand prizes are 9-10
                                      const isPublished = publishedWinners?.grand_prize1 && publishedWinners?.grand_prize2;
                                      
                                      return (
                                        <span style={{
                                          marginLeft: '8px',
                                          fontSize: '0.7rem',
                                          background: isPublished ? '#28a745' : '#4facfe',
                                          color: 'white',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontWeight: '600'
                                        }}>
                                          {isPublished ? 'WINNER' : 'LEADING'}
                                        </span>
                                      );
                                    })()}
                                  </td>
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
                );
              })}
            </div>
          )}
        </div>

        {/* Week 4 Prizes */}
        <div style={{marginBottom: '20px'}}>
          <h3 
            onClick={() => togglePrizeWeek('Week 4')}
            style={{
              cursor: 'pointer',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '15px 20px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              borderRadius: '8px',
              transition: 'all 0.3s',
              marginBottom: expandedPrizeWeeks['Week 4'] ? '20px' : '0',
              borderBottomLeftRadius: expandedPrizeWeeks['Week 4'] ? '0' : '8px',
              borderBottomRightRadius: expandedPrizeWeeks['Week 4'] ? '0' : '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateX(5px)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateX(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <span style={{fontSize: '1.2rem', transition: 'transform 0.3s'}}>
              {expandedPrizeWeeks['Week 4'] ? '▼' : '►'}
            </span>
            Week 4 Prizes (Super Bowl)
          </h3>
          
          {expandedPrizeWeeks['Week 4'] && (
            <div className="prizes-grid">
              {prizeLeaders.filter(p => p.prizeNumber >= 7 && p.prizeNumber <= 8).map(prize => {
                const tooltipText = prize.type === 'correctWinners' 
                  ? 'Players who correctly predicted the most game outcomes (which team won)'
                  : 'Players whose predicted total scores were closest to the actual combined scores';
                
                return (
                  <div key={prize.prizeNumber} className="prize-card">
                    <div className="prize-header">
                      <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px'}}>
                        <div className="prize-number">PRIZE #{prize.prizeNumber}</div>
                        <div 
                          title={tooltipText}
                          style={{
                            cursor: 'help',
                            fontSize: '1.1rem',
                            opacity: 0.7,
                            transition: 'opacity 0.2s'
                          }}
                          onMouseOver={(e) => e.target.style.opacity = '1'}
                          onMouseOut={(e) => e.target.style.opacity = '0.7'}
                        >
                          ℹ️
                        </div>
                      </div>
                      <div className="prize-name">{prize.name}</div>
                      <div style={{
                        fontSize: '0.85rem',
                        color: '#666',
                        fontWeight: '600',
                        marginTop: '5px',
                        fontStyle: 'italic'
                      }}>
                        Current Leaders
                      </div>
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
                              const isTied = idx > 0 && leader.score === prize.leaders[idx - 1].score;
                              const displayRank = isTied ? '=' : idx + 1;
                              const isLeading = idx === 0 && !isTied;
                              
                              return (
                                <tr key={idx} className={isLeading ? 'leader-first' : ''}>
                                  <td className="rank">
                                    {displayRank}
                                    {isLeading && <span style={{marginLeft: '5px', fontSize: '0.8em'}}>👑</span>}
                                  </td>
                                  <td className="player-name">
                                    {leader.playerName}
                                    {isLeading && (
                                      <span style={{
                                        marginLeft: '8px',
                                        fontSize: '0.7rem',
                                        background: '#4facfe',
                                        color: 'white',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        fontWeight: '600'
                                      }}>
                                        LEADING
                                      </span>
                                    )}
                                  </td>
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
                );
              })}
            </div>
          )}
        </div>

        {/* Grand Prizes */}
        <div style={{marginBottom: '20px'}}>
          <h3 
            onClick={() => togglePrizeWeek('Grand Prizes')}
            style={{
              cursor: 'pointer',
              userSelect: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '15px 20px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              borderRadius: '8px',
              transition: 'all 0.3s',
              marginBottom: expandedPrizeWeeks['Grand Prizes'] ? '20px' : '0',
              borderBottomLeftRadius: expandedPrizeWeeks['Grand Prizes'] ? '0' : '8px',
              borderBottomRightRadius: expandedPrizeWeeks['Grand Prizes'] ? '0' : '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateX(5px)';
              e.currentTarget.style.boxShadow = '0 4px 15px rgba(102, 126, 234, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateX(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <span style={{fontSize: '1.2rem', transition: 'transform 0.3s'}}>
              {expandedPrizeWeeks['Grand Prizes'] ? '▼' : '►'}
            </span>
            Grand Prizes (All Weeks Combined)
          </h3>
          
          {expandedPrizeWeeks['Grand Prizes'] && (
            <div className="prizes-grid">
              {prizeLeaders.filter(p => p.prizeNumber >= 9 && p.prizeNumber <= 10).map(prize => {
                const tooltipText = prize.type === 'correctWinners' 
                  ? 'Players who correctly predicted the most game outcomes (which team won)'
                  : 'Players whose predicted total scores were closest to the actual combined scores';
                
                return (
                  <div key={prize.prizeNumber} className="prize-card">
                    <div className="prize-header">
                      <div style={{display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px'}}>
                        <div className="prize-number">PRIZE #{prize.prizeNumber}</div>
                        <div 
                          title={tooltipText}
                          style={{
                            cursor: 'help',
                            fontSize: '1.1rem',
                            opacity: 0.7,
                            transition: 'opacity 0.2s'
                          }}
                          onMouseOver={(e) => e.target.style.opacity = '1'}
                          onMouseOut={(e) => e.target.style.opacity = '0.7'}
                        >
                          ℹ️
                        </div>
                      </div>
                      <div className="prize-name">{prize.name}</div>
                      <div style={{
                        fontSize: '0.85rem',
                        color: '#666',
                        fontWeight: '600',
                        marginTop: '5px',
                        fontStyle: 'italic'
                      }}>
                        Current Leaders
                      </div>
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
                              const isTied = idx > 0 && leader.score === prize.leaders[idx - 1].score;
                              const displayRank = isTied ? '=' : idx + 1;
                              const isLeading = idx === 0 && !isTied;
                              
                              return (
                                <tr key={idx} className={isLeading ? 'leader-first' : ''}>
                                  <td className="rank">
                                    {displayRank}
                                    {isLeading && <span style={{marginLeft: '5px', fontSize: '0.8em'}}>👑</span>}
                                  </td>
                                  <td className="player-name">
                                    {leader.playerName}
                                    {isLeading && (
                                      <span style={{
                                        marginLeft: '8px',
                                        fontSize: '0.7rem',
                                        background: '#4facfe',
                                        color: 'white',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        fontWeight: '600'
                                      }}>
                                        LEADING
                                      </span>
                                    )}
                                  </td>
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
                );
              })}
            </div>
          )}
        </div>


        <div className="standings-note">
          <p><strong>Note:</strong> Tied players are shown with "=" rank. Pool Manager will resolve ties and declare official prize awards after all games are completed.</p>
        </div>
      </div>
    </div>
  );
}

export default StandingsPage;
