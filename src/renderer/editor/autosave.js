/**
 * editor/autosave.js
 * 自动保存功能
 */

import { editor } from './index';

// 用于自动保存的延时器
let autoSaveTimeout;

// 实现自动保存功能
export const autoSaveContent = async () => {
  // 获取当前文件路径
  const currentFilePath = window.currentFilePath;
  
  // 如果没有打开文件，则不执行保存
  if (!currentFilePath || !editor) {
    console.log('[渲染进程:autoSaveContent] 没有打开文件或编辑器不存在，跳过自动保存');
    return;
  }
  
  try {
    // 获取当前 markdown 内容
    const markdownContent = editor.storage.markdown.getMarkdown();
    console.log(`[渲染进程:autoSaveContent] 尝试自动保存到: ${currentFilePath}`);
    
    // 调用主进程保存文件 - 使用正确的API
    const result = await window.electronAPI.saveCurrentFile(markdownContent);
    
    if (result && result.success) {
      console.log(`[渲染进程:autoSaveContent] 自动保存成功: ${result.filePath}`);
    } else if (result) {
      console.error(`[渲染进程:autoSaveContent] 自动保存失败: ${result.error}`);
    }
  } catch (error) {
    console.error('[渲染进程:autoSaveContent] 自动保存时发生错误:', error);
  }
};

// 防抖自动保存功能
export const debouncedAutoSave = (immediate = false) => {
  // 清除之前的定时器
  if (autoSaveTimeout) {
    clearTimeout(autoSaveTimeout);
  }
  
  // 如果是立即保存，则直接执行
  if (immediate) {
    autoSaveContent();
    return;
  }
  
  // 否则启动新的定时器，500毫秒后自动保存
  autoSaveTimeout = setTimeout(() => {
    autoSaveContent();
  }, 500); // 设置500毫秒的防抖时间
};
