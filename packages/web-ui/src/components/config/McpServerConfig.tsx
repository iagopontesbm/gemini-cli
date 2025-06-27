import React, { useState } from 'react';
import { useConfig } from '../../contexts/ConfigContext';

// Assuming FormRow, TextInput, etc. are available as in other files
const FormRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center' }}>
    <label style={{ width: '80px', marginRight: '10px', textAlign: 'right', fontSize: '0.9em' }}>{label}:</label>
    {children}
  </div>
);

const TextInput: React.FC<{ value: string; onChange: (value: string) => void; placeholder?: string, style?: React.CSSProperties }> =
  ({ value, onChange, placeholder, style }) => (
  <input
    type="text"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    style={{ padding: '5px', flexGrow: 1, ...style }}
  />
);

const Button: React.FC<{ onClick: () => void; children: React.ReactNode, style?: React.CSSProperties, variant?: 'danger' | 'primary'}> =
    ({ onClick, children, style, variant }) => {
    const baseStyle: React.CSSProperties = {
        padding: '5px 10px',
        marginLeft: '5px',
        cursor: 'pointer',
        border: '1px solid #ccc',
        borderRadius: '3px'
    };
    const dangerStyle: React.CSSProperties = variant === 'danger' ? { backgroundColor: '#f44336', color: 'white', borderColor: '#f44336' } : {};
    const primaryStyle: React.CSSProperties = variant === 'primary' ? { backgroundColor: '#2196F3', color: 'white', borderColor: '#2196F3' } : {};

    return (
        <button onClick={onClick} style={{ ...baseStyle, ...primaryStyle, ...dangerStyle, ...style }}>
            {children}
        </button>
    );
}


interface McpServer {
  id: string;
  name: string;
  url: string;
  command?: string;
}

export const McpServerConfigComponent = () => {
  const { mcpServers, addMcpServerEntry, updateMcpServerEntry, deleteMcpServerEntry, error } = useConfig();
  const [newServerName, setNewServerName] = useState('');
  const [newServerUrl, setNewServerUrl] = useState('');
  const [newServerCommand, setNewServerCommand] = useState('');
  const [editingServer, setEditingServer] = useState<McpServer | null>(null);

  const handleAddServer = () => {
    if (!newServerName.trim() || !newServerUrl.trim()) {
      alert('Server Name and URL are required.');
      return;
    }
    addMcpServerEntry({ name: newServerName, url: newServerUrl, command: newServerCommand });
    setNewServerName('');
    setNewServerUrl('');
    setNewServerCommand('');
  };

  const handleUpdateServer = () => {
    if (editingServer) {
      updateMcpServerEntry(editingServer.id, {
        name: editingServer.name,
        url: editingServer.url,
        command: editingServer.command,
      });
      setEditingServer(null);
    }
  };

  const startEdit = (server: McpServer) => {
    setEditingServer({ ...server });
  };

  const handleEditChange = (field: keyof McpServer, value: string) => {
    if (editingServer) {
      setEditingServer({ ...editingServer, [field]: value });
    }
  };


  return (
    <div style={{ border: '1px solid #eee', padding: '10px', borderRadius: '5px', marginBottom: '15px' }}>
      <h4>MCP Servers</h4>
      {error && <p style={{color: 'red'}}>Error: {error}</p>}
      <div style={{ marginBottom: '15px', paddingBottom: '10px', borderBottom: '1px solid #eee' }}>
        <h5>{editingServer ? 'Edit Server' : 'Add New Server'}</h5>
        <FormRow label="Name">
          <TextInput
            value={editingServer ? editingServer.name : newServerName}
            onChange={editingServer ? (val) => handleEditChange('name', val) : setNewServerName}
            placeholder="e.g., Local GenMedia"
          />
        </FormRow>
        <FormRow label="URL">
          <TextInput
            value={editingServer ? editingServer.url : newServerUrl}
            onChange={editingServer ? (val) => handleEditChange('url', val) : setNewServerUrl}
            placeholder="http://localhost:8000"
          />
        </FormRow>
        <FormRow label="Command">
          <TextInput
            value={editingServer ? (editingServer.command || '') : newServerCommand}
            onChange={editingServer ? (val) => handleEditChange('command', val) : setNewServerCommand}
            placeholder="(Optional) e.g., mcp-server start"
          />
        </FormRow>
        {editingServer ? (
          <div style={{ textAlign: 'right' }}>
            <Button onClick={handleUpdateServer} variant="primary">Save Changes</Button>
            <Button onClick={() => setEditingServer(null)} style={{marginLeft: '5px'}}>Cancel</Button>
          </div>
        ) : (
          <div style={{ textAlign: 'right' }}>
            <Button onClick={handleAddServer} variant="primary">Add Server</Button>
          </div>
        )}
      </div>

      <h5>Configured Servers</h5>
      {mcpServers.length === 0 && <p>No MCP servers configured.</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {mcpServers.map((server) => (
          <li key={server.id} style={{ marginBottom: '10px', padding: '8px', border: '1px solid #f0f0f0', borderRadius: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <strong>{server.name}</strong><br />
              <small style={{color: '#555'}}>{server.url}</small><br/>
              {server.command && <small style={{color: '#777', fontStyle: 'italic'}}>Cmd: {server.command}</small>}
            </div>
            <div>
              <Button onClick={() => startEdit(server)} style={{marginRight: '5px'}}>Edit</Button>
              <Button onClick={() => deleteMcpServerEntry(server.id)} variant="danger">Del</Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
