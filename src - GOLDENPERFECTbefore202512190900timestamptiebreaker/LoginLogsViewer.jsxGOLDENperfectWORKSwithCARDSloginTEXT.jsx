import React, { useState, useEffect } from 'react';
import { getDatabase, ref, onValue } from 'firebase/database';

const LoginLogsViewer = ({ isPoolManager, playerCodes }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
        setError(null);
      }, (error) => {
        console.error('❌ Error fetching login logs:', error);
        setError('Failed to load login logs.');
        setLoading(false);
      });

      return () => {
        if (unsubscribe) {
          unsubscribe();
        }
      };
    } catch (err) {
      console.error('❌ Error setting up Firebase listener:', err);
      setError('Failed to initialize Firebase.');
      setLoading(false);
    }
  }, [isPoolManager]);

  if (!isPoolManager) {
    return <div style={{padding: '40px', textAlign: 'center'}}>🔒 Pool Manager Only</div>;
  }

  if (loading) {
    return <div style={{padding: '40px', textAlign: 'center'}}>Loading...</div>;
  }

  if (error) {
    return <div style={{padding: '40px', textAlign: 'center', color: 'red'}}>{error}</div>;
  }

  const sortedLogs = [...logs].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div style={{padding: '20px', fontFamily: 'monospace', fontSize: '14px'}}>
      <h2 style={{marginBottom: '20px', color: '#000'}}>🔐 Login Activity Log (Simple View)</h2>
      
      <div style={{marginBottom: '20px', padding: '15px', background: '#f0f0f0', borderRadius: '8px'}}>
        <strong>Total Logs: {logs.length}</strong>
      </div>

      {sortedLogs.length === 0 ? (
        <div style={{padding: '40px', textAlign: 'center', background: '#fff', borderRadius: '8px'}}>
          No logs yet. Try logging in/out to create logs.
        </div>
      ) : (
        <div>
          {sortedLogs.map((log, idx) => (
            <div 
              key={log.id}
              style={{
                padding: '15px',
                marginBottom: '10px',
                background: log.success ? '#e8f5e9' : '#ffebee',
                border: '2px solid ' + (log.success ? '#4caf50' : '#f44336'),
                borderRadius: '8px',
                lineHeight: '1.8'
              }}
            >
              <div style={{fontWeight: 'bold', fontSize: '16px', marginBottom: '10px', color: '#000'}}>
                #{idx + 1} - {log.success ? '✅ SUCCESS' : '❌ FAILED'}
              </div>
              
              <div style={{color: '#000'}}>
                <strong>Time:</strong> {new Date(log.timestamp).toLocaleString()} ({log.timestamp})
              </div>
              
              <div style={{color: '#000'}}>
                <strong>Code:</strong> {log.playerCode || 'N/A'}
              </div>
              
              <div style={{color: '#000'}}>
                <strong>Name:</strong> {log.playerName || 'N/A'}
              </div>
              
              <div style={{color: '#000'}}>
                <strong>Browser:</strong> {log.browser || 'N/A'}
              </div>
              
              <div style={{color: '#000'}}>
                <strong>Device:</strong> {log.device || 'N/A'}
              </div>
              
              {log.errorMessage && (
                <div style={{color: '#d32f2f', fontWeight: 'bold', marginTop: '5px'}}>
                  <strong>Error:</strong> {log.errorMessage}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LoginLogsViewer;
