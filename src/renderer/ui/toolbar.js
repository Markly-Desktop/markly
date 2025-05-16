/**
 * ui/toolbar.js
 * 工具栏功能
 */

import { editor, toggleMode } from '../editor';
import { saveFile } from '../files/operations';

// 绑定工具栏按钮事件
export const bindToolbarEvents = () => {
  // 绑定格式化按钮事件
  
  // 粗体
  const btnBold = document.getElementById('btn-bold');
  if (btnBold) {
    btnBold.addEventListener('click', () => {
      if (!editor) return;
      editor.commands.toggleBold();
      editor.commands.focus();
    });
  }
  
  // 斜体
  const btnItalic = document.getElementById('btn-italic');
  if (btnItalic) {
    btnItalic.addEventListener('click', () => {
      if (!editor) return;
      editor.commands.toggleItalic();
      editor.commands.focus();
    });
  }
  
  // 引用
  const btnQuote = document.getElementById('btn-quote');
  if (btnQuote) {
    btnQuote.addEventListener('click', () => {
      if (!editor) return;
      editor.commands.toggleBlockquote();
      editor.commands.focus();
    });
  }
  
  // 代码
  const btnCode = document.getElementById('btn-code');
  if (btnCode) {
    btnCode.addEventListener('click', () => {
      if (!editor) return;
      editor.commands.toggleCodeBlock();
      editor.commands.focus();
    });
  }
  
  // 链接
  const btnLink = document.getElementById('btn-link');
  if (btnLink) {
    btnLink.addEventListener('click', () => {
      if (!editor) return;
      const url = prompt('请输入链接地址:', 'https://');
      if (url) {
        // 检查是否有选中的文本
        if (editor.view.state.selection.empty) {
          // 如果没有选中文本，则插入链接
          editor.commands.insertContent(`[链接](${url})`);
        } else {
          // 如果选中了文本，则将其转换为链接
          editor.commands.setLink({ href: url });
        }
      }
      editor.commands.focus();
    });
  }
  
  // 图片
  const btnImage = document.getElementById('btn-image');
  if (btnImage) {
    btnImage.addEventListener('click', async () => {
      if (!editor) return;
      
      try {
        // 请求主进程选择图片文件
        const result = await window.electronAPI.selectImage();
        
        if (result && result.success && result.path) {
          // 插入图片
          editor.commands.insertContent(`![图片](${result.path})`);
          editor.commands.focus();
        }
      } catch (error) {
        console.error('选择图片失败:', error);
      }
    });
  }
  
  // 有序列表
  const btnOrderedList = document.getElementById('btn-ordered-list');
  if (btnOrderedList) {
    btnOrderedList.addEventListener('click', () => {
      if (!editor) return;
      editor.commands.toggleOrderedList();
      editor.commands.focus();
    });
  }
  
  // 无序列表
  const btnBulletList = document.getElementById('btn-bullet-list');
  if (btnBulletList) {
    btnBulletList.addEventListener('click', () => {
      if (!editor) return;
      editor.commands.toggleBulletList();
      editor.commands.focus();
    });
  }
  
  // 标题
  const btnHeading = document.getElementById('btn-heading');
  if (btnHeading) {
    btnHeading.addEventListener('click', (e) => {
      if (!editor) return;
      
      // 如果有下拉菜单，则显示/隐藏它
      const headingDropdown = document.getElementById('heading-dropdown');
      if (headingDropdown) {
        headingDropdown.classList.toggle('hidden');
        
        // 阻止点击事件冒泡到文档
        e.stopPropagation();
        
        // 点击文档其他位置关闭下拉菜单
        const closeDropdown = () => {
          headingDropdown.classList.add('hidden');
          document.removeEventListener('click', closeDropdown);
        };
        
        document.addEventListener('click', closeDropdown);
      }
    });
    
    // 绑定各级标题按钮事件
    for (let i = 1; i <= 3; i++) {
      const btnH = document.getElementById(`btn-h${i}`);
      if (btnH) {
        btnH.addEventListener('click', () => {
          if (!editor) return;
          editor.commands.toggleHeading({ level: i });
          editor.commands.focus();
          
          // 关闭下拉菜单
          const headingDropdown = document.getElementById('heading-dropdown');
          if (headingDropdown) {
            headingDropdown.classList.add('hidden');
          }
        });
      }
    }
  }
  
  // 切换预览/编辑模式
  const btnToggleMode = document.getElementById('btn-toggle-mode');
  if (btnToggleMode) {
    btnToggleMode.addEventListener('click', toggleMode);
  }
  
  // 保存
  const btnSave = document.getElementById('btn-save');
  if (btnSave) {
    btnSave.addEventListener('click', () => saveFile(window.currentFilePath));
  }
};
