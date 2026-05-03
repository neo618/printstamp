/**
 * 印章尺寸计算器
 * 负责毫米与像素转换、A4 纸张比例适配
 */

export class StampSizeCalculator {
  // A4 纸张尺寸（毫米）
  static A4_WIDTH_MM = 210;
  static A4_HEIGHT_MM = 297;

  // 支持的印章尺寸（毫米）
  static VALID_SIZES = [38, 40, 42];

  // 自定义尺寸范围
  static MIN_CUSTOM_SIZE = 20;
  static MAX_CUSTOM_SIZE = 100;

  // 默认尺寸
  static DEFAULT_SIZE_MM = 40;

  // 默认 DPI
  static DEFAULT_DPI = 96;

  /**
   * 毫米转像素
   * @param {number} mm - 毫米值
   * @param {number} dpi - DPI，默认 96
   * @returns {number} 像素值
   */
  static mmToPixels(mm, dpi = this.DEFAULT_DPI) {
    return Math.round((mm / 25.4) * dpi);
  }

  /**
   * 像素转毫米
   * @param {number} pixels - 像素值
   * @param {number} dpi - DPI
   * @returns {number} 毫米值
   */
  static pixelsToMm(pixels, dpi = this.DEFAULT_DPI) {
    return (pixels * 25.4) / dpi;
  }

  /**
   * 验证尺寸是否支持
   * @param {number} size - 尺寸（毫米）
   * @param {boolean} allowCustom - 是否允许自定义尺寸
   * @throws {Error} 不支持的尺寸
   */
  static validateSize(size, allowCustom = false) {
    if (this.VALID_SIZES.includes(size)) return;
    if (allowCustom && size >= this.MIN_CUSTOM_SIZE && size <= this.MAX_CUSTOM_SIZE) return;
    throw new Error(`尺寸 ${size}mm 超出允许范围（${this.MIN_CUSTOM_SIZE}-${this.MAX_CUSTOM_SIZE}mm）`);
  }

  /**
   * 获取 A4 纸张尺寸
   * @returns {{width: number, height: number}} A4 尺寸（毫米）
   */
  static getA4SizeMM() {
    return {
      width: this.A4_WIDTH_MM,
      height: this.A4_HEIGHT_MM
    };
  }

  /**
   * 计算印章占 A4 纸张宽度的百分比
   * @param {number} stampMm - 印章尺寸（毫米）
   * @param {number} paperWidthMm - 纸张宽度（毫米）
   * @returns {number} 百分比
   */
  static getStampPercentage(stampMm, paperWidthMm = this.A4_WIDTH_MM) {
    return (stampMm / paperWidthMm) * 100;
  }

  /**
   * 获取默认印章尺寸
   * @returns {number} 默认尺寸（毫米）
   */
  static getDefaultSize() {
    return this.DEFAULT_SIZE_MM;
  }

  /**
   * 获取所有支持的尺寸
   * @returns {number[]} 尺寸数组
   */
  static getSupportedSizes() {
    return [...this.VALID_SIZES];
  }

  /**
   * 根据 A4 纸张计算印章在 Canvas 上的像素尺寸
   * @param {number} sizeMm - 印章尺寸（毫米）
   * @param {number} canvasWidth - Canvas 宽度（像素）
   * @param {number} a4WidthMm - A4 宽度（毫米）
   * @returns {number} 印章像素尺寸
   */
  static calculateStampPixels(sizeMm, canvasWidth, a4WidthMm = this.A4_WIDTH_MM) {
    const ratio = sizeMm / a4WidthMm;
    return Math.round(canvasWidth * ratio);
  }
}
