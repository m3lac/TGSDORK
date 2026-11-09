import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import tls from 'node:tls';
import net from 'node:net';
import { logger } from './logger.js';

interface OtpEntry {
  code: string;
  expires: number;
}

interface SessionEntry {
  email: string;
  createdAt: number;
}

const OTP_FILE = path.join(os.homedir(), '.tgsdork', 'auth_otps.json');
const SESSIONS_FILE = path.join(os.homedir(), '.tgsdork', 'auth_sessions.json');

function loadJson<T>(filePath: string, fallback: T): T {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch {
    // ignore
  }
  return fallback;
}

function saveJson(filePath: string, data: any): void {
  try {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // ignore
  }
}

// Build polished plain-text and HTML OTP verification email
function buildOtpEmailContent(recipientEmail: string, code: string): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = `${code} — Kode Verifikasi Masuk TGSDORK Studio`;
  const text = [
    `Yth. Peneliti (${recipientEmail}),`,
    ``,
    `Kami menerima permintaan akses masuk ke ruang kerja TGSDORK Academic Studio menggunakan alamat email ini.`,
    `Silakan masukkan 6 digit kode verifikasi berikut pada halaman login:`,
    ``,
    `    ${code}`,
    ``,
    `Kode ini berlaku selama 10 menit dan hanya dapat digunakan untuk satu kali sesi masuk.`,
    ``,
    `Demi keamanan dokumen dan arsip riset Anda, mohon tidak membagikan kode ini kepada siapa pun. Apabila Anda tidak merasa melakukan permintaan masuk ini, abaikan pesan email ini.`,
    ``,
    `Salam hangat,`,
    `Tim TGSDORK Academic Studio`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:28px 16px;background-color:#090a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f8fafc;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;margin:0 auto;background-color:#12151e;border:1px solid #232838;border-radius:18px;overflow:hidden;">
    <tr>
      <td style="padding:24px 28px 18px;border-bottom:1px solid #1e2330;background-color:#0d1017;">
        <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#38bdf8;margin-bottom:4px;">TGSDORK Academic Studio</div>
        <div style="font-size:19px;font-weight:700;color:#ffffff;letter-spacing:-0.01em;">Verifikasi Akses Ruang Kerja</div>
      </td>
    </tr>
    <tr>
      <td style="padding:26px 28px;">
        <p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:#cbd5e1;">
          Yth. Peneliti (<strong style="color:#ffffff;">${recipientEmail}</strong>),
        </p>
        <p style="margin:0 0 20px;font-size:14px;line-height:1.65;color:#94a3b8;">
          Kami menerima permintaan untuk masuk ke akun <strong style="color:#e2e8f0;">TGSDORK Studio</strong> Anda. Gunakan 6 digit kode otentikasi sekali pakai (OTP) di bawah ini untuk melanjutkan:
        </p>
        <div style="margin:0 0 20px;padding:18px 16px;background-color:#090b10;border:1px solid #263044;border-radius:14px;text-align:center;">
          <div style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#7dd3fc;margin-bottom:8px;">Kode Verifikasi Anda</div>
          <div style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:30px;font-weight:700;letter-spacing:8px;color:#ffffff;">${code}</div>
          <div style="margin-top:8px;font-size:12px;color:#64748b;">Berlaku selama <strong style="color:#cbd5e1;">10 menit</strong> &bull; Satu kali pakai</div>
        </div>
        <p style="margin:0 0 18px;font-size:12.5px;line-height:1.6;color:#64748b;">
          Demi menjaga keamanan naskah dan arsip riset Anda, jangan bagikan kode ini kepada siapa pun. Jika Anda tidak merasa melakukan permintaan masuk ini, Anda dapat mengabaikan email ini dengan aman.
        </p>
        <div style="padding-top:16px;border-top:1px solid #1e2330;font-size:12px;color:#64748b;">
          Salam hangat,<br />
          <strong style="color:#94a3b8;">Tim TGSDORK Academic Studio</strong>
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

// Send email via standard SMTP (TLS / STARTTLS)
async function sendSmtpEmail(
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<{ success: boolean; error?: string }> {
  let host = process.env.EMAIL_SMTP_HOST;
  let port = parseInt(process.env.EMAIL_SMTP_PORT || '587', 10);
  let user = process.env.EMAIL_ADDRESS || process.env.SMTP_USER;
  let pass = process.env.EMAIL_PASSWORD || process.env.SMTP_PASS;

  if (!user || !pass) {
    try {
      const cfgPath = path.join(os.homedir(), '.tgsdork', 'config.json');
      if (fs.existsSync(cfgPath)) {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
        if (cfg.smtp) {
          host = host || cfg.smtp.host;
          port = port || cfg.smtp.port || 587;
          user = user || cfg.smtp.user;
          pass = pass || cfg.smtp.pass;
        }
      }
    } catch {}
  }
  host = host || 'smtp.gmail.com';

  if (!user || !pass) {
    return { success: false, error: 'SMTP belum dikonfigurasi (EMAIL_ADDRESS / EMAIL_PASSWORD kosong)' };
  }

  return new Promise((resolve) => {
    const isDirectTls = port === 465;
    const socket = isDirectTls
      ? tls.connect(port, host, { rejectUnauthorized: false })
      : net.createConnection(port, host);

    let stage = 0;
    let buffer = '';

    const cleanUp = () => {
      try {
        socket.destroy();
      } catch {}
    };

    socket.setTimeout(15000, () => {
      cleanUp();
      resolve({ success: false, error: 'SMTP connection timeout' });
    });

    socket.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    socket.on('data', (data) => {
      buffer += data.toString();
      const lines = buffer.split('\r\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const code = parseInt(line.slice(0, 3), 10);
        if (isNaN(code)) continue;

        if (stage === 0 && code === 220) {
          socket.write(`EHLO ${host}\r\n`);
          stage = 1;
        } else if (stage === 1 && code === 250) {
          if (!isDirectTls) {
            socket.write(`STARTTLS\r\n`);
            stage = 2;
          } else {
            socket.write(`AUTH LOGIN\r\n`);
            stage = 3;
          }
        } else if (stage === 2 && code === 220) {
          // Upgrade to TLS
          const tlsSocket = tls.connect({
            socket: socket as net.Socket,
            rejectUnauthorized: false,
          });
          tlsSocket.write(`EHLO ${host}\r\n`);
          // switch reference
          stage = 3;
        } else if (stage === 3 && (code === 250 || code === 334)) {
          if (line.includes('VXNlcm5hbWU6') || code === 334) {
            socket.write(Buffer.from(user).toString('base64') + '\r\n');
            stage = 4;
          } else {
            socket.write(`AUTH LOGIN\r\n`);
          }
        } else if (stage === 4 && (code === 334 || line.includes('UGFzc3dvcmQ6'))) {
          socket.write(Buffer.from(pass).toString('base64') + '\r\n');
          stage = 5;
        } else if (stage === 5 && code === 235) {
          socket.write(`MAIL FROM:<${user}>\r\n`);
          stage = 6;
        } else if (stage === 6 && code === 250) {
          socket.write(`RCPT TO:<${to}>\r\n`);
          stage = 7;
        } else if (stage === 7 && code === 250) {
          socket.write(`DATA\r\n`);
          stage = 8;
        } else if (stage === 8 && code === 354) {
          const mime = [
            `From: "TGSDORK Academic Studio" <${user}>`,
            `To: <${to}>`,
            `Subject: ${subject}`,
            `MIME-Version: 1.0`,
            `Content-Type: ${html ? 'text/html' : 'text/plain'}; charset=utf-8`,
            ``,
            html || text,
            `.`,
          ].join('\r\n');
          socket.write(mime + '\r\n');
          stage = 9;
        } else if (stage === 9 && code === 250) {
          socket.write(`QUIT\r\n`);
          cleanUp();
          resolve({ success: true });
          return;
        } else if (code >= 400) {
          cleanUp();
          resolve({ success: false, error: `SMTP error ${code}: ${line}` });
          return;
        }
      }
    });
  });
}

async function sendResendEmail(
  apiKey: string,
  fromEmail: string,
  to: string,
  subject: string,
  text: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject,
        text,
        html,
      }),
    });
    const d = (await res.json()) as { id?: string; message?: string };
    if (!res.ok) {
      return { success: false, error: d.message || `HTTP ${res.status}` };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export async function requestOtp(email: string): Promise<{ success: boolean; previewCode?: string; message: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Alamat email tidak valid.');
  }

  // 6 digits random OTP
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const otps = loadJson<Record<string, OtpEntry>>(OTP_FILE, {});
  otps[cleanEmail] = {
    code,
    expires: Date.now() + 10 * 60 * 1000, // 10 minutes
  };
  saveJson(OTP_FILE, otps);

  logger.step('AUTH', `Kode OTP untuk ${cleanEmail}: ${code}`);

  // Check Resend API Key from env or config
  let resendApiKey = process.env.RESEND_API_KEY;
  let fromEmail = process.env.RESEND_FROM_EMAIL || 'TGSDORK <noreply@tgsdork.com>';
  try {
    const cfgPath = path.join(os.homedir(), '.tgsdork', 'config.json');
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      if (!resendApiKey) resendApiKey = cfg.resendApiKey || cfg.resend_api_key;
      if (cfg.fromEmail) fromEmail = cfg.fromEmail;
    }
  } catch {}

  const mail = buildOtpEmailContent(cleanEmail, code);

  if (resendApiKey) {
    const resendRes = await sendResendEmail(
      resendApiKey,
      fromEmail,
      cleanEmail,
      mail.subject,
      mail.text,
      mail.html
    );
    if (resendRes.success) {
      logger.success(`Email OTP via Resend berhasil dikirim ke ${cleanEmail}`);
      return {
        success: true,
        message: `Kode verifikasi 6 digit telah dikirim ke ${cleanEmail}. Silakan periksa kotak masuk atau folder spam Anda.`,
      };
    } else {
      logger.warn(`Resend gagal (${resendRes.error}), mencoba fallback SMTP...`);
    }
  }

  // Try sending real email if SMTP is configured
  const smtpRes = await sendSmtpEmail(
    cleanEmail,
    mail.subject,
    mail.text,
    mail.html
  );

  if (smtpRes.success) {
    logger.success(`Email OTP berhasil dikirim ke ${cleanEmail}`);
    return {
      success: true,
      message: `Kode verifikasi telah dikirim ke ${cleanEmail}. Periksa kotak masuk atau spam.`,
    };
  } else {
    logger.warn(`SMTP belum aktif/gagal (${smtpRes.error}). Menggunakan kode OTP sistem.`);
    return {
      success: true,
      message: `Kode verifikasi telah dibuat. Masukkan kode: ${code}`,
      previewCode: code,
    };
  }
}

export function verifyOtp(email: string, code: string): { success: boolean; token?: string; email?: string; error?: string } {
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();

  const otps = loadJson<Record<string, OtpEntry>>(OTP_FILE, {});
  const entry = otps[cleanEmail];

  if (!entry) {
    return { success: false, error: 'Kode verifikasi belum diminta atau sudah kedaluwarsa.' };
  }

  if (Date.now() > entry.expires) {
    delete otps[cleanEmail];
    saveJson(OTP_FILE, otps);
    return { success: false, error: 'Kode verifikasi telah kedaluwarsa (lebih dari 10 menit).' };
  }

  if (entry.code !== cleanCode) {
    return { success: false, error: 'Kode verifikasi salah. Silakan periksa kembali.' };
  }

  // Success: generate session token
  delete otps[cleanEmail];
  saveJson(OTP_FILE, otps);

  const token = crypto.randomBytes(32).toString('hex');
  const sessions = loadJson<Record<string, SessionEntry>>(SESSIONS_FILE, {});
  sessions[token] = {
    email: cleanEmail,
    createdAt: Date.now(),
  };
  saveJson(SESSIONS_FILE, sessions);

  logger.success(`Pengguna ${cleanEmail} berhasil masuk (Session: ${token.slice(0, 8)}...)`);
  return { success: true, token, email: cleanEmail };
}

export function getSessionUser(token?: string | null): string | null {
  if (!token) return null;
  const sessions = loadJson<Record<string, SessionEntry>>(SESSIONS_FILE, {});
  const sess = sessions[token];
  if (!sess) return null;
  // 30 days session
  if (Date.now() - sess.createdAt > 30 * 24 * 60 * 60 * 1000) {
    delete sessions[token];
    saveJson(SESSIONS_FILE, sessions);
    return null;
  }
  return sess.email;
}

export function removeSession(token?: string | null): void {
  if (!token) return;
  const sessions = loadJson<Record<string, SessionEntry>>(SESSIONS_FILE, {});
  if (sessions[token]) {
    delete sessions[token];
    saveJson(SESSIONS_FILE, sessions);
  }
}
