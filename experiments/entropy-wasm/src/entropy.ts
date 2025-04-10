/**
 * JavaScript 接口，用于加载和使用 Rust 编译的 WebAssembly 模块来计算图像熵
 */

// 导入生成的 WebAssembly 绑定
// 注意：这个 import 路径将取决于 wasm-pack 的输出结构
// 使用 wasm-pack 构建后，路径可能会是 '../pkg/entropy_wasm'
import * as wasm from '../pkg/entropy_wasm.js';

/**
 * 使用 WebAssembly 计算图像熵值
 * @param {ImageData} imageData - 图像数据
 * @returns {number} - 熵值
 */
export function calculateEntropy(imageData: ImageData) {
  // 调用 Rust 实现的熵计算函数
  return wasm.calculate_entropy(imageData);
}

/**
 * 使用 WebAssembly 和降采样计算图像熵值，适用于大图像
 * @param {ImageData} imageData - 图像数据
 * @param {number} sampleRate - 采样率，值越大采样越少
 * @returns {number} - 熵值
 */
export function calculateEntropyDownsampled(imageData: ImageData, sampleRate = 4) {
  // 调用 Rust 实现的降采样熵计算函数
  return wasm.calculate_entropy_downsampled(imageData, sampleRate);
}

/**
 * 异步加载和初始化 WebAssembly 模块
 * @returns {Promise<Object>} 包含熵计算函数的对象
 */
export async function initEntropyWasm() {
  try {
    // 等待 WebAssembly 模块初始化
    if (wasm.start) {
      wasm.start();
      // 确保 WebAssembly 模块已初始化
      wasm.init_panic_hook();
    }
    
    // 返回计算函数
    return {
      calculateEntropy,
      calculateEntropyDownsampled
    };
  } catch (error) {
    console.error('Failed to initialize entropy WASM module:', error);
    throw error;
  }
} 