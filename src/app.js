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
    this.dragOffset = { x: 0, y: 0 };
    this.currentStampElement = null;

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
        const size = parseInt(option.dataset.size);
        this.selectSize(size);
      });
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

    pageStamps.forEach((stampPos, index) => {
      const stampEl = this.createStampElement(stampPos.image, stampPos);
      stampEl.dataset.index = index;
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
    img.style.pointerEvents = 'none';

    const handle = document.createElement('div');
    handle.className = 'resize-handle se';

    container.appendChild(img);
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
   * 选择尺寸
   */
  selectSize(size) {
    StampSizeCalculator.validateSize(size);
    this.currentStampSize = size;

    // 更新 UI
    document.querySelectorAll('.size-option').forEach(option => {
      option.classList.toggle('selected', parseInt(option.dataset.size) === size);
    });

    // 如果已有印章，更新尺寸
    if (this.currentStampElement) {
      this.updateStampSize(this.currentStampElement);
    }

    this.showToast(`尺寸已切换：${size}mm`, 'info');
  }

  /**
   * 更新印章尺寸
   */
  updateStampSize(stampElement) {
    const canvas = document.getElementById('pdfCanvas');
    const canvasWidth = canvas.width;
    const stampPixels = StampSizeCalculator.calculateStampPixels(
      this.currentStampSize,
      canvasWidth
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
    if (e.target.closest('.stamp-layer')) {
      this.isDragging = true;
      this.currentStampElement = e.target.closest('.stamp-layer');
      
      const rect = this.currentStampElement.getBoundingClientRect();
      this.dragOffset = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };

      this.currentStampElement.style.cursor = 'move';
      this.currentStampElement.style.zIndex = '1000';
    }
  }

  /**
   * 处理印章鼠标移动
   */
  handleStampMouseMove(e) {
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
    if (this.isDragging && this.currentStampElement) {
      this.isDragging = false;
      this.currentStampElement.style.cursor = 'move';
      this.currentStampElement.style.zIndex = '';

      // 保存印章位置
      const canvas = document.getElementById('pdfCanvas');
      const rect = this.currentStampElement.getBoundingClientRect();
      const containerRect = document.getElementById('canvasContainer').getBoundingClientRect();

      // 考虑 Canvas 缩放
      const scaleX = canvas.width / containerRect.width;
      const scaleY = canvas.height / containerRect.height;

      const position = {
        page: this.pdfService.currentPage,
        x: (rect.left - containerRect.left) * scaleX,
        y: (rect.top - containerRect.top) * scaleY,
        width: rect.width * scaleX,
        height: rect.height * scaleY,
        image: this.currentStampElement.querySelector('img').src
      };

      // 更新或添加印章位置
      const index = parseInt(this.currentStampElement.dataset.index);
      if (index >= 0) {
        this.pdfService.stampPositions[index] = position;
      } else {
        this.pdfService.stampPositions.push(position);
      }

      this.currentStampElement = null;
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
