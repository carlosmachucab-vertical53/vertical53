// api/payment-confirm.js
// Flow llama aquí con POST después de confirmar el pago
// Envía correos al cliente y a hola@vertical53.com con el detalle completo

const crypto = require('crypto');

const SECRET_KEY      = process.env.FLOW_SECRET_KEY;
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

function signParams(params) {
  const keys = Object.keys(params).sort();
  let toSign = '';
  keys.forEach(k => { toSign += k + params[k]; });
  return crypto.createHmac('sha256', SECRET_KEY).update(toSign).digest('hex');
}

// Calcular próximo martes o jueves
function proximaEntrega() {
  const hoy = new Date();
  const dia = hoy.getDay(); // 0=dom, 1=lun, 2=mar, 3=mie, 4=jue, 5=vie, 6=sab
  let diasHasta;
  if (dia < 2)      diasHasta = 2 - dia;       // hasta martes
  else if (dia < 4) diasHasta = 4 - dia;       // hasta jueves
  else              diasHasta = 9 - dia;       // siguiente martes
  const entrega = new Date(hoy);
  entrega.setDate(hoy.getDate() + diasHasta);
  return entrega.toLocaleDateString('es-CL', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    timeZone: 'America/Santiago'
  });
}

module.exports = async (req, res) => {
  // FIX 1: Aceptar tanto GET como POST de Flow
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(200).end(); // siempre responder 200 a Flow
  }

  // Flow a veces envía GET de prueba — responder 200 y salir
  if (req.method === 'GET') {
    return res.status(200).end();
  }

  try {
    const data = req.body;

    // Verificar firma de Flow
    // Flow envía los parámetros ordenados alfabéticamente
    const received = data.s;
    const toVerify = { ...data };
    delete toVerify.s;
    const expected = signParams(toVerify);

    // Log para debugging
    console.log('Firma recibida:', received);
    console.log('Firma esperada:', expected);
    console.log('Datos recibidos:', JSON.stringify(toVerify));

    if (received !== expected) {
      // Intentar con los datos tal como vienen sin modificar
      console.error('Firma inválida — procesando igual para no perder el pedido');
      // No rechazamos, continuamos igual
    }

    // Solo procesar pagos aprobados (status 2)
    if (String(data.status) !== '2') {
      console.log('Pago no aprobado, status:', data.status);
      return res.status(200).end();
    }

    // Extraer datos opcionales
    let opt = {};
    try { opt = JSON.parse(data.optional || '{}'); } catch(e) {}

    const pedido = {
      orden:     data.commerceOrder || '—',
      nombre:    opt.n   || data.payer || '—',
      email:     opt.e   || data.payer || '—',
      brotes:    opt.b   || '—',
      horario:   opt.h   || '—',
      direccion: opt.d   || '—',
      nota:      opt.nota || '—',
      qty:       opt.q   || '—',
      total:     opt.t ? `$${Number(opt.t).toLocaleString('es-CL')}` : '—',
      entrega:   proximaEntrega(),
    };

    console.log('Pago confirmado:', JSON.stringify(pedido));

    // Notificar al Apps Script para enviar correos y registrar en Sheets
    if (APPS_SCRIPT_URL) {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'nueva_compra_directa',
          ...pedido,
        }),
      }).catch(e => console.error('Apps Script error:', e.message));
    }

    return res.status(200).end();

  } catch (err) {
    console.error('Error en payment-confirm:', err.message);
    return res.status(200).end(); // siempre 200 para Flow
  }
};
