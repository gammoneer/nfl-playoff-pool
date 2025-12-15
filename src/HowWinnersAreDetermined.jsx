import React, { useState } from 'react';
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
  onUnpublishPrize
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
              INITIAL TIE: {result.correctWinners} correct winner{result.correctWinners !== 1 ? 's' : ''}
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
              {result.correctWinners} correct winner{result.correctWinners !== 1 ? 's' : ''}
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
                  {result.tiedPlayers.length} players tied with {result.correctWinners || 'same score'}
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
    </div>
  );
};

export default HowWinnersAreDetermined;
