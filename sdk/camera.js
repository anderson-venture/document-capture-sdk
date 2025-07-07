// camera.js - Camera management module
export class CameraManager {
    constructor(options = {}) {
        this.options = {
            width: options.width || 1280,
            height: options.height || 720,
            facingMode: options.facingMode || 'environment'
        };
        
        this.stream = null;
        this.video = null;
        this.isActive = false;
    }

    async initialize(videoElement) {
        this.video = videoElement;
        if (!this.video) {
            throw new Error('Video element not found');
        }
    }

    async start() {
        try {
            const constraints = {
                video: {
                    width: { ideal: this.options.width },
                    height: { ideal: this.options.height },
                    facingMode: this.options.facingMode
                }
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            this.isActive = true;
            
            return true;
        } catch (error) {
            throw new Error(`Failed to access camera: ${error.message}`);
        }
    }

    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
            this.video.srcObject = null;
            this.isActive = false;
        }
    }

    isStreaming() {
        return this.isActive && this.stream && this.stream.active;
    }

    getVideoElement() {
        return this.video;
    }

    destroy() {
        this.stop();
        this.video = null;
    }
}