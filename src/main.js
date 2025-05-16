const { app, BrowserWindow, Menu, dialog, ipcMain, protocol } = require('electron');
const path = require('node:path');
const fs = require('fs-extra');
// 导入 electron-store，尝试使用 default 属性
const ElectronStore = require('electron-store');
const Store = ElectronStore.default || ElectronStore;
const crypto = require('crypto');
const url = require('url');
const express = require('express');
const http = require('http');

// 初始化设置存储
const store = new Store();

// 本地图片服务器端口
const imageServerPort = 17395;

// 图片服务器实例
let imageServer = null;

// 创建并启动本地图片服务器
function startImageServer() {
  const app = express();
  
  // 设置跨域访问
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    next();
  });
  
  // 动态设置静态文件服务器路径
  app.use('/images', (req, res, next) => {
    // 验证文档是否打开
    if (!currentFilePath) {
      console.log('错误: 没有打开文档');
      return res.status(404).send('Document not opened');
    }

    const docDir = path.dirname(currentFilePath);
    const imagesDir = path.join(docDir, '.images');
    
    // 记录访问情况
    console.log(`请求图片目录: ${imagesDir}`);
    console.log(`原始 URL: ${req.originalUrl}`);
    
    // 确保图片目录存在
    if (!fs.existsSync(imagesDir)) {
      console.log(`创建图片目录: ${imagesDir}`);
      fs.ensureDirSync(imagesDir);
    }

    // 每次请求都为当前打开的文档设置静态目录
    express.static(imagesDir, {
      index: false,
      setHeaders: (res, path, stat) => {
        console.log(`提供文件: ${path}`);
        // Express 会自动处理 Content-Type
      }
    })(req, res, next);
  });
  
  // 创建 HTTP 服务器
  imageServer = http.createServer(app);
  
  // 监听指定端口
  imageServer.listen(imageServerPort, () => {
    console.log(`本地图片服务器启动在端口: ${imageServerPort}`);
  });
  
  // 错误处理
  imageServer.on('error', (err) => {
    console.error('图片服务器错误:', err);
  });
}

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// 保存最近打开的文件路径
let currentFilePath = null;
// 保存主窗口引用
let mainWindow = null;
// 自动保存的计时器
let autoSaveTimer = null;
// 当前编辑的内容
let currentContent = '';
// 最近打开的文件历史记录 (最多保存10个)
let recentFilesHistory = [];

// 生成随机字符串作为文件名
const generateRandomFileName = (extension) => {
  return `${crypto.randomBytes(8).toString('hex')}${extension}`;
};

// 更新文件历史记录
const updateFileHistory = (filePath) => {
  // 如果文件已经在历史记录中，先移除它
  recentFilesHistory = recentFilesHistory.filter(path => path !== filePath);
  
  // 将文件添加到历史记录最前面
  recentFilesHistory.unshift(filePath);
  
  // 限制历史记录最多保存10个文件
  if (recentFilesHistory.length > 10) {
    recentFilesHistory = recentFilesHistory.slice(0, 10);
  }
  
  // 保存到持久化存储
  store.set('recentFilesHistory', recentFilesHistory);
};

// 从文件历史中打开最近的文件
const openRecentFile = async () => {
  console.log(`[openRecentFile] 开始执行`);
  console.log(`[openRecentFile] 当前文件路径: ${currentFilePath}`);
  console.log(`[openRecentFile] 历史记录: ${JSON.stringify(recentFilesHistory)}`);
  
  try {
    // 检查目录中是否有任何文件
    const rootDirectory = store.get('rootDirectory');
    console.log(`[openRecentFile] 根目录: ${rootDirectory}`);
    
    // 读取目录中的所有文件
    let allFiles = [];
    if (rootDirectory) {
      try {
        allFiles = await fs.readdir(rootDirectory);
        console.log(`[openRecentFile] 目录中的文件数量: ${allFiles.length}`);
        if (allFiles.length > 0) {
          console.log(`[openRecentFile] 目录中的第一个文件: ${allFiles[0]}`);
        }
      } catch (readDirError) {
        console.error(`[openRecentFile] 读取目录失败:`, readDirError.message);
        allFiles = [];
      }
    }
    
    // 取出所有markdown文件
    const markdownFiles = allFiles.filter(file => {
      return file.toLowerCase().endsWith('.md') || file.toLowerCase().endsWith('.markdown');
    });
    console.log(`[openRecentFile] Markdown文件数量: ${markdownFiles.length}`);
    if (markdownFiles.length > 0) {
      console.log(`[openRecentFile] 第一个 Markdown 文件: ${markdownFiles[0]}`);
    }
    
    // 筛选出有效的最近文件
    console.log(`[openRecentFile] 开始查找可用的最近文件`);
    let availableFiles = [];
    for (const file of recentFilesHistory) {
      const exists = await fs.pathExists(file);
      console.log(`[openRecentFile] 检查文件 ${file} 存在: ${exists}`);
      if (file !== currentFilePath && exists) {
        availableFiles.push(file);
      }
    }
    console.log(`[openRecentFile] 可用的最近文件数量: ${availableFiles.length}`);
    
    if (availableFiles.length > 0) {
      // 有最近的文件，打开它
      console.log(`[openRecentFile] 存在可用的最近文件`);
      const filePath = availableFiles[0];
      console.log(`[openRecentFile] 将打开的最近文件: ${filePath}`);
      
      // 读取文件内容
      let content = '';
      try {
        content = await fs.readFile(filePath, 'utf8');
        console.log(`[openRecentFile] 成功读取文件内容，长度: ${content.length}`);
      } catch (readError) {
        console.error(`[openRecentFile] 读取文件内容失败:`, readError.message);
        return false;
      }
      
      // 这里使用标准的file-opened事件，因为它处理得更好
      console.log(`[openRecentFile] 发送file-opened事件到渲染进程`);
      mainWindow.webContents.send('file-opened', { content, filePath });
      
      // 更新主进程的状态
      currentFilePath = filePath;
      mainWindow.setTitle(`Markly - ${path.basename(filePath)}`);
      store.set('lastOpenedFile', filePath);
      
      console.log(`[openRecentFile] 成功打开最近文件: ${filePath}`);
      return true;
    } else if (markdownFiles.length > 0) {
      // 没有最近的文件，但目录中有其他文件，返回空内容并保持编辑器可见
      console.log(`[openRecentFile] 没有最近文件，但目录中有其他文件，发送file-new事件`);
      mainWindow.webContents.send('file-new');
      
      // 重置主进程状态
      currentFilePath = null;
      mainWindow.setTitle(`Markly - 未命名`);
      store.delete('lastOpenedFile');
      
      console.log('[openRecentFile] 目录中有文件，保持编辑器可见');
      return false;
    } else {
      // 目录中没有文件，显示创建文件提示
      console.log(`[openRecentFile] 目录中没有文件，发送show-no-files-message事件`);
      // 使用特殊事件通知渲染进程显示“请先创建文件”提示
      mainWindow.webContents.send('show-no-files-message');
      
      // 重置主进程状态
      currentFilePath = null;
      mainWindow.setTitle(`Markly - 未命名`);
      store.delete('lastOpenedFile');
      
      console.log('[openRecentFile] 目录中没有文件，显示创建文件提示');
      return false;
    }
  } catch (error) {
    console.error(`[openRecentFile] 执行出错:`, error.message);
    console.error(error.stack);
    return false;
  }
};

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false // 允许加载本地文件（仅在开发环境使用）
    },
    titleBarStyle: 'hiddenInset', // 在macOS上创建更好看的标题栏
    backgroundColor: '#FFF',
  });

  // 监听窗口全屏状态变化
  mainWindow.on('enter-full-screen', () => {
    mainWindow.webContents.send('fullscreen-change', true);
  });
  
  mainWindow.on('leave-full-screen', () => {
    mainWindow.webContents.send('fullscreen-change', false);
  });

  // 设置 CSP 来允许从本地HTTP服务器加载资源
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [`default-src 'self' data: file: http://localhost:*; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: file: http://localhost:*`]
      }
    })
  });
  
  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // 加载文件历史记录
  recentFilesHistory = store.get('recentFilesHistory') || [];
  
  mainWindow.webContents.on('did-finish-load', () => {
    const lastOpenedFilePath = store.get('lastOpenedFile');
    if (lastOpenedFilePath) {
      try {
        // 检查文件是否存在
        if (fs.existsSync(lastOpenedFilePath)) {
          const content = fs.readFileSync(lastOpenedFilePath, 'utf8');
          mainWindow.webContents.send('file-opened', { content, filePath: lastOpenedFilePath });
          currentFilePath = lastOpenedFilePath;
          mainWindow.setTitle(`Markly - ${path.basename(lastOpenedFilePath)}`);
          
          // 确保当前文件也在历史记录中
          updateFileHistory(lastOpenedFilePath);
          console.log(`启动时自动恢复文件: ${lastOpenedFilePath}`);
        } else {
          // 如果上次打开的文件不存在，尝试打开最近的文件
          openRecentFile();
        }
      } catch (error) {
        console.error('恢复上次文件失败:', error.message);
        // 尝试打开最近的文件
        openRecentFile();
      }
    }
  });

  // 设置应用菜单
  const template = [
    {
      label: '文件',
      submenu: [
        {
          label: '新建',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('file-new');
            currentFilePath = null;
            mainWindow.setTitle('Markly - 未命名');
          }
        },
        {
          label: '打开',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const { canceled, filePaths } = await dialog.showOpenDialog({
              properties: ['openFile'],
              filters: [
                { name: 'Markdown 文件', extensions: ['md', 'markdown'] },
                { name: '所有文件', extensions: ['*'] }
              ]
            });
            
            if (!canceled && filePaths.length > 0) {
              const filePath = filePaths[0];
              try {
                const content = await fs.readFile(filePath, 'utf8');
                mainWindow.webContents.send('file-opened', { content, filePath });
                currentFilePath = filePath;
                mainWindow.setTitle(`Markly - ${path.basename(filePath)}`);
                
                // 更新最近打开的文件历史
                updateFileHistory(filePath);
                
                // 保存最近打开文件路径
                store.set('lastOpenedFile', filePath);
              } catch (error) {
                dialog.showErrorBox('打开文件失败', error.message);
              }
            }
          }
        },
        {
          label: '保存',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            if (currentFilePath) {
              mainWindow.webContents.send('save-file', { filePath: currentFilePath });
            } else {
              mainWindow.webContents.send('save-file-as');
            }
          }
        },
        {
          label: '另存为',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            mainWindow.webContents.send('save-file-as');
          }
        },
        { type: 'separator' },
        {
          label: '退出',
          role: 'quit',
          accelerator: 'CmdOrCtrl+Q'
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'delete', label: '删除' },
        { type: 'separator' },
        { role: 'selectAll', label: '全选' }
      ]
    },
    {
      label: '视图',
      submenu: [
        {
          label: '切换编辑/预览模式',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            mainWindow.webContents.send('toggle-mode');
          }
        },
        { type: 'separator' },
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '切换全屏' }
      ]
    },
    {
      role: 'help',
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: async () => {
            dialog.showMessageBox({
              title: '关于 Markly',
              message: 'Markly - 简洁高效的 Markdown 编辑器',
              detail: `版本: ${app.getVersion()}\n© ${new Date().getFullYear()} Markly Team`
            });
          }
        }
      ]
    }
  ];

  // macOS 特定的菜单调整
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { role: 'about', label: '关于 Markly' },
        { type: 'separator' },
        { role: 'services', label: '服务' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏 Markly' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '显示全部' },
        { type: 'separator' },
        { role: 'quit', label: '退出 Markly' }
      ]
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // 启动图片HTTP服务器
  startImageServer();
  
  createWindow();

  // 处理文件保存的请求
  ipcMain.handle('save-file-dialog', async (_, { content, defaultPath }) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath,
      filters: [
        { name: 'Markdown 文件', extensions: ['md'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    });

    if (!canceled && filePath) {
      try {
        await fs.writeFile(filePath, content, 'utf8');
        currentFilePath = filePath;
        store.set('lastOpenedFile', filePath); // 保存最近打开的文件路径
        return { success: true, filePath };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }
    
    return { success: false };
  });

  // 处理文件保存的请求
  ipcMain.handle('save-current-file', async (_, { content }) => {
    if (!currentFilePath) return { success: false, error: '没有指定文件路径' };
    
    try {
      await fs.writeFile(currentFilePath, content, 'utf8');
      store.set('lastOpenedFile', currentFilePath); // 保存最近打开的文件路径
      
      // 更新文件历史记录
      updateFileHistory(currentFilePath);
      
      console.log(`保存文件: ${currentFilePath}`);
      return { success: true, filePath: currentFilePath };
    } catch (error) {
      console.error(`保存文件失败 ${currentFilePath}:`, error.message);
      return { success: false, error: error.message };
    }
  });
  
  // 处理全屏状态检查请求
  ipcMain.handle('is-fullscreen', () => {
    return mainWindow ? mainWindow.isFullScreen() : false;
  });

  // 获取设置
  ipcMain.handle('get-settings', () => {
    return {
      rootDirectory: store.get('rootDirectory')
    };
  });

  // 更新设置
  ipcMain.handle('update-settings', (_, settings) => {
    if (settings.rootDirectory) {
      store.set('rootDirectory', settings.rootDirectory);
    }
    return { success: true };
  });

  // 选择根目录
  ipcMain.handle('select-directory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: '选择根目录'
    });
    
    if (!canceled && filePaths.length > 0) {
      return { success: true, path: filePaths[0] };
    }
    
    return { success: false };
  });

  // 列出根目录下的文件
  ipcMain.handle('list-files', async () => {
    const rootDirectory = store.get('rootDirectory');
    if (!rootDirectory) {
      return { success: false, error: '没有设置根目录' };
    }

    try {
      // 读取目录中的所有文件
      const allFiles = await fs.readdir(rootDirectory);
      // 过滤出所有 .md 文件
      const files = await Promise.all(allFiles.map(async (file) => {
        const filePath = path.join(rootDirectory, file);
        const stats = await fs.stat(filePath);
        return {
          name: file,
          path: filePath,
          isDirectory: stats.isDirectory(),
          isMarkdown: file.toLowerCase().endsWith('.md') || file.toLowerCase().endsWith('.markdown')
        };
      }));
      
      // 仅返回 Markdown 文件
      const markdownFiles = files.filter(file => file.isMarkdown && !file.isDirectory);
      
      return { success: true, files: markdownFiles };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 打开指定文件
  ipcMain.handle('open-file', async (_, { filePath }) => {
    console.log(`[打开文件] 收到请求: ${filePath}`);
    
    try {
      // 检查文件存在
      const exists = await fs.pathExists(filePath);
      if (!exists) {
        console.error(`[打开文件] 文件不存在: ${filePath}`);
        return { success: false, error: '文件不存在' };
      }
      
      // 读取文件内容
      console.log(`[打开文件] 读取文件内容`);
      const content = await fs.readFile(filePath, 'utf8');
      console.log(`[打开文件] 成功读取内容，长度: ${content.length}`);
      
      // 直接发送事件到渲染进程
      console.log(`[打开文件] 发送file-opened事件到渲染进程`);
      mainWindow.webContents.send('file-opened', { content, filePath });
      
      // 更新主进程状态
      currentFilePath = filePath;
      mainWindow.setTitle(`Markly - ${path.basename(filePath)}`);
      store.set('lastOpenedFile', filePath); // 保存最近打开的文件路径
      
      // 将文件添加到最近打开历史记录
      updateFileHistory(filePath);
      
      console.log(`[打开文件] 成功打开文件: ${filePath}`);
      return { success: true, content, filePath };
    } catch (error) {
      console.error(`[打开文件] 打开文件失败 ${filePath}:`, error.message);
      return { success: false, error: error.message };
    }
  });

  // 创建新文件
  ipcMain.handle('create-new-file', async (_, { fileName }) => {
    const rootDirectory = store.get('rootDirectory');
    if (!rootDirectory) {
      return { success: false, error: '没有设置根目录' };
    }

    try {
      // 确保文件名有 .md 后缀
      let finalFileName = fileName;
      if (!finalFileName.toLowerCase().endsWith('.md')) {
        finalFileName += '.md';
      }
      
      const filePath = path.join(rootDirectory, finalFileName);
      
      // 检查文件是否已存在
      const fileExists = await fs.pathExists(filePath);
      if (fileExists) {
        // 如果文件已存在，自动增加序号
        let counter = 1;
        let newFilePath = filePath;
        while (await fs.pathExists(newFilePath)) {
          const nameWithoutExt = finalFileName.replace(/\.md$/, '');
          newFilePath = path.join(rootDirectory, `${nameWithoutExt}(${counter}).md`);
          counter++;
        }
        
        // 创建新文件
        await fs.writeFile(newFilePath, '', 'utf8');
        currentFilePath = newFilePath;
        return { success: true, filePath: newFilePath };
      }
      
      // 创建新文件
      await fs.writeFile(filePath, '', 'utf8');
      currentFilePath = filePath;
      mainWindow.setTitle(`Markly - ${finalFileName}`);
      return { success: true, filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 跟踪内容变化但不再自动保存
  ipcMain.on('content-changed', (_, content) => {
    // 只记录当前内容，不使用计时器自动保存
    currentContent = content;
  });
  
  // 保存文件（当按回车键或切换文件时触发）
  ipcMain.handle('save-on-event', async () => {
    console.log(`[保存文件] 收到按回车或切换文件保存请求`);
    
    if (!currentFilePath || !currentContent) {
      console.log(`[保存文件] 没有文件路径或内容，跳过保存`);
      return { success: false, error: '没有可保存的文件或内容' };
    }
    
    try {
      console.log(`[保存文件] 正在保存文件: ${currentFilePath}`);
      await fs.writeFile(currentFilePath, currentContent, 'utf8');
      store.set('lastOpenedFile', currentFilePath); // 保存最近打开的文件路径
      
      // 更新文件历史记录
      updateFileHistory(currentFilePath);
      
      console.log(`[保存文件] 文件保存成功: ${currentFilePath}`);
      return { success: true, filePath: currentFilePath };
    } catch (error) {
      console.error(`[保存文件] 保存文件失败:`, error.message);
      return { success: false, error: error.message };
    }
  });

  // 重命名文件
  ipcMain.handle('rename-file', async (_, { oldPath, newName }) => {
    try {
      const dirPath = path.dirname(oldPath);
      const fileExt = path.extname(oldPath);
      const newPath = path.join(dirPath, newName);
      
      // 确保新文件名有 .md 后缀
      const finalPath = newPath.endsWith(fileExt) ? newPath : `${newPath}${fileExt}`;
      
      // 检查文件是否已存在
      const fileExists = await fs.pathExists(finalPath);
      if (fileExists) {
        return { 
          success: false, 
          error: `文件 "${path.basename(finalPath)}" 已存在` 
        };
      }
      
      // 重命名文件
      await fs.rename(oldPath, finalPath);
      
      // 如果是当前打开的文件，更新路径
      if (currentFilePath === oldPath) {
        currentFilePath = finalPath;
        mainWindow.setTitle(`Markly - ${path.basename(finalPath)}`);
        // 更新存储的最近打开文件
        store.set('lastOpenedFile', finalPath);
      }
      
      return { 
        success: true, 
        newPath: finalPath,
        fileName: path.basename(finalPath)
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // 删除文件
  ipcMain.handle('delete-file', async (_, { filePath }) => {
    console.log(`[删除文件] 开始处理删除请求: ${filePath}`);
    console.log(`[删除文件] 当前打开的文件: ${currentFilePath}`);
    console.log(`[删除文件] 历史记录: ${JSON.stringify(recentFilesHistory)}`);
    
    try {
      // 确认删除
      const { response } = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['取消', '删除'],
        defaultId: 0,
        title: '确认删除',
        message: `您确定要删除 "${path.basename(filePath)}" 吗？`,
        detail: '此操作无法撤销。'
      });
      
      // 如果用户取消，返回
      if (response === 0) {
        console.log(`[删除文件] 用户取消删除`);
        return { success: false, canceled: true };
      }
      
      console.log(`[删除文件] 确认删除: ${filePath}`);
      console.log(`[删除文件] 是否为当前文件: ${currentFilePath === filePath}`);
      
      // 如果删除的是当前打开的文件，需要先关闭文件并准备打开最近文件
      let shouldOpenRecent = false;
      if (currentFilePath === filePath) {
        console.log(`[删除文件] 将要删除当前打开的文件`);
        
        // 更新历史记录，从历史中移除要删除的文件
        recentFilesHistory = recentFilesHistory.filter(path => path !== filePath);
        store.set('recentFilesHistory', recentFilesHistory);
        console.log(`[删除文件] 更新后的历史记录: ${JSON.stringify(recentFilesHistory)}`);
        
        // 暂时重置全局状态，但不发送 file-new 事件
        // 我们在删除成功后会直接打开最近文件
        currentFilePath = null;
        console.log(`[删除文件] 重置当前文件路径为 null`);
        
        // 标记应该打开最近文件
        shouldOpenRecent = true;
        console.log(`[删除文件] 设置 shouldOpenRecent = true`);
        
        // 等待一下以便引用归集
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      
      try {
        // 尝试删除文件
        console.log(`[删除文件] 准备调用fs.unlink删除文件: ${filePath}`);
        await fs.unlink(filePath);
        console.log(`[删除文件] 成功删除文件: ${filePath}`);
        
        // 如果标记了需要打开最近文件，尝试打开
        console.log(`[删除文件] shouldOpenRecent = ${shouldOpenRecent}`);
        if (shouldOpenRecent) {
          console.log(`[删除文件] 准备调用openRecentFile打开最近文件`);
          const result = await openRecentFile();
          console.log(`[删除文件] openRecentFile返回值: ${result}`);
          console.log(`[删除文件] ${result ? '成功打开最近文件' : '没有打开最近文件'}`);
        } else {
          console.log(`[删除文件] 不需要打开最近文件`);
        }
        
        console.log(`[删除文件] 控制流返回成功`);
        return { success: true };
      } catch (unlinkError) {
        console.error(`[删除文件] 删除文件失败:`, unlinkError.message);
        // 如果删除失败，尝试强制清理缓存并再次尝试
        if (process.platform === 'win32') {
          // Windows 上利用基于命令的删除
          try {
            require('child_process').execSync(`del "${filePath.replace(/"/g, '\"')}" /f`);
            console.log(`[强制删除Windows] 成功使用命令强制删除文件: ${filePath}`);
            
            // 如果当前删除的文件是打开的文件，重置当前文件路径
            if (currentFilePath === filePath) {
              console.log(`[强制删除Windows] 重置当前文件路径，因为当前删除的文件就是打开的文件`);
              currentFilePath = null;
            }
            
            // 尝试打开最近文件
            if (shouldOpenRecent) {
              console.log(`[强制删除Windows] 准备打开最近文件`);
              const result = await openRecentFile();
              console.log(`[强制删除Windows] 打开最近文件结果: ${result ? '成功' : '失败'}`);
            }
            
            return { success: true };
          } catch (cmdError) {
            console.error('相关原因:', cmdError.message);
            throw new Error(`无法删除文件，可能被其他程序锁定: ${unlinkError.message}`);
          }
        } else {
          // 在非 Windows 平台上强制删除
          try {
            require('child_process').execSync(`rm -f "${filePath.replace(/"/g, '\"')}"`);
            console.log(`[强制删除Unix] 成功使用命令强制删除文件: ${filePath}`);
            
            // 如果当前删除的文件是打开的文件，重置当前文件路径
            if (currentFilePath === filePath) {
              console.log(`[强制删除Unix] 重置当前文件路径，因为当前删除的文件就是打开的文件`);
              currentFilePath = null;
            }
            
            // 尝试打开最近文件
            if (shouldOpenRecent) {
              console.log(`[强制删除Unix] 准备打开最近文件`);
              const result = await openRecentFile();
              console.log(`[强制删除Unix] 打开最近文件结果: ${result ? '成功' : '失败'}`);
            }
            
            return { success: true };
          } catch (cmdError) {
            console.error('相关原因:', cmdError.message);
            throw new Error(`无法删除文件，可能被其他程序锁定: ${unlinkError.message}`);
          }
        }
      }
    } catch (error) {
      console.error('删除文件错误:', error);
      return { success: false, error: error.message };
    }
  });

  // 处理图片选择和处理请求
  ipcMain.handle('select-image', async () => {
    // 需要确认有当前编辑的文档
    if (!currentFilePath) {
      return { success: false, error: '请先保存文档，然后再插入图片。' };
    }

    // 显示文件选择对话框
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }
      ]
    });

    if (!canceled && filePaths.length > 0) {
      try {
        const imagePath = filePaths[0];
        const imageExtension = path.extname(imagePath);
        
        // 获取文档所在的目录
        const docDir = path.dirname(currentFilePath);
        
        // 创建 .images 目录（如果不存在）
        const imagesDir = path.join(docDir, '.images');
        await fs.ensureDir(imagesDir);
        
        // 生成随机文件名
        const newFileName = generateRandomFileName(imageExtension);
        const newFilePath = path.join(imagesDir, newFileName);
        
        // 复制图片到 .images 目录
        await fs.copy(imagePath, newFilePath);
        
        // 创建相对于文档的路径用于Markdown
        const relativePath = `.images/${newFileName}`;
        
        // 利用HTTP服务器URL用于编辑器预览显示
        const httpServerUrl = `http://localhost:${imageServerPort}/images/${newFileName}`;
        
        return { 
          success: true, 
          imagePath: relativePath,  // 用于Markdown源码
          fileUrl: httpServerUrl  // 用于编辑器和预览
        };
      } catch (error) {
        return { success: false, error: error.message };
      }
    }

    return { success: false };
  });

  // 协议注册代码已移至 app.whenReady() 函数中

  // On OS X it's common to re-create a window in the app when the
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
