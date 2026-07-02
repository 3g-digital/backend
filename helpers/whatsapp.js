const fetch = require('node-fetch');

const GRAPH = 'https://graph.facebook.com/v19.0';
const PNID  = process.env.PHONE_NUMBER_ID;
const TOKEN = process.env.WABA_TOKEN;

// E.164 normalize (+91…)
function toE164(raw) {
  if (!raw) return '';
  const s = String(raw).trim().replace(/[^\d+]/g,'').replace(/^0+/, '');
  if (s.startsWith('+')) return s;
  if (s.startsWith('91')) return `+${s}`;
  return `+91${s}`;
}

// Send APPROVED template (business-initiated first msg)
async function sendTemplate({ to, name, params = [], lang = 'en' }) {
  const body = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name,
      language: { code: lang },
      components: params.length ? [{
        type: 'body',
        parameters: params.map(v => ({ type: 'text', text: String(v) }))
      }] : []
    }
  };

  const res = await fetch(`${GRAPH}/${PNID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  if (!res.ok) {
    const msg = data?.error?.message || 'WhatsApp send failed';
    const err = new Error(msg);
    err.meta = data;
    throw err;
  }
  return data;
}

module.exports = { sendTemplate, toE164 };
