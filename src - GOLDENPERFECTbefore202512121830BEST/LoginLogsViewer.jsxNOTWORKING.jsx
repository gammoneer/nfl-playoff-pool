import React, { useState, useEffect } from 'react';
import { getDatabase, ref, onValue } from 'firebase/database';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LOGIN LOGS VIEWER - POOL MANAGER ONLY
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This component displays all login attempts for the NFL Playoff Pool.
 * 
 * Features:
 * - View all login attempts (successful and failed)
 * - Filter by status (all/success/failed)
 * - Search by player code or name
 * - Export to CSV
 * - Real-time updates from Firebase
 * - Security: Pool Manager only
 * 
 * Firebase Structure:
 * /loginLogs
 *   /{logId}
 *     timestamp: 1704067200000
 *     playerCode: "B8L9M2"
 *     playerName: "Richard Biletski"  (if successful)
 *     success: true/false
 *     errorMessage: "Invalid code" (if failed)
 *     browser: "Chrome"
 *     device: "Desktop"
 *     ip: "192.168.1.1" (optional)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

const LoginLogsViewer = ({ isPoolManager, playerCodes }) => {
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
        console.log('📊 Login logs data:', data); // Debug log
        
        if (data) {
          const logsArray = Object.keys(data).map(key => ({
            id: key,
            ...data[key]
          }));
          console.log('📊 Parsed logs array:', logsArray); // Debug log
          setLogs(logsArray);
        } else {
          console.log('📊 No login logs data found'); // Debug log
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

  // 🐛 DEBUG: Log filtered logs to see what we're working with
  if (filteredLogs.length > 0) {
    console.log('🔍 Filtered logs sample:', filteredLogs[0]);
    console.log('🔍 First log fields:', {
      id: filteredLogs[0].id,
      timestamp: filteredLogs[0].timestamp,
      playerCode: filteredLogs[0].playerCode,
      playerName: filteredLogs[0].playerName,
      success: filteredLogs[0].success,
      browser: filteredLogs[0].browser,
      device: filteredLogs[0].device
    });
  }

  // Export to CSV
  const exportToCSV = () => {
    if (filteredLogs.length === 0) {
      alert('No logs to export!');
      return;
    }

    let csv = 'Timestamp,Player Code,Player Name,Status,Error Message,Browser,Device\n';
    
    filteredLogs.forEach(log => {
      const timestamp = new Date(log.timestamp).toLocaleString();
      const code = log.playerCode || '-';
      const name = log.playerName || '-';
      const status = log.success ? 'Success' : 'Failed';
      const error = log.errorMessage || '-';
      const browser = log.browser || '-';
      const device = log.device || '-';
      
      csv += `"${timestamp}","${code}","${name}","${status}","${error}","${browser}","${device}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `login_logs_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
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
          <p style={{fontSize: '1.2rem', margin: '0 0 10px 0'}}>📊 Loading login logs...</p>
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
          <div style={{
            background: '#fff',
            padding: '15px',
            borderRadius: '6px',
            textAlign: 'left',
            fontSize: '0.9rem',
            color: '#666',
            marginTop: '20px'
          }}>
            <p style={{margin: '0 0 10px 0'}}><strong>Possible fixes:</strong></p>
            <ul style={{margin: 0, paddingLeft: '20px'}}>
              <li>Check browser console (F12) for detailed errors</li>
              <li>Refresh the page (Ctrl+Shift+R)</li>
              <li>Make sure Firebase is initialized properly</li>
              <li>Check Firebase Realtime Database rules</li>
            </ul>
          </div>
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
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '30px',
        borderRadius: '12px',
        color: 'white',
        marginBottom: '30px',
        boxShadow: '0 8px 20px rgba(0,0,0,0.15)'
      }}>
        <h2 style={{margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '10px'}}>
          🔐 Login Activity Log
          <span style={{
            fontSize: '0.7rem',
            padding: '4px 12px',
            background: 'rgba(255,255,255,0.2)',
            borderRadius: '20px',
            fontWeight: 'normal'
          }}>
            Pool Manager Only
          </span>
        </h2>
        <p style={{margin: '0', opacity: 0.9, fontSize: '0.95rem'}}>
          Monitor all login attempts to the NFL Playoff Pool
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '20px',
        marginBottom: '30px'
      }}>
        <div style={{
          background: '#4caf50',
          color: 'white',
          padding: '25px',
          borderRadius: '10px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
        }}>
          <div style={{fontSize: '2rem', fontWeight: 'bold'}}>{stats.successful}</div>
          <div style={{fontSize: '0.9rem', opacity: 0.9}}>Successful Logins</div>
        </div>
        
        <div style={{
          background: '#f44336',
          color: 'white',
          padding: '25px',
          borderRadius: '10px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
        }}>
          <div style={{fontSize: '2rem', fontWeight: 'bold'}}>{stats.failed}</div>
          <div style={{fontSize: '0.9rem', opacity: 0.9}}>Failed Attempts</div>
        </div>
        
        <div style={{
          background: '#2196f3',
          color: 'white',
          padding: '25px',
          borderRadius: '10px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
        }}>
          <div style={{fontSize: '2rem', fontWeight: 'bold'}}>{stats.uniquePlayers}</div>
          <div style={{fontSize: '0.9rem', opacity: 0.9}}>Unique Players</div>
        </div>
        
        <div style={{
          background: '#ff9800',
          color: 'white',
          padding: '25px',
          borderRadius: '10px',
          boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
        }}>
          <div style={{fontSize: '2rem', fontWeight: 'bold'}}>{stats.total}</div>
          <div style={{fontSize: '0.9rem', opacity: 0.9}}>Total Attempts</div>
        </div>
      </div>

      {/* Controls */}
      <div style={{
        background: 'white',
        padding: '25px',
        borderRadius: '10px',
        marginBottom: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '15px',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {/* Filter Buttons */}
          <div style={{display: 'flex', gap: '10px'}}>
            <button
              onClick={() => setFilter('all')}
              style={{
                padding: '10px 20px',
                background: filter === 'all' ? '#667eea' : '#f0f0f0',
                color: filter === 'all' ? 'white' : '#333',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: '600'
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
                fontWeight: '600'
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
                fontWeight: '600'
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
              border: '2px solid #ddd',
              borderRadius: '6px',
              fontSize: '0.95rem',
              width: '250px'
            }}
          />

          {/* Sort & Export */}
          <div style={{display: 'flex', gap: '10px'}}>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              style={{
                padding: '10px 15px',
                border: '2px solid #ddd',
                borderRadius: '6px',
                fontSize: '0.95rem',
                cursor: 'pointer'
              }}
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>

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
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              📥 Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      {filteredLogs.length === 0 ? (
        <div style={{
          background: 'white',
          padding: '60px 40px',
          borderRadius: '10px',
          textAlign: 'center',
          color: '#999',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          {searchTerm ? (
            <p style={{fontSize: '1.2rem', margin: 0}}>
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
                <p style={{
                  margin: '20px 0 0 0',
                  fontSize: '0.9rem',
                  color: '#999',
                  fontStyle: 'italic'
                }}>
                  💡 All future login attempts (successful and failed) will be logged automatically!
                </p>
              </div>
            </>
          )}
        </div>
      ) : (
        <div style={{
          background: 'white',
          borderRadius: '10px',
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <div style={{overflowX: 'auto'}}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}>
              <thead>
                <tr style={{background: '#f8f9fa'}}>
                  <th style={{padding: '15px', textAlign: 'left', fontWeight: '600', color: '#666'}}>
                    Timestamp
                  </th>
                  <th style={{padding: '15px', textAlign: 'left', fontWeight: '600', color: '#666'}}>
                    Player Code
                  </th>
                  <th style={{padding: '15px', textAlign: 'left', fontWeight: '600', color: '#666'}}>
                    Player Name
                  </th>
                  <th style={{padding: '15px', textAlign: 'center', fontWeight: '600', color: '#666'}}>
                    Status
                  </th>
                  <th style={{padding: '15px', textAlign: 'left', fontWeight: '600', color: '#666'}}>
                    Error Message
                  </th>
                  <th style={{padding: '15px', textAlign: 'left', fontWeight: '600', color: '#666'}}>
                    Browser
                  </th>
                  <th style={{padding: '15px', textAlign: 'left', fontWeight: '600', color: '#666'}}>
                    Device
                  </th>
                </tr>
              </thead>
              <tbody>
                {/* 🐛 DEBUG ROW - Shows raw data */}
                {filteredLogs.length > 0 && (
                  <tr style={{background: '#fff3cd', borderBottom: '3px solid #ffc107'}}>
                    <td colSpan="7" style={{padding: '15px', fontSize: '0.85rem', fontFamily: 'monospace'}}>
                      <strong>🐛 DEBUG - First Log Object:</strong>
                      <pre style={{margin: '10px 0', overflow: 'auto', background: '#f8f9fa', padding: '10px', borderRadius: '4px'}}>
                        {JSON.stringify(filteredLogs[0], null, 2)}
                      </pre>
                    </td>
                  </tr>
                )}
                
                {filteredLogs.map((log, idx) => {
                  // 🐛 DEBUG: Log each field as we render
                  console.log(`🔍 Row ${idx}:`, {
                    timestamp: log.timestamp,
                    timestampType: typeof log.timestamp,
                    playerCode: log.playerCode,
                    playerName: log.playerName,
                    success: log.success,
                    browser: log.browser,
                    device: log.device,
                    allKeys: Object.keys(log)
                  });
                  
                  return (
                  <tr
                    key={log.id}
                    style={{
                      borderTop: '1px solid #eee',
                      background: idx % 2 === 0 ? 'white' : '#fafafa'
                    }}
                  >
                    <td style={{padding: '15px', fontSize: '0.9rem'}}>
                      {log.timestamp ? new Date(log.timestamp).toLocaleString('en-US', {
                        month: '2-digit',
                        day: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      }) : '⚠️ No timestamp'}
                    </td>
                    <td style={{padding: '15px', fontSize: '0.9rem', fontFamily: 'monospace', fontWeight: '600'}}>
                      {log.playerCode || '⚠️ Missing'}
                    </td>
                    <td style={{padding: '15px', fontSize: '0.9rem'}}>
                      {log.playerName || '⚠️ Missing'}
                    </td>
                    <td style={{padding: '15px', textAlign: 'center'}}>
                      {log.success ? (
                        <span style={{
                          background: '#d4edda',
                          color: '#155724',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          fontSize: '0.85rem',
                          fontWeight: '600'
                        }}>
                          ✓ Success
                        </span>
                      ) : (
                        <span style={{
                          background: '#f8d7da',
                          color: '#721c24',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          fontSize: '0.85rem',
                          fontWeight: '600'
                        }}>
                          ✗ Failed
                        </span>
                      )}
                    </td>
                    <td style={{padding: '15px', fontSize: '0.9rem', color: '#d32f2f', fontStyle: 'italic'}}>
                      {log.errorMessage || '-'}
                    </td>
                    <td style={{padding: '15px', fontSize: '0.9rem'}}>
                      {log.browser || '⚠️ Missing'}
                    </td>
                    <td style={{padding: '15px', fontSize: '0.9rem'}}>
                      {log.device || '⚠️ Missing'}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <div style={{
        marginTop: '30px',
        padding: '20px',
        background: '#f8f9fa',
        borderRadius: '8px',
        fontSize: '0.9rem',
        color: '#666'
      }}>
        <p style={{margin: '0 0 10px 0'}}>
          <strong>📊 Showing:</strong> {filteredLogs.length} of {stats.total} total attempts
        </p>
        <p style={{margin: '0', fontSize: '0.85rem', fontStyle: 'italic'}}>
          💡 Logs update in real-time. Failed attempts help identify players who need assistance with their codes.
        </p>
      </div>
    </div>
  );
};

export default LoginLogsViewer;
