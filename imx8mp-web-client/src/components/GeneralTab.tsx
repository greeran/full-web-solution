import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Spinner } from 'react-bootstrap';
import { TabConfig } from '../types';

interface GeneralTabProps {
  config: TabConfig;
}

const GeneralTab: React.FC<GeneralTabProps> = ({ config }) => {
  const [systemInfo, setSystemInfo] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSystemInfo = async () => {
    try {
      setLoading(true);
      const data = await fetch('http://localhost:8000/api/system').then(res => res.json());
      setSystemInfo(data);
      setError(null);
    } catch (err) {
      setError('Failed to load system information');
      console.error('Error loading system info:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSystemInfo();
    // Optionally, listen for real-time system updates via WebSocket
    const ws = new WebSocket('ws://localhost:8000');
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'system_update') {
        setSystemInfo(msg.data);
      }
    };
    // Set up auto-refresh for data sources that have refresh intervals
    const intervals: NodeJS.Timeout[] = [];
    Object.entries(config.data_sources || {}).forEach(([key, dataSource]) => {
      if (dataSource.refresh_interval) {
        const interval = setInterval(loadSystemInfo, dataSource.refresh_interval);
        intervals.push(interval);
      }
    });
    return () => {
      intervals.forEach(clearInterval);
      ws.close();
    };
  }, [config]);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading && Object.keys(systemInfo).length === 0) {
    return (
      <div className="text-center p-5">
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
        <p className="mt-2">Loading system information...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-5">
        <div className="alert alert-danger">
          <i className="fas fa-exclamation-triangle me-2"></i>
          {error}
        </div>
        <button className="btn btn-primary" onClick={loadSystemInfo}>
          <i className="fas fa-sync-alt me-2"></i>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <Card>
        <Card.Header>
          <h5>
            <i className="fas fa-info-circle me-2"></i>
            System Information
          </h5>
        </Card.Header>
        <Card.Body>
          <Row>
            {Object.entries(systemInfo).map(([key, value]) => (
              <Col key={key} md={6} lg={4} className="mb-3">
                <div className="info-card p-3 border rounded">
                  <h6 className="text-muted mb-2">{key}</h6>
                  <div className="value h5 mb-2">{String(value)}</div>
                  <div className="timestamp small text-muted">
                    {formatTimestamp(new Date().toISOString())}
                  </div>
                </div>
              </Col>
            ))}
          </Row>
        </Card.Body>
      </Card>
    </div>
  );
};

export default GeneralTab; 