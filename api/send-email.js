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
    const { to, subject, html, text, smtp } = req.body || {};

    if (!to || !smtp || !smtp.email || !smtp.appPassword) {
      return res.status(400).json({
        success: false,
        error: "Recipient email and SMTP credentials are required."
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

    const info = await transporter.sendMail({
      from: `"${smtp.senderName || 'BETGURU Security'}" <${smtp.email}>`,
      to,
      subject: subject || 'BETGURU Notification',
      text: text || '',
      html: html || `<p>${text}</p>`
    });

    return res.status(200).json({
      success: true,
      message: `Email sent to ${to}`,
      messageId: info.messageId
    });
  } catch (err) {
    console.error("Vercel send-email Error:", err);
    return res.status(500).json({
      success: false,
      error: err.message || "Failed to send email"
    });
  }
}
