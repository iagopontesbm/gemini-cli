import React from 'react';
import { useConfig } from '../../contexts/ConfigContext';

// Basic Input, Select, Switch components (assumed to exist or be simple HTML elements)
// For a real app, these would likely come from a UI library or be custom components.

const FormRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center' }}>
    <label style={{ width: '180px', marginRight: '10px', textAlign: 'right', fontSize: '0.9em' }}>{label}:</label>
    {children}
  </div>
);

const TextInput: React.FC<{ value: string; onChange: (value: string) => void; type?: string, placeholder?: string }> =
  ({ value, onChange, type = "text", placeholder }) => (
  <input
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    style={{ padding: '5px', minWidth: '200px' }}
  />
);

const SelectInput: React.FC<{ value: string; onChange: (value: string) => void; options: Array<{value: string, label: string}> }> =
  ({ value, onChange, options }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} style={{ padding: '5px', minWidth: '200px' }}>
    {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
  </select>
);

const SwitchInput: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; }> =
  ({ checked, onChange }) => (
  <input
    type="checkbox"
    checked={checked}
    onChange={(e) => onChange(e.target.checked)}
    style={{ margin: '5px' }}
  />
);


export const SystemSettingsComponent = () => {
  const { systemSettings, updateSystemSetting, error } = useConfig();

  if (!systemSettings) return <p>Loading system settings...</p>;

  // Generic handler for most inputs
  const handleChange = <K extends keyof typeof systemSettings>(
    key: K,
    value: (typeof systemSettings)[K]
  ) => {
    updateSystemSetting(key, value);
  };

  return (
    <div style={{ border: '1px solid #eee', padding: '10px', borderRadius: '5px', marginBottom: '15px' }}>
      <h4>System Settings</h4>
      {error && <p style={{color: 'red'}}>Error: {error}</p>}
      <FormRow label="Work Directory">
        <TextInput
          value={systemSettings.workDirectory || ''}
          onChange={(val) => handleChange('workDirectory', val)}
        />
      </FormRow>
      <FormRow label="Sandbox Config">
        <SelectInput
          value={systemSettings.sandboxConfig || 'None'}
          onChange={(val) => handleChange('sandboxConfig', val)}
          options={[
            { value: 'Docker', label: 'Docker' },
            { value: 'Podman', label: 'Podman' },
            { value: 'None', label: 'None' },
          ]}
        />
      </FormRow>
      <FormRow label="Debug Mode">
        <SwitchInput
          checked={!!systemSettings.debugMode}
          onChange={(val) => handleChange('debugMode', val)}
        />
      </FormRow>
      <FormRow label="User Memory File">
        <TextInput
          value={systemSettings.userMemory || ''}
          onChange={(val) => handleChange('userMemory', val)}
          placeholder="e.g., user_memory.json"
        />
      </FormRow>
      <FormRow label="Context File">
        <TextInput
          value={systemSettings.contextFile || ''}
          onChange={(val) => handleChange('contextFile', val)}
          placeholder="e.g., GEMINI.md or path/to/file"
        />
      </FormRow>
      <FormRow label="Tool Discovery Cmd">
        <TextInput
          value={systemSettings.toolDiscoveryCommand || ''}
          onChange={(val) => handleChange('toolDiscoveryCommand', val)}
          placeholder="e.g., auto or custom command"
        />
      </FormRow>
      <FormRow label="Tool Call Cmd">
        <TextInput
          value={systemSettings.toolCallCommand || ''}
          onChange={(val) => handleChange('toolCallCommand', val)}
          placeholder="e.g., auto or custom command"
        />
      </FormRow>
      <FormRow label="Checkpointing">
        <SwitchInput
          checked={!!systemSettings.checkpointing}
          onChange={(val) => handleChange('checkpointing', val)}
        />
      </FormRow>
      <FormRow label="Proxy URL">
        <TextInput
          value={systemSettings.proxy || ''}
          onChange={(val) => handleChange('proxy', val)}
          placeholder="e.g., http://localhost:8888"
        />
      </FormRow>
      <FormRow label="UI Theme">
         <SelectInput
          value={systemSettings.theme || 'default-dark'}
          onChange={(val) => handleChange('theme', val)}
          options={[ // These are examples, actual themes might differ
            { value: 'default-dark', label: 'Default Dark' },
            { value: 'default-light', label: 'Default Light' },
            { value: 'atom-one', label: 'Atom One' },
            { value: 'github', label: 'GitHub' },
          ]}
        />
      </FormRow>
      <FormRow label="Telemetry">
        <SwitchInput
          checked={!!systemSettings.telemetry}
          onChange={(val) => handleChange('telemetry', val)}
        />
      </FormRow>
      {/*
      TODO: File Filter Settings (could be a sub-component)
      - Behavior (dropdown: ignore, include)
      - Recursive Search (switch)
      - Patterns (textarea or list input)
      Based on .gitignore format
      */}
    </div>
  );
};
