import nodemailer from "nodemailer";

export default async function handler(req, res) {
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
    const { email, appPassword, senderName, host, port, testTarget } = req.body || {};

    if (!email || !appPassword) {
      return res.status(400).json({
        success: false,
        error: "Gmail address and 16-character App Password are required."
      });
    }

    const cleanPassword = (appPassword || '').replace(/\s+/g, '');
    const cleanHost = host || 'smtp.gmail.com';
    const cleanPort = Number(port) || 587;

    const transporter = nodemailer.createTransport({
      host: cleanHost,
      port: cleanPort,
      secure: cleanPort === 465,
      auth: {
        user: email,
        pass: cleanPassword,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    await transporter.verify();

    const recipient = testTarget && testTarget.trim() ? testTarget.trim() : email;
    const info = await transporter.sendMail({
      from: `"${senderName || 'BETGURU Security Team'}" <${email}>`,
      to: recipient,
      subject: "⚡ BETGURU Gmail SMTP Test Connection Success",
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #020617; color: #f8fafc; padding: 28px; border-radius: 20px; border: 1px solid #a855f7; max-width: 550px; margin: 0 auto;">
          <div style="text-align: center; margin-bottom: 20px;">
            <span style="background: rgba(168,85,247,0.2); color: #c084fc; border: 1px solid rgba(168,85,247,0.4); padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: bold; letter-spacing: 1px;">BETGURU LOTTERY • GMAIL SMTP</span>
            <h2 style="color: #fbbf24; font-size: 22px; margin: 12px 0 4px 0; font-weight: 900;">SMTP Connection Active!</h2>
            <p style="color: #94a3b8; font-size: 13px; margin: 0;">Test verification email dispatched successfully</p>
          </div>
          <div style="background: #0f172a; padding: 18px; border-radius: 14px; border-left: 4px solid #10b981; margin-bottom: 20px;">
            <p style="margin: 0 0 6px 0; font-size: 13px; color: #cbd5e1;"><strong>Sender Account:</strong> <span style="color: #f8fafc;">${email}</span></p>
            <p style="margin: 0 0 6px 0; font-size: 13px; color: #cbd5e1;"><strong>Display Name:</strong> <span style="color: #c084fc;">${senderName || 'BETGURU Security Team'}</span></p>
            <p style="margin: 0 0 6px 0; font-size: 13px; color: #cbd5e1;"><strong>SMTP Server:</strong> <span style="color: #f8fafc;">${cleanHost}:${cleanPort}</span></p>
            <p style="margin: 0; font-size: 13px; color: #cbd5e1;"><strong>Status:</strong> <span style="color: #34d399; font-weight: bold;">HTTP 200 OK • Handshake Verified</span></p>
          </div>
          <p style="color: #64748b; font-size: 11px; text-align: center; margin: 0;">
            BETGURU Automated Security Infrastructure • ${new Date().toLocaleString('en-IN')}
          </p>
        </div>
      `
    });

    return res.status(200).json({
      success: true,
      message: `SMTP connection verified! Sent test email to ${recipient}.`,
      messageId: info.messageId
    });
  } catch (err) {
    console.error("Vercel test-smtp Error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to connect to SMTP server."
    });
  }
}
