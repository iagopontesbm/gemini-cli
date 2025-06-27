import React, { useEffect, useRef } from 'react';
import { useChat, DisplayMessage } from '../../contexts/ChatContext';
import { ChatMessage } from './ChatMessage';

export const ChatHistory: React.FC = () => {
  const { messages, isThinking, error, connectionStatus } = useChat();
  const endOfMessagesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Scroll to the bottom whenever messages change
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const historyStyle: React.CSSProperties = {
    flexGrow: 1,
    overflowY: 'auto',
    padding: '10px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px', // Small gap between messages
    borderBottom: '1px solid #e0e0e0', // Separator from input area
  };

  const statusMessageStyle: React.CSSProperties = {
    textAlign: 'center',
    color: '#888',
    fontSize: '0.9em',
    padding: '10px 0',
  };

  return (
    <div style={historyStyle}>
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      {isThinking && (
        <div style={{ ...statusMessageStyle, fontStyle: 'italic' }}>
          Gemini is thinking...
        </div>
      )}
      {error && (
         <div style={{ ...statusMessageStyle, color: 'red', fontWeight: 'bold' }}>
          Error: {error}
        </div>
      )}
      {connectionStatus === 'connecting' && (
        <div style={statusMessageStyle}>
          Connecting to chat server...
        </div>
      )}
       {connectionStatus === 'disconnected' && messages.length > 0 && !error && ( // Only show if not due to an error already displayed
        <div style={statusMessageStyle}>
          Connection closed.
        </div>
      )}
      <div ref={endOfMessagesRef} />
    </div>
  );
};
