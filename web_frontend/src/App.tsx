import { useState, useEffect, FormEvent, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import FileBrowserModal from './components/FileBrowserModal'; // Import the modal
import './App.css';

interface Message {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  isStreaming?: boolean;
}

interface Turn {
  role: 'user' | 'model';
  parts: Array<{ text?: string; toolCall?: any }>;
}

interface FileContext {
  fileName: string;
  content: string;
}

function App() {
  const [inputValue, setInputValue] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [chatHistory, setChatHistory] = useState<Turn[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [selectedFileContexts, setSelectedFileContexts] = useState<FileContext[]>([]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setMessages([{ id: 'initial-system-message', sender: 'system', text: 'Welcome! Attach files using the 📎 button and then ask questions about them.' }]);
  }, []);

  const handleFileSelectedInModal = (filePath: string, fileContent: string) => {
    const newFileContext: FileContext = { fileName: filePath, content: fileContent };
    // Avoid adding duplicate files, replace if already exists based on name
    setSelectedFileContexts(prevContexts => {
      const existingIndex = prevContexts.findIndex(fc => fc.fileName === filePath);
      if (existingIndex > -1) {
        const updatedContexts = [...prevContexts];
        updatedContexts[existingIndex] = newFileContext;
        return updatedContexts;
      }
      return [...prevContexts, newFileContext];
    });
    // Optionally add a system message indicating file is loaded
    setMessages(prev => [...prev, {
      id: `file-loaded-${Date.now()}`,
      sender: 'system',
      text: `File loaded: ${filePath}. You can now ask questions about it.`
    }]);
  };

  const removeFileContext = (fileNameToRemove: string) => {
    setSelectedFileContexts(prev => prev.filter(fc => fc.fileName !== fileNameToRemove));
    setMessages(prev => [...prev, {
      id: `file-removed-${Date.now()}`,
      sender: 'system',
      text: `File context removed: ${fileNameToRemove}.`
    }]);
  };


  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inputValue.trim() && selectedFileContexts.length === 0) return;

    const userInputText = inputValue;
    const userMessageId = `msg-${Date.now()}`;

    let displayUserMessage = userInputText;
    if (selectedFileContexts.length > 0 && !userInputText) {
        displayUserMessage = `(Querying about ${selectedFileContexts.map(fc => fc.fileName).join(', ')})`;
    } else if (selectedFileContexts.length > 0 && userInputText) {
        displayUserMessage = `${userInputText} (with context from ${selectedFileContexts.map(fc => fc.fileName).join(', ')})`;
    }

    const userMessage: Message = {
      id: userMessageId,
      sender: 'user',
      text: displayUserMessage,
    };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    setInputValue(''); // Clear input after sending
    // Keep selectedFileContexts until explicitly cleared or new files are added.
    // Or clear them after each message: setSelectedFileContexts([]); (depends on desired UX)
    setIsLoading(true);

    const newUserTurn: Turn = {
      role: 'user',
      parts: [{ text: userInputText }], // Backend will augment this with file content if needed
    };

    const currentChatHistory = [...chatHistory, newUserTurn];

    const assistantMessageId = `msg-${Date.now() + 1}`;
    setMessages(prevMessages => [
      ...prevMessages,
      { id: assistantMessageId, sender: 'assistant', text: '', isStreaming: true }
    ]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userInputText,
          history: currentChatHistory,
          fileContexts: selectedFileContexts, // Send selected file contexts
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown server error' }));
        throw new Error(errorData.details || errorData.error || `Server error: ${response.status}`);
      }

      if (response.headers.get('content-type')?.includes('application/json')) {
        const data = await response.json();
        const assistantReply = data.reply || 'Sorry, I could not get a response.';
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg.id === assistantMessageId ? { ...msg, text: assistantReply, isStreaming: false } : msg
          )
        );
        if (data.newHistory) {
          setChatHistory(data.newHistory as Turn[]);
        } else {
          const newModelTurn: Turn = { role: 'model', parts: [{ text: assistantReply }] };
          setChatHistory([...currentChatHistory, newModelTurn]);
        }
      } else { // Placeholder for actual streaming logic
        console.warn("Received non-JSON response, assuming text stream.");
        let fullText = "";
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (reader) {
          // eslint-disable-next-line no-constant-condition
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            fullText += chunk;
            setMessages(prevMessages =>
              prevMessages.map(msg =>
                msg.id === assistantMessageId ? { ...msg, text: fullText, isStreaming: true } : msg
              )
            );
          }
        }
        setMessages(prevMessages =>
          prevMessages.map(msg =>
            msg.id === assistantMessageId ? { ...msg, text: fullText, isStreaming: false } : msg
          )
        );
        const newModelTurn: Turn = { role: 'model', parts: [{ text: fullText }] };
        setChatHistory([...currentChatHistory, newModelTurn]);
      }
      // After successful submission, clear file contexts for next message if desired
      // setSelectedFileContexts([]);

    } catch (error) {
      console.error('Error sending message:', error);
      const errText = error instanceof Error ? error.message : 'An unknown error occurred.';
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === assistantMessageId && msg.isStreaming
            ? { ...msg, text: `Error: ${errText}`, isStreaming: false, sender: 'system' }
            : msg
        ).filter(msg => msg.id !== assistantMessageId || !msg.isStreaming || msg.text !== '')
      );
      if (!messages.find(msg => msg.id === assistantMessageId && msg.text.startsWith("Error:"))) {
         setMessages(prevMessages => [
            ...prevMessages,
            { id: `err-${Date.now()}`, sender: 'system', text: `Error: ${errText}` }
         ]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="app-container">
      <h1>Gemini CLI - Web UI</h1>
      <div className="chat-container">
        <div className="messages-area">
          {messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.sender} ${msg.isStreaming ? 'streaming' : ''}`}>
              <div className="message-sender">
                {msg.sender.charAt(0).toUpperCase() + msg.sender.slice(1)}
              </div>
              <div className="message-content">
                {msg.sender === 'assistant' || msg.sender === 'system' ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.text + (msg.isStreaming ? '...' : '')}
                  </ReactMarkdown>
                ) : (
                  msg.text
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {selectedFileContexts.length > 0 && (
          <div className="file-context-display">
            <strong>Context Files:</strong>
            <ul>
              {selectedFileContexts.map(fc => (
                <li key={fc.fileName}>
                  {fc.fileName}
                  <button onClick={() => removeFileContext(fc.fileName)} title="Remove file context">&times;</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <form onSubmit={handleSubmit} className="input-area">
          <button type="button" onClick={() => setIsModalOpen(true)} className="attach-file-button" title="Attach file">
            📎
          </button>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type your message, or attach files and ask about them..."
            disabled={isLoading}
          />
          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Sending...' : 'Send'}
          </button>
        </form>
      </div>
      <FileBrowserModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onFileSelect={handleFileSelectedInModal}
      />
    </div>
  );
}

export default App;
