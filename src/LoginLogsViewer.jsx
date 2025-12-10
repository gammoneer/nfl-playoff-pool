import React, { useState, useEffect } from 'react';
import { getDatabase, ref, onValue, off } from 'firebase/database';

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
  const [filter, setFilter] = useState('all'); // 'all', 'success', 'failed'
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest', 'oldest'

  // Fetch logs from Firebase
  useEffect(() => {
    if (!isPoolManager) return;

    const database = getDatabase();
    const logsRef = ref(database, 'loginLogs');
    
    const unsubscribe = onValue(logsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const logsArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setLogs(logsArray);
      } else {
        setLogs([]);
      }
      setLoading(false);
    });

    return () => off(logsRef, 'value', unsubscribe);
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
      <div style={{padding: '40px', textAlign: 'center'}}>
        <p>Loading login logs...</p>
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
          padding: '60px',
          borderRadius: '10px',
          textAlign: 'center',
          color: '#999',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <p style={{fontSize: '1.2rem', margin: 0}}>
            {searchTerm ? '🔍 No logs match your search' : '📭 No login attempts yet'}
          </p>
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
                {filteredLogs.map((log, idx) => (
                  <tr
                    key={log.id}
                    style={{
                      borderTop: '1px solid #eee',
                      background: idx % 2 === 0 ? 'white' : '#fafafa'
                    }}
                  >
                    <td style={{padding: '15px', fontSize: '0.9rem'}}>
                      {new Date(log.timestamp).toLocaleString('en-US', {
                        month: '2-digit',
                        day: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </td>
                    <td style={{padding: '15px', fontSize: '0.9rem', fontFamily: 'monospace', fontWeight: '600'}}>
                      {log.playerCode || '-'}
                    </td>
                    <td style={{padding: '15px', fontSize: '0.9rem'}}>
                      {log.playerName || '-'}
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
                      {log.browser || '-'}
                    </td>
                    <td style={{padding: '15px', fontSize: '0.9rem'}}>
                      {log.device || '-'}
                    </td>
                  </tr>
                ))}
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
