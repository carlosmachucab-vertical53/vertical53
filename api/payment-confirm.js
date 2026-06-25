// api/payment-confirm.js
// Flow llama aquí con POST enviando solo {"token":"..."}
// Debemos consultar Flow para obtener el estado real del pago
// Luego emitimos boleta Haulmer y notificamos Apps Script

const crypto = require('crypto');
const { emitirBoleta } = require('./haulmer-boleta');

const FLOW_API_URL  = 'https://www.flow.cl/api';
const API_KEY       = process.env.FLOW_API_KEY;
const SECRET_KEY    = process.env.FLOW_SECRET_KEY;
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

function signParams(params) {
  const keys = Object.keys(params).sort();
  let toSign = '';
  keys.forEach(k => { toSign += k + params[k]; });
  return crypto.createHmac('sha256', SECRET_KEY).update(toSign).digest('hex');
}

async function flowGet(endpoint, params) {
  const p = { ...params, apiKey: API_KEY };
  p.s = signParams(p);
  const qs = new URLSearchParams(p).toString();
  const res = await fetch(`${FLOW_API_URL}${endpoint}?${qs}`);
  const text = await res.text();
  try { return JSON.parse(text); } catch(e) { return { _raw: text }; }
}

function proximaEntrega() {
  const hoy = new Date();
  const dia = hoy.getDay();
  let diasHasta;
  if (dia < 2)      diasHasta = 2 - dia;
  else if (dia < 4) diasHasta = 4 - dia;
  else              diasHasta = 9 - dia;
  const entrega = new Date(hoy);
  entrega.setDate(hoy.getDate() + diasHasta);
  return entrega.toLocaleDateString('es-CL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/Santiago'
  });
}

module.exports = async (req, res) => {
  if (req.method === 'GET') return res.status(200).end();
  if (req.method !== 'POST') return res.status(200).end();

  try {
    // Flow envía solo el token en el body
    const token = req.body?.token;
    if (!token) {
      console.error('No token recibido:', JSON.stringify(req.body));
      return res.status(200).end();
    }

    console.log('Token recibido:', token);

    // Consultar estado real del pago a Flow
    const pago = await flowGet('/payment/getStatus', { token });
    console.log('Flow getStatus:', JSON.stringify(pago));

    // status 2 = pagado exitosamente
    if (String(pago.status) !== '2') {
      console.log('Pago no aprobado, status:', pago.status, '— ignorando');
      return res.status(200).end();
    }

    // Extraer datos del optional
    let opt = {};
    try { opt = JSON.parse(pago.optional || '{}'); } catch(e) {}

    const qty   = Number(opt.q) || 1;
    const total = Number(opt.t) || pago.amount || 0;

    const pedido = {
      orden:     pago.commerceOrder || '—',
      nombre:    opt.n  || pago.payer || '—',
      email:     opt.e  || pago.payer || '—',
      brotes:    opt.b  || '—',
      horario:   opt.h  || '—',
      direccion: opt.d  || '—',
      qty,
      total:     `$${total.toLocaleString('es-CL')}`,
      entrega:   proximaEntrega(),
    };

    console.log('Pago confirmado:', JSON.stringify(pedido));

    // ─── EMITIR BOLETA HAULMER ───────────────────────────────────────
    let boletaFolio = null;
    let boletaError = null;
    try {
      const boleta = await emitirBoleta({
        nombre:  pedido.nombre,
        email:   pedido.email,
        qty,
        brotes:  pedido.brotes,
        total,
        orderId: pedido.orden
      });
      boletaFolio = boleta.folio || boleta.Folio || JSON.stringify(boleta);
      console.log('Boleta emitida OK folio:', boletaFolio);
    } catch(e) {
      boletaError = e.message;
      console.error('Error boleta Haulmer:', e.message);
    }
    // ────────────────────────────────────────────────────────────────

    // Notificar Apps Script
    if (APPS_SCRIPT_URL && APPS_SCRIPT_URL !== 'https://api.example.com') {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo:         'nueva_compra_directa',
          orden:        pedido.orden,
          nombre:       pedido.nombre,
          email:        pedido.email,
          brotes:       pedido.brotes,
          horario:      pedido.horario,
          direccion:    pedido.direccion,
          cantidad:     pedido.qty,
          total:        pedido.total,
          entrega:      pedido.entrega,
          boletaFolio:  boletaFolio || 'pendiente',
          boletaError:  boletaError || null,
        }),
      }).catch(e => console.error('Apps Script error:', e.message));
    } else {
      console.log('APPS_SCRIPT_URL no configurada — omitiendo notificación');
    }

    return res.status(200).end();

  } catch (err) {
    console.error('Error en payment-confirm:', err.message);
    return res.status(200).end();
  }
};
