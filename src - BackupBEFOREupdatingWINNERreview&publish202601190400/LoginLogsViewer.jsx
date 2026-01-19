import React, { useState, useEffect } from 'react';
import { getDatabase, ref, onValue } from 'firebase/database';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LOGIN LOGS VIEWER - FULL FEATURED (CARD LAYOUT)
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Features:
 * - Filter by status (all/success/failed)
 * - Search by player code or name
 * - Sort by date (newest/oldest)
 * - Export to CSV
 * - Stats dashboard
 * - Pool Manager only access
 * 
 * Uses CARD LAYOUT instead of table for better visibility!
 */

const LoginLogsViewer = ({ isPoolManager, playerCodes, onClearLogs }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'success', 'failed'
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest', 'oldest'

  // Fetch logs from Firebase
  useEffect(() => {
    if (!isPoolManager) {
      setLoading(false);
      return;
    }

    try {
      const database = getDatabase();
      const logsRef = ref(database, 'loginLogs');
      
      const unsubscribe = onValue(logsRef, (snapshot) => {
        const data = snapshot.val();
        console.log('📊 Login logs data:', data);
        
        if (data) {
          const logsArray = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
          }));
          console.log('📊 Parsed logs array:', logsArray);
          setLogs(logsArray);
        } else {
          console.log('📊 No login logs data found');
          setLogs([]);
        }
        setLoading(false);
        setError(null);
      }, (error) => {
        console.error('❌ Error fetching login logs:', error);
        setError('Failed to load login logs. Check console for details.');
        setLoading(false);
      });

      return () => {
        if (unsubscribe) {
          unsubscribe();
        }
      };
    } catch (err) {
      console.error('❌ Error setting up Firebase listener:', err);
      setError('Failed to initialize Firebase. Check console for details.');
      setLoading(false);
    }
  }, [isPoolManager]);

  // Filter and sort logs
  const filteredLogs = logs
    .filter(log => {
      // Filter by status
      if (filter === 'success' && !log.success) return false;
      if (filter === 'failed' && log.success) return false;
      
      // Filter by search term
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const codeMatch = log.playerCode?.toLowerCase().includes(search);
        const nameMatch = log.playerName?.toLowerCase().includes(search);
        return codeMatch || nameMatch;
      }
      
      return true;
    })
    .sort((a, b) => {
      if (sortOrder === 'newest') {
        return b.timestamp - a.timestamp;
      } else {
        return a.timestamp - b.timestamp;
      }
    });

  // Export to CSV
  const exportToCSV = () => {
    if (filteredLogs.length === 0) {
      alert('No logs to export!');
      return;
    }

    const headers = ['Timestamp', 'Date/Time', 'Player Code', 'Player Name', 'Status', 'Error Message', 'Browser', 'Device'];
    const rows = filteredLogs.map(log => [
      log.timestamp,
      new Date(log.timestamp).toLocaleString(),
      log.playerCode || '',
      log.playerName || '',
      log.success ? 'Success' : 'Failed',
      log.errorMessage || '',
      log.browser || '',
      log.device || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `login-logs-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // Calculate stats
  const stats = {
    total: logs.length,
    successful: logs.filter(l => l.success).length,
    failed: logs.filter(l => l.success === false).length,
    uniquePlayers: new Set(logs.filter(l => l.success).map(l => l.playerCode)).size
  };

  if (!isPoolManager) {
    return (
      <div style={{padding: '40px', textAlign: 'center', color: '#999'}}>
        <p>🔒 This feature is only available to Pool Managers</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{padding: '60px', textAlign: 'center'}}>
        <div style={{
          display: 'inline-block',
          padding: '20px 40px',
          background: '#f0f4f8',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
        }}>
          <p style={{fontSize: '1.2rem', margin: '0 0 10px 0', color: '#000'}}>📊 Loading login logs...</p>
          <p style={{fontSize: '0.9rem', color: '#666', margin: 0}}>Connecting to Firebase...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{padding: '60px', textAlign: 'center'}}>
        <div style={{
          display: 'inline-block',
          padding: '30px',
          background: '#fff3cd',
          border: '2px solid #ffc107',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          maxWidth: '600px'
        }}>
          <h3 style={{margin: '0 0 15px 0', color: '#856404'}}>⚠️ Error Loading Logs</h3>
          <p style={{color: '#856404', margin: '0 0 15px 0'}}>{error}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '20px',
              padding: '12px 24px',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '1rem',
              fontWeight: '600'
            }}
          >
            🔄 Reload Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      margin: '40px auto',
      maxWidth: '1400px',
      padding: '0 20px'
    }}>
      {/* Header */}
      <div style={{marginBottom: '30px'}}>
        <h1 style={{
          fontSize: '2rem',
          margin: '0 0 10px 0',
          color: '#000',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          🔐 Login Activity Log
          <span style={{
            fontSize: '0.7rem',
            padding: '4px 12px',
            background: '#667eea',
            color: 'white',
            borderRadius: '20px',
            fontWeight: '500'
          }}>
            Pool Manager Only
          </span>
        </h1>
        <p style={{color: '#666', margin: 0}}>Monitor all login attempts to the NFL Playoff Pool</p>
        
        {/* Clear All Login Logs Button */}
        {isPoolManager && onClearLogs && (
          <div style={{ marginTop: '20px' }}>
            <button 
              onClick={onClearLogs}
              style={{
                padding: '12px 24px',
                fontSize: '1rem',
                background: '#e74c3c',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                boxShadow: '0 2px 8px rgba(231, 76, 60, 0.3)',
                transition: 'all 0.3s ease'
              }}
              onMouseOver={(e) => {
                e.target.style.background = '#c0392b';
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 4px 12px rgba(231, 76, 60, 0.4)';
              }}
              onMouseOut={(e) => {
                e.target.style.background = '#e74c3c';
                e.target.style.transform = 'translateY(0)';
                e.target.style.boxShadow = '0 2px 8px rgba(231, 76, 60, 0.3)';
              }}
            >
              🗑️ Clear All Login Logs
            </button>
            <p style={{ 
              fontSize: '0.85rem', 
              color: '#e74c3c', 
              marginTop: '8px',
              marginBottom: 0,
              fontStyle: 'italic'
            }}>
              ⚠️ Warning: This will permanently delete all login history
            </p>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
          padding: '25px',
          borderRadius: '12px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
          color: '#000'
        }}>
          <div style={{fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '5px'}}>
            {stats.successful}
          </div>
          <div style={{fontSize: '1rem', fontWeight: '500'}}>Successful Logins</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
          padding: '25px',
          borderRadius: '12px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
          color: '#000'
        }}>
          <div style={{fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '5px'}}>
            {stats.failed}
          </div>
          <div style={{fontSize: '1rem', fontWeight: '500'}}>Failed Attempts</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
          padding: '25px',
          borderRadius: '12px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
          color: '#000'
        }}>
          <div style={{fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '5px'}}>
            {stats.uniquePlayers}
          </div>
          <div style={{fontSize: '1rem', fontWeight: '500'}}>Unique Players</div>
        </div>

        <div style={{
          background: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
          padding: '25px',
          borderRadius: '12px',
          boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
          color: '#000'
        }}>
          <div style={{fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '5px'}}>
            {stats.total}
          </div>
          <div style={{fontSize: '1rem', fontWeight: '500'}}>Total Attempts</div>
        </div>
      </div>

      {/* Controls */}
      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '10px',
        marginBottom: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '15px',
        alignItems: 'center'
      }}>
        {/* Filter Buttons */}
        <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap'}}>
          <button
            onClick={() => setFilter('all')}
            style={{
              padding: '10px 20px',
              background: filter === 'all' ? '#667eea' : '#f0f0f0',
              color: filter === 'all' ? 'white' : '#333',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem'
            }}
          >
            All ({stats.total})
          </button>
          <button
            onClick={() => setFilter('success')}
            style={{
              padding: '10px 20px',
              background: filter === 'success' ? '#4caf50' : '#f0f0f0',
              color: filter === 'success' ? 'white' : '#333',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem'
            }}
          >
            ✓ Success ({stats.successful})
          </button>
          <button
            onClick={() => setFilter('failed')}
            style={{
              padding: '10px 20px',
              background: filter === 'failed' ? '#f44336' : '#f0f0f0',
              color: filter === 'failed' ? 'white' : '#333',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.9rem'
            }}
          >
            ✗ Failed ({stats.failed})
          </button>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search by code or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: '10px 15px',
            border: '2px solid #e0e0e0',
            borderRadius: '6px',
            fontSize: '0.9rem',
            flex: '1',
            minWidth: '200px',
            color: '#000'
          }}
        />

        {/* Sort */}
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          style={{
            padding: '10px 15px',
            border: '2px solid #e0e0e0',
            borderRadius: '6px',
            fontSize: '0.9rem',
            cursor: 'pointer',
            background: 'white',
            color: '#000'
          }}
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>

        {/* Export Button */}
        <button
          onClick={exportToCSV}
          style={{
            padding: '10px 20px',
            background: '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          📥 Export CSV
        </button>
      </div>

      {/* Logs Display */}
      {filteredLogs.length === 0 ? (
        <div style={{
          background: 'white',
          padding: '60px 40px',
          borderRadius: '10px',
          textAlign: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          {searchTerm ? (
            <p style={{fontSize: '1.2rem', margin: 0, color: '#666'}}>
              🔍 No logs match your search
            </p>
          ) : (
            <>
              <p style={{fontSize: '1.5rem', margin: '0 0 20px 0', color: '#333'}}>
                📭 No login attempts logged yet
              </p>
              <div style={{
                background: '#f8f9fa',
                padding: '25px',
                borderRadius: '8px',
                maxWidth: '600px',
                margin: '0 auto',
                textAlign: 'left'
              }}>
                <p style={{margin: '0 0 15px 0', fontSize: '1rem', color: '#666'}}>
                  <strong>To test login tracking:</strong>
                </p>
                <ol style={{margin: 0, paddingLeft: '20px', color: '#666', lineHeight: '2'}}>
                  <li>Logout (click "🚪 Logout" button)</li>
                  <li>Try logging in with a WRONG code (e.g., "ABC123")</li>
                  <li>See the failed attempt appear here</li>
                  <li>Login with your correct code</li>
                  <li>See the successful login appear here</li>
                </ol>
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Results Count */}
          <div style={{
            padding: '15px 20px',
            background: '#f8f9fa',
            borderRadius: '8px',
            marginBottom: '15px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <span style={{fontSize: '1.2rem'}}>📊</span>
            <span style={{fontWeight: '600', color: '#000'}}>
              Showing: {filteredLogs.length} of {logs.length} total attempts
            </span>
          </div>

          {/* Log Cards */}
          <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
            {filteredLogs.map((log, idx) => (
              <div
                key={log.id}
                style={{
                  padding: '20px',
                  background: log.success ? '#e8f5e9' : '#ffebee',
                  border: `3px solid ${log.success ? '#4caf50' : '#f44336'}`,
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                  transition: 'transform 0.2s',
                  cursor: 'default'
                }}
                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.01)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              >
                {/* Header */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '15px',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}>
                    <span style={{
                      fontSize: '1.5rem',
                      fontWeight: 'bold',
                      color: '#000'
                    }}>
                      #{filteredLogs.length - idx}
                    </span>
                    <span style={{
                      padding: '8px 16px',
                      background: log.success ? '#4caf50' : '#f44336',
                      color: 'white',
                      borderRadius: '20px',
                      fontWeight: 'bold',
                      fontSize: '0.9rem'
                    }}>
                      {log.success ? '✅ SUCCESS' : '❌ FAILED'}
                    </span>
                  </div>
                  <div style={{
                    fontSize: '0.95rem',
                    color: '#666',
                    fontWeight: '500'
                  }}>
                    {new Date(log.timestamp).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </div>
                </div>

                {/* Details Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '15px'
                }}>
                  <div>
                    <div style={{
                      fontSize: '0.85rem',
                      color: '#666',
                      marginBottom: '5px',
                      fontWeight: '500'
                    }}>
                      Player Code
                    </div>
                    <div style={{
                      fontSize: '1.1rem',
                      fontWeight: 'bold',
                      color: '#000',
                      fontFamily: 'monospace'
                    }}>
                      {log.playerCode || 'N/A'}
                    </div>
                  </div>

                  <div>
                    <div style={{
                      fontSize: '0.85rem',
                      color: '#666',
                      marginBottom: '5px',
                      fontWeight: '500'
                    }}>
                      Player Name
                    </div>
                    <div style={{
                      fontSize: '1.1rem',
                      fontWeight: 'bold',
                      color: '#000'
                    }}>
                      {log.playerName || 'N/A'}
                    </div>
                  </div>

                  <div>
                    <div style={{
                      fontSize: '0.85rem',
                      color: '#666',
                      marginBottom: '5px',
                      fontWeight: '500'
                    }}>
                      Browser
                    </div>
                    <div style={{
                      fontSize: '1.1rem',
                      fontWeight: 'bold',
                      color: '#000'
                    }}>
                      {log.browser || 'N/A'}
                    </div>
                  </div>

                  <div>
                    <div style={{
                      fontSize: '0.85rem',
                      color: '#666',
                      marginBottom: '5px',
                      fontWeight: '500'
                    }}>
                      Device
                    </div>
                    <div style={{
                      fontSize: '1.1rem',
                      fontWeight: 'bold',
                      color: '#000'
                    }}>
                      {log.device || 'N/A'}
                    </div>
                  </div>
                </div>

                {/* Error Message (if failed) */}
                {!log.success && log.errorMessage && (
                  <div style={{
                    marginTop: '15px',
                    padding: '12px',
                    background: '#fff',
                    borderLeft: '4px solid #f44336',
                    borderRadius: '4px'
                  }}>
                    <div style={{
                      fontSize: '0.85rem',
                      color: '#666',
                      marginBottom: '5px',
                      fontWeight: '500'
                    }}>
                      Error Message
                    </div>
                    <div style={{
                      fontSize: '1rem',
                      color: '#d32f2f',
                      fontWeight: '600',
                      fontStyle: 'italic'
                    }}>
                      {log.errorMessage}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Footer Info */}
      <div style={{
        marginTop: '30px',
        padding: '20px',
        background: '#f8f9fa',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <p style={{
          margin: 0,
          color: '#666',
          fontSize: '0.9rem',
          fontStyle: 'italic'
        }}>
          💡 Logs update in real-time. Failed attempts help identify players who need assistance with their codes.
        </p>
      </div>
    </div>
  );
};

export default LoginLogsViewer;
