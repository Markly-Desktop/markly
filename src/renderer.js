/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

// 先导入Tailwind基础样式
import './tailwind.css';
// 再导入自定义样式
import './index.css';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { marked } from 'marked';

// 全局变量
let editor;
let currentContent = '';
let currentFilePath = null;
let editorMode = 'edit'; // 'edit' 或 'preview'
let previewTimeout; // 用于防抖预览更新
let settings = { // 用户设置
  rootDirectory: ''
};

// 初始化 Tiptap 编辑器
const initEditor = () => {
  editor = new Editor({
    element: document.getElementById('editor'),
    extensions: [
      StarterKit,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank'
        }
      }),
      Image,
      Placeholder.configure({
        placeholder: '开始输入...'
      })
    ],
    content: '',
    onUpdate: ({ editor }) => {
      const content = editor.getHTML();
      currentContent = content;
      updateWordCount(content);
      debouncedUpdatePreview(content); // 改为防抖更新预览

      // 内容更改时触发自动保存
      if (window.electronAPI && typeof window.electronAPI.contentChanged === 'function') {
        const markdownContent = htmlToMarkdown(content);
        window.electronAPI.contentChanged(markdownContent);
      }
    }
  });

  // 添加默认样式，保留占位符和预览淡入淡出效果
  const style = document.createElement('style');
  style.textContent = `
    .ProseMirror {
      position: relative;
    }
    .ProseMirror:focus {
      outline: none;
    }
    .ProseMirror p.is-editor-empty:first-child::before {
      color: #adb5bd;
      content: attr(data-placeholder);
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
    }
    #preview-content {
      opacity: 1;
      transition: opacity 0.2s ease-in-out;
    }
  `;
  document.head.appendChild(style);

  console.log('Tiptap 编辑器已初始化');
};

// 防抖函数：延迟触发预览更新
const debouncedUpdatePreview = (content) => {
  clearTimeout(previewTimeout);
  previewTimeout = setTimeout(() => updatePreview(content), 200);
};

// 更新预览，使用 requestAnimationFrame 平滑切换
const updatePreview = (content) => {
  const previewContent = document.getElementById('preview-content');
  previewContent.style.opacity = '0';
  requestAnimationFrame(() => {
    const markdownContent = htmlToMarkdown(content);
    previewContent.innerHTML = marked.parse(markdownContent);
    previewContent.style.opacity = '1';
  });
};

// 简单的 HTML 转 Markdown 逻辑
const htmlToMarkdown = (html) => {
  // 实际应用中可以使用更完善的转换库
  // 这里只是做了一个简单的示例
  let markdown = html;
  
  // 替换标签
  markdown = markdown.replace(/<h1>(.*?)<\/h1>/g, '# $1\n\n');
  markdown = markdown.replace(/<h2>(.*?)<\/h2>/g, '## $1\n\n');
  markdown = markdown.replace(/<h3>(.*?)<\/h3>/g, '### $1\n\n');
  markdown = markdown.replace(/<strong>(.*?)<\/strong>/g, '**$1**');
  markdown = markdown.replace(/<em>(.*?)<\/em>/g, '*$1*');
  markdown = markdown.replace(/<a href="(.*?)".*?>(.*?)<\/a>/g, '[$2]($1)');
  markdown = markdown.replace(/<img.*?src="(.*?)".*?>/g, '![]($1)');
  markdown = markdown.replace(/<blockquote>(.*?)<\/blockquote>/g, '> $1\n\n');
  markdown = markdown.replace(/<pre><code>(.*?)<\/code><\/pre>/g, '```\n$1\n```\n\n');
  markdown = markdown.replace(/<code>(.*?)<\/code>/g, '`$1`');
  markdown = markdown.replace(/<ul>(.*?)<\/ul>/g, '$1\n');
  markdown = markdown.replace(/<ol>(.*?)<\/ol>/g, '$1\n');
  markdown = markdown.replace(/<li>(.*?)<\/li>/g, '- $1\n');
  markdown = markdown.replace(/<p>(.*?)<\/p>/g, '$1\n\n');

  // 移除剩余的 HTML 标签
  markdown = markdown.replace(/<.*?>/g, '');
  
  // 处理多余的空行
  markdown = markdown.replace(/\n{3,}/g, '\n\n');
  
  return markdown.trim();
};

// 更新字数统计
const updateWordCount = (content) => {
  const wordCountElement = document.getElementById('word-count');
  const text = content.replace(/<[^>]*>?/g, '');
  const words = text.trim().length;
  const lines = text.split(/\n/).length;
  
  wordCountElement.textContent = `${words} 字 | ${lines} 行`;
};

// 切换编辑/预览模式
const toggleMode = () => {
  const editorContainer = document.getElementById('editor-container');
  const previewContainer = document.getElementById('preview-container');
  
  if (editorMode === 'edit') {
    editorMode = 'preview';
    editorContainer.classList.add('hidden');
    previewContainer.classList.remove('hidden');
    updatePreview(currentContent);
  } else {
    editorMode = 'edit';
    previewContainer.classList.add('hidden');
    editorContainer.classList.remove('hidden');
  }
};

// 保存文件
const saveFile = async (filePath) => {
  try {
    const markdownContent = htmlToMarkdown(currentContent);
    
    if (filePath) {
      const result = await window.electronAPI.saveCurrentFile(markdownContent);
      if (result.success) {
        updateFilePath(result.filePath);
        return true;
      }
    } else {
      const result = await window.electronAPI.saveFileDialog(markdownContent, 'untitled.md');
      if (result.success) {
        updateFilePath(result.filePath);
        return true;
      }
    }
    return false;
  } catch (error) {
    console.error('保存文件失败:', error);
    return false;
  }
};

// 更新文件路径显示
const updateFilePath = (filePath) => {
  currentFilePath = filePath;
  const filePathElement = document.getElementById('file-path');
  if (filePath) {
    const pathParts = filePath.split(/[/\\]/);
    const fileName = pathParts[pathParts.length - 1];
    filePathElement.textContent = fileName;
  } else {
    filePathElement.textContent = '未保存';
  }
};

