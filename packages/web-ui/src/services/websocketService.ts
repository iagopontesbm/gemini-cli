// The WebSocket URL will depend on how the NestJS WebSocket Gateway is configured.
// It's often at the root path or a specific path like '/chat', not necessarily under '/api'.
// For this example, assuming it's ws://localhost:3001/chat (if backend is on 3001)
// If the frontend and backend are on the same host and port during development (e.g. via proxy),
// a relative path like '/chat' could be used: `ws://${window.location.host}/chat`
const CHAT_WEBSOCKET_URL = `ws://${window.location.hostname}:3001/chat`; // Adjust port if backend is different

export interface ChatMessageFromServer {
  type: 'model_thought' | 'model_response_chunk' | 'model_response_complete' | 'tool_request' | 'error_message' | 'chat_history_update' | 'user_message_echo' | 'tool_response_echo';
  payload: any;
  timestamp?: Date; // Server might not send this for all, client can add
  id?: string;      // Server might not send this for all, client can add
  sender?: 'user' | 'model' | 'system'; // Helpful for styling
  callId?: string; // For tool_request and tool_response correlation
}

class WebSocketService {
  private socket: WebSocket | null = null;
  private onMessageCallback: ((message: ChatMessageFromServer) => void) | null = null;
  private onOpenCallback: (() => void) | null = null;
  private onCloseCallback: ((event: CloseEvent) => void) | null = null;
  private onErrorCallback: ((event: Event) => void) | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 5000; // 5 seconds

  connect() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      console.log('WebSocket already connected.');
      if (this.onOpenCallback) this.onOpenCallback(); // Ensure open callback is fired if already connected
      return;
    }
     if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
      console.log('WebSocket connection attempt already in progress.');
      return;
    }

    this.socket = new WebSocket(CHAT_WEBSOCKET_URL);
    console.log('Attempting WebSocket connection to:', CHAT_WEBSOCKET_URL);

    this.socket.onopen = () => {
      console.log('WebSocket connected successfully.');
      this.reconnectAttempts = 0; // Reset reconnect attempts on successful connection
      if (this.onOpenCallback) this.onOpenCallback();
    };

    this.socket.onmessage = (event) => {
      try {
        const rawData = event.data as string;
        // console.log('Raw WebSocket message received:', rawData);
        const messageData = JSON.parse(rawData) as ChatMessageFromServer;

        // Ensure essential fields are present
        messageData.timestamp = messageData.timestamp ? new Date(messageData.timestamp) : new Date();
        messageData.id = messageData.id || crypto.randomUUID();

        if (this.onMessageCallback) this.onMessageCallback(messageData);
      } catch (error) {
        console.error('Failed to parse WebSocket message or invalid message structure:', error, event.data);
        // Send a synthetic error message to the UI if parsing fails
        if (this.onMessageCallback) {
          this.onMessageCallback({
            type: 'error_message',
            payload: { message: 'Received malformed message from server.' },
            timestamp: new Date(),
            id: crypto.randomUUID(),
            sender: 'system'
          });
        }
      }
    };

    this.socket.onclose = (event: CloseEvent) => {
      console.log(`WebSocket disconnected: Code=${event.code}, Reason=${event.reason}, WasClean=${event.wasClean}`);
      if (this.onCloseCallback) this.onCloseCallback(event);
      this.socket = null;

      // Attempt to reconnect if not a clean closure and within attempt limits
      if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`Attempting to reconnect... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        setTimeout(() => this.connect(), this.reconnectInterval);
      } else if (!event.wasClean) {
        console.error('Max reconnect attempts reached. Please check the server or refresh the page.');
         if (this.onMessageCallback) {
          this.onMessageCallback({
            type: 'error_message',
            payload: { message: 'Connection lost. Max reconnect attempts reached.' },
            timestamp: new Date(),
            id: crypto.randomUUID(),
            sender: 'system'
          });
        }
      }
    };

    this.socket.onerror = (event: Event) => {
      console.error('WebSocket error observed:', event);
      if (this.onErrorCallback) this.onErrorCallback(event);
      // Note: onclose will usually be called after onerror.
      // If it's a connection refused error, onclose might provide more details or happen immediately.
    };
  }

  sendMessage(type: string, payload?: any) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ type, payload: payload || {} });
      // console.log('Sending WebSocket message:', message);
      this.socket.send(message);
    } else {
      console.error('WebSocket not connected or not open. Cannot send message.');
      // Optionally, queue the message or trigger a reconnect attempt.
       if (this.onMessageCallback) {
          this.onMessageCallback({
            type: 'error_message',
            payload: { message: 'Cannot send message: Not connected to server.' },
            timestamp: new Date(),
            id: crypto.randomUUID(),
            sender: 'system'
          });
        }
    }
  }

  disconnect() {
    if (this.socket) {
      console.log('Manually disconnecting WebSocket.');
      this.socket.close(1000, "User initiated disconnect"); // 1000 is a normal closure
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect after manual disconnect
  }

  onOpen(callback: () => void) {
    this.onOpenCallback = callback;
  }

  onMessage(callback: (message: ChatMessageFromServer) => void) {
    this.onMessageCallback = callback;
  }

  onClose(callback: (event: CloseEvent) => void) {
    this.onCloseCallback = callback;
  }

  onError(callback: (event: Event) => void) {
    this.onErrorCallback = callback;
  }

  isConnected(): boolean {
    return !!this.socket && this.socket.readyState === WebSocket.OPEN;
  }
}

// Export a singleton instance of the service
export const chatWebSocketService = new WebSocketService();
