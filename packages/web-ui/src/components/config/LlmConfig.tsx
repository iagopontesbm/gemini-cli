import React from 'react';
import { useConfig } from '../../contexts/ConfigContext';

// Assuming FormRow, TextInput, SelectInput, SwitchInput are imported or defined as in SystemSettings.tsx
// For brevity, I'll re-declare simplified versions here. If they were in a common folder, we'd import them.

const FormRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center' }}>
    <label style={{ width: '180px', marginRight: '10px', textAlign: 'right', fontSize: '0.9em' }}>{label}:</label>
    {children}
  </div>
);

const TextInput: React.FC<{ value: string; onChange: (value: string) => void; type?: string, placeholder?: string, disabled?: boolean }> =
  ({ value, onChange, type = "text", placeholder, disabled }) => (
  <input
    type={type}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    disabled={disabled}
    style={{ padding: '5px', minWidth: '200px' }}
  />
);

const SelectInput: React.FC<{ value: string; onChange: (value: string) => void; options: Array<{value: string, label: string}>, disabled?: boolean }> =
  ({ value, onChange, options, disabled }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} style={{ padding: '5px', minWidth: '200px' }}>
    {options.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
  </select>
);

const SwitchInput: React.FC<{ checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean }> =
  ({ checked, onChange, disabled }) => (
  <input
    type="checkbox"
    checked={checked}
    onChange={(e) => onChange(e.target.checked)}
    disabled={disabled}
    style={{ margin: '5px' }}
  />
);

const NumberInput: React.FC<{ value: number; onChange: (value: number) => void; min?: number; max?: number; step?: number, disabled?: boolean }> =
    ({ value, onChange, min, max, step, disabled }) => (
    <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        style={{ padding: '5px', minWidth: '200px' }}
    />
);

export const LlmConfigComponent = () => {
  const { llmSettings, updateLlmSetting, error } = useConfig();

  if (!llmSettings) return <p>Loading LLM settings...</p>;

  const handleChange = <K extends keyof typeof llmSettings>(
    key: K,
    value: (typeof llmSettings)[K]
  ) => {
    updateLlmSetting(key, value);
  };

  return (
    <div style={{ border: '1px solid #eee', padding: '10px', borderRadius: '5px', marginBottom: '15px' }}>
      <h4>Large Language Model</h4>
      {error && <p style={{color: 'red'}}>Error: {error}</p>}
      <FormRow label="Auth Type">
        <SelectInput
          value={llmSettings.authType || 'None'}
          onChange={(val) => handleChange('authType', val)}
          options={[
            { value: 'APIKey', label: 'API Key' },
            { value: 'OAuth', label: 'OAuth' },
            { value: 'gcloud', label: 'gcloud' },
            { value: 'None', label: 'None' },
          ]}
        />
      </FormRow>
      {llmSettings.authType === 'APIKey' && (
        <FormRow label="API Key">
          <TextInput
            type="password"
            value={""} // We don't display the key, this field is for input only if it's not set
            onChange={(val) => console.log("API Key input changed - handle this specially, perhaps a 'Set Key' button")}
            placeholder={llmSettings.apiKeySet ? 'Configured (Update if needed)' : 'Enter API Key'}
          />
          {/* A button to explicitly save/update the API key might be better for UX */}
        </FormRow>
      )}
      <FormRow label="Default Model">
        <TextInput // Or a Select if there's a predefined list
          value={llmSettings.defaultModel || ''}
          onChange={(val) => handleChange('defaultModel', val)}
          placeholder="e.g., gemini-1.5-pro-latest"
        />
      </FormRow>
      <FormRow label="Embedding Model">
        <TextInput // Or a Select
          value={llmSettings.embeddingModel || ''}
          onChange={(val) => handleChange('embeddingModel', val)}
          placeholder="e.g., text-embedding-004"
        />
      </FormRow>
      <FormRow label="Temperature">
        <NumberInput
          value={llmSettings.temperature ?? 0.7}
          onChange={(val) => handleChange('temperature', val)}
          min={0} max={1} step={0.1}
        />
      </FormRow>
      <FormRow label="TopK">
         <NumberInput
          value={llmSettings.topK ?? 40}
          onChange={(val) => handleChange('topK', val)}
          min={1} step={1}
        />
      </FormRow>
      <FormRow label="TopP">
        <NumberInput
          value={llmSettings.topP ?? 0.95}
          onChange={(val) => handleChange('topP', val)}
          min={0} max={1} step={0.01}
        />
      </FormRow>
      <FormRow label="Show Thoughts">
        <SwitchInput
          checked={!!llmSettings.showThoughts}
          onChange={(val) => handleChange('showThoughts', val)}
        />
      </FormRow>
    </div>
  );
};
