import { useEffect, useRef, useState } from 'react';

interface LogViewerProps {
  title: string;
  streamFactory: () => WebSocket;
  onClose?: () => void;
}

function LogViewer({ title, streamFactory, onClose }: LogViewerProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const socket = streamFactory();
    socketRef.current = socket;
    socket.onmessage = (event) => {
      setLines((prev) => [...prev, event.data as string].slice(-500));
    };
    socket.onerror = () => setError('Unable to stream logs');
    socket.onclose = () => {
      socketRef.current = null;
    };

    return () => {
      socket.close();
    };
  }, [streamFactory]);

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="log-header">
        <strong>{title}</strong>
        <div className="actions">
          {onClose ? (
            <button className="button" onClick={onClose}>
              Close
            </button>
          ) : null}
          <button
            className="button"
            onClick={() => {
              setLines([]);
            }}
          >
            Clear
          </button>
        </div>
      </div>
      <div className="log-viewer" aria-live="polite">
        {error ? <div className="badge danger">{error}</div> : lines.join('\n') || 'Connecting to log stream...'}
      </div>
    </div>
  );
}

export default LogViewer;
