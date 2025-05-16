/**
 * renderer/index.js
 * 主入口文件，导入和初始化所有模块
 */

// 先导入样式
import '../tailwind.css';
import '../index.css';

// 导入各模块
import * as editor from './editor';
import * as files from './files';
import * as ui from './ui';
import * as settings from './settings';
import * as ipc from './ipc';

// 全局导出
export let currentFilePath = null;
export let hasOpenedFiles = false;

// 初始化应用
const init = async () => {
  // 初始化编辑器
  editor.init();
  
  // 绑定UI事件
  ui.bindToolbarEvents();
  
  // 首先绑定IPC事件，确保能处理主进程发送的file-opened消息
  ipc.bindEvents();
  
  // 绑定设置界面的事件处理
  settings.bindEvents();
  
  // 加载已保存的设置
  await settings.loadSettings();
  
  // 给窗口一点时间加载并建立IPC通道
  setTimeout(async () => {
    // 初始化时检查全屏状态
    ui.updateMacSafeArea();
    
    // 只有当没有通过IPC事件加载文件时才主动加载文件列表
    if (!currentFilePath) {
      // 加载文件列表
      await files.loadFileList();
      
      // 检查目录中是否有文件
      const hasFiles = await files.checkDirectoryHasFiles();
      
      // 只有在目录中没有文件时才显示"请先创建文件"的提示
      ui.toggleNoFileMessage(!hasFiles);
      
      if (!hasFiles) {
        console.log('目录中没有文件，显示创建文件提示');
      }
    }
  }, 300);
  
  // 为创建新文件按钮绑定事件
  const btnCreateFile = document.getElementById('btn-create-file');
  if (btnCreateFile) {
    btnCreateFile.addEventListener('click', files.createNewFile);
  }
  
  // 监听全屏状态变化
  if (window.electronAPI && typeof window.electronAPI.onFullScreenChange === 'function') {
    window.electronAPI.onFullScreenChange((event, isFullscreen) => {
      const macSafeArea = document.getElementById('mac-safe-area');
      if (!macSafeArea) return;
      
      macSafeArea.style.display = isFullscreen ? 'none' : 'flex';
    });
  }
};

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', init);

console.log('已加载 Markly 应用');
