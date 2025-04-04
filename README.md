# 二合一 ID 卡 PDF 生成网页

一个二合一 ID 卡 PDF 生成网页，主要用于将从扫描仪得到的身份证正反面分两页 PDF 文件合并成一页。使用 TypeScript 和 Vite 构建。

## 功能特点

- 基于浏览器的 PDF 处理，无需服务器
- 使用 Entropy Cropping 自动识别并裁剪身份证边界
- 支持自定义裁剪参数和排版位置
- 实时预览功能，方便调整
- 拖拽上传支持
- 使用 TypeScript 实现，具有类型安全
- 使用 Vite 构建，快速开发和构建体验

## 技术栈

- TypeScript: 强类型的 JavaScript 超集
- Vite: 现代前端构建工具
- MuPDF.js: 处理 PDF 文件和提取图像
- Tailwind CSS: 实现响应式 UI

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 使用说明

1. 打开网页，您将看到上传区域
2. 单击上传区域或将 PDF 文件拖拽到上传区域
3. 上传后，系统会自动处理 PDF 文件并提取前两页图像
4. 预览区域会实时显示裁剪后的效果和最终页面布局
5. 满意后，点击 "生成 PDF" 按钮生成最终文件