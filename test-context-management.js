#!/usr/bin/env node

/**
 * Test script for context management functionality
 * Run with: node test-context-management.js
 */

console.log('🧪 Testing Context Management System...\n');

// Simulate the context management flow
let localContext = new Map();
let geminiContext = new Set();
let pendingFiles = new Set();

// Simulate adding files to context
function addFileToContext(filePath) {
  console.log(`📁 Adding ${filePath} to pending...`);
  pendingFiles.add(filePath);
  
  // Simulate Gemini processing
  setTimeout(() => {
    console.log(`✅ ${filePath} processed by Gemini`);
    pendingFiles.delete(filePath);
    localContext.set(filePath, { processedByGemini: true });
    geminiContext.add(filePath);
  }, 1000);
}

// Simulate context commands
function listContext() {
  console.log('\n📋 Context Status:');
  console.log(`   Local tracking: ${localContext.size} files`);
  console.log(`   Gemini context: ${geminiContext.size} files`);
  console.log(`   Pending: ${pendingFiles.size} files`);
  
  if (localContext.size > 0) {
    console.log('   Files in local tracking:');
    for (const [file] of localContext) {
      console.log(`     - ${file}`);
    }
  }
  
  if (geminiContext.size > 0) {
    console.log('   Files in Gemini context:');
    for (const file of geminiContext) {
      console.log(`     - ${file}`);
    }
  }
}

function clearContext() {
  console.log('\n🗑️  Clearing context...');
  const localCount = localContext.size;
  const geminiCount = geminiContext.size;
  
  localContext.clear();
  geminiContext.clear();
  pendingFiles.clear();
  
  console.log(`✅ Cleared ${localCount} files from local tracking`);
  console.log(`✅ Cleared ${geminiCount} files from Gemini context`);
}

function removeFile(filePath) {
  console.log(`\n❌ Removing ${filePath}...`);
  const wasInLocal = localContext.has(filePath);
  const wasInGemini = geminiContext.has(filePath);
  
  localContext.delete(filePath);
  geminiContext.delete(filePath);
  pendingFiles.delete(filePath);
  
  if (wasInLocal) {
    console.log(`✅ Removed ${filePath} from local tracking`);
  }
  if (wasInGemini) {
    console.log(`✅ Removed ${filePath} from Gemini context`);
  }
  if (!wasInLocal && !wasInGemini) {
    console.log(`ℹ️  ${filePath} was not in context`);
  }
}

// Test the functionality
console.log('1️⃣  Adding files to context...');
addFileToContext('package.json');
addFileToContext('README.md');
addFileToContext('src/index.ts');

setTimeout(() => {
  listContext();
  
  console.log('\n2️⃣  Removing a file...');
  removeFile('README.md');
  
  setTimeout(() => {
    listContext();
    
    console.log('\n3️⃣  Clearing all context...');
    clearContext();
    
    setTimeout(() => {
      listContext();
      console.log('\n✅ Context management test completed!');
    }, 500);
  }, 500);
}, 1500); 