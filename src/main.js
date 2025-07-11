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

// 生成随机字符串作为文件名
const generateRandomFileName = (extension) => {
  return `${crypto.randomBytes(8).toString('hex')}${extension}`;
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

  // 尝试恢复上次打开的文件
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
        }
      } catch (error) {
        console.error('恢复上次文件失败:', error.message);
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
                store.set('lastOpenedFile', filePath); // 保存最近打开的文件路径
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

  // 只在开发环境下打开开发工具，且默认不启动
  // if (process.env.NODE_ENV === 'development') {
  //   mainWindow.webContents.openDevTools();
  // }
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
      return { success: true, filePath: currentFilePath };
    } catch (error) {
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
    try {
      const content = await fs.readFile(filePath, 'utf8');
      currentFilePath = filePath;
      mainWindow.setTitle(`Markly - ${path.basename(filePath)}`);
      store.set('lastOpenedFile', filePath); // 保存最近打开的文件路径
      return { success: true, content, filePath };
    } catch (error) {
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

  // 自动保存
  ipcMain.on('content-changed', (_, content) => {
    currentContent = content;
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }
    autoSaveTimer = setTimeout(async () => {
      if (currentFilePath) {
        try {
          await fs.writeFile(currentFilePath, currentContent, 'utf8');
          store.set('lastOpenedFile', currentFilePath); // 保存最近打开的文件路径
        } catch (error) {
          console.error('自动保存失败:', error.message);
        }
      }
    }, 5000); // 5秒后自动保存
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
        return { success: false, canceled: true };
      }
      
      // 删除文件
      await fs.unlink(filePath);
      
      // 如果删除的是当前打开的文件，清空编辑器
      if (currentFilePath === filePath) {
        currentFilePath = null;
        mainWindow.setTitle('Markly - 未命名');
        store.delete('lastOpenedFile');
        mainWindow.webContents.send('file-new');
      }
      
      return { success: true };
    } catch (error) {
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
