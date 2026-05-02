/**
 * PDF 电子印章工具 - 主应用
 * 整合所有模块，处理用户交互
 */

import { StampManager } from './stamp-manager.js';
import { PDFService } from './pdf-service.js';
import { StampSizeCalculator } from './stamp-size-calculator.js';

class StampApp {
  constructor() {
    this.stampManager = new StampManager();
    this.pdfService = new PDFService();
    this.currentStamp = null;
    this.currentStampSize = StampSizeCalculator.getDefaultSize();
    this.isDragging = false;
    this.isResizing = false;
    this.resizeStart = null;
    this.dragOffset = { x: 0, y: 0 };
    this.currentStampElement = null;
    this.activeStampElement = null; // 当前选中（高亮）的印章

    this.init();
  }

  init() {
    this.bindEvents();
    this.loadStampTemplates();
    this.updateSizeSelector();
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    // PDF 上传
    const pdfUploadArea = document.getElementById('pdfUploadArea');
    const pdfInput = document.getElementById('pdfInput');

    pdfUploadArea.addEventListener('click', () => pdfInput.click());
    pdfInput.addEventListener('change', (e) => this.handlePDFUpload(e));

    // 拖拽上传
    pdfUploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      pdfUploadArea.style.borderColor = '#764ba2';
    });
    pdfUploadArea.addEventListener('dragleave', () => {
      pdfUploadArea.style.borderColor = '#667eea';
    });
    pdfUploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      pdfUploadArea.style.borderColor = '#667eea';
      const files = e.dataTransfer.files;
      if (files.length > 0 && files[0].type === 'application/pdf') {
        this.loadPDFFile(files[0]);
      } else {
        this.showToast('请上传 PDF 文件', 'error');
      }
    });

    // 印章上传
    const uploadStampBtn = document.getElementById('uploadStampBtn');
    const stampInput = document.getElementById('stampInput');

    uploadStampBtn.addEventListener('click', () => stampInput.click());
    stampInput.addEventListener('change', (e) => this.handleStampUpload(e));

    // 尺寸选择
    document.querySelectorAll('.size-option').forEach(option => {
      option.addEventListener('click', () => {
        const raw = option.dataset.size;
        if (raw === 'other') {
          this.selectOtherSize();
        } else {
          this.selectSize(parseInt(raw));
        }
      });
    });

    // 自定义尺寸输入
    const customInput = document.getElementById('customSizeInput');
    customInput.addEventListener('change', () => this.applyCustomSize());
    customInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.applyCustomSize();
    });

    // 翻页控制
    document.getElementById('prevPageBtn').addEventListener('click', () => this.prevPage());
    document.getElementById('nextPageBtn').addEventListener('click', () => this.nextPage());
    document.getElementById('pageInput').addEventListener('change', (e) => {
      const page = parseInt(e.target.value);
      this.goToPage(page);
    });

    // 导出和重置
    document.getElementById('exportBtn').addEventListener('click', () => this.exportPDF());
    document.getElementById('resetBtn').addEventListener('click', () => this.reset());

    // Canvas 上的印章拖拽
    const canvasContainer = document.getElementById('canvasContainer');
    canvasContainer.addEventListener('mousedown', (e) => this.handleStampMouseDown(e));
    canvasContainer.addEventListener('mousemove', (e) => this.handleStampMouseMove(e));
    canvasContainer.addEventListener('mouseup', (e) => this.handleStampMouseUp(e));
    canvasContainer.addEventListener('mouseleave', (e) => this.handleStampMouseUp(e));

    // Delete 键删除选中印章
    document.addEventListener('keydown', (e) => this.handleKeyDown(e));

    // 点击空白区域取消选中
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.stamp-layer') && !e.target.closest('#canvasContainer')) {
        this.deselectActiveStamp();
      }
    });
  }

  /**
   * 加载印章模板
   */
  loadStampTemplates() {
    const stampList = document.getElementById('stampList');
    const stamps = this.stampManager.getAllStamps();

    if (stamps.length === 0) {
      stampList.innerHTML = '<div style="text-align: center; color: #999; padding: 20px;">暂无印章，请上传</div>';
      return;
    }

    stampList.innerHTML = stamps.map(stamp => `
      <div class="stamp-item" data-id="${stamp.id}">
        <img src="${stamp.image}" alt="${stamp.name}">
        <div class="stamp-item-name">${stamp.name}</div>
        <div class="stamp-item-actions">
          <button class="btn-rename" onclick="app.renameStamp('${stamp.id}')">重命名</button>
          <button class="btn-delete" onclick="app.deleteStamp('${stamp.id}')">删除</button>
        </div>
      </div>
    `).join('');

    // 绑定点击选择
    stampList.querySelectorAll('.stamp-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        const stampId = item.dataset.id;
        this.selectStamp(stampId);
      });
    });
  }

  /**
   * 选择印章
   */
  selectStamp(stampId) {
    this.currentStamp = this.stampManager.getStamp(stampId);

    // 更新 UI
    document.querySelectorAll('.stamp-item').forEach(item => {
      item.classList.toggle('selected', item.dataset.id === stampId);
    });

    this.showToast(`已选择：${this.currentStamp.name}`, 'info');
  }

  /**
   * 重命名印章
   */
  renameStamp(stampId) {
    const stamp = this.stampManager.getStamp(stampId);
    const newName = prompt('请输入新名称:', stamp.name);
    if (newName && newName.trim()) {
      this.stampManager.renameStamp(stampId, newName.trim());
      this.loadStampTemplates();
      this.showToast('重命名成功', 'success');
    }
  }

  /**
   * 删除印章
   */
  deleteStamp(stampId) {
    if (confirm('确定要删除这个印章吗？')) {
      this.stampManager.deleteStamp(stampId);
      if (this.currentStamp && this.currentStamp.id === stampId) {
        this.currentStamp = null;
      }
      this.loadStampTemplates();
      this.showToast('删除成功', 'success');
    }
  }

  /**
   * 处理 PDF 上传
   */
  async handlePDFUpload(e) {
    const file = e.target.files[0];
    if (file) {
      await this.loadPDFFile(file);
    }
  }

  /**
   * 加载 PDF 文件
   */
  async loadPDFFile(file) {
    try {
      const info = await this.pdfService.loadPDF(file);
      
      // 更新 UI
      document.getElementById('emptyState').classList.add('hidden');
      document.getElementById('pdfPreview').classList.remove('hidden');
      document.getElementById('totalPages').textContent = info.pageCount;
      document.getElementById('pageInput').max = info.pageCount;
      document.getElementById('pageInput').value = 1;
      document.getElementById('exportBtn').disabled = false;

      // 渲染第一页
      await this.renderCurrentPage();

      this.showToast(`PDF 加载成功：${info.pageCount}页`, 'success');
    } catch (error) {
      this.showToast(error.message, 'error');
    }
  }

  /**
   * 渲染当前页
   */
  async renderCurrentPage() {
    const canvas = document.getElementById('pdfCanvas');
    await this.pdfService.renderPage(canvas);

    // 重新绘制印章
    this.renderStampsOnCanvas();
  }

  /**
   * 在 Canvas 上渲染印章
   */
  renderStampsOnCanvas() {
    const canvasContainer = document.getElementById('canvasContainer');
    // 清除现有印章图层
    canvasContainer.querySelectorAll('.stamp-layer').forEach(el => el.remove());

    // 获取当前页的印章
    const currentPage = this.pdfService.currentPage;
    const pageStamps = this.pdfService.stampPositions.filter(s => s.page === currentPage);

    pageStamps.forEach((stampPos) => {
      const stampEl = this.createStampElement(stampPos.image, stampPos);
      // 存储印章在 stampPositions 中的实际索引
      stampEl.dataset.realIndex = this.pdfService.stampPositions.indexOf(stampPos);
      canvasContainer.appendChild(stampEl);
    });
  }

  /**
   * 创建印章元素
   */
  createStampElement(imageSrc, position) {
    const container = document.createElement('div');
    container.className = 'stamp-layer';
    container.style.left = position.x + 'px';
    container.style.top = position.y + 'px';
    container.style.width = position.width + 'px';
    container.style.height = position.height + 'px';

    const img = document.createElement('img');
    img.src = imageSrc;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.pointerEvents = 'none';
    container.appendChild(img);

    // 删除按钮（右上角 ×）
    const delBtn = document.createElement('button');
    delBtn.className = 'stamp-delete-btn';
    delBtn.innerHTML = '×';
    delBtn.title = '删除印章';
    delBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeStampFromCanvas(container);
    });
    container.appendChild(delBtn);

    const handle = document.createElement('div');
    handle.className = 'resize-handle se';

    container.appendChild(handle);

    return container;
  }

  /**
   * 处理印章上传
   */
  async handleStampUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'image/png') {
      this.showToast('仅支持 PNG 格式印章', 'error');
      return;
    }

    try {
      const base64 = await this.fileToBase64(file);
      const name = prompt('请输入印章名称:', file.name.replace('.png', '')) || file.name.replace('.png', '');

      const stamp = this.stampManager.saveStamp({
        name: name,
        image: base64
      });

      this.loadStampTemplates();
      this.selectStamp(stamp.id);
      this.showToast('印章保存成功', 'success');
    } catch (error) {
      this.showToast(error.message, 'error');
    }

    // 清空 input
    e.target.value = '';
  }

  /**
   * 文件转 Base64
   */
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * 选择预设尺寸
   */
  selectSize(size, allowCustom = false) {
    StampSizeCalculator.validateSize(size, allowCustom);
    this.currentStampSize = size;

    // 更新 UI
    document.querySelectorAll('.size-option').forEach(option => {
      if (option.dataset.size === 'other') {
        // 自定义尺寸时高亮「其他」
        option.classList.toggle('selected', allowCustom);
      } else {
        option.classList.toggle('selected', parseInt(option.dataset.size) === size);
      }
    });

    // 隐藏自定义输入
    document.getElementById('customSizeInput').parentElement.classList.add('hidden');

    // 如果已有印章，更新尺寸
    if (this.currentStampElement) {
      this.updateStampSize(this.currentStampElement);
    }

    this.showToast(`尺寸已切换：${size}mm`, 'info');
  }

  /**
   * 选择「其他」——显示自定义输入框
   */
  selectOtherSize() {
    // 取消所有预设高亮，高亮「其他」
    document.querySelectorAll('.size-option').forEach(option => {
      option.classList.toggle('selected', option.dataset.size === 'other');
    });

    const customWrap = document.getElementById('customSizeInput').parentElement;
    customWrap.classList.remove('hidden');
    customWrap.querySelector('input').focus();
  }

  /**
   * 应用自定义尺寸
   */
  applyCustomSize() {
    const input = document.getElementById('customSizeInput');
    const val = parseInt(input.value);
    if (!isNaN(val) && val >= 20 && val <= 100) {
      this.selectSize(val, true);
    } else {
      this.showToast(`请输入 20-100mm 之间的尺寸`, 'error');
      input.focus();
    }
  }

  /**
   * 更新印章尺寸（CSS 坐标）
   */
  updateStampSize(stampElement) {
    const container = document.getElementById('canvasContainer');
    const cssWidth = container.getBoundingClientRect().width;
    const stampPixels = StampSizeCalculator.calculateStampPixels(
      this.currentStampSize,
      cssWidth
    );

    stampElement.style.width = stampPixels + 'px';
    stampElement.style.height = stampPixels + 'px';
  }

  /**
   * 更新尺寸选择器 UI
   */
  updateSizeSelector() {
    const defaultSize = StampSizeCalculator.getDefaultSize();
    this.selectSize(defaultSize);
  }

  /**
   * 上一页
   */
  prevPage() {
    this.pdfService.prevPage();
    this.updatePageInput();
    this.renderCurrentPage();
  }

  /**
   * 下一页
   */
  nextPage() {
    this.pdfService.nextPage();
    this.updatePageInput();
    this.renderCurrentPage();
  }

  /**
   * 跳转到指定页
   */
  goToPage(page) {
    try {
      this.pdfService.goToPage(page);
      this.updatePageInput();
      this.renderCurrentPage();
    } catch (error) {
      this.showToast(error.message, 'error');
    }
  }

  /**
   * 更新页码输入框
   */
  updatePageInput() {
    document.getElementById('pageInput').value = this.pdfService.currentPage;
  }

  /**
   * 处理印章鼠标按下
   */
  handleStampMouseDown(e) {
    // 点击删除按钮时不启动拖拽
    if (e.target.closest('.stamp-delete-btn')) return;

    const resizeHandle = e.target.closest('.resize-handle');
    if (resizeHandle) {
      // 开始调整大小
      this.isResizing = true;
      this.currentStampElement = resizeHandle.closest('.stamp-layer');
      this.resizeStart = {
        width: this.currentStampElement.offsetWidth,
        height: this.currentStampElement.offsetHeight,
        x: e.clientX,
        y: e.clientY
      };
      return;
    }

    const stampLayer = e.target.closest('.stamp-layer');

    if (stampLayer) {
      // 选中该印章（高亮）
      this.selectActiveStamp(stampLayer);

      // 拖拽已有印章
      this.isDragging = true;
      this.currentStampElement = stampLayer;

      const rect = this.currentStampElement.getBoundingClientRect();
      this.dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };

      this.currentStampElement.style.cursor = 'move';
      this.currentStampElement.style.zIndex = '1000';
    } else if (this.currentStamp) {
      // 在 PDF 上放置新印章（CSS 坐标）
      const container = document.getElementById('canvasContainer');
      const containerRect = container.getBoundingClientRect();

      const stampPixels = StampSizeCalculator.calculateStampPixels(
        this.currentStampSize,
        containerRect.width
      );

      // 居中于点击位置
      let x = e.clientX - containerRect.left - stampPixels / 2;
      let y = e.clientY - containerRect.top - stampPixels / 2;

      // 限制在容器内
      x = Math.max(0, Math.min(x, containerRect.width - stampPixels));
      y = Math.max(0, Math.min(y, containerRect.height - stampPixels));

      // 使用 createStampElement 统一创建（含删除按钮、拖拽手柄）
      const stampEl = this.createStampElement(this.currentStamp.image, {
        x, y, width: stampPixels, height: stampPixels
      });

      container.appendChild(stampEl);

      // 开始拖拽（以点击中心为偏移）
      this.isDragging = true;
      this.currentStampElement = stampEl;
      this.selectActiveStamp(stampEl);
      this.dragOffset = {
        x: stampPixels / 2,
        y: stampPixels / 2
      };
      stampEl.style.zIndex = '1000';
    }
  }

  /**
   * 处理印章鼠标移动
   */
  handleStampMouseMove(e) {
    if (this.isResizing && this.currentStampElement) {
      // 拖拽调整大小（保持等比例正方形）
      const dx = e.clientX - this.resizeStart.x;
      const dy = e.clientY - this.resizeStart.y;
      const newSize = Math.max(20, this.resizeStart.width + Math.max(dx, dy));

      const container = document.getElementById('canvasContainer');
      const containerRect = container.getBoundingClientRect();

      // 限制不超过容器尺寸
      const clampedSize = Math.min(newSize, containerRect.width, containerRect.height);

      this.currentStampElement.style.width = clampedSize + 'px';
      this.currentStampElement.style.height = clampedSize + 'px';
      return;
    }

    if (!this.isDragging || !this.currentStampElement) return;

    const container = document.getElementById('canvasContainer');
    const containerRect = container.getBoundingClientRect();

    let newX = e.clientX - containerRect.left - this.dragOffset.x;
    let newY = e.clientY - containerRect.top - this.dragOffset.y;

    // 限制在 Canvas 范围内
    newX = Math.max(0, Math.min(newX, containerRect.width - this.currentStampElement.offsetWidth));
    newY = Math.max(0, Math.min(newY, containerRect.height - this.currentStampElement.offsetHeight));

    this.currentStampElement.style.left = newX + 'px';
    this.currentStampElement.style.top = newY + 'px';
  }

  /**
   * 处理印章鼠标释放
   */
  handleStampMouseUp(e) {
    // 无论 resize 还是 drag，结束时都保存位置
    if (this.isResizing || this.isDragging) {
      this.isResizing = false;
      this.isDragging = false;
      this.resizeStart = null;
    }

    if (this.currentStampElement) {
      this.currentStampElement.style.cursor = 'move';
      this.currentStampElement.style.zIndex = '';

      // 保存印章位置（CSS 坐标，不含缩放）
      const rect = this.currentStampElement.getBoundingClientRect();
      const containerRect = document.getElementById('canvasContainer').getBoundingClientRect();

      const position = {
        page: this.pdfService.currentPage,
        x: rect.left - containerRect.left,
        y: rect.top - containerRect.top,
        width: rect.width,
        height: rect.height,
        image: this.currentStampElement.querySelector('img').src
      };

      // 更新或添加印章位置（使用 stampPositions 中的实际索引）
      const realIndex = parseInt(this.currentStampElement.dataset.realIndex);
      if (!isNaN(realIndex) && realIndex >= 0) {
        this.pdfService.stampPositions[realIndex] = position;
      } else {
        this.pdfService.stampPositions.push(position);
        // 记录索引到 DOM，避免下次拖拽重复新增
        this.currentStampElement.dataset.realIndex = this.pdfService.stampPositions.length - 1;
      }

      this.currentStampElement = null;
    }
  }

  /**
   * 选中印章（高亮）
   */
  selectActiveStamp(stampEl) {
    // 取消旧的选中
    if (this.activeStampElement && this.activeStampElement !== stampEl) {
      this.activeStampElement.classList.remove('active');
    }
    this.activeStampElement = stampEl;
    stampEl.classList.add('active');
  }

  /**
   * 取消选中
   */
  deselectActiveStamp() {
    if (this.activeStampElement) {
      this.activeStampElement.classList.remove('active');
      this.activeStampElement = null;
    }
  }

  /**
   * 从画布上删除印章
   */
  removeStampFromCanvas(stampEl) {
    const realIndex = parseInt(stampEl.dataset.realIndex);
    if (!isNaN(realIndex) && realIndex >= 0) {
      this.pdfService.stampPositions.splice(realIndex, 1);
    }
    stampEl.remove();

    if (this.activeStampElement === stampEl) {
      this.activeStampElement = null;
    }

    // 重新渲染以修正索引
    this.renderStampsOnCanvas();
  }

  /**
   * Delete 键删除选中印章
   */
  handleKeyDown(e) {
    if (e.key === 'Delete' && this.activeStampElement) {
      this.removeStampFromCanvas(this.activeStampElement);
    }
  }

  /**
   * 导出 PDF
   */
  async exportPDF() {
    if (!this.pdfService.pdfDoc) {
      this.showToast('请先加载 PDF', 'error');
      return;
    }

    if (this.pdfService.stampPositions.length === 0) {
      if (!confirm('尚未添加印章，确定要导出吗？')) {
        return;
      }
    }

    try {
      const pdfBytes = await this.pdfService.exportPDF();
      const originalName = this.pdfService.originalBytes ? 'stamped.pdf' : 'document.pdf';
      const newName = '盖章_' + originalName;

      this.pdfService.downloadPDF(pdfBytes, newName);
      this.showToast('导出成功！', 'success');
    } catch (error) {
      this.showToast('导出失败：' + error.message, 'error');
    }
  }

  /**
   * 重置
   */
  reset() {
    if (confirm('确定要重新开始吗？所有未保存的更改将丢失。')) {
      this.pdfService.reset();
      this.currentStamp = null;
      this.currentStampElement = null;
      this.activeStampElement = null;

      document.getElementById('emptyState').classList.remove('hidden');
      document.getElementById('pdfPreview').classList.add('hidden');
      document.getElementById('exportBtn').disabled = true;
      document.getElementById('pageInput').value = 1;
      document.getElementById('totalPages').textContent = '0';

      this.showToast('已重置', 'info');
    }
  }

  /**
   * 显示提示
   */
  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  }
}

// 启动应用
const app = new StampApp();
window.app = app; // 暴露给全局以便 HTML 中调用
