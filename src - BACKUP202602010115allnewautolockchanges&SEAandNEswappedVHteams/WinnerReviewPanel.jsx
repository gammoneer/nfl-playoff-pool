import React, { useState } from 'react';

/**
 * WinnerReviewPanel - Pool Manager reviews calculated winners before publishing
 * Shows all prizes, ties, splits, with override capability
 */
const WinnerReviewPanel = ({ 
  week, 
  weekName,
  prizes, 
  allPlayers,
  totalPool,
  prizeAmount,
  onPublish,
  onCancel,
  onOverride
}) => {
  const [selectedPrize, setSelectedPrize] = useState(null);

  // Prize names mapping
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

  const getWeekPrizeNumbers = (weekKey) => {
    const mapping = {
      'wildcard': [1, 2],
      'divisional': [3, 4],
      'conference': [5, 6],
      'superbowl': [7, 8],
      'grand': [9, 10]
    };
    return mapping[weekKey] || [];
  };

  const weekPrizeNumbers = getWeekPrizeNumbers(week);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      zIndex: 10000,
      overflowY: 'auto',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        backgroundColor: '#fff',
        borderRadius: '12px',
        padding: '0'
      }}>
        
        {/* Header */}
        <div style={{
          padding: '20px 30px',
          backgroundColor: '#2196F3',
          color: '#fff',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>
              🔍 Review Winners
            </h2>
            <p style={{ margin: '5px 0 0 0', fontSize: '16px', color: '#fff', opacity: 0.9 }}>
              {weekName} - Not Yet Published
            </p>
          </div>
          <button
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: '#fff',
              border: '2px solid #fff',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              minHeight: '44px'
            }}
          >
            ✖ Close
          </button>
        </div>

        {/* Pool Info */}
        <div style={{
          padding: '20px 30px',
          backgroundColor: '#f5f5f5',
          borderBottom: '2px solid #ddd'
        }}>
          <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', color: '#000' }}>
            <div>
              <p style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#666', fontWeight: 'bold' }}>Total Prize Pool</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#000' }}>${totalPool.toFixed(2)}</p>
            </div>
            <div>
              <p style={{ margin: '0 0 5px 0', fontSize: '14px', color: '#666', fontWeight: 'bold' }}>Per Prize (10%)</p>
              <p style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#000' }}>${prizeAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Prize Reviews */}
        <div style={{ padding: '30px' }}>
          {weekPrizeNumbers.map(prizeNum => {
            const prize = prizes.find(p => p.prizeNumber === prizeNum);
            const winners = prize?.winners || [];
            const isTie = winners.length > 1;

            return (
              <div key={prizeNum} style={{
                marginBottom: '30px',
                border: '2px solid #ddd',
                borderRadius: '8px',
                overflow: 'hidden'
              }}>
                {/* Prize Header */}
                <div style={{
                  padding: '15px 20px',
                  backgroundColor: isTie ? '#fff3cd' : '#d4edda',
                  borderBottom: '2px solid #ddd'
                }}>
                  <h3 style={{ margin: '0 0 5px 0', fontSize: '18px', fontWeight: 'bold', color: '#000' }}>
                    {prizeNames[prizeNum]}
                  </h3>
                  <p style={{ margin: 0, fontSize: '14px', color: '#000' }}>
                    Prize Amount: ${prizeAmount.toFixed(2)}
                  </p>
                </div>

                {/* Winners */}
                <div style={{ padding: '20px' }}>
                  {!isTie ? (
                    // Single Winner
                    <div>
                      <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#666', fontWeight: 'bold' }}>
                        Calculated Winner:
                      </p>
                      {winners.map((winner, idx) => (
                        <div key={idx} style={{
                          padding: '15px',
                          backgroundColor: '#e8f5e9',
                          borderRadius: '6px',
                          marginBottom: '10px'
                        }}>
                          <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#000' }}>
                            ✓ {winner.playerName}
                          </p>
                          <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#000' }}>
                            Score: {winner.score} points
                          </p>
                          <p style={{ margin: '5px 0 0 0', fontSize: '16px', fontWeight: 'bold', color: '#2e7d32' }}>
                            Amount: ${prizeAmount.toFixed(2)} (100%)
                          </p>
                        </div>
                      ))}
                      <p style={{ margin: '10px 0 0 0', fontSize: '14px', color: '#000' }}>
                        Status: <span style={{ color: '#2e7d32', fontWeight: 'bold' }}>✅ Single Winner</span>
                      </p>
                    </div>
                  ) : (
                    // Multiple Winners (Tie)
                    <div>
                      <p style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#000', fontWeight: 'bold' }}>
                        ⚠️ TIE DETECTED - {winners.length} Winners:
                      </p>
                      {winners.map((winner, idx) => {
                        const splitAmount = prizeAmount / winners.length;
                        const isLast = idx === winners.length - 1;
                        // Adjust last winner for rounding
                        const displayAmount = isLast 
                          ? (prizeAmount - (splitAmount * (winners.length - 1)))
                          : splitAmount;
                        
                        return (
                          <div key={idx} style={{
                            padding: '15px',
                            backgroundColor: '#fff3cd',
                            borderRadius: '6px',
                            marginBottom: '10px'
                          }}>
                            <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#000' }}>
                              • {winner.playerName}
                            </p>
                            <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#000' }}>
                              Score: {winner.score} points (tied)
                            </p>
                            <p style={{ margin: '5px 0 0 0', fontSize: '16px', fontWeight: 'bold', color: '#856404' }}>
                              Split: ${displayAmount.toFixed(2)} ({(100 / winners.length).toFixed(2)}%)
                            </p>
                          </div>
                        );
                      })}
                      <div style={{
                        padding: '15px',
                        backgroundColor: '#e7f3ff',
                        borderRadius: '6px',
                        marginTop: '15px'
                      }}>
                        <p style={{ margin: 0, fontSize: '14px', color: '#000', fontWeight: 'bold' }}>
                          Auto Split: ${prizeAmount.toFixed(2)} ÷ {winners.length} = ${(prizeAmount / winners.length).toFixed(2)} each
                        </p>
                        <p style={{ margin: '5px 0 0 0', fontSize: '12px', color: '#666' }}>
                          (Last winner adjusted for rounding to balance exactly)
                        </p>
                      </div>
                      <p style={{ margin: '15px 0 0 0', fontSize: '14px', color: '#000' }}>
                        Status: <span style={{ color: '#f57c00', fontWeight: 'bold' }}>⚠️ {winners.length}-Way Tie</span>
                      </p>
                    </div>
                  )}

                  {/* Override Button */}
                  <button
                    onClick={() => onOverride(prizeNum, prize)}
                    style={{
                      marginTop: '15px',
                      padding: '12px 24px',
                      backgroundColor: '#ff9800',
                      color: '#000',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      width: '100%',
                      minHeight: '44px'
                    }}
                  >
                    🔧 Override Winners/Split
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Actions */}
        <div style={{
          padding: '20px 30px',
          backgroundColor: '#f5f5f5',
          borderTop: '2px solid #ddd',
          display: 'flex',
          gap: '15px',
          flexWrap: 'wrap',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={onCancel}
            style={{
              padding: '14px 30px',
              backgroundColor: '#fff',
              color: '#000',
              border: '2px solid #ddd',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '16px',
              fontWeight: 'bold',
              minHeight: '44px',
              flex: '1',
              minWidth: '120px'
            }}
          >
            ❌ Cancel
          </button>
          <button
            onClick={onPublish}
            style={{
              padding: '14px 30px',
              backgroundColor: '#4caf50',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '18px',
              fontWeight: 'bold',
              minHeight: '44px',
              flex: '2',
              minWidth: '200px'
            }}
          >
            ✅ PUBLISH {weekName.toUpperCase()} WINNERS
          </button>
        </div>

      </div>
    </div>
  );
};

export default WinnerReviewPanel;
