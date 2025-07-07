// Document Capture SDK - Core Implementation
class DocumentCapture {
    constructor(options = {}) {
        this.options = {
            container: options.container || '#cameraVideo',
            onCapture: options.onCapture || null,
            onError: options.onError || null,
            onStatusChange: options.onStatusChange || null,
            width: options.width || 1280,
            height: options.height || 720,
            enableDocumentDetection: options.enableDocumentDetection !== false,
            enhanceImage: options.enhanceImage !== false
        };

        this.stream = null;
        this.video = null;
        this.canvas = null;
        this.ctx = null;
        this.isCapturing = false;
        
        this.init();
    }

    init() {
        this.video = document.querySelector(this.options.container);
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        
        if (!this.video) {
            this.handleError('Video element not found');
            return;
        }
    }

    async startCamera() {
        try {
            this.updateStatus('Initializing camera...', 'info');
            
            const constraints = {
                video: {
                    width: { ideal: this.options.width },
                    height: { ideal: this.options.height },
                    facingMode: 'environment' // Use back camera on mobile
                }
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            this.isCapturing = true;
            
            this.updateStatus('Camera ready - Position your document', 'success');
            
            return true;
        } catch (error) {
            this.handleError('Failed to access camera: ' + error.message);
            return false;
        }
    }

    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
            this.video.srcObject = null;
            this.isCapturing = false;
            this.updateStatus('Camera stopped', 'info');
        }
    }

    async captureDocument() {
        if (!this.isCapturing) {
            this.handleError('Camera not started');
            return null;
        }

        try {
            this.updateStatus('Capturing document...', 'info');
            
            // Set canvas size to match video
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            
            // Capture frame from video
            this.ctx.drawImage(this.video, 0, 0);
            
            // Get image data
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const originalImage = this.canvas.toDataURL('image/jpeg', 0.9);
            
            let processedImage = originalImage;
            let documentBounds = null;
            
            if (this.options.enableDocumentDetection) {
                const detectionResult = await this.detectDocument(imageData);
                if (detectionResult.bounds) {
                    documentBounds = detectionResult.bounds;
                    processedImage = await this.cropAndEnhance(originalImage, documentBounds);
                }
            }
            
            const result = {
                originalImage,
                processedImage,
                documentBounds,
                timestamp: new Date().toISOString(),
                metadata: {
                    width: this.canvas.width,
                    height: this.canvas.height,
                    hasDocumentDetection: !!documentBounds
                }
            };
            
            this.updateStatus('Document captured successfully!', 'success');
            
            if (this.options.onCapture) {
                this.options.onCapture(result);
            }
            
            return result;
            
        } catch (error) {
            this.handleError('Failed to capture document: ' + error.message);
            return null;
        }
    }

    // TODO: Replace with OpenCV.js implementation
    async detectDocument(imageData) {
        // Check if OpenCV is available
        if (typeof cv !== 'undefined') {
            return this.detectDocumentWithOpenCV(imageData);
        }
        
        // Fallback to simple detection
        return this.detectDocumentSimple(imageData);
    }

    // OpenCV.js implementation - to be implemented
    async detectDocumentWithOpenCV(imageData) {
        // TODO: Implement OpenCV.js document detection
        console.log('OpenCV.js document detection - to be implemented');
        
        // For now, return simple detection
        return this.detectDocumentSimple(imageData);
    }

    // Simple document detection fallback
    async detectDocumentSimple(imageData) {
        const { data, width, height } = imageData;
        const gray = new Uint8Array(width * height);
        
        // Convert to grayscale
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            gray[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        }
        
        // Simple edge detection (Sobel-like)
        const edges = this.detectEdges(gray, width, height);
        
        // Find document bounds (simplified)
        const bounds = this.findDocumentBounds(edges, width, height);
        
        return { bounds, edges };
    }

    detectEdges(gray, width, height) {
        const edges = new Uint8Array(width * height);
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                
                // Sobel X
                const gx = 
                    -1 * gray[(y-1) * width + (x-1)] +
                    -2 * gray[y * width + (x-1)] +
                    -1 * gray[(y+1) * width + (x-1)] +
                    1 * gray[(y-1) * width + (x+1)] +
                    2 * gray[y * width + (x+1)] +
                    1 * gray[(y+1) * width + (x+1)];
                
                // Sobel Y
                const gy = 
                    -1 * gray[(y-1) * width + (x-1)] +
                    -2 * gray[(y-1) * width + x] +
                    -1 * gray[(y-1) * width + (x+1)] +
                    1 * gray[(y+1) * width + (x-1)] +
                    2 * gray[(y+1) * width + x] +
                    1 * gray[(y+1) * width + (x+1)];
                
                edges[idx] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
            }
        }
        
        return edges;
    }

    findDocumentBounds(edges, width, height) {
        // Simplified document bounds detection
        const threshold = 50;
        let minX = width, maxX = 0, minY = height, maxY = 0;
        let edgeCount = 0;
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                if (edges[y * width + x] > threshold) {
                    edgeCount++;
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                    minY = Math.min(minY, y);
                    maxY = Math.max(maxY, y);
                }
            }
        }
        
        // Only return bounds if we found enough edges
        if (edgeCount > width * height * 0.01) {
            return {
                x: Math.max(0, minX - 10),
                y: Math.max(0, minY - 10),
                width: Math.min(width, maxX - minX + 20),
                height: Math.min(height, maxY - minY + 20)
            };
        }
        
        return null;
    }

    async cropAndEnhance(imageDataUrl, bounds) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = bounds.width;
                canvas.height = bounds.height;
                
                // Crop the image
                ctx.drawImage(
                    img,
                    bounds.x, bounds.y, bounds.width, bounds.height,
                    0, 0, bounds.width, bounds.height
                );
                
                // Enhance the image
                if (this.options.enhanceImage) {
                    this.enhanceImage(ctx, canvas.width, canvas.height);
                }
                
                resolve(canvas.toDataURL('image/jpeg', 0.9));
            };
            img.src = imageDataUrl;
        });
    }

    enhanceImage(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        // Simple contrast enhancement
        const contrast = 1.2;
        const brightness = 10;
        
        for (let i = 0; i < data.length; i += 4) {
            // Apply contrast and brightness
            data[i] = Math.min(255, Math.max(0, contrast * data[i] + brightness));     // Red
            data[i + 1] = Math.min(255, Math.max(0, contrast * data[i + 1] + brightness)); // Green
            data[i + 2] = Math.min(255, Math.max(0, contrast * data[i + 2] + brightness)); // Blue
        }
        
        ctx.putImageData(imageData, 0, 0);
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
        this.stopCamera();
        this.video = null;
        this.canvas = null;
        this.ctx = null;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = DocumentCapture;
}