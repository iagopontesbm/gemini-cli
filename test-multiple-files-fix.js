#!/usr/bin/env node

/**
 * Test script to verify multiple file context management
 */

console.log('🧪 Testing Multiple File Context Management Fix...\n');

// Simulate the context management with the fixed logic
class FixedContextManager {
  constructor() {
    this.files = new Map();
    this.debug = true;
  }

  log(message) {
    if (this.debug) {
      console.log(`[DEBUG] ${message}`);
    }
  }

  async addFile(filepath) {
    this.log(`addFile called with: ${filepath}`);
    
    // Simulate file info
    const fileInfo = {
      filepath,
      size: 1000,
      estimatedTokens: 250,
      addedAt: new Date(),
      lastAccessed: new Date(),
      processedByGemini: false,
      processedAt: 0,
    };

    // Check if file is already in context using current state
    if (this.files.has(filepath)) {
      this.log(`File already exists: ${filepath}`);
      return { success: false, error: 'File already in context' };
    }
    
    this.log(`Adding file to context: ${filepath}`);
    this.files.set(filepath, fileInfo);
    this.log(`Context now has ${this.files.size} files: ${Array.from(this.files.keys()).join(', ')}`);
    
    return { success: true, info: fileInfo };
  }

  markFileAsProcessedByGemini(filepath) {
    this.log(`markFileAsProcessedByGemini called with: ${filepath}`);
    
    const fileInfo = this.files.get(filepath);
    if (fileInfo) {
      this.log(`Marking file as processed: ${filepath}`);
      this.files.set(filepath, {
        ...fileInfo,
        processedByGemini: true,
        processedAt: Date.now()
      });
      
      const processedFiles = Array.from(this.files.entries())
        .filter(([_, info]) => info.processedByGemini)
        .map(([path, _]) => path);
      this.log(`Processed files: ${processedFiles.join(', ')}`);
    } else {
      this.log(`File not found for marking as processed: ${filepath}`);
    }
  }

  getContextStatus() {
    const fileEntries = Array.from(this.files.entries());
    const processedFiles = fileEntries.filter(([_, fileInfo]) => fileInfo.processedByGemini);
    const pendingFiles = fileEntries.filter(([_, fileInfo]) => !fileInfo.processedByGemini);
    
    this.log(`getContextStatus - Total files: ${fileEntries.length}, Processed: ${processedFiles.length}, Pending: ${pendingFiles.length}`);
    this.log(`All files: ${fileEntries.map(([path, info]) => `${path}(${info.processedByGemini ? 'processed' : 'pending'})`).join(', ')}`);
    
    return {
      files: fileEntries.length,
      processedFiles: processedFiles.length,
      pendingFiles: pendingFiles.length,
    };
  }

  getGeminiContextFiles() {
    const processedFiles = Array.from(this.files.entries())
      .filter(([_, fileInfo]) => fileInfo.processedByGemini)
      .map(([filePath, _]) => filePath);
    
    this.log(`getGeminiContextFiles - Returning: ${processedFiles.join(', ')}`);
    return processedFiles;
  }
}

// Test the fixed context manager
async function testFixedContextManager() {
  const context = new FixedContextManager();
  
  console.log('1️⃣ Testing multiple file addition...');
  
  // Add multiple files in quick succession
  const files = ['file1.txt', 'file2.txt', 'file3.txt'];
  
  for (const file of files) {
    const result = await context.addFile(file);
    console.log(`   ${file}: ${result.success ? '✓ Added' : '✗ Failed'}`);
  }
  
  console.log('\n2️⃣ Checking context status...');
  const status = context.getContextStatus();
  console.log(`   Status: ${status.files} total, ${status.processedFiles} processed, ${status.pendingFiles} pending`);
  
  console.log('\n3️⃣ Marking files as processed...');
  for (const file of files) {
    context.markFileAsProcessedByGemini(file);
  }
  
  console.log('\n4️⃣ Final context status...');
  const finalStatus = context.getContextStatus();
  console.log(`   Status: ${finalStatus.files} total, ${finalStatus.processedFiles} processed, ${finalStatus.pendingFiles} pending`);
  
  const processedFiles = context.getGeminiContextFiles();
  console.log(`   Processed files: [${processedFiles.join(', ')}]`);
  
  console.log('\n✅ Test completed!');
}

testFixedContextManager(); 