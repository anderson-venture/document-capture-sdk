import * as opencv from 'opencv.js';

class DocumentCaptureSDK {
  constructor(options = {}) {
    this.videoElement = null;
    this.canvasElement = null;
    this.stream = null;
    this.config = {
      autoEnhance: options.autoEnhance !== false,
      quality: options.quality || 0.8,
      maxWidth: options.maxWidth || 1280,
      onError: options.onError || console.error,
      onCapture: options.onCapture || (() => {}),
    };
  }

  // Initialize camera and UI
  async init(containerId) {
    try {
      this.videoElement = document.createElement('video');
      this.canvasElement = document.createElement('canvas');
      const container = document.getElementById(containerId);
      container.appendChild(this.videoElement);
      container.appendChild(this.canvasElement);
      this.canvasElement.style.display = 'none';

      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      this.videoElement.srcObject = this.stream;
      await this.videoElement.play();

      this.canvasElement.width = this.videoElement.videoWidth;
      this.canvasElement.height = this.videoElement.videoHeight;

      return this;
    } catch (error) {
      this.config.onError(error);
      throw error;
    }
  }

  // Detect document edges using OpenCV.js
  async detectDocument() {
    try {
      const ctx = this.canvasElement.getContext('2d');
      ctx.drawImage(this.videoElement, 0, 0);
      const src = opencv.imread(this.canvasElement);
      
      // Convert to grayscale
      const gray = new opencv.Mat();
      opencv.cvtColor(src, gray, opencv.COLOR_RGBA2GRAY);
      
      // Apply edge detection
      const edges = new opencv.Mat();
      opencv.Canny(gray, edges, 75, 200);
      
      // Find contours
      const contours = new opencv.MatVector();
      const hierarchy = new opencv.Mat();
      opencv.findContours(edges, contours, hierarchy, opencv.RETR_EXTERNAL, opencv.CHAIN_APPROX_SIMPLE);
      
      // Find largest quadrilateral
      let maxArea = 0;
      let documentContour = null;
      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = opencv.contourArea(contour);
        if (area > maxArea) {
          const peri = opencv.arcLength(contour, true);
          const approx = new opencv.Mat();
          opencv.approxPolyDP(contour, approx, 0.02 * peri, true);
          if (approx.rows === 4) {
            maxArea = area;
            documentContour = approx;
          }
          approx.delete();
        }
        contour.delete();
      }
      
      src.delete();
      gray.delete();
      edges.delete();
      contours.delete();
      hierarchy.delete();
      
      return documentContour;
    } catch (error) {
      this.config.onError(error);
      throw error;
    }
  }

  // Capture and process image
  async capture() {
    try {
      const ctx = this.canvasElement.getContext('2d');
      ctx.drawImage(this.videoElement, 0, 0);
      let src = opencv.imread(this.canvasElement);
      
      // Auto-crop if document detected
      const contour = await this.detectDocument();
      if (contour) {
        const points = [];
        for (let i = 0; i < 4; i++) {
          points.push({ x: contour.data32F[i * 2], y: contour.data32F[i * 2 + 1] });
        }
        
        // Sort points for perspective transform
        const sortedPoints = this.sortQuadPoints(points);
        const width = Math.max(
          this.distance(sortedPoints[0], sortedPoints[1]),
          this.distance(sortedPoints[2], sortedPoints[3])
        );
        const height = Math.max(
          this.distance(sortedPoints[0], sortedPoints[3]),
          this.distance(sortedPoints[1], sortedPoints[2])
        );
        
        const srcPoints = new opencv.Mat(4, 1, opencv.CV_32FC2);
        const dstPoints = new opencv.Mat(4, 1, opencv.CV_32FC2);
        
        srcPoints.data32F.set([
          sortedPoints[0].x, sortedPoints[0].y,
          sortedPoints[1].x, sortedPoints[1].y,
          sortedPoints[2].x, sortedPoints[2].y,
          sortedPoints[3].x, sortedPoints[3].y
        ]);
        
        dstPoints.data32F.set([
          0, 0,
          width, 0,
          width, height,
          0, height
        ]);
        
        const M = opencv.getPerspectiveTransform(srcPoints, dstPoints);
        const dst = new opencv.Mat();
        opencv.warpPerspective(src, dst, M, { width, height });
        
        src.delete();
        src = dst;
        
        srcPoints.delete();
        dstPoints.delete();
        M.delete();
      }
      
      // Auto-enhance if enabled
      if (this.config.autoEnhance) {
        const enhanced = new opencv.Mat();
        opencv.cvtColor(src, enhanced, opencv.COLOR_RGBA2GRAY);
        opencv.adaptiveThreshold(enhanced, enhanced, 255, opencv.ADAPTIVE_THRESH_GAUSSIAN_C, opencv.THRESH_BINARY, 11, 2);
        opencv.cvtColor(enhanced, src, opencv.COLOR_GRAY2RGBA);
        enhanced.delete();
      }
      
      // Convert to base64
      opencv.imshow(this.canvasElement, src);
      const dataUrl = this.canvasElement.toDataURL('image/jpeg', this.config.quality);
      src.delete();
      contour?.delete();
      
      const result = { image: dataUrl, timestamp: Date.now() };
      this.config.onCapture(result);
      return result;
    } catch (error) {
      this.config.onError(error);
      throw error;
    }
  }

  // Utility: Sort quadrilateral points
  sortQuadPoints(points) {
    const sortedByY = points.sort((a, b) => a.y - b.y);
    const top = sortedByY.slice(0, 2).sort((a, b) => a.x - b.x);
    const bottom = sortedByY.slice(2, 4).sort((a, b) => a.x - b.x);
    return [top[0], top[1], bottom[1], bottom[0]];
  }

  // Utility: Calculate distance between points
  distance(p1, p2) {
    return Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
  }

  // Cleanup
  destroy() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }
    if (this.videoElement) {
      this.videoElement.remove();
    }
    if (this.canvasElement) {
      this.canvasElement.remove();
    }
  }
}

// React component for easy integration
const DocumentCapture = ({ containerId, onCapture, onError }) => {
  React.useEffect(() => {
    const sdk = new DocumentCaptureSDK({ onCapture, onError });
    sdk.init(containerId);
    return () => sdk.destroy();
  }, [containerId, onCapture, onError]);

  return (
    <div id={containerId} className="relative w-full h-96">
      <button
        className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-4 py-2 rounded"
        onClick={() => new DocumentCaptureSDK().capture()}
      >
        Capture
      </button>
    </div>
  );
};

// Export for different frameworks
export default DocumentCaptureSDK;
export { DocumentCapture };