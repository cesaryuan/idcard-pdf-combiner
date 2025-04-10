use wasm_bindgen::prelude::*;
use web_sys::ImageData;

// 导入JavaScript的Web API函数，用于控制台日志
#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
}

// 辅助宏，用于方便地打印日志
macro_rules! console_log {
    ($($t:tt)*) => (log(&format!($($t)*)))
}

/// 计算图像熵值
/// 
/// 接收一个ImageData对象，计算并返回熵值
#[wasm_bindgen]
pub fn calculate_entropy(image_data: &ImageData) -> f64 {
    let width = image_data.width() as usize;
    let height = image_data.height() as usize;
    let data = image_data.data();
    let total_pixels = width * height;

    // 创建直方图数组
    let mut histogram = [0u32; 256];
    
    // 填充直方图
    for i in (0..data.len()).step_by(4) {
        if i + 2 < data.len() {
            let r = data[i] as u32;
            let g = data[i + 1] as u32;
            let b = data[i + 2] as u32;
            
            // 使用位运算加速灰度计算 (近似 r*0.299 + g*0.587 + b*0.114)
            let gray = ((r * 76 + g * 150 + b * 30) >> 8) as usize;
            histogram[gray] += 1;
        }
    }
    
    // 计算熵
    let mut entropy = 0.0;
    for count in histogram.iter() {
        if *count > 0 {
            let probability = *count as f64 / total_pixels as f64;
            entropy -= probability * probability.log2();
        }
    }
    
    entropy
}

/// 使用降采样技术计算图像熵值
/// 
/// 接收ImageData和采样率参数，以加速大图像的熵计算
#[wasm_bindgen]
pub fn calculate_entropy_downsampled(image_data: &ImageData, sample_rate: u32) -> f64 {
    let width = image_data.width() as usize;
    let height = image_data.height() as usize;
    let data = image_data.data();
    let sample_rate = sample_rate as usize;
    
    if sample_rate <= 1 {
        return calculate_entropy(image_data);
    }
    
    // 创建直方图数组
    let mut histogram = [0u32; 256];
    let mut sample_count = 0;
    
    // 使用降采样填充直方图
    for y in (0..height).step_by(sample_rate) {
        for x in (0..width).step_by(sample_rate) {
            let i = (y * width + x) * 4;
            if i + 2 < data.len() {
                let r = data[i] as u32;
                let g = data[i + 1] as u32;
                let b = data[i + 2] as u32;
                
                let gray = ((r * 76 + g * 150 + b * 30) >> 8) as usize;
                histogram[gray] += 1;
                sample_count += 1;
            }
        }
    }
    
    // 计算熵
    let mut entropy = 0.0;
    for count in histogram.iter() {
        if *count > 0 {
            let probability = *count as f64 / sample_count as f64;
            entropy -= probability * probability.log2();
        }
    }
    
    entropy
}

/// 初始化函数
#[wasm_bindgen(start)]
pub fn start() {
    // 在导入的JavaScript对象上设置panic hook
    std::panic::set_hook(Box::new(console_error_panic_hook::hook));
    console_log!("WASM Entropy Module initialized!");
}

// 错误处理函数，将Rust panic转换为JavaScript错误
#[wasm_bindgen]
pub fn init_panic_hook() {
    console_error_panic_hook::set_once();
}

// 添加控制台错误panic hook依赖
extern crate console_error_panic_hook; 