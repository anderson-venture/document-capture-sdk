// document-capture.js - Main DocumentCapture class
import { CameraManager } from './camera.js';
import { DocumentDetector } from './document-detector.js';
import { ImageProcessor } from './image-processor.js';

export class DocumentCapture {
    constructor(options = {}) {
        this.options = {
            container: options.container || '#cameraVideo',
            onCapture: options.onCapture || null,
            onError: options.onError || null,
            onStatusChange: options.onStatusChange || null,
            width: options.width || 1280,
            height: options.height || 720,
            enableDocumentDetection: options.enableDocumentDetection !== false,
            enhanceImage: options.enhanceImage !== false,
            jpegQuality: options.jpegQuality || 0.9
        };

        this.camera = null;
        this.detector = null;
        this.processor = null;
        this.isInitialized = false;
        
        this.init();
    }

    async init() {
        try {
            this.updateStatus('Initializing document capture...', 'info');
            
            // Initialize camera
            this.camera = new CameraManager({
                width: this.options.width,
                height: this.options.height
            });
            
            const videoElement = document.querySelector(this.options.container);
            if (!videoElement) {
                throw new Error('Video element not found');
            }
            
            await this.camera.initialize(videoElement);
            
            // Initialize detector
            this.detector = new DocumentDetector();
            
            // Wait for OpenCV to load if available
            await this.detector.waitForOpenCV();
            
            // Initialize processor
            this.processor = new ImageProcessor({
                enhanceImage: this.options.enhanceImage,
                jpegQuality: this.options.jpegQuality
            });
            
            this.isInitialized = true;
            this.updateStatus('Document capture initialized', 'success');
            
        } catch (error) {
            this.handleError(`Initialization failed: ${error.message}`);
        }
    }

    async startCamera() {
        if (!this.isInitialized) {
            this.handleError('Document capture not initialized');
            return false;
        }

        try {
            this.updateStatus('Starting camera...', 'info');
            
            const success = await this.camera.start();
            if (success) {
                this.updateStatus('Camera ready - Position your document', 'success');
                return true;
            }
            
            return false;
            
        } catch (error) {
            this.handleError(`Failed to start camera: ${error.message}`);
            return false;
        }
    }

    stopCamera() {
        if (this.camera) {
            this.camera.stop();
            this.updateStatus('Camera stopped', 'info');
        }
    }

    async captureDocument() {
        if (!this.isInitialized) {
            this.handleError('Document capture not initialized');
            return null;
        }

        if (!this.camera.isStreaming()) {
            this.handleError('Camera not started');
            return null;
        }

        try {
            this.updateStatus('Capturing document...', 'info');
            
            // Capture frame from video
            const frameData = await this.processor.captureFrame(this.camera.getVideoElement());
            
            let processedImage = frameData.originalImage;
            let documentBounds = null;
            let perspectiveTransform = null;
            let debugResults = null;
            
            // Perform document detection if enabled
            if (this.options.enableDocumentDetection) {
                const detectionResult = await this.detector.detect(frameData.imageData);
                
                documentBounds = detectionResult.bounds;
                perspectiveTransform = detectionResult.perspectiveTransform;
                debugResults = detectionResult.debugResults;
                
                // Process the image if document was detected
                if (documentBounds) {
                    processedImage = await this.processor.cropAndEnhance(
                        frameData.originalImage, 
                        documentBounds, 
                        perspectiveTransform
                    );
                }
            }
            
            // Create result object
            const result = {
                originalImage: frameData.originalImage,
                processedImage,
                documentBounds,
                perspectiveTransform,
                debugResults,
                timestamp: new Date().toISOString(),
                metadata: {
                    width: frameData.width,
                    height: frameData.height,
                    hasDocumentDetection: !!documentBounds,
                    hasPerspectiveCorrection: !!perspectiveTransform,
                    detectionMethod: this.detector.getDetectionMethod()
                }
            };
            
            this.updateStatus('Document captured successfully!', 'success');
            
            // Call callback if provided
            if (this.options.onCapture) {
                this.options.onCapture(result);
            }
            
            return result;
            
        } catch (error) {
            this.handleError(`Failed to capture document: ${error.message}`);
            return null;
        }
    }

    isCapturing() {
        return this.camera && this.camera.isStreaming();
    }

    getDetectionMethod() {
        return this.detector ? this.detector.getDetectionMethod() : 'none';
    }

    isOpenCVAvailable() {
        return this.detector ? this.detector.isOpenCVAvailable() : false;
    }

    updateStatus(message, type) {
        if (this.options.onStatusChange) {
            this.options.onStatusChange(message, type);
        }
    }

    handleError(message) {
        console.error('[DocumentCapture]', message);
        if (this.options.onError) {
            this.options.onError(new Error(message));
        }
    }

    destroy() {
        if (this.camera) {
            this.camera.destroy();
        }
        
        this.camera = null;
        this.detector = null;
        this.processor = null;
        this.isInitialized = false;
    }
}