export interface ApiFileSystemEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
}

export interface FileContentResponse {
  content: string;
  path: string;
  name: string;
}
