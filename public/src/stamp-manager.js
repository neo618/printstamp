/**
 * 印章管理器
 * 负责印章模板的上传、保存、加载、重命名、删除
 * 使用 localStorage 持久化存储
 */

export class StampManager {
  constructor() {
    this.storageKey = 'pdf-stamp-templates';
    this.stamps = this.loadFromStorage();
  }

  /**
   * 从 localStorage 加载印章
   * @returns {Array} 印章数组
   */
  loadFromStorage() {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('加载印章失败:', error);
      return [];
    }
  }

  /**
   * 保存印章到 localStorage
   * @param {Object} stampData - 印章数据
   * @param {string} stampData.name - 印章名称
   * @param {string} stampData.image - Base64 图片数据
   * @returns {Object} 保存后的印章对象（含 ID）
   * @throws {Error} 仅支持 PNG 格式
   */
  saveStamp(stampData) {
    // 验证 PNG 格式
    if (!stampData.image || !stampData.image.startsWith('data:image/png')) {
      throw new Error('仅支持 PNG 格式印章图片');
    }

    const stamp = {
      id: stampData.id || this.generateId(),
      name: stampData.name || '未命名印章',
      image: stampData.image,
      createdAt: stampData.createdAt || Date.now(),
      updatedAt: Date.now()
    };

    // 检查是否已存在
    const existingIndex = this.stamps.findIndex(s => s.id === stamp.id);
    if (existingIndex >= 0) {
      this.stamps[existingIndex] = stamp;
    } else {
      this.stamps.push(stamp);
    }

    this.saveToStorage();
    return stamp;
  }

  /**
   * 获取所有印章
   * @returns {Array} 印章数组
   */
  getAllStamps() {
    return this.stamps;
  }

  /**
   * 根据 ID 获取印章
   * @param {string} id - 印章 ID
   * @returns {Object|null} 印章对象或 null
   */
  getStamp(id) {
    return this.stamps.find(s => s.id === id) || null;
  }

  /**
   * 重命名印章
   * @param {string} id - 印章 ID
   * @param {string} newName - 新名称
   * @throws {Error} 印章不存在
   */
  renameStamp(id, newName) {
    const stamp = this.getStamp(id);
    if (!stamp) {
      throw new Error('印章不存在');
    }

    stamp.name = newName;
    stamp.updatedAt = Date.now();
    this.saveToStorage();
  }

  /**
   * 删除印章
   * @param {string} id - 印章 ID
   * @throws {Error} 印章不存在
   */
  deleteStamp(id) {
    const index = this.stamps.findIndex(s => s.id === id);
    if (index < 0) {
      throw new Error('印章不存在');
    }

    this.stamps.splice(index, 1);
    this.saveToStorage();
  }

  /**
   * 保存所有印章到 localStorage
   */
  saveToStorage() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.stamps));
    } catch (error) {
      console.error('保存印章失败:', error);
      // 处理存储空间不足
      if (error.name === 'QuotaExceededError') {
        alert('本地存储空间不足，请删除一些印章后重试');
      }
    }
  }

  /**
   * 生成唯一 ID
   * @returns {string} 唯一 ID
   */
  generateId() {
    return `stamp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 清空所有印章
   */
  clearAll() {
    this.stamps = [];
    this.saveToStorage();
  }

  /**
   * 导出印章数据
   * @returns {string} JSON 字符串
   */
  exportStamps() {
    return JSON.stringify(this.stamps, null, 2);
  }

  /**
   * 导入印章数据
   * @param {string} jsonData - JSON 字符串
   */
  importStamps(jsonData) {
    try {
      const data = JSON.parse(jsonData);
      if (Array.isArray(data)) {
        this.stamps = data;
        this.saveToStorage();
      }
    } catch (error) {
      console.error('导入印章失败:', error);
    }
  }
}
