import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Table } from 'react-bootstrap';
import { TabConfig, SensorData, SensorHistoryEntry } from '../types';

interface SensorsTabProps {
  config: TabConfig & { sensors?: any[] };
  sensorData: { [key: string]: SensorData | { raw?: string; [key: string]: any } };
  backendConnected: boolean;
}

const SensorsTab: React.FC<SensorsTabProps> = ({ config, sensorData, backendConnected }) => {
  const [sensorHistory, setSensorHistory] = useState<SensorHistoryEntry[]>([]);

  useEffect(() => {
    // Update history when sensorData changes
    Object.entries(sensorData).forEach(([key, data]) => {
      if (data && data.timestamp) {
        setSensorHistory(prevHist => {
          // Avoid duplicate entries for the same timestamp/key
          if (prevHist.length > 0 && prevHist[0].sensor === key && prevHist[0].timestamp === data.timestamp) return prevHist;
          const historyEntry: SensorHistoryEntry = {
            sensor: key,
            value: data.value || (data as any).raw || '',
            unit: data.unit || '',
            timestamp: data.timestamp || new Date().toISOString(),
          };
          return [historyEntry, ...prevHist.slice(0, 49)];
        });
      }
    });
  }, [sensorData]);

  const refreshSensors = () => {
    // Optionally, trigger a backend refresh if needed
    console.log('Manual sensor refresh requested');
  };

  const clearSensorLog = () => {
    setSensorHistory([]);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div>
      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5>
            <i className="fas fa-thermometer-half me-2"></i>
            Sensor Data
          </h5>
          <div>
            <Button variant="primary" size="sm" onClick={refreshSensors} className="me-2">
              <i className="fas fa-sync-alt me-1"></i>
              Refresh
            </Button>
            <Button variant="warning" size="sm" onClick={clearSensorLog}>
              <i className="fas fa-trash me-1"></i>
              Clear Log
            </Button>
          </div>
        </Card.Header>
        <Card.Body>
          <Row className="mb-4">
            {(config.sensors ?? []).map((sensor: any) => {
              const key = sensor.topic.split('/')[1];
              const currentData = sensorData[key];
              return (
                <Col key={sensor.name} md={6} lg={4} className="mb-3">
                  <div className={`sensor-card p-3 border rounded ${key}`}> 
                    <h6 className="text-muted mb-2">{sensor.description || sensor.name}</h6>
                    <div className="value h5 mb-2">
                      {currentData ? `${currentData.value || (currentData as any).raw || ''} ${currentData.unit || ''}` : `-- ${sensor.unit}`}
                    </div>
                    <div className="timestamp small text-muted">
                      {currentData ? (currentData.timestamp ? new Date(currentData.timestamp).toLocaleString() : 'N/A') : 'Waiting for data...'}
                    </div>
                  </div>
                </Col>
              );
            })}
          </Row>

          <div className="mt-4">
            <h6>Sensor History</h6>
            <Table responsive size="sm">
              <thead>
                <tr>
                  <th>Sensor</th>
                  <th>Value</th>
                  <th>Unit</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {sensorHistory.map((entry, index) => (
                  <tr key={index}>
                    <td>{entry.sensor}</td>
                    <td>{entry.value}</td>
                    <td>{entry.unit}</td>
                    <td>{formatTimestamp(entry.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default SensorsTab; 