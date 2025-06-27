import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import * as api from '../services/api'; // Assuming api.ts has browseFiles and readFileContent
import { ApiFileSystemEntry } from '../services/api'; // Import the specific type

// Re-exporting ApiFileSystemEntry as FileSystemEntry for use in context, or define a new one if it needs more fields client-side
export type FileSystemEntry = ApiFileSystemEntry & {
  children?: FileSystemEntry[]; // For directories, to store loaded children
  // content?: string; // Content will be stored separately in `fileContent` state
};

interface FileExplorerContextType {
  rootEntries: FileSystemEntry[]; // Top-level entries of the current target directory
  currentPath: string; // The path that was browsed to get rootEntries
  selectedFile: FileSystemEntry | null;
  fileContent: string | null;
  isLoading: boolean;
  isLoadingContent: boolean; // Separate loading state for file content
  error: string | null;
  browseDirectory: (path: string, entryToUpdate?: FileSystemEntry) => Promise<void>;
  selectFile: (file: FileSystemEntry) => Promise<void>;
  closeFile: () => void;
  goUpOneLevel: () => void;
  refreshCurrentDirectory: () => void;
}

const FileExplorerContext = createContext<FileExplorerContextType | undefined>(undefined);

export const FileExplorerProvider = ({ children }: { children: ReactNode }) => {
  const [rootEntries, setRootEntries] = useState<FileSystemEntry[]>([]);
  const [currentPath, setCurrentPath] = useState<string>('.'); // Start at project root
  const [selectedFile, setSelectedFile] = useState<FileSystemEntry | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false); // For directory browsing
  const [isLoadingContent, setIsLoadingContent] = useState(false); // For file content loading
  const [error, setError] = useState<string | null>(null);

  const browseDirectory = useCallback(async (path: string, entryToUpdate?: FileSystemEntry) => {
    setIsLoading(true);
    setError(null);
    try {
      const entriesFromApi = await api.browseFiles(path);
      const newEntries = entriesFromApi.map(e => ({ ...e, children: e.type === 'directory' ? [] : undefined }));

      if (entryToUpdate && entryToUpdate.type === 'directory') {
        // Update children of a specific entry (for expanding a folder in a tree view)
        setRootEntries(prevEntries =>
          updateEntryChildren(prevEntries, entryToUpdate.path, newEntries)
        );
      } else {
        // Set as root entries (for initial load or navigating to a new base path)
        setRootEntries(newEntries);
      }
      setCurrentPath(path); // Update current path
      // If we browse to a new directory, deselect any open file unless it's within this new view.
      // For simplicity now, always deselect.
      setSelectedFile(null);
      setFileContent(null);

    } catch (e: any) {
      setError(e.message || `Failed to browse directory: ${path}`);
      // setRootEntries([]); // Optionally clear entries on error
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Helper function to recursively update children of an entry in a tree
  const updateEntryChildren = (entries: FileSystemEntry[], targetPath: string, newChildren: FileSystemEntry[]): FileSystemEntry[] => {
    return entries.map(entry => {
      if (entry.path === targetPath) {
        return { ...entry, children: newChildren };
      }
      if (entry.children && entry.children.length > 0) {
        return { ...entry, children: updateEntryChildren(entry.children, targetPath, newChildren) };
      }
      return entry;
    });
  };


  const selectFile = useCallback(async (file: FileSystemEntry) => {
    if (file.type === 'directory') {
      // If it's a directory, we might want to expand it or navigate into it.
      // For a simple list, this could mean calling browseDirectory(file.path)
      // For a tree, this would mean fetching its children if not already loaded.
      browseDirectory(file.path, file); // Pass 'file' as entryToUpdate to load its children
      return;
    }
    setIsLoadingContent(true);
    setError(null);
    try {
      const contentData = await api.readFileContent(file.path);
      setSelectedFile(file);
      setFileContent(contentData.content);
    } catch (e: any) {
      setError(e.message || `Failed to read file content for ${file.name}`);
      setSelectedFile(null);
      setFileContent(null);
    } finally {
      setIsLoadingContent(false);
    }
  }, [browseDirectory]);

  const closeFile = () => {
    setSelectedFile(null);
    setFileContent(null);
  };

  const goUpOneLevel = useCallback(() => {
    if (currentPath === '.' || currentPath === '/') {
        // Already at root, cannot go up further
        return;
    }
    const pathSegments = currentPath.split('/').filter(Boolean);
    pathSegments.pop(); // Remove the last segment
    const parentPath = pathSegments.length > 0 ? pathSegments.join('/') : '.';
    browseDirectory(parentPath);
  }, [currentPath, browseDirectory]);

  const refreshCurrentDirectory = useCallback(() => {
    browseDirectory(currentPath);
  }, [currentPath, browseDirectory]);


  // Initial load for root directory
  useEffect(() => {
    browseDirectory('.'); // Load project root on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // browseDirectory is memoized

  return (
    <FileExplorerContext.Provider value={{
      rootEntries, currentPath, selectedFile, fileContent,
      isLoading, isLoadingContent, error, browseDirectory, selectFile, closeFile,
      goUpOneLevel, refreshCurrentDirectory
    }}>
      {children}
    </FileExplorerContext.Provider>
  );
};

export const useFileExplorer = (): FileExplorerContextType => {
  const context = useContext(FileExplorerContext);
  if (context === undefined) {
    throw new Error('useFileExplorer must be used within a FileExplorerProvider');
  }
  return context;
};
