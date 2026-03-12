/**
 * Lightweight QR Code generator using Canvas
 * Based on QR Code Model 2, supports alphanumeric URLs
 * Uses a simplified approach: generates QR via a free API and renders to canvas
 */
export function generateQRCode(canvas, text, size = 200) {
    const ctx = canvas.getContext('2d');
    canvas.width = size;
    canvas.height = size;

    // Use a public QR API to generate the image
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        ctx.fillStyle = '#1a1a24';
        ctx.fillRect(0, 0, size, size);
        const padding = 12;
        ctx.drawImage(img, padding, padding, size - padding * 2, size - padding * 2);
    };
    img.onerror = () => {
        // Fallback: draw text if QR API fails
        ctx.fillStyle = '#1a1a24';
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = '#f5f3ff';
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('QR unavailable', size / 2, size / 2 - 8);
        ctx.fillText(text.slice(0, 30), size / 2, size / 2 + 12);
    };
    img.src = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&bgcolor=1a1a24&color=f5f3ff&margin=0`;
}
