import React, { useState, useMemo } from 'react';
import './HowWinnersAreDetermined.css';

/**
 * How Winners Are Determined Page
 * Shows calculation results and tiebreaker details for all prizes
 * WITH COLLAPSIBLE WEEK SECTIONS
 */
const HowWinnersAreDetermined = ({ 
  calculatedWinners, 
  publishedWinners, 
  isPoolManager,
  onPublishPrize,
  onUnpublishPrize,
  allPicks = [],
  actualScores = {}
}) => {
  // Track which weeks are expanded
  const [expandedWeeks, setExpandedWeeks] = useState({
    'Week 1': true,
    'Week 2': false,
    'Week 3': false,
    'Week 4': false,
    'Grand Prize': false
  });

  // Track which prize breakdowns are expanded
  const [expandedBreakdowns, setExpandedBreakdowns] = useState({});

  // Toggle a specific week
  const toggleWeek = (weekKey) => {
    setExpandedWeeks(prev => ({
      ...prev,
      [weekKey]: !prev[weekKey]
    }));
  };

  // Toggle a specific prize breakdown
  const toggleBreakdown = (pubKey) => {
    setExpandedBreakdowns(prev => ({
      ...prev,
      [pubKey]: !prev[pubKey]
    }));
  };

  // Expand all weeks
  const expandAll = () => {
    setExpandedWeeks({
      'Week 1': true,
      'Week 2': true,
      'Week 3': true,
      'Week 4': true,
      'Grand Prize': true
    });
  };

  // Collapse all weeks
  const collapseAll = () => {
    setExpandedWeeks({
      'Week 1': false,
      'Week 2': false,
      'Week 3': false,
      'Week 4': false,
      'Grand Prize': false
    });
  };

  // Prize definitions
  const prizes = [
    { week: 'Week 1', title: 'Most Correct Winners', amount: '$50', icon: '🏆', calcKey: 'week1.prize1', pubKey: 'week1_prize1' },
    { week: 'Week 1', title: 'Closest Total Points', amount: '$50', icon: '💰', calcKey: 'week1.prize2', pubKey: 'week1_prize2' },
    { week: 'Week 2', title: 'Most Correct Winners', amount: '$50', icon: '🏆', calcKey: 'week2.prize1', pubKey: 'week2_prize1' },
    { week: 'Week 2', title: 'Closest Total Points', amount: '$50', icon: '💰', calcKey: 'week2.prize2', pubKey: 'week2_prize2' },
    { week: 'Week 3', title: 'Most Correct Winners', amount: '$50', icon: '🏆', calcKey: 'week3.prize1', pubKey: 'week3_prize1' },
    { week: 'Week 3', title: 'Closest Total Points', amount: '$50', icon: '💰', calcKey: 'week3.prize2', pubKey: 'week3_prize2' },
    { week: 'Week 4', title: 'Correct Winner', amount: '$50', icon: '🏆', calcKey: 'week4.prize1', pubKey: 'week4_prize1' },
    { week: 'Week 4', title: 'Closest Total Points', amount: '$50', icon: '💰', calcKey: 'week4.prize2', pubKey: 'week4_prize2' },
    { week: 'Grand Prize', title: 'Most Correct Winners', amount: '$120', icon: '🏆', calcKey: 'grandPrize.prize1', pubKey: 'grand_prize1' },
    { week: 'Grand Prize', title: 'Closest Total Points', amount: '$80', icon: '💰', calcKey: 'grandPrize.prize2', pubKey: 'grand_prize2' }
  ];

  const getResult = (calcKey) => {
    const keys = calcKey.split('.');
    let result = calculatedWinners;
    for (const key of keys) {
      result = result?.[key];
      if (!result) return null;
    }
    return result;
  };

  const isPublished = (pubKey) => {
    return publishedWinners?.[pubKey] === true;
  };

  const handleReviewPublish = (prize, result) => {
    if (onPublishPrize) {
      onPublishPrize(prize.pubKey, prize, result);
    }
  };

  const renderExpandedViewContent = (prize, result) => {
    const hasSteps = result.steps && result.steps.length > 0;
    const hasTiebreaker = result.tiebreakerUsed && result.tiedPlayersDetails && result.tiedPlayersDetails.length > 0;
    
    if (!hasSteps && !hasTiebreaker) {
      return (
        <div className="expanded-view">
          <div className="breakdown-header">═══ FULL BREAKDOWN ═══</div>
          <p>Winner determined without tiebreakers.</p>
        </div>
      );
    }
    
    if (hasSteps) {
      return (
        <div className="expanded-view">
          <div className="breakdown-header">═══ FULL TIEBREAKER BREAKDOWN ═══</div>
          
          {result.steps.map((step, index) => (
            <div key={index} className="breakdown-step">
              <div className="step-header">
                {step.layer !== undefined && <span className="layer-badge">Layer {step.layer}</span>}
                STEP {index + 1}: {step.level}
              </div>
              
              {step.actualTotal !== undefined && (
                <div className="step-detail">Actual total: {step.actualTotal} points</div>
              )}
              
              {step.remaining !== undefined && (
                <div className="step-detail">
                  {step.remaining} player{step.remaining !== 1 ? 's' : ''} remain{step.remaining === 1 ? 's' : ''}
                </div>
              )}
              
              {step.tied && step.tied.length > 1 && (
                <div className="step-detail tied-players">
                  ✅ Tied: {step.tied.join(', ')}
                </div>
              )}
              
              {step.winner && (
                <div className="step-detail winner">
                  🏆 Winner: <strong>{step.winner}</strong>
                </div>
              )}
              
              {step.eliminated > 0 && (
                <div className="step-detail eliminated">
                  ❌ {step.eliminated} player{step.eliminated !== 1 ? 's' : ''} eliminated
                </div>
              )}
              
              {step.details && step.details.length > 0 && (
                <div className="player-details">
                  {step.details.map((player, pIndex) => (
                    <div key={pIndex} className="player-row">
                      <span className="player-name">{player.name}:</span>
                      <span className="player-prediction">{player.predictedTotal} predicted</span>
                      <span className="player-diff">(off by {player.difference})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }
    
    if (hasTiebreaker) {
      return (
        <div className="expanded-view">
          <div className="breakdown-header">═══ FULL TIEBREAKER BREAKDOWN ═══</div>
          
          <div className="breakdown-step">
            <div className="step-header">
              INITIAL TIE: Correctly predicted {result.correctWinners} NFL winning team{result.correctWinners !== 1 ? 's' : ''}
            </div>
            <div className="step-detail tied-players">
              ✅ Tied: {result.tiedPlayers.join(', ')}
            </div>
          </div>
          
          <div className="breakdown-step">
            <div className="step-header">
              TIEBREAKER: {result.tiebreakerLevel}
            </div>
            <div className="step-detail">Actual total: {result.actualTotal} points</div>
            
            <div className="player-details">
              {result.tiedPlayersDetails.map((player, pIndex) => (
                <div key={pIndex} className="player-row">
                  <span className="player-name">{player.name}:</span>
                  <span className="player-prediction">{player.predictedTotal} predicted</span>
                  <span className="player-diff">(off by {player.difference})</span>
                  {player.name === result.winner && <span className="winner-badge">🏆 WINNER</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
  };

  const renderPrize = (prize) => {
    const result = getResult(prize.calcKey);
    const published = isPublished(prize.pubKey);
    const isBreakdownExpanded = expandedBreakdowns[prize.pubKey] || false;

    if (!result || result.status === 'not_scored' || result.status === 'no_picks') {
      return (
        <div key={prize.pubKey} className="prize-card">
          <div className="prize-header">
            <span className="prize-icon">{prize.icon}</span>
            <span className="prize-title">{prize.title}</span>
            <span className="prize-amount">{prize.amount}</span>
          </div>
          <div className="prize-status waiting">
            ⏸️ Waiting for game results
          </div>
        </div>
      );
    }

    if (!published) {
      return (
        <div key={prize.pubKey} className="prize-card unpublished">
          <div className="prize-header">
            <span className="prize-icon">{prize.icon}</span>
            <span className="prize-title">{prize.title}</span>
            <span className="prize-amount">{prize.amount}</span>
          </div>
          <div className="prize-status unpublished">
            {isPoolManager ? (
              <>
                ⏳ Not yet published
                <button 
                  className="publish-btn"
                  onClick={() => handleReviewPublish(prize, result)}
                >
                  🔍 Review & Publish
                </button>
              </>
            ) : (
              <div>
                ⏳ Not yet published
                <div style={{fontSize: '0.85rem', marginTop: '5px', opacity: 0.8}}>
                  (Pool Manager is reviewing calculations)
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div key={prize.pubKey} className="prize-card published">
        <div className="prize-header">
          <span className="prize-icon">{prize.icon}</span>
          <span className="prize-title">{prize.title}</span>
          <span className="prize-amount">{prize.amount}</span>
        </div>
        
        <div className="moderate-view">
          <div className="winner-announcement">
            🏆 Winner: <strong>{Array.isArray(result.winner) ? result.winner.join(', ') : result.winner}</strong>
          </div>
          
          {result.correctWinners !== undefined && (
            <div className="winner-stat">
              ✓ Correctly predicted {result.correctWinners} NFL winning team{result.correctWinners !== 1 ? 's' : ''}
            </div>
          )}
          
          {result.difference !== undefined && (
            <div className="winner-stat">
              Off by {result.difference} point{result.difference !== 1 ? 's' : ''}
              {result.predictedTotal !== undefined && result.actualTotal !== undefined && (
                <span> (Predicted: {result.predictedTotal}, Actual: {result.actualTotal})</span>
              )}
            </div>
          )}
          
          {result.tiebreakerUsed && (
            <div className="tiebreaker-info">
              {result.tiedPlayers && result.tiedPlayers.length > 1 && (
                <div className="tied-count">
                  {result.tiedPlayers.length} players tied - each correctly predicted {result.correctWinners} NFL winning team{result.correctWinners !== 1 ? 's' : ''}
                </div>
              )}
              {result.tiebreakerLevel && (
                <div className="tiebreaker-method">
                  Tiebreaker: {result.tiebreakerLevel}
                </div>
              )}
              {result.tiedPlayers && result.tiedPlayers.length > 0 && (
                <div className="tied-players-list">
                  Tied players: {result.tiedPlayers.join(', ')}
                </div>
              )}
            </div>
          )}
          
          {result.isTrueTie && (
            <div className="true-tie-notice">
              ⚠️ TRUE TIE - Prize will be split equally
            </div>
          )}
          
          {!result.tiebreakerUsed && !result.isTrueTie && (
            <div className="no-tiebreaker">
              No tiebreaker needed
            </div>
          )}
        </div>

        {(result.steps?.length > 0 || result.tiebreakerUsed) && (
          <button 
            className="toggle-breakdown-btn"
            onClick={() => toggleBreakdown(prize.pubKey)}
          >
            {isBreakdownExpanded ? '▲ Hide Full Breakdown' : '▼ Show Full Breakdown'}
          </button>
        )}

        {isBreakdownExpanded && renderExpandedViewContent(prize, result)}
        
        {isPoolManager && (
          <button 
            className="unpublish-btn"
            onClick={() => onUnpublishPrize(prize.pubKey)}
          >
            🔄 Unpublish {prize.title}
          </button>
        )}
      </div>
    );
  };

  // ============================================================================
  // TIMESTAMP TIE-BREAKER ANALYSIS (Added at end, doesn't touch original code)
  // ============================================================================
  
  const PLAYOFF_WEEKS = {
    wildcard: { name: 'Wild Card Round', weekNum: 1 },
    divisional: { name: 'Divisional Round', weekNum: 2 },
    conference: { name: 'Conference Championships', weekNum: 3 },
    superbowl: { name: 'Super Bowl LIX', weekNum: 4 }
  };

  const getPickTimestamp = (pick) => pick.lastUpdated || pick.timestamp || 0;

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'No timestamp';
    const date = new Date(timestamp);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${month}/${day}, ${String(displayHours).padStart(2, '0')}:${minutes}:${seconds} ${ampm}`;
  };

  const timestampAnalysis = useMemo(() => {
    const analysis = { weeks: {}, seasonSummary: { weeksAnalyzed: 0, totalPrizes: 0, prizesWithTies: 0, tiesWouldBreak: 0 } };
    Object.entries(PLAYOFF_WEEKS).forEach(([weekKey, weekInfo]) => {
      const weekPicks = allPicks.filter(p => p.week === weekKey);
      const weekScores = actualScores[weekKey];
      if (!weekScores || weekPicks.length === 0) return;
      analysis.seasonSummary.weeksAnalyzed++;
      const weekAnalysis = { weekName: weekInfo.name, prizes: [] };
      const weekPrizes = prizes.filter(p => p.week === `Week ${weekInfo.weekNum}`);
      weekPrizes.forEach(prize => {
        analysis.seasonSummary.totalPrizes++;
        const result = getResult(prize.calcKey);
        if (!result) return;
        const winners = Array.isArray(result.winner) ? result.winner : [result.winner].filter(Boolean);
        if (winners.length > 1) {
          analysis.seasonSummary.prizesWithTies++;
          const tiedPicks = winners.map(winnerCode => {
            const pick = weekPicks.find(p => p.playerCode === winnerCode);
            return { playerCode: winnerCode, playerName: pick?.playerName || winnerCode, timestamp: getPickTimestamp(pick), pick: pick };
          }).filter(p => p.pick);
          tiedPicks.sort((a, b) => a.timestamp - b.timestamp);
          const prizeAnalysis = { prizeTitle: prize.title, officialResult: `${winners.length}-way tie`, tiedPlayers: tiedPicks, hypotheticalWinner: tiedPicks[0], timestampWouldBreak: tiedPicks.length > 1 };
          if (prizeAnalysis.timestampWouldBreak) analysis.seasonSummary.tiesWouldBreak++;
          weekAnalysis.prizes.push(prizeAnalysis);
        }
      });
      if (weekAnalysis.prizes.length > 0) analysis.weeks[weekKey] = weekAnalysis;
    });
    return analysis;
  }, [calculatedWinners, allPicks, actualScores, prizes]);

  const scaleProjections = useMemo(() => {
    const { weeksAnalyzed, prizesWithTies, totalPrizes } = timestampAnalysis.seasonSummary;
    if (weeksAnalyzed === 0 || totalPrizes === 0) return null;
    const tieRate = prizesWithTies / totalPrizes;
    return {
      currentPlayers: 50, tieRate,
      projections: {
        1000: { expectedTiesPerPrize: '15-30 way ties', prizeWithout: '$100 ÷ 20 = $5.00 each', prizeWith: '$100 ÷ 1 = $100.00', improvement: '+$95.00 (1900% increase)' },
        10000: { expectedTiesPerPrize: '50-200 way ties', prizeWithout: '$100 ÷ 100 = $1.00 each', prizeWith: '$100 ÷ 1 = $100.00', improvement: '+$99.00 (9900% increase)' }
      }
    };
  }, [timestampAnalysis]);

  const weekGroups = [
    { key: 'Week 1', title: 'Week 1 - Wild Card Round (6 games)', prizes: prizes.filter(p => p.week === 'Week 1') },
    { key: 'Week 2', title: 'Week 2 - Divisional Round (4 games)', prizes: prizes.filter(p => p.week === 'Week 2') },
    { key: 'Week 3', title: 'Week 3 - Conference Championships (2 games)', prizes: prizes.filter(p => p.week === 'Week 3') },
    { key: 'Week 4', title: 'Week 4 - Super Bowl (1 game)', prizes: prizes.filter(p => p.week === 'Week 4') },
    { key: 'Grand Prize', title: 'Grand Prizes', prizes: prizes.filter(p => p.week === 'Grand Prize') }
  ];

  return (
    <div className="how-winners-container">
      <h2>⚖️ How Winners Are Determined</h2>
      
      <p className="intro-text">
        Winners are published after the Pool Manager reviews calculations. 
        Check back after each week's games complete.
      </p>

      <div className="week-controls">
        <button className="control-btn" onClick={expandAll}>
          ▼ Expand All Weeks
        </button>
        <button className="control-btn" onClick={collapseAll}>
          ▲ Collapse All Weeks
        </button>
      </div>
      
      <div className="divider"></div>
      
      {weekGroups.map((group, index) => (
        <div key={group.key} className="week-section">
          <h3 
            className={`week-header collapsible ${expandedWeeks[group.key] ? 'expanded' : 'collapsed'}`}
            onClick={() => toggleWeek(group.key)}
          >
            <span className="toggle-icon">
              {expandedWeeks[group.key] ? '▼' : '►'}
            </span>
            {group.title}
          </h3>
          
          {expandedWeeks[group.key] && (
            <div className="prizes-container">
              {group.prizes.map(prize => renderPrize(prize))}
            </div>
          )}
          
          {index < weekGroups.length - 1 && <div className="divider"></div>}
        </div>
      ))}

      {/* TIMESTAMP ANALYSIS - Pool Manager Only */}
      {isPoolManager && timestampAnalysis.seasonSummary.weeksAnalyzed > 0 && (
        <div className="timestamp-analysis-section">
          <div className="testing-warning-banner">
            <h2>⚠️ EXPERIMENTAL FEATURE - FOR TESTING ONLY</h2>
            <p>This analysis shows what WOULD happen if submission timestamp was used as a final tie-breaker.</p>
            <p><strong>This is NOT used for actual prizes this season.</strong> Data is for planning next year only.</p>
          </div>
          <div className="timestamp-analysis-content">
            <div className="analysis-header">
              <h3>📊 HYPOTHETICAL: TIMESTAMP TIE-BREAKER ANALYSIS</h3>
              <p className="last-updated">Last updated: {new Date().toLocaleString()}</p>
            </div>
            {Object.entries(timestampAnalysis.weeks).map(([weekKey, weekData]) => (
              <div key={weekKey} className="week-timestamp-analysis">
                <h4 className="week-analysis-title">🔬 {weekData.weekName.toUpperCase()} - TIMESTAMP IMPACT</h4>
                {weekData.prizes.filter(p => p.timestampWouldBreak).length === 0 ? (
                  <div className="no-ties-message">✓ No ties this week - timestamp not needed</div>
                ) : weekData.prizes.map((prize, idx) => prize.timestampWouldBreak ? (
                  <div key={idx} className="prize-timestamp-comparison">
                    <h5>{prize.prizeTitle}</h5>
                    <div className="official-result-box">
                      <div className="box-label">📅 Official Result (Current Rules):</div>
                      <div className="box-content">{prize.officialResult} - Prize split equally
                        <div className="tied-players-list">{prize.tiedPlayers.map(p => p.playerName).join(', ')}</div>
                      </div>
                    </div>
                    <div className="hypothetical-result-box">
                      <div className="box-label">⏰ Hypothetical (If Timestamp Was Used):</div>
                      <div className="box-content">
                        <div className="timestamp-ranking">
                          {prize.tiedPlayers.map((player, idx) => (
                            <div key={idx} className={`timestamp-entry ${idx === 0 ? 'winner' : ''}`}>
                              <span className="rank">{idx + 1}{idx === 0 ? 'st' : idx === 1 ? 'nd' : idx === 2 ? 'rd' : 'th'}:</span>
                              <span className="player-name">{player.playerName}</span>
                              <span className="timestamp">{formatTimestamp(player.timestamp)}</span>
                              {idx === 0 && <span className="winner-badge">✓ WINNER</span>}
                            </div>
                          ))}
                        </div>
                        <div className="impact-note">💡 Impact: {prize.tiedPlayers.length}-way split → Solo winner</div>
                      </div>
                    </div>
                  </div>
                ) : null)}
              </div>
            ))}
            <div className="season-summary-section">
              <h3 className="summary-title">📈 SEASON SUMMARY (Cumulative Statistics)</h3>
              <div className="summary-box current-season">
                <h4>CURRENT SEASON (50 players):</h4>
                <div className="stats-grid">
                  <div className="stat-item"><span className="stat-label">Weeks Analyzed:</span><span className="stat-value">{timestampAnalysis.seasonSummary.weeksAnalyzed} / 4</span></div>
                  <div className="stat-item"><span className="stat-label">Prizes Awarded:</span><span className="stat-value">{timestampAnalysis.seasonSummary.totalPrizes} / 10</span></div>
                  <div className="stat-item"><span className="stat-label">Ties After Rules:</span><span className="stat-value">{timestampAnalysis.seasonSummary.prizesWithTies} ({timestampAnalysis.seasonSummary.totalPrizes > 0 ? Math.round((timestampAnalysis.seasonSummary.prizesWithTies / timestampAnalysis.seasonSummary.totalPrizes) * 100) : 0}%)</span></div>
                  <div className="stat-item"><span className="stat-label">Timestamp Would Break:</span><span className="stat-value">{timestampAnalysis.seasonSummary.tiesWouldBreak} ({timestampAnalysis.seasonSummary.prizesWithTies > 0 ? Math.round((timestampAnalysis.seasonSummary.tiesWouldBreak / timestampAnalysis.seasonSummary.prizesWithTies) * 100) : 0}% of ties)</span></div>
                </div>
              </div>
              {scaleProjections && (
                <div className="scale-projections-section">
                  <h3 className="projections-title">🔮 PROJECTION: SCALING TO LARGER POOLS</h3>
                  <p className="projections-subtitle">Based on current tie rate ({Math.round(scaleProjections.tieRate * 100)}% after {timestampAnalysis.seasonSummary.weeksAnalyzed} week{timestampAnalysis.seasonSummary.weeksAnalyzed !== 1 ? 's' : ''} with {scaleProjections.currentPlayers} players):</p>
                  <div className="projection-box projection-1000">
                    <h4>WITH 1,000 PLAYERS:</h4>
                    <div className="projection-stats">
                      <div className="projection-item"><span className="projection-label">Expected Ties per Prize:</span><span className="projection-value">{scaleProjections.projections[1000].expectedTiesPerPrize}</span></div>
                      <div className="projection-item"><span className="projection-label">Timestamp Impact:</span><span className="projection-value critical">Critical</span></div>
                      <div className="projection-item"><span className="projection-label">Prize Split Improvement:</span><div className="prize-comparison"><div>Without: {scaleProjections.projections[1000].prizeWithout}</div><div>With: {scaleProjections.projections[1000].prizeWith}</div><div className="improvement">{scaleProjections.projections[1000].improvement}</div></div></div>
                    </div>
                  </div>
                  <div className="projection-box projection-10000">
                    <h4>WITH 10,000 PLAYERS:</h4>
                    <div className="projection-stats">
                      <div className="projection-item"><span className="projection-label">Expected Ties per Prize:</span><span className="projection-value">{scaleProjections.projections[10000].expectedTiesPerPrize}</span></div>
                      <div className="projection-item"><span className="projection-label">Timestamp Impact:</span><span className="projection-value essential">ESSENTIAL</span></div>
                      <div className="projection-item"><span className="projection-label">Prize Split Improvement:</span><div className="prize-comparison"><div>Without: {scaleProjections.projections[10000].prizeWithout}</div><div>With: {scaleProjections.projections[10000].prizeWith}</div><div className="improvement">{scaleProjections.projections[10000].improvement}</div></div></div>
                      <div className="critical-note">💡 Without timestamp: Prizes become nearly worthless<br />With timestamp: Meaningful prize amounts</div>
                    </div>
                  </div>
                  <div className="conclusion-box"><strong>⚠️ CONCLUSION:</strong> Timestamp tie-breaker becomes <strong>CRITICAL</strong> for pools with 500+ players. <strong>Essential</strong> for 1,000+.</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HowWinnersAreDetermined;
