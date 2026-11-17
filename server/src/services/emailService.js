const nodemailer = require('nodemailer');

let transporter = null;

/**
 * Returns a configured nodemailer transporter for sending real emails
 */
const getTransporter = () => {
  const emailUser = (process.env.EMAIL_USER || 'aryakarande45@gmail.com').trim();
  const rawPass = (process.env.EMAIL_PASS || 'tjbpfmtmralpzwsz').trim();
  const emailPass = rawPass.replace(/\s+/g, '');

  if (
    !emailUser ||
    !emailPass ||
    emailPass.includes('placeholder') ||
    emailPass === 'your_16_character_app_password'
  ) {
    return null;
  }

  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });
  }

  return transporter;
};

/**
 * Send a styled, authentic Myntra OTP verification email
 */
exports.sendOtpEmail = async ({ to, otp, name }) => {
  const cleanEmail = (to || '').trim().toLowerCase();
  const cleanOtp = (otp || '').toString().trim();
  const userName = name || 'Fashion Enthusiast';

  const mailTransporter = getTransporter();

  // If credentials are not yet configured in server/.env, simulate safely in dev mode
  if (!mailTransporter) {
    console.log(
      `\x1b[33m[EMAIL OTP DEV SIMULATION]\x1b[0m Recipient: ${cleanEmail} | OTP: \x1b[32m${cleanOtp}\x1b[0m (Configure EMAIL_USER & EMAIL_PASS in server/.env for live delivery)`
    );
    return {
      success: true,
      live: false,
      devOtp: cleanOtp,
      message: 'Email OTP simulated in development mode.',
    };
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <title>Myntra Verification Code</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f5f5f6; margin: 0; padding: 24px;">
      <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); border: 1px solid #eaeaec;">
        <!-- Brand Header -->
        <div style="background: linear-gradient(135deg, #ff3f6c 0%, #ff527b 100%); padding: 28px 20px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 26px; letter-spacing: 3px; font-weight: 800;">MYNTRA</h1>
          <p style="color: rgba(255,255,255,0.92); margin: 6px 0 0 0; font-size: 13px; font-weight: 500;">Fashion & Lifestyle</p>
        </div>

        <!-- Body Content -->
        <div style="padding: 32px 28px; text-align: center;">
          <h2 style="color: #282c3f; margin-top: 0; font-size: 20px; font-weight: 700;">Hello ${userName},</h2>
          <p style="color: #535766; font-size: 14px; line-height: 22px; margin: 8px 0 24px 0;">
            Use the One-Time Password (OTP) below to authenticate your Myntra account.
          </p>

          <!-- OTP Box -->
          <div style="background: #fff5f7; border: 2px dashed #ff3f6c; border-radius: 10px; padding: 18px 24px; margin: 0 auto 24px auto; display: inline-block;">
            <span style="font-size: 38px; font-weight: 800; letter-spacing: 8px; color: #ff3f6c; font-family: monospace;">${cleanOtp}</span>
          </div>

          <p style="color: #535766; font-size: 13px; margin: 0 0 12px 0;">
            This OTP is valid for <strong>5 minutes</strong>.
          </p>
          <p style="color: #94969f; font-size: 12px; line-height: 18px; margin: 0;">
            ⚠️ Do not share this OTP with anyone, including Myntra employees.
          </p>
        </div>

        <!-- Footer -->
        <div style="background: #fafbfc; border-top: 1px solid #eeeeee; padding: 16px; text-align: center;">
          <p style="color: #94969f; font-size: 11px; margin: 0;">
            If you did not request this OTP, you can safely ignore this email.
          </p>
          <p style="color: #b0b2b8; font-size: 10px; margin: 6px 0 0 0;">
            © ${new Date().getFullYear()} Myntra Fashion Clone. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const fromAddress = (process.env.EMAIL_USER || 'aryakarande45@gmail.com').trim();
    const info = await mailTransporter.sendMail({
      from: `"Myntra Fashion" <${fromAddress}>`,
      to: cleanEmail,
      subject: `[Myntra] ${cleanOtp} is your verification OTP`,
      text: `Hello ${userName},\n\nYour Myntra verification OTP is: ${cleanOtp}\n\nThis OTP is valid for 5 minutes. Do not share it with anyone.`,
      html: htmlContent,
    });

    console.log(`\x1b[32m[EMAIL OTP DISPATCHED]\x1b[0m Successfully sent to ${cleanEmail}. MessageId: ${info.messageId}`);
    return {
      success: true,
      live: true,
      messageId: info.messageId,
      message: 'OTP delivered to your email in real-time.',
    };
  } catch (err) {
    console.error(`\x1b[31m[EMAIL OTP ERROR]\x1b[0m Failed to send email to ${cleanEmail}:`, err.message);
    return {
      success: false,
      live: false,
      error: err.message,
    };
  }
};
