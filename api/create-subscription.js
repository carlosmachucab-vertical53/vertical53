// api/create-subscription.js
// Flujo correcto Flow suscripciones:
// 1. Crear cliente (o recuperar si ya existe)
// 2. Crear suscripción al plan
// 3. Llamar customer/register → redirigir al cliente a registrar tarjeta
// 4. Flow devuelve a url_return con token
// 5. El sitio llama a /api/confirm-registration con ese token

const crypto = require('crypto');

const FLOW_API_URL = 'https://www.flow.cl/api';
const API_KEY     = process.env.FLOW_API_KEY;
const SECRET_KEY  = process.env.FLOW_SECRET_KEY;

const PLAN_IDS = {
  'detox-S':   'BDS', 'detox-M':   'BDM', 'detox-L':   'BDL',
  'brunch-S':  'BBS', 'brunch-M':  'BBM', 'brunch-L':  'BBL',
  'spicy-S':   'BSS', 'spicy-M':   'BSM', 'spicy-L':   'BSL',
  'protein-S': 'BPS', 'protein-M': 'BPM', 'protein-L': 'BPL',
};

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

async function flowGet(endpoint, params) {
  const p = { ...params, apiKey: API_KEY };
  p.s = signParams(p);
  const res = await fetch(`${FLOW_API_URL}${endpoint}?${new URLSearchParams(p).toString()}`);
  const text = await res.text();
  try { return JSON.parse(text); } catch(e) { return { _raw: text }; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { box, size, nombre, email, telefono } = req.body;
  if (!box || !size || !nombre || !email) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  const planId = PLAN_IDS[`${box}-${size}`];
  if (!planId) return res.status(400).json({ error: 'Plan no válido' });

  // URL de retorno después que el cliente registra su tarjeta en Flow
  const urlReturn = `https://www.vertical53.com/api/confirm-registration?box=${box}&size=${size}&nombre=${encodeURIComponent(nombre)}&email=${encodeURIComponent(email)}&planId=${planId}`;

  try {
    // ── Paso 1: Crear o recuperar cliente ──────────────────────
    let customerId = null;

    const custData = await flowPost('/customer/create', {
      email,
      name: nombre,
      externalId: email,
      ...(telefono && { phone: telefono }),
    });

    if (custData.customerId) {
      customerId = custData.customerId;
      console.log('Cliente creado:', customerId);
    } else if (custData.code === 501 || custData.code === 101) {
      // Ya existe — buscar por externalId
      const existing = await flowGet('/customer/getByExternalId', { externalId: email });
      console.log('Cliente existente:', JSON.stringify(existing));
      customerId = existing.customerId;
    }

    if (!customerId) {
      console.error('Sin customerId:', JSON.stringify(custData));
      return res.status(500).json({ error: 'Error al registrar cliente en Flow' });
    }

    // ── Paso 2: Crear suscripción ───────────────────────────────
    const subscData = await flowPost('/subscription/create', {
      planId,
      customerId,
      trial_period_days: 0,
    });
    console.log('Suscripción:', JSON.stringify(subscData).slice(0, 200));

    // ── Paso 3: Registrar tarjeta del cliente ───────────────────
    const regData = await flowPost('/customer/register', {
      customerId,
      url_return: urlReturn,
    });
    console.log('Register response:', JSON.stringify(regData));

    if (!regData.url || !regData.token) {
      console.error('Error customer/register:', JSON.stringify(regData));
      return res.status(500).json({ error: 'Error al generar página de pago: ' + (regData.message || JSON.stringify(regData)) });
    }

    return res.status(200).json({ url: `${regData.url}?token=${regData.token}` });

  } catch (err) {
    console.error('Error inesperado:', err.message);
    return res.status(500).json({ error: 'Error interno: ' + err.message });
  }
};
