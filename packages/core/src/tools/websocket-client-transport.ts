import WebSocket from 'ws';
import { Transport, TransportSendOptions } from "@modelcontextprotocol/sdk/shared/transport.js"
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

export class WebSocketClientTransport
  implements Transport
{
  private socket: WebSocket | null = null;
  public onclose?: (() => void) | undefined;
  public onerror?: ((error: Error) => void) | undefined;
  public onmessage?: ((message: JSONRPCMessage) => void) | undefined;

  constructor(private readonly url: URL) {
    this.url = typeof url === 'string' ? new URL(url) : url;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      const handshakeTimeoutDuration = 10000;
      let connectionTimeout: NodeJS.Timeout | null = null;

      try {
        this.socket = new WebSocket(this.url.toString(), { handshakeTimeout: handshakeTimeoutDuration });

        connectionTimeout = setTimeout(() => {
          this.socket?.close();
          reject(new Error(`WebSocket connection timed out after ${handshakeTimeoutDuration}ms`));
        }, handshakeTimeoutDuration);

        this.socket.on('open', () => {
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            connectionTimeout = null;
          }
          resolve();
        });

        this.socket.on('message', (data) => {
          try {
            const parsedMessage: JSONRPCMessage = JSON.parse(data.toString());
            if (this.onmessage) {
              this.onmessage(parsedMessage);
            } 
          } catch (parseError) {
            if (this.onerror) {
              this.onerror(parseError as Error);
            }
          }
        });

        this.socket.on('error', (error) => {
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            connectionTimeout = null;
          }
          if (this.onerror) {
            this.onerror(error);
          }
          reject(error);
        });

        this.socket.on('close', (code, reason) => {
          if (connectionTimeout) {
            clearTimeout(connectionTimeout);
            connectionTimeout = null;
          }
          if (this.onclose) {
            this.onclose();
          }
          this.socket = null;
        });
      } catch (error) {
        if (connectionTimeout) {
          clearTimeout(connectionTimeout);
          connectionTimeout = null;
        }
        reject(error);
      }
    });
  }

  async close(): Promise<void> {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    return Promise.resolve();
  }

  async send(
    message: JSONRPCMessage,
    options?: TransportSendOptions,
  ): Promise<void> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      const errorMessage = 'WebSocket is not connected or not open. Cannot send message.';
      throw new Error(errorMessage);
    }
    const messageString = JSON.stringify(message);
    this.socket.send(messageString);
    return Promise.resolve();
  }
}