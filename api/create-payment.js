// api/create-payment.js
const crypto = require('crypto');

const FLOW_API_URL = 'https://www.flow.cl/api';
const API_KEY      = process.env.FLOW_API_KEY;
const SECRET_KEY   = process.env.FLOW_SECRET_KEY;

const PRICES   = { 1: 5990, 2: 11990, 3: 17990, 4: 23990, 5: 29990 };
const DESPACHO = { 1: 3000, 2: 3000,  3: 3000,  4: 0,     5: 0 };

function signParams(params) {
  const keys = Object.keys(params).sort();
  let toSign = '';
  keys.forEach(k => { toSign += k + params[k]; });
  return crypto.createHmac('sha256', SECRET_KEY).update(toSign).digest('hex');
}

async function flowPost(endpoint, params) {
  const p = { ...params, apiKey: API_KEY };
  p.s = signParams(p);
  const res = await fetch(`${FLOW_API_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(p).toString(),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch(e) { return { _raw: text }; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { qty, nombre, email, brotes, horario, direccion, nota } = req.body;

  if (!qty || !nombre || !email || !brotes || !horario || !direccion) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  const precio   = PRICES[qty];
  const despacho = DESPACHO[qty];
  const total    = precio + despacho;

  if (!precio) return res.status(400).json({ error: 'Cantidad no válida' });

  const commerceOrder = 'V53-' + Date.now();

  // FIX 1: urlReturn como GET simple — Flow redirige aquí con GET después del pago
  // No incluimos datos sensibles en la URL, los datos vienen por el webhook
  const urlReturn = 'https://www.vertical53.com/gracias';

  // urlConfirmation: Flow hace POST aquí para confirmar el pago
  // Esta función envía los correos y registra el pedido
  const urlConfirmation = 'https://www.vertical53.com/api/payment-confirm';

  const subject = `Vertical 53° · ${qty} bandeja${qty > 1 ? 's' : ''} viva${qty > 1 ? 's' : ''}`;

  try {
    const data = await flowPost('/payment/create', {
      commerceOrder,
      subject,
      currency: 'CLP',
      amount: total,
      email,
      urlConfirmation,
      urlReturn,
      optional: JSON.stringify({
        n: nombre,
        e: email,
        b: brotes,
        h: horario,
        d: direccion,
        q: String(qty),
        t: String(total),
      }),
    });

    console.log('Flow response:', JSON.stringify(data));

    if (!data.url || !data.token) {
      console.error('Error Flow:', JSON.stringify(data));
      return res.status(500).json({ error: 'Error al crear el pago: ' + (data.message || JSON.stringify(data)) });
    }

    return res.status(200).json({ url: `${data.url}?token=${data.token}` });

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: 'Error interno: ' + err.message });
  }
};
