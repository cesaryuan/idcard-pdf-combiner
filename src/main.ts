import './style.css'
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
    function handleFileSelect(file: File) {
        ui.showStatus('Loading PDF...', 'info', true)
        
        pdfProcessor.processPdf(file)
            .then(() => {
                ui.showStatus('PDF processed successfully.', 'success')
                ui.enableGenerateButton()
                handlePreviewUpdate()
            })
            .catch((error: Error) => {
                console.error('Error processing PDF:', error)
                ui.showStatus(`Failed to process PDF: ${error.message}`, 'error')
            })
    }
    
    /**
     * Handle preview update when settings change
     */
    function handlePreviewUpdate() {
        const settings = ui.getSettings()
        
        if (!pdfProcessor.hasImages()) {
            return
        }
        
        try {
            const { frontImage, backImage } = pdfProcessor.getImages()
            const { threshold, padding } = settings
            
            // Crop images using entropy cropping
            const croppedFront = entropyCropper.cropImage(frontImage, threshold, padding)
            const croppedBack = entropyCropper.cropImage(backImage, threshold, padding)
            
            // Update processor with cropped images
            pdfProcessor.setCroppedImages(croppedFront, croppedBack)
            
            // Update UI with cropped images
            ui.updateImagePreviews(croppedFront, croppedBack)
            setTimeout(() => {
                ui.updateCombinedPreview(croppedFront, croppedBack, settings.frontOffset, settings.backOffset)
            }, 0)
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
            
            // Update download button
            ui.setupDownloadButton(outputUrl)
            ui.showStatus('PDF generated successfully.', 'success')
        } catch (error) {
            console.error('Error generating PDF:', error)
            ui.showStatus('Failed to generate PDF.', 'error')
        }
    }
}
