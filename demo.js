// Demo Implementation
class DocumentCaptureDemo {
    constructor() {
        this.captureSDK = null;
        this.initUI();
    }

    initUI() {
        this.elements = {
            startBtn: document.getElementById('startBtn'),
            captureBtn: document.getElementById('captureBtn'),
            stopBtn: document.getElementById('stopBtn'),
            status: document.getElementById('status'),
            processing: document.getElementById('processing'),
            results: document.getElementById('results'),
            resultImages: document.getElementById('resultImages')
        };

        this.bindEvents();
    }

    bindEvents() {
        this.elements.startBtn.addEventListener('click', () => this.startCamera());
        this.elements.captureBtn.addEventListener('click', () => this.captureDocument());
        this.elements.stopBtn.addEventListener('click', () => this.stopCamera());
    }

    async startCamera() {
        try {
            this.captureSDK = new DocumentCapture({
                container: '#cameraVideo',
                onCapture: (result) => this.handleCapture(result),
                onError: (error) => this.handleError(error),
                onStatusChange: (message, type) => this.updateStatus(message, type)
            });

            const success = await this.captureSDK.startCamera();
            
            if (success) {
                this.elements.startBtn.disabled = true;
                this.elements.captureBtn.disabled = false;
                this.elements.stopBtn.disabled = false;
            }
        } catch (error) {
            this.handleError(error);
        }
    }

    async captureDocument() {
        if (!this.captureSDK) return;

        this.elements.processing.classList.remove('hidden');
        this.elements.captureBtn.disabled = true;

        try {
            const result = await this.captureSDK.captureDocument();
            if (result) {
                this.displayResults(result);
            }
        } catch (error) {
            this.handleError(error);
        } finally {
            this.elements.processing.classList.add('hidden');
            this.elements.captureBtn.disabled = false;
        }
    }

    stopCamera() {
        if (this.captureSDK) {
            this.captureSDK.stopCamera();
        }

        this.elements.startBtn.disabled = false;
        this.elements.captureBtn.disabled = true;
        this.elements.stopBtn.disabled = true;
    }

    handleCapture(result) {
        console.log('Document captured:', result);
        // Additional handling can be added here
    }

    handleError(error) {
        console.error('Capture error:', error);
        this.updateStatus('Error: ' + error.message, 'error');
    }

    updateStatus(message, type) {
        this.elements.status.textContent = message;
        this.elements.status.className = `status ${type}`;
        this.elements.status.classList.remove('hidden');

        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.elements.status.classList.add('hidden');
        }, 5000);
    }

    displayResults(result) {
        this.elements.results.classList.remove('hidden');
        this.elements.resultImages.innerHTML = '';

        const createImageElement = (src, title) => {
            const container = document.createElement('div');
            container.className = 'result-item';
            
            const heading = document.createElement('h4');
            heading.textContent = title;
            container.appendChild(heading);
            
            const img = document.createElement('img');
            img.src = src;
            img.alt = title;
            container.appendChild(img);
            
            return container;
        };

        this.elements.resultImages.appendChild(
            createImageElement(result.originalImage, 'Original Image')
        );

        if (result.processedImage !== result.originalImage) {
            this.elements.resultImages.appendChild(
                createImageElement(result.processedImage, 'Processed Image')
            );
        }

        // Scroll to results
        this.elements.results.scrollIntoView({ behavior: 'smooth' });
    }
}

// Initialize the demo when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new DocumentCaptureDemo();
});