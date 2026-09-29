import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readFileSync } from 'node:fs';

test('HTML estático contém popup e aviso antes dos campos', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /data-open-signup/);
  assert.match(html, /<dialog class="signup-dialog"/);
  assert.match(html, /class="integration-note"/);
  assert.match(html, /name="whatsapp"/);
  assert.match(html, /class="button button-primary form-submit" type="submit" disabled/);
});

test('cadastro só confirma após entrega ao webhook', async () => {
  let received;
  const webhook = http.createServer(async (req, res) => {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    received = JSON.parse(raw);
    res.writeHead(204).end();
  });
  webhook.listen(0, '127.0.0.1');
  await once(webhook, 'listening');
  const webhookPort = webhook.address().port;
  const appPort = 42000 + Math.floor(Math.random() * 10000);
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const app = spawn(process.execPath, ['server.mjs'], {
    cwd: root,
    env: { ...process.env, PORT: String(appPort), LEAD_WEBHOOK_URL: `http://127.0.0.1:${webhookPort}/leads` },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  try {
    await Promise.race([once(app.stdout, 'data'), new Promise((_, reject) => setTimeout(() => reject(new Error('server timeout')), 5000))]);
    const status = await fetch(`http://127.0.0.1:${appPort}/api/status`).then((response) => response.json());
    assert.equal(status.registrationEnabled, true);
    const response = await fetch(`http://127.0.0.1:${appPort}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Teste Diversa', email: 'teste@example.com', whatsapp: '(44) 99999-9999' }),
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(received.name, 'Teste Diversa');
    assert.equal(received.whatsapp, '5544999999999');
    assert.equal(received.eventDateTime, '2026-10-01T18:30:00-03:00');
  } finally {
    app.kill();
    webhook.close();
  }
});
