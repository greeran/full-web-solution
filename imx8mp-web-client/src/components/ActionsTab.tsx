import React, { useState } from 'react';
import { Card, Row, Col, Button, Form, Alert, Spinner } from 'react-bootstrap';
import * as protobuf from 'protobufjs';

interface ActionConfig {
  button_name: string;
  publish_topic: string;
  text_input?: boolean;
  subscribe_ack_topic?: string;
}

interface ActionsTabProps {
  config: {
    id: string;
    title: string;
    actions: ActionConfig[];
    description?: string;
  };
}

// Define the protobuf message interface
interface ActionAckMessage {
  ack: string;
  success: boolean;
  error: string;
}

const ActionsTab: React.FC<ActionsTabProps> = ({ config }) => {
  const [inputs, setInputs] = useState<{ [key: number]: string }>({});
  const [loading, setLoading] = useState<{ [key: number]: boolean }>({});
  const [ack, setAck] = useState<{ [key: number]: string | null }>({});
  const [error, setError] = useState<{ [key: number]: string | null }>({});

  const handleInputChange = (idx: number, value: string) => {
    setInputs(prev => ({ ...prev, [idx]: value }));
  };

  const handleAction = async (action: ActionConfig, idx: number) => {
    setLoading(prev => ({ ...prev, [idx]: true }));
    setAck(prev => ({ ...prev, [idx]: null }));
    setError(prev => ({ ...prev, [idx]: null }));
    
    try {
      // Load protobuf schema
      const root = await protobuf.load('/proto/actions.proto');
      const ActionRequest = root.lookupType('actions.ActionRequest');
      const ActionAck = root.lookupType('actions.ActionAck');

      // Create protobuf request
      const requestData = {
        topic: action.publish_topic,
        payload: action.text_input ? inputs[idx] || '' : '',
        ack_topic: action.subscribe_ack_topic || ''
      };

      // Encode request
      const requestBuffer = ActionRequest.encode(ActionRequest.create(requestData)).finish();

      // Send request
      const res = await fetch('http://localhost:8000/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: requestBuffer
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      // Decode response
      const responseBuffer = await res.arrayBuffer();
      const ackData = ActionAck.decode(new Uint8Array(responseBuffer)) as unknown as ActionAckMessage;

      if (ackData.success) {
        setAck(prev => ({ ...prev, [idx]: ackData.ack || 'Action sent!' }));
      } else {
        setError(prev => ({ ...prev, [idx]: ackData.error || 'Action failed' }));
      }
    } catch (err: any) {
      setError(prev => ({ ...prev, [idx]: err.message || 'Network error' }));
    } finally {
      setLoading(prev => ({ ...prev, [idx]: false }));
    }
  };

  return (
    <Card>
      <Card.Header>
        <h5>
          <i className="fas fa-bolt me-2"></i>
          {config.title || 'Actions'}
        </h5>
      </Card.Header>
      <Card.Body>
        {config.description && <p className="text-muted">{config.description}</p>}
        <Row>
          {config.actions && config.actions.length > 0 ? config.actions.map((action, idx) => (
            <Col md={6} lg={4} key={idx} className="mb-4">
              <Card className="h-100">
                <Card.Body>
                  <Form.Group className="mb-3">
                    <Form.Label>{action.button_name}</Form.Label>
                    {action.text_input && (
                      <Form.Control
                        type="text"
                        placeholder="Enter value..."
                        value={inputs[idx] || ''}
                        onChange={e => handleInputChange(idx, e.target.value)}
                        className="mb-2"
                        disabled={loading[idx]}
                      />
                    )}
                    <Button
                      variant="primary"
                      onClick={() => handleAction(action, idx)}
                      disabled={loading[idx]}
                    >
                      {loading[idx] ? <Spinner size="sm" animation="border" className="me-2" /> : null}
                      {action.button_name}
                    </Button>
                  </Form.Group>
                  {ack[idx] && <Alert variant="success" className="mt-2">{ack[idx]}</Alert>}
                  {error[idx] && <Alert variant="danger" className="mt-2">{error[idx]}</Alert>}
                </Card.Body>
              </Card>
            </Col>
          )) : (
            <Col>
              <Alert variant="info">No actions configured.</Alert>
            </Col>
          )}
        </Row>
      </Card.Body>
    </Card>
  );
};

export default ActionsTab; 