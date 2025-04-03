/**
 * UI Controller for ID Card PDF Merger
 * Handles all UI-related functionality and DOM interactions
 */

type StatusType = 'info' | 'success' | 'error';
type Settings = {
    threshold: number;
    padding: number;
    frontOffset: number;
    backOffset: number;
};

export class UIController {
    // DOM Elements
    private dropzone: HTMLElement | null;
    private pdfInput: HTMLInputElement | null;
    private uploadStatus: HTMLElement | null;
    private frontPreview: HTMLElement | null;
    private backPreview: HTMLElement | null;
    private combinedPreview: HTMLElement | null;
    private generateButton: HTMLButtonElement | null;
    private downloadButton: HTMLAnchorElement | null;
    private thresholdInput: HTMLInputElement | null;
    private paddingInput: HTMLInputElement | null;
    private frontOffsetInput: HTMLInputElement | null;
    private backOffsetInput: HTMLInputElement | null;
    
    // A4 paper dimensions at 72 DPI (inches)
    private a4Width = 8.27;
    private a4Height = 11.69;
    
    // Default debounce timeout (ms)
    private debounceTimeout = 300;
    private debounceTimers: Record<string, number> = {};
    
    constructor() {
        // DOM Elements
        this.dropzone = document.getElementById('dropzone');
        this.pdfInput = document.getElementById('pdfInput') as HTMLInputElement;
        this.uploadStatus = document.getElementById('uploadStatus');
        this.frontPreview = document.getElementById('frontPreview');
        this.backPreview = document.getElementById('backPreview');
        this.combinedPreview = document.getElementById('combinedPreview');
        this.generateButton = document.getElementById('generateButton') as HTMLButtonElement;
        this.downloadButton = document.getElementById('downloadButton') as HTMLAnchorElement;
        this.thresholdInput = document.getElementById('threshold') as HTMLInputElement;
        this.paddingInput = document.getElementById('padding') as HTMLInputElement;
        this.frontOffsetInput = document.getElementById('frontOffset') as HTMLInputElement;
        this.backOffsetInput = document.getElementById('backOffset') as HTMLInputElement;
    }
    
    /**
     * Helper function to debounce function calls
     * @param {Function} fn - The function to debounce
     * @param {string} id - Identifier for this debounce instance
     * @param {number} timeout - Debounce timeout in milliseconds
     * @returns {Function} The debounced function
     */
    private debounce(fn: () => void, id: string, timeout: number = this.debounceTimeout): void {
        // Clear the existing timer if there is one
        if (this.debounceTimers[id]) {
            window.clearTimeout(this.debounceTimers[id]);
        }
        
        // Set a new timer
        this.debounceTimers[id] = window.setTimeout(() => {
            fn();
            delete this.debounceTimers[id];
        }, timeout);
    }
    
    /**
     * Set up all event listeners
     * @param {Function} handleFileSelect - Callback for file selection
     * @param {Function} handlePreviewUpdate - Callback for preview updates
     * @param {Function} handleGeneratePDF - Callback for PDF generation
     */
    setupEventListeners(
        handleFileSelect: (file: File) => void,
        handlePreviewUpdate: () => void,
        handleGeneratePDF: () => void
    ): void {
        if (this.pdfInput) {
            this.pdfInput.addEventListener('change', (event) => {
                const input = event.target as HTMLInputElement;
                if (!input || !input.files) return;
                
                const file = input.files[0];
                if (file && file.type === 'application/pdf') {
                    handleFileSelect(file);
                }
            });
        }
        
        if (this.dropzone) {
            this.dropzone.addEventListener('dragover', this.handleDragOver.bind(this));
            this.dropzone.addEventListener('dragleave', this.handleDragLeave.bind(this));
            this.dropzone.addEventListener('drop', (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (this.dropzone) {
                    this.dropzone.classList.remove('dragover');
                }
                
                const dataTransfer = event.dataTransfer;
                if (!dataTransfer) return;
                
                const file = dataTransfer.files[0];
                if (file && file.type === 'application/pdf') {
                    if (this.pdfInput) {
                        // Some browsers don't allow setting files directly
                        // We can't set dataTransfer.files to input.files directly
                        // So we'll just proceed with the file
                    }
                    handleFileSelect(file);
                } else {
                    this.showStatus('Please upload a PDF file.', 'error');
                }
            });
        }
        
        // Settings change listeners
        if (this.thresholdInput) {
            this.thresholdInput.addEventListener('input', () => {
                this.debounce(handlePreviewUpdate, 'threshold');
            });
        }
        
        if (this.paddingInput) {
            this.paddingInput.addEventListener('input', () => {
                this.debounce(handlePreviewUpdate, 'padding');
            });
        }
        
        if (this.frontOffsetInput) {
            this.frontOffsetInput.addEventListener('input', () => {
                this.debounce(handlePreviewUpdate, 'frontOffset');
            });
        }
        
        if (this.backOffsetInput) {
            this.backOffsetInput.addEventListener('input', () => {
                this.debounce(handlePreviewUpdate, 'backOffset');
            });
        }
        
        // Generate PDF button listener
        if (this.generateButton) {
            this.generateButton.addEventListener('click', () => handleGeneratePDF());
        }
    }
    
    /**
     * Handle drag over event
     * @param {DragEvent} event - The drag event
     */
    handleDragOver(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        if (this.dropzone) {
            this.dropzone.classList.add('dragover');
        }
    }
    
    /**
     * Handle drag leave event
     * @param {DragEvent} event - The drag event
     */
    handleDragLeave(event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        if (this.dropzone) {
            this.dropzone.classList.remove('dragover');
        }
    }
    
    /**
     * Get all current settings from UI inputs
     * @return {Settings} The current settings
     */
    getSettings(): Settings {
        const threshold = parseFloat(this.thresholdInput ? this.thresholdInput.value : '0.5');
        const padding = parseInt(this.paddingInput ? this.paddingInput.value : '5', 10);
        const frontOffset = parseInt(this.frontOffsetInput ? this.frontOffsetInput.value : '30', 10);
        const backOffset = parseInt(this.backOffsetInput ? this.backOffsetInput.value : '70', 10);
        
        return {
            threshold,
            padding,
            frontOffset,
            backOffset
        };
    }
    
    /**
     * Update the front and back image previews
     * @param {HTMLImageElement} frontImage - The cropped front image canvas
     * @param {HTMLImageElement} backImage - The cropped back image canvas
     */
    updateImagePreviews(frontImage: HTMLImageElement, backImage: HTMLImageElement): void {
        if (this.frontPreview) {
            this.frontPreview.innerHTML = '';
            frontImage.style.maxWidth = '100%';
            frontImage.style.maxHeight = '100%';
            frontImage.style.objectFit = 'contain';
            this.frontPreview.appendChild(frontImage);
        }
        
        if (this.backPreview) {
            this.backPreview.innerHTML = '';
            backImage.style.maxWidth = '100%';
            backImage.style.maxHeight = '100%';
            backImage.style.objectFit = 'contain';
            this.backPreview.appendChild(backImage);
        }
    }
    
    /**
     * Update the combined preview showing both images on A4
     * @param {HTMLImageElement} frontImage - The cropped front image canvas
     * @param {HTMLImageElement} backImage - The cropped back image canvas
     * @param {number} frontOffset - Vertical position of front image (0-50%)
     * @param {number} backOffset - Vertical position of back image (50-100%)
     */
    updateCombinedPreview(
        frontImage: HTMLImageElement,
        backImage: HTMLImageElement,
        frontOffset: number,
        backOffset: number
    ): void {
        if (!this.combinedPreview) return;
        const ctxWidth = this.a4Width * frontImage.dpi;
        const ctxHeight = this.a4Height * frontImage.dpi;
        
        // Create canvas for preview
        const canvas = document.createElement('canvas');
        canvas.width = ctxWidth;
        canvas.height = ctxHeight;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Draw white background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Calculate positions
        const frontY = (ctxHeight * frontOffset / 100) - (frontImage.naturalHeight / 2);
        const backY = (ctxHeight * backOffset / 100) - (backImage.naturalHeight / 2);
        
        // Draw front image centered horizontally
        const frontX = (ctxWidth - frontImage.naturalWidth) / 2;
        ctx.drawImage(frontImage, frontX, frontY, frontImage.naturalWidth, frontImage.naturalHeight);
        
        // Draw back image centered horizontally
        const backX = (ctxWidth - backImage.naturalWidth) / 2;
        ctx.drawImage(backImage, backX, backY, backImage.naturalWidth, backImage.naturalHeight);
        
        // Update preview
        this.combinedPreview.innerHTML = '';
        canvas.style.maxWidth = '100%';
        canvas.style.maxHeight = '100%';
        canvas.style.objectFit = 'contain';
        this.combinedPreview.appendChild(canvas);
    }
    
    /**
     * Enable the generate button
     */
    enableGenerateButton(): void {
        if (this.generateButton) {
            this.generateButton.disabled = false;
        }
    }
    
    /**
     * Set up the download button with the PDF URL
     * @param {string} pdfUrl - The URL for the generated PDF
     */
    setupDownloadButton(pdfUrl: string): void {
        if (this.downloadButton) {
            this.downloadButton.href = pdfUrl;
            this.downloadButton.download = 'ID_Card_Combined.pdf';
            this.downloadButton.classList.remove('hidden');
        }
    }
    
    /**
     * Automatically download the PDF
     * @param {string} pdfUrl - The URL for the generated PDF
     */
    downloadPdf(pdfUrl: string): void {
        // Create a temporary anchor element
        const link = document.createElement('a');
        link.href = pdfUrl;
        link.download = 'ID_Card_Combined.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
    /**
     * Show status message
     * @param {string} message - The message to display
     * @param {StatusType} type - The type of message ('info', 'success', 'error')
     * @param {boolean} loading - Whether to show loading spinner
     */
    showStatus(message: string, type: StatusType, loading: boolean = false): void {
        if (!this.uploadStatus) return;
        
        this.uploadStatus.className = 'mt-2 text-sm';
        this.uploadStatus.classList.add(`status-${type}`);
        
        this.uploadStatus.innerHTML = loading 
            ? `<span class="spinner"></span>${message}` 
            : message;
        
        this.uploadStatus.classList.remove('hidden');
        
        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(() => {
                if (this.uploadStatus) {
                    this.uploadStatus.classList.add('hidden');
                }
            }, 5000);
        }
    }
} 