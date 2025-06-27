import React from 'react';
import { DisplayMessage, TextPayload, ToolRequestPayload, ToolResponsePayload, ErrorPayload } from '../../contexts/ChatContext'; // Assuming these types are exported

// Helper to format timestamp
const formatTimestamp = (date: Date): string => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

// Basic styling for message bubbles
const getBubbleStyle = (sender: DisplayMessage['sender']): React.CSSProperties => {
  const baseStyle: React.CSSProperties = {
    padding: '8px 12px',
    borderRadius: '15px',
    marginBottom: '8px',
    maxWidth: '70%',
    wordWrap: 'break-word',
    fontSize: '0.95em',
    position: 'relative', // For timestamp
  };
  switch (sender) {
    case 'user':
      return {
        ...baseStyle,
        backgroundColor: '#0b93f6', // User message color (e.g., blue)
        color: 'white',
        marginLeft: 'auto',
        borderBottomRightRadius: '5px',
      };
    case 'model':
      return {
        ...baseStyle,
        backgroundColor: '#e5e5ea', // Model message color (e.g., light gray)
        color: 'black',
        marginRight: 'auto',
        borderBottomLeftRadius: '5px',
      };
    case 'tool':
       return {
        ...baseStyle,
        backgroundColor: '#f0e68c', // Tool message color (e.g., khaki)
        color: 'black',
        marginRight: 'auto',
        borderBottomLeftRadius: '5px',
        fontSize: '0.85em',
        border: '1px solid #ded8b0'
      };
    case 'system':
    default:
      return {
        ...baseStyle,
        backgroundColor: '#f2f2f2', // System message color (e.g., very light gray)
        color: '#555',
        textAlign: 'center',
        fontSize: '0.8em',
        width: '100%',
        maxWidth: '100%',
        borderRadius: '5px',
      };
  }
};

const timestampStyle: React.CSSProperties = {
  fontSize: '0.7em',
  color: '#888', // Timestamp color for model/tool messages
  display: 'block',
  textAlign: 'right',
  marginTop: '5px',
};

const userTimestampStyle: React.CSSProperties = {
    ...timestampStyle,
    color: '#e0e0e0', // Lighter timestamp for user messages
};

// --- Tool Display Components (can be moved to separate files if they grow complex) ---

interface ToolCallDisplayProps {
  payload: ToolRequestPayload;
  onConfirm?: (callId: string, args: any) => void; // Example action
  onCancel?: (callId: string) => void; // Example action
}

const ToolCallDisplay: React.FC<ToolCallDisplayProps> = ({ payload }) => {
  // In a real app, you might have buttons for user to confirm/cancel tool calls if needed
  return (
    <div style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '5px', backgroundColor: '#f9f9f9', margin: '5px 0' }}>
      <strong>Tool Call Requested: <code>{payload.toolName}</code></strong>
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', backgroundColor: '#eee', padding: '5px', borderRadius: '3px', maxHeight: '150px', overflowY: 'auto' }}>
        {JSON.stringify(payload.args, null, 2)}
      </pre>
      {/*
      Example buttons if user interaction is needed:
      <button onClick={() => onConfirm?.(payload.callId, payload.args)}>Confirm</button>
      <button onClick={() => onCancel?.(payload.callId)}>Cancel</button>
      */}
    </div>
  );
};

interface ToolResponseDisplayProps {
  payload: ToolResponsePayload;
}
const ToolResponseDisplay: React.FC<ToolResponseDisplayProps> = ({ payload }) => {
  return (
    <div style={{ padding: '8px', border: `1px solid ${payload.error ? '#d9534f' : '#5cb85c'}`, borderRadius: '5px', backgroundColor: payload.error ? '#f2dede' : '#dff0d8', margin: '5px 0' }}>
      <strong>Tool Response (<code>{payload.callId.substring(0,8)}...</code>): {payload.error ? 'Error' : 'Success'}</strong>
      <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', backgroundColor: payload.error ? '#ebcccc' : '#d0e9c6', padding: '5px', borderRadius: '3px', maxHeight: '150px', overflowY: 'auto' }}>
        {typeof payload.response === 'string' ? payload.response : JSON.stringify(payload.response, null, 2)}
      </pre>
    </div>
  );
};


// --- Main ChatMessage Component ---

interface ChatMessageProps {
  message: DisplayMessage;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  const bubbleStyle = getBubbleStyle(message.sender);
  const tsStyle = message.sender === 'user' ? userTimestampStyle : timestampStyle;

  const renderPayload = () => {
    switch (message.type) {
      case 'user_message_echo':
      case 'model_response_chunk':
      case 'model_response_complete':
        const textPayload = message.payload as TextPayload;
        // Render newlines correctly
        return textPayload.text?.split('\n').map((line, index, arr) => (
          <React.Fragment key={index}>
            {line}
            {index < arr.length - 1 && <br />}
          </React.Fragment>
        ));
      case 'model_thought':
        const thoughtPayload = message.payload as TextPayload;
        return (
          <em style={{ color: message.sender === 'model' ? '#555' : '#ccc', fontSize: '0.9em' }}>
            (Thinking: {thoughtPayload.text})
          </em>
        );
      case 'tool_request':
        return <ToolCallDisplay payload={message.payload as ToolRequestPayload} />;
      case 'tool_response_echo': // Assuming backend echos tool responses sent by UI
         return <ToolResponseDisplay payload={message.payload as ToolResponsePayload} />;
      case 'error_message':
        const errorPayload = message.payload as ErrorPayload;
        return <strong style={{ color: '#D8000C' }}>Error: {errorPayload.message}</strong>;
      case 'chat_history_update': // Should not be rendered directly as a message bubble
        return <em>Chat history updated.</em>;
      default:
        return <em>Unsupported message type: {message.type}</em>;
    }
  };

  // Don't render chat_history_update as a visible message bubble in the main flow
  if (message.type === 'chat_history_update') {
    return null;
  }

  return (
    <div style={bubbleStyle}>
      {renderPayload()}
      <span style={tsStyle}>{formatTimestamp(message.timestamp)}</span>
    </div>
  );
};
