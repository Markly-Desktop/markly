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
import { Markdown } from 'tiptap-markdown';

// 全局变量
let editor;
let currentFilePath = null;
let isPreviewMode = false; // 默认为编辑模式
let hasOpenedFiles = false; // 跟踪是否有文件打开
let previewTimeout; // 用于防抖预览更新
let autoSaveTimeout; // 用于自动保存的延时器
let settings = { // 用户设置
  rootDirectory: ''
};

// 切换“请先创建文件”提示和编辑器的显示状态
const toggleNoFileMessage = (show) => {
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
      console.log(`[渲染进程:toggleNoFileMessage] 显示“请先创建文件”提示，隐藏编辑器`);
      noFileMessage.classList.remove('hidden');
      editorContainer.classList.add('hidden');
      hasOpenedFiles = false;
      
      // 强制重置一些 UI 状态
      updateFilePath(null);
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
      console.log(`[渲染进程:toggleNoFileMessage] 隐藏“请先创建文件”提示，显示编辑器`);
      
      // 先确保编辑器可见，再隐藏提示，这样避免空白屏闪现
      editorContainer.classList.remove('hidden');
      noFileMessage.classList.add('hidden');
      hasOpenedFiles = true;
      
      // 触发编辑器重新渲染
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
    
    console.log(`[渲染进程:toggleNoFileMessage] 完成状态切换，现在 hasOpenedFiles=${hasOpenedFiles}`);
  } catch (error) {
    console.error(`[渲染进程:toggleNoFileMessage] 切换显示状态时发生错误:`, error);
  }
};

