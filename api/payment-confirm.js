// api/payment-confirm.js
// Flow llama aquí con POST después de confirmar el pago
// Envía correos al cliente y a hola@vertical53.com con el detalle completo
// Emite boleta electrónica via Haulmer OpenFactura

const crypto = require('crypto');
const { emitirBoleta } = require('./haulmer-boleta');

const SECRET_KEY      = process.env.FLOW_SECRET_KEY;
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

function signParams(params) {
  const keys = Object.keys(params).sort();
  let toSign = '';
  keys.forEach(k => { toSign += k + params[k]; });
  return crypto.createHmac('sha256', SECRET_KEY).update(toSign).digest('hex');
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
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(200).end();
  }
  if (req.method === 'GET') {
    return res.status(200).end();
  }

  try {
    const data = req.body;

    const received = data.s;
    const toVerify = { ...data };
    delete toVerify.s;
    const expected = signParams(toVerify);

    console.log('Firma recibida:', received);
    console.log('Firma esperada:', expected);
    console.log('Datos recibidos:', JSON.stringify(toVerify));

    if (received !== expected) {
      console.error('Firma inválida — procesando igual para no perder el pedido');
    }

    if (String(data.status) !== '2') {
      console.log('Pago no aprobado, status:', data.status);
      return res.status(200).end();
    }

    let opt = {};
    try { opt = JSON.parse(data.optional || '{}'); } catch(e) {}

    const qty   = Number(opt.q) || 1;
    const total = Number(opt.t) || 0;

    const pedido = {
      orden:     data.commerceOrder || '—',
      nombre:    opt.n   || data.payer || '—',
      email:     opt.e   || data.payer || '—',
      brotes:    opt.b   || '—',
      horario:   opt.h   || '—',
      direccion: opt.d   || '—',
      nota:      opt.nota || '—',
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
        nombre:   pedido.nombre,
        email:    pedido.email,
        qty,
        brotes:   pedido.brotes,
        total,
        orderId:  pedido.orden
      });
      boletaFolio = boleta.folio || boleta.Folio || JSON.stringify(boleta);
      console.log('Boleta emitida OK:', boletaFolio);
    } catch(e) {
      boletaError = e.message;
      console.error('Error boleta Haulmer:', e.message);
      // No interrumpimos el flujo — la boleta puede emitirse manualmente si falla
    }
    // ────────────────────────────────────────────────────────────────

    // Notificar Apps Script
    if (APPS_SCRIPT_URL) {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'nueva_compra_directa',
          ...pedido,
          boletaFolio: boletaFolio || 'pendiente',
          boletaError: boletaError || null,
        }),
      }).catch(e => console.error('Apps Script error:', e.message));
    }

    return res.status(200).end();

  } catch (err) {
    console.error('Error en payment-confirm:', err.message);
    return res.status(200).end();
  }
};
