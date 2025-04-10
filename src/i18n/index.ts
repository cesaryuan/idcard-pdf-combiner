import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Define translations directly
const resources = {
  en: {
    translation: {
      // Header
      "app_title": "ID Card PDF Merger",
      "app_description": "Merge front and back ID card PDF pages into a single document",
      
      // Upload section
      "upload_title": "Upload PDF",
      "upload_instructions": "Click to upload or drag and drop",
      "upload_description": "PDF with ID card front and back (2 pages)",
      
      // Settings section
      "settings_title": "Settings",
      "entropy_section_title": "Entropy Cropping Settings",
      "threshold_label": "Threshold",
      "padding_label": "Padding (px)",
      
      // Placement settings
      "placement_section_title": "Placement Settings",
      "front_offset_label": "Front ID Vertical Offset (%)",
      "back_offset_label": "Back ID Vertical Offset (%)",
      "position_top": "0% (Top)",
      "position_center_top": "25%",
      "position_center": "50% (Center)",
      "position_center_bottom": "75%",
      "position_bottom": "100% (Bottom)",
      
      // Rotation settings
      "rotation_section_title": "Rotation Settings",
      "front_rotation_label": "Front ID Rotation (°)",
      "back_rotation_label": "Back ID Rotation (°)",
      
      // Preview section
      "preview_title": "Preview",
      "front_preview_title": "Front ID (Cropped)",
      "back_preview_title": "Back ID (Cropped)",
      "combined_preview_title": "Combined Output Preview",
      "preview_placeholder": "Upload a PDF to preview",
      "combined_preview_placeholder": "Upload a PDF to preview combined output",
      
      // Buttons
      "generate_button": "Generate PDF",
      "download_button": "Download PDF",
      
      // Status messages
      "status_loading": "First use requires loading the model, please be patient...",
      "status_ready": "Model loaded, ready to use!",
      "status_loading_pdf": "Loading PDF...",
      "status_pdf_processed": "PDF processed successfully.",
      "status_failed_process": "Failed to process PDF: {{error}}",
      "status_failed_preview": "Failed to update preview.",
      "status_generating_pdf": "Generating PDF...",
      "status_cropping_images_front": "Cropping front image...",
      "status_cropping_images_back": "Cropping back image...",
      "status_updating_image_previews": "Updating image previews...",
      "status_finished": "Operation completed, click the button below to download the PDF",
      "status_pdf_generated": "PDF generated successfully.",
      "status_failed_generate": "Failed to generate PDF: {{error}}",
      "status_upload_pdf": "Please upload a PDF file.",
    }
  },
  zh: {
    translation: {
      // Header
      "app_title": "身份证 PDF 合并器",
      "app_description": "将身份证正反面 PDF 页面合并成单个文档",
      
      // Upload section
      "upload_title": "上传 PDF",
      "upload_instructions": "点击上传或拖放文件",
      "upload_description": "包含身份证正反面的 PDF（2 页）",
      
      // Settings section
      "settings_title": "设置",
      "entropy_section_title": "熵裁剪设置",
      "threshold_label": "阈值",
      "padding_label": "边距（像素）",
      
      // Placement settings
      "placement_section_title": "位置设置",
      "front_offset_label": "正面身份证垂直偏移（%）",
      "back_offset_label": "背面身份证垂直偏移（%）",
      "position_top": "0%（顶部）",
      "position_center_top": "25%",
      "position_center": "50%（中间）",
      "position_center_bottom": "75%",
      "position_bottom": "100%（底部）",
      
      // Rotation settings
      "rotation_section_title": "旋转设置",
      "front_rotation_label": "正面身份证旋转角度（°）",
      "back_rotation_label": "背面身份证旋转角度（°）",
      
      // Preview section
      "preview_title": "预览",
      "front_preview_title": "正面身份证（已裁剪）",
      "back_preview_title": "背面身份证（已裁剪）",
      "combined_preview_title": "合并输出预览",
      "preview_placeholder": "上传 PDF 以预览",
      "combined_preview_placeholder": "上传 PDF 以预览合并输出",
      
      // Buttons
      "generate_button": "生成 PDF",
      "download_button": "下载 PDF",
      
      // Status messages
      "status_loading": "加载模型中，请耐心等待...",
      "status_ready": "模型加载完成，可以使用啦！",
      "status_loading_pdf": "正在加载 PDF...",
      "status_pdf_processed": "PDF 处理成功。",
      "status_failed_process": "处理 PDF 失败：{{error}}",
      "status_failed_preview": "更新预览失败。",
      "status_generating_pdf": "正在生成 PDF...",
      "status_cropping_images_front": "正在裁剪正面图像...",
      "status_cropping_images_back": "正在裁剪背面图像...",
      "status_updating_image_previews": "正在更新图像预览...",
      "status_finished": "操作完成，点击下方按钮下载 PDF",
      "status_pdf_generated": "PDF 生成成功。",
      "status_failed_generate": "生成 PDF 失败：{{error}}",
      "status_upload_pdf": "请上传 PDF 文件。"
    }
  }
};

i18n
  .use(LanguageDetector)
  .init({
    resources,
    fallbackLng: 'en',
    detection: {
      order: ['navigator', 'htmlTag', 'path', 'localStorage'],
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false
    }
  });

export default i18n; 