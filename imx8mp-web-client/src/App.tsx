import React, { useState, useEffect } from 'react';
import { Container, Nav, Navbar, Badge, Card, Row, Col, Button } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

import WsTest from './components/WsTest';
import SensorsTab from './components/SensorsTab';
import FilesTab from './components/FilesTab';
import ActionsTab from './components/ActionsTab';

function App() {
  const [activeTab, setActiveTab] = useState<string>('');
  const [sensorData, setSensorData] = useState<{ [key: string]: any }>({});
  const [backendConnected, setBackendConnected] = useState(false);
  const [tabs, setTabs] = useState<any[]>([]);

  useEffect(() => {
    // Load config from backend (or local file)
    fetch('http://localhost:8000/api/config')
      .then(res => res.json())
      .then(config => {
        setTabs(config.tabs.filter((tab: any) => tab.enabled));
        setActiveTab(config.tabs.find((tab: any) => tab.enabled)?.id || '');
      });
  }, []);

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000');
    ws.onopen = () => setBackendConnected(true);
    ws.onclose = () => setBackendConnected(false);
    ws.onerror = () => setBackendConnected(false);
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'sensor_update') {
        setSensorData(prev => ({ ...prev, [msg.sensor]: msg.data }));
      }
      if (msg.type === 'init') {
        setSensorData(msg.sensors || {});
      }
    };
    return () => ws.close();
  }, []);

  const handleButtonClick = (action: string) => {
    console.log(`Button clicked: ${action}`);
    // Here you would implement the actual button actions
    switch (action) {
      case 'refresh_all_sensors':
        console.log('Refreshing sensors...');
        break;
      case 'clear_sensor_history':
        console.log('Clearing sensor history...');
        break;
      case 'upload_file':
        console.log('Opening file upload...');
        break;
      case 'list_available_files':
        console.log('Listing files...');
        break;
      default:
        console.log(`Action not implemented: ${action}`);
    }
  };

  return (
    <div className="App">
      <Navbar bg="primary" variant="dark" expand="lg" className="mb-3">
        <Container fluid>
          <Navbar.Brand>
            <i className="fas fa-server me-2"></i>
            IMX8MP Web Server
          </Navbar.Brand>
          <Navbar.Text className="ms-auto">
            <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: 12 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: backendConnected ? '#00ff00' : '#ff0000',
                  marginRight: 6,
                  border: '1px solid #222',
                }}
                title={backendConnected ? 'Connected to backend' : 'Not connected to backend'}
              ></span>
              <span style={{ color: backendConnected ? '#00ff00' : '#ff0000', fontWeight: 600 }}>
                {backendConnected ? 'Backend Connected' : 'Backend Disconnected'}
              </span>
            </span>
            <Badge bg="success">
              <i className="fas fa-cog"></i> System
            </Badge>
          </Navbar.Text>
        </Container>
      </Navbar>

      <Container fluid>
        <Nav variant="tabs" className="mb-3">
          {tabs.map(tab => (
            <Nav.Item key={tab.id}>
              <Nav.Link
                active={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="d-flex align-items-center"
              >
                <i className={`fas fa-${
                  tab.id === 'sensors' ? 'thermometer-half' :
                  tab.id === 'files' ? 'folder' : 'info-circle'
                } me-2`}></i>
                {tab.title}
              </Nav.Link>
            </Nav.Item>
          ))}
        </Nav>

        <div className="tab-content">
          {tabs.map(tab => (
            <div key={tab.id} style={{ display: activeTab === tab.id ? 'block' : 'none' }}>
              {tab.id === 'sensors' && (
                <SensorsTab config={tab} sensorData={sensorData} backendConnected={backendConnected} />
              )}
              {tab.id === 'files' && (
                <FilesTab config={tab} />
              )}
              {tab.id === 'actions' && (
                <ActionsTab config={tab} />
              )}
            </div>
          ))}
        </div>
      </Container>
    </div>
  );
}

export default App; 