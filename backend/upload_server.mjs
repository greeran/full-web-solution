import express from 'express';
import multer from 'multer';
import cors from 'cors';
import mqtt from 'mqtt';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { WebSocketServer } from 'ws';
import * as sensorProto from './sensor_pb.js';
import * as fileopsProto from './fileops_pb.js';
import * as actionsProto from './actions_pb.js';
import config from './config.json' assert { type: 'json' };

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const filesTab = config.tabs.find(tab => tab.id === 'files');
const UPLOAD_DIR = filesTab?.upload?.upload_directory
  ? path.isAbsolute(filesTab.upload.upload_directory)
    ? filesTab.upload.upload_directory
    : path.join(__dirname, filesTab.upload.upload_directory)
  : path.join(__dirname, 'uploads');
const ALLOWED_EXTENSIONS = filesTab?.upload?.allowed_extensions || [];

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, file.originalname),
});
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname);
  if (ALLOWED_EXTENSIONS.includes(ext)) cb(null, true);
  else cb(new Error('File type not allowed'), false);
};
const upload = multer({ storage, fileFilter });

const app = express();
app.use(cors());

let latestSensorData = {};

function updateLatestSensorData(topic, formatted) {
  // Map topic to generic key
  let key = topic.split('/')[1] || topic;
  latestSensorData[key] = formatted;
}

app.get('/api/files', (req, res) => {
  fs.readdir(UPLOAD_DIR, (err, files) => {
    if (err) return res.status(500).json({ error: 'Failed to list files' });
    const fileList = files.map(filename => {
      const stats = fs.statSync(path.join(UPLOAD_DIR, filename));
      return {
        filename,
        size: stats.size,
        modified: stats.mtime
      };
    });
    res.json(fileList);
  });
});

app.delete('/api/delete/:filename', (req, res) => {
  const filePath = path.join(UPLOAD_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  fs.unlink(filePath, err => {
    if (err) return res.status(500).json({ error: 'Failed to delete file' });
    res.json({ success: true });
  });
});

app.get('/api/sensors', (req, res) => {
  res.json(latestSensorData);
});

app.get('/api/system', async (req, res) => {
  const exec = (await import('child_process')).exec;
  const getCmd = cmd => new Promise(resolve => exec(cmd, (err, out) => resolve(out ? out.trim() : '')));
  const uptime = await getCmd('uptime');
  const cpu = await getCmd("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1");
  const mem = await getCmd("free -m | awk 'NR==2{printf \"%.1f%%\", $3*100/$2}'");
  broadcastWS({ type: 'system_update', data: { uptime, cpu, memory: mem } });
  res.json({ uptime, cpu, memory: mem });
});

app.get('/api/config', (req, res) => res.json(config));

// --- Protobuf Upload Endpoint ---
app.post('/api/upload', express.raw({ type: 'application/octet-stream', limit: '20mb' }), (req, res) => {
  try {
    const uploadMsg = fileopsProto.decodeFileUpload(new Uint8Array(req.body));
    const filename = uploadMsg.filename;
    const data = uploadMsg.data;
    const filePath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(filePath, Buffer.from(data));
    const responseBuffer = fileopsProto.encodeFileDownloadResponse({
      filename,
      data: new Uint8Array(),
      success: true,
      error: ''
    });
    console.log('Sending upload response buffer:', responseBuffer);
    res.set('Content-Type', 'application/octet-stream');
    res.send(responseBuffer);
  } catch (err) {
    console.error('Upload error:', err);
    const responseBuffer = fileopsProto.encodeFileDownloadResponse({
      filename: '',
      data: new Uint8Array(),
      success: false,
      error: err.message || 'Upload failed'
    });
    console.log('Sending upload error response buffer:', responseBuffer);
    res.set('Content-Type', 'application/octet-stream');
    res.send(responseBuffer);
  }
});

// --- Protobuf Download Endpoint ---
app.post('/api/download', express.raw({ type: 'application/octet-stream', limit: '2mb' }), (req, res) => {
  try {
    const downloadReq = fileopsProto.decodeFileDownloadRequest(new Uint8Array(req.body));
    const filename = downloadReq.filename;
    const filePath = path.join(UPLOAD_DIR, filename);
    if (!fs.existsSync(filePath)) throw new Error('File not found');
    const fileBuffer = fs.readFileSync(filePath);
    const responseBuffer = fileopsProto.encodeFileDownloadResponse({
      filename,
      data: fileBuffer,
      success: true,
      error: ''
    });
    res.set('Content-Type', 'application/octet-stream');
    res.send(responseBuffer);
  } catch (err) {
    const responseBuffer = fileopsProto.encodeFileDownloadResponse({
      filename: '',
      data: new Uint8Array(),
      success: false,
      error: err.message || 'Download failed'
    });
    res.set('Content-Type', 'application/octet-stream');
    res.send(responseBuffer);
  }
});

// --- Protobuf Actions Endpoint ---
app.post('/api/action', express.raw({ type: 'application/octet-stream', limit: '1mb' }), (req, res) => {
  try {
    const actionReq = actionsProto.decodeActionRequest(new Uint8Array(req.body));
    mqttClient.publish(actionReq.topic, actionReq.payload || '');
    if (actionReq.ack_topic) {
      let responded = false;
      const ackHandler = (ackTopic, message) => {
        if (ackTopic === actionReq.ack_topic) {
          responded = true;
          mqttClient.removeListener('message', ackHandler);
          const ackBuffer = actionsProto.encodeActionAck({
            ack: message.toString(),
            success: true,
            error: ''
          });
          res.set('Content-Type', 'application/octet-stream');
          res.send(ackBuffer);
        }
      };
      mqttClient.on('message', ackHandler);
      setTimeout(() => {
        if (!responded) {
          mqttClient.removeListener('message', ackHandler);
          const ackBuffer = actionsProto.encodeActionAck({
            ack: '',
            success: false,
            error: 'Ack timeout'
          });
          res.set('Content-Type', 'application/octet-stream');
          res.send(ackBuffer);
        }
      }, 5000);
    } else {
      const ackBuffer = actionsProto.encodeActionAck({
        ack: 'Action sent',
        success: true,
        error: ''
      });
      res.set('Content-Type', 'application/octet-stream');
      res.send(ackBuffer);
    }
  } catch (err) {
    const ackBuffer = actionsProto.encodeActionAck({
      ack: '',
      success: false,
      error: err.message || 'Action failed'
    });
    res.set('Content-Type', 'application/octet-stream');
    res.send(ackBuffer);
  }
});

// --- File browser endpoint ---
app.get('/api/browse', (req, res) => {
  const filesTab = config.tabs.find(tab => tab.id === 'files');
  const rootDir = filesTab?.download?.root_directory
    ? path.isAbsolute(filesTab.download.root_directory)
      ? filesTab.download.root_directory
      : path.join(__dirname, filesTab.download.root_directory)
    : path.join(__dirname, 'uploads');

  // Get requested path, default to root
  let relPath = req.query.path || '';
  // Prevent directory traversal
  relPath = relPath.replace(/\\/g, '/').replace(/\.\./g, '');
  const absPath = path.join(rootDir, relPath);
  if (!absPath.startsWith(rootDir)) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  fs.readdir(absPath, { withFileTypes: true }, (err, entries) => {
    if (err) return res.status(500).json({ error: 'Failed to list directory' });
    const directories = entries.filter(e => e.isDirectory()).map(e => e.name);
    const files = entries.filter(e => e.isFile()).map(e => e.name);
    res.json({
      path: relPath,
      directories,
      files
    });
  });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'init', sensors: latestSensorData }));
});

function broadcastWS(msg) {
  const data = typeof msg === 'string' ? msg : JSON.stringify(msg);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(data);
  });
}

function formatSensorData(topic, parsed) {
  if (topic === 'sensor/gps' && parsed.position) {
    return {
      value: `${parsed.position.latitude.toFixed(6)}, ${parsed.position.longitude.toFixed(6)}`,
      unit: parsed.unit || 'decimal_degrees',
      timestamp: new Date().toISOString(),
      description: 'GPS Location'
    };
  }
  if (topic === 'sensor/temperature' && parsed.temperature !== undefined) {
    return {
      value: parsed.temperature,
      unit: parsed.unit || '°C',
      timestamp: new Date().toISOString(),
      description: 'CPU Temperature'
    };
  }
  if (topic === 'sensor/compass' && parsed.heading !== undefined) {
    return {
      value: parsed.heading,
      unit: parsed.unit || 'degrees',
      timestamp: new Date().toISOString(),
      description: 'Compass Heading'
    };
  }
  if (topic === 'sensor/status' && parsed.status !== undefined) {
    // Status enum mapping
    const statusMap = ['UNKNOWN', 'ONLINE', 'OFFLINE', 'ERROR'];
    return {
      value: statusMap[parsed.status] || 'UNKNOWN',
      device_id: parsed.device_id || '',
      message: parsed.message || '',
      timestamp: parsed.timestamp ? new Date(Number(parsed.timestamp)).toISOString() : new Date().toISOString(),
      description: 'Sensor Status'
    };
  }
  return parsed;
}

const mqttClient = mqtt.connect(`mqtt://${config.broker.host}:${config.broker.port}`);
mqttClient.on('connect', () => {
  console.log('Connected to MQTT broker');
  mqttClient.subscribe('sensor/#');
});
mqttClient.on('message', (topic, message) => {
  // console.log(`MQTT message on ${topic}:`, message);
  if (topic.startsWith('sensor/')) {
    let parsed;
    try {
      if (topic === 'sensor/temperature' && sensorProto.decodeTemperatureData) {
        parsed = sensorProto.decodeTemperatureData(message);
      } else if (topic === 'sensor/compass' && sensorProto.decodeCompassData) {
        parsed = sensorProto.decodeCompassData(message);
      } else if (topic === 'sensor/gps' && sensorProto.decodeGpsPositionData) {
        parsed = sensorProto.decodeGpsPositionData(message);
      } else if (topic === 'sensor/status' && sensorProto.decodeStatusMessage) {
        parsed = sensorProto.decodeStatusMessage(message);
      } else {
        parsed = { raw: message.toString('base64') };
      }
    } catch (e) {
      parsed = { raw: message.toString('base64'), error: e.message };
    }
    const formatted = formatSensorData(topic, parsed);
    updateLatestSensorData(topic, formatted);
    broadcastWS({ type: 'sensor_update', sensor: topic.split('/')[1], data: formatted });
  }
});

const PORT = 8000;
server.listen(PORT, () => console.log(`Backend server running at http://localhost:${PORT}`)); 