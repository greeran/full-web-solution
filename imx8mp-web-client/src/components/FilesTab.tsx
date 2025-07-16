import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Button, Form, Alert, Table, Modal } from 'react-bootstrap';
import { TabConfig } from '../types';

interface FilesTabProps {
  config: TabConfig & { upload?: any };
}

const FilesTab: React.FC<FilesTabProps> = ({ config }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [refreshFlag, setRefreshFlag] = useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [showBrowser, setShowBrowser] = useState(false);
  const [browserPath, setBrowserPath] = useState('');
  const [browserDirs, setBrowserDirs] = useState<string[]>([]);
  const [browserFiles, setBrowserFiles] = useState<string[]>([]);
  const [browserSelected, setBrowserSelected] = useState<string | null>(null);
  const [browserLoading, setBrowserLoading] = useState(false);
  const [browserError, setBrowserError] = useState<string | null>(null);

  const allowedExtensions = (config.upload?.allowed_extensions ?? []);

  useEffect(() => {
    fetch('http://localhost:8000/api/files')
      .then(res => res.json())
      .then(setFiles)
      .catch(() => setFiles([]));
  }, [refreshFlag]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      const ext = file.name.substring(file.name.lastIndexOf('.'));
      if (!allowedExtensions.includes(ext)) {
        setError(`File type not allowed. Allowed: ${allowedExtensions.join(', ')}`);
        setSelectedFile(null);
        return;
      }
      setError(null);
      setSelectedFile(file);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a file to upload.');
      return;
    }
    setUploading(true);
    setError(null);
    setUploadResult(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const response = await fetch('http://localhost:8000/api/upload', {
        method: 'POST',
        body: formData,
      });
      const result = await response.json();
      setUploadResult(result);
      setRefreshFlag(f => f + 1); // Refresh file list
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setSelectedFile(null);
    }
  };

  const handleDelete = async (filename: string) => {
    await fetch(`http://localhost:8000/api/delete/${filename}`, { method: 'DELETE' });
    setRefreshFlag(f => f + 1);
  };

  // File browser logic
  const loadBrowser = (path = '') => {
    setBrowserLoading(true);
    setBrowserError(null);
    fetch(`http://localhost:8000/api/browse?path=${encodeURIComponent(path)}`)
      .then(res => res.json())
      .then(data => {
        setBrowserPath(data.path || '');
        setBrowserDirs(data.directories || []);
        setBrowserFiles(data.files || []);
        setBrowserSelected(null);
        setBrowserLoading(false);
      })
      .catch(err => {
        setBrowserError('Failed to load directory');
        setBrowserLoading(false);
      });
  };

  const handleOpenBrowser = () => {
    setShowBrowser(true);
    loadBrowser('');
  };
  const handleCloseBrowser = () => {
    setShowBrowser(false);
    setBrowserPath('');
    setBrowserDirs([]);
    setBrowserFiles([]);
    setBrowserSelected(null);
    setBrowserError(null);
  };
  const handleBrowserDirClick = (dir: string) => {
    loadBrowser(browserPath ? `${browserPath.replace(/\/$/, '')}/${dir}` : dir);
  };
  const handleBrowserUp = () => {
    if (!browserPath) return;
    const parts = browserPath.split('/').filter(Boolean);
    parts.pop();
    loadBrowser(parts.join('/'));
  };
  const handleBrowserFileClick = (file: string) => {
    setBrowserSelected(file);
  };
  const handleBrowserDownload = () => {
    if (!browserSelected) return;
    const fullPath = browserPath ? `${browserPath.replace(/\/$/, '')}/${browserSelected}` : browserSelected;
    window.open(`http://localhost:8000/api/download/${encodeURIComponent(fullPath)}`);
    setTimeout(() => alert('File downloaded! Check your browser\'s Downloads folder.'), 500);
    handleCloseBrowser();
  };

  return (
    <div>
      <Card>
        <Card.Header>
          <h5>
            <i className="fas fa-folder me-2"></i>
            {config.title}
          </h5>
        </Card.Header>
        <Card.Body>
          <p className="text-muted">{config.description}</p>
          <Row className="mb-4">
            <Col md={6}>
              <h6>Upload Files</h6>
              <div className="mb-2 text-muted" style={{ fontSize: '0.95em' }}>
                Note: Only files of type {allowedExtensions.join(', ')} are allowed. If you see an 'All Files' option, it is a browser feature, but only allowed types will be accepted.
              </div>
              <Button variant="info" className="mb-3" onClick={handleOpenBrowser}>
                <i className="fas fa-folder-open me-2"></i>Pick File to Download
              </Button>
              <Form onSubmit={handleUpload}>
                <Form.Group className="mb-3">
                  <Form.Control
                    type="file"
                    accept={allowedExtensions.length > 0 ? allowedExtensions.join(',') : undefined}
                    onChange={handleFileChange}
                    disabled={uploading}
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="me-2"
                  >
                    <i className="fas fa-folder-open me-2"></i>
                    Open File Picker
                  </Button>
                  <span>{selectedFile ? selectedFile.name : 'No file selected'}</span>
                </Form.Group>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!selectedFile || uploading}
                >
                  {uploading ? (
                    <>
                      <i className="fas fa-spinner fa-spin me-2"></i>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-upload me-2"></i>
                      Upload File
                    </>
                  )}
                </Button>
              </Form>
              {error && <Alert variant="danger" className="mt-3">{error}</Alert>}
              {uploadResult && (
                <Alert variant={uploadResult.success ? 'success' : 'danger'} className="mt-3">
                  {uploadResult.success ? (
                    <>
                      <strong>Upload successful!</strong><br />
                      File: {uploadResult.filename}<br />
                      Path: {uploadResult.full_path}
                    </>
                  ) : (
                    <>
                      <strong>Upload failed:</strong> {uploadResult.error_message}
                    </>
                  )}
                </Alert>
              )}
            </Col>
            <Col md={6}>
              <h6>Uploaded Files</h6>
              <Table size="sm" bordered hover>
                <thead>
                  <tr>
                    <th>Filename</th>
                    <th>Size</th>
                    <th>Modified</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map(file => (
                    <tr key={file.filename}>
                      <td>{file.filename}</td>
                      <td>{file.size} bytes</td>
                      <td>{new Date(file.modified).toLocaleString()}</td>
                      <td>
                        <a
                          href={`http://localhost:8000/api/download/${file.filename}`}
                          className="btn btn-sm btn-success me-2"
                          download={file.filename}
                          onClick={() => setTimeout(() => alert('File downloaded! Check your browser\'s Downloads folder.'), 500)}
                        >
                          <i className="fas fa-download"></i>
                        </a>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleDelete(file.filename)}
                        >
                          <i className="fas fa-trash"></i>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <h6 className="mt-4">Configuration</h6>
              <div className="small text-muted">
                <p><strong>Allowed Extensions:</strong> {allowedExtensions.join(', ')}</p>
                <p><strong>Max Upload Size:</strong> {config.upload_config?.max_file_size}</p>
                <p><strong>Upload Directory:</strong> (internal only)</p>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Modal show={showBrowser} onHide={handleCloseBrowser} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Browse Server Files</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {browserError && <Alert variant="danger">{browserError}</Alert>}
          <div style={{ minHeight: 200 }}>
            <div className="mb-2">
              <strong>Current Path:</strong> /{browserPath}
              {browserPath && (
                <Button variant="link" size="sm" onClick={handleBrowserUp} style={{ marginLeft: 10 }}>
                  <i className="fas fa-level-up-alt"></i> Up
                </Button>
              )}
            </div>
            {browserLoading ? (
              <div>Loading...</div>
            ) : (
              <div style={{ display: 'flex', gap: 32 }}>
                <div style={{ minWidth: 200 }}>
                  <strong>Folders</strong>
                  <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                    {browserDirs.map(dir => (
                      <li key={dir}>
                        <Button variant="link" onClick={() => handleBrowserDirClick(dir)}>
                          <i className="fas fa-folder me-1"></i>{dir}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
                <div style={{ minWidth: 200 }}>
                  <strong>Files</strong>
                  <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                    {browserFiles.map(file => (
                      <li key={file}>
                        <Button
                          variant={browserSelected === file ? 'primary' : 'light'}
                          onClick={() => handleBrowserFileClick(file)}
                          style={{ width: '100%', textAlign: 'left' }}
                        >
                          <i className="fas fa-file me-1"></i>{file}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseBrowser}>Cancel</Button>
          <Button variant="primary" onClick={handleBrowserDownload} disabled={!browserSelected}>Download</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default FilesTab; 