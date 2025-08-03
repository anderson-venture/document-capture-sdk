// Application logic
let documentCapture = null;

// State for multi-step capture
let currentStep = 'front'; // or 'back'
let frontResult = null;
let backResult = null;

// DOM Element Cache - Safely cached after DOM load
let DOM = {};

function cacheDOMElements() {
    DOM = {
        // Main controls
        captureBtn: document.getElementById('captureBtn'),
        statusMessage: document.getElementById('statusMessage'),
        backBtn: document.getElementById('backBtn'),
        closeBtn: document.getElementById('closeBtn'),
        frontTab: document.getElementById('frontTab'),
        backTab: document.getElementById('backTab'),
        videoContainer: document.querySelector('.video-container'),
        cameraVideo: document.getElementById('cameraVideo'),
        documentFrame: document.querySelector('.document-frame'),
        
        // Modal elements
        confirmModal: document.getElementById('confirmModal'),
        modalMessage: document.getElementById('modalMessage'),
        modalOkBtn: document.getElementById('modalOkBtn'),
        modalRetakeBtn: document.getElementById('modalRetakeBtn'),
        detectionWarning: document.getElementById('detectionWarning')
    };
    
    // Validate critical elements exist
    const criticalElements = ['captureBtn', 'statusMessage', 'cameraVideo'];
    for (const elementName of criticalElements) {
        if (!DOM[elementName]) {
            throw new Error(`Critical DOM element not found: ${elementName}`);
        }
    }
    
    return DOM;
}

// Confirm image element (created dynamically)
let confirmImage = null;

// Cleanup function for confirmImage
function cleanupConfirmImage() {
    if (confirmImage && confirmImage.parentNode) {
        confirmImage.parentNode.removeChild(confirmImage);
        confirmImage = null;
    }
}

// OpenCV.js loading
function onOpenCvReady() {
    initializeCapture();
}

// Initialize document capture
function initializeCapture() {
    try {
        // Cache DOM elements first
        cacheDOMElements();
        
        // Setup event listeners
        setupEventListeners();
        
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
            if (success && DOM.captureBtn) {
                DOM.captureBtn.disabled = false;
            }
        }).catch(error => {
            handleError(error);
        });
        
        // Initialize step UI
        updateStepUI();
        
    } catch (error) {
        updateStatus(`Initialization failed: ${error.message}`, 'error');
    }
}

// Event handlers
function updateStatus(message, type) {
    if (DOM.statusMessage) {
        DOM.statusMessage.textContent = message;
    }
}

function handleError(error) {
    updateStatus(`Erro: ${error.message}`);
}

function updateStepUI() {
    if (currentStep === 'front') {
        updateStatus('Posicione a frente do seu documento dentro da marcação em uma superfície plana e fotografe.');
        DOM.frontTab?.classList.add('active');
        DOM.backTab?.classList.remove('active');
        // Update ARIA attributes for accessibility
        DOM.frontTab?.setAttribute('aria-selected', 'true');
        DOM.backTab?.setAttribute('aria-selected', 'false');
        const captureStep = document.getElementById('capture-step');
        if (captureStep) captureStep.setAttribute('aria-labelledby', 'frontTab');
    } else {
        updateStatus('Posicione o verso do seu documento dentro da marcação em uma superfície plana e fotografe.');
        DOM.frontTab?.classList.remove('active');
        DOM.backTab?.classList.add('active');
        // Update ARIA attributes for accessibility
        DOM.frontTab?.setAttribute('aria-selected', 'false');
        DOM.backTab?.setAttribute('aria-selected', 'true');
        const captureStep = document.getElementById('capture-step');
        if (captureStep) captureStep.setAttribute('aria-labelledby', 'backTab');
    }
}

function showModal(message, onOk, onRetake, imageUrl, detectionSuccessful = true) {
    if (!DOM.modalMessage || !DOM.confirmModal) return;
    
    DOM.modalMessage.textContent = message;
    DOM.confirmModal.style.display = 'flex';
    
    // Set status for confirmation
    updateStatus('Confirme se os dados ficaram nítidos e os textos legíveis');
    
    // Hide camera video and show detected image in video container
    if (DOM.cameraVideo) {
        DOM.cameraVideo.style.display = 'none';
    }
    
    if (!confirmImage && DOM.documentFrame) {
        confirmImage = document.createElement('div');
        confirmImage.id = 'confirmImage';
        confirmImage.style.width = '100%';
        confirmImage.style.height = '100%';
        confirmImage.style.backgroundSize = 'cover';
        confirmImage.style.backgroundPosition = 'center';
        confirmImage.style.backgroundRepeat = 'no-repeat';
        confirmImage.style.borderRadius = '10px';
        DOM.documentFrame.appendChild(confirmImage);
    }
    
    if (confirmImage) {
        confirmImage.style.backgroundImage = `url(${imageUrl})`;
        confirmImage.style.display = 'block';
    }
    
    // Show/hide detection warning based on detection success
    if (DOM.detectionWarning) {
        DOM.detectionWarning.style.display = detectionSuccessful ? 'none' : 'flex';
    }
    
    // Remove previous listeners
    if (DOM.modalOkBtn) DOM.modalOkBtn.onclick = null;
    if (DOM.modalRetakeBtn) DOM.modalRetakeBtn.onclick = null;
    
    // Set new listeners
    if (DOM.modalOkBtn) {
        DOM.modalOkBtn.onclick = () => {
            DOM.confirmModal.style.display = 'none';
            // Restore camera video, hide detected image
            if (DOM.cameraVideo) DOM.cameraVideo.style.display = '';
            if (confirmImage) confirmImage.style.display = 'none';
            onOk();
        };
    }
    
    if (DOM.modalRetakeBtn) {
        DOM.modalRetakeBtn.onclick = () => {
            DOM.confirmModal.style.display = 'none';
            // Restore camera video, hide detected image
            if (DOM.cameraVideo) DOM.cameraVideo.style.display = '';
            if (confirmImage) confirmImage.style.display = 'none';
            onRetake();
        };
    }
}

function handleCapture(result) {
    // Hide capture button during confirmation
    if (DOM.captureBtn) {
        DOM.captureBtn.style.display = 'none';
    }
    
    // Check if document detection was successful
    const detectionSuccessful = result.metadata.hasDocumentDetection;
    
    // Show modal for confirmation, pass the PROCESSED image (not original)
    showModal(
        `A foto do documento ficou boa?`,
        () => { /* OK handler */
            if (currentStep === 'front') {
                frontResult = result;
                currentStep = 'back';
                updateStepUI();
                if (DOM.captureBtn) DOM.captureBtn.style.display = '';
            } else {
                backResult = result;
                updateStatus('Ambos os lados foram capturados com sucesso!');
                setTimeout(() => {
                    currentStep = 'front';
                    frontResult = null;
                    backResult = null;
                    updateStepUI();
                    if (DOM.captureBtn) DOM.captureBtn.style.display = '';
                }, 3000);
            }
        },
        () => { /* Retake handler */
            if (DOM.captureBtn) DOM.captureBtn.style.display = '';
            updateStepUI();
        },
        result.processedImage, // This is the detected/cropped document image
        detectionSuccessful // Pass detection status
    );
}

// Event listeners setup
function setupEventListeners() {
    // Navigation event listeners
    DOM.backBtn?.addEventListener('click', () => {
        if (currentStep === 'back') {
            currentStep = 'front';
            updateStepUI();
        }
    });

    DOM.closeBtn?.addEventListener('click', () => {
        // Handle close action - could reset or navigate away
        if (confirm('Deseja sair do processo de captura?')) {
            // Reset or close
            currentStep = 'front';
            frontResult = null;
            backResult = null;
            cleanupConfirmImage();
            updateStepUI();
        }
    });

    // Step tab event listeners (optional - for manual navigation)
    DOM.frontTab?.addEventListener('click', () => {
        if (currentStep !== 'front') {
            currentStep = 'front';
            updateStepUI();
        }
    });

    DOM.backTab?.addEventListener('click', () => {
        if (currentStep !== 'back' && frontResult) {
            currentStep = 'back';
            updateStepUI();
        }
    });

    // Capture button event listener
    DOM.captureBtn?.addEventListener('click', async () => {
        if (DOM.captureBtn && documentCapture) {
            DOM.captureBtn.disabled = true;
            await documentCapture.captureDocument();
            DOM.captureBtn.disabled = false;
        }
    });
}

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
            updateStatus('⚠️ OpenCV.js falhou ao carregar - Usando detecção alternativa');
            initializeCapture();
        }
    }, 10000);
}