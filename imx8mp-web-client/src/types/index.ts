export interface SystemInfo {
  value: string;
  description: string;
  timestamp: string;
}

export interface SensorData {
  value: string;
  description: string;
  unit: string;
  timestamp: string;
}

export interface SensorHistoryEntry {
  sensor: string;
  value: string;
  unit: string;
  timestamp: string;
}

export interface FileInfo {
  name: string;
  size: number;
  modified: string;
  type: string;
}

export interface MQTTConfig {
  host: string;
  port: number;
  client_id: string;
  topics: {
    [key: string]: {
      topic: string;
      description: string;
      unit: string;
      refresh_interval: number;
    };
  };
}

export interface TabConfig {
  title: string;
  description: string;
  enabled: boolean;
  data_sources?: {
    [key: string]: {
      type: 'system_command' | 'static';
      command?: string;
      value?: string;
      description: string;
      refresh_interval?: number;
    };
  };
  broker_config?: MQTTConfig;
  buttons?: {
    [key: string]: {
      text: string;
      action: string;
      description: string;
    };
  };
  upload_config?: {
    max_file_size: string;
    allowed_extensions: string[];
    upload_directory: string;
    publish_topic?: string;
    return_topic?: string;
  };
  download_config?: {
    download_directory: string;
    max_download_size: string;
  };
}

export interface AppConfig {
  application: {
    name: string;
    version: string;
    description: string;
  };
  tabs: {
    [key: string]: TabConfig;
  };
  server_config: {
    host: string;
    port: number;
    debug: boolean;
    log_level: string;
  };
  broker_config: {
    host: string;
    port: number;
    username: string;
    password: string;
    keepalive: number;
  };
} 