# IMX8MP Web Server - React Client

A modern React + TypeScript frontend for the IMX8MP Web Server, providing a responsive and interactive interface for system monitoring, sensor data visualization, and file management.

## Features

### 🖥️ General Information Tab
- Real-time system information display
- Machine version and application version
- CPU and memory usage monitoring
- System uptime tracking
- Auto-refresh capabilities

### 🌡️ Sensor Information Tab
- Real-time sensor data from temperature, compass, and GPS sensors
- MQTT broker integration for sensor communication
- Sensor data history and logging
- Manual refresh and clear log functionality
- Configurable sensor topics and units

### 📁 File Management Tab
- File upload and download capabilities
- File listing and management
- File deletion functionality
- Support for multiple file types
- File size and modification time display

## Technology Stack

- **Frontend**: React 18 + TypeScript
- **UI Framework**: React Bootstrap
- **Styling**: Bootstrap 5 + Custom CSS
- **MQTT Client**: MQTT.js
- **HTTP Client**: Fetch API
- **Icons**: Font Awesome 6

## Prerequisites

- Node.js 16+ and npm
- Python Flask backend server running on port 8080
- MQTT broker (Mosquitto) running on port 1883

## Installation

1. **Clone or navigate to the project directory**
   ```bash
   cd imx8mp-web-client
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

The application will be available at `http://localhost:3000`

## Configuration

The application configuration is stored in `src/config/config.json`. You can modify:

- Tab settings and visibility
- MQTT broker configuration
- Sensor topics and refresh intervals
- File upload/download settings

## Development

### Project Structure

```
src/
├── components/          # React components
│   ├── GeneralTab.tsx   # System information tab
│   ├── SensorsTab.tsx   # Sensor data tab
│   └── FilesTab.tsx     # File management tab
├── services/            # API and MQTT services
│   ├── apiService.ts    # HTTP API calls
│   └── mqttService.ts   # MQTT client
├── types/               # TypeScript interfaces
│   └── index.ts         # Type definitions
├── config/              # Configuration files
│   └── config.json      # App configuration
├── App.tsx              # Main application component
├── App.css              # Custom styles
└── index.tsx            # Application entry point
```

### Available Scripts

- `npm start` - Start development server
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run eject` - Eject from Create React App

## API Integration

The React client communicates with the Flask backend through REST API endpoints:

- `GET /api/system_info` - Get system information
- `GET /api/sensor_data` - Get current sensor data
- `GET /api/list_files` - List available files
- `POST /api/upload_file` - Upload a file
- `GET /api/download_file/<filename>` - Download a file
- `DELETE /api/delete_file/<filename>` - Delete a file

## MQTT Integration

The client connects to the MQTT broker to receive real-time sensor data:

- **Host**: localhost (configurable)
- **Port**: 1883 (configurable)
- **Topics**: 
  - `sensors/temperature`
  - `sensors/compass`
  - `sensors/gps`

## Building for Production

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Serve the built files**
   ```bash
   npx serve -s build
   ```

## Customization

### Adding New Tabs

1. Create a new component in `src/components/`
2. Add tab configuration to `src/config/config.json`
3. Import and add the component to `src/App.tsx`

### Adding New Sensors

1. Add sensor configuration to `src/config/config.json`
2. Ensure MQTT broker is publishing to the configured topics
3. The interface will automatically display new sensors

### Styling

- Custom styles are in `src/App.css`
- Bootstrap classes are available throughout the application
- Component-specific styles can be added to individual component files

## Troubleshooting

### MQTT Connection Issues
- Ensure Mosquitto broker is running
- Check firewall settings for port 1883
- Verify MQTT configuration in `config.json`

### API Connection Issues
- Ensure Flask backend is running on port 8080
- Check CORS settings in the backend
- Verify API endpoints are accessible

### Build Issues
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check TypeScript configuration in `tsconfig.json`
- Ensure all dependencies are properly installed

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License. 