/**
 * files/list.js
 * 文件列表管理
 */

import { openFile } from './operations';
import { showFileContextMenu } from './context-menu';

// 防止并发调用的锁
let isLoadingFileList = false;
// 上次文件列表数据，用于优化渲染
let lastFileListData = null;

// 检查目录是否有文件
// 返回值： true 表示目录中有文件，false 表示目录中没有文件
export const checkDirectoryHasFiles = async () => {
  try {
    const result = await window.electronAPI.listFiles();
    if (result && result.success && result.files) {
      return result.files.length > 0;
    }
    return false;
  } catch (error) {
    console.error('检查目录是否有文件失败:', error);
    return false;
  }
};

// 加载文件列表
export const loadFileList = async () => {
  // 如果已经在加载列表，等待当前操作完成
  if (isLoadingFileList) {
    console.log('文件列表正在加载中，跳过当前请求');
    return;
  }
  
  try {
    isLoadingFileList = true;
    console.log('开始加载文件列表');
    
    // 先获取文件列表数据，再更新UI，减少闪烁
    const result = await window.electronAPI.listFiles();
    
    // 获取文件列表容器
    const fileItems = document.querySelector('.file-items');
    
    if (result && result.success && result.files) {
      // 创建一个 Set 来跟踪已添加的文件路径，用于去重
      const addedFilePaths = new Set();
      const filesList = [];
      
      // 先处理文件数据，构建DOM元素，但不立即添加到文档中
      result.files.forEach(file => {
        // 如果文件路径已经添加过，则跳过
        if (addedFilePaths.has(file.path)) {
          console.log(`跳过重复文件: ${file.path}`);
          return;
        }
        
        // 添加到已处理集合中
        addedFilePaths.add(file.path);
        
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item flex items-center p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer';
        fileItem.dataset.path = file.path; // 将文件路径存储在dataset中
        fileItem.dataset.name = file.name; // 将文件名存储在dataset中
        
        // 如果是当前打开的文件，添加突出显示
        if (window.currentFilePath === file.path) {
          fileItem.classList.add('bg-gray-200', 'dark:bg-gray-700');
        }
        
        fileItem.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-file-text mr-2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <span class="text-sm truncate" title="${file.name}">${file.name}</span>
        `;
        
        // 添加点击事件处理器
        fileItem.addEventListener('click', async () => {
          console.log(`[渲染进程] 点击文件: ${file.path}`);
          
          // 如果当前有打开的文件且路径不同，先保存当前文件
          if (window.currentFilePath && window.currentFilePath !== file.path) {
            console.log(`[渲染进程] 切换文件前保存当前文件: ${window.currentFilePath}`);
            try {
              // 使用我们的自动保存功能，直接保存而不等待
              const { debouncedAutoSave } = await import('../editor/autosave');
              debouncedAutoSave(true); // 立即保存，不使用延时
              console.log(`[渲染进程] 已触发自动保存以保存当前文件`);
            } catch (error) {
              console.error('[渲染进程] 切换文件前保存时发生错误:', error);
            }
          }
          
          // 打开新文件
          console.log(`[渲染进程] 准备打开文件: ${file.path}`);
          await openFile(file.path);
          
          // 在打开文件后刷新文件列表以确保状态最新
          await loadFileList();
        });
        
        // 添加右键菜单事件
        fileItem.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          showFileContextMenu(fileItem, file);
        });
        
        filesList.push(fileItem);
      });
      
      // 缓存当前数据，减少不必要的DOM操作
      lastFileListData = result.files;
      
      // 现在已经构建了所有DOM元素，开始一次性更新UI
      // 使用文档片段暂存所有元素，这样只需一次DOM操作
      const fragment = document.createDocumentFragment();
      filesList.forEach(item => fragment.appendChild(item));
      
      // 确保清空容器后立即添加新内容，减少闪烁
      fileItems.innerHTML = '';
      fileItems.appendChild(fragment);
      
    } else if (result && result.error) {
      // 显示设置根目录的提示
      fileItems.innerHTML = `
        <div class="p-4 text-center text-gray-500">
          <p>${result.error}</p>
          <button id="btn-open-settings" class="mt-2 px-2 py-1 bg-blue-500 text-white rounded text-sm">
            设置根目录
          </button>
        </div>
      `;
      
      const btnOpenSettings = document.getElementById('btn-open-settings');
      if (btnOpenSettings) {
        btnOpenSettings.addEventListener('click', () => {
          const { openSettingsModal } = require('../settings');
          openSettingsModal();
        });
      }
    }
  } catch (error) {
    console.error('加载文件列表失败:', error);
  } finally {
    // 无论成功还是失败，都释放锁
    isLoadingFileList = false;
    console.log('文件列表加载锁已释放');
  }
};

// 更新文件高亮状态
export const updateFileHighlight = (highlightPath) => {
  if (!highlightPath) return;
  
  // 首先移除所有文件项的高亮状态
  const allFileItems = document.querySelectorAll('.file-item');
  allFileItems.forEach(item => {
    item.classList.remove('bg-gray-200', 'dark:bg-gray-700');
  });
  
  // 查找要高亮的文件项
  const targetFile = Array.from(allFileItems).find(
    item => item.dataset.path === highlightPath
  );
  
  // 如果找到了，添加高亮类
  if (targetFile) {
    targetFile.classList.add('bg-gray-200', 'dark:bg-gray-700');
    
    // 可选：滚动到高亮的文件项
    targetFile.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
};