// 绑定工具栏按钮事件
const bindToolbarEvents = () => {
  // 格式化按钮
  document.getElementById('btn-bold').addEventListener('click', () => {
    editor.chain().focus().toggleBold().run();
  });
  
  document.getElementById('btn-italic').addEventListener('click', () => {
    editor.chain().focus().toggleItalic().run();
  });
  
  document.getElementById('btn-link').addEventListener('click', () => {
    const url = prompt('输入链接地址:');
    if (url) {
      editor.chain().focus().setLink({ href: url }).run();
    }
  });
  
  document.getElementById('btn-image').addEventListener('click', () => {
    const url = prompt('输入图片地址:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  });
  
  document.getElementById('btn-h1').addEventListener('click', () => {
    editor.chain().focus().toggleHeading({ level: 1 }).run();
  });
  
  document.getElementById('btn-h2').addEventListener('click', () => {
    editor.chain().focus().toggleHeading({ level: 2 }).run();
  });
  
  document.getElementById('btn-h3').addEventListener('click', () => {
    editor.chain().focus().toggleHeading({ level: 3 }).run();
  });
  
  document.getElementById('btn-ul').addEventListener('click', () => {
    editor.chain().focus().toggleBulletList().run();
  });
  
  document.getElementById('btn-ol').addEventListener('click', () => {
    editor.chain().focus().toggleOrderedList().run();
  });
  
  document.getElementById('btn-quote').addEventListener('click', () => {
    editor.chain().focus().toggleBlockquote().run();
  });
  
  document.getElementById('btn-code').addEventListener('click', () => {
    editor.chain().focus().toggleCodeBlock().run();
  });
  
  // 切换模式按钮
  document.getElementById('btn-toggle-mode').addEventListener('click', toggleMode);

  // 新建文件按钮
  document.getElementById('btn-new-file').addEventListener('click', async () => {
    // 调用创建新文件的方法
    await createNewFile();
  });
};

// 新建文件
const createNewFile = async () => {
  try {
    const result = await window.electronAPI.createNewFile('Untitled.md');
    if (result && result.success) {
      // 清空编辑器内容
      editor.commands.clearContent();
      currentContent = '';
      // 更新路径显示
      updateFilePath(result.filePath);
      // 刷新文件列表
      await loadFileList();
    } else if (result && result.error) {
      alert(`创建文件失败: ${result.error}`);
    }
  } catch (error) {
    console.error('创建新文件时出错:', error);
    alert(`创建文件失败: ${error.message}`);
  }
};

// 加载文件列表
const loadFileList = async () => {
  try {
    const fileItems = document.querySelector('.file-items');
    
    // 清空现有文件列表
    while (fileItems.firstChild) {
      fileItems.removeChild(fileItems.firstChild);
    }
    
    const result = await window.electronAPI.listFiles();
    if (result && result.success && result.files) {
      // 创建一个 Set 来跟踪已添加的文件路径，用于去重
      const addedFilePaths = new Set();
      
      // 遍历文件并创建列表项
      result.files.forEach(file => {
        // 如果文件路径已经添加过，则跳过
        if (addedFilePaths.has(file.path)) {
          return;
        }
        
        // 添加到已处理集合中
        addedFilePaths.add(file.path);
        
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item flex items-center p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer';
        
        // 如果是当前打开的文件，添加突出显示
        if (currentFilePath === file.path) {
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
          // 如果文件已经被修改，可以提示保存
          await openFile(file.path);
        });
        
        fileItems.appendChild(fileItem);
      });
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
        btnOpenSettings.addEventListener('click', openSettingsModal);
      }
    }
  } catch (error) {
    console.error('加载文件列表失败:', error);
  }
};

// 打开文件
const openFile = async (filePath) => {
  try {
    const result = await window.electronAPI.openFile(filePath);
    if (result && result.success) {
      // 将 Markdown 转为 HTML 设置到编辑器中
      const html = marked.parse(result.content);
      editor.commands.setContent(html);
      currentContent = html;
      updateFilePath(result.filePath);
      updateWordCount(html);
      
      // 刷新文件列表以突出显示当前文件
      await loadFileList();
    }
  } catch (error) {
    console.error('打开文件失败:', error);
    alert(`打开文件失败: ${error.message}`);
  }
};

// 绑定 IPC 事件
const bindIpcEvents = () => {
  // 新建文件
  window.electronAPI.onFileNew(async (event) => {
    await createNewFile();
  });
  
  // 文件被打开
  window.electronAPI.onFileOpened((event, { content, filePath }) => {
    // 将 Markdown 转为 HTML
    const html = marked.parse(content);
    editor.commands.setContent(html);
    currentContent = html;
    updateFilePath(filePath);
    updateWordCount(html);
    // 刷新文件列表以突出显示当前文件
    loadFileList();
  });
  
  // 保存文件
  window.electronAPI.onSaveFile((event, { filePath }) => {
    saveFile(filePath);
  });
  
  // 另存为
  window.electronAPI.onSaveFileAs(() => {
    saveFile(null);
  });
  
  // 切换模式
  window.electronAPI.onToggleMode(() => {
    toggleMode();
  });
};

// 检查全屏状态并控制 mac-safe-area 的显示
const updateMacSafeArea = async () => {
  const macSafeArea = document.getElementById('mac-safe-area');
  if (!macSafeArea) return;
  
  try {
    // 使用 Electron API 检查全屏状态
    if (window.electronAPI && typeof window.electronAPI.isFullScreen === 'function') {
      const isFullscreen = await window.electronAPI.isFullScreen();
      
      // 在全屏状态下隐藏安全区域，否则显示
      if (isFullscreen) {
        macSafeArea.style.display = 'none';
      } else {
        macSafeArea.style.display = 'flex';
      }
    } else {
      // 回退方案：如果API不可用，默认显示安全区域
      macSafeArea.style.display = 'flex';
      console.warn('Fullscreen API not available, defaulting to show safe area');
    }
  } catch (error) {
    console.error('检查全屏状态失败:', error);
    // 出错时默认显示安全区域
    macSafeArea.style.display = 'flex';
  }
};

// 初始化应用
const init = async () => {
  initEditor();
  bindToolbarEvents();
  
  // 首先绑定IPC事件，确保能处理主进程发送的file-opened消息
  bindIpcEvents();
  
  // 绑定设置界面的事件处理
  bindSettingsEvents(); 
  
  // 加载已保存的设置
  await loadSettings();
  
  // 给窗口一点时间加载并建立IPC通道
  setTimeout(() => {
    // 初始化时检查全屏状态
    updateMacSafeArea();
    
    // 只有当没有通过IPC事件加载文件时才主动加载文件列表
    // 延迟加载文件列表，避免和主进程发送的file-opened事件冲突
    // 因为如果主进程会发送file-opened事件，该事件的处理程序中会调用loadFileList
    if (!currentFilePath) {
      loadFileList();
    }
  }, 300);
  
  // 监听全屏状态变化
  if (window.electronAPI && typeof window.electronAPI.onFullScreenChange === 'function') {
    window.electronAPI.onFullScreenChange((event, isFullscreen) => {
      const macSafeArea = document.getElementById('mac-safe-area');
      if (!macSafeArea) return;
      
      macSafeArea.style.display = isFullscreen ? 'none' : 'flex';
    });
  }
};

// 加载设置
const loadSettings = async () => {
  try {
    if (window.electronAPI && typeof window.electronAPI.getSettings === 'function') {
      settings = await window.electronAPI.getSettings();
      
      // 更新界面显示
      const rootDirectoryPathInput = document.getElementById('root-directory-path');
      if (rootDirectoryPathInput && settings.rootDirectory) {
        rootDirectoryPathInput.value = settings.rootDirectory;
      }
    }
  } catch (error) {
    console.error('加载设置失败:', error);
  }
};

// 保存设置
const saveSettings = async () => {
  try {
    if (window.electronAPI && typeof window.electronAPI.updateSettings === 'function') {
      await window.electronAPI.updateSettings(settings);
      console.log('设置已保存');
      // 保存设置后刷新文件列表
      await loadFileList();
    }
  } catch (error) {
    console.error('保存设置失败:', error);
  }
};

// 打开设置弹窗
const openSettingsModal = () => {
  const modal = document.getElementById('settings-modal');
  if (modal) {
    modal.classList.remove('hidden');
  }
};

// 关闭设置弹窗
const closeSettingsModal = () => {
  const modal = document.getElementById('settings-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
};

// 绑定设置界面事件
const bindSettingsEvents = () => {
  // 打开设置
  const btnSettings = document.getElementById('btn-settings');
  if (btnSettings) {
    btnSettings.addEventListener('click', openSettingsModal);
  }
  
  // 关闭设置
  const btnCloseSettings = document.getElementById('btn-close-settings');
  if (btnCloseSettings) {
    btnCloseSettings.addEventListener('click', closeSettingsModal);
  }
  
  // 选择根目录
  const btnSelectDirectory = document.getElementById('btn-select-directory');
  if (btnSelectDirectory) {
    btnSelectDirectory.addEventListener('click', async () => {
      try {
        const result = await window.electronAPI.selectDirectory();
        if (result && result.success) {
          const rootDirectoryPathInput = document.getElementById('root-directory-path');
          if (rootDirectoryPathInput) {
            rootDirectoryPathInput.value = result.path;
            settings.rootDirectory = result.path;
          }
        }
      } catch (error) {
        console.error('选择目录失败:', error);
      }
    });
  }
  
  // 保存设置
  const btnSaveSettings = document.getElementById('btn-save-settings');
  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', async () => {
      await saveSettings();
      closeSettingsModal();
    });
  }
};

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', init);

console.log('👋 This message is being logged by "renderer.js", included via webpack');
