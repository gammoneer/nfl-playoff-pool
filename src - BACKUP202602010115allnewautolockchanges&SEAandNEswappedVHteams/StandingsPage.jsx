import React, { useMemo, useState } from 'react';
import './StandingsPage.css';

// Import scoring functions (we'll integrate these)
// For now, we'll include the logic directly

function StandingsPage({ 
  allPicks, 
  actualScores, 
  gameStatus, 
  currentWeek, 
  playerName, 
  playerCode, 
  isPoolManager, 
  prizePool, 
  officialWinners, 
  publishedWinners, 
  onLogout,
  weekCompletionStatus,
  rankMostCorrectWinners,
  rankClosestPoints,
  rankCorrectSuperBowlWinner,
  rankClosestSuperBowlPoints,
  rankMostCorrectAllWeeks,
  rankClosestPointsAllWeeks,
  isWeekComplete,
  calculateCorrectWinners,
  calculateWeeklyTotal,
  calculateTotalCorrectWinners,
  calculateGrandTotal
}) {
  
  // Track which prize week sections are expanded
  const [expandedPrizeWeeks, setExpandedPrizeWeeks] = useState({
    'Week 1': true,  // Default: Week 1 open
    'Week 2': false,
    'Week 3': false,
    'Week 4': false
  });
  
  // Track which player lists are expanded (show all vs top 10)
  const [expandedPlayerLists, setExpandedPlayerLists] = useState({});

  // Toggle a specific prize week section
  const togglePrizeWeek = (weekKey) => {
    setExpandedPrizeWeeks(prev => ({
      ...prev,
      [weekKey]: !prev[weekKey]
    }));
  };
  
  // Toggle player list expansion for a specific prize
  const togglePlayerList = (prizeKey) => {
    setExpandedPlayerLists(prev => ({
      ...prev,
      [prizeKey]: !prev[prizeKey]
    }));
  };

  // Expand all prize weeks
  const expandAllPrizeWeeks = () => {
    setExpandedPrizeWeeks({
      'Week 1': true,
      'Week 2': true,
      'Week 3': true,
      'Week 4': true
    });
  };

  // Collapse all prize weeks
  const collapseAllPrizeWeeks = () => {
    setExpandedPrizeWeeks({
      'Week 1': false,
      'Week 2': false,
      'Week 3': false,
      'Week 4': false
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
  // CONVERSION HELPERS
  // ============================================
  
  const weekMapping = {
    'wildcard': 'Week 1',
    'divisional': 'Week 2',
    'conference': 'Week 3',
    'superbowl': 'Week 4'
  };

  // ============================================
  // PROCESS DATA FOR STANDINGS
  // ============================================

  // ============================================
  // NEW PRIZE LEADERS USING RANKING FUNCTIONS
  // ============================================
  
  const prizeLeaders = useMemo(() => {
    const prizes = [];

    // Week 1 (Wild Card)
    const week1MostCorrect = rankMostCorrectWinners && rankMostCorrectWinners('wildcard');
    const week1ClosestPoints = rankClosestPoints && rankClosestPoints('wildcard');
    const week1Complete = isWeekComplete && isWeekComplete('wildcard');
    
    prizes.push({
      prizeNumber: 1,
      name: 'Most Correct NFL Winners',
      week: 'wildcard',
      weekName: 'Week 1',
      type: 'correctWinners',
      rankings: week1MostCorrect || [],
      isComplete: week1Complete
    });
    
    prizes.push({
      prizeNumber: 2,
      name: 'Closest Total Points',
      week: 'wildcard',
      weekName: 'Week 1',
      type: 'pointsDifference',
      rankings: week1ClosestPoints || [],
      isComplete: week1Complete
    });

    // Week 2 (Divisional)
    const week2MostCorrect = rankMostCorrectWinners && rankMostCorrectWinners('divisional');
    const week2ClosestPoints = rankClosestPoints && rankClosestPoints('divisional');
    const week2Complete = isWeekComplete && isWeekComplete('divisional');
    
    prizes.push({
      prizeNumber: 3,
      name: 'Most Correct NFL Winners',
      week: 'divisional',
      weekName: 'Week 2',
      type: 'correctWinners',
      rankings: week2MostCorrect || [],
      isComplete: week2Complete
    });
    
    prizes.push({
      prizeNumber: 4,
      name: 'Closest Total Points',
      week: 'divisional',
      weekName: 'Week 2',
      type: 'pointsDifference',
      rankings: week2ClosestPoints || [],
      isComplete: week2Complete
    });

    // Week 3 (Conference)
    const week3MostCorrect = rankMostCorrectWinners && rankMostCorrectWinners('conference');
    const week3ClosestPoints = rankClosestPoints && rankClosestPoints('conference');
    const week3Complete = isWeekComplete && isWeekComplete('conference');
    
    prizes.push({
      prizeNumber: 5,
      name: 'Most Correct NFL Winners',
      week: 'conference',
      weekName: 'Week 3',
      type: 'correctWinners',
      rankings: week3MostCorrect || [],
      isComplete: week3Complete
    });
    
    prizes.push({
      prizeNumber: 6,
      name: 'Closest Total Points',
      week: 'conference',
      weekName: 'Week 3',
      type: 'pointsDifference',
      rankings: week3ClosestPoints || [],
      isComplete: week3Complete
    });

    // Week 4 (Super Bowl) - FOUR PRIZES!
    const sbWinnerRankings = rankCorrectSuperBowlWinner && rankCorrectSuperBowlWinner();
    const sbPointsRankings = rankClosestSuperBowlPoints && rankClosestSuperBowlPoints();
    const allWeeksMostCorrect = rankMostCorrectAllWeeks && rankMostCorrectAllWeeks();
    const allWeeksClosestPoints = rankClosestPointsAllWeeks && rankClosestPointsAllWeeks();
    const week4Complete = isWeekComplete && isWeekComplete('superbowl');
    
    prizes.push({
      prizeNumber: 7,
      name: 'Correct Super Bowl Winner',
      subname: '(Super Bowl game only)',
      week: 'superbowl',
      weekName: 'Week 4',
      type: 'superBowlWinner',
      rankings: sbWinnerRankings || [],
      isComplete: week4Complete
    });
    
    prizes.push({
      prizeNumber: 8,
      name: 'Closest Super Bowl Points',
      subname: '(Super Bowl game only)',
      week: 'superbowl',
      weekName: 'Week 4',
      type: 'pointsDifference',
      rankings: sbPointsRankings || [],
      isComplete: week4Complete
    });
    
    prizes.push({
      prizeNumber: 9,
      name: 'Most Correct NFL Winners',
      subname: '(Entire 4-week playoffs)',
      week: 'all',
      weekName: 'Week 4',
      type: 'correctWinnersAll',
      rankings: allWeeksMostCorrect || [],
      isComplete: week4Complete
    });
    
    prizes.push({
      prizeNumber: 10,
      name: 'Closest Total Points',
      subname: '(Entire 4-week playoffs)',
      week: 'all',
      weekName: 'Week 4',
      type: 'pointsDifferenceAll',
      rankings: allWeeksClosestPoints || [],
      isComplete: week4Complete
    });

    return prizes;
  }, [
    rankMostCorrectWinners,
    rankClosestPoints,
    rankCorrectSuperBowlWinner,
    rankClosestSuperBowlPoints,
    rankMostCorrectAllWeeks,
    rankClosestPointsAllWeeks,
    isWeekComplete
  ]);
  
  // ============================================
  // HELPER: RENDER PRIZE CARD WITH RANKINGS
  // ============================================
  
  const renderPrizeCard = (prize) => {
    const prizeKey = `prize${prize.prizeNumber}`;
    const isExpanded = expandedPlayerLists[prizeKey] || false;
    const rankings = prize.rankings || [];
    const displayCount = isExpanded ? rankings.length : Math.min(10, rankings.length);
    const displayRankings = rankings.slice(0, displayCount);
    
    // Determine tooltip text
    let tooltipText = '';
    if (prize.type === 'correctWinners' || prize.type === 'correctWinnersAll' || prize.type === 'superBowlWinner') {
      tooltipText = 'Players who correctly predicted the most winning teams';
    } else {
      tooltipText = 'Players whose predicted scores were closest to actual scores';
    }
    
    // Format display value based on type
    const formatDisplayValue = (ranking) => {
      if (prize.type === 'correctWinners') {
        return `${ranking.correctCount} correct (${ranking.weekDifference} pts diff)`;
      } else if (prize.type === 'correctWinnersAll') {
        return `${ranking.totalCorrect} correct (${ranking.grandDifference} pts diff)`;
      } else if (prize.type === 'superBowlWinner') {
        // Prize #7 now uses POINTS DIFFERENCE for tie-breaking (not correct counts!)
        return ranking.pickedCorrect 
          ? `✅ Correct (W4:${ranking.week4Difference}, W3:${ranking.week3Difference}, W2:${ranking.week2Difference}, W1:${ranking.week1Difference})`
          : `❌ Incorrect (W4:${ranking.week4Difference}, W3:${ranking.week3Difference}, W2:${ranking.week2Difference}, W1:${ranking.week1Difference})`;
      } else if (prize.type === 'pointsDifference') {
        return `${ranking.weekDifference} pts off`;
      } else if (prize.type === 'pointsDifferenceAll') {
        const breakdown = `W1:${ranking.week1Difference}, W2:${ranking.week2Difference}, W3:${ranking.week3Difference}, W4:${ranking.week4Difference}`;
        return `${ranking.grandDifference} pts off (${breakdown})`;
      }
      return '-';
    };
    
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
          {prize.subname && (
            <div style={{fontSize: '0.85rem', color: '#666', fontStyle: 'italic'}}>
              {prize.subname}
            </div>
          )}
          <div style={{
            fontSize: '0.85rem',
            color: '#666',
            fontWeight: '600',
            marginTop: '5px',
            fontStyle: 'italic'
          }}>
            Current Standings
          </div>
        </div>
        
        <div className="prize-leaders">
          {rankings.length === 0 ? (
            <div className="no-data">No data available yet</div>
          ) : (
            <>
              <table className="leaders-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Player</th>
                    <th>Score</th>
                  </tr>
                </thead>
                <tbody>
                  {displayRankings.map((ranking, idx) => {
                    const isRank1 = ranking.rank === 1;
                    const statusLabel = prize.isComplete ? 'WINNER' : 'LEADING';
                    const statusColor = prize.isComplete ? '#28a745' : '#4facfe';
                    
                    return (
                      <tr key={idx} className={isRank1 ? 'leader-first' : ''}>
                        <td className="rank">
                          {ranking.rank}
                          {ranking.tied && <span style={{color: '#ff9800', marginLeft: '5px', fontSize: '0.8em'}}>(tied)</span>}
                          {isRank1 && <span style={{marginLeft: '5px', fontSize: '0.8em'}}>👑</span>}
                        </td>
                        <td className="player-name">
                          {ranking.playerName}
                          {isRank1 && (
                            <span style={{
                              marginLeft: '8px',
                              fontSize: '0.7rem',
                              background: statusColor,
                              color: 'white',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontWeight: '600'
                            }}>
                              ✅ {statusLabel}
                            </span>
                          )}
                        </td>
                        <td className="score">
                          {formatDisplayValue(ranking)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              
              {rankings.length > 10 && (
                <button
                  onClick={() => togglePlayerList(prizeKey)}
                  style={{
                    marginTop: '15px',
                    padding: '8px 16px',
                    background: '#667eea',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    fontWeight: '600',
                    width: '100%'
                  }}
                >
                  {isExpanded ? `▲ Show Top 10 Only` : `▼ Show All ${rankings.length} Players`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  };
  
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
              {prizeLeaders.filter(p => p.prizeNumber >= 1 && p.prizeNumber <= 2).map(prize => renderPrizeCard(prize))}
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
              {prizeLeaders.filter(p => p.prizeNumber >= 3 && p.prizeNumber <= 4).map(prize => renderPrizeCard(prize))}
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
              {prizeLeaders.filter(p => p.prizeNumber >= 5 && p.prizeNumber <= 6).map(prize => renderPrizeCard(prize))}
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
            <div>
              {/* Super Bowl Game Only Section */}
              <div style={{
                background: '#f8f9fa',
                padding: '15px',
                borderRadius: '8px',
                marginBottom: '20px',
                border: '2px solid #667eea'
              }}>
                <h4 style={{
                  margin: '0 0 15px 0',
                  color: '#667eea',
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  textAlign: 'center'
                }}>
                  🏈 SUPER BOWL GAME ONLY
                </h4>
                <div className="prizes-grid">
                  {prizeLeaders.filter(p => p.prizeNumber === 7 || p.prizeNumber === 8).map(prize => renderPrizeCard(prize))}
                </div>
              </div>
              
              {/* Entire 4-Week Playoffs Section */}
              <div style={{
                background: '#fff8e1',
                padding: '15px',
                borderRadius: '8px',
                border: '2px solid #ffa726'
              }}>
                <h4 style={{
                  margin: '0 0 15px 0',
                  color: '#f57c00',
                  fontSize: '1.1rem',
                  fontWeight: 'bold',
                  textAlign: 'center'
                }}>
                  🏆 ENTIRE 4-WEEK PLAYOFFS
                </h4>
                <div className="prizes-grid">
                  {prizeLeaders.filter(p => p.prizeNumber === 9 || p.prizeNumber === 10).map(prize => renderPrizeCard(prize))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="standings-note">
          <p><strong>Note:</strong> Tied players are shown with tied indicators. Rankings use official tie-breaker rules. Pool Manager will declare official winners after all games are completed.</p>
        </div>
      </div>
    </div>
  );
}

export default StandingsPage;
