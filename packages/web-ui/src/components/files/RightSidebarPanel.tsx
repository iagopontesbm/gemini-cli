import React from 'react';
import { FileExplorerProvider } from '../../contexts/FileExplorerContext'; // Provider for file system state
import { FileExplorer } from './FileExplorer';
import { FileViewer } from './FileViewer';
import { CodePreview } from '../preview/CodePreview';
import { ToolOutputViewer } from '../tools/ToolOutputViewer';

// This component will be the main container for the right sidebar.
// It will use the FileExplorerProvider to manage file system state.

export const RightSidebarPanel: React.FC = () => {
  const sidebarStyle: React.CSSProperties = {
    width: '350px', // Or dynamic based on content
    minWidth: '300px',
    height: '100vh',
    borderLeft: '1px solid #ddd',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f7f7f7', // A slightly different background for the panel itself
    fontFamily: 'Arial, sans-serif',
  };

  // Each section can have its own flex properties if needed
  const sectionStyle: React.CSSProperties = {
    // Example: borderBottom: '1px solid #eee',
    // No flexGrow here, FileViewer and CodePreview will have it
  };


  return (
    <FileExplorerProvider> {/* Encapsulate file-related components with their context */}
      <div style={sidebarStyle}>
        <div style={sectionStyle}> {/* Container for FileExplorer */}
          <FileExplorer />
        </div>

        <div style={{ ...sectionStyle, flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}> {/* Container for FileViewer, takes up remaining space */}
          <FileViewer />
        </div>

        {/*
          CodePreview and ToolOutputViewer might be conditionally rendered
          or part of a tabbed interface within the lower part of the sidebar.
          For now, stacking them.
        */}
        <div style={{ ...sectionStyle, flexShrink: 0 }}> {/* Container for CodePreview */}
          <CodePreview />
        </div>

        <div style={{ ...sectionStyle, flexShrink: 0 }}> {/* Container for ToolOutputViewer */}
          <ToolOutputViewer />
        </div>

      </div>
    </FileExplorerProvider>
  );
};
