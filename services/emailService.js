const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM   = process.env.EMAIL_FROM || "onboarding@resend.dev";
const APP_URL = process.env.FRONTEND_URL || "http://localhost:5173";

/**
 * Sends an email verification link to a newly registered user.
 */
const sendVerificationEmail = async (email, name, token) => {
  const link = `${APP_URL}/verify-email?token=${token}`;
  await resend.emails.send({
    from:    FROM,
    to:      email,
    subject: "Verify your Pathways account",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px">
        <h2 style="color:#1e1b4b">Welcome to Pathways, ${name}!</h2>
        <p style="color:#374151">Please verify your email address to activate your account.</p>
        <a href="${link}"
          style="display:inline-block;margin:24px 0;padding:12px 28px;
                 background:#7c3aed;color:#fff;border-radius:8px;
                 text-decoration:none;font-weight:700">
          Verify Email
        </a>
        <p style="color:#6b7280;font-size:13px">
          This link expires in 24 hours. If you didn't create an account, ignore this email.
        </p>
        <p style="color:#6b7280;font-size:12px">Or paste this link: ${link}</p>
      </div>`,
  });
};

/**
 * Sends a password reset link to the user.
 */
const sendPasswordResetEmail = async (email, name, token) => {
  const link = `${APP_URL}/reset-password?token=${token}`;
  await resend.emails.send({
    from:    FROM,
    to:      email,
    subject: "Reset your Pathways password",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px">
        <h2 style="color:#1e1b4b">Reset your password</h2>
        <p style="color:#374151">Hi ${name}, we received a request to reset your password.</p>
        <a href="${link}"
          style="display:inline-block;margin:24px 0;padding:12px 28px;
                 background:#7c3aed;color:#fff;border-radius:8px;
                 text-decoration:none;font-weight:700">
          Reset Password
        </a>
        <p style="color:#6b7280;font-size:13px">
          This link expires in 1 hour. If you didn't request this, ignore this email.
        </p>
        <p style="color:#6b7280;font-size:12px">Or paste this link: ${link}</p>
      </div>`,
  });
};

/**
 * Sends a badge award notification email.
 */
const sendBadgeEmail = async (email, name, badgeTitle, badgeDescription) => {
  await resend.emails.send({
    from:    FROM,
    to:      email,
    subject: `🏅 You earned a badge: ${badgeTitle}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px">
        <h2 style="color:#1e1b4b">Congratulations, ${name}!</h2>
        <div style="background:#ede9fe;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
          <div style="font-size:40px">🏅</div>
          <h3 style="color:#5b21b6;margin:8px 0">${badgeTitle}</h3>
          <p style="color:#374151;margin:0">${badgeDescription}</p>
        </div>
        <p style="color:#6b7280;font-size:13px">
          Keep going — log in to Pathways to continue your learning journey.
        </p>
      </div>`,
  });
};

module.exports = { sendVerificationEmail, sendPasswordResetEmail, sendBadgeEmail };