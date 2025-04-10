# WebAssembly 图像熵计算

NOTE: 实测没有太大提升。

使用 Rust 和 WebAssembly 实现高性能图像熵计算，特别适用于大型图像处理。


## 项目结构

```
entropy-wasm/
├── src/              # 源代码
│   ├── lib.rs        # Rust实现
│   └── entropy.js    # JavaScript接口
├── Cargo.toml        # Rust项目配置
```

## 安装与构建

### 环境需求

- Rust 编译环境
- wasm-pack
- Node.js 和 npm

### 安装步骤

1. 安装 wasm-pack:
   ```
   cargo install wasm-pack
   ```

2. 构建 WebAssembly 模块：
   ```
   wasm-pack build
   ```

## 使用方法

### 在自己的项目中集成

1. 构建 WASM 模块：
   ```
   wasm-pack build
   ```
2. 将生成的 pkg 目录复制到你的项目中

3. 导入并使用：
   ```javascript
   import { initEntropyWasm, calculateEntropy } from './path/to/entropy';
   
   // 初始化
   await initEntropyWasm();
   
   // 获取图像数据
   const canvas = document.getElementById('myCanvas');
   const ctx = canvas.getContext('2d');
   const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
   
   // 计算熵
   const entropy = calculateEntropy(imageData);
   console.log(`图像熵值: ${entropy}`);
   
   // 使用降采样计算更大图像的熵
   const entropyDownsampled = calculateEntropyDownsampled(imageData, 4);
   console.log(`降采样(4x)图像熵值: ${entropyDownsampled}`);
   ```

## 性能表现

在典型的测试场景下，WebAssembly 版本相比原生 JavaScript 可以提供：

- 标准全分辨率模式：约 2-3 倍性能提升
- 降采样模式：约 1.5-2 倍性能提升

具体性能提升取决于图像大小和系统环境。对于非常大的图像，使用降采样方案可以大幅提升性能，同时保持较好的熵值估计。

## 许可证

MIT 