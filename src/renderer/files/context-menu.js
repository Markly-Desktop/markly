/**
 * files/context-menu.js
 * 文件上下文菜单功能
 */

import { renameFile, deleteFile, openFile } from './operations';

// 显示文件右键菜单
export const showFileContextMenu = (fileItem, file) => {
  // 移除之前可能存在的任何上下文菜单
  removeFileContextMenu();
  
  // 创建上下文菜单
  const contextMenu = document.createElement('div');
  contextMenu.className = 'context-menu absolute z-50 bg-white dark:bg-gray-800 shadow-lg rounded';
  contextMenu.id = 'file-context-menu';
  
  // 获取文件项的位置
  const rect = fileItem.getBoundingClientRect();
  
  // 设置上下文菜单位置
  contextMenu.style.top = `${rect.bottom + window.scrollY}px`;
  contextMenu.style.left = `${rect.left + window.scrollX}px`;
  
  // 设置上下文菜单内容
  contextMenu.innerHTML = `
    <div class="p-1">
      <button id="btn-open-file" class="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
        打开
      </button>
      <button id="btn-rename-file" class="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
        重命名
      </button>
      <button id="btn-delete-file" class="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-red-500">
        删除
      </button>
    </div>
  `;
  
  // 添加到文档中
  document.body.appendChild(contextMenu);
  
  // 添加事件监听器
  const btnOpenFile = document.getElementById('btn-open-file');
  const btnRenameFile = document.getElementById('btn-rename-file');
  const btnDeleteFile = document.getElementById('btn-delete-file');
  
  // 打开文件
  btnOpenFile.addEventListener('click', () => {
    removeFileContextMenu();
    openFile(file.path);
  });
  
  // 重命名文件
  btnRenameFile.addEventListener('click', () => {
    removeFileContextMenu();
    renameFile(file.path, file.name);
  });
  
  // 删除文件
  btnDeleteFile.addEventListener('click', () => {
    removeFileContextMenu();
    const confirmDelete = confirm(`确定要删除 "${file.name}" 吗？`);
    if (confirmDelete) {
      deleteFile(file.path);
    }
  });
  
  // 点击文档任何位置关闭上下文菜单
  document.addEventListener('click', removeFileContextMenu);
  
  // 阻止上下文菜单自身的点击事件冒泡
  contextMenu.addEventListener('click', (e) => {
    e.stopPropagation();
  });
};

// 移除文件上下文菜单
export const removeFileContextMenu = () => {
  const contextMenu = document.getElementById('file-context-menu');
  if (contextMenu) {
    document.body.removeChild(contextMenu);
    // 移除事件监听器
    document.removeEventListener('click', removeFileContextMenu);
  }
};
