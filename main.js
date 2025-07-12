// Application logic
let documentCapture = null;
let captureCount = 0;

// State for multi-step capture
let currentStep = 'front'; // or 'back'
let frontResult = null;
let backResult = null;

// DOM elements
const captureBtn = document.getElementById('captureBtn');
const statusMessage = document.getElementById('statusMessage');
const opencvStatus = document.getElementById('opencvStatus');
const results = document.getElementById('results');

// Modal elements
const confirmModal = document.getElementById('confirmModal');
const modalMessage = document.getElementById('modalMessage');
const modalOkBtn = document.getElementById('modalOkBtn');
const modalRetakeBtn = document.getElementById('modalRetakeBtn');

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

const videoContainer = document.querySelector('.video-container');
const cameraVideo = document.getElementById('cameraVideo');
let confirmImage = null;

function showModal(message, onOk, onRetake, imageUrl) {
    modalMessage.textContent = message;
    confirmModal.style.display = 'flex';
    // Set status for confirmation
    updateStatus('Confirm that the data is clear and the text is legible', 'info');
    // Hide video, show captured image
    cameraVideo.style.display = 'none';
    if (!confirmImage) {
        confirmImage = document.createElement('img');
        confirmImage.id = 'confirmImage';
        confirmImage.style.width = '100%';
        confirmImage.style.borderRadius = '10px';
        confirmImage.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)';
        videoContainer.appendChild(confirmImage);
    }
    confirmImage.src = imageUrl;
    confirmImage.style.display = '';
    // Remove previous listeners
    modalOkBtn.onclick = null;
    modalRetakeBtn.onclick = null;
    // Set new listeners
    modalOkBtn.onclick = () => {
        confirmModal.style.display = 'none';
        // Restore video, hide image
        cameraVideo.style.display = '';
        if (confirmImage) confirmImage.style.display = 'none';
        onOk();
    };
    modalRetakeBtn.onclick = () => {
        confirmModal.style.display = 'none';
        // Restore video, hide image
        cameraVideo.style.display = '';
        if (confirmImage) confirmImage.style.display = 'none';
        onRetake();
    };
}

function updateStepUI() {
    if (currentStep === 'front') {
        updateStatus('Place the front of your document inside the marking on a flat surface and photograph.', 'info');
    } else {
        updateStatus('Place the back of your document inside the marking on a flat surface and photograph.', 'info');
    }
}

function handleCapture(result) {
    // Show result as before
    const resultDiv = document.createElement('div');
    resultDiv.className = 'result-item';
    const timestamp = new Date(result.timestamp).toLocaleString();
    let debugSection = '';
    if (result.debugResults) {
        debugSection = `
            <div class="debug-results">
                <div class="debug-item"><h4>🖼️ Original</h4><img src="${result.debugResults.original}" alt="Original"></div>
                <div class="debug-item"><h4>⚫ Grayscale</h4><img src="${result.debugResults.grayscale}" alt="Grayscale"></div>
                <div class="debug-item"><h4>🌀 Blurred</h4><img src="${result.debugResults.blurred}" alt="Blurred"></div>
                <div class="debug-item"><h4>⚡ Canny Edges</h4><img src="${result.debugResults.edges}" alt="Canny Edges"></div>
                <div class="debug-item"><h4>📐 Contours</h4><img src="${result.debugResults.contours}" alt="Contours"></div>
                <div class="debug-item"><h4>🎯 Document Bounds</h4><img src="${result.debugResults.documentBounds}" alt="Document Bounds"></div>
            </div>
        `;
    }
    resultDiv.innerHTML = `
        <h3>${currentStep === 'front' ? 'Front' : 'Back'} of ID Card</h3>
        <h4 style="margin: 20px 0 10px; color: #1e293b;">🔍 Debug Steps:</h4>
        ${debugSection}
        <h4 style="margin: 20px 0 10px; color: #1e293b;">📊 Final Results:</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
            <div><h4 style="margin: 0 0 10px; font-size: 1rem;">Original Capture</h4><img src="${result.originalImage}" alt="Original capture"></div>
            <div><h4 style="margin: 0 0 10px; font-size: 1rem;">Processed Document</h4><img src="${result.processedImage}" alt="Processed capture"></div>
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
    // Hide capture button during confirmation
    captureBtn.style.display = 'none';
    // Show modal for confirmation, pass processed image
    showModal(
        `Is this the ${currentStep === 'front' ? 'FRONT' : 'BACK'} of your ID card?`,
        () => { /* OK handler */
            if (currentStep === 'front') {
                frontResult = result;
                currentStep = 'back';
                updateStepUI();
                results.innerHTML = '';
                captureBtn.style.display = '';
            } else {
                backResult = result;
                updateStatus('Both sides captured! Check the console for results.', 'success');
                console.log('Front ID Card Result:', frontResult);
                console.log('Back ID Card Result:', backResult);
                setTimeout(() => {
                    currentStep = 'front';
                    frontResult = null;
                    backResult = null;
                    results.innerHTML = '';
                    updateStepUI();
                    captureBtn.style.display = '';
                }, 3000);
            }
        },
        () => { /* Retake handler */
            results.innerHTML = '';
            captureBtn.style.display = '';
            updateStepUI();
        },
        result.processedImage // Pass processed image for confirmation
    );
}


// Button event listeners
captureBtn.addEventListener('click', async () => {
    captureBtn.disabled = true;
    await documentCapture.captureDocument();
    captureBtn.disabled = false;
});

// Initialize when OpenCV is ready
if (typeof cv !== 'undefined') {
    onOpenCvReady();
} else {
    let checkInterval = setInterval(() => {
        if (typeof cv !== 'undefined' && cv.Mat) {
            clearInterval(checkInterval);
            onOpenCvReady();
        }
    }, 100);
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
// On load, show step UI
updateStepUI();