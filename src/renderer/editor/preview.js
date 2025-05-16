/**
 * editor/preview.js
 * 编辑器预览相关功能
 */

import { updatePreview } from './index';

// 预览定时器
let previewTimeout;

// 防抖函数：延迟触发预览更新
export const debouncedUpdatePreview = (markdownContent) => {
  // 清除之前的定时器
  if (previewTimeout) {
    clearTimeout(previewTimeout);
  }
  
  // 设置新的定时器
  previewTimeout = setTimeout(() => {
    updatePreview(markdownContent);
  }, 300); // 300毫秒的防抖时间
};
