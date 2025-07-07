// image-processor.js - Image processing and enhancement
export class ImageProcessor {
    constructor(options = {}) {
        this.options = {
            enhanceImage: options.enhanceImage !== false,
            jpegQuality: options.jpegQuality || 0.9
        };
    }

    async captureFrame(video) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const originalImage = canvas.toDataURL('image/jpeg', this.options.jpegQuality);
        
        return {
            imageData,
            originalImage,
            width: canvas.width,
            height: canvas.height
        };
    }

    async cropAndEnhance(imageDataUrl, bounds, perspectiveTransform = null) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                let canvas, ctx;
                
                if (perspectiveTransform && typeof cv !== 'undefined') {
                    canvas = document.createElement('canvas');
                    ctx = canvas.getContext('2d');
                    
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    
                    const correctedCanvas = this.applyPerspectiveTransform(canvas, perspectiveTransform);
                    if (correctedCanvas) {
                        canvas = correctedCanvas;
                        ctx = canvas.getContext('2d');
                    }
                } else {
                    canvas = document.createElement('canvas');
                    ctx = canvas.getContext('2d');
                    
                    canvas.width = bounds.width;
                    canvas.height = bounds.height;
                    
                    ctx.drawImage(
                        img,
                        bounds.x, bounds.y, bounds.width, bounds.height,
                        0, 0, bounds.width, bounds.height
                    );
                }
                
                if (this.options.enhanceImage) {
                    this.enhanceImage(ctx, canvas.width, canvas.height);
                }
                
                resolve(canvas.toDataURL('image/jpeg', this.options.jpegQuality));
            };
            img.src = imageDataUrl;
        });
    }

    applyPerspectiveTransform(canvas, perspectiveTransform) {
        try {
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            const src = new cv.Mat(canvas.height, canvas.width, cv.CV_8UC4);
            src.data.set(imageData.data);
            
            const dst = new cv.Mat();
            const M = cv.matFromArray(3, 3, cv.CV_64FC1, perspectiveTransform.matrix);
            
            const dsize = new cv.Size(perspectiveTransform.outputWidth, perspectiveTransform.outputHeight);
            cv.warpPerspective(src, dst, M, dsize);
            
            const outputCanvas = document.createElement('canvas');
            outputCanvas.width = perspectiveTransform.outputWidth;
            outputCanvas.height = perspectiveTransform.outputHeight;
            
            cv.imshow(outputCanvas, dst);
            
            // Cleanup
            src.delete();
            dst.delete();
            M.delete();
            
            return outputCanvas;
            
        } catch (error) {
            console.error('Error applying perspective transform:', error);
            return null;
        }
    }

    enhanceImage(ctx, width, height) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        const contrast = 1.2;
        const brightness = 10;
        
        for (let i = 0; i < data.length; i += 4) {
            // Apply contrast and brightness to RGB channels
            data[i] = Math.min(255, Math.max(0, contrast * data[i] + brightness));
            data[i + 1] = Math.min(255, Math.max(0, contrast * data[i + 1] + brightness));
            data[i + 2] = Math.min(255, Math.max(0, contrast * data[i + 2] + brightness));
        }
        
        ctx.putImageData(imageData, 0, 0);
    }

    async convertToGrayscale(imageDataUrl) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                
                for (let i = 0; i < data.length; i += 4) {
                    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
                    data[i] = gray;
                    data[i + 1] = gray;
                    data[i + 2] = gray;
                }
                
                ctx.putImageData(imageData, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', this.options.jpegQuality));
            };
            img.src = imageDataUrl;
        });
    }

    async sharpenImage(imageDataUrl, strength = 0.5) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                const width = canvas.width;
                const height = canvas.height;
                
                // Simple unsharp mask
                const sharpenKernel = [
                    0, -strength, 0,
                    -strength, 1 + 4 * strength, -strength,
                    0, -strength, 0
                ];
                
                this.applyKernel(data, width, height, sharpenKernel);
                
                ctx.putImageData(imageData, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', this.options.jpegQuality));
            };
            img.src = imageDataUrl;
        });
    }

    applyKernel(data, width, height, kernel) {
        const copy = new Uint8ClampedArray(data);
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                for (let c = 0; c < 3; c++) { // RGB channels only
                    let sum = 0;
                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const idx = ((y + ky) * width + (x + kx)) * 4 + c;
                            const kernelIdx = (ky + 1) * 3 + (kx + 1);
                            sum += copy[idx] * kernel[kernelIdx];
                        }
                    }
                    const idx = (y * width + x) * 4 + c;
                    data[idx] = Math.min(255, Math.max(0, sum));
                }
            }
        }
    }
}