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
    // 存储当前 playSegment 的 reject 函数，用于从外部中断播放
    this._rejectCurrent = null;
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
      // 保存 reject 引用，以便 stop() 可以中断此 Promise
      this._rejectCurrent = reject;

      this.audioElement.onended = () => {
        this._rejectCurrent = null;
        resolve();
      };
      this.audioElement.onerror = (e) => {
        this._rejectCurrent = null;
        reject(e);
      };
      this.audioElement.oncanplaythrough = () => {
        this.audioElement.play().catch((err) => {
          this._rejectCurrent = null;
          reject(err);
        });
      };
      // 如果已经可以播放，直接开始
      if (this.audioElement.readyState >= 4) {
        this.audioElement.play().catch((err) => {
          this._rejectCurrent = null;
          reject(err);
        });
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

    // 中断正在等待的 playSegment Promise
    // 抛出 AbortError 让调用方的 catch 能识别为取消操作
    if (this._rejectCurrent) {
      const abortError = new DOMException('Playback aborted', 'AbortError');
      this._rejectCurrent(abortError);
      this._rejectCurrent = null;
    }

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
