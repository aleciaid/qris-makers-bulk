import jsQR from 'jsqr';

export interface ScanResult {
    success: boolean;
    data: string | null;
    strategy: string;
}

/**
 * Scan QR code with multiple strategies for better detection
 * Strategy 1: Direct scan at full resolution
 * Strategy 2: Scan resized image (smaller for faster detection)
 * Strategy 3: Scan center crop (where QR typically is)
 * Strategy 4: Scan with grayscale preprocessing
 * Strategy 5: Scan with binarization at different thresholds
 */
export function scanQRCode(img: HTMLImageElement): ScanResult {
    console.log(`QR Scan: Starting scan for image ${img.width}x${img.height}`);

    // Strategy 1: Direct scan at original size
    let result = scanDirect(img);
    if (result.success) {
        console.log('QR Scan: Success with direct strategy');
        return { ...result, strategy: 'direct' };
    }

    // Strategy 2: Resize to standardized sizes for better detection
    // Various sizes help handle different image resolutions
    const resizeSizes = [500, 600, 400, 800, 300, 1000, 1200];
    for (const size of resizeSizes) {
        result = scanResized(img, size);
        if (result.success) {
            console.log(`QR Scan: Success with resized-${size} strategy`);
            return { ...result, strategy: `resized-${size}` };
        }
    }

    // Strategy 3: Scan center crop (QR code is usually in center)
    const cropPercentages = [
        { x: 10, y: 20, w: 80, h: 60 },  // Skip header/footer, focus on middle
        { x: 15, y: 25, w: 70, h: 50 },  // Tighter center crop
        { x: 5, y: 15, w: 90, h: 70 },   // Wider center crop
        { x: 20, y: 30, w: 60, h: 40 },  // Very tight center
        { x: 0, y: 10, w: 100, h: 80 },  // Full width, skip top/bottom
    ];
    for (const crop of cropPercentages) {
        result = scanCenterCrop(img, crop.x, crop.y, crop.w, crop.h);
        if (result.success) {
            console.log(`QR Scan: Success with center-crop strategy`);
            return { ...result, strategy: 'center-crop' };
        }
    }

    // Strategy 4: Grayscale with contrast enhancement
    result = scanWithPreprocessing(img);
    if (result.success) {
        console.log('QR Scan: Success with preprocessed strategy');
        return { ...result, strategy: 'preprocessed' };
    }

    // Strategy 5: Try different binarization thresholds
    for (const threshold of [128, 100, 80, 150, 180, 60, 200]) {
        result = scanBinarized(img, threshold);
        if (result.success) {
            console.log(`QR Scan: Success with binarized-${threshold} strategy`);
            return { ...result, strategy: `binarized-${threshold}` };
        }
    }

    // Strategy 6: Combine resize + preprocessing
    for (const size of [500, 600, 400]) {
        result = scanResizedWithPreprocessing(img, size);
        if (result.success) {
            console.log(`QR Scan: Success with resized-preprocessed-${size} strategy`);
            return { ...result, strategy: `resized-preprocessed-${size}` };
        }
    }

    console.warn('QR Scan: All strategies failed');
    return { success: false, data: null, strategy: 'none' };
}

function scanDirect(img: HTMLImageElement): ScanResult {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return { success: false, data: null, strategy: 'direct' };

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
    });

    if (code) {
        return { success: true, data: code.data, strategy: 'direct' };
    }
    return { success: false, data: null, strategy: 'direct' };
}

function scanResized(img: HTMLImageElement, maxSize: number): ScanResult {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return { success: false, data: null, strategy: 'resized' };

    // Calculate new dimensions maintaining aspect ratio
    let newWidth = img.width;
    let newHeight = img.height;

    if (img.width > img.height) {
        if (img.width > maxSize) {
            newWidth = maxSize;
            newHeight = (img.height / img.width) * maxSize;
        }
    } else {
        if (img.height > maxSize) {
            newHeight = maxSize;
            newWidth = (img.width / img.height) * maxSize;
        }
    }

    canvas.width = newWidth;
    canvas.height = newHeight;

    // Use high-quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
    });

    if (code) {
        return { success: true, data: code.data, strategy: 'resized' };
    }
    return { success: false, data: null, strategy: 'resized' };
}

function scanCenterCrop(
    img: HTMLImageElement,
    xPercent: number,
    yPercent: number,
    widthPercent: number,
    heightPercent: number
): ScanResult {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return { success: false, data: null, strategy: 'center-crop' };

    // Calculate crop coordinates
    const sx = (xPercent / 100) * img.width;
    const sy = (yPercent / 100) * img.height;
    const sWidth = (widthPercent / 100) * img.width;
    const sHeight = (heightPercent / 100) * img.height;

    canvas.width = sWidth;
    canvas.height = sHeight;
    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'attemptBoth',
    });

    if (code) {
        return { success: true, data: code.data, strategy: 'center-crop' };
    }
    return { success: false, data: null, strategy: 'center-crop' };
}

function scanWithPreprocessing(img: HTMLImageElement): ScanResult {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return { success: false, data: null, strategy: 'preprocessed' };

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Convert to grayscale and enhance contrast
    for (let i = 0; i < data.length; i += 4) {
        // Calculate grayscale using luminance formula
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

        // Apply contrast enhancement
        const contrast = 1.5; // Increase contrast
        const enhanced = ((gray - 128) * contrast) + 128;
        const final = Math.max(0, Math.min(255, enhanced));

        data[i] = final;     // R
        data[i + 1] = final; // G
        data[i + 2] = final; // B
        // Alpha stays the same
    }

    ctx.putImageData(imageData, 0, 0);

    const processedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(processedImageData.data, processedImageData.width, processedImageData.height, {
        inversionAttempts: 'attemptBoth',
    });

    if (code) {
        return { success: true, data: code.data, strategy: 'preprocessed' };
    }
    return { success: false, data: null, strategy: 'preprocessed' };
}

function scanBinarized(img: HTMLImageElement, threshold: number): ScanResult {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return { success: false, data: null, strategy: 'binarized' };

    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Binarize: convert to pure black and white
    for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const binary = gray > threshold ? 255 : 0;

        data[i] = binary;     // R
        data[i + 1] = binary; // G
        data[i + 2] = binary; // B
    }

    ctx.putImageData(imageData, 0, 0);

    const processedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(processedImageData.data, processedImageData.width, processedImageData.height, {
        inversionAttempts: 'attemptBoth',
    });

    if (code) {
        return { success: true, data: code.data, strategy: 'binarized' };
    }
    return { success: false, data: null, strategy: 'binarized' };
}

function scanResizedWithPreprocessing(img: HTMLImageElement, maxSize: number): ScanResult {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return { success: false, data: null, strategy: 'resized-preprocessed' };

    // Calculate new dimensions maintaining aspect ratio
    let newWidth = img.width;
    let newHeight = img.height;

    if (img.width > img.height) {
        if (img.width > maxSize) {
            newWidth = maxSize;
            newHeight = (img.height / img.width) * maxSize;
        }
    } else {
        if (img.height > maxSize) {
            newHeight = maxSize;
            newWidth = (img.width / img.height) * maxSize;
        }
    }

    canvas.width = newWidth;
    canvas.height = newHeight;

    // Use high-quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    // Apply preprocessing
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const contrast = 1.5;
        const enhanced = ((gray - 128) * contrast) + 128;
        const final = Math.max(0, Math.min(255, enhanced));

        data[i] = final;
        data[i + 1] = final;
        data[i + 2] = final;
    }

    ctx.putImageData(imageData, 0, 0);

    const processedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(processedImageData.data, processedImageData.width, processedImageData.height, {
        inversionAttempts: 'attemptBoth',
    });

    if (code) {
        return { success: true, data: code.data, strategy: 'resized-preprocessed' };
    }
    return { success: false, data: null, strategy: 'resized-preprocessed' };
}
