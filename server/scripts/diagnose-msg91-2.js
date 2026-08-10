import 'dotenv/config';

const authKey = process.env.SMS_MSG91_AUTH_KEY;
const sender = process.env.SMS_MSG91_SENDER_ID;
const templateId = process.env.SMS_MSG91_TEMPLATE_ID;
const requestId = process.argv[2] || '';

async function tryGet(label, url, headers = {}) {
  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json', authkey: authKey, ...headers },
    });
    const text = await res.text();
    console.log(`\n[${label}] ${res.status}`);
    console.log(text.slice(0, 500));
  } catch (e) {
    console.log(`\n[${label}] ERR`, e.message);
  }
}

async function tryPost(label, url, body) {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authkey: authKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    console.log(`\n[${label}] ${res.status}`);
    console.log(text.slice(0, 800));
  } catch (e) {
    console.log(`\n[${label}] ERR`, e.message);
  }
}

console.log('templateId', templateId, 'sender', sender);

// Common report endpoints
if (requestId) {
  await tryGet('report path', `https://control.msg91.com/api/v5/report/${requestId}`);
  await tryGet(
    'report query',
    `https://control.msg91.com/api/v5/report?request_id=${encodeURIComponent(requestId)}`
  );
  await tryGet(
    'offline_report',
    `https://api.msg91.com/api/offline_report.php?authkey=${encodeURIComponent(authKey)}&request_id=${encodeURIComponent(requestId)}`
  );
}

// Alternate send shapes used by MSG91 docs
await tryPost('flow without sender field', 'https://control.msg91.com/api/v5/flow/', {
  template_id: templateId,
  short_url: '0',
  recipients: [{ mobiles: '918072180274', var1: 'Aarav', var2: '1', var3: '06 Aug 2026' }],
});

await tryPost('sms with sender+template', 'https://control.msg91.com/api/v5/sms/', {
  template_id: templateId,
  sender,
  short_url: '0',
  recipients: [{ mobiles: '918072180274', var1: 'Aarav', var2: '1', var3: '06 Aug 2026' }],
});

// Legacy sendotp-style / sendhttp with DLT
const legacy = new URL('https://control.msg91.com/api/v5/flow/');
const legacyRes = await fetch('https://api.msg91.com/api/v5/flow/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', authkey: authKey },
  body: JSON.stringify({
    template_id: templateId,
    recipients: [
      {
        mobiles: '918072180274',
        var1: 'Aarav Sharma',
        var2: '1',
        var3: '06 Aug 2026',
      },
    ],
  }),
});
console.log('\n[api.msg91 flow]', legacyRes.status, (await legacyRes.text()).slice(0, 500));
console.log(legacy.toString());
