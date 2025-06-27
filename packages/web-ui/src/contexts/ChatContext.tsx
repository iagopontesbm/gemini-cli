import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback, useMemo } from 'react';
import { chatWebSocketService, ChatMessageFromServer } from '../services/websocketService';
import { v4 as uuidv4 } from 'uuid'; // For generating unique IDs if server doesn't provide them

// DisplayMessage interface extends ChatMessageFromServer with guaranteed id and timestamp
export interface DisplayMessage extends Omit<ChatMessageFromServer, 'id' | 'timestamp' | 'payload'> {
  id: string;
  timestamp: Date;
  payload: any; // Keep payload flexible for different message types
  sender: 'user' | 'model' | 'system' | 'tool'; // More specific sender types
}

// Specific payload types for better handling
export interface TextPayload { text: string; }
export interface ToolRequestPayload { callId: string; toolName: string; args: any; }
export interface ToolResponsePayload { callId: string; response: any; error?: boolean; }
export interface ErrorPayload { message: string; details?: any; }


interface ChatContextType {
  messages: DisplayMessage[];
  sendMessage: (text: string) => void;
  sendToolResponse: (callId: string, response: any, isError?: boolean) => void;
  stopGeneration: () => void;
  clearChat: () => void;
  isConnected: boolean;
  isThinking: boolean;
  error: string | null;
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider = ({ children }: { children: ReactNode }) => {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isConnected, setIsConnected] = useState(chatWebSocketService.isConnected());
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting' | 'error'>('disconnected');


  const addMessageToList = useCallback((msg: ChatMessageFromServer) => {
    const displayMsg: DisplayMessage = {
      ...msg,
      id: msg.id || uuidv4(),
      timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      sender: msg.sender || (msg.type.startsWith('model_') ? 'model' : 'system'),
    };
    setMessages(prevMessages => [...prevMessages, displayMsg]);

    // Manage isThinking state
    if (displayMsg.type === 'model_response_complete' || displayMsg.type === 'error_message' || displayMsg.type === 'tool_request') {
      setIsThinking(false);
    }
    if (displayMsg.type.startsWith('model_') && displayMsg.type !== 'model_response_complete') {
        // if it's a chunk or thought, model is still working
        if (displayMsg.type !== 'tool_request') setIsThinking(true);
    }

    if (displayMsg.type === 'error_message' && displayMsg.payload?.message) {
      setError(displayMsg.payload.message);
    }
  }, []);

  useEffect(() => {
    chatWebSocketService.onOpen(() => {
      setIsConnected(true);
      setConnectionStatus('connected');
      setError(null);
      // Request chat history once connected
      chatWebSocketService.sendMessage('get_chat_history');
    });

    chatWebSocketService.onMessage((message: ChatMessageFromServer) => {
      if (message.type === 'chat_history_update' && Array.isArray(message.payload)) {
        // Assuming payload is an array of ChatMessageFromServer objects
        const historyMessages = message.payload.map((msg: ChatMessageFromServer) => ({
          ...msg,
          id: msg.id || uuidv4(),
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          sender: msg.sender || (msg.type.startsWith('model_') ? 'model' : (msg.type === 'user_message_echo' ? 'user' : 'system')),
        } as DisplayMessage));
        setMessages(historyMessages);
      } else {
        addMessageToList(message);
      }
    });

    chatWebSocketService.onClose((event: CloseEvent) => {
      setIsConnected(false);
      setIsThinking(false);
      if (!event.wasClean) {
        setError('WebSocket connection lost. Attempting to reconnect...');
        setConnectionStatus('disconnected'); // Or 'reconnecting' if you have that state
      } else {
        setConnectionStatus('disconnected');
      }
    });

    chatWebSocketService.onError((event: Event) => {
      console.error("ChatContext WebSocket error:", event);
      setError('WebSocket connection error. See console for details.');
      setIsConnected(false);
      setIsThinking(false);
      setConnectionStatus('error');
    });

    // Initial connection attempt if not already connected or connecting
    if (!chatWebSocketService.isConnected() && connectionStatus !== 'connecting') {
        setConnectionStatus('connecting');
        chatWebSocketService.connect();
    }

    // Cleanup function for when the provider unmounts
    return () => {
        // chatWebSocketService.disconnect(); // Or manage listeners if service is a true singleton meant to persist
        // For this app, assuming ChatProvider is top-level for chat, so disconnecting is okay.
        // If components using useChat can unmount/remount frequently, then just remove listeners.
    };
  }, [addMessageToList, connectionStatus]); // Added connectionStatus to dependencies

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    if (!isConnected) {
        setError("Not connected to server. Cannot send message.");
        // Optionally try to reconnect:
        // if (connectionStatus !== 'connecting') {
        //   setConnectionStatus('connecting');
        //   chatWebSocketService.connect();
        // }
        return;
    }

    // Optimistically add user message to UI - backend should echo it with final ID/timestamp
    // Or wait for 'user_message_echo' from backend
    const optimisticUserMessage: DisplayMessage = {
      id: uuidv4(),
      type: 'user_message_echo', // Using echo type for consistency
      payload: { text },
      timestamp: new Date(),
      sender: 'user',
    };
    setMessages(prevMessages => [...prevMessages, optimisticUserMessage]);

    chatWebSocketService.sendMessage('user_message', { text });
    setIsThinking(true);
    setError(null);
  };

  const sendToolResponse = (callId: string, response: any, isError: boolean = false) => {
    if (!isConnected) {
        setError("Not connected to server. Cannot send tool response.");
        return;
    }
    // Optimistic add? Or wait for echo? For now, wait for backend to echo.
    chatWebSocketService.sendMessage('tool_response', { callId, response, error: isError });
    // The model might start "thinking" again after a tool response.
    // setIsThinking(true); // Let the backend response (e.g. model_thought) trigger this
  };


  const stopGeneration = () => {
    if (!isConnected) return;
    chatWebSocketService.sendMessage('stop_generation');
    setIsThinking(false); // Optimistically set thinking to false
  };

  const clearChat = () => {
    if (!isConnected && messages.length === 0) return; // Nothing to do if not connected and no messages

    if (isConnected) {
        chatWebSocketService.sendMessage('clear_chat_history');
    }
    // Optimistically clear UI regardless of connection for better UX
    setMessages([]);
    setIsThinking(false);
    setError(null);
  };

  const contextValue = useMemo(() => ({
    messages,
    sendMessage,
    sendToolResponse,
    stopGeneration,
    clearChat,
    isConnected,
    isThinking,
    error,
    connectionStatus
  }), [messages, sendMessage, sendToolResponse, stopGeneration, clearChat, isConnected, isThinking, error, connectionStatus]);


  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = (): ChatContextType => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
