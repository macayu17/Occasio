import test from 'node:test';
import assert from 'node:assert/strict';

const clearEmailEnv = () => {
  process.env.SMTP_HOST = '';
  process.env.SMTP_PORT = '';
  process.env.SMTP_USER = '';
  process.env.SMTP_PASS = '';
};

test('email delivery reports unavailable when SMTP credentials are missing', async () => {
  clearEmailEnv();

  const mod = await import(`../src/services/email.service.js?email-config-missing=${Date.now()}`);

  assert.equal(mod.isEmailDeliveryConfigured(), false);
});

test('email delivery reports available only with complete SMTP credentials', async () => {
  clearEmailEnv();
  process.env.SMTP_HOST = 'smtp.example.com';
  process.env.SMTP_PORT = '587';
  process.env.SMTP_USER = 'user@example.com';
  process.env.SMTP_PASS = 'secret';

  const mod = await import(`../src/services/email.service.js?email-config-present=${Date.now()}`);

  assert.equal(mod.isEmailDeliveryConfigured(), true);
});
