import React from 'react';
import { ConfigProvider } from './contexts/ConfigContext';
import { ChatProvider } from './contexts/ChatContext';
// FileExplorerProvider is inside RightSidebarPanel, so not needed at App root.

import { LeftSidebar } from './components/layout/LeftSidebar';
import { MiddleChatPanel } from './components/chat/MiddleChatPanel';
import { RightSidebarPanel } from './components/files/RightSidebarPanel';

// Basic styling for the overall app layout
const appLayoutStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  height: '100vh',
  overflow: 'hidden', // Prevent scrollbars on the body itself
  fontFamily: 'Arial, sans-serif',
  backgroundColor: '#e8e8e8', // A very light grey for the overall background if needed
};

function App() {
  return (
    <ConfigProvider> {/* Settings for LeftSidebar and potentially other components */}
      <ChatProvider>   {/* Manages chat state for MiddleChatPanel */}
        <div style={appLayoutStyle}>
          <LeftSidebar />
          <MiddleChatPanel />
          <RightSidebarPanel />
        </div>
      </ChatProvider>
    </ConfigProvider>
  );
}

export default App;
