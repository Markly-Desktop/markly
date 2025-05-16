/**
 * ui/theme.js
 * 主题和UI样式相关功能
 */

// 检查全屏状态并控制 mac-safe-area 的显示
export const updateMacSafeArea = async () => {
  const macSafeArea = document.getElementById('mac-safe-area');
  if (!macSafeArea) {
    console.warn('Mac安全区域元素不存在');
    return;
  }
  
  try {
    // 使用 Electron API 检查全屏状态
    if (window.electronAPI && typeof window.electronAPI.isFullScreen === 'function') {
      const isFullscreen = await window.electronAPI.isFullScreen();
      
      // 在全屏状态下隐藏安全区域，否则显示
      if (isFullscreen) {
        macSafeArea.style.display = 'none';
      } else {
        macSafeArea.style.display = 'flex';
      }
    } else {
      // 回退方案：如果API不可用，默认显示安全区域
      macSafeArea.style.display = 'flex';
      console.warn('Fullscreen API not available, defaulting to show safe area');
    }
  } catch (error) {
    console.error('检查全屏状态失败:', error);
    // 出错时默认显示安全区域
    macSafeArea.style.display = 'flex';
  }
};
