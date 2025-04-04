/**
 * UI Controller for ID Card PDF Merger
 * Handles all UI-related functionality and DOM interactions
 */
import { getImageFromBlob } from './utils';
import i18n from './i18n';

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
        
        // Initialize the translations
        this.initializeTranslations();
    }
    
    /**
     * Initialize translations for the UI
     */
    private initializeTranslations(): void {
        // Update the document title
        document.title = i18n.t('app_title');
        
        // Apply translations to all elements with data-i18n attribute
        this.updateTranslations();
        
        // Add translation change event listener
        i18n.on('languageChanged', () => {
            this.updateTranslations();
        });
    }
    
    /**
     * Update all translations in the UI
     */
    private updateTranslations(): void {
        document.title = i18n.t('app_title');
        
        const elements = document.querySelectorAll('[data-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) {
                if (el.tagName === 'INPUT' && (el as HTMLInputElement).placeholder) {
                    (el as HTMLInputElement).placeholder = i18n.t(key);
                } else {
                    el.textContent = i18n.t(key);
                }
            }
        });
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
            this.generateButton.addEventListener('click', handleGeneratePDF);
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
     * @param frontImage - The cropped front image
     * @param backImage - The cropped back image
     */
    async updateImagePreviews(frontImage: ImageWithDPI, backImage: ImageWithDPI): Promise<void> {
        if (this.frontPreview) {
            const img = await getImageFromBlob(frontImage.blob);
            this.frontPreview.innerHTML = '';
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            img.style.objectFit = 'contain';
            this.frontPreview.appendChild(img);
        }
        
        if (this.backPreview) {
            const img = await getImageFromBlob(backImage.blob);
            this.backPreview.innerHTML = '';
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            img.style.objectFit = 'contain';
            this.backPreview.appendChild(img);
        }
    }
    
    /**
     * Update the combined preview showing both images on A4
     * @param {ImageWithDPI} frontImage - The cropped front image
     * @param {ImageWithDPI} backImage - The cropped back image
     * @param {number} frontOffset - Vertical position of front image (0-50%)
     * @param {number} backOffset - Vertical position of back image (50-100%)
     */
    async updateCombinedPreview(
        frontImage: ImageWithDPI,
        backImage: ImageWithDPI,
        frontOffset: number,
        backOffset: number
    ): Promise<void> {
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
        const frontY = (ctxHeight * frontOffset / 100) - (frontImage.height / 2);
        const backY = (ctxHeight * backOffset / 100) - (backImage.height / 2);
        
        // Draw front image centered horizontally
        const frontX = (ctxWidth - frontImage.width) / 2;
        ctx.drawImage(await window.createImageBitmap(frontImage.blob), frontX, frontY, frontImage.width, frontImage.height);
        
        // Draw back image centered horizontally
        const backX = (ctxWidth - backImage.width) / 2;
        ctx.drawImage(await window.createImageBitmap(backImage.blob), backX, backY, backImage.width, backImage.height);
        
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
     * Show a status message to the user
     * @param {string} message - The message to display
     * @param {StatusType} type - The type of status message (info, success, error)
     * @param {boolean} isLoading - Whether this is a loading message
     */
    showStatus(message: string, type: StatusType = 'info', isLoading: boolean = false): void {
        // Translate status messages if they match keys
        let translatedMessage = message;
        
        // Handle status messages with error interpolation
        if (message.includes('Failed to process PDF:')) {
            const error = message.replace('Failed to process PDF:', '').trim();
            translatedMessage = i18n.t('status_failed_process', { error });
        } else {
            // Try to find a direct translation key
            const statusKeys = [
                'status_loading_pdf',
                'status_pdf_processed',
                'status_failed_preview',
                'status_generating_pdf',
                'status_pdf_generated',
                'status_failed_generation',
                'status_upload_pdf'
            ];
            
            for (const key of statusKeys) {
                if (message === i18n.t(key, { lng: 'en' })) {
                    translatedMessage = i18n.t(key);
                    break;
                }
            }
        }
        
        if (!this.uploadStatus) return;
        
        this.uploadStatus.textContent = translatedMessage;
        this.uploadStatus.className = `mt-2 text-sm ${type === 'error' ? 'text-red-500' : type === 'success' ? 'text-green-500' : 'text-blue-500'}`;
        
        if (isLoading) {
            // Add a loading indicator or animation here if needed
            this.uploadStatus.classList.add('loading');
        } else {
            this.uploadStatus.classList.remove('loading');
        }
        
        this.uploadStatus.classList.remove('hidden');
        
        // Hide the status after a delay for success messages
        if (type === 'success') {
            setTimeout(() => {
                if (this.uploadStatus) {
                    this.uploadStatus.classList.add('hidden');
                }
            }, 3000);
        }
    }
} 