import nodemailer from "nodemailer";

export default async function handler(req, res) {
  // Set no-cache and CORS headers
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { email, otp, name, type, smtp } = req.body || {};

    if (!email || !otp || !smtp || !smtp.email || !smtp.appPassword) {
      return res.status(400).json({
        success: false,
        error: "Target email, OTP code, and SMTP credentials are required."
      });
    }

    const cleanPassword = (smtp.appPassword || '').replace(/\s+/g, '');
    const host = smtp.host || 'smtp.gmail.com';
    const port = Number(smtp.port) || 587;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: {
        user: smtp.email,
        pass: cleanPassword,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    const isPasswordReset = type === 'forgot_password' || type === 'password_reset';
    const subject = isPasswordReset
      ? `🔐 BETGURU Password Reset OTP Code: ${otp}`
      : type === 'registration'
      ? `🔐 Your BETGURU Registration OTP Code: ${otp}`
      : `🔐 Your BETGURU Security Verification OTP: ${otp}`;

    const info = await transporter.sendMail({
      from: `"${smtp.senderName || 'BETGURU Security Team'}" <${smtp.email}>`,
      to: email,
      subject,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #020617; color: #f8fafc; padding: 32px 24px; border-radius: 24px; border: 1px solid #f59e0b; max-width: 520px; margin: 0 auto; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; background: linear-gradient(135deg, rgba(245,158,11,0.2), rgba(234,179,8,0.2)); border: 1px solid rgba(245,158,11,0.4); padding: 6px 16px; border-radius: 9999px; font-size: 11px; font-weight: 800; color: #fbbf24; letter-spacing: 1.5px;">
              BETGURU OFFICIAL VERIFICATION
            </div>
            <h1 style="color: #ffffff; font-size: 24px; font-weight: 900; margin: 16px 0 4px 0; letter-spacing: 1px;">
              BETGURU <span style="color: #fbbf24;">LOTTERY</span>
            </h1>
            <p style="color: #94a3b8; font-size: 13px; margin: 0;">${isPasswordReset ? 'Password Reset Verification' : "India's Premier HD Real-Time Lottery Platform"}</p>
          </div>

          <div style="background: #0f172a; border: 1px solid #1e293b; border-radius: 18px; padding: 24px; text-align: center; margin-bottom: 24px;">
            <p style="color: #cbd5e1; font-size: 14px; margin: 0 0 16px 0;">
              ${isPasswordReset 
                ? 'We received a request to reset your BETGURU account password. Use this OTP code to verify your identity and set a new password:' 
                : `Hello <strong>${name || 'Player'}</strong>, use the one-time verification code below to complete your registration and activate your <strong>₹100 Free Bonus</strong>:`}
            </p>

            <div style="background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%); border: 2px dashed #f59e0b; border-radius: 14px; padding: 18px; margin: 16px 0; display: inline-block; min-width: 220px;">
              <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #fbbf24; text-shadow: 0 0 20px rgba(245,158,11,0.5);">
                ${otp}
              </span>
            </div>

            <p style="color: #ef4444; font-size: 11px; margin: 12px 0 0 0; font-weight: 600;">
              ⏱️ Valid for 10 minutes. Do NOT share this OTP with anyone.
            </p>
          </div>

          <div style="text-align: center; border-top: 1px solid #1e293b; padding-top: 16px;">
            <p style="color: #64748b; font-size: 11px; line-height: 1.5; margin: 0;">
              If you did not request this code, please ignore this email.<br/>
              © ${new Date().getFullYear()} BETGURU Lottery & Casino. 256-Bit SSL Encrypted.
            </p>
          </div>

        </div>
      `
    });

    return res.status(200).json({
      success: true,
      message: `OTP sent successfully to ${email}`,
      messageId: info.messageId
    });
  } catch (err) {
    console.error("Vercel send-otp Error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to send OTP via SMTP."
    });
  }
}
