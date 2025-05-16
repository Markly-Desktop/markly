/**
 * settings/index.js
 * 设置模块入口
 */

// 用户设置
export let settings = {
  rootDirectory: ''
};

// 加载设置
export const loadSettings = async () => {
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
export const saveSettings = async () => {
  try {
    if (window.electronAPI && typeof window.electronAPI.updateSettings === 'function') {
      await window.electronAPI.updateSettings(settings);
      console.log('设置已保存');
      // 保存设置后刷新文件列表
      const { loadFileList } = await import('../files/list');
      await loadFileList();
    }
  } catch (error) {
    console.error('保存设置失败:', error);
  }
};

// 打开设置弹窗
export const openSettingsModal = () => {
  const modal = document.getElementById('settings-modal');
  if (modal) {
    modal.classList.remove('hidden');
  }
};

// 关闭设置弹窗
export const closeSettingsModal = () => {
  const modal = document.getElementById('settings-modal');
  if (modal) {
    modal.classList.add('hidden');
  }
};

// 绑定设置界面事件
export const bindEvents = () => {
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
