import nodemailer from 'nodemailer';

export function getEmailCredentials() {
  const user = (process.env.EMAIL_USER || '').trim();
  const pass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '');
  return { user, pass };
}

export function isEmailConfigured() {
  const { user, pass } = getEmailCredentials();
  return Boolean(user && pass);
}

function createMailTransporter() {
  const { user, pass } = getEmailCredentials();
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass },
  });
}

export function buildResetLink(appOrigin, token) {
  const base = String(appOrigin || '').replace(/\/$/, '') || 'http://localhost:5173';
  return `${base}/reset-password?token=${encodeURIComponent(token)}`;
}

export async function sendPasswordResetEmail({ to, resetLink }) {
  const { user, pass } = getEmailCredentials();
  if (!user || !pass) {
    const err = new Error('Email configuration missing: EMAIL_USER or EMAIL_PASS not set');
    err.code = 'EMAIL_NOT_CONFIGURED';
    err.resetLink = resetLink;
    throw err;
  }

  const transporter = createMailTransporter();
  try {
    const info = await transporter.sendMail({
      from: `"Presence" <${user}>`,
      to,
      subject: 'Reset your Presence password',
      html: `
        <p>Hello,</p>
        <p>You requested a password reset for your Presence school attendance account.</p>
        <p>
          <a href="${resetLink}" style="display:inline-block;padding:10px 16px;background-color:#1e3a8a;color:#ffffff;text-decoration:none;border-radius:8px;">
            Reset password
          </a>
        </p>
        <p>Or copy this link:</p>
        <p>${resetLink}</p>
        <p>This link expires in 15 minutes.</p>
        <p>If you did not request this, you can ignore this email.</p>
        <p>— Presence</p>
      `,
    });
    return { resetLink, messageId: info.messageId };
  } catch (err) {
    console.error('[mailer] Failed to send password reset email', err);
    const wrapped = new Error(
      err.code === 'EAUTH' || err.responseCode === 534 || err.responseCode === 535
        ? 'Gmail rejected EMAIL_USER/EMAIL_PASS. Create a new App Password and update EMAIL_PASS.'
        : err.code === 'ECONNECTION'
          ? 'Could not connect to the email server.'
          : `Failed to send reset email: ${err.message}`
    );
    wrapped.code = err.code || 'EMAIL_SEND_FAILED';
    wrapped.resetLink = resetLink;
    throw wrapped;
  }
}
