#!/usr/bin/env python3
"""
IMX8MP Web Server
A multi-tab web server for IMX8MP and Ubuntu systems with sensor data, video streaming, and file management.
"""

import os
import json
import subprocess
import threading
import time
import logging
from datetime import datetime
from flask import Flask, render_template, request, jsonify, send_file, Response
from flask_socketio import SocketIO, emit
from werkzeug.utils import secure_filename
import paho.mqtt.client as mqtt
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class IMX8MPWebServer:
    def __init__(self, config_file="config.json"):
        self.app = Flask(__name__)
        self.app.config['SECRET_KEY'] = 'imx8mp_web_server_secret_key'
        self.app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size
        
        self.socketio = SocketIO(self.app, cors_allowed_origins="*")
        self.config = self.load_config(config_file)
        self.mqtt_client = None
        self.sensor_data = {}
        self.video_stream_active = False
        self.video_process = None
        
        # Create necessary directories
        self.create_directories()
        
        # Setup routes
        self.setup_routes()
        
        # Setup MQTT client
        self.setup_mqtt()
        
        # Start background tasks
        self.start_background_tasks()
    
    def load_config(self, config_file):
        """Load configuration from JSON file"""
        try:
            with open(config_file, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            logger.error(f"Configuration file {config_file} not found")
            return {}
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON in configuration file {config_file}")
            return {}
    
    def create_directories(self):
        """Create necessary directories for uploads and downloads"""
        upload_dir = self.config.get('tabs', {}).get('files', {}).get('upload_config', {}).get('upload_directory', './uploads')
        download_dir = self.config.get('tabs', {}).get('files', {}).get('download_config', {}).get('download_directory', './downloads')
        
        Path(upload_dir).mkdir(parents=True, exist_ok=True)
        Path(download_dir).mkdir(parents=True, exist_ok=True)
    
    def setup_routes(self):
        """Setup Flask routes"""
        
        @self.app.route('/')
        def index():
            return render_template('index.html', config=self.config)
        
        @self.app.route('/api/system_info')
        def get_system_info():
            """Get system information for General tab"""
            try:
                system_info = {}
                general_config = self.config.get('tabs', {}).get('general', {})
                
                for key, data_source in general_config.get('data_sources', {}).items():
                    if data_source.get('type') == 'system_command':
                        try:
                            result = subprocess.run(
                                data_source['command'], 
                                shell=True, 
                                capture_output=True, 
                                text=True, 
                                timeout=5
                            )
                            system_info[key] = {
                                'value': result.stdout.strip(),
                                'description': data_source.get('description', ''),
                                'timestamp': datetime.now().isoformat()
                            }
                        except (subprocess.TimeoutExpired, subprocess.CalledProcessError) as e:
                            system_info[key] = {
                                'value': f"Error: {str(e)}",
                                'description': data_source.get('description', ''),
                                'timestamp': datetime.now().isoformat()
                            }
                    elif data_source.get('type') == 'static':
                        system_info[key] = {
                            'value': data_source.get('value', ''),
                            'description': data_source.get('description', ''),
                            'timestamp': datetime.now().isoformat()
                        }
                
                return jsonify(system_info)
            except Exception as e:
                logger.error(f"Error getting system info: {e}")
                return jsonify({'error': str(e)}), 500
        
        @self.app.route('/api/sensor_data')
        def get_sensor_data():
            """Get current sensor data"""
            return jsonify(self.sensor_data)
        
        @self.app.route('/api/start_video_stream', methods=['POST'])
        def start_video_stream():
            """Start RTSP video stream"""
            try:
                data = request.get_json()
                rtsp_url = data.get('rtsp_url', 'rtsp://localhost:8554/stream')
                
                if self.video_stream_active:
                    return jsonify({'error': 'Video stream already active'}), 400
                
                # Start video stream process (placeholder - you'll need to implement actual video streaming)
                self.video_stream_active = True
                logger.info(f"Starting video stream from: {rtsp_url}")
                
                return jsonify({'status': 'success', 'message': 'Video stream started'})
            except Exception as e:
                logger.error(f"Error starting video stream: {e}")
                return jsonify({'error': str(e)}), 500
        
        @self.app.route('/api/stop_video_stream', methods=['POST'])
        def stop_video_stream():
            """Stop RTSP video stream"""
            try:
                if self.video_process:
                    self.video_process.terminate()
                    self.video_process = None
                
                self.video_stream_active = False
                logger.info("Video stream stopped")
                
                return jsonify({'status': 'success', 'message': 'Video stream stopped'})
            except Exception as e:
                logger.error(f"Error stopping video stream: {e}")
                return jsonify({'error': str(e)}), 500
        
        @self.app.route('/api/upload_file', methods=['POST'])
        def upload_file():
            """Handle file upload"""
            try:
                if 'file' not in request.files:
                    return jsonify({'error': 'No file provided'}), 400
                
                file = request.files['file']
                if file.filename == '':
                    return jsonify({'error': 'No file selected'}), 400
                
                if file:
                    filename = secure_filename(file.filename)
                    upload_dir = self.config.get('tabs', {}).get('files', {}).get('upload_config', {}).get('upload_directory', './uploads')
                    file_path = os.path.join(upload_dir, filename)
                    file.save(file_path)
                    
                    logger.info(f"File uploaded: {filename}")
                    return jsonify({'status': 'success', 'filename': filename})
            except Exception as e:
                logger.error(f"Error uploading file: {e}")
                return jsonify({'error': str(e)}), 500
        
        @self.app.route('/api/list_files')
        def list_files():
            """List available files for download"""
            try:
                download_dir = self.config.get('tabs', {}).get('files', {}).get('download_config', {}).get('download_directory', './downloads')
                upload_dir = self.config.get('tabs', {}).get('files', {}).get('upload_config', {}).get('upload_directory', './uploads')
                
                files = []
                
                # List files from both directories
                for directory in [download_dir, upload_dir]:
                    if os.path.exists(directory):
                        for filename in os.listdir(directory):
                            file_path = os.path.join(directory, filename)
                            if os.path.isfile(file_path):
                                stat = os.stat(file_path)
                                files.append({
                                    'name': filename,
                                    'size': stat.st_size,
                                    'modified': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                                    'directory': directory
                                })
                
                return jsonify(files)
            except Exception as e:
                logger.error(f"Error listing files: {e}")
                return jsonify({'error': str(e)}), 500
        
        @self.app.route('/api/download_file/<filename>')
        def download_file(filename):
            """Download a file"""
            try:
                download_dir = self.config.get('tabs', {}).get('files', {}).get('download_config', {}).get('download_directory', './downloads')
                upload_dir = self.config.get('tabs', {}).get('files', {}).get('upload_config', {}).get('upload_directory', './uploads')
                
                # Check both directories
                for directory in [download_dir, upload_dir]:
                    file_path = os.path.join(directory, filename)
                    if os.path.exists(file_path):
                        return send_file(file_path, as_attachment=True)
                
                return jsonify({'error': 'File not found'}), 404
            except Exception as e:
                logger.error(f"Error downloading file: {e}")
                return jsonify({'error': str(e)}), 500
        
        @self.app.route('/api/delete_file/<filename>', methods=['DELETE'])
        def delete_file(filename):
            """Delete a file"""
            try:
                download_dir = self.config.get('tabs', {}).get('files', {}).get('download_config', {}).get('download_directory', './downloads')
                upload_dir = self.config.get('tabs', {}).get('files', {}).get('upload_config', {}).get('upload_directory', './uploads')
                
                # Check both directories
                for directory in [download_dir, upload_dir]:
                    file_path = os.path.join(directory, filename)
                    if os.path.exists(file_path):
                        os.remove(file_path)
                        logger.info(f"File deleted: {filename}")
                        return jsonify({'status': 'success', 'message': f'File {filename} deleted'})
                
                return jsonify({'error': 'File not found'}), 404
            except Exception as e:
                logger.error(f"Error deleting file: {e}")
                return jsonify({'error': str(e)}), 500
    
    def setup_mqtt(self):
        """Setup MQTT client for sensor data"""
        try:
            broker_config = self.config.get('broker_config', {})
            self.mqtt_client = mqtt.Client(client_id=broker_config.get('client_id', 'web_server'))
            
            if broker_config.get('username'):
                self.mqtt_client.username_pw_set(broker_config['username'], broker_config.get('password', ''))
            
            self.mqtt_client.on_connect = self.on_mqtt_connect
            self.mqtt_client.on_message = self.on_mqtt_message
            
            # Connect to broker
            self.mqtt_client.connect(
                broker_config.get('host', 'localhost'),
                broker_config.get('port', 1883),
                broker_config.get('keepalive', 60)
            )
            
            # Start MQTT loop in a separate thread
            mqtt_thread = threading.Thread(target=self.mqtt_client.loop_forever, daemon=True)
            mqtt_thread.start()
            
            logger.info("MQTT client started")
        except Exception as e:
            logger.error(f"Error setting up MQTT: {e}")
    
    def on_mqtt_connect(self, client, userdata, flags, rc):
        """MQTT connection callback"""
        if rc == 0:
            logger.info("Connected to MQTT broker")
            # Subscribe to sensor topics
            sensors_config = self.config.get('tabs', {}).get('sensors', {}).get('broker_config', {}).get('topics', {})
            for sensor_name, sensor_config in sensors_config.items():
                topic = sensor_config.get('topic')
                if topic:
                    client.subscribe(topic)
                    logger.info(f"Subscribed to topic: {topic}")
        else:
            logger.error(f"Failed to connect to MQTT broker with code: {rc}")
    
    def on_mqtt_message(self, client, userdata, msg):
        """MQTT message callback"""
        try:
            topic = msg.topic
            payload = msg.payload.decode('utf-8')
            
            # Find sensor name from topic
            sensors_config = self.config.get('tabs', {}).get('sensors', {}).get('broker_config', {}).get('topics', {})
            for sensor_name, sensor_config in sensors_config.items():
                if sensor_config.get('topic') == topic:
                    self.sensor_data[sensor_name] = {
                        'value': payload,
                        'unit': sensor_config.get('unit', ''),
                        'description': sensor_config.get('description', ''),
                        'timestamp': datetime.now().isoformat()
                    }
                    
                    # Emit to WebSocket clients
                    self.socketio.emit('sensor_update', {
                        'sensor': sensor_name,
                        'data': self.sensor_data[sensor_name]
                    })
                    break
            
            logger.debug(f"Received MQTT message on {topic}: {payload}")
        except Exception as e:
            logger.error(f"Error processing MQTT message: {e}")
    
    def start_background_tasks(self):
        """Start background tasks for periodic updates"""
        def system_info_updater():
            while True:
                try:
                    # Emit system info updates via WebSocket
                    general_config = self.config.get('tabs', {}).get('general', {})
                    for key, data_source in general_config.get('data_sources', {}).items():
                        if data_source.get('type') == 'system_command':
                            try:
                                result = subprocess.run(
                                    data_source['command'], 
                                    shell=True, 
                                    capture_output=True, 
                                    text=True, 
                                    timeout=5
                                )
                                self.socketio.emit('system_update', {
                                    'key': key,
                                    'value': result.stdout.strip(),
                                    'description': data_source.get('description', ''),
                                    'timestamp': datetime.now().isoformat()
                                })
                            except Exception as e:
                                logger.error(f"Error updating system info for {key}: {e}")
                    
                    time.sleep(5)  # Update every 5 seconds
                except Exception as e:
                    logger.error(f"Error in system info updater: {e}")
                    time.sleep(10)
        
        # Start background thread
        background_thread = threading.Thread(target=system_info_updater, daemon=True)
        background_thread.start()
    
    def run(self):
        """Run the web server"""
        server_config = self.config.get('server_config', {})
        host = server_config.get('host', '0.0.0.0')
        port = server_config.get('port', 8080)
        debug = server_config.get('debug', False)
        
        logger.info(f"Starting IMX8MP Web Server on {host}:{port}")
        self.socketio.run(self.app, host=host, port=port, debug=debug)

if __name__ == '__main__':
    server = IMX8MPWebServer()
    server.run() 