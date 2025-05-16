/**
 * files/modals.js
 * 文件操作相关对话框
 */

import { loadFileList } from './list';
import { updateFilePath } from '../ui';

// 显示重命名对话框
export const showRenameModal = (oldFilePath, oldName) => {
  // 获取不带扩展名的文件名
  const nameWithoutExt = oldName.replace(/\.[^/.]+$/, '');
  
  // 获取对话框元素
  const modal = document.getElementById('rename-modal');
  const input = document.getElementById('new-filename');
  
  // 设置初始值
  input.value = nameWithoutExt;
  
  // 显示对话框
  if (modal) {
    modal.classList.remove('hidden');
    
    // 自动聚焦到输入框并全选内容
    setTimeout(() => {
      input.focus();
      input.select();
    }, 100);
    
    // 绑定确认事件
    const btnConfirm = document.getElementById('btn-confirm-rename');
    const confirmHandler = async () => {
      const newName = input.value.trim();
      if (newName && newName !== nameWithoutExt) {
        try {
          closeRenameModal();
          const result = await window.electronAPI.renameFile(oldFilePath, newName);
          
          if (result.success) {
            // 如果是当前打开的文件，更新文件路径显示
            if (window.currentFilePath === oldFilePath) {
              window.currentFilePath = result.newPath;
              updateFilePath(result.newPath);
            }
            
            // 刷新文件列表
            await loadFileList();
          } else {
            alert(`重命名文件失败: ${result.error}`);
          }
        } catch (error) {
          console.error('重命名文件失败:', error);
          alert(`重命名文件失败: ${error.message}`);
        }
      } else {
        closeRenameModal();
      }
      
      // 清除事件监听器
      btnConfirm.removeEventListener('click', confirmHandler);
    };
    
    btnConfirm.addEventListener('click', confirmHandler);
    
    // 绑定取消事件
    const btnCancel = document.getElementById('btn-cancel-rename');
    const btnClose = document.getElementById('btn-close-rename');
    
    const cancelHandler = () => {
      closeRenameModal();
      btnCancel.removeEventListener('click', cancelHandler);
      btnClose.removeEventListener('click', cancelHandler);
    };
    
    btnCancel.addEventListener('click', cancelHandler);
    btnClose.addEventListener('click', cancelHandler);
    
    // 按下回车键确认
    const keyHandler = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        btnConfirm.click();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeRenameModal();
      }
    };
    
    input.addEventListener('keydown', keyHandler);
    
    // 记录事件处理器以便后续移除
    modal.dataset.keyHandler = true;
  }
};

// 关闭重命名对话框
export const closeRenameModal = () => {
  const modal = document.getElementById('rename-modal');
  const input = document.getElementById('new-filename');
  
  if (modal) {
    // 隐藏模态框
    modal.classList.add('hidden');
    
    // 移除可能的事件监听器
    if (modal.dataset.keyHandler) {
      input.removeEventListener('keydown', handleKeyDown);
      delete modal.dataset.keyHandler;
    }
  }
};
