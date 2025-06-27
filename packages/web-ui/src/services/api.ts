// Base URL for the backend API
// In a real app, this might come from an environment variable
const API_BASE_URL = 'http://localhost:3001/api';

interface SystemSettings {
  workDirectory?: string;
  sandboxConfig?: string;
  debugMode?: boolean;
  userMemory?: string;
  contextFile?: string;
  toolDiscoveryCommand?: string;
  toolCallCommand?: string;
  // fileFilters: any; // Define properly later
  checkpointing?: boolean;
  proxy?: string;
  theme?: string;
  telemetry?: boolean;
}

interface LlmSettings {
  authType?: string;
  apiKeySet?: boolean; // To indicate if a key is configured, not the key itself
  defaultModel?: string;
  embeddingModel?: string;
  temperature?: number;
  topK?: number;
  topP?: number;
  showThoughts?: boolean;
}

interface McpServer {
  id: string;
  name: string;
  url: string;
  command?: string;
  // Add other relevant fields
}

// --- System Settings ---
export const getSystemSettings = async (): Promise<SystemSettings> => {
  const response = await fetch(`${API_BASE_URL}/config/system`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch system settings' }));
    throw new Error(errorData.message || 'Failed to fetch system settings');
  }
  return response.json();
};

export const updateSystemSettings = async (settings: Partial<SystemSettings>): Promise<SystemSettings> => {
  const response = await fetch(`${API_BASE_URL}/config/system`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to update system settings' }));
    throw new Error(errorData.message || 'Failed to update system settings');
  }
  return response.json();
};

// --- LLM Settings ---
export const getLlmSettings = async (): Promise<LlmSettings> => {
  const response = await fetch(`${API_BASE_URL}/config/llm`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch LLM settings' }));
    throw new Error(errorData.message || 'Failed to fetch LLM settings');
  }
  return response.json();
};

export const updateLlmSettings = async (settings: Partial<LlmSettings>): Promise<LlmSettings> => {
  const response = await fetch(`${API_BASE_URL}/config/llm`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to update LLM settings' }));
    throw new Error(errorData.message || 'Failed to update LLM settings');
  }
  return response.json();
};

// --- MCP Servers ---
export const getMcpServers = async (): Promise<McpServer[]> => {
  const response = await fetch(`${API_BASE_URL}/config/mcp-servers`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to fetch MCP servers' }));
    throw new Error(errorData.message || 'Failed to fetch MCP servers');
  }
  return response.json();
};

export const addMcpServer = async (serverConfig: Omit<McpServer, 'id'>): Promise<McpServer> => {
  const response = await fetch(`${API_BASE_URL}/config/mcp-servers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serverConfig),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'Failed to add MCP server' }));
    throw new Error(errorData.message || 'Failed to add MCP server');
  }
  return response.json();
};

export const updateMcpServer = async (serverId: string, serverConfig: Partial<Omit<McpServer, 'id'>>): Promise<McpServer> => {
  const response = await fetch(`${API_BASE_URL}/config/mcp-servers/${serverId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(serverConfig),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: `Failed to update MCP server ${serverId}` }));
    throw new Error(errorData.message || `Failed to update MCP server ${serverId}`);
  }
  return response.json();
};

export const deleteMcpServer = async (serverId: string): Promise<{ success: boolean; deleted: string }> => {
  const response = await fetch(`${API_BASE_URL}/config/mcp-servers/${serverId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: `Failed to delete MCP server ${serverId}` }));
    throw new Error(errorData.message || `Failed to delete MCP server ${serverId}`);
  }
  return response.json();
};

// --- File System Operations ---
export interface ApiFileSystemEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
}

export const browseFiles = async (path: string): Promise<ApiFileSystemEntry[]> => {
  const response = await fetch(`${API_BASE_URL}/fs/browse?path=${encodeURIComponent(path)}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: `Failed to browse directory: ${path}` }));
    throw new Error(errorData.message || `Failed to browse directory: ${path}`);
  }
  return response.json();
};

export interface FileContentResponse {
  content: string;
  path: string;
  name: string;
}

export const readFileContent = async (path: string): Promise<FileContentResponse> => {
  const response = await fetch(`${API_BASE_URL}/fs/read?path=${encodeURIComponent(path)}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: `Failed to read file: ${path}` }));
    throw new Error(errorData.message || `Failed to read file: ${path}`);
  }
  return response.json();
};

// Placeholder for future file writing/editing
export const writeFileContent = async (path: string, content: string): Promise<{success: boolean, path: string}> => {
  const response = await fetch(`${API_BASE_URL}/fs/write`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: `Failed to write file: ${path}` }));
    throw new Error(errorData.message || `Failed to write file: ${path}`);
  }
  return response.json();
};
