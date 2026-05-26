import { useState, useEffect, useCallback, useRef } from 'react';

export const useWebSocket = (url) => {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('connecting');
  const ws = useRef(null);

  const connect = useCallback(() => {
    setStatus('connecting');
    ws.current = new WebSocket(url);

    ws.current.onopen = () => {
      setStatus('connected');
      console.log('WebSocket Connected');
    };

    ws.current.onmessage = (event) => {
      const message = JSON.parse(event.data);
      setData(message);
    };

    ws.current.onclose = () => {
      setStatus('disconnected');
      console.log('WebSocket Disconnected');
      // Simple reconnect logic
      setTimeout(connect, 3000);
    };

    ws.current.onerror = (err) => {
      console.error('WebSocket Error Object:', err);
      console.error('WebSocket ReadyState:', ws.current.readyState);
      ws.current.close();
    };
  }, [url]);

  useEffect(() => {
    connect();
    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [connect]);

  const send = useCallback((message) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  }, []);

  return { data, status, send };
};
