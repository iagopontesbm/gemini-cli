import React from 'react';
import { ChatHistory } from './ChatHistory';
import { ChatInput } from './ChatInput';
import { ChatProvider, useChat } from '../../contexts/ChatContext'; // ChatProvider might be higher up in App.tsx

// This component assumes ChatProvider is already wrapping it in the main App layout.
// If not, ChatProvider should wrap this component.

const PanelStatus: React.FC = () => {
    const { connectionStatus, error } = useChat(); // Get status from context

    const statusBarStyle: React.CSSProperties = {
        padding: '5px 10px',
        fontSize: '0.8em',
        textAlign: 'center',
        borderBottom: '1px solid #e0e0e0',
    };

    let statusText = '';
    let barStyle = { ...statusBarStyle };

    switch (connectionStatus) {
        case 'connected':
            statusText = 'Connected';
            barStyle.backgroundColor = '#d4edda'; // Greenish for connected
            barStyle.color = '#155724';
            break;
        case 'connecting':
            statusText = 'Connecting...';
            barStyle.backgroundColor = '#fff3cd'; // Yellowish for connecting
            barStyle.color = '#856404';
            break;
        case 'disconnected':
            statusText = 'Disconnected. Attempting to reconnect...';
            barStyle.backgroundColor = '#f8d7da'; // Reddish for disconnected/error
            barStyle.color = '#721c24';
            break;
        case 'error':
            statusText = `Error: ${error || 'Connection failed.'}`;
            barStyle.backgroundColor = '#f8d7da';
            barStyle.color = '#721c24';
            break;
        default:
            statusText = 'Status unknown';
            barStyle.backgroundColor = '#e2e3e5';
            barStyle.color = '#383d41';
    }

    return (
        <div style={barStyle}>
            {statusText}
        </div>
    );
};


export const MiddleChatPanel: React.FC = () => {
  const middlePanelStyle: React.CSSProperties = {
    flexGrow: 1, // Takes up available space between left and right sidebars
    display: 'flex',
    flexDirection: 'column',
    height: '100vh', // Full viewport height
    backgroundColor: '#fff', // Or a theme-based color
    borderLeft: '1px solid #ddd', // Separator from LeftSidebar
    borderRight: '1px solid #ddd', // Separator from RightSidebar (if present)
  };

  return (
    // If ChatProvider is not in App.tsx, it should be here:
    // <ChatProvider>
    <div style={middlePanelStyle}>
      <PanelStatus /> {/* Display connection status at the top */}
      <ChatHistory />
      <ChatInput />
    </div>
    // </ChatProvider>
  );
};
