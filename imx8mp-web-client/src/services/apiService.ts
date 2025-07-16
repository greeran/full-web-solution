import { SystemInfo, FileInfo } from '../types';

const API_BASE_URL = 'http://localhost:8080/api';

class ApiService {
  async getSystemInfo(): Promise<{ [key: string]: SystemInfo }> {
    try {
      const response = await fetch(`${API_BASE_URL}/system_info`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching system info:', error);
      throw error;
    }
  }

  async getSensorData(): Promise<{ [key: string]: any }> {
    try {
      const response = await fetch(`${API_BASE_URL}/sensor_data`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching sensor data:', error);
      throw error;
    }
  }

  async listFiles(): Promise<FileInfo[]> {
    try {
      const response = await fetch(`${API_BASE_URL}/list_files`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error('Error listing files:', error);
      throw error;
    }
  }

  async uploadFile(file: File): Promise<{ status: string; filename: string }> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/upload_file`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  async downloadFile(filename: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/download_file/${filename}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading file:', error);
      throw error;
    }
  }

  async deleteFile(filename: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE_URL}/delete_file/${filename}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  async startVideoStream(rtspUrl: string): Promise<{ status: string; message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/start_video_stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rtsp_url: rtspUrl }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error starting video stream:', error);
      throw error;
    }
  }

  async stopVideoStream(): Promise<{ status: string; message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}/stop_video_stream`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error stopping video stream:', error);
      throw error;
    }
  }
}

export const apiService = new ApiService(); 