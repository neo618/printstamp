# 📮 PDF 盖章助手

> 纯前端 PDF 电子印章加盖工具，本地安全处理，高清无水印导出

在线使用：https://neo618.github.io/printstamp/

---

## 功能

- 上传透明 PNG 印章图片，保存到本地模板库
- 上传 PDF 文件，在线预览
- 多页翻页浏览，指定页码跳转
- 在任意页面任意位置放置印章，自由拖拽调整
- 印章支持拖拽调整大小（右下角手柄）
- 支持多种尺寸：38mm、40mm、42mm 预设 + 自定义（20-100mm）
- 支持单页面添加多个不同印章
- 支持删除单个印章（悬停 × 按钮或选中后按 Delete 键）
- 高清无水印导出盖章后的 PDF
- 纯前端处理，文件不上传服务器

## 项目结构

```
printstamp/
├── index.html              # 主页面
├── src/
│   ├── app.js              # 主应用逻辑
│   ├── pdf-service.js      # PDF 处理服务
│   ├── stamp-manager.js    # 印章模板管理
│   └── stamp-size-calculator.js  # 尺寸计算器
├── .github/workflows/
│   └── deploy.yml          # GitHub Pages 自动部署
├── package.json
└── README.md
```

## 快速使用

### 方式一：在线使用

访问 https://neo618.github.io/printstamp/

### 方式二：本地运行

```bash
# 安装依赖（用于测试）
npm install

# 启动本地服务器
npx http-server

# 打开浏览器访问 http://localhost:8080
```

## 使用步骤

1. **上传印章**：点击「上传新印章」，选择透明 PNG 图片
2. **上传 PDF**：点击或拖拽 PDF 文件到上传区域
3. **盖章**：选择印章 → 选择尺寸 → 在 PDF 上点击放置 → 拖拽调整位置
4. **导出**：点击「导出盖章 PDF」，自动下载

## 技术栈

| 技术 | 用途 |
|------|------|
| pdf.js | PDF 渲染预览 |
| pdf-lib | PDF 编辑导出 |
| 原生 JS | 核心逻辑 |
| localStorage | 印章模板本地存储 |
| GitHub Actions | 自动部署到 Pages |

## 测试

```bash
npm test
```

## 注意事项

- 仅支持透明底 PNG 格式印章
- 不支持加密 PDF（需先解密）
- 所有文件在浏览器本地处理，不会上传到服务器

## 许可证

MIT License

*最后更新：2026-05-03*
