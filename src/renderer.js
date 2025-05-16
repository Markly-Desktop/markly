/**
 * This file is the entry point that will automatically be loaded by webpack and run in the "renderer" context.
 * It has been refactored to use a modular structure with separate modules for different features.
 *
 * Main modules:
 * - editor: Handles the markdown editor initialization and functionality
 * - files: Manages file operations like creating, opening, saving, and listing files
 * - ui: Controls UI elements and interactions
 * - settings: Manages user settings
 * - ipc: Handles communication with the main process
 *
 * The code has been separated into these modules for better maintainability and readability.
 *
 * To learn more about the "main" and "renderer" contexts in Electron, visit:
 * https://electronjs.org/docs/tutorial/process-model
 */

// Main entry point for the renderer process
// Import the renderer module which will initialize all functionality
import './renderer/index.js';

// Set up global namespace for sharing data between modules
window.currentFilePath = null;
window.hasOpenedFiles = false;

// Log application initialization
console.log('[渲染进程] Markly应用已启动，使用模块化结构');