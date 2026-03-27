/**
 * emailService.js
 * Uses Brevo Transactional Email HTTP API directly via fetch.
 * No SDK needed — works on all Node.js versions and hosting platforms.
 *
 * Add to .env: BREVO_API_KEY=xkeysib-your-key-here
 */

const APP_URL    = process.env.FRONTEND_URL || "http://localhost:5173";
const FROM_EMAIL = process.env.EMAIL_FROM   || "teniolaiji@gmail.com";
const FROM_NAME  = "Pathways";
const BREVO_URL  = "https://api.brevo.com/v3/smtp/email";

// ── Core send function ───────────────────────────────────────────
const sendEmail = async (toEmail, toName, subject, htmlContent) => {
  try {
    const response = await fetch(BREVO_URL, {
      method: "POST",
      headers: {
        "accept":       "application/json",
        "content-type": "application/json",
        "api-key":      process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender:      { name: FROM_NAME, email: FROM_EMAIL },
        to:          [{ email: toEmail, name: toName }],
        subject:     subject,
        htmlContent: htmlContent,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(`[Email] Brevo API error:`, data);
      return false;
    }

    console.log(`[Email] Sent to ${toEmail} — Message ID: ${data.messageId}`);
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send to ${toEmail}:`, error.message);
    return false;
  }
};

// ── Base HTML template ───────────────────────────────────────────
const baseTemplate = (content) => `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto">
    <div style="background:#1e1b4b;padding:20px 28px;border-radius:10px 10px 0 0">
      <span style="color:#e9d5ff;font-size:20px;font-weight:700">Pathways</span>
      <span style="color:#a78bfa;font-size:12px;margin-left:8px">AI-Assisted STEAM Learning</span>
    </div>
    <div style="background:#ffffff;padding:32px 28px;border:1px solid #ede9fe;border-top:none">
      ${content}
    </div>
    <div style="background:#f5f3ff;padding:14px 28px;border-radius:0 0 10px 10px;border:1px solid #ede9fe;border-top:none">
      <p style="margin:0;font-size:11px;color:#9ca3af">
        You received this email because you have an account on Pathways.
        If you did not request this, you can safely ignore this email.
      </p>
    </div>
  </div>
`;

// ── Verification email ───────────────────────────────────────────
const sendVerificationEmail = async (email, name, token) => {
  const link = `${APP_URL}/verify-email?token=${token}`;
  return sendEmail(email, name, "Verify your Pathways account", baseTemplate(`
    <h2 style="color:#1e1b4b;margin:0 0 8px 0">Welcome to Pathways, ${name}!</h2>
    <p style="color:#374151;margin:0 0 24px 0">
      Please verify your email address to activate your account.
    </p>
    <a href="${link}" style="display:inline-block;padding:12px 28px;background:#7c3aed;
       color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">
      Verify Email Address
    </a>
    <p style="color:#6b7280;font-size:13px;margin:24px 0 4px 0">
      This link expires in <strong>24 hours</strong>.
    </p>
    <p style="color:#9ca3af;font-size:12px;margin:0">Or copy: ${link}</p>
  `));
};

// ── Password reset email ─────────────────────────────────────────
const sendPasswordResetEmail = async (email, name, token) => {
  const link = `${APP_URL}/reset-password?token=${token}`;
  return sendEmail(email, name, "Reset your Pathways password", baseTemplate(`
    <h2 style="color:#1e1b4b;margin:0 0 8px 0">Reset your password</h2>
    <p style="color:#374151;margin:0 0 6px 0">Hi ${name},</p>
    <p style="color:#374151;margin:0 0 24px 0">
      Click below to reset your Pathways password.
    </p>
    <a href="${link}" style="display:inline-block;padding:12px 28px;background:#7c3aed;
       color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">
      Reset Password
    </a>
    <p style="color:#6b7280;font-size:13px;margin:24px 0 4px 0">
      This link expires in <strong>1 hour</strong>.
    </p>
    <p style="color:#9ca3af;font-size:12px;margin:0">Or copy: ${link}</p>
  `));
};

// ── Badge award email ────────────────────────────────────────────
const sendBadgeEmail = async (email, name, badgeTitle, badgeDescription) => {
  return sendEmail(email, name, `🏅 Badge earned: ${badgeTitle}`, baseTemplate(`
    <h2 style="color:#1e1b4b;margin:0 0 8px 0">You earned a badge!</h2>
    <p style="color:#374151;margin:0 0 16px 0">Congratulations ${name}!</p>
    <div style="background:#ede9fe;border-radius:12px;padding:24px;text-align:center;margin:0 0 20px 0">
      <div style="font-size:44px;margin-bottom:10px">🏅</div>
      <h3 style="color:#5b21b6;margin:0 0 6px 0">${badgeTitle}</h3>
      <p style="color:#374151;margin:0;font-size:14px">${badgeDescription}</p>
    </div>
    <a href="${APP_URL}" style="display:inline-block;padding:10px 24px;background:#7c3aed;
       color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
      Continue Learning →
    </a>
  `));
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendBadgeEmail };