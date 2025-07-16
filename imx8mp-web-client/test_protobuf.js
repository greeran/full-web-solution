const mqtt = require('mqtt');
const protobuf = require('protobufjs');
const fs = require('fs');

// Load the protobuf schema
const protoContent = fs.readFileSync('./proto/sensor.proto', 'utf8');
const root = protobuf.parse(protoContent);

// Get message types
const TemperatureData = root.root.lookupType('sensor.TemperatureData');
const CompassData = root.root.lookupType('sensor.CompassData');
const GpsPositionData = root.root.lookupType('sensor.GpsPositionData');
const SensorData = root.root.lookupType('sensor.SensorData');
const StatusMessage = root.root.lookupType('sensor.StatusMessage');

// Connect to MQTT broker
const client = mqtt.connect('mqtt://localhost:1883');

client.on('connect', () => {
  console.log('✅ Connected to MQTT broker');
  
  // Start publishing protobuf messages
  setInterval(() => {
    const timestamp = Date.now();
    
    // Create and publish temperature data
    const tempData = {
      temperature: 25.5 + Math.random() * 10,
      timestamp: timestamp,
      unit: 'celsius'
    };
    const tempMessage = TemperatureData.encode(TemperatureData.create(tempData)).finish();
    client.publish('sensor/temperature', tempMessage);
    console.log('📤 Published temperature:', tempData);
    
    // Create and publish compass data
    const compassData = {
      heading: Math.random() * 360,
      timestamp: timestamp,
      unit: 'degrees'
    };
    const compassMessage = CompassData.encode(CompassData.create(compassData)).finish();
    client.publish('sensor/compass', compassMessage);
    console.log('📤 Published compass:', compassData);
    
    // Create and publish GPS data
    const gpsData = {
      position: {
        latitude: 37.7750 + (Math.random() - 0.5) * 0.001,
        longitude: -122.4190 + (Math.random() - 0.5) * 0.001,
        altitude: 100.0,
        accuracy: 5.0
      },
      timestamp: timestamp,
      unit: 'decimal_degrees'
    };
    const gpsMessage = GpsPositionData.encode(GpsPositionData.create(gpsData)).finish();
    client.publish('sensor/gps', gpsMessage);
    console.log('📤 Published GPS:', gpsData);
    
    // Create and publish combined sensor data
    const sensorData = {
      cpu_temperature: tempData.temperature,
      compass_heading: compassData.heading,
      gps: gpsData.position,
      timestamp: timestamp,
      device_id: 'test-device-001',
      version: '1.0.0'
    };
    const sensorMessage = SensorData.encode(SensorData.create(sensorData)).finish();
    client.publish('sensor/all', sensorMessage);
    console.log('📤 Published combined sensor data:', sensorData);
    
    // Create and publish status message
    const statusData = {
      status: 'ONLINE',
      device_id: 'test-device-001',
      timestamp: timestamp,
      message: 'All systems operational'
    };
    const statusMessage = StatusMessage.encode(StatusMessage.create(statusData)).finish();
    client.publish('sensor/status', statusMessage);
    console.log('📤 Published status:', statusData);
    
    console.log('---');
  }, 2000); // Publish every 2 seconds
});

client.on('error', (error) => {
  console.error('❌ MQTT Error:', error);
});

client.on('close', () => {
  console.log('🔌 MQTT connection closed');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down protobuf test publisher...');
  client.end();
  process.exit(0);
}); 