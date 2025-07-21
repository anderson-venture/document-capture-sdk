// Application logic
let documentCapture = null;

// State for multi-step capture
let currentStep = 'front'; // or 'back'
let frontResult = null;
let backResult = null;

// DOM elements
const captureBtn = document.getElementById('captureBtn');
const statusMessage = document.getElementById('statusMessage');
const results = document.getElementById('results');

// Navigation elements
const backBtn = document.getElementById('backBtn');
const closeBtn = document.getElementById('closeBtn');
const frontTab = document.getElementById('frontTab');
const backTab = document.getElementById('backTab');

// Modal elements
const confirmModal = document.getElementById('confirmModal');
const modalMessage = document.getElementById('modalMessage');
const modalOkBtn = document.getElementById('modalOkBtn');
const modalRetakeBtn = document.getElementById('modalRetakeBtn');
const confirmImage = document.getElementById('confirmImage');

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
}

function handleError(error) {
    updateStatus(`Erro: ${error.message}`);
}

function updateStepUI() {
    if (currentStep === 'front') {
        updateStatus('Place the front of your document inside the marking on a flat surface and photograph.');
        frontTab.classList.add('active');
        backTab.classList.remove('active');
    } else {
        updateStatus('Place the back of your document inside the marking on a flat surface and photograph.');
        frontTab.classList.remove('active');
        backTab.classList.add('active');
    }
}

function showModal(message, onOk, onRetake, imageUrl) {
    modalMessage.textContent = message;
    confirmModal.style.display = 'flex';
    
    // Set status for confirmation
    updateStatus('Confirm that the data is clear and the text is legible');
    
    // Show captured image in modal
    confirmImage.style.backgroundImage = `url(${imageUrl})`;
    
    // Remove previous listeners
    modalOkBtn.onclick = null;
    modalRetakeBtn.onclick = null;
    
    // Set new listeners
    modalOkBtn.onclick = () => {
        confirmModal.style.display = 'none';
        onOk();
    };
    modalRetakeBtn.onclick = () => {
        confirmModal.style.display = 'none';
        onRetake();
    };
}

function handleCapture(result) {
    // Hide capture button during confirmation
    captureBtn.style.display = 'none';
    
    // Show modal for confirmation, pass processed image
    showModal(
        `A foto do documento ficou boa?`,
        () => { /* OK handler */
            if (currentStep === 'front') {
                frontResult = result;
                currentStep = 'back';
                updateStepUI();
                captureBtn.style.display = '';
            } else {
                backResult = result;
                updateStatus('Both sides were captured! Check the console for results.');
                console.log('Front ID Card Result:', frontResult);
                console.log('Back ID Card Result:', backResult);
                setTimeout(() => {
                    currentStep = 'front';
                    frontResult = null;
                    backResult = null;
                    updateStepUI();
                    captureBtn.style.display = '';
                }, 3000);
            }
        },
        () => { /* Retake handler */
            captureBtn.style.display = '';
            updateStepUI();
        },
        result.processedImage // Pass processed image for confirmation
    );
}

// Navigation event listeners
backBtn.addEventListener('click', () => {
    if (currentStep === 'back') {
        currentStep = 'front';
        updateStepUI();
    }
});

closeBtn.addEventListener('click', () => {
    // Handle close action - could reset or navigate away
    if (confirm('Do you want to exit the capture process?')) {
        // Reset or close
        currentStep = 'front';
        frontResult = null;
        backResult = null;
        updateStepUI();
    }
});

// Step tab event listeners (optional - for manual navigation)
frontTab.addEventListener('click', () => {
    if (currentStep !== 'front') {
        currentStep = 'front';
        updateStepUI();
    }
});

backTab.addEventListener('click', () => {
    if (currentStep !== 'back' && frontResult) {
        currentStep = 'back';
        updateStepUI();
    }
});

// Capture button event listener
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
            updateStatus('⚠️ OpenCV.js failed to load - Using alternative detection');
            initializeCapture();
        }
    }, 10000);
}

// On load, show step UI
updateStepUI();