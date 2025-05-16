/**
 * files/index.js
 * 文件操作模块入口
 */

import { editor } from '../editor';
import { toggleNoFileMessage, updateFilePath } from '../ui';
import { debouncedAutoSave } from '../editor/autosave';

// 导出文件模块相关函数
export { loadFileList, checkDirectoryHasFiles } from './list';
export { createNewFile, openFile, saveFile, closeCurrentFile } from './operations';
export { showFileContextMenu, removeFileContextMenu } from './context-menu';
export { renameFile, deleteFile } from './operations';
export { showRenameModal, closeRenameModal } from './modals';
export { updateFileHighlight } from './list';

// 获取当前文件路径
export const getCurrentFilePath = () => {
  return window.currentFilePath;
};
