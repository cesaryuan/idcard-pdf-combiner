import './style.css'
import './i18n' // Import i18n configuration
import { EntropyCropper } from './entropy-crop'
import { PDFProcessor } from './pdf-processor'
import { UIController } from './ui-controller'

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const ui = new UIController()
    const entropyCropper = new EntropyCropper()
    const pdfProcessor = new PDFProcessor()
        
    // Initialize the application with UI controller and PDF processor
    init(ui, pdfProcessor, entropyCropper)
})

/**
 * Initialize the application
 * @param {UIController} ui - The UI controller instance
 * @param {PDFProcessor} pdfProcessor - The PDF processor instance
 * @param {EntropyCropper} entropyCropper - The entropy cropper instance
 */
function init(ui: UIController, pdfProcessor: PDFProcessor, entropyCropper: EntropyCropper) {
    // Set up event listeners
    ui.setupEventListeners(
        handleFileSelect,
        handlePreviewUpdate,
        handleGeneratePDF
    )
    
    /**
     * Handle file selection
     * @param {File} file - The selected PDF file
     */
    async function handleFileSelect(file: File) {
        ui.showStatus('Loading PDF...', 'info', true)
        
        try {
            await pdfProcessor.processPdf(file);
            ui.showStatus('PDF processed successfully.', 'success')
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
            const { threshold, padding } = settings
            
            // Crop images using entropy cropping
            const croppedFront = await entropyCropper.cropImage(frontImage, threshold, padding)
            const croppedBack = await entropyCropper.cropImage(backImage, threshold, padding)
            
            // Update processor with cropped images
            pdfProcessor.setCroppedImages(croppedFront, croppedBack)
            
            // Update UI with cropped images
            ui.updateImagePreviews(croppedFront, croppedBack)
            ui.updateCombinedPreview(croppedFront, croppedBack, settings.frontOffset, settings.backOffset)
        } catch (error) {
            console.error('Error updating preview:', error)
            ui.showStatus('Failed to update preview.', 'error')
        }
    }
    
    /**
     * Handle PDF generation
     */
    function handleGeneratePDF() {
        if (!pdfProcessor.hasCroppedImages()) {
            return
        }
        
        ui.showStatus('Generating PDF...', 'info', true)
        
        try {
            const settings = ui.getSettings()
            const { frontOffset, backOffset } = settings
            const { croppedFront, croppedBack } = pdfProcessor.getCroppedImages()
            
            // Generate PDF
            const outputUrl = pdfProcessor.generatePdf(croppedFront, croppedBack, frontOffset, backOffset)
            
            // Auto download PDF
            // ui.setupDownloadButton(outputUrl)
            ui.downloadPdf(outputUrl)
            ui.showStatus('PDF generated successfully.', 'success')
        } catch (error) {
            console.error('Error generating PDF:', error)
            ui.showStatus('Failed to generate PDF.', 'error')
        }
    }
}
