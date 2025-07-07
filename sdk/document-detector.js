// document-detector.js - Factory for document detection
import { OpenCVDocumentDetector } from './opencv-detector.js';
import { SimpleDocumentDetector } from './simple-detector.js';

export class DocumentDetector {
    constructor() {
        this.detector = null;
        this.detectionMethod = 'none';
        this.initialize();
    }

    initialize() {
        if (typeof cv !== 'undefined' && cv.Mat) {
            this.detector = new OpenCVDocumentDetector();
            this.detectionMethod = 'opencv';
            console.log('Using OpenCV.js for document detection');
        } else {
            this.detector = new SimpleDocumentDetector();
            this.detectionMethod = 'simple';
            console.log('Using simple document detection');
        }
    }

    async detect(imageData) {
        if (!this.detector) {
            throw new Error('Document detector not initialized');
        }

        try {
            const result = await this.detector.detect(imageData);
            return {
                ...result,
                detectionMethod: this.detectionMethod
            };
        } catch (error) {
            console.error('Document detection failed:', error);
            
            // Fallback to simple detection if OpenCV fails
            if (this.detectionMethod === 'opencv') {
                console.log('Falling back to simple detection');
                this.detector = new SimpleDocumentDetector();
                this.detectionMethod = 'simple';
                return this.detect(imageData);
            }
            
            throw error;
        }
    }

    getDetectionMethod() {
        return this.detectionMethod;
    }

    isOpenCVAvailable() {
        return this.detectionMethod === 'opencv';
    }

    async waitForOpenCV(timeout = 10000) {
        return new Promise((resolve) => {
            if (typeof cv !== 'undefined' && cv.Mat) {
                this.initialize();
                resolve(true);
                return;
            }

            const startTime = Date.now();
            const checkInterval = setInterval(() => {
                if (typeof cv !== 'undefined' && cv.Mat) {
                    clearInterval(checkInterval);
                    this.initialize();
                    resolve(true);
                } else if (Date.now() - startTime > timeout) {
                    clearInterval(checkInterval);
                    console.warn('OpenCV.js loading timeout, using simple detection');
                    this.detector = new SimpleDocumentDetector();
                    this.detectionMethod = 'simple';
                    resolve(false);
                }
            }, 100);
        });
    }
}