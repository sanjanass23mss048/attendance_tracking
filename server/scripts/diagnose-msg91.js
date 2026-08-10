import 'dotenv/config';

const authKey = process.env.SMS_MSG91_AUTH_KEY;
const sender = process.env.SMS_MSG91_SENDER_ID;
const templateId = process.env.SMS_MSG91_TEMPLATE_ID;

console.log('provider', process.env.SMS_PROVIDER);
console.log('sender', JSON.stringify(sender), 'len', sender?.length);
console.log('templateId', JSON.stringify(templateId), 'len', templateId?.length);
console.log('authKeyLen', authKey?.length);

const payload = {
  template_id: templateId,
  sender,
  short_url: '0',
  recipients: [
    {
      mobiles: '918072180274',
      var1: 'Aarav Sharma',
      var2: '1',
      var3: '06 Aug 2026',
    },
  ],
};

console.log('--- flow API ---');
const res = await fetch('https://control.msg91.com/api/v5/flow/', {
  method: 'POST',
  headers: {
    accept: 'application/json',
    authkey: authKey,
    'content-type': 'application/json',
  },
  body: JSON.stringify(payload),
});
console.log('status', res.status);
console.log('body', await res.text());

console.log('--- sms v5 API ---');
const res2 = await fetch('https://control.msg91.com/api/v5/sms/', {
  method: 'POST',
  headers: {
    accept: 'application/json',
    authkey: authKey,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    template_id: templateId,
    short_url: '0',
    realTimeResponse: '1',
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
console.log('status', res2.status);
console.log('body', await res2.text());

// Delivery report if request id known from env/arg
const reqId = process.argv[2];
if (reqId) {
  console.log('--- delivery report ---', reqId);
  const res3 = await fetch(
    `https://control.msg91.com/api/v5/report/${encodeURIComponent(reqId)}`,
    { headers: { accept: 'application/json', authkey: authKey } }
  );
  console.log('status', res3.status);
  console.log('body', await res3.text());
}
