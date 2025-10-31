/**
 * 代码块复制功能
 * 为所有代码块添加 macOS 风格的复制按钮
 */

(function() {
  'use strict';

  // 等待 DOM 加载完成
  function initCopyButtons() {
    // 查找所有代码块
    const codeBlocks = document.querySelectorAll('pre code');

    codeBlocks.forEach((codeBlock) => {
      const pre = codeBlock.parentElement;

      // 如果已经包装过，跳过
      if (pre.parentElement.classList.contains('code-block-wrapper')) {
        return;
      }

      // 创建包装容器
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';

      // 替换 pre 元素
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      // 创建复制按钮
      const copyButton = document.createElement('button');
      copyButton.className = 'copy-code-button';
      copyButton.textContent = 'Copy';
      copyButton.setAttribute('aria-label', '复制代码');

      // 添加点击事件
      copyButton.addEventListener('click', async () => {
        try {
          // 获取代码文本内容
          const codeText = codeBlock.textContent || '';

          // 使用 Clipboard API 复制
          await navigator.clipboard.writeText(codeText);

          // 更新按钮状态
          copyButton.textContent = 'Copied!';
          copyButton.classList.add('copied');

          // 2秒后恢复原状
          setTimeout(() => {
            copyButton.textContent = 'Copy';
            copyButton.classList.remove('copied');
          }, 2000);
        } catch (err) {
          console.error('复制失败:', err);

          // 降级方案：使用 execCommand
          fallbackCopyToClipboard(codeBlock.textContent || '');

          copyButton.textContent = 'Copied!';
          copyButton.classList.add('copied');

          setTimeout(() => {
            copyButton.textContent = 'Copy';
            copyButton.classList.remove('copied');
          }, 2000);
        }
      });

      // 将按钮添加到包装容器
      wrapper.appendChild(copyButton);
    });
  }

  // 降级复制方案（兼容旧浏览器）
  function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('降级复制方案也失败了:', err);
    }

    document.body.removeChild(textArea);
  }

  // DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCopyButtons);
  } else {
    initCopyButtons();
  }

  // 监听动态添加的代码块（如果使用客户端路由）
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver((mutations) => {
      let shouldReinit = false;

      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // ELEMENT_NODE
            if (node.tagName === 'PRE' || node.querySelector('pre')) {
              shouldReinit = true;
            }
          }
        });
      });

      if (shouldReinit) {
        initCopyButtons();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
})();
