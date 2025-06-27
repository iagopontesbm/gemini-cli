import React from 'react';
import { FileSystemEntry, useFileExplorer } from '../../contexts/FileExplorerContext';

// Basic icons (could be replaced with SVGs or an icon library)
const FileIcon = () => <span>📄</span>; // Simple file icon
const FolderIcon = () => <span>📁</span>; // Simple folder icon
const FolderOpenIcon = () => <span>📂</span>; // Simple open folder icon

interface FileTreeItemProps {
  entry: FileSystemEntry;
  level: number; // For indentation
}

export const FileTreeItem: React.FC<FileTreeItemProps> = ({ entry, level }) => {
  const { selectFile, browseDirectory, currentPath, selectedFile } = useFileExplorer();
  const [isExpanded, setIsExpanded] = React.useState(false);

  const handleSelect = () => {
    if (entry.type === 'directory') {
      // If directory children are not loaded or it's a re-click to expand/collapse
      if (!entry.children || entry.children.length === 0 || !isExpanded) {
         // browseDirectory in context now handles loading children into the entry itself
         // We call it here to ensure children are fetched if not already present
         browseDirectory(entry.path, entry);
      }
      setIsExpanded(!isExpanded);
    } else {
      selectFile(entry);
    }
  };

  const isSelected = selectedFile?.path === entry.path;

  const itemStyle: React.CSSProperties = {
    paddingLeft: `${level * 20}px`, // Indentation based on level
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: isSelected ? '#e0e0e0' : 'transparent',
    marginBottom: '2px',
  };

  const iconStyle: React.CSSProperties = {
    marginRight: '8px',
  };

  const entryNameStyle: React.CSSProperties = {
      fontWeight: entry.type === 'directory' ? 500 : 400,
  };

  return (
    <>
      <div
        style={itemStyle}
        onClick={handleSelect}
        onDoubleClick={entry.type === 'directory' ? undefined : () => { /* Could open file in new tab or similar */ }}
        title={entry.path}
      >
        <span style={iconStyle}>
          {entry.type === 'directory' ? (isExpanded ? <FolderOpenIcon /> : <FolderIcon />) : <FileIcon />}
        </span>
        <span style={entryNameStyle}>{entry.name}</span>
      </div>
      {entry.type === 'directory' && isExpanded && entry.children && entry.children.length > 0 && (
        <div>
          {entry.children.sort((a,b) => { // Sort: directories first, then by name
            if (a.type === 'directory' && b.type === 'file') return -1;
            if (a.type === 'file' && b.type === 'directory') return 1;
            return a.name.localeCompare(b.name);
          }).map((childEntry) => (
            <FileTreeItem key={childEntry.path} entry={childEntry} level={level + 1} />
          ))}
        </div>
      )}
       {entry.type === 'directory' && isExpanded && entry.children && entry.children.length === 0 && (
         <div style={{ paddingLeft: `${(level + 1) * 20}px`, fontStyle: 'italic', color: '#888', fontSize: '0.9em', padding: '2px 8px' }}>
            (empty)
          </div>
       )}
    </>
  );
};
