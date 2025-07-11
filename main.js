// Application logic
let documentCapture = null;
let captureCount = 0;

// DOM elements
const captureBtn = document.getElementById('captureBtn');
const statusMessage = document.getElementById('statusMessage');
const opencvStatus = document.getElementById('opencvStatus');
const results = document.getElementById('results');

// OpenCV.js loading
function onOpenCvReady() {
    initializeCapture();
}

// Initialize document capture
function initializeCapture() {
    documentCapture = new DocumentCapture({
        container: '#cameraVideo',
        onCapture: handleCapture,
        onError: handleError,
        onStatusChange: updateStatus,
        enableDocumentDetection: true,
        enhanceImage: true
    });
    // Automatically start the camera
    documentCapture.startCamera().then(success => {
        if (success) {
            captureBtn.disabled = false;
        }
    });
}

// Event handlers
function updateStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status ${type}`;
    statusMessage.style.display = 'block';
}

function handleError(error) {
    updateStatus(`Error: ${error.message}`, 'error');
}

function handleCapture(result) {
    captureCount++;
    
    const resultDiv = document.createElement('div');
    resultDiv.className = 'result-item';
    
    const timestamp = new Date(result.timestamp).toLocaleString();
    
    let debugSection = '';
    if (result.debugResults) {
        debugSection = `
            <div class="debug-results">
                <div class="debug-item">
                    <h4>🖼️ Original</h4>
                    <img src="${result.debugResults.original}" alt="Original">
                </div>
                <div class="debug-item">
                    <h4>⚫ Grayscale</h4>
                    <img src="${result.debugResults.grayscale}" alt="Grayscale">
                </div>
                <div class="debug-item">
                    <h4>🌀 Blurred</h4>
                    <img src="${result.debugResults.blurred}" alt="Blurred">
                </div>
                <div class="debug-item">
                    <h4>⚡ Canny Edges</h4>
                    <img src="${result.debugResults.edges}" alt="Canny Edges">
                </div>
                <div class="debug-item">
                    <h4>🔧 Morphed</h4>
                    <img src="${result.debugResults.morphed}" alt="Morphed">
                </div>
                <div class="debug-item">
                    <h4>📐 Contours</h4>
                    <img src="${result.debugResults.contours}" alt="Contours">
                </div>
                <div class="debug-item">
                    <h4>🎯 Document Bounds</h4>
                    <img src="${result.debugResults.documentBounds}" alt="Document Bounds">
                </div>
            </div>
        `;
    }
    
    resultDiv.innerHTML = `
        <h3>📄 Capture #${captureCount}</h3>
        
        <h4 style="margin: 20px 0 10px; color: #1e293b;">🔍 Debug Steps:</h4>
        ${debugSection}
        
        <h4 style="margin: 20px 0 10px; color: #1e293b;">📊 Final Results:</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
            <div>
                <h4 style="margin: 0 0 10px; font-size: 1rem;">Original Capture</h4>
                <img src="${result.originalImage}" alt="Original capture">
            </div>
            <div>
                <h4 style="margin: 0 0 10px; font-size: 1rem;">Processed Document</h4>
                <img src="${result.processedImage}" alt="Processed capture">
            </div>
        </div>
        <div class="metadata">
            <strong>Timestamp:</strong> ${timestamp}<br>
            <strong>Resolution:</strong> ${result.metadata.width}x${result.metadata.height}<br>
            <strong>Detection Method:</strong> ${result.metadata.detectionMethod}<br>
            <strong>Document Detected:</strong> ${result.metadata.hasDocumentDetection ? '✅ Yes' : '❌ No'}<br>
            <strong>Perspective Corrected:</strong> ${result.metadata.hasPerspectiveCorrection ? '✅ Yes' : '❌ No'}
        </div>
    `;
    
    results.innerHTML = '';
    results.appendChild(resultDiv);
}


// Button event listeners
captureBtn.addEventListener('click', async () => {
    captureBtn.disabled = true;
    await documentCapture.captureDocument();
    captureBtn.disabled = false;
});

// Initialize when OpenCV is ready
if (typeof cv !== 'undefined') {
    // OpenCV is already loaded
    onOpenCvReady();
} else {
    // Wait for OpenCV to load
    let checkInterval = setInterval(() => {
        if (typeof cv !== 'undefined' && cv.Mat) {
            clearInterval(checkInterval);
            onOpenCvReady();
        }
    }, 100);
    
    // Fallback after 10 seconds
    setTimeout(() => {
        if (typeof cv === 'undefined') {
            clearInterval(checkInterval);
            opencvStatus.innerHTML = '⚠️ OpenCV.js failed to load - Using fallback detection';
            opencvStatus.style.background = '#fef3c7';
            opencvStatus.style.color = '#92400e';
            opencvStatus.style.border = '1px solid #fcd34d';
            initializeCapture();
        }
    }, 10000);
}