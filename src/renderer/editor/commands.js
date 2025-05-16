/**
 * editor/commands.js
 * 编辑器命令模块
 */

// 更新字数统计
export const updateWordCount = (markdownContent) => {
  const wordCountElement = document.getElementById('word-count');
  if (!wordCountElement) return;
  
  // 使用正则表达式统计单词数
  // 中文以字符为单位，英文以单词为单位
  const chineseCharCount = (markdownContent.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWordCount = (markdownContent.match(/[a-zA-Z]+/g) || []).length;
  
  // 更新显示
  wordCountElement.textContent = `字符：${markdownContent.length} | 中文：${chineseCharCount} | 英文：${englishWordCount}`;
};
