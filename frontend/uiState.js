/**
 * UI 状态管理模块
 * 负责管理加载指示器和错误消息的显示/隐藏
 */
class UIStateModule {
  /**
   * @param {HTMLElement} loadingElement - 加载指示器 DOM 元素
   * @param {HTMLElement} errorElement - 错误消息 DOM 元素
   */
  constructor(loadingElement, errorElement) {
    this.loadingElement = loadingElement;
    this.errorElement = errorElement;
    this._errorTimer = null;
  }

  /**
   * 显示加载指示器
   */
  showLoading() {
    this.loadingElement.removeAttribute('hidden');
  }

  /**
   * 隐藏加载指示器
   */
  hideLoading() {
    this.loadingElement.setAttribute('hidden', '');
  }

  /**
   * 显示错误消息
   * @param {string} message - 要显示的错误消息文本
   */
  showError(message) {
    // 清除之前的自动隐藏定时器
    if (this._errorTimer) {
      clearTimeout(this._errorTimer);
      this._errorTimer = null;
    }

    this.errorElement.textContent = message;
    this.errorElement.removeAttribute('hidden');

    // 5 秒后自动隐藏错误消息
    this._errorTimer = setTimeout(() => {
      this.hideError();
    }, 5000);
  }

  /**
   * 隐藏错误消息
   */
  hideError() {
    if (this._errorTimer) {
      clearTimeout(this._errorTimer);
      this._errorTimer = null;
    }

    this.errorElement.setAttribute('hidden', '');
    this.errorElement.textContent = '';
  }

  /**
   * 处理错误并显示用户友好的中文错误消息
   * @param {Error} error - 捕获的错误对象
   */
  handleError(error) {
    const message = this._getErrorMessage(error);
    this.showError(message);
  }

  /**
   * 根据错误类型返回对应的中文错误消息
   * @param {Error} error - 错误对象
   * @returns {string} 用户友好的中文错误消息
   * @private
   */
  _getErrorMessage(error) {
    // 网络错误：fetch 在网络不可达时抛出 TypeError
    if (error instanceof TypeError) {
      return '网络连接失败，请检查网络后重试';
    }

    // 超时错误
    if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      return '请求超时，请稍后重试';
    }

    // API 返回的错误消息（由 ApiClientModule 抛出）
    if (error.message && error.message !== 'Failed to fetch') {
      return error.message;
    }

    // 默认兜底消息
    return '语音合成服务暂时不可用，请稍后重试';
  }
}
