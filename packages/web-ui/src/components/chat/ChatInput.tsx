import React, { useState, KeyboardEvent } from 'react';
import { useChat } from '../../contexts/ChatContext';

export const ChatInput: React.FC = () => {
  const [inputValue, setInputValue] = useState('');
  const { sendMessage, stopGeneration, clearChat, isConnected, isThinking, connectionStatus } = useChat();

  const handleSend = () => {
    if (inputValue.trim()) {
      sendMessage(inputValue);
      setInputValue('');
    }
  };

  const handleKeyPress = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault(); // Prevent newline in textarea
      handleSend();
    }
  };

  const inputAreaStyle: React.CSSProperties = {
    display: 'flex',
    padding: '10px 20px',
    borderTop: '1px solid #ccc', // Optional: visual separation
    backgroundColor: '#f9f9f9',
  };

  const textareaStyle: React.CSSProperties = {
    flexGrow: 1,
    padding: '10px',
    borderRadius: '20px', // Rounded corners
    border: '1px solid #ddd',
    marginRight: '10px',
    resize: 'none', // Prevent manual resizing
    minHeight: '24px', // Start small, grows with content
    maxHeight: '120px', // Limit height
    overflowY: 'auto',
    fontFamily: 'inherit',
    fontSize: '1em',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '0 15px',
    borderRadius: '20px',
    border: 'none',
    backgroundColor: '#0b93f6',
    color: 'white',
    cursor: 'pointer',
    fontSize: '0.9em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '44px', // Match typical textarea height with padding
    marginLeft: '5px',
  };

   const disabledButtonStyle: React.CSSProperties = {
    ...buttonStyle,
    backgroundColor: '#aaa',
    cursor: 'not-allowed',
  };


  return (
    <div style={{ padding: '10px', backgroundColor: '#f0f0f0' }}>
      <div style={inputAreaStyle}>
        <textarea
          style={textareaStyle}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={isConnected ? "Type your message..." : "Waiting for connection..."}
          rows={1} // Start with one row, auto-adjusts with content up to maxHeight
          disabled={!isConnected || connectionStatus === 'connecting'}
        />
        <button
          style={(isThinking || !isConnected || !inputValue.trim()) ? disabledButtonStyle : buttonStyle}
          onClick={handleSend}
          disabled={isThinking || !isConnected || !inputValue.trim()}
        >
          Send
        </button>
      </div>
       <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '5px 20px 0px 20px' }}>
        {isThinking && (
          <button
            style={{...buttonStyle, backgroundColor: '#ffc107', color: 'black'}}
            onClick={stopGeneration}
          >
            Stop
          </button>
        )}
        <button
            style={{...buttonStyle, backgroundColor: '#dc3545'}}
            onClick={clearChat}
            disabled={!isConnected && messages.length === 0} // Disable if no messages and not connected
        >
            Clear
        </button>
      </div>
    </div>
  );
};
