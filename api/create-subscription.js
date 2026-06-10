// api/create-subscription.js
// Vercel Serverless Function
// Flujo correcto Flow:
// 1. Crear cliente
// 2. Crear suscripción  
// 3. Llamar customer/register para obtener URL donde cliente ingresa tarjeta

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
  return res.json();
}

async function flowGet(endpoint, params) {
  const p = { ...params, apiKey: API_KEY };
  p.s = signParams(p);
  const qs = new URLSearchParams(p).toString();
  const res = await fetch(`${FLOW_API_URL}${endpoint}?${qs}`);
  return res.json();
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

  const urlReturn = `https://www.vertical53.com?suscripcion=ok&box=${box}&size=${size}&nombre=${encodeURIComponent(nombre)}`;

  try {
    // ── Paso 1: Crear cliente ────────────────────────────────
    const custParams = { email, name: nombre, externalId: email };
    if (telefono) custParams.phone = telefono;
    const custData = await flowPost('/customer/create', custParams);

    // Código 101 = cliente ya existe, lo buscamos por customerId
    let customerId = custData.customerId;
    if (!customerId) {
      // Intentar obtener cliente existente por externalId
      const existing = await flowGet('/customer/getByExternalId', { externalId: email });
      customerId = existing.customerId;
    }

    if (!customerId) {
      console.error('No se pudo obtener customerId:', custData);
      return res.status(500).json({ error: 'Error al registrar cliente' });
    }

    // ── Paso 2: Crear suscripción ────────────────────────────
    const subscData = await flowPost('/subscription/create', {
      planId,
      customerId,
      trial_period_days: 0,
    });

    console.log('Suscripción creada:', subscData.subscriptionId || subscData);

    // ── Paso 3: Registrar tarjeta del cliente ────────────────
    // customer/register devuelve la URL donde el cliente ingresa su tarjeta
    const regData = await flowPost('/customer/register', {
      customerId,
      url_return: urlReturn,
    });

    if (!regData.url || !regData.token) {
      console.error('Error en customer/register:', regData);
      return res.status(500).json({ error: 'Error al generar página de pago' });
    }

    // La URL final es regData.url + ?token=regData.token
    const payUrl = `${regData.url}?token=${regData.token}`;

    return res.status(200).json({ url: payUrl });

  } catch (err) {
    console.error('Error inesperado:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
