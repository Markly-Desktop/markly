/**
 * ipc/index.js
 * IPC通信模块入口
 */

import { editor } from '../editor';
import { loadFileList, updateFileHighlight } from '../files/list';
import { toggleNoFileMessage, updateFilePath } from '../ui/common';

// 绑定 IPC 事件
export const bindEvents = () => {
  // 监听新建文件事件
  window.electronAPI.onFileNew(() => {
    const { createNewFile } = require('../files/operations');
    createNewFile();
  });
  
  // 监听"无文件"提示事件 - 实现简单直接
  window.electronAPI.onShowNoFilesMessage(() => {
    console.log('[渲染进程:onShowNoFilesMessage] 收到 show-no-files-message 事件');
    // 显示"请先创建文件"的提示
    toggleNoFileMessage(true);
    // 清空路径显示
    updateFilePath(null);
    // 清空编辑器内容
    if (editor) {
      console.log('[渲染进程:onShowNoFilesMessage] 清空编辑器内容');
      editor.commands.clearContent();
    }
    console.log('[渲染进程:onShowNoFilesMessage] 已显示"请先创建文件"提示');
  });
  
  // 这个事件处理器已不再使用，但保留以避免错误
  window.electronAPI.onOpenRecentAfterDelete(async (_, { content, filePath }) => {
    console.log('[渲染进程] 收到 onOpenRecentAfterDelete 事件，但该事件已过期');
  });
  
  // 文件被打开 - 完全重写的文件打开处理程序
  window.electronAPI.onFileOpened((event, { content, filePath }) => {
    console.log(`[渲染进程:onFileOpened] ============== 开始处理文件打开 ==============`);
    console.log(`[渲染进程:onFileOpened] 收到 file-opened 事件, 文件路径: ${filePath}`);
    console.log(`[渲染进程:onFileOpened] 文件内容长度: ${content ? content.length : 0}`);
    console.log(`[渲染进程:onFileOpened] 文件内容的前50个字符: "${content ? content.substring(0, 50) : ''}"`);
    
    // 防止重复处理同一文件
    if (filePath === window.currentFilePath) {
      // 获取当前编辑器内容
      const editorContent = editor ? editor.storage.markdown.getMarkdown() : '';
      // 仅当路径相同，并且内容相同时跳过
      if (editorContent === content) {
        console.log(`[渲染进程:onFileOpened] 已经打开了相同的文件，已跳过处理`);
        return;
      }
    }
    
    try {
      // 清除所有当前编辑器状态
      console.log(`[渲染进程:onFileOpened] STEP 1: 清除所有当前编辑器状态`); 
      if (editor) {
        editor.commands.clearContent();
      }
      
      // 清除所有状态变量
      console.log(`[渲染进程:onFileOpened] STEP 2: 清除所有状态变量`); 
      const oldPath = window.currentFilePath;
      window.currentFilePath = null;
      updateFilePath(null); // 先清空路径显示
      
      // 确保编辑器存在
      console.log(`[渲染进程:onFileOpened] STEP 3: 确保编辑器存在`); 
      if (!editor) {
        console.log(`[渲染进程:onFileOpened] 编辑器不存在，初始化它`);
        const { init } = require('../editor');
        init(); // 如果编辑器不存在，初始化它
      }
      
      // 检查内容是否为空
      console.log(`[渲染进程:onFileOpened] STEP 4: 检查内容是否为空`); 
      let fileContent = content;
      if (!fileContent) {
        console.log(`[渲染进程:onFileOpened] 文件内容为空，使用空字符串`);
        fileContent = ''; // 确保内容不是null或undefined
      }
      
      // 首先确保编辑器容器可见
      console.log(`[渲染进程:onFileOpened] STEP 5: 设置编辑器可见`); 
      const editorContainer = document.getElementById('editor-container');
      const noFileMessage = document.getElementById('no-file-placeholder');
      
      if (editorContainer && noFileMessage) {
        console.log(`[渲染进程:onFileOpened] 清除编辑器可见性状态`);
        editorContainer.classList.remove('hidden');
        noFileMessage.classList.add('hidden');
      }
      
      // 延时设置新文件内容，确保所有清除操作已完成
      console.log(`[渲染进程:onFileOpened] STEP 6: 延时设置新文件内容`); 
      setTimeout(() => {
        try {
          // 再次清空内容以确保安全
          console.log(`[渲染进程:onFileOpened] 再次清除编辑器内容以确保安全`);
          editor.commands.clearContent();
          
          // 设置文件路径
          console.log(`[渲染进程:onFileOpened] 设置新文件路径: ${filePath}`);
          window.currentFilePath = filePath;
          updateFilePath(filePath);
          
          // 设置新文件内容
          console.log(`[渲染进程:onFileOpened] 设置新文件内容，长度: ${fileContent.length}`);
          // 使用编辑器的 markdown 处理能力直接设置 markdown 内容
          editor.commands.setContent(fileContent, false, { parseOptions: { preserveWhitespace: 'full' } });
          
          // 设置打开文件标记
          console.log(`[渲染进程:onFileOpened] 更新文件打开状态`);
          window.hasOpenedFiles = true;
          
          // 更新字数
          console.log(`[渲染进程:onFileOpened] 更新字数统计`);
          const { updateWordCount } = require('../editor/commands');
          updateWordCount(fileContent);
          
          // 隐藏"请先创建文件"的提示
          console.log(`[渲染进程:onFileOpened] 隐藏"请先创建文件"提示`);
          toggleNoFileMessage(false);
          
          // 强制让编辑器获得焦点
          console.log(`[渲染进程:onFileOpened] 让编辑器获取焦点`);
          try {
            editor.commands.focus();
            console.log(`[渲染进程:onFileOpened] 设置编辑器焦点成功`);
          } catch (focusError) {
            console.error(`[渲染进程:onFileOpened] 设置编辑器焦点失败:`, focusError);
          }

          // 更新文件高亮
          console.log(`[渲染进程:onFileOpened] 更新文件高亮状态`);
          updateFileHighlight(filePath);
          
          console.log(`[渲染进程:onFileOpened] 文件打开成功: ${filePath}`);
          console.log(`[渲染进程:onFileOpened] 文件内容是否已正确设置: ${editor.getHTML().length > 0 ? '是' : '否'}`); 
        } catch (editorError) {
          console.error(`[渲染进程:onFileOpened] 设置编辑器内容失败:`, editorError);
        }
      }, 100); // 增加延时确保安全
      
      // 刷新文件列表
      console.log(`[渲染进程:onFileOpened] STEP 7: 刷新文件列表`); 
      setTimeout(async () => {
        await loadFileList();
        console.log(`[渲染进程:onFileOpened] 刷新文件列表完成`);
      }, 200); // 等待编辑器设置完成后再刷新文件列表
      
      console.log(`[渲染进程:onFileOpened] ============== 文件打开事件处理完成 ==============`);
    } catch (error) {
      console.error(`[渲染进程:onFileOpened] 处理file-opened事件失败:`, error);
    }
  });
  
  // 保存文件
  window.electronAPI.onSaveFile((event, { filePath }) => {
    const { saveFile } = require('../files/operations');
    saveFile(filePath);
  });
  
  // 另存为
  window.electronAPI.onSaveFileAs(() => {
    const { saveFile } = require('../files/operations');
    saveFile(null);
  });
  
  // 切换模式
  window.electronAPI.onToggleMode(() => {
    const { toggleMode } = require('../editor');
    toggleMode();
  });
};
