import React from 'react';
import { useFileExplorer } from '../../contexts/FileExplorerContext';
import { FileTreeItem } from './FileTreeItem';

// Basic icons
const RefreshIcon = () => <span>🔄</span>;
const UpArrowIcon = () => <span>⬆️</span>;


export const FileExplorer: React.FC = () => {
  const { rootEntries, currentPath, isLoading, error, goUpOneLevel, refreshCurrentDirectory } = useFileExplorer();

  const explorerStyle: React.CSSProperties = {
    padding: '10px',
    borderBottom: '1px solid #eee',
    maxHeight: '40vh', // Limit height, make it scrollable
    overflowY: 'auto',
    backgroundColor: '#fdfdfd',
  };

  const headerStyle: React.CSSProperties = {
    marginBottom: '10px',
    paddingBottom: '5px',
    borderBottom: '1px solid #f0f0f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const pathStyle: React.CSSProperties = {
    fontSize: '0.9em',
    color: '#555',
    wordBreak: 'break-all',
  };

  const controlsStyle: React.CSSProperties = {
      display: 'flex',
      gap: '8px',
  };

  const buttonStyle: React.CSSProperties = {
      background: 'none',
      border: '1px solid #ccc',
      borderRadius: '4px',
      padding: '4px 8px',
      cursor: 'pointer',
  };


  if (isLoading && rootEntries.length === 0) { // Show loading only on initial load or full directory change
    return <div style={explorerStyle}><p>Loading files...</p></div>;
  }

  if (error && rootEntries.length === 0) { // Show error if initial load fails
    return <div style={explorerStyle}><p style={{ color: 'red' }}>Error: {error}</p></div>;
  }

  const canGoUp = currentPath !== '.' && currentPath !== '/';

  return (
    <div style={explorerStyle}>
      <div style={headerStyle}>
        <span style={pathStyle} title={currentPath}>Current: {currentPath}</span>
        <div style={controlsStyle}>
            <button onClick={goUpOneLevel} disabled={!canGoUp || isLoading} style={buttonStyle} title="Go Up">
                <UpArrowIcon />
            </button>
            <button onClick={refreshCurrentDirectory} disabled={isLoading} style={buttonStyle} title="Refresh">
                <RefreshIcon />
            </button>
        </div>
      </div>
      {isLoading && <p style={{fontSize: '0.8em', color: '#777'}}>Updating list...</p>}
      {error && !isLoading && <p style={{ color: 'red', fontSize: '0.8em' }}>{error}</p>} {/* Show non-critical errors */}

      {rootEntries.length === 0 && !isLoading && !error && <p>No files or directories found.</p>}
      {rootEntries.sort((a,b) => { // Sort: directories first, then by name
            if (a.type === 'directory' && b.type === 'file') return -1;
            if (a.type === 'file' && b.type === 'directory') return 1;
            return a.name.localeCompare(b.name);
          }).map((entry) => (
        <FileTreeItem key={entry.path} entry={entry} level={0} />
      ))}
    </div>
  );
};
