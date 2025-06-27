import React from 'react';

interface ToolOutputViewerProps {
  // Props might include:
  // - toolName: string
  // - stdout: string
  // - stderr: string
  // - status: 'running' | 'completed' | 'error'
}

const outputViewerStyle: React.CSSProperties = {
  padding: '10px',
  borderTop: '1px solid #eee',
  backgroundColor: '#222', // Dark background for terminal-like output
  color: '#eee',
  fontFamily: '"Courier New", Courier, monospace',
  fontSize: '0.9em',
  minHeight: '100px', // Ensure it has some height even when empty
  maxHeight: '30vh', // Limit height
  overflowY: 'auto', // Scroll for long output
};

const preStyle: React.CSSProperties = {
  whiteSpace: 'pre-wrap',
  wordWrap: 'break-word',
  margin: 0,
};

const stderrStyle: React.CSSProperties = {
  color: '#ff6b6b', // Reddish color for stderr
};

export const ToolOutputViewer: React.FC<ToolOutputViewerProps> = (/* { toolName, stdout, stderr, status } */) => {
  // This is a placeholder. Actual data would come from the agent's tool execution.
  // For example, if a `run_shell_command` tool is executed by the agent.

  // Example: Simulate receiving tool output
  const toolNameExample = "run_shell_command";
  const stdoutExample = "Listing directory /app:\n-rw-r--r-- 1 user user 1024 Jan 1 10:00 main.py\n-rw-r--r-- 1 user user  512 Jan 1 10:05 utils.py\n";
  const stderrExample = ""; // "Error: Command not found.\n";
  const statusExample = "completed";

  return (
    <div style={outputViewerStyle}>
      <h5 style={{ marginTop: 0, marginBottom: '10px', color: '#eee', borderBottom: '1px solid #555', paddingBottom: '5px' }}>
        Tool Output: {toolNameExample || "No active tool"}
        {statusExample && <span style={{float: 'right', fontStyle: 'italic', color: statusExample === 'error' ? '#ff6b6b' : '#88dd88'}}>{statusExample}</span>}
      </h5>
      {(!stdoutExample && !stderrExample && statusExample !== 'running') && (
        <p style={{ color: '#888' }}>No output from the last tool execution, or no tool run yet.</p>
      )}
      {statusExample === 'running' && (
        <p style={{ color: '#88dd88', fontStyle: 'italic' }}>Tool is running...</p>
      )}
      {stdoutExample && (
        <div>
          <strong style={{color: '#aaa'}}>stdout:</strong>
          <pre style={preStyle}>{stdoutExample}</pre>
        </div>
      )}
      {stderrExample && (
        <div style={{marginTop: stdoutExample ? '10px' : '0'}}>
          <strong style={{color: '#ff8888'}}>stderr:</strong>
          <pre style={{...preStyle, ...stderrStyle}}>{stderrExample}</pre>
        </div>
      )}
    </div>
  );
};
