/**
 * editor/index.js
 * 编辑器模块入口
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { marked } from 'marked';
import { Markdown } from 'tiptap-markdown';

import { updateWordCount } from './commands';
import { debouncedUpdatePreview } from './preview';
import { debouncedAutoSave } from './autosave';

// 导出编辑器实例
export let editor = null;
export let isPreviewMode = false; // 默认为编辑模式

// 初始化编辑器
export const init = () => {
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
      if (window.currentFilePath) {
        console.log(`[渲染进程:onUpdate] 内容变化，触发自动保存防抖函数`);
        debouncedAutoSave();
      }
    }
  });
  
  // 设置 markdown 内容的处理
  console.log('编辑器初始化完成');
  
  return editor;
};

// 切换编辑/预览模式
export const toggleMode = () => {
  const editorElement = document.getElementById('editor');
  const previewElement = document.getElementById('preview');
  const btnToggleMode = document.getElementById('btn-toggle-mode');
  
  if (!editorElement || !previewElement || !btnToggleMode) {
    console.error('[toggleMode] 无法找到必要的DOM元素');
    return;
  }
  
  isPreviewMode = !isPreviewMode;
  
  if (isPreviewMode) {
    // 切换到预览模式
    editorElement.style.display = 'none';
    previewElement.style.display = 'block';
    btnToggleMode.innerHTML = '<i class="fas fa-edit"></i>';
    btnToggleMode.title = '编辑模式';
    
    // 确保预览内容是最新的
    if (editor) {
      const markdownContent = editor.storage.markdown.getMarkdown();
      updatePreview(markdownContent);
    }
  } else {
    // 切换到编辑模式
    editorElement.style.display = 'block';
    previewElement.style.display = 'none';
    btnToggleMode.innerHTML = '<i class="fas fa-eye"></i>';
    btnToggleMode.title = '预览模式';
    
    // 让编辑器获得焦点
    if (editor) {
      editor.commands.focus();
    }
  }
};

// 直接更新预览
export const updatePreview = (markdownContent) => {
  const previewElement = document.getElementById('preview');
  if (!previewElement) return;
  
  // 直接使用marked将markdown转为HTML
  previewElement.innerHTML = marked(markdownContent);
  
  // 确保预览内容完全更新后，触发所有图片重新加载
  const images = previewElement.querySelectorAll('img');
  images.forEach(img => {
    if (img.src) img.src = img.src;
  });
};

export { updateWordCount } from './commands';
export { debouncedUpdatePreview } from './preview';
export { debouncedAutoSave, autoSaveContent } from './autosave';
