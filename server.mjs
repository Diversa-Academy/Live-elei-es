import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { eventConfig } from './event-config.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const leadWebhook = process.env.LEAD_WEBHOOK_URL || '';
const rate = new Map();
const types = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };

function reply(res, status, body, contentType = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': contentType, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
  res.end(contentType.startsWith('application/json') ? JSON.stringify(body) : body);
}

async function readBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 8192) throw new Error('large');
  }
  return JSON.parse(raw);
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.startsWith('55') && digits.length >= 12 ? digits : `55${digits}`;
}

async function handleLead(req, res) {
  if (!leadWebhook) return reply(res, 503, { error: 'Cadastro temporariamente indisponível. Assista pelo YouTube ou tente novamente em breve.' });
  if (!String(req.headers['content-type'] || '').includes('application/json')) return reply(res, 415, { error: 'Formato de envio inválido.' });
  const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
  const now = Date.now();
  const last = rate.get(ip) || 0;
  if (now - last < 8000) return reply(res, 429, { error: 'Aguarde alguns segundos antes de tentar novamente.' });
  rate.set(ip, now);
  if (rate.size > 5000) for (const [key, time] of rate) if (now - time > 60000) rate.delete(key);

  let data;
  try { data = await readBody(req); } catch { return reply(res, 400, { error: 'Não foi possível ler os dados. Tente novamente.' }); }
  if (data.website) return reply(res, 200, { ok: true }); // Honeypot.
  const name = String(data.name || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  const email = String(data.email || '').trim().toLowerCase().slice(0, 254);
  const phone = normalizePhone(data.whatsapp);
  if (name.length < 2) return reply(res, 400, { error: 'Digite seu nome.' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(res, 400, { error: 'Digite um e-mail válido.' });
  if (!/^55\d{10,11}$/.test(phone)) return reply(res, 400, { error: 'Digite um WhatsApp válido com DDD.' });

  try {
    const upstream = await fetch(leadWebhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(process.env.LEAD_WEBHOOK_TOKEN ? { Authorization: `Bearer ${process.env.LEAD_WEBHOOK_TOKEN}` } : {}) },
      body: JSON.stringify({ event: eventConfig.shortTitle, eventDateTime: eventConfig.dateTime, name, email, whatsapp: phone, consent: 'Aviso relacionado à transmissão', source: 'landing-page-diversa', createdAt: new Date().toISOString() }),
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) throw new Error(`Webhook ${upstream.status}`);
    return reply(res, 200, { ok: true });
  } catch (error) {
    console.error('Lead delivery failed:', error.message);
    return reply(res, 502, { error: 'Não foi possível confirmar o cadastro. Tente novamente ou acompanhe pelo YouTube.' });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && url.pathname === '/api/leads') return handleLead(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') return reply(res, 405, { error: 'Método não permitido.' });
  if (url.pathname === '/api/status') return reply(res, 200, { registrationEnabled: Boolean(leadWebhook) });
  if (url.pathname === '/' || url.pathname === '/index.html') {
    const html = await readFile(path.join(root, 'index.html'));
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
    return res.end(req.method === 'HEAD' ? undefined : html);
  }
  const safePath = path.normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
  const full = path.join(root, safePath);
  if (!full.startsWith(root + path.sep) || safePath.startsWith('.')) return reply(res, 404, { error: 'Não encontrado.' });
  try {
    const info = await stat(full);
    if (!info.isFile()) throw new Error('not file');
    const body = await readFile(full);
    res.writeHead(200, { 'Content-Type': types[path.extname(full)] || 'application/octet-stream', 'Content-Length': body.length, 'Cache-Control': url.pathname.startsWith('/assets/') ? 'public, max-age=604800' : 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { reply(res, 404, { error: 'Não encontrado.' }); }
});

server.listen(port, () => console.log(`Diversa event page: http://localhost:${port}`));
