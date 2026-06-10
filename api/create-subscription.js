// api/create-subscription.js
// Vercel Serverless Function
// Recibe: { planId, nombre, email, telefono }
// Devuelve: { url } — URL de pago de Flow para redirigir al cliente

const crypto = require('crypto');

const FLOW_API_URL = 'https://www.flow.cl/api';
const API_KEY      = process.env.FLOW_API_KEY;
const SECRET_KEY   = process.env.FLOW_SECRET_KEY;

// Mapa de plan interno → ID de plan en Flow
const PLAN_IDS = {
  'detox-S':   'BDS',
  'detox-M':   'BDM',
  'detox-L':   'BDL',
  'brunch-S':  'BBS',
  'brunch-M':  'BBM',
  'brunch-L':  'BBL',
  'spicy-S':   'BSS',
  'spicy-M':   'BSM',
  'spicy-L':   'BSL',
  'protein-S': 'BPS',
  'protein-M': 'BPM',
  'protein-L': 'BPL',
};

// Firma los parámetros con HMAC-SHA256 según especificación Flow
function signParams(params) {
  const keys = Object.keys(params).sort();
  let toSign = '';
  keys.forEach(k => { toSign += k + params[k]; });
  return crypto.createHmac('sha256', SECRET_KEY).update(toSign).digest('hex');
}

// Calcula el próximo lunes a partir de hoy
function proximoLunes() {
  const hoy = new Date();
  const dia = hoy.getDay(); // 0=dom, 1=lun ... 6=sab
  const diasHastaLunes = dia === 1 ? 7 : (8 - dia) % 7 || 7;
  hoy.setDate(hoy.getDate() + diasHastaLunes);
  return hoy.toISOString().split('T')[0]; // YYYY-MM-DD
}

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://www.vertical53.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const { box, size, nombre, email, telefono } = req.body;

  // Validaciones básicas
  if (!box || !size || !nombre || !email) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  const planKey = `${box}-${size}`;
  const planId  = PLAN_IDS[planKey];
  if (!planId) {
    return res.status(400).json({ error: 'Plan no válido' });
  }

  try {
    // ── Paso 1: Crear o recuperar cliente en Flow ─────────────
    const customerParams = {
      apiKey: API_KEY,
      email,
      name: nombre,
      ...(telefono && { phone: telefono }),
      externalId: email, // usamos email como ID externo único
    };
    customerParams.s = signParams(customerParams);

    const custBody = new URLSearchParams(customerParams).toString();
    const custRes  = await fetch(`${FLOW_API_URL}/customer/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: custBody,
    });
    const custData = await custRes.json();

    if (!custRes.ok || custData.code) {
      // Si el cliente ya existe en Flow, continuar igual
      if (custData.code !== 101) { // 101 = email duplicado (ya existe)
        console.error('Error creando cliente Flow:', custData);
        return res.status(500).json({ error: 'Error al registrar cliente' });
      }
    }

    const customerId = custData.customerId || email;

    // ── Paso 2: Crear suscripción en Flow ─────────────────────
    const subscParams = {
      apiKey: API_KEY,
      planId,
      customerId,
      trial_period_days: 0,
      url_return: `https://www.vertical53.com?suscripcion=ok&box=${box}&size=${size}&nombre=${encodeURIComponent(nombre)}`,
    };
    subscParams.s = signParams(subscParams);

    const subscBody = new URLSearchParams(subscParams).toString();
    const subscRes  = await fetch(`${FLOW_API_URL}/subscription/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: subscBody,
    });
    const subscData = await subscRes.json();

    if (!subscRes.ok || !subscData.url) {
      console.error('Error creando suscripción Flow:', subscData);
      return res.status(500).json({ error: 'Error al crear suscripción' });
    }

    // Devolver la URL de pago de Flow al cliente
    return res.status(200).json({
      url: subscData.url,
      proximaEntrega: proximoLunes(),
    });

  } catch (err) {
    console.error('Error inesperado:', err);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};
