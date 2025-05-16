/**
 * ui/common.js
 * 通用UI功能
 */

// 切换"请先创建文件"提示和编辑器的显示状态
export const toggleNoFileMessage = (show) => {
  console.log(`[渲染进程:toggleNoFileMessage] 开始执行，参数show=${show}`);
  
  const noFileMessage = document.getElementById('no-file-placeholder');
  const editorContainer = document.getElementById('editor-container');
  
  if (!noFileMessage || !editorContainer) {
    console.error(`[渲染进程:toggleNoFileMessage] 无法找到必要的DOM元素`);
    return;
  }
  
  // 检查当前状态
  console.log(`[渲染进程:toggleNoFileMessage] 当前编辑器是否可见: ${!editorContainer.classList.contains('hidden')}`);
  console.log(`[渲染进程:toggleNoFileMessage] 当前提示是否可见: ${!noFileMessage.classList.contains('hidden')}`);
  
  try {
    if (show) {
      // 显示提示，隐藏编辑器
      console.log(`[渲染进程:toggleNoFileMessage] 显示"请先创建文件"提示，隐藏编辑器`);
      noFileMessage.classList.remove('hidden');
      editorContainer.classList.add('hidden');
      window.hasOpenedFiles = false;
      
      // 强制重置一些 UI 状态
      updateFilePath(null);
      const { editor } = require('../editor');
      if (editor) {
        try {
          editor.commands.clearContent();
          console.log(`[渲染进程:toggleNoFileMessage] 已清空编辑器内容`);
        } catch (err) {
          console.error(`[渲染进程:toggleNoFileMessage] 清空编辑器失败:`, err);
        }
      }
    } else {
      // 隐藏提示，显示编辑器
      console.log(`[渲染进程:toggleNoFileMessage] 隐藏"请先创建文件"提示，显示编辑器`);
      
      // 先确保编辑器可见，再隐藏提示，这样避免空白屏闪现
      editorContainer.classList.remove('hidden');
      noFileMessage.classList.add('hidden');
      window.hasOpenedFiles = true;
      
      // 触发编辑器重新渲染
      const { editor } = require('../editor');
      if (editor) {
        try {
          // 触发小变化以确保编辑器内容完全渲染
          editor.commands.focus();
          console.log(`[渲染进程:toggleNoFileMessage] 已将焦点设置到编辑器`);
        } catch (err) {
          console.error(`[渲染进程:toggleNoFileMessage] 设置编辑器焦点失败:`, err);
        }
      }
    }
    
    // 强制浏览器重新计算布局
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
      console.log(`[渲染进程:toggleNoFileMessage] 已触发重新计算布局`);
    }, 50);
    
    console.log(`[渲染进程:toggleNoFileMessage] 完成状态切换，现在 hasOpenedFiles=${window.hasOpenedFiles}`);
  } catch (error) {
    console.error(`[渲染进程:toggleNoFileMessage] 切换显示状态时发生错误:`, error);
  }
};

// 更新文件路径显示
export const updateFilePath = (filePath) => {
  const filePathElement = document.getElementById('current-file-path');
  if (!filePathElement) return;
  
  if (filePath) {
    // 为了更好的显示，只显示文件名和父目录
    const parts = filePath.split('/');
    const fileName = parts[parts.length - 1];
    const parentDir = parts[parts.length - 2] || '';
    
    filePathElement.textContent = parentDir ? `${parentDir}/${fileName}` : fileName;
    filePathElement.title = filePath; // 完整路径作为提示
  } else {
    filePathElement.textContent = '无打开文件';
    filePathElement.title = '';
  }
};
