import {
  Part,
  Chat,
  PartListUnion,
  GenerateContentResponse,
  FunctionCall,
  FunctionDeclaration,
} from '@google/genai';
// Removed UI type imports
import { ToolResult, ToolResultDisplay } from '../tools/tools.js'; // Keep ToolResult for now
// Removed gemini-stream import (types defined locally)

// --- Types for Server Logic ---

// Define a simpler structure for Tool execution results within the server
interface ServerToolExecutionOutcome {
  callId: string;
  name: string;
  args: Record<string, unknown>; // Use unknown for broader compatibility
  result?: ToolResult;
  error?: Error;
  // Confirmation details are handled by CLI, not server logic
}

// Define a structure for tools passed to the server
export interface ServerTool {
  name: string;
  schema: FunctionDeclaration; // Schema is needed
  // The execute method signature might differ slightly or be wrapped
  execute(params: Record<string, unknown>): Promise<ToolResult>;
  // validation and description might be handled differently or passed
  requiresConfirmation?: boolean; // Add optional flag
}

// Redefine necessary event types locally
export enum GeminiEventType {
  Content = 'content',
  ToolCallRequest = 'tool_call_request',
  ToolCallResult = 'tool_call_result',
  AwaitingConfirmation = 'awaiting_confirmation',
}

// Add requiresConfirmation flag to ToolCallRequestInfo
interface ToolCallRequestInfo {
  callId: string;
  name: string;
  args: Record<string, unknown>;
  requiresConfirmation?: boolean; // Add flag
  // Potentially add confirmationDetails here later (e.g., diff, command)
}

// Define structure for the new event type
// Export this interface
export interface ToolCallResultInfo {
  callId: string;
  name: string;
  status: 'success' | 'error';
  resultDisplay?: ToolResultDisplay;
  errorMessage?: string;
}

// Define structure for AwaitingConfirmation event
export interface AwaitingConfirmationInfo {
  callId: string;
  name: string;
  args: Record<string, unknown>;
  details?: any; // Add optional field for details (diff/command)
}

// Export the type alias
export type ServerGeminiStreamEvent =
  | { type: GeminiEventType.Content; value: string }
  | { type: GeminiEventType.ToolCallRequest; value: ToolCallRequestInfo }
  | { type: GeminiEventType.ToolCallResult; value: ToolCallResultInfo }
  | { type: GeminiEventType.AwaitingConfirmation; value: AwaitingConfirmationInfo };

// --- Turn Class (Refactored for Server) ---

// A turn manages the agentic loop turn within the server context.
export class Turn {
  private readonly chat: Chat;
  private readonly availableTools: Map<string, ServerTool>; // Use passed-in tools
  private awaitingConfirmationCalls: Map<string, { name: string; args: Record<string, unknown>; toolDefinition: ServerTool }>; // Store pending calls
  private immediateToolPromises: Promise<ServerToolExecutionOutcome>[]; // Store promises for immediate execution
  private fnResponses: Part[];
  private debugResponses: GenerateContentResponse[];

  constructor(chat: Chat, availableTools: ServerTool[]) {
    this.chat = chat;
    this.availableTools = new Map(availableTools.map((t) => [t.name, t]));
    this.awaitingConfirmationCalls = new Map();
    this.immediateToolPromises = [];
    this.fnResponses = [];
    this.debugResponses = [];
  }

  // The run method yields simpler events suitable for server logic
  async *run(
    req: PartListUnion,
    signal?: AbortSignal,
  ): AsyncGenerator<ServerGeminiStreamEvent> {
    // Reset state for this run iteration
    this.awaitingConfirmationCalls.clear();
    this.immediateToolPromises = [];
    this.fnResponses = [];

    const responseStream = await this.chat.sendMessageStream({ message: req });

    for await (const resp of responseStream) {
      this.debugResponses.push(resp);
      if (signal?.aborted) {
        throw this.abortError();
      }
      if (resp.text) {
        yield { type: GeminiEventType.Content, value: resp.text };
        continue;
      }
      if (!resp.functionCalls) {
        continue;
      }

      // Handle function calls
      for (const fnCall of resp.functionCalls) {
        // Yield ToolCallRequest first (includes requiresConfirmation flag)
        const requestEvent = this.handleToolCallRequest(fnCall);
        if (requestEvent) {
          yield requestEvent;

          // Now decide if confirmation is needed
          const { callId, name, args } = requestEvent.value;
          const toolDefinition = this.availableTools.get(name);

          if (toolDefinition?.requiresConfirmation) {
            // Call the new handler function
            const awaitEvent = this.handleAwaitingConfirmation(callId, name, args, toolDefinition);
            if (awaitEvent) {
              yield awaitEvent;
            }
          } else if (toolDefinition) {
            // Prepare for immediate execution
            this.immediateToolPromises.push(
               this.executeTool({ callId, name, args, toolDefinition })
            );
          } else {
             // Tool not found - prepare error outcome for immediate processing
             this.immediateToolPromises.push(
               Promise.resolve({ callId, name, args, error: new Error(`Tool \"${name}\" not found.`) })
             );
          }
        }
      }

      // Execute ONLY immediate tool calls
      if (this.immediateToolPromises.length > 0) {
        const outcomes = await Promise.all(this.immediateToolPromises);
        this.immediateToolPromises = []; // Clear promises for this turn

        // Yield ToolCallResult events for immediate outcomes
        for (const outcome of outcomes) {
          if (signal?.aborted) throw this.abortError();
          const resultValue: ToolCallResultInfo = {
            callId: outcome.callId,
            name: outcome.name,
            status: outcome.error ? 'error' : 'success',
            resultDisplay: outcome.result?.returnDisplay,
            errorMessage: outcome.error?.message,
          };
          yield { type: GeminiEventType.ToolCallResult, value: resultValue };
        }

        // Process outcomes and prepare function responses ONLY for immediate calls
        this.fnResponses = this.buildFunctionResponses(outcomes);
      } else {
      }
    }
  }

  // Extracted tool execution logic
  private async executeTool(pendingCall: {
    callId: string;
    name: string;
    args: Record<string, unknown>;
    toolDefinition: ServerTool;
  }): Promise<ServerToolExecutionOutcome> {
      try {
        const result = await pendingCall.toolDefinition.execute(pendingCall.args);
        return { ...pendingCall, result };
      } catch (execError: unknown) {
        return {
          ...pendingCall,
          error: new Error(
            `Tool execution failed: ${execError instanceof Error ? execError.message : String(execError)}`
          ),
        };
      }
  }

  // Generates a ToolCallRequest event
  private handleToolCallRequest(
    fnCall: FunctionCall,
  ): { type: GeminiEventType.ToolCallRequest; value: ToolCallRequestInfo } | null {
    const callId =
      fnCall.id ??
      `${fnCall.name}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const name = fnCall.name || 'undefined_tool_name';
    const args = (fnCall.args || {}) as Record<string, unknown>;

    const toolDefinition = this.availableTools.get(name);
    const requiresConfirmation = toolDefinition?.requiresConfirmation ?? false;

    const value: ToolCallRequestInfo = { callId, name, args, requiresConfirmation };
    return { type: GeminiEventType.ToolCallRequest, value };
  }

  // New method to handle yielding AwaitingConfirmation event
  private handleAwaitingConfirmation(callId: string, name: string, args: Record<string, unknown>, toolDefinition: ServerTool): ServerGeminiStreamEvent | null {
      // Generate confirmation details if the tool supports it
      let confirmationDetails: any | null = null;
      if (typeof (toolDefinition as any).getConfirmationDetails === 'function') {
         try {
            confirmationDetails = (toolDefinition as any).getConfirmationDetails(args);
         } catch (e) {
             console.error(`Error getting confirmation details for ${name}:`, e);
             // Proceed without details? Or maybe treat as error?
         }
      }

      // Store for later confirmation
      this.awaitingConfirmationCalls.set(callId, { name, args, toolDefinition });

      // Prepare and yield the event
      const awaitingValue: AwaitingConfirmationInfo = {
          callId,
          name,
          args,
          details: confirmationDetails,
      };
      return { type: GeminiEventType.AwaitingConfirmation, value: awaitingValue };
  }

  // Builds the Part array expected by the Google GenAI API
  private buildFunctionResponses(
    outcomes: ServerToolExecutionOutcome[],
  ): Part[] {
    return outcomes.map((outcome): Part => {
      const { name, result, error } = outcome;
      let fnResponsePayload: Record<string, unknown>;

      if (error) {
        // Format error for the LLM
        const errorMessage = error?.message || String(error);
        fnResponsePayload = { error: `Tool execution failed: ${errorMessage}` };
        console.error(`[Server Turn] Error executing tool ${name}:`, error);
      } else {
        // Pass successful tool result (content meant for LLM)
        fnResponsePayload = { output: result?.llmContent ?? '' }; // Default to empty string if no content
      }

      return {
        functionResponse: {
          name,
          id: outcome.callId,
          response: fnResponsePayload,
        },
      };
    });
  }

  private abortError(): Error {
    const error = new Error('Request cancelled by user during stream.');
    error.name = 'AbortError';
    return error; // Return instead of throw, let caller handle
  }

  // Allows the service layer to get the responses needed for the next API call
  getFunctionResponses(): Part[] {
    return this.fnResponses;
  }

  // Debugging information (optional)
  getDebugResponses(): GenerateContentResponse[] {
    return this.debugResponses;
  }

  // Method to retrieve stored details for confirmation handling
  public getAwaitingConfirmationCall(callId: string): { name: string; args: Record<string, unknown>; toolDefinition: ServerTool } | undefined {
    return this.awaitingConfirmationCalls.get(callId);
  }

  // Method to remove a call after confirmation handled (or timeout)
  public clearAwaitingConfirmationCall(callId: string): void {
     this.awaitingConfirmationCalls.delete(callId);
  }
}
