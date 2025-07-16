import React, { useEffect, useState } from 'react';

const WsTest: React.FC = () => {
  const [status, setStatus] = useState('Connecting...');
  const [lastMsg, setLastMsg] = useState('');

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000');
    ws.onopen = () => setStatus('Connected');
    ws.onclose = () => setStatus('Disconnected');
    ws.onerror = () => setStatus('Error');
    ws.onmessage = (event) => setLastMsg(event.data);
    return () => ws.close();
  }, []);

  return (
    <div style={{ padding: 16, background: '#eee', margin: 16 }}>
      <strong>WebSocket Test:</strong>
      <div>Status: {status}</div>
      <div>Last message: <pre>{lastMsg}</pre></div>
    </div>
  );
};

export default WsTest; 