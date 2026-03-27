const nodemailer = require("nodemailer");

// ── Brevo (formerly Sendinblue) SMTP transporter ─────────────────
// Free tier: 300 emails/day, no domain verification needed
// Just verify your sender email address in Brevo dashboard
// Get SMTP credentials at: https://app.brevo.com → Settings → SMTP & API
const transporter = nodemailer.createTransport({
  host:   "smtp-relay.brevo.com",
  port:   587,
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_LOGIN,   // your Brevo account email
    pass: process.env.BREVO_SMTP_KEY,     // SMTP key from Brevo dashboard
  },
});

const FROM    = process.env.EMAIL_FROM;   // e.g. noreply@youremail.com (must be verified in Brevo)
const APP_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// ── Base email template ──────────────────────────────────────────
const baseTemplate = (content) => `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:0">
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

// ── Send helper ──────────────────────────────────────────────────
const sendEmail = async (to, subject, html) => {
  try {
    const info = await transporter.sendMail({
      from:    `"Pathways" <${FROM}>`,
      to,
      subject,
      html,
    });
    console.log(`[Email] Sent to ${to} — Message ID: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`[Email] Failed to send to ${to}:`, error.message);
    return false;
  }
};

// ── Verification email ───────────────────────────────────────────
const sendVerificationEmail = async (email, name, token) => {
  const link = `${APP_URL}/verify-email?token=${token}`;
  const html = baseTemplate(`
    <h2 style="color:#1e1b4b;margin:0 0 8px 0">Welcome to Pathways, ${name}!</h2>
    <p style="color:#374151;margin:0 0 24px 0">
      Please verify your email address to activate your account and start your learning journey.
    </p>
    <a href="${link}"
      style="display:inline-block;padding:12px 28px;background:#7c3aed;
             color:#ffffff;border-radius:8px;text-decoration:none;
             font-weight:700;font-size:15px">
      Verify Email Address
    </a>
    <p style="color:#6b7280;font-size:13px;margin:24px 0 0 0">
      This link expires in <strong>24 hours</strong>.
    </p>
    <p style="color:#9ca3af;font-size:12px;margin:8px 0 0 0">
      Or copy and paste this link: ${link}
    </p>
  `);
  return sendEmail(email, "Verify your Pathways account", html);
};

// ── Password reset email ─────────────────────────────────────────
const sendPasswordResetEmail = async (email, name, token) => {
  const link = `${APP_URL}/reset-password?token=${token}`;
  const html = baseTemplate(`
    <h2 style="color:#1e1b4b;margin:0 0 8px 0">Reset your password</h2>
    <p style="color:#374151;margin:0 0 6px 0">Hi ${name},</p>
    <p style="color:#374151;margin:0 0 24px 0">
      We received a request to reset your Pathways password.
      Click the button below to choose a new one.
    </p>
    <a href="${link}"
      style="display:inline-block;padding:12px 28px;background:#7c3aed;
             color:#ffffff;border-radius:8px;text-decoration:none;
             font-weight:700;font-size:15px">
      Reset Password
    </a>
    <p style="color:#6b7280;font-size:13px;margin:24px 0 0 0">
      This link expires in <strong>1 hour</strong>.
      If you did not request a password reset, you can safely ignore this email.
    </p>
    <p style="color:#9ca3af;font-size:12px;margin:8px 0 0 0">
      Or copy and paste this link: ${link}
    </p>
  `);
  return sendEmail(email, "Reset your Pathways password", html);
};

// ── Badge award email ────────────────────────────────────────────
const sendBadgeEmail = async (email, name, badgeTitle, badgeDescription) => {
  const html = baseTemplate(`
    <h2 style="color:#1e1b4b;margin:0 0 8px 0">You earned a badge!</h2>
    <p style="color:#374151;margin:0 0 16px 0">
      Congratulations ${name}, keep up the great work!
    </p>
    <div style="background:#ede9fe;border-radius:12px;padding:24px;text-align:center;margin:0 0 20px 0">
      <div style="font-size:44px;margin-bottom:10px">🏅</div>
      <h3 style="color:#5b21b6;margin:0 0 6px 0;font-size:18px">${badgeTitle}</h3>
      <p style="color:#374151;margin:0;font-size:14px">${badgeDescription}</p>
    </div>
    <a href="${APP_URL}"
      style="display:inline-block;padding:10px 24px;background:#7c3aed;
             color:#ffffff;border-radius:8px;text-decoration:none;
             font-weight:600;font-size:14px">
      Continue Learning →
    </a>
  `);
  return sendEmail(email, `🏅 Badge earned: ${badgeTitle}`, html);
};

module.exports = {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendBadgeEmail,
};