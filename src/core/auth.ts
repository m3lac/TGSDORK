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
    `TGSDORK ACADEMIC STUDIO (https://tgsdork.com)`,
    `================================================`,
    ``,
    `Halo ${recipientEmail},`,
    ``,
    `Kami menerima permintaan untuk masuk ke ruang kerja TGSDORK Academic Studio menggunakan alamat email Anda.`,
    ``,
    `KODE VERIFIKASI 6 DIGIT ANDA:`,
    ``,
    `    ${code}`,
    ``,
    `Cara Menggunakan Kode Ini:`,
    `1. Kembali ke halaman login TGSDORK Studio (https://tgsdork.com/studio) di browser Anda.`,
    `2. Ketik atau tempel 6 digit kode verifikasi di atas pada kolom yang tersedia.`,
    `3. Klik tombol "Verifikasi & Masuk Studio".`,
    ``,
    `Informasi Penting:`,
    `- Masa berlaku : 10 menit sejak email ini dikirimkan.`,
    `- Penggunaan   : Hanya berlaku untuk 1 kali sesi masuk.`,
    `- Pengirim     : noreply@tgsdork.com`,
    ``,
    `Catatan Keamanan:`,
    `Demi menjaga kerahasiaan naskah dan arsip riset Anda, jangan pernah membagikan kode ini kepada siapa pun. Jika Anda tidak merasa meminta kode ini, abaikan email ini—akun Anda tetap aman.`,
    ``,
    `Salam hangat,`,
    `Tim TGSDORK Academic Studio`,
    `https://tgsdork.com`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:32px 16px;background-color:#07090e;font-family:-apple-system,BlinkMacSystemFont,'Plus Jakarta Sans','Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f8fafc;">
  <!-- Preheader Text -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    Kode verifikasi OTP Anda adalah ${code}. Masukkan 6 digit kode ini di halaman login TGSDORK Studio (berlaku 10 menit).
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:540px;margin:0 auto;background-color:#10141f;border:1px solid #22293a;border-radius:20px;overflow:hidden;box-shadow:0 20px 50px rgba(0,0,0,0.45);">
    <tr>
      <td style="padding:26px 30px 20px;border-bottom:1px solid #1d2434;background:linear-gradient(180deg,#131929 0%,#0d111b 100%);">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td>
              <div style="display:inline-block;padding:4px 10px;border-radius:999px;background-color:rgba(56,189,248,0.12);border:1px solid rgba(56,189,248,0.28);font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#38bdf8;margin-bottom:10px;">
                TGSDORK Academic Studio &bull; tgsdork.com
              </div>
              <div style="font-size:21px;font-weight:700;color:#ffffff;letter-spacing:-0.015em;line-height:1.3;">
                Kode Verifikasi Masuk Studio
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:28px 30px;">
        <p style="margin:0 0 12px;font-size:14.5px;line-height:1.6;color:#e2e8f0;">
          Halo <strong style="color:#ffffff;">${recipientEmail}</strong>,
        </p>
        <p style="margin:0 0 22px;font-size:14px;line-height:1.65;color:#94a3b8;">
          Kami menerima permintaan akses masuk ke ruang kerja <strong style="color:#f1f5f9;">TGSDORK Academic Studio</strong> menggunakan alamat email ini. Masukkan <strong style="color:#f1f5f9;">6 digit kode verifikasi (OTP)</strong> berikut pada layar browser Anda:
        </p>

        <div style="margin:0 0 22px;padding:22px 18px;background-color:#080b12;border:1px solid #29354d;border-radius:16px;text-align:center;">
          <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#38bdf8;margin-bottom:10px;">
            Kode Verifikasi Sekali Pakai (OTP)
          </div>
          <div style="font-family:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:34px;font-weight:800;letter-spacing:10px;color:#ffffff;padding-left:10px;">
            ${code}
          </div>
          <div style="margin-top:12px;font-size:12px;color:#94a3b8;">
            Berlaku selama <strong style="color:#f8fafc;">10 menit</strong> &bull; Hanya untuk <strong style="color:#f8fafc;">1 kali sesi masuk</strong>
          </div>
        </div>

        <div style="margin:0 0 22px;padding:16px 18px;background-color:#0c101a;border:1px solid #1c2333;border-radius:12px;">
          <div style="font-size:12px;font-weight:700;color:#cbd5e1;margin-bottom:8px;">
            Langkah Selanjutnya:
          </div>
          <ol style="margin:0;padding-left:18px;font-size:13px;line-height:1.7;color:#94a3b8;">
            <li>Kembali ke halaman login <a href="https://tgsdork.com/studio" style="color:#38bdf8;text-decoration:none;font-weight:600;">tgsdork.com/studio</a> di browser Anda.</li>
            <li>Ketik atau tempel 6 digit kode di atas pada kolom <strong>Kode Verifikasi</strong>.</li>
            <li>Klik tombol <strong>Verifikasi &amp; Masuk Studio</strong> untuk membuka ruang kerja Anda.</li>
          </ol>
        </div>

        <p style="margin:0 0 20px;font-size:12.5px;line-height:1.65;color:#64748b;">
          <strong style="color:#94a3b8;">Catatan Keamanan:</strong> Demi melindungi dokumen dan arsip riset Anda, jangan pernah memberikan kode ini kepada pihak lain. Apabila Anda tidak merasa melakukan permintaan masuk ini, abaikan email ini dengan aman.
        </p>

        <div style="padding-top:18px;border-top:1px solid #1d2434;font-size:12px;line-height:1.6;color:#64748b;">
          Dikirim otomatis oleh <strong style="color:#94a3b8;">TGSDORK Academic Studio</strong> (<a href="https://tgsdork.com" style="color:#38bdf8;text-decoration:none;">tgsdork.com</a>)<br />
          Email pengirim resmi: <span style="color:#94a3b8;">noreply@tgsdork.com</span>
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
  let fromEmail = process.env.RESEND_FROM_EMAIL || 'TGSDORK Academic Studio <noreply@tgsdork.com>';
  try {
    const cfgPath = path.join(os.homedir(), '.tgsdork', 'config.json');
    if (fs.existsSync(cfgPath)) {
      const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      if (!resendApiKey) resendApiKey = cfg.resendApiKey || cfg.resend_api_key;
      if (
        cfg.fromEmail &&
        !String(cfg.fromEmail).includes('melac.my.id') &&
        !String(cfg.fromEmail).includes('tgsdork.local')
      ) {
        fromEmail = cfg.fromEmail;
      }
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
        message: `Kode OTP 6 digit telah dikirim ke ${cleanEmail} melalui noreply@tgsdork.com. Silakan cek Kotak Masuk (Inbox) atau folder Spam/Promosi Anda (berlaku 10 menit).`,
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
      message: `Kode OTP 6 digit telah dikirim ke ${cleanEmail}. Silakan cek Kotak Masuk (Inbox) atau folder Spam Anda (berlaku 10 menit).`,
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
    return {
      success: false,
      error: 'Kode verifikasi belum diminta atau sudah kedaluwarsa. Silakan klik "Kirim Ulang Kode".',
    };
  }

  if (Date.now() > entry.expires) {
    delete otps[cleanEmail];
    saveJson(OTP_FILE, otps);
    return {
      success: false,
      error: 'Masa berlaku kode OTP (10 menit) telah habis. Silakan kirim ulang kode verifikasi baru.',
    };
  }

  if (entry.code !== cleanCode) {
    return {
      success: false,
      error: 'Kode OTP tidak sesuai. Pastikan 6 digit angka yang dimasukkan sama dengan email terbaru dari noreply@tgsdork.com.',
    };
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
