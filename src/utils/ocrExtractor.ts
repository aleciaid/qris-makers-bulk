import Tesseract from 'tesseract.js';

// Default coordinates based on the sample QRIS image
// These are percentages of the image dimensions
export interface OCRRegion {
    x: number;      // percentage from left (0-100)
    y: number;      // percentage from top (0-100)
    width: number;  // percentage of width (0-100)
    height: number; // percentage of height (0-100)
}

export interface OCRSettings {
    subtitleRegion: OCRRegion;
    footerCodeRegion: OCRRegion;
    enableAutoDetect: boolean;
}

// Default regions based on the provided sample QRIS image
// - Subtitle (RED box): "PKM SIDODADI-R4" - positioned below title, center
// - Footer Code (BLUE box): "PKM-SIDODADI-R2" - positioned at bottom right
// Note: Nominal is NOT extracted via OCR - it comes from the QRIS code data directly
export const DEFAULT_OCR_SETTINGS: OCRSettings = {
    enableAutoDetect: true,
    // Subtitle area (RED box) - "PKM SIDODADI-R4"
    // Located below the title "RETRIBUSI PARKIR KAB SDA", centered
    // Important: Y must be low enough to NOT capture the title
    subtitleRegion: {
        x: 15,      // Start from ~15% left to capture centered text
        y: 19,      // ~19% from top (below the title which ends around 16%)
        width: 70,  // ~70% width to capture full centered text
        height: 5   // ~5% height for single line
    },
    // Footer Code area (BLUE box) - "PKM-SIDODADI-R2" at bottom right
    // Located at bottom right, above the nominal
    footerCodeRegion: {
        x: 50,      // ~50% from left (right half of image)
        y: 80,      // ~80% from top
        width: 48,  // ~48% width (covers right side)
        height: 5   // ~5% height for single line
    }
};

/**
 * Crops a region from the image and returns it as a data URL
 */
export function cropImageRegion(
    img: HTMLImageElement,
    region: OCRRegion
): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('Could not get canvas context');

    // Calculate actual pixel coordinates
    const x = (region.x / 100) * img.width;
    const y = (region.y / 100) * img.height;
    const width = (region.width / 100) * img.width;
    const height = (region.height / 100) * img.height;

    canvas.width = width;
    canvas.height = height;

    // Draw the cropped region
    ctx.drawImage(
        img,
        x, y, width, height,  // Source rectangle
        0, 0, width, height   // Destination rectangle
    );

    // Apply image preprocessing for better OCR
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Convert to grayscale and increase contrast
    for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        // Increase contrast
        const contrast = 1.5;
        const newGray = Math.min(255, Math.max(0, (gray - 128) * contrast + 128));
        data[i] = newGray;
        data[i + 1] = newGray;
        data[i + 2] = newGray;
    }

    ctx.putImageData(imageData, 0, 0);

    return canvas;
}

/**
 * Extracts text from a specific region of an image using Tesseract OCR
 */
export async function extractTextFromRegion(
    img: HTMLImageElement,
    region: OCRRegion
): Promise<string> {
    try {
        const croppedCanvas = cropImageRegion(img, region);

        const result = await Tesseract.recognize(
            croppedCanvas.toDataURL(),
            'eng+ind', // Support both English and Indonesian
            {
                // logger: m => console.log(m) // Uncomment for debugging
            }
        );

        // Clean up the extracted text
        return result.data.text.trim().replace(/\n/g, ' ').replace(/\s+/g, ' ');
    } catch (error) {
        console.error('OCR extraction failed:', error);
        return '';
    }
}

/**
 * Extracts subtitle and footer code from a QRIS image
 * Note: Nominal is taken from QRIS code data, not OCR
 */
export async function extractQRISFields(
    img: HTMLImageElement,
    settings: OCRSettings
): Promise<{ subtitle: string; footerCode: string }> {
    if (!settings.enableAutoDetect) {
        return { subtitle: '', footerCode: '' };
    }

    // Run extractions in parallel
    const [subtitle, footerCode] = await Promise.all([
        extractTextFromRegion(img, settings.subtitleRegion),
        extractTextFromRegion(img, settings.footerCodeRegion)
    ]);

    return {
        subtitle: cleanSubtitle(subtitle),
        footerCode: cleanFooterCode(footerCode)
    };
}

/**
 * Clean extracted subtitle text
 */
function cleanSubtitle(text: string): string {
    // Remove common OCR artifacts
    return text
        .replace(/[^\w\s\-]/g, '')
        .trim()
        .toUpperCase();
}

/**
 * Clean extracted footer code text
 */
function cleanFooterCode(text: string): string {
    // Remove common OCR artifacts, keep alphanumeric and hyphens
    return text
        .replace(/[^\w\s\-]/g, '')
        .trim()
        .toUpperCase();
}

/**
 * Preview extraction regions on an image (for debugging/setup)
 * Note: Nominal is NOT included as it's taken from QRIS code data
 */
export function drawRegionsOnImage(
    img: HTMLImageElement,
    settings: OCRSettings
): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('Could not get canvas context');

    canvas.width = img.width;
    canvas.height = img.height;

    // Draw the original image
    ctx.drawImage(img, 0, 0);

    // Draw regions - colors match user's marking:
    // RED = Subtitle, BLUE = Footer Code
    const regions = [
        { region: settings.subtitleRegion, color: '#EF4444', label: 'Subtitle' },
        { region: settings.footerCodeRegion, color: '#3B82F6', label: 'Footer' }
    ];

    regions.forEach(({ region, color, label }) => {
        const x = (region.x / 100) * img.width;
        const y = (region.y / 100) * img.height;
        const width = (region.width / 100) * img.width;
        const height = (region.height / 100) * img.height;

        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);

        ctx.fillStyle = color;
        ctx.font = 'bold 14px sans-serif';
        ctx.fillText(label, x + 5, y - 5);
    });

    return canvas;
}
