export class OpenCVDocumentDetector {
    constructor() {
        this.isAvailable = typeof cv !== 'undefined' && cv.Mat;
    }

    async detect(imageData) {
        if (!this.isAvailable) {
            throw new Error('OpenCV not available');
        }

        try {
            const { data, width, height } = imageData;
            
            // Convert ImageData to cv.Mat
            const src = new cv.Mat(height, width, cv.CV_8UC4);
            src.data.set(data);
            
            // Convert RGBA to RGB
            const srcRGB = new cv.Mat();
            cv.cvtColor(src, srcRGB, cv.COLOR_RGBA2RGB);
            
            // Convert to grayscale
            const gray = new cv.Mat();
            cv.cvtColor(srcRGB, gray, cv.COLOR_RGB2GRAY);
            
            // Apply Gaussian blur
            const blurred = new cv.Mat();
            const ksize = new cv.Size(11, 11);
            cv.GaussianBlur(gray, blurred, ksize, 0);
            
            // Edge detection using Canny
            const edges = new cv.Mat();
            cv.Canny(blurred, edges, 50, 150);
            
            // Morphological operations
            const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
            const closed = new cv.Mat();
            cv.morphologyEx(edges, closed, cv.MORPH_CLOSE, kernel);
            
            // Find contours
            const contours = new cv.MatVector();
            const hierarchy = new cv.Mat();
            cv.findContours(closed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
            
            // Create visualization mats
            const contourVis = new cv.Mat.zeros(height, width, cv.CV_8UC3);
            const color = new cv.Scalar(0, 255, 0);
            cv.drawContours(contourVis, contours, -1, color, 2);
            
            // Find the largest quadrilateral contour
            const documentContour = this.findLargestQuadrilateral(contours, width, height);
            
            // Create document boundary visualization
            const docVis = srcRGB.clone();
            if (documentContour) {
                const docColor = new cv.Scalar(255, 0, 0);
                let contoursVec = new cv.MatVector();
                contoursVec.push_back(documentContour);
                cv.drawContours(docVis, contoursVec, -1, docColor, 3);
                contoursVec.delete();
            }
            
            // Store intermediate results for debugging
            const debugResults = {
                original: this.matToCanvas(srcRGB),
                grayscale: this.matToCanvas(gray),
                blurred: this.matToCanvas(blurred),
                edges: this.matToCanvas(edges),
                morphed: this.matToCanvas(closed),
                contours: this.matToCanvas(contourVis),
                documentBounds: this.matToCanvas(docVis)
            };
            
            let bounds = null;
            let perspectiveTransform = null;
            
            if (documentContour) {
                const rect = cv.boundingRect(documentContour);
                bounds = {
                    x: rect.x,
                    y: rect.y,
                    width: rect.width,
                    height: rect.height
                };
                
                perspectiveTransform = this.calculatePerspectiveTransform(documentContour, width, height);
            }
            
            // Clean up
            this.cleanupMats([
                src, srcRGB, gray, blurred, edges, closed, kernel, 
                contours, hierarchy, contourVis, docVis
            ]);
            
            if (documentContour) {
                documentContour.delete();
            }
            
            return {
                bounds,
                perspectiveTransform,
                hasDocument: !!documentContour,
                debugResults
            };
            
        } catch (error) {
            console.error('OpenCV document detection error:', error);
            throw error;
        }
    }

    findLargestQuadrilateral(contours, imageWidth, imageHeight) {
        const minArea = (imageWidth * imageHeight) * 0.1;
        let largestArea = 0;
        let largestQuad = null;
        
        for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            const area = cv.contourArea(contour);
            
            if (area < minArea) {
                continue;
            }
            
            const epsilon = 0.02 * cv.arcLength(contour, true);
            const approx = new cv.Mat();
            cv.approxPolyDP(contour, approx, epsilon, true);
            
            if (approx.rows === 4 && area > largestArea) {
                largestArea = area;
                if (largestQuad) {
                    largestQuad.delete();
                }
                largestQuad = approx.clone();
            }
            
            approx.delete();
        }
        
        return largestQuad;
    }

    calculatePerspectiveTransform(quadContour, imageWidth, imageHeight) {
        try {
            const points = [];
            for (let i = 0; i < 4; i++) {
                const point = quadContour.data32S.slice(i * 2, i * 2 + 2);
                points.push({ x: point[0], y: point[1] });
            }
            
            const orderedPoints = this.orderPoints(points);
            
            const widthA = Math.sqrt(
                Math.pow(orderedPoints[2].x - orderedPoints[3].x, 2) +
                Math.pow(orderedPoints[2].y - orderedPoints[3].y, 2)
            );
            const widthB = Math.sqrt(
                Math.pow(orderedPoints[1].x - orderedPoints[0].x, 2) +
                Math.pow(orderedPoints[1].y - orderedPoints[0].y, 2)
            );
            const maxWidth = Math.max(widthA, widthB);
            
            const heightA = Math.sqrt(
                Math.pow(orderedPoints[1].x - orderedPoints[2].x, 2) +
                Math.pow(orderedPoints[1].y - orderedPoints[2].y, 2)
            );
            const heightB = Math.sqrt(
                Math.pow(orderedPoints[0].x - orderedPoints[3].x, 2) +
                Math.pow(orderedPoints[0].y - orderedPoints[3].y, 2)
            );
            const maxHeight = Math.max(heightA, heightB);
            
            const srcPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
                orderedPoints[0].x, orderedPoints[0].y,
                orderedPoints[1].x, orderedPoints[1].y,
                orderedPoints[2].x, orderedPoints[2].y,
                orderedPoints[3].x, orderedPoints[3].y
            ]);
            
            const dstPoints = cv.matFromArray(4, 1, cv.CV_32FC2, [
                0, 0,
                maxWidth - 1, 0,
                maxWidth - 1, maxHeight - 1,
                0, maxHeight - 1
            ]);
            
            const transformMatrix = cv.getPerspectiveTransform(srcPoints, dstPoints);
            
            const transformArray = [];
            for (let i = 0; i < 9; i++) {
                transformArray.push(transformMatrix.data64F[i]);
            }
            
            this.cleanupMats([srcPoints, dstPoints, transformMatrix]);
            
            return {
                matrix: transformArray,
                outputWidth: Math.round(maxWidth),
                outputHeight: Math.round(maxHeight),
                sourcePoints: orderedPoints
            };
            
        } catch (error) {
            console.error('Error calculating perspective transform:', error);
            return null;
        }
    }

    orderPoints(points) {
        const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
        
        const sortedPoints = points.map(point => ({
            ...point,
            angle: Math.atan2(point.y - cy, point.x - cx)
        })).sort((a, b) => a.angle - b.angle);
        
        let topLeftIndex = 0;
        let minSum = sortedPoints[0].x + sortedPoints[0].y;
        
        for (let i = 1; i < sortedPoints.length; i++) {
            const sum = sortedPoints[i].x + sortedPoints[i].y;
            if (sum < minSum) {
                minSum = sum;
                topLeftIndex = i;
            }
        }
        
        const orderedPoints = [];
        for (let i = 0; i < 4; i++) {
            const index = (topLeftIndex + i) % 4;
            orderedPoints.push({
                x: sortedPoints[index].x,
                y: sortedPoints[index].y
            });
        }
        
        return orderedPoints;
    }

    matToCanvas(mat) {
        const canvas = document.createElement('canvas');
        cv.imshow(canvas, mat);
        return canvas.toDataURL();
    }

    cleanupMats(mats) {
        mats.forEach(mat => {
            if (mat && mat.delete) {
                mat.delete();
            }
        });
    }
}