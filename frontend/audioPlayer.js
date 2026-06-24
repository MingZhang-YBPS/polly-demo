/**
 * 音频播放模块
 * 负责接收音频 Blob 数据，通过 Audio 元素逐句播放语音
 * 支持播放单个片段并等待播放完成，以及立即停止当前播放
 */
class AudioPlayerModule {
  /**
   * 构造函数
   * @param {HTMLAudioElement} audioElement - HTML audio 元素
   */
  constructor(audioElement) {
    // 音频播放元素
    this.audioElement = audioElement;
    // 当前 Blob URL，用于后续清理防止内存泄漏
    this.currentBlobUrl = null;
    // 当前是否正在播放
    this.isPlaying = false;
  }

  /**
   * 播放单个音频片段，返回 Promise（播放完成时 resolve）
   * @param {Blob} audioBlob - 音频 Blob 数据
   * @returns {Promise<void>} 播放完成后 resolve
   */
  async playSegment(audioBlob) {
    // 清理上一次的 Blob URL，防止内存泄漏
    this._cleanup();

    // 从 Blob 创建对象 URL 并设置音频源
    this.currentBlobUrl = URL.createObjectURL(audioBlob);
    this.audioElement.src = this.currentBlobUrl;
    this.isPlaying = true;

    // 等待音频播放完成
    await new Promise((resolve, reject) => {
      this.audioElement.onended = resolve;
      this.audioElement.onerror = reject;
      this.audioElement.oncanplaythrough = () => {
        this.audioElement.play().catch(reject);
      };
      // 如果已经可以播放，直接开始
      if (this.audioElement.readyState >= 4) {
        this.audioElement.play().catch(reject);
      }
    });

    this.isPlaying = false;
  }

  /**
   * 立即停止当前播放，清理所有回调
   */
  stop() {
    this.audioElement.pause();
    this.audioElement.currentTime = 0;
    this.audioElement.onended = null;
    this.audioElement.onerror = null;
    this.audioElement.oncanplaythrough = null;
    this.isPlaying = false;
    this._cleanup();
  }

  /**
   * 清理之前的 Blob URL，释放内存
   * @private
   */
  _cleanup() {
    if (this.currentBlobUrl) {
      URL.revokeObjectURL(this.currentBlobUrl);
      this.currentBlobUrl = null;
    }
  }
}
