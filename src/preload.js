const { contextBridge, ipcRenderer } = require('electron');

// 为渲染进程暴露安全的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 文件操作
  onFileNew: (callback) => ipcRenderer.on('file-new', callback),
  onFileOpened: (callback) => ipcRenderer.on('file-opened', callback),
  onSaveFile: (callback) => ipcRenderer.on('save-file', callback),
  onSaveFileAs: (callback) => ipcRenderer.on('save-file-as', callback),
  saveFileDialog: (content, defaultPath) => ipcRenderer.invoke('save-file-dialog', { content, defaultPath }),
  saveCurrentFile: (content) => ipcRenderer.invoke('save-current-file', { content }),
  
  // 视图切换
  onToggleMode: (callback) => ipcRenderer.on('toggle-mode', callback),
  
  // 窗口状态API
  isFullScreen: () => ipcRenderer.invoke('is-fullscreen'),
  onFullScreenChange: (callback) => ipcRenderer.on('fullscreen-change', callback),

  // 设置相关API
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (settings) => ipcRenderer.invoke('update-settings', settings),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),

  // 新增: 文件列表和文件内容操作
  listFiles: () => ipcRenderer.invoke('list-files'),
  openFile: (filePath) => ipcRenderer.invoke('open-file', { filePath }),
  createNewFile: (fileName) => ipcRenderer.invoke('create-new-file', { fileName }),
  
  // 新增: 文件重命名和删除操作
  renameFile: (oldPath, newName) => ipcRenderer.invoke('rename-file', { oldPath, newName }),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', { filePath }),
  
  // 文件删除后打开最近文件事件
  onOpenRecentAfterDelete: (callback) => ipcRenderer.on('open-recent-after-delete', callback),
  
  // 新增: 通知渲染进程显示“无文件”提示的事件
  onShowNoFilesMessage: (callback) => ipcRenderer.on('show-no-files-message', callback),
  
  // 新增: 图片上传处理
  selectImage: () => ipcRenderer.invoke('select-image'),
  
  // 内容跟踪 - 不会触发自动保存
  contentChanged: (content) => ipcRenderer.send('content-changed', content),
  
  // 新增: 按回车或切换文件时保存
  saveOnEvent: () => ipcRenderer.invoke('save-on-event'),

  // 清除所有监听器
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
