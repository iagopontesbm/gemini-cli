import React from 'react';
import { SystemSettingsComponent } from '../config/SystemSettings';
import { LlmConfigComponent } from '../config/LlmConfig';
import { McpServerConfigComponent } from '../config/McpServerConfig';
import { useConfig } from '../../contexts/ConfigContext'; // Assuming ConfigContext is set up

export const LeftSidebar = () => {
  const { loading, error, systemSettings } = useConfig(); // systemSettings might be useful for theme

  // Basic styling for the sidebar
  const sidebarStyle: React.CSSProperties = {
    width: '350px', // Adjusted width for more content
    minWidth: '300px',
    height: '100vh',
    borderRight: '1px solid #ddd', // Softer border
    padding: '15px',
    overflowY: 'auto', // Allow scrolling if content overflows
    backgroundColor: '#f9f9f9', // Light background color
    fontFamily: 'Arial, sans-serif', // Basic font
  };

  const headingStyle: React.CSSProperties = {
    fontSize: '1.5em',
    color: '#333',
    marginBottom: '20px',
    borderBottom: '1px solid #eee',
    paddingBottom: '10px',
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: '20px',
  };

   if (loading) return <div style={sidebarStyle}><h2 style={headingStyle}>Settings</h2><p>Loading configuration...</p></div>;
   if (error) return <div style={sidebarStyle}><h2 style={headingStyle}>Settings</h2><p style={{color: 'red'}}>Error: {error}</p><p>Please ensure the backend server is running and accessible.</p></div>;


  return (
    <div style={sidebarStyle}>
      <h2 style={headingStyle}>Gemini Settings</h2>

      <div style={sectionStyle}>
        <SystemSettingsComponent />
      </div>

      <div style={sectionStyle}>
        <LlmConfigComponent />
      </div>

      <div style={sectionStyle}>
        <McpServerConfigComponent />
      </div>

      {/*
        Future sections to be added here:
        <hr />
        <FileFilterSettingsComponent /> // TODO
        <hr />
        <ThemeSelectorComponent /> // TODO (Theme is part of SystemSettings for now)
      */}

      <div style={{marginTop: '30px', fontSize: '0.8em', color: '#777', textAlign: 'center'}}>
          Gemini Web UI v0.1.0 (Conceptual)
      </div>
    </div>
  );
};
