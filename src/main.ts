import './style.css'
import i18n from './i18n'
import { IDCardImageProcessor } from './image-processor'
import { PDFProcessor } from './pdf-processor'
import { UIController } from './ui-controller'

/**
 * Handle file selection
 * @param {File} file - The selected PDF file
 */
async function handleFileSelect(file: File) {
    ui.showStatus('Loading PDF...', 'info', true)
    
    try {
        await pdfProcessor.extractImagesFromPdf(file);
        // ui.showStatus('PDF processed successfully.', 'success')
        ui.enableGenerateButton()
        await handlePreviewUpdate()
    } catch (error) {
        console.error('Error processing PDF:', error)
        ui.showStatus(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    }
}

/**
 * Handle preview update when settings change
 */
async function handlePreviewUpdate() {
    const settings = ui.getSettings()
    
    if (!pdfProcessor.hasImages()) {
        return
    }
    
    try {
        const { frontImage, backImage } = pdfProcessor.getImages()
        const { threshold, padding, frontRotation, backRotation } = settings
        
        // Crop images using entropy cropping
        ui.showStatus(i18n.t('status_cropping_images_front'), 'info', true)
        const croppedFront = await idCardImageProcessor.rotateAndCropImage(frontImage, { 
            threshold, 
            padding, 
            rotation: frontRotation 
        })
        ui.showStatus(i18n.t('status_cropping_images_back'), 'info', true)
        const croppedBack = await idCardImageProcessor.rotateAndCropImage(backImage, { 
            threshold, 
            padding, 
            rotation: backRotation })
        
        // Update processor with cropped images
        pdfProcessor.setCroppedImages(croppedFront, croppedBack)
        
        // Update UI with cropped images
        ui.showStatus(i18n.t('status_updating_image_previews'), 'info', true)
        ui.updateImagePreviews(croppedFront, croppedBack)
        ui.updateCombinedPreview(croppedFront, croppedBack, settings.frontOffset, settings.backOffset)
        ui.showStatus(i18n.t('status_finished'), 'success')
    } catch (error) {
        console.error('Error updating preview:', error)
        ui.showStatus('Failed to update preview.', 'error')
    }
}

/**
 * Handle PDF generation
 */
async function handleGeneratePDF() {
    if (!pdfProcessor.hasCroppedImages()) {
        return
    }
    
    ui.showStatus('Generating PDF...', 'info', true)
    
    try {
        const settings = ui.getSettings()
        const { frontOffset, backOffset } = settings
        const { croppedFront, croppedBack } = pdfProcessor.getCroppedImages()
        
        // Generate PDF
        const outputUrl = await pdfProcessor.generatePdf(croppedFront, croppedBack, frontOffset, backOffset)
        
        // Auto download PDF
        ui.downloadPdf(outputUrl)
        ui.showStatus('PDF generated successfully.', 'success')
    } catch (error) {
        console.error('Error generating PDF:', error)
        ui.showStatus('Failed to generate PDF.', 'error')
    }
}

// Initialize the application
const ui = new UIController()
const idCardImageProcessor = new IDCardImageProcessor()
const pdfProcessor = new PDFProcessor()
// Set up event listeners
ui.setupEventListeners(
    handleFileSelect,
    handlePreviewUpdate,
    handleGeneratePDF
);

// Don't use top level await in main.ts, it will cause deadlocks
// See: https://github.com/vitejs/vite/issues/19811
// See: https://github.com/nodejs/node/issues/55468#issuecomment-2425582806
(async () => {
    ui.showStatus(i18n.t('status_loading'), 'info', true)
    await Promise.all([
        idCardImageProcessor.init(),
        pdfProcessor.init()
    ]);
    ui.showStatus(i18n.t('status_ready'), 'success')
})();

