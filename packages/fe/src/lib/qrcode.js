import QRCode from 'qrcode';

/**
 * Generate QR code on a canvas element (client-side, offline)
 */
export async function generateQRCode(canvas, text, size = 200) {
    try {
        await QRCode.toCanvas(canvas, text, {
            width: size,
            margin: 2,
            color: {
                dark: '#f5f3ff',
                light: '#1a1a24',
            },
            errorCorrectionLevel: 'M',
        });
    } catch {
        // Fallback: draw text if QR generation fails
        const ctx = canvas.getContext('2d');
        canvas.width = size;
        canvas.height = size;
        ctx.fillStyle = '#1a1a24';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#f5f3ff';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('QR unavailable', size / 2, size / 2 - 8);
        ctx.fillText(text.slice(0, 30), size / 2, size / 2 + 12);
    }
}

/**
 * Generate QR code as a data URL (for download)
 */
export async function generateQRDataURL(text, size = 400) {
    try {
        return await QRCode.toDataURL(text, {
            width: size,
            margin: 2,
            color: {
                dark: '#f5f3ff',
                light: '#1a1a24',
            },
            errorCorrectionLevel: 'M',
        });
    } catch {
        return null;
    }
}
