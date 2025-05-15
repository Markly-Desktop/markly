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
};

// 绑定 IPC 事件
const bindIpcEvents = () => {
  // 新建文件
  window.electronAPI.onFileNew((event) => {
    editor.commands.clearContent();
    currentContent = '';
    currentFilePath = null;
    updateFilePath(null);
  });
  
  // 文件被打开
  window.electronAPI.onFileOpened((event, { content, filePath }) => {
    // 将 Markdown 转为 HTML
    const html = marked.parse(content);
    editor.commands.setContent(html);
    currentContent = html;
    updateFilePath(filePath);
    updateWordCount(html);
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

// 初始化应用
const init = () => {
  initEditor();
  bindToolbarEvents();
  bindIpcEvents();
};

// DOM 加载完成后初始化
document.addEventListener('DOMContentLoaded', init);

console.log('👋 This message is being logged by "renderer.js", included via webpack');
