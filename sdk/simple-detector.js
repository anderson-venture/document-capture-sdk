// simple-detector.js - Fallback document detection without OpenCV
export class SimpleDocumentDetector {
    async detect(imageData) {
        const { data, width, height } = imageData;
        const gray = new Uint8Array(width * height);
        
        // Convert to grayscale
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            gray[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        }
        
        // Detect edges
        const edges = this.detectEdges(gray, width, height);
        
        // Find document bounds
        const bounds = this.findDocumentBounds(edges, width, height);
        
        return {
            bounds,
            hasDocument: !!bounds,
            debugResults: {
                edges: this.createEdgeImageData(edges, width, height)
            }
        };
    }

    detectEdges(gray, width, height) {
        const edges = new Uint8Array(width * height);
        
        // Apply Sobel edge detection
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                
                // Sobel X kernel
                const gx = 
                    -1 * gray[(y-1) * width + (x-1)] +
                    -2 * gray[y * width + (x-1)] +
                    -1 * gray[(y+1) * width + (x-1)] +
                    1 * gray[(y-1) * width + (x+1)] +
                    2 * gray[y * width + (x+1)] +
                    1 * gray[(y+1) * width + (x+1)];
                
                // Sobel Y kernel
                const gy = 
                    -1 * gray[(y-1) * width + (x-1)] +
                    -2 * gray[(y-1) * width + x] +
                    -1 * gray[(y-1) * width + (x+1)] +
                    1 * gray[(y+1) * width + (x-1)] +
                    2 * gray[(y+1) * width + x] +
                    1 * gray[(y+1) * width + (x+1)];
                
                // Magnitude
                edges[idx] = Math.min(255, Math.sqrt(gx * gx + gy * gy));
            }
        }
        
        return edges;
    }

    findDocumentBounds(edges, width, height) {
        const threshold = 50;
        let minX = width, maxX = 0, minY = height, maxY = 0;
        let edgeCount = 0;
        
        // Find edge pixels and their bounding box
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
        
        // Check if we have enough edges to consider it a document
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

    createEdgeImageData(edges, width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;
        
        for (let i = 0; i < edges.length; i++) {
            const pixelIndex = i * 4;
            const edgeValue = edges[i];
            
            data[pixelIndex] = edgeValue;     // R
            data[pixelIndex + 1] = edgeValue; // G
            data[pixelIndex + 2] = edgeValue; // B
            data[pixelIndex + 3] = 255;       // A
        }
        
        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL();
    }
}