import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './FileBrowserModal.css';

interface FileEntry {
  name: string;
  isDirectory: boolean;
}

interface BreadcrumbEntry {
  name: string;
  path: string;
}

interface FileBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onFileSelect: (filePath: string, fileContent: string) => void; // Callback when a file is chosen
  // TODO: Add onDirectorySelect if needed, or multi-select
}

const FileBrowserModal: React.FC<FileBrowserProps> = ({ isOpen, onClose, onFileSelect }) => {
  const [currentPath, setCurrentPath] = useState<string>('.');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [workspaceRootName, setWorkspaceRootName] = useState<string>('Workspace');

  const fetchFiles = async (pathToList: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await axios.get<{
        path: string;
        files: FileEntry[];
        breadcrumbs: BreadcrumbEntry[];
        workspaceRootName?: string;
      }>(`/api/files/list?path=${encodeURIComponent(pathToList)}`);
      setFiles(response.data.files);
      setCurrentPath(response.data.path);
      setBreadcrumbs(response.data.breadcrumbs || []);
      if (response.data.workspaceRootName && pathToList === '.') {
        setWorkspaceRootName(response.data.workspaceRootName);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to list files.');
      console.error('Error fetching file list:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFiles(currentPath); // Fetch initial listing for current path or root
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]); // Only refetch when modal opens, path changes are manual

  const handlePathNavigation = (path: string) => {
    fetchFiles(path);
  };

  const handleFileClick = async (file: FileEntry) => {
    if (file.isDirectory) {
      fetchFiles(path.join(currentPath, file.name)); // Navigate into directory
    } else {
      // Fetch file content and then call onFileSelect
      setIsLoading(true);
      setError(null);
      const filePathToLoad = path.join(currentPath, file.name);
      try {
        const response = await axios.get<string>(`/api/files/content?path=${encodeURIComponent(filePathToLoad)}`);
        onFileSelect(filePathToLoad, response.data);
        onClose(); // Close modal after selection
      } catch (err: any) {
        setError(err.response?.data?.error || `Failed to load file: ${file.name}`);
        console.error('Error fetching file content:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Helper (simplified path.join for client side)
  const path = {
    join: (...segments: string[]): string => {
      // Normalize by removing trailing/leading slashes and joining with a single slash
      const normalizedSegments = segments.map((segment, index) => {
        if (index === 0 && segment === '.') return ''; // Root for relative paths
        return segment.replace(/^\/+|\/+$/g, '');
      }).filter(segment => segment.length > 0);
      return normalizedSegments.join('/') || '.';
    }
  };


  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>File Browser ({workspaceRootName}/{currentPath === '.' ? '' : currentPath})</h3>
          <button onClick={onClose} className="close-button">&times;</button>
        </div>
        <div className="breadcrumbs">
          {breadcrumbs.map((crumb, index) => (
            <span key={index} onClick={() => handlePathNavigation(crumb.path)} className="crumb">
              {crumb.name} {index < breadcrumbs.length -1 ? ' / ' : ''}
            </span>
          ))}
        </div>
        <div className="modal-body">
          {isLoading && <p>Loading...</p>}
          {error && <p className="error-message">{error}</p>}
          {!isLoading && !error && (
            <ul>
              {currentPath !== '.' && ( // Simplified 'go up' - assumes '.' is root of workspace
                <li onClick={() => handlePathNavigation(path.join(currentPath, '..'))} className="file-item directory">
                  📁 .. (Up)
                </li>
              )}
              {files.map((file) => (
                <li
                  key={file.name}
                  onClick={() => handleFileClick(file)}
                  className={`file-item ${file.isDirectory ? 'directory' : 'file'}`}
                >
                  {file.isDirectory ? '📁' : '📄'} {file.name}
                </li>
              ))}
            </ul>
          )}
          { !isLoading && !error && files.length === 0 && <p>No files or directories found.</p>}
        </div>
      </div>
    </div>
  );
};

export default FileBrowserModal;
