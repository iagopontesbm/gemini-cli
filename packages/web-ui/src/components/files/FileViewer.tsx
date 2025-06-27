import React from 'react';
import { useFileExplorer } from '../../contexts/FileExplorerContext';
// For syntax highlighting, one might use a library like react-syntax-highlighter
// import SyntaxHighlighter from 'react-syntax-highlighter';
// import { docco } from 'react-syntax-highlighter/dist/esm/styles/hljs'; // Example style

// Basic styling for the viewer
const viewerStyle: React.CSSProperties = {
  padding: '10px',
  flexGrow: 1, // Take remaining space in the sidebar
  overflowY: 'auto',
  backgroundColor: '#f8f8f8',
  borderBottom: '1px solid #eee', // If there's content below it
  position: 'relative', // For close button
};

const preStyle: React.CSSProperties = {
  whiteSpace: 'pre-wrap', // Preserve whitespace and wrap lines
  wordWrap: 'break-word', // Break long words
  margin: 0, // Reset default margin
  fontSize: '0.9em', // Slightly smaller font for code
  fontFamily: '"Courier New", Courier, monospace',
};

const closeButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: '5px',
    right: '10px',
    background: 'none',
    border: '1px solid #ccc',
    borderRadius: '50%',
    cursor: 'pointer',
    width: '24px',
    height: '24px',
    lineHeight: '20px',
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#555',
};

const getFileExtension = (filename: string): string => {
  return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2).toLowerCase();
};

export const FileViewer: React.FC = () => {
  const { selectedFile, fileContent, isLoadingContent, error, closeFile } = useFileExplorer();

  if (!selectedFile) {
    return (
      <div style={{...viewerStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888' }}>
        <p>Select a file to view its content.</p>
      </div>
    );
  }

  if (isLoadingContent) {
    return <div style={viewerStyle}><p>Loading content for {selectedFile.name}...</p></div>;
  }

  if (error && !fileContent) { // Show error if content loading failed
    return <div style={viewerStyle}><p style={{ color: 'red' }}>Error loading {selectedFile.name}: {error}</p></div>;
  }

  const fileExtension = getFileExtension(selectedFile.name);
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(fileExtension);
  const isMarkdown = fileExtension === 'md';

  // Basic image preview (non-optimal for large images, just an example)
  // In a real app, consider URL.createObjectURL for local previews if content is Blob/File
  // For remote files, if content is base64, it can be used in src.
  // If content is raw binary, it's more complex. Assuming text files primarily.
  // For this example, if API returns image content as base64 string:
  // const imageSrc = `data:image/${fileExtension};base64,${fileContent}`;

  return (
    <div style={viewerStyle}>
        <button onClick={closeFile} style={closeButtonStyle} title="Close file">×</button>
        <h4 style={{ marginTop: 0, marginBottom: '10px', borderBottom: '1px solid #eee', paddingBottom: '5px' }}>
            {selectedFile.name}
        </h4>
      {/*
        Rudimentary image check - this assumes fileContent MIGHT be a base64 string for an image,
        or a direct URL if the API were to provide that. For now, mostly text.
      */}
      {/* {isImage && fileContent && (
        <div>
          <img src={imageSrc} alt={selectedFile.name} style={{ maxWidth: '100%', maxHeight: '300px' }} />
        </div>
      )} */}
      {/* {isMarkdown && fileContent && (
        // Basic Markdown rendering (a library like 'marked' or 'react-markdown' would be used here)
        <div dangerouslySetInnerHTML={{ __html: marked(fileContent) }} />
      )} */}
      {/* {!isImage && !isMarkdown && ( */}
        <pre style={preStyle}>
            {fileContent !== null ? fileContent : 'No content loaded or file is empty.'}
        </pre>
      {/* )} */}
      {/*
        Example using react-syntax-highlighter:
        <SyntaxHighlighter language={getFileExtension(selectedFile.name)} style={docco} showLineNumbers>
          {fileContent || ''}
        </SyntaxHighlighter>
      */}
    </div>
  );
};
