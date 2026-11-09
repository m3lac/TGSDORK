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

// Send email via standard SMTP (TLS / STARTTLS)
async function sendSmtpEmail(
  to: string,
  subject: string,
  text: string
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
            `From: "TGSDORK Academic" <${user}>`,
            `To: <${to}>`,
            `Subject: ${subject}`,
            `Content-Type: text/plain; charset=utf-8`,
            ``,
            text,
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
  text: string
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
  let fromEmail = process.env.RESEND_FROM_EMAIL || 'TGSDORK <noreply@tgsdork.local>';
  try {
    const cfgPath = path.join(os.homedir(), '.tgsdork', 'config.json');
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      if (!resendApiKey) resendApiKey = cfg.resendApiKey || cfg.resend_api_key;
      if (cfg.fromEmail) fromEmail = cfg.fromEmail;
    }
  } catch {}

  const emailBody = `Halo,\n\nKode verifikasi masuk ke akun TGSDORK Anda adalah:\n\n   ${code}\n\nKode ini berlaku selama 10 menit.\nJangan bagikan kode ini kepada siapapun.\n\n--\nTGSDORK Academic Studio`;

  if (resendApiKey) {
    const resendRes = await sendResendEmail(
      resendApiKey,
      fromEmail,
      cleanEmail,
      `Kode Masuk TGSDORK: ${code}`,
      emailBody
    );
    if (resendRes.success) {
      logger.success(`Email OTP via Resend berhasil dikirim ke ${cleanEmail}`);
      return {
        success: true,
        message: `Kode verifikasi 6 digit telah dikirim ke ${cleanEmail}. Periksa inbox / spam.`,
      };
    } else {
      logger.warn(`Resend gagal (${resendRes.error}), mencoba fallback SMTP...`);
    }
  }

  // Try sending real email if SMTP is configured
  const smtpRes = await sendSmtpEmail(
    cleanEmail,
    `Kode Masuk TGSDORK: ${code}`,
    emailBody
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
