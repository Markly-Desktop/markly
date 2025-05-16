/**
 * files/operations.js
 * 文件操作功能
 */

import { editor } from '../editor';
import { toggleNoFileMessage, updateFilePath } from '../ui';
import { loadFileList } from './list';
import { debouncedAutoSave, autoSaveContent } from '../editor/autosave';

// 新建文件
export const createNewFile = async () => {
  try {
    const result = await window.electronAPI.createNewFile('Untitled.md');
    if (result && result.success) {
      // 清空编辑器内容
      editor.commands.clearContent();
      
      // 更新路径显示
      updateFilePath(result.filePath);
      
      // 更新全局路径
      window.currentFilePath = result.filePath;
      
      // 创建文件后隐藏"请先创建文件"的提示，显示编辑器
      toggleNoFileMessage(false);
      
      // 刷新文件列表
      await loadFileList();
      
      console.log(`成功创建并打开文件: ${result.filePath}`);
    } else if (result && result.error) {
      alert(`创建文件失败: ${result.error}`);
    }
  } catch (error) {
    console.error('创建新文件时出错:', error);
    alert(`创建文件失败: ${error.message}`);
  }
};

// 保存文件
export const saveFile = async (filePath) => {
  try {
    // 检查编辑器是否初始化
    if (!editor) {
      console.error('[渲染进程:saveFile] 编辑器未初始化');
      return;
    }
    
    console.log(`[渲染进程:saveFile] 开始保存文件，参数filePath=${filePath}`);
    
    // 获取当前 markdown 内容
    const markdownContent = editor.storage.markdown.getMarkdown();
    
    let result;
    
    // 如果提供了文件路径，则为"另存为"操作
    if (filePath) {
      console.log(`[渲染进程:saveFile] 使用指定路径保存: ${filePath}`);
      result = await window.electronAPI.saveFileAs(filePath, markdownContent);
    } 
    // 如果当前有打开的文件，则直接保存到该文件
    else if (window.currentFilePath) {
      console.log(`[渲染进程:saveFile] 保存到当前文件: ${window.currentFilePath}`);
      result = await window.electronAPI.saveCurrentFile(markdownContent);
    } 
    // 如果没有当前文件路径，则弹出对话框让用户选择保存位置
    else {
      console.log(`[渲染进程:saveFile] 没有文件路径，请求另存为`);
      result = await window.electronAPI.saveFileAs(null, markdownContent);
    }
    
    if (result && result.success) {
      console.log(`[渲染进程:saveFile] 保存成功: ${result.filePath}`);
      
      // 更新当前文件路径和UI
      window.currentFilePath = result.filePath;
      updateFilePath(result.filePath);
      
      // 刷新文件列表
      await loadFileList();
      
      return true;
    } else if (result && result.error) {
      console.error(`[渲染进程:saveFile] 保存失败: ${result.error}`);
      alert(`保存文件失败: ${result.error}`);
    } else if (result && result.canceled) {
      console.log(`[渲染进程:saveFile] 用户取消了保存操作`);
    }
    
    return false;
  } catch (error) {
    console.error('[渲染进程:saveFile] 保存文件时发生错误:', error);
    alert(`保存文件失败: ${error.message}`);
    return false;
  }
};

// 保存当前文件(如果需要)然后关闭
// 这个函数用于在打开新文件前关闭当前文件
export const closeCurrentFile = async () => {
  try {
    // 如果有打开的文件，先保存
    if (window.currentFilePath && editor) {
      console.log(`[渲染进程:closeCurrentFile] 关闭前保存当前文件: ${window.currentFilePath}`);
      
      try {
        // 使用立即保存
        await autoSaveContent();
      } catch (saveError) {
        console.error('[渲染进程:closeCurrentFile] 自动保存当前文件失败:', saveError);
      }
      
      // 清空当前文件状态
      window.currentFilePath = null;
      window.hasOpenedFiles = false;
      
      // 清空编辑器内容
      try {
        editor.commands.clearContent();
        console.log('[渲染进程:closeCurrentFile] 已清空编辑器内容');
      } catch (clearError) {
        console.error('[渲染进程:closeCurrentFile] 清空编辑器内容失败:', clearError);
      }
      
      // 清空路径显示
      updateFilePath(null);
      
      console.log('[渲染进程:closeCurrentFile] 当前文件已关闭');
    } else {
      console.log('[渲染进程:closeCurrentFile] 没有打开的文件，无需关闭');
    }
  } catch (error) {
    console.error('[渲染进程:closeCurrentFile] 关闭当前文件时发生错误:', error);
  }
};

// 打开文件 - 首先关闭当前文件，然后请求主进程打开新文件
export const openFile = async (filePath) => {
  try {
    console.log(`[渲染进程:openFile] 开始打开文件: ${filePath}`);
    
    // 如果要打开的文件就是当前文件，不做任何操作
    if (filePath === window.currentFilePath) {
      console.log(`[渲染进程:openFile] 要打开的文件就是当前已打开的文件，不重复操作`);
      // 即使是同一个文件，也刷新文件列表以确保状态最新
      await loadFileList();
      return;
    }
    
    // 首先关闭当前文件并清空状态
    console.log(`[渲染进程:openFile] 先关闭当前文件在打开新文件`);
    await closeCurrentFile();
    
    console.log(`[渲染进程:openFile] 请求主进程打开文件: ${filePath}`);
    // 请求主进程打开文件
    const result = await window.electronAPI.openFile(filePath);
    
    if (result && result.success) {
      console.log(`[渲染进程:openFile] 主进程已成功处理文件打开请求`);
      // 主进程已处理并发送 file-opened 事件，我们在回调函数中处理
    } else {
      console.error(`[渲染进程:openFile] 主进程打开文件失败:`, result ? result.error : '未知错误');
    }
  } catch (error) {
    console.error('[渲染进程:openFile] 打开文件失败:', error);
    alert(`打开文件失败: ${error.message}`);
  }
};

// 重命名文件
export const renameFile = async (filePath, oldName) => {
  // 调用显示重命名对话框函数
  const { showRenameModal } = await import('./modals');
  showRenameModal(filePath, oldName);
};

// 删除文件
export const deleteFile = async (filePath) => {
  try {
    const result = await window.electronAPI.deleteFile(filePath);
    
    if (result.success) {
      // 判断是否是当前打开的文件
      const isCurrentFile = filePath === window.currentFilePath;
      
      // 如果不是当前打开的文件，才直接刷新列表
      // 当前打开的文件会通过 onOpenRecentAfterDelete 事件刷新列表
      if (!isCurrentFile) {
        // 文件已被删除，刷新列表
        await loadFileList();
        
        // 刷新完文件列表后，检查是否有文件
        const fileItems = document.querySelectorAll('.file-item');
        if (fileItems.length === 0) {
          // 如果没有文件，则显示"请先创建文件"的提示
          toggleNoFileMessage(true);
          updateFilePath(null); // 清空路径显示
        }
      }
    } else if (!result.canceled) {
      // 非用户取消的错误
      alert(`删除文件失败: ${result.error}`);
    }
  } catch (error) {
    console.error('删除文件失败:', error);
    alert(`删除文件失败: ${error.message}`);
  }
};