// 实现自动保存功能
const autoSaveContent = async () => {
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
    // 使用 saveCurrentFile 方法，因为我们已知道当前文件路径
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
const debouncedAutoSave = (immediate = false) => {
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
      }),
      // 添加 Markdown 扩展
      Markdown.configure({
        breaks: true,
        tightLists: true
      })
    ],
    content: '',
    onUpdate: ({ editor }) => {
      // 直接获取 markdown 内容
      const markdownContent = editor.storage.markdown.getMarkdown();
      
      // 使用 Markdown 内容更新预览和字数统计
      updateWordCount(markdownContent);
      debouncedUpdatePreview(markdownContent);

      // 每次内容变化时触发自动保存
      if (currentFilePath) {
        console.log(`[渲染进程:onUpdate] 内容变化，触发自动保存防抖函数`);
        debouncedAutoSave();
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
const debouncedUpdatePreview = (markdownContent) => {
  clearTimeout(previewTimeout);
  previewTimeout = setTimeout(() => updatePreview(markdownContent), 200);
};

// 更新预览，使用 requestAnimationFrame 平滑切换
const updatePreview = (markdownContent) => {
  const previewContent = document.getElementById('preview-content');
  previewContent.style.opacity = '0';
  requestAnimationFrame(() => {
    // 直接使用 markdown 内容来渲染
    previewContent.innerHTML = markdownContent;
    previewContent.style.opacity = '1';
  });
};

// 更新字数统计
const updateWordCount = (markdownContent) => {
  const wordCountElement = document.getElementById('word-count');
  // 直接使用 markdown 文本计算字数和行数
  const words = markdownContent.trim().length;
  const lines = markdownContent.split(/\n/).length;
  
  wordCountElement.textContent = `${words} 字 | ${lines} 行`;
};

// 切换编辑/预览模式
const toggleMode = () => {
  const editorContainer = document.getElementById('editor-container');
  const previewContainer = document.getElementById('preview-container');
  
  // 获取当前编辑器内容
  const markdownContent = editor ? editor.storage.markdown.getMarkdown() : '';
  
  if (editorMode === 'edit') {
    editorMode = 'preview';
    editorContainer.classList.add('hidden');
    previewContainer.classList.remove('hidden');
    updatePreview(markdownContent);
  } else {
    editorMode = 'edit';
    previewContainer.classList.add('hidden');
    editorContainer.classList.remove('hidden');
  }
};

// 保存文件
const saveFile = async (filePath) => {
  try {
    console.log(`[渲染进程:saveFile] 开始保存文件到: ${filePath || '使用对话框选择路径'}`);
    
    // 获取当前编辑器的 markdown 内容
    if (!editor) {
      console.error(`[渲染进程:saveFile] 编辑器实例不存在，无法获取内容`);
      return false;
    }
    
    const content = editor.storage.markdown.getMarkdown();
    console.log(`[渲染进程:saveFile] 获取编辑器内容，长度: ${content.length}`);
    
    // 调用主进程保存文件 - 使用正确的API
    let result;
    
    if (filePath) {
      // 如果已有路径，使用saveCurrentFile并先设置currentFilePath
      currentFilePath = filePath;
      result = await window.electronAPI.saveCurrentFile(content);
    } else {
      // 如果没有路径，显示保存对话框
      result = await window.electronAPI.saveFileDialog(content);
    }
    
    if (result.success) {
      console.log(`[渲染进程:saveFile] 文件已保存成功: ${result.filePath}`);
      updateFilePath(result.filePath);
      return true;
    } else {
      console.error(`[渲染进程:saveFile] 保存文件失败:`, result.error);
      return false;
    }
  } catch (error) {
    console.error('保存文件时发生错误:', error);
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
      
      // 更新路径显示
      updateFilePath(result.filePath);
      
      // 创建文件后隐藏“请先创建文件”的提示，显示编辑器
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

// 加载文件列表
// 防止并发调用的锁
let isLoadingFileList = false;
// 上次文件列表数据，用于优化渲染
let lastFileListData = null;

// 检查目录是否有文件
// 返回值： true 表示目录中有文件，false 表示目录中没有文件
const checkDirectoryHasFiles = async () => {
  try {
    const result = await window.electronAPI.listFiles();
    // 目录是否有 Markdown 文件
    const hasFiles = result && result.success && result.files && result.files.length > 0;
    console.log(`目录${hasFiles ? '有' : '没有'}文件`);
    return hasFiles;
  } catch (error) {
    console.error('检查目录是否有文件失败:', error);
    return false;
  }
};

const loadFileList = async () => {
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
          console.log(`[渲染进程] 点击文件: ${file.path}`);
          
          // 如果当前有打开的文件且路径不同，先保存当前文件
          if (currentFilePath && currentFilePath !== file.path) {
            console.log(`[渲染进程] 切换文件前保存当前文件: ${currentFilePath}`);
            try {
              // 使用我们的自动保存功能，直接保存而不等待
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
        btnOpenSettings.addEventListener('click', openSettingsModal);
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
      // 判断是否是当前打开的文件
      const isCurrentFile = filePath === currentFilePath;
      
      // 如果不是当前打开的文件，才直接刷新列表
      // 当前打开的文件会通过 onOpenRecentAfterDelete 事件刷新列表
      if (!isCurrentFile) {
        // 文件已被删除，刷新列表
        await loadFileList();
        
        // 刷新完文件列表后，检查是否有文件
        const fileItems = document.querySelectorAll('.file-item');
        if (fileItems.length === 0) {
          // 如果没有文件，则显示“请先创建文件”的提示
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

// 保存当前文件(如果需要)然后关闭
// 这个函数用于在打开新文件前关闭当前文件
const closeCurrentFile = async () => {
  console.log(`[渲染进程:closeCurrentFile] 开始关闭当前文件: ${currentFilePath}`);
  
  // 如果当前没有打开文件，直接返回
  if (!currentFilePath) {
    console.log(`[渲染进程:closeCurrentFile] 没有打开文件，无需关闭`);
    return true;
  }
  
  // 如果当前有文件打开，先保存最新内容
  if (editor) {
    try {
      // 自动保存当前文件
      console.log(`[渲染进程:closeCurrentFile] 尝试保存当前文件: ${currentFilePath}`);
      debouncedAutoSave(true); // 立即触发保存，不使用延时
    } catch (err) {
      console.error(`[渲染进程:closeCurrentFile] 关闭文件前保存失败:`, err);
    }
    
    // 重置编辑器
    console.log(`[渲染进程:closeCurrentFile] 清空编辑器内容`);
    try {
      editor.commands.clearContent();
      // 注意：clearHistory 方法不存在，已删除调用
    } catch (error) {
      console.error(`[渲染进程:closeCurrentFile] 清空编辑器失败:`, error);
    }
  }
  
  // 重置状态变量
  console.log(`[渲染进程:closeCurrentFile] 重置状态变量`);
  const oldPath = currentFilePath;
  currentFilePath = null;
  updateFilePath(null); // 清空路径显示
  
  console.log(`[渲染进程:closeCurrentFile] 成功关闭文件: ${oldPath}`);
  return true;
};

// 打开文件 - 首先关闭当前文件，然后请求主进程打开新文件
const openFile = async (filePath) => {
  try {
    console.log(`[渲染进程:openFile] 开始打开文件: ${filePath}`);
    
    // 如果要打开的文件就是当前文件，不做任何操作
    if (filePath === currentFilePath) {
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
  // 监听新建文件事件
  window.electronAPI.onFileNew(() => {
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
      // clearHistory 方法不存在，移除调用
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
    if (filePath === currentFilePath) {
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
      const oldPath = currentFilePath;
      currentFilePath = null;
      updateFilePath(null); // 先清空路径显示
      
      // 确保编辑器存在
      console.log(`[渲染进程:onFileOpened] STEP 3: 确保编辑器存在`); 
      if (!editor) {
        console.log(`[渲染进程:onFileOpened] 编辑器不存在，初始化它`);
        initializeEditor(); // 如果编辑器不存在，初始化它
      }
      
      // 检查内容是否为空
      console.log(`[渲染进程:onFileOpened] STEP 4: 检查内容是否为空`); 
      if (!content) {
        console.log(`[渲染进程:onFileOpened] 文件内容为空，使用空字符串`);
        content = ''; // 确保内容不是null或undefined
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
          currentFilePath = filePath;
          updateFilePath(filePath);
          
          // 设置新文件内容
          console.log(`[渲染进程:onFileOpened] 设置新文件内容，长度: ${content.length}`);
          // 使用编辑器的 markdown 处理能力直接设置 markdown 内容
          editor.commands.setContent(content, false, { parseOptions: { preserveWhitespace: 'full' } });
          
          // 设置打开文件标记
          console.log(`[渲染进程:onFileOpened] 更新文件打开状态`);
          hasOpenedFiles = true;
          
          // 更新字数
          console.log(`[渲染进程:onFileOpened] 更新字数统计`);
          updateWordCount(content);
          
          // 隐藏"请先创建文件"的提示
          console.log(`[渲染进程:onFileOpened] 隐藏“请先创建文件”提示`);
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
          
          // 不使用 clearHistory，因为该方法不存在
          
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
  setTimeout(async () => { // 添加async关键字使得回调函数可以使用await
    // 初始化时检查全屏状态
    updateMacSafeArea();
    
    // 只有当没有通过IPC事件加载文件时才主动加载文件列表
    // 延迟加载文件列表，避免和主进程发送的file-opened事件冲突
    // 因为如果主进程会发送file-opened事件，该事件的处理程序中会调用loadFileList
    if (!currentFilePath) {
      // 加载文件列表
      await loadFileList();
      
      // 检查目录中是否有文件
      const hasFiles = await checkDirectoryHasFiles();
      
      // 只有在目录中没有文件时才显示“请先创建文件”的提示
      toggleNoFileMessage(!hasFiles);
      
      if (!hasFiles) {
        console.log('目录中没有文件，显示创建文件提示');
      }
    }
  }, 300);
  
  // 为创建新文件按钮绑定事件
  const btnCreateFile = document.getElementById('btn-create-file');
  if (btnCreateFile) {
    btnCreateFile.addEventListener('click', createNewFile);
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

console.log('已加载 tiptap-markdown 扩展，现在直接处理 markdown 内容');

console.log('👋 This message is being logged by "renderer.js", included via webpack');
