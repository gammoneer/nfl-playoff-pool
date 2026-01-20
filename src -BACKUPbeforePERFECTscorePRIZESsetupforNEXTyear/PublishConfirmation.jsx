import React from 'react';

/**
 * PublishConfirmation - Final confirmation popup before publishing winners
 * Shows summary of all winners and amounts
 */
const PublishConfirmation = ({ 
  weekName,
  prizes,
  onConfirm,
  onCancel
}) => {
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

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      zIndex: 12000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        maxWidth: '600px',
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: '12px',
        padding: '0',
        maxHeight: '90vh',
        overflowY: 'auto'
      }}>
        
        {/* Header */}
        <div style={{
          padding: '25px 30px',
          backgroundColor: '#ff5722',
          color: '#fff',
          borderTopLeftRadius: '12px',
          borderTopRightRadius: '12px',
          textAlign: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '28px', fontWeight: 'bold', color: '#fff' }}>
            ⚠️ CONFIRM PUBLICATION
          </h2>
          <p style={{ margin: '10px 0 0 0', fontSize: '18px', color: '#fff' }}>
            {weekName} Winners
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: '30px' }}>
          
          {/* Warning */}
          <div style={{
            padding: '15px',
            backgroundColor: '#fff3cd',
            border: '2px solid #ffc107',
            borderRadius: '8px',
            marginBottom: '25px'
          }}>
            <p style={{ margin: 0, fontSize: '14px', color: '#000', lineHeight: '1.6' }}>
              <strong>Once published, these results will be visible to all players.</strong><br />
              You can still unpublish and edit them later if needed.
            </p>
          </div>

          {/* Prize Summary */}
          <div style={{
            marginBottom: '20px'
          }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '18px', fontWeight: 'bold', color: '#000' }}>
              Winners Summary:
            </h3>

            {prizes.map(prize => {
              const winners = prize.winners || [];
              const isTie = winners.length > 1;

              return (
                <div key={prize.prizeNumber} style={{
                  marginBottom: '20px',
                  padding: '15px',
                  backgroundColor: '#f9f9f9',
                  border: '2px solid #ddd',
                  borderRadius: '8px'
                }}>
                  <p style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 'bold', color: '#000' }}>
                    {prizeNames[prize.prizeNumber]}
                  </p>
                  
                  {winners.map((winner, idx) => (
                    <div key={idx} style={{
                      padding: '10px',
                      backgroundColor: '#fff',
                      borderRadius: '4px',
                      marginBottom: idx < winners.length - 1 ? '8px' : '0'
                    }}>
                      <p style={{ margin: '0 0 3px 0', fontSize: '16px', fontWeight: 'bold', color: '#000' }}>
                        {winner.playerName}
                      </p>
                      <p style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: '#4caf50' }}>
                        ${winner.amount ? winner.amount.toFixed(2) : '0.00'}
                        {isTie && <span style={{ fontSize: '14px', color: '#666', marginLeft: '8px' }}>
                          ({(winner.percentage || (100 / winners.length)).toFixed(0)}%)
                        </span>}
                      </p>
                    </div>
                  ))}

                  {prize.overrideNote && (
                    <div style={{
                      marginTop: '10px',
                      padding: '10px',
                      backgroundColor: '#e3f2fd',
                      borderRadius: '4px',
                      border: '1px solid #2196F3'
                    }}>
                      <p style={{ margin: '0 0 3px 0', fontSize: '12px', fontWeight: 'bold', color: '#000' }}>
                        Note:
                      </p>
                      <p style={{ margin: 0, fontSize: '14px', color: '#000', fontStyle: 'italic' }}>
                        "{prize.overrideNote}"
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '20px 30px',
          backgroundColor: '#f5f5f5',
          borderTop: '2px solid #ddd',
          display: 'flex',
          gap: '15px',
          flexWrap: 'wrap'
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
            ⬅️ Go Back
          </button>
          <button
            onClick={onConfirm}
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
              minWidth: '180px'
            }}
          >
            ✅ PUBLISH NOW
          </button>
        </div>

      </div>
    </div>
  );
};

export default PublishConfirmation;
