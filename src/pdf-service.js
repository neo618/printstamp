/**
 * PDF 服务
 * 负责 PDF 文件加载、渲染、翻页、盖章、导出
 * 使用 pdf.js 渲染预览，pdf-lib 进行 PDF 编辑
 */

export class PDFService {
  constructor() {
    this.pdfDoc = null;
    this.pdfLibDoc = null;
    this.currentPage = 1;
    this.originalBytes = null;
    this.stampPositions = []; // 存储所有印章位置
  }

  /**
   * 加载 PDF 文件
   * @param {File} file - PDF 文件对象
   * @returns {Promise<Object>} PDF 文档信息
   * @throws {Error} 仅支持 PDF 格式
   */
  async loadPDF(file) {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      throw new Error('仅支持 PDF 格式文件');
    }

    try {
      // 使用 FileReader 读取文件（比 file.arrayBuffer() 更稳定，避免 buffer 被分离）
      const arrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('文件读取失败'));
        reader.readAsArrayBuffer(file);
      });

      // 将原始数据转为独立副本，彻底切断与浏览器内部 Blob 存储的引用
      const raw = new Uint8Array(arrayBuffer);
      this.originalBytes = new Uint8Array(raw.byteLength);
      this.originalBytes.set(raw);

      // 为 pdf.js 和 pdf-lib 创建各自独立的副本
      const pdfjsData = new Uint8Array(raw.byteLength);
      pdfjsData.set(raw);
      const pdfLibData = new Uint8Array(raw.byteLength);
      pdfLibData.set(raw);

      // 使用 pdf.js 加载文档用于预览
      const pdfjsLib = await this.loadPDFJS();
      this.pdfDoc = await pdfjsLib.getDocument({ data: pdfjsData }).promise;

      // 使用 pdf-lib 加载文档用于编辑
      const PDFLib = await this.loadPDFLib();
      this.pdfLibDoc = await PDFLib.PDFDocument.load(pdfLibData);

      this.currentPage = 1;

      return {
        pageCount: this.pdfDoc.numPages,
        fileName: file.name,
        fileSize: file.size
      };
    } catch (error) {
      if (error.message.includes('password')) {
        throw new Error('PDF 文件已加密，请先解密后上传');
      }
      throw error;
    }
  }

  /**
   * 动态加载 pdf.js
   */
  async loadPDFJS() {
    if (typeof pdfjsLib !== 'undefined') {
      return pdfjsLib;
    }
    // 浏览器环境从 CDN 加载
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      script.onload = () => resolve(pdfjsLib);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * 动态加载 pdf-lib
   */
  async loadPDFLib() {
    if (typeof PDFLib !== 'undefined') {
      return PDFLib;
    }
    // 浏览器环境从 CDN 加载
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js';
      script.onload = () => resolve(PDFLib);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * 获取 PDF 总页数
   * @returns {number} 页数
   */
  getPageCount() {
    return this.pdfDoc ? this.pdfDoc.numPages : 0;
  }

  /**
   * 跳转到指定页
   * @param {number} pageNum - 页码（从 1 开始）
   * @throws {Error} 页码超出范围
   */
  goToPage(pageNum) {
    const pageCount = this.getPageCount();
    if (pageNum < 1 || pageNum > pageCount) {
      throw new Error(`页码超出范围 (1-${pageCount})`);
    }
    this.currentPage = pageNum;
  }

  /**
   * 下一页
   */
  nextPage() {
    const pageCount = this.getPageCount();
    if (this.currentPage < pageCount) {
      this.currentPage++;
    }
  }

  /**
   * 上一页
   */
  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  /**
   * 渲染当前页到 Canvas
   * @param {HTMLCanvasElement} canvas - Canvas 元素
   * @returns {Promise<void>}
   */
  async renderPage(canvas) {
    if (!this.pdfDoc) {
      throw new Error('请先加载 PDF 文件');
    }

    const page = await this.pdfDoc.getPage(this.currentPage);
    const viewport = page.getViewport({ scale: 1.5 }); // 高清渲染

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width / 1.5}px`;
    canvas.style.height = `${viewport.height / 1.5}px`;

    const renderContext = {
      canvasContext: canvas.getContext('2d'),
      viewport: viewport
    };

    await page.render(renderContext).promise;
  }

  /**
   * 添加印章到指定页面
   * @param {string} stampImageBase64 - 印章 Base64 图片
   * @param {Object} position - 印章位置信息
   * @param {number} position.page - 页码
   * @param {number} position.x - X 坐标（像素）
   * @param {number} position.y - Y 坐标（像素）
   * @param {number} position.width - 宽度（像素）
   * @param {number} position.height - 高度（像素）
   * @returns {Promise<void>}
   */
  async addStampToPage(stampImageBase64, position) {
    if (!this.pdfLibDoc) {
      throw new Error('PDF 文档未加载');
    }

    // 保存印章位置
    this.stampPositions.push({
      ...position,
      image: stampImageBase64
    });

    // 注意：实际的印章嵌入在导出时统一处理
    // 这里只记录位置，预览时在 Canvas 上绘制
  }

  /**
   * 获取印章图层顺序
   * @returns {string} 图层顺序
   */
  getStampLayerOrder() {
    return 'top'; // 印章始终在最上层
  }

  /**
   * 导出盖章后的 PDF
   * @returns {Promise<Uint8Array>} PDF 二进制数据
   */
  async exportPDF() {
    if (!this.pdfLibDoc) {
      throw new Error('PDF 文档未加载');
    }

    const PDFLib = await this.loadPDFLib();

    // 从原始文件重新加载 pdfLibDoc，避免多次导出时印章叠加
    const freshBytes = new Uint8Array(this.originalBytes.byteLength);
    freshBytes.set(this.originalBytes);
    this.pdfLibDoc = await PDFLib.PDFDocument.load(freshBytes);

    // 如果有印章，嵌入到 PDF
    if (this.stampPositions.length > 0) {

      // 计算 CSS 画布与 PDF 坐标之间的转换比例
      // 使用 pdf.js viewport 在 scale=1 时的尺寸作为 CSS 基准
      const firstPage = await this.pdfDoc.getPage(1);
      const viewport = firstPage.getViewport({ scale: 1 });
      const cssPageWidth = viewport.width;
      const cssPageHeight = viewport.height;

      for (const stampPos of this.stampPositions) {
        // 解码 Base64 图片
        const imageBytes = this.base64ToBytes(stampPos.image);
        const pngImage = await this.pdfLibDoc.embedPng(imageBytes);

        // 获取页面（pdf-lib 页码从 0 开始）
        const pages = this.pdfLibDoc.getPages();
        const page = pages[stampPos.page - 1];

        if (page) {
          const pdfPageWidth = page.getWidth();
          const pdfPageHeight = page.getHeight();

          // CSS 坐标 → PDF 坐标（等比例换算）
          const scaleX = pdfPageWidth / cssPageWidth;
          const scaleY = pdfPageHeight / cssPageHeight;

          const pdfWidth = stampPos.width * scaleX;
          const pdfHeight = stampPos.height * scaleY;
          const pdfX = stampPos.x * scaleX;
          // PDF 坐标系原点在左下角，需要 Y 轴翻转
          const pdfY = pdfPageHeight - stampPos.y * scaleY - pdfHeight;

          page.drawImage(pngImage, {
            x: pdfX,
            y: pdfY,
            width: pdfWidth,
            height: pdfHeight
          });
        }
      }
    }

    return await this.pdfLibDoc.save();
  }

  /**
   * Base64 转字节数组
   * @param {string} base64 - Base64 字符串
   * @returns {Uint8Array} 字节数组
   */
  base64ToBytes(base64) {
    const base64Data = base64.replace(/^data:image\/png;base64,/, '');
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * 下载导出的 PDF
   * @param {Uint8Array} pdfBytes - PDF 二进制数据
   * @param {string} fileName - 文件名
   */
  downloadPDF(pdfBytes, fileName) {
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * 重置文档
   */
  reset() {
    this.pdfDoc = null;
    this.pdfLibDoc = null;
    this.currentPage = 1;
    this.originalBytes = null;
    this.stampPositions = [];
  }
}
