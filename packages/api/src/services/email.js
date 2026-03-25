import { Resend } from 'resend';

let resend = null;

function getResend() {
    if (resend) return resend;
    const key = process.env.RESEND_API_KEY;
    if (!key) {
        console.warn('⚠️  Email not configured (missing RESEND_API_KEY)');
        return null;
    }
    resend = new Resend(key);
    return resend;
}

const CATEGORY_LABELS = {
    'bug': '🐛 Bug Report',
    'feature-request': '💡 Feature Request',
    'ui-ux': '🎨 UI/UX',
    'music': '🎵 Music',
    'other': '📝 Other',
};

export async function sendFeedbackNotification({ userName, userEmail, category, subject, message, screenshotUrl }) {
    const client = getResend();
    const adminEmail = process.env.ADMIN_EMAIL;

    if (!client || !adminEmail) {
        console.warn('⚠️  Skipping feedback email (not configured)');
        return false;
    }

    const categoryLabel = CATEGORY_LABELS[category] || category;
    const screenshotHtml = screenshotUrl
        ? `<div style="margin-top: 16px;"><p style="color: #7c6fa0; font-size: 12px; margin-bottom: 8px;">📎 Screenshot</p><img src="${screenshotUrl}" style="max-width: 100%; border-radius: 8px; border: 1px solid #2a2a3d;" /></div>`
        : '';

    try {
        await client.emails.send({
            from: 'SoundDen <onboarding@resend.dev>',
            to: adminEmail,
            subject: `[SoundDen] ${categoryLabel}: ${subject}`,
            html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; background: #1a1625; color: #e2e0f0; padding: 32px; border-radius: 16px;">
          <h2 style="color: #a78bfa; margin-top: 0;">New Feedback Received</h2>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
            <tr><td style="padding: 8px 0; color: #7c6fa0; width: 100px;">From</td><td style="color: #e2e0f0;">${userName} (${userEmail})</td></tr>
            <tr><td style="padding: 8px 0; color: #7c6fa0;">Category</td><td style="color: #e2e0f0;">${categoryLabel}</td></tr>
            <tr><td style="padding: 8px 0; color: #7c6fa0;">Subject</td><td style="color: #e2e0f0; font-weight: 600;">${subject}</td></tr>
          </table>
          <div style="background: #16131f; padding: 16px; border-radius: 8px; border-left: 3px solid #8b5cf6;">
            <p style="margin: 0; white-space: pre-wrap; line-height: 1.6;">${message}</p>
          </div>
          ${screenshotHtml}
          <p style="color: #7c6fa0; font-size: 12px; margin-top: 24px;">Reply via SoundDen Admin Panel</p>
        </div>
      `,
        });
        console.log('📧 Feedback email sent to', adminEmail);
        return true;
    } catch (err) {
        console.error('❌ Failed to send feedback email:', err.message);
        return false;
    }
}
