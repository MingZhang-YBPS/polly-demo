// Amazon Polly 语音合成演示 - 交互逻辑

/**
 * 上下文菜单模块 (ContextMenuModule)
 * 管理自定义右键菜单的显示/隐藏逻辑
 *
 * 职责：
 * - 监听 textarea 的 contextmenu 事件
 * - 有选中文本时显示自定义菜单，无选中文本时允许浏览器默认行为
 * - 监听外部点击事件，点击菜单外区域时隐藏菜单
 */
class ContextMenuModule {
  /**
   * @param {HTMLElement} menuElement - 自定义上下文菜单的 DOM 元素
   * @param {HTMLTextAreaElement} textAreaElement - 文本输入区域的 DOM 元素
   */
  constructor(menuElement, textAreaElement) {
    this.menuElement = menuElement;
    this.textAreaElement = textAreaElement;
    this.isVisible = false;

    // 绑定事件处理函数（保留引用以便后续移除）
    this._handleContextMenu = this._handleContextMenu.bind(this);
    this._handleOutsideClick = this._handleOutsideClick.bind(this);

    // 注册事件监听器
    this._attachListeners();
  }

  /**
   * 注册事件监听器
   */
  _attachListeners() {
    // 监听 textarea 的右键事件
    this.textAreaElement.addEventListener('contextmenu', this._handleContextMenu);
    // 监听全局点击事件，用于检测菜单外的点击
    document.addEventListener('click', this._handleOutsideClick);
  }

  /**
   * 处理右键事件
   * 有选中文本时阻止默认菜单并显示自定义菜单；无选中文本时不干预
   * @param {MouseEvent} event - 右键点击事件
   */
  _handleContextMenu(event) {
    const selectedText = this._getSelectedText();

    if (!selectedText || selectedText.trim().length === 0) {
      // 无选中文本，不显示自定义菜单，允许浏览器默认行为
      this.hide();
      return;
    }

    // 有选中文本：阻止浏览器默认上下文菜单
    event.preventDefault();
    // 在鼠标点击位置显示自定义菜单
    this.show(event.clientX, event.clientY);
  }

  /**
   * 获取 textarea 中当前选中的文本
   * @returns {string} 选中的文本内容
   */
  _getSelectedText() {
    const start = this.textAreaElement.selectionStart;
    const end = this.textAreaElement.selectionEnd;
    return this.textAreaElement.value.substring(start, end);
  }

  /**
   * 在指定位置显示菜单
   * @param {number} x - 鼠标点击的 clientX 坐标
   * @param {number} y - 鼠标点击的 clientY 坐标
   */
  show(x, y) {
    this.menuElement.style.left = `${x}px`;
    this.menuElement.style.top = `${y}px`;
    this.menuElement.style.display = 'block';
    this.isVisible = true;
  }

  /**
   * 隐藏菜单
   */
  hide() {
    this.menuElement.style.display = 'none';
    this.isVisible = false;
  }

  /**
   * 处理外部点击事件
   * 当菜单可见且点击位置在菜单外部时，隐藏菜单
   * @param {MouseEvent} event - 点击事件
   */
  _handleOutsideClick(event) {
    if (this.isVisible && !this.menuElement.contains(event.target)) {
      this.hide();
    }
  }

  /**
   * 销毁模块，移除所有事件监听器
   */
  destroy() {
    this.textAreaElement.removeEventListener('contextmenu', this._handleContextMenu);
    document.removeEventListener('click', this._handleOutsideClick);
  }
}

// ============================================================
// 语音合成编排器 - 分句并行预取 + 流式顺序播放
// ============================================================

/**
 * SynthesisOrchestrator - 核心编排器
 * 负责：分句 → 并行预取 → 顺序播放 → 取消管理
 */
class SynthesisOrchestrator {
  /**
   * @param {ApiClientModule} apiClient - API 客户端实例
   * @param {AudioPlayerModule} audioPlayer - 音频播放器实例
   * @param {UIStateModule} uiState - UI 状态管理实例
   */
  constructor(apiClient, audioPlayer, uiState) {
    this.apiClient = apiClient;
    this.audioPlayer = audioPlayer;
    this.uiState = uiState;
    this.abortController = null;
  }

  /**
   * 取消所有进行中的请求和当前播放
   * 每次新合成开始时必须先调用此方法
   */
  cancel() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    this.audioPlayer.stop();
  }

  /**
   * 按中英文标点和换行符分句
   * @param {string} text - 原始文本
   * @returns {string[]} 分句后的句子数组（已过滤空句）
   */
  splitIntoSentences(text) {
    return text.split(/(?<=[。！？；.!?;\n])/)
      .map(s => s.trim())
      .filter(s => s.length > 0);
  }

  /**
   * 主流程：分句 → 并行预取 → 顺序播放
   * 如果用户在播放期间发起新合成，会自动取消之前的请求和播放
   * @param {string} text - 要合成的文本
   * @param {string} language - 语言标识符 (zh/en/yue)
   */
  async synthesize(text, language) {
    // 取消之前的请求和播放
    this.cancel();

    // 创建新的 AbortController
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    // 分句
    const sentences = this.splitIntoSentences(text);
    if (sentences.length === 0) return;

    // 清除之前的错误消息，显示加载状态
    this.uiState.hideError();
    this.uiState.showLoading();

    try {
      // 预取窗口大小为 2：先发前 2 句的请求
      const PREFETCH = 2;
      const audioPromises = [];

      // 启动前 PREFETCH 句的请求
      for (let i = 0; i < Math.min(PREFETCH, sentences.length); i++) {
        audioPromises[i] = this.apiClient.synthesize(sentences[i], language, signal);
      }

      // 顺序播放每句，同时预取后续句子
      for (let i = 0; i < sentences.length; i++) {
        if (signal.aborted) return;

        // 等待当前句的音频就绪
        const audioBlob = await audioPromises[i];

        if (signal.aborted) return;

        // 第一句开始播放时隐藏 loading
        if (i === 0) {
          this.uiState.hideLoading();
        }

        // 预取下一句（滑动窗口）
        const nextIdx = i + PREFETCH;
        if (nextIdx < sentences.length) {
          audioPromises[nextIdx] = this.apiClient.synthesize(sentences[nextIdx], language, signal);
        }

        // 播放当前句（等待播放完成再继续下一句）
        await this.audioPlayer.playSegment(audioBlob);
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        // 用户主动取消，静默处理，不显示错误
        return;
      }
      this.uiState.handleError(error);
    } finally {
      this.uiState.hideLoading();
    }
  }
}

// ============================================================
// 应用初始化 - 连接所有模块，配置完整的语音合成流程
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // API 端点配置（部署时替换为实际的 Function URL）
  const API_ENDPOINT = 'https://6jm7wfdub726hznuoo4rrlhsyi0diudr.lambda-url.ap-east-1.on.aws';

  // 获取 DOM 元素引用
  const textArea = document.getElementById('text-input');
  const contextMenuEl = document.getElementById('context-menu');
  const loadingIndicator = document.getElementById('loading-indicator');
  const errorMessage = document.getElementById('error-message');
  const audioPlayer = document.getElementById('audio-player');

  // 创建各模块实例
  const contextMenu = new ContextMenuModule(contextMenuEl, textArea);
  const apiClient = new ApiClientModule(API_ENDPOINT);
  const audioPlayerModule = new AudioPlayerModule(audioPlayer);
  const uiState = new UIStateModule(loadingIndicator, errorMessage);

  // 创建语音合成编排器
  const orchestrator = new SynthesisOrchestrator(apiClient, audioPlayerModule, uiState);

  // 为上下文菜单中的语言按钮绑定点击事件
  const menuButtons = contextMenuEl.querySelectorAll('.context-menu-item');
  menuButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      // 从按钮的 data-language 属性获取语言标识符
      const language = event.currentTarget.getAttribute('data-language');

      // 获取 textarea 中选中的文本
      const start = textArea.selectionStart;
      const end = textArea.selectionEnd;
      const selectedText = textArea.value.substring(start, end);

      // 无选中文本时不执行
      if (!selectedText || selectedText.trim().length === 0) return;

      // 在用户手势上下文中立即"解锁"音频播放
      // 播放一个极短的静音音频，让浏览器将此 audio 元素标记为"用户已交互"
      // 这样后续异步操作完成后调用 play() 不会被自动播放策略阻止
      const silentDataUri = 'data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAABhkVMmfIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/+0DEAAAAAANIAAAAAAAAA0gAAAAAP/7UMQAAAAAAA0gAAAAAAAANIAAAAA//tQxAAAAAAAA0gAAAAAAAANIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//tQxAAAAAAAA0gAAAAAAAANIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//tQxAAAAAAAA0gAAAAAAAANIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
      audioPlayer.src = silentDataUri;
      audioPlayer.play().catch(() => {});

      // 隐藏上下文菜单，启动合成流程
      contextMenu.hide();
      orchestrator.synthesize(selectedText, language);
    });
  });
});
