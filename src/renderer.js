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
  
  // 特殊处理图片标签，始终使用data-md-src属性作为Markdown中的图片源
  markdown = markdown.replace(/<img([^>]*?)>/g, function(match) {
    // 从img标签中提取data-md-src属性（如果有）
    const mdSrcMatch = match.match(/data-md-src="([^"]*?)"/);
    if (mdSrcMatch) {
      // 如果找到data-md-src属性，使用它作为Markdown图片路径
      return `![](${mdSrcMatch[1]})`;
    }
    
    // 如果没有data-md-src，回退到src属性
    const srcMatch = match.match(/src="([^"]*?)"/);
    if (srcMatch) {
      return `![](${srcMatch[1]})`;
    }
    
    // 如果既没有data-md-src也没有src，返回空图片标记
    return '![]()';
  });
  
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
  
  document.getElementById('btn-image').addEventListener('click', async () => {
    try {
      // 调用新增的图片选择功能
      const result = await window.electronAPI.selectImage();
      if (result && result.success) {
        // 使用 fileUrl 来显示图片（用于编辑器中的显示），但保存 imagePath 相对路径（用于Markdown）
        if (result.fileUrl) {
          // 使用 fileUrl 来避免 404 错误
          editor.chain().focus().setImage({ src: result.fileUrl, 'data-md-src': result.imagePath }).run();
        } else {
          // 回退到使用相对路径
          editor.chain().focus().setImage({ src: result.imagePath }).run();
        }
      } else if (result && result.error) {
        // 如果有错误（例如还没有保存文档），显示提示
        alert(result.error);
      }
    } catch (error) {
      console.error('图片上传失败:', error);
      // 失败时回退到原来的URL输入方式
      const url = prompt('输入图片地址:');
      if (url) {
        editor.chain().focus().setImage({ src: url }).run();
      }
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
        fileItem.dataset.path = file.path; // 将文件路径存储在dataset中
        fileItem.dataset.name = file.name; // 将文件名存储在dataset中
        
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
        
        // 添加右键菜单事件
        fileItem.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          showFileContextMenu(fileItem, file);
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

// 显示文件右键菜单
const showFileContextMenu = (fileItem, file) => {
  // 移除任何已存在的菜单
  removeFileContextMenu();
  
  // 创建上下文菜单
  const contextMenu = document.createElement('div');
  contextMenu.id = 'file-context-menu';
  contextMenu.className = 'absolute z-50 bg-white dark:bg-gray-800 shadow-md rounded border border-gray-200 dark:border-gray-700 py-1';
  
  // 计算菜单位置
  const rect = fileItem.getBoundingClientRect();
  contextMenu.style.left = `${rect.left}px`;
  contextMenu.style.top = `${rect.bottom}px`;
  contextMenu.style.minWidth = '120px';
  
  // 添加重命名选项
  const renameItem = document.createElement('div');
  renameItem.className = 'px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center';
  renameItem.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-edit-2 mr-2">
      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
    </svg>
    <span>重命名</span>
  `;
  renameItem.addEventListener('click', () => {
    renameFile(file.path, file.name);
    removeFileContextMenu();
  });
  contextMenu.appendChild(renameItem);
  
  // 添加删除选项
  const deleteItem = document.createElement('div');
  deleteItem.className = 'px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-red-500 flex items-center';
  deleteItem.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-trash-2 mr-2">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      <line x1="10" y1="11" x2="10" y2="17"></line>
      <line x1="14" y1="11" x2="14" y2="17"></line>
    </svg>
    <span>删除</span>
  `;
  deleteItem.addEventListener('click', () => {
    deleteFile(file.path);
    removeFileContextMenu();
  });
  contextMenu.appendChild(deleteItem);
  
  // 添加到文档中
  document.body.appendChild(contextMenu);
  
  // 点击外部区域关闭菜单
  document.addEventListener('click', removeFileContextMenu);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') removeFileContextMenu();
  });
};

// 移除文件上下文菜单
const removeFileContextMenu = () => {
  const menu = document.getElementById('file-context-menu');
  if (menu) {
    menu.remove();
    document.removeEventListener('click', removeFileContextMenu);
  }
};

// 显示重命名对话框
const showRenameModal = (oldFilePath, oldName) => {
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
            if (currentFilePath === oldFilePath) {
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
const closeRenameModal = () => {
  const modal = document.getElementById('rename-modal');
  if (modal) {
    modal.classList.add('hidden');
    
    // 清除输入框事件监听
    if (modal.dataset.keyHandler) {
      const input = document.getElementById('new-filename');
      input.removeEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === 'Escape') e.preventDefault();
      });
      delete modal.dataset.keyHandler;
    }
  }
};

// 重命名文件
const renameFile = async (filePath, oldName) => {
  showRenameModal(filePath, oldName);
};

// 删除文件
const deleteFile = async (filePath) => {
  try {
    const result = await window.electronAPI.deleteFile(filePath);
    
    if (result.success) {
      // 文件已被删除，刷新列表
      await loadFileList();
    } else if (!result.canceled) {
      // 非用户取消的错误
      alert(`删除文件失败: ${result.error}`);
    }
  } catch (error) {
    console.error('删除文件失败:', error);
    alert(`删除文件失败: ${error.message}`);
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
      
      // 不再刷新整个文件列表，只更新高亮状态
      updateFileHighlight(filePath);
    }
  } catch (error) {
    console.error('打开文件失败:', error);
    alert(`打开文件失败: ${error.message}`);
  }
};

// 更新文件高亮状态
const updateFileHighlight = (highlightPath) => {
  // 更新当前文件路径
  currentFilePath = highlightPath;
  
  // 查找所有文件项
  const fileItems = document.querySelectorAll('.file-item');
  
  // 移除所有高亮
  fileItems.forEach(item => {
    item.classList.remove('bg-gray-200', 'dark:bg-gray-700');
  });
  
  // 添加高亮到当前文件
  fileItems.forEach(item => {
    if (item.dataset.path === highlightPath) {
      item.classList.add('bg-gray-200', 'dark:bg-gray-700');
    }
  });
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
