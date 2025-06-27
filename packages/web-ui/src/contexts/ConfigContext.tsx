import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import * as api from '../services/api'; // Assuming api.ts is in ../services

// Re-defining interfaces here for clarity, or import them if they are in a shared types file
interface SystemSettings {
  workDirectory?: string;
  sandboxConfig?: string;
  debugMode?: boolean;
  userMemory?: string;
  contextFile?: string;
  toolDiscoveryCommand?: string;
  toolCallCommand?: string;
  // fileFilters?: any; // Define properly
  checkpointing?: boolean;
  proxy?: string;
  theme?: string;
  telemetry?: boolean;
}

interface LlmSettings {
  authType?: string;
  apiKeySet?: boolean;
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
}

interface ConfigContextType {
  systemSettings: SystemSettings | null;
  llmSettings: LlmSettings | null;
  mcpServers: McpServer[];
  loading: boolean;
  error: string | null; // Changed to string for simpler error messages
  fetchSettings: () => Promise<void>;
  updateSystemSetting: <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => Promise<void>;
  updateLlmSetting: <K extends keyof LlmSettings>(key: K, value: LlmSettings[K]) => Promise<void>;
  addMcpServerEntry: (serverConfig: Omit<McpServer, 'id'>) => Promise<void>;
  updateMcpServerEntry: (serverId: string, serverConfig: Partial<Omit<McpServer, 'id'>>) => Promise<void>;
  deleteMcpServerEntry: (serverId: string) => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider = ({ children }: { children: ReactNode }) => {
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [llmSettings, setLlmSettings] = useState<LlmSettings | null>(null);
  const [mcpServers, setMcpServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sysSettingsData, llmSettingsData, mcpServersData] = await Promise.all([
        api.getSystemSettings(),
        api.getLlmSettings(),
        api.getMcpServers(),
      ]);
      setSystemSettings(sysSettingsData);
      setLlmSettings(llmSettingsData);
      setMcpServers(mcpServersData);
    } catch (e: any) {
      setError(e.message || 'An unknown error occurred while fetching settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSystemSetting = async <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    if (!systemSettings) return;
    // const originalSettings = { ...systemSettings }; // For revert on error
    setSystemSettings(prev => prev ? { ...prev, [key]: value } : null); // Optimistic update
    try {
      await api.updateSystemSettings({ [key]: value });
      // No need to set again if optimistic update is confirmed by API returning the new state
      // Or refetch for pessimistic update: await fetchSettings();
    } catch (e: any) {
      setError(e.message || 'Failed to update system setting.');
      // setSystemSettings(originalSettings); // Revert optimistic update
      await fetchSettings(); // Or simply refetch to get the true state
    }
  };

  const updateLlmSetting = async <K extends keyof LlmSettings>(key: K, value: LlmSettings[K]) => {
    if (!llmSettings) return;
    setLlmSettings(prev => prev ? { ...prev, [key]: value } : null); // Optimistic update
    try {
      await api.updateLlmSettings({ [key]: value });
    } catch (e: any) {
      setError(e.message || 'Failed to update LLM setting.');
      await fetchSettings(); // Refetch
    }
  };

  const addMcpServerEntry = async (serverConfig: Omit<McpServer, 'id'>) => {
    try {
      // const newServer = await api.addMcpServer(serverConfig);
      // setMcpServers(prev => [...prev, newServer]);
      await api.addMcpServer(serverConfig);
      await fetchSettings(); // Refetch to get new list with ID
    } catch (e: any) {
      setError(e.message || 'Failed to add MCP server.');
    }
  };

  const updateMcpServerEntry = async (serverId: string, serverConfig: Partial<Omit<McpServer, 'id'>>) => {
    try {
      // await api.updateMcpServer(serverId, serverConfig);
      // setMcpServers(prev => prev.map(s => s.id === serverId ? { ...s, ...serverConfig } : s));
      await api.updateMcpServer(serverId, serverConfig);
      await fetchSettings(); // Refetch
    } catch (e: any) {
      setError(e.message || 'Failed to update MCP server.');
    }
  };

  const deleteMcpServerEntry = async (serverId: string) => {
    try {
      // await api.deleteMcpServer(serverId);
      // setMcpServers(prev => prev.filter(s => s.id !== serverId));
      await api.deleteMcpServer(serverId);
      await fetchSettings(); // Refetch
    } catch (e: any) {
      setError(e.message || 'Failed to delete MCP server.');
    }
  };

  return (
    <ConfigContext.Provider value={{
      systemSettings, llmSettings, mcpServers, loading, error,
      fetchSettings, updateSystemSetting, updateLlmSetting,
      addMcpServerEntry, updateMcpServerEntry, deleteMcpServerEntry
    }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = (): ConfigContextType => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};
