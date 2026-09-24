import express from "express";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import syncUserWalletHandler from "./api/sync-user-wallet.js";
import { initializeApp, cert, getApps, type App } from "firebase-admin/app";
import { getMessaging, type Messaging } from "firebase-admin/messaging";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // ✅ API ক্যাশ সম্পূর্ণ বন্ধ করার মিডলওয়্যার & CORS
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    next();
  });

  // Determine active Firebase Project ID dynamically
  let activeProjectId = "gen-lang-client-0707039218";
  try {
    const configPath = path.join(process.cwd(), "firebase-applet-config.json");
    if (fs.existsSync(configPath)) {
      const rawConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
      if (rawConfig.projectId) {
        activeProjectId = rawConfig.projectId;
      }
    }
  } catch (_) {}

  // Lazy Firebase Admin SDK Initialization
  let firebaseAdminApp: App | null = null;

  const getFirebaseMessagingInstance = (): Messaging | null => {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      try {
        return getMessaging(existingApps[0]);
      } catch (_) {
        return null;
      }
    }

    let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
    let projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || activeProjectId;

    if (!rawPrivateKey || rawPrivateKey.trim().length < 20) {
      try {
        const saPath = path.join(process.cwd(), "api", "_serviceAccount.json");
        if (fs.existsSync(saPath)) {
          const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
          clientEmail = sa.clientEmail || sa.client_email || clientEmail;
          rawPrivateKey = sa.privateKey || sa.private_key || rawPrivateKey;
          projectId = sa.projectId || sa.project_id || projectId;
        }
      } catch (_) {}
    }

    if (clientEmail && rawPrivateKey && clientEmail.trim().length > 3 && rawPrivateKey.trim().length > 20) {
      try {
        firebaseAdminApp = initializeApp({
          credential: cert({
            projectId,
            clientEmail: clientEmail.trim(),
            privateKey: rawPrivateKey.replace(/\\n/g, '\n').trim()
          })
        });
        console.log("🔥 Firebase Admin SDK initialized with Service Account credentials for project:", projectId);
      } catch (e: any) {
        console.info("ℹ️ Firebase Admin Service Account notice:", e.message);
        return null;
      }
    } else {
      // Without explicit service account credentials, do not attempt unauthorized ADC calls that trigger IAM errors
      return null;
    }

    const activeApp = firebaseAdminApp || (getApps().length > 0 ? getApps()[0] : null);
    if (!activeApp) {
      return null;
    }
    try {
      return getMessaging(activeApp);
    } catch (_) {
      return null;
    }
  };



  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // Helper to format SMTP errors with user-friendly actionable guidance
  const formatSmtpError = (err: any): string => {
    if (!err) return "Unknown SMTP Error";
    const msg = String(err.message || err);
    if (
      err.code === 'EAUTH' ||
      msg.includes('535') ||
      msg.includes('Username and Password not accepted') ||
      msg.includes('BadCredentials') ||
      msg.includes('Invalid login') ||
      msg.includes('5.7.8')
    ) {
      return "Gmail Login Error (535-5.7.8): Google rejected username/password. Please ensure 2-Step Verification is ON in your Google Account and use a 16-character Google App Password (not your regular Gmail password). Generate one at: https://myaccount.google.com/apppasswords";
    }
    if (err.code === 'ESOCKET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
      return `Network connection timed out while connecting to SMTP host (${err.code}). Check host and port settings.`;
    }
    return msg;
  };

  // Helper to create Nodemailer transporter with robust Gmail and fallback support
  const createTransporter = (smtp: {
    email: string;
    appPassword: string;
    host?: string;
    port?: number;
  }) => {
    const cleanEmail = (smtp.email || '').trim().toLowerCase();
    // Auto-strip spaces, dashes, quotes, and non-printable characters often accidentally copied
    const cleanPassword = (smtp.appPassword || '').replace(/[\s\-_"'\u200B-\u200D\uFEFF]/g, '').trim();
    const host = (smtp.host || '').trim();
    const port = Number(smtp.port) || 587;
    const isGmail = !host || host === 'smtp.gmail.com' || host.toLowerCase().includes('gmail') || cleanEmail.endsWith('@gmail.com');

    if (isGmail) {
      return nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: cleanEmail,
          pass: cleanPassword,
        },
        tls: {
          rejectUnauthorized: false
        }
      });
    }

    const isSecure = port === 465;
    return nodemailer.createTransport({
      host: host || 'smtp.gmail.com',
      port,
      secure: isSecure,
      auth: {
        user: cleanEmail,
        pass: cleanPassword,
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  };

  // Test SMTP connection endpoint
  app.post("/api/test-smtp", async (req, res) => {
    try {
      const { email, appPassword, senderName, host, port, testTarget } = req.body;

      if (!email || !appPassword) {
        return res.status(400).json({
          success: false,
          error: "Gmail address and 16-character App Password are required."
        });
      }

      const transporter = createTransporter({ email, appPassword, host, port });
      
      // Verify connection
      await transporter.verify();

      // Send test email
      const recipient = testTarget && testTarget.trim() ? testTarget.trim() : email;
      const info = await transporter.sendMail({
        from: `"${senderName || 'BETGURU Security Team'}" <${email.trim()}>`,
        to: recipient,
        subject: "⚡ BETGURU Gmail SMTP Test Connection Success",
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #020617; color: #f8fafc; padding: 28px; border-radius: 20px; border: 1px solid #a855f7; max-width: 550px; margin: 0 auto;">
            
            <!-- BETGURU OFFICIAL WEBSITE LOGO -->
            <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto 16px auto; text-align: left; vertical-align: middle; border-collapse: separate;">
              <tr>
                <td style="vertical-align: middle; padding-right: 12px;">
                  <table cellpadding="0" cellspacing="0" border="0" style="width: 44px; height: 44px; background: linear-gradient(135deg, #fde047 0%, #f59e0b 50%, #d97706 100%); border-radius: 12px; padding: 2px; box-shadow: 0 4px 16px rgba(245, 158, 11, 0.45);">
                    <tr>
                      <td style="background-color: #020617; border-radius: 10px; text-align: center; vertical-align: middle; height: 40px; width: 40px;">
                        <span style="font-family: 'Courier New', Courier, monospace, sans-serif; font-weight: 900; font-size: 24px; line-height: 1; color: #fbbf24; text-shadow: 0 2px 8px rgba(251, 191, 36, 0.6); display: block; margin: 0 auto;">
                          B
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
                <td style="vertical-align: middle;">
                  <table cellpadding="0" cellspacing="0" border="0" style="line-height: 1;">
                    <tr>
                      <td style="vertical-align: middle;">
                        <span style="font-family: 'Courier New', Courier, monospace, -apple-system, sans-serif; font-size: 22px; font-weight: 900; letter-spacing: 2px; color: #fbbf24; text-shadow: 0 0 10px rgba(245, 158, 11, 0.4); text-transform: uppercase; line-height: 1; display: inline-block;">
                          ETGURU
                        </span>
                      </td>
                      <td style="vertical-align: middle; padding-left: 6px;">
                        <span style="background: rgba(245, 158, 11, 0.18); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.45); font-size: 9px; font-weight: 900; padding: 2px 6px; border-radius: 4px; font-family: 'Courier New', Courier, monospace; letter-spacing: 1.5px; vertical-align: middle; display: inline-block; line-height: 1.2;">
                          HD
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td colspan="2" style="padding-top: 4px;">
                        <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 9px; font-weight: 800; color: #94a3b8; letter-spacing: 2px; text-transform: uppercase; display: block; line-height: 1;">
                          CASINO &amp; LOTTERY
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <div style="text-align: center; margin-bottom: 20px;">
              <span style="background: rgba(168,85,247,0.2); color: #c084fc; border: 1px solid rgba(168,85,247,0.4); padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: bold; letter-spacing: 1px;">BETGURU LOTTERY • GMAIL SMTP</span>
              <h2 style="color: #fbbf24; font-size: 22px; margin: 12px 0 4px 0; font-weight: 900;">SMTP Connection Active!</h2>
              <p style="color: #94a3b8; font-size: 13px; margin: 0;">Test verification email dispatched successfully</p>
            </div>

            <div style="background: #0f172a; padding: 18px; border-radius: 14px; border-left: 4px solid #10b981; margin-bottom: 20px;">
              <p style="margin: 0 0 6px 0; font-size: 13px; color: #cbd5e1;"><strong>Sender Account:</strong> <span style="color: #f8fafc;">${email}</span></p>
              <p style="margin: 0 0 6px 0; font-size: 13px; color: #cbd5e1;"><strong>Display Name:</strong> <span style="color: #c084fc;">${senderName || 'BETGURU Security Team'}</span></p>
              <p style="margin: 0 0 6px 0; font-size: 13px; color: #cbd5e1;"><strong>SMTP Server:</strong> <span style="color: #f8fafc;">${host || 'smtp.gmail.com'}:${port || 587}</span></p>
              <p style="margin: 0 0 6px 0; font-size: 13px; color: #cbd5e1;"><strong>Status:</strong> <span style="color: #34d399; font-weight: bold;">HTTP 200 OK • Handshake Verified</span></p>
            </div>

            <p style="color: #64748b; font-size: 11px; text-align: center; margin: 0;">
              BETGURU Automated Security Infrastructure • ${new Date().toLocaleString('en-IN')}
            </p>
          </div>
        `
      });

      return res.json({
        success: true,
        message: `SMTP connection verified! Sent test email to ${recipient}.`,
        messageId: info.messageId
      });
    } catch (err: any) {
      const friendlyError = formatSmtpError(err);
      console.warn("SMTP Test verification notice:", friendlyError);

      return res.status(200).json({
        success: false,
        error: friendlyError,
        isAuthFailure: err.code === 'EAUTH' || (err.message && err.message.includes('535'))
      });
    }
  });

  // Send Email endpoint
  app.post("/api/send-email", async (req, res) => {
    try {
      const { to, subject, html, text, smtp } = req.body;

      if (!to || !smtp || !smtp.email || !smtp.appPassword) {
        return res.status(400).json({
          success: false,
          error: "Recipient email and SMTP credentials (email & appPassword) are required."
        });
      }

      const transporter = createTransporter(smtp);
      const info = await transporter.sendMail({
        from: `"${smtp.senderName || 'BETGURU Security'}" <${smtp.email.trim()}>`,
        to,
        subject: subject || 'BETGURU Notification',
        text: text || '',
        html: html || `<p>${text}</p>`
      });

      return res.json({
        success: true,
        message: `Email sent to ${to}`,
        messageId: info.messageId
      });
    } catch (err: any) {
      const friendlyError = formatSmtpError(err);
      console.warn("Send Email Notice:", friendlyError);
      return res.status(200).json({
        success: false,
        error: friendlyError,
        isAuthFailure: err.code === 'EAUTH' || (err.message && err.message.includes('535'))
      });
    }
  });

  // Send OTP Email endpoint
  app.post("/api/send-otp", async (req, res) => {
    try {
      const { email, otp, name, type, customHtml, smtp } = req.body;

      if (!email || !otp || !smtp || !smtp.email || !smtp.appPassword) {
        return res.status(400).json({
          success: false,
          error: "Target email, OTP code, and SMTP credentials are required."
        });
      }

      const transporter = createTransporter(smtp);
      const isPasswordReset = type === 'forgot_password' || type === 'password_reset' || type === 'pin_reset';
      const subject = isPasswordReset
        ? `🔐 BETGURU Security OTP Code: ${otp}`
        : type === 'registration'
        ? `🔐 Your BETGURU Registration OTP Code: ${otp}`
        : `🔐 Your BETGURU Security Verification OTP: ${otp}`;

      const defaultHtml = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #020617; color: #f8fafc; padding: 32px; border-radius: 24px; border: 1px solid #f59e0b; max-width: 520px; margin: 0 auto;">
            
            <!-- BETGURU OFFICIAL WEBSITE LOGO -->
            <table cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto 16px auto; text-align: left; vertical-align: middle; border-collapse: separate;">
              <tr>
                <td style="vertical-align: middle; padding-right: 12px;">
                  <table cellpadding="0" cellspacing="0" border="0" style="width: 44px; height: 44px; background: linear-gradient(135deg, #fde047 0%, #f59e0b 50%, #d97706 100%); border-radius: 12px; padding: 2px; box-shadow: 0 4px 16px rgba(245, 158, 11, 0.45);">
                    <tr>
                      <td style="background-color: #020617; border-radius: 10px; text-align: center; vertical-align: middle; height: 40px; width: 40px;">
                        <span style="font-family: 'Courier New', Courier, monospace, sans-serif; font-weight: 900; font-size: 24px; line-height: 1; color: #fbbf24; text-shadow: 0 2px 8px rgba(251, 191, 36, 0.6); display: block; margin: 0 auto;">
                          B
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
                <td style="vertical-align: middle;">
                  <table cellpadding="0" cellspacing="0" border="0" style="line-height: 1;">
                    <tr>
                      <td style="vertical-align: middle;">
                        <span style="font-family: 'Courier New', Courier, monospace, -apple-system, sans-serif; font-size: 22px; font-weight: 900; letter-spacing: 2px; color: #fbbf24; text-shadow: 0 0 10px rgba(245, 158, 11, 0.4); text-transform: uppercase; line-height: 1; display: inline-block;">
                          ETGURU
                        </span>
                      </td>
                      <td style="vertical-align: middle; padding-left: 6px;">
                        <span style="background: rgba(245, 158, 11, 0.18); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.45); font-size: 9px; font-weight: 900; padding: 2px 6px; border-radius: 4px; font-family: 'Courier New', Courier, monospace; letter-spacing: 1.5px; vertical-align: middle; display: inline-block; line-height: 1.2;">
                          HD
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td colspan="2" style="padding-top: 4px;">
                        <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 9px; font-weight: 800; color: #94a3b8; letter-spacing: 2px; text-transform: uppercase; display: block; line-height: 1;">
                          CASINO &amp; LOTTERY
                        </span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <div style="text-align: center; margin-bottom: 24px;">
              <span style="background: rgba(245,158,11,0.2); color: #fbbf24; border: 1px solid rgba(245,158,11,0.4); padding: 4px 14px; border-radius: 9999px; font-size: 11px; font-weight: bold; letter-spacing: 1.5px;">BETGURU OFFICIAL SECURITY</span>
              <h1 style="color: #ffffff; font-size: 24px; margin: 12px 0 4px 0; font-weight: 900; letter-spacing: 1px;">
                ${isPasswordReset ? 'Security Verification' : 'Welcome to BETGURU'}
              </h1>
              <p style="color: #94a3b8; font-size: 13px; margin: 0;">${isPasswordReset ? 'Verification passcode for your account' : 'Verification code for ' + (name || 'Player')}</p>
            </div>

            <div style="background: #0f172a; padding: 24px; border-radius: 18px; border: 1px solid #1e293b; text-align: center; margin-bottom: 24px;">
              <p style="color: #94a3b8; font-size: 12px; font-weight: bold; text-transform: uppercase; margin: 0 0 8px 0; letter-spacing: 1px;">YOUR 6-DIGIT OTP CODE</p>
              <div style="font-size: 36px; font-weight: 900; color: #38bdf8; letter-spacing: 8px; font-family: monospace; background: #020617; padding: 14px; border-radius: 12px; border: 1px solid #0284c7; display: inline-block;">
                ${otp}
              </div>
              <p style="color: #ef4444; font-size: 11px; margin: 12px 0 0 0; font-weight: bold;">
                ⏱️ Valid for 10 minutes. Do not share this code with anyone.
              </p>
            </div>

            <p style="color: #cbd5e1; font-size: 12px; line-height: 1.6; text-align: center; margin-bottom: 20px;">
              ${isPasswordReset 
                ? 'We received a security verification request for your BETGURU account. Enter this OTP code to verify your identity.'
                : 'Welcome to BETGURU Lottery! Enter this code in your app to complete your registration and claim your <strong>₹100 Free Bonus</strong>.'}
            </p>

            <div style="border-t: 1px solid #1e293b; pt: 16px; text-align: center; font-size: 10px; color: #64748b;">
              <p style="margin: 0;">256-Bit Encrypted • Sent via BETGURU Primary Gmail SMTP (${smtp.email})</p>
            </div>
          </div>
      `;

      const info = await transporter.sendMail({
        from: `"${smtp.senderName || 'BETGURU Security Team'}" <${smtp.email.trim()}>`,
        to: email.trim(),
        subject,
        html: customHtml || defaultHtml
      });

      return res.json({
        success: true,
        message: `OTP sent to ${email}`,
        messageId: info.messageId
      });
    } catch (err: any) {
      const friendlyError = formatSmtpError(err);
      console.warn("Send OTP Notice:", friendlyError);
      return res.status(200).json({
        success: false,
        error: friendlyError,
        isAuthFailure: err.code === 'EAUTH' || (err.message && err.message.includes('535'))
      });
    }
  });

  // Global Broadcast Push Notification (to topic or multiple tokens)
  app.post("/api/send-broadcast-push", async (req, res) => {
    try {
      const { title, message, targetUrl, topic, tokens } = req.body;

      if (!title || !message) {
        return res.status(400).json({ success: false, error: "Title and message are required." });
      }

      const messaging = getFirebaseMessagingInstance();
      if (!messaging) {
        return res.json({
          success: true,
          delivered: false,
          note: "Firebase Cloud Messaging service account is not configured; in-app notification delivered."
        });
      }

      const targetTopic = topic || 'all';

      const payload: any = {
        topic: targetTopic,
        notification: {
          title: String(title),
          body: String(message)
        },
        data: {
          title: String(title),
          body: String(message),
          target_url: String(targetUrl || "https://betguruprime.vercel.app/"),
          channel_id: "betguru_transactions"
        },
        android: {
          priority: 'high',
          notification: {
            channel_id: 'betguru_transactions',
            priority: 'max',
            default_sound: true,
            default_vibrate_timings: true,
            visibility: 'public'
          }
        }
      };

      if (tokens && Array.isArray(tokens) && tokens.length > 0) {
        delete payload.topic;
        const sendPromises = tokens.slice(0, 500).map((t: string) => 
          messaging.send({
            ...payload,
            token: t
          }).catch((err) => ({ error: err.message, token: t }))
        );
        const results = await Promise.all(sendPromises);
        return res.json({
          success: true,
          message: `Push notification dispatched to ${tokens.length} devices`,
          results
        });
      }

      const response = await messaging.send(payload);
      return res.json({
        success: true,
        message: "Push broadcast sent successfully to topic: " + targetTopic,
        response
      });
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.info("ℹ️ Push Broadcast Notice:", errMsg);
      return res.status(200).json({
        success: false,
        error: errMsg.includes('Permission') || errMsg.includes('cloudmessaging')
          ? "FCM Service Account not configured or missing push permission."
          : errMsg
      });
    }
  });

  // Single Direct User Push Notification
  app.post("/api/send-user-push", async (req, res) => {
    try {
      const { fcmToken, token, userId, title, message, body, type, targetUrl } = req.body;
      const effectiveToken = fcmToken || token;
      const effectiveMessage = message || body || "";

      if ((!effectiveToken && !userId) || !title || !effectiveMessage) {
        return res.status(400).json({ success: false, error: "fcmToken or userId, title, and message are required." });
      }

      const messaging = getFirebaseMessagingInstance();
      if (!messaging) {
        return res.json({
          success: true,
          delivered: false,
          note: "Firebase Cloud Messaging service account is not configured; in-app notification delivered."
        });
      }

      const payload: any = {
        notification: {
          title: String(title),
          body: String(effectiveMessage)
        },
        data: {
          title: String(title),
          body: String(effectiveMessage),
          type: String(type || "transaction"),
          target_url: String(targetUrl || "/"),
          channel_id: "betguru_transactions"
        },
        android: {
          priority: 'high',
          notification: {
            channel_id: 'betguru_transactions',
            priority: 'max',
            default_sound: true,
            default_vibrate_timings: true,
            visibility: 'public'
          }
        }
      };

      if (effectiveToken && typeof effectiveToken === 'string' && effectiveToken.trim().length > 10) {
        payload.token = effectiveToken.trim();
      } else if (userId) {
        payload.topic = `user_${userId}`;
      } else {
        return res.status(400).json({ success: false, error: "Valid FCM Token or User ID required." });
      }

      const response = await messaging.send(payload);
      return res.json({
        success: true,
        message: "Push notification delivered to user device",
        response
      });
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.info("ℹ️ Direct Push Notice:", errMsg);
      return res.status(200).json({
        success: false,
        error: errMsg.includes('Permission') || errMsg.includes('cloudmessaging')
          ? "FCM Service Account not configured or missing push permission."
          : errMsg
      });
    }
  });


  // Real-time authoritative server-side wallet sync and offline reconciliation
  app.post("/api/sync-user-wallet", async (req, res) => {
    try {
      return await syncUserWalletHandler(req, res);
    } catch (err: any) {
      console.warn("⚠️ sync-user-wallet server route error:", err?.message || err);
      return res.status(500).json({ success: false, error: err?.message || "Internal sync error" });
    }
  });

  // 📌 ডিপোজিট বা নতুন অর্ডারের সময় অ্যাডমিন পুশ নোটিফিকেশন পাঠানোর রুট
  app.post("/api/notify-admin-order", async (req, res) => {
    try {
      const { title, body, message, targetUrl, type, topic, token, fcmToken } = req.body;
      const effectiveBody = body || message || "";

      if (!title || !effectiveBody) {
        return res.status(400).json({ success: false, error: "Title and body are required." });
      }

      const messaging = getFirebaseMessagingInstance();
      if (!messaging) {
        return res.json({
          success: true,
          delivered: false,
          note: "Firebase Cloud Messaging service account is not configured; in-app real-time notification active."
        });
      }

      const effectiveTargetUrl = targetUrl || "/orders";
      const effectiveType = type || 'transaction';

      const msgPayload: any = {
        notification: {
          title: String(title),
          body: String(effectiveBody),
        },
        data: {
          title: String(title),
          body: String(effectiveBody),
          message: String(effectiveBody),
          target_url: String(effectiveTargetUrl),
          targetUrl: String(effectiveTargetUrl),
          type: String(effectiveType),
          channel_id: "betguru_transactions",
          channelId: "betguru_transactions",
          sound: "default",
          speak: "true",
          click_action: "FLUTTER_NOTIFICATION_CLICK",
          clickAction: "FLUTTER_NOTIFICATION_CLICK",
          priority: "high",
          timestamp: String(Date.now()),
        },
        android: {
          priority: 'high' as const,
          ttl: 2419200,
          notification: {
            channelId: 'betguru_transactions',
            priority: 'max' as const,
            sound: 'default',
            defaultSound: true,
            defaultVibrateTimings: true,
            visibility: 'public' as const,
            clickAction: 'FLUTTER_NOTIFICATION_CLICK',
            notificationPriority: 'PRIORITY_MAX' as const,
            ticker: String(title),
          },
        },
      };

      const directToken = token || fcmToken;
      if (directToken && typeof directToken === 'string' && directToken.trim().length > 10) {
        msgPayload.token = directToken.trim();
      } else {
        const targetTopic = (topic && typeof topic === 'string' && topic.trim()) ? topic.trim() : 'admin';
        msgPayload.topic = targetTopic;
      }

      const response = await messaging.send(msgPayload);
      return res.json({
        success: true,
        message: "Admin push notification dispatched successfully in 0s",
        response
      });
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.info("ℹ️ Notify Admin Order Push Notice:", errMsg);
      return res.status(200).json({
        success: false,
        error: errMsg
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
