// api/flow-webhook.js
// Vercel Serverless Function
// Flow llama a esta URL cada vez que se confirma un pago de suscripción
// Configurar en Flow: Configuración → Webhooks → URL: https://www.vertical53.com/api/flow-webhook

const crypto = require('crypto');

const SECRET_KEY = process.env.FLOW_SECRET_KEY;
const GMAIL_URL  = process.env.APPS_SCRIPT_URL; // URL del Google Apps Script existente

function signParams(params) {
  const keys = Object.keys(params).sort();
  let toSign = '';
  keys.forEach(k => { toSign += k + params[k]; });
  return crypto.createHmac('sha256', SECRET_KEY).update(toSign).digest('hex');
}

// Calcula el próximo lunes
function proximoLunes() {
  const hoy = new Date();
  const dia = hoy.getDay();
  const diasHastaLunes = dia === 1 ? 7 : (8 - dia) % 7 || 7;
  hoy.setDate(hoy.getDate() + diasHastaLunes);
  const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Santiago' };
  return hoy.toLocaleDateString('es-CL', opciones);
}

// Nombres legibles de los planes
const PLAN_NAMES = {
  BDS: 'Box Detox S (3 unidades)',
  BDM: 'Box Detox M (5 unidades)',
  BDL: 'Box Detox L (8 unidades)',
  BBS: 'Box Brunch S (3 unidades)',
  BBM: 'Box Brunch M (5 unidades)',
  BBL: 'Box Brunch L (8 unidades)',
  BSS: 'Box Spicy S (3 unidades)',
  BSM: 'Box Spicy M (5 unidades)',
  BSL: 'Box Spicy L (8 unidades)',
  BPS: 'Box Proteína S (3 unidades)',
  BPM: 'Box Proteína M (5 unidades)',
  BPL: 'Box Proteína L (8 unidades)',
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const data = req.body;

    // Verificar firma de Flow
    const receivedSig = data.s;
    const paramsToSign = { ...data };
    delete paramsToSign.s;
    const expectedSig = signParams(paramsToSign);

    if (receivedSig !== expectedSig) {
      console.error('Firma Flow inválida');
      return res.status(401).json({ error: 'Firma inválida' });
    }

    // Solo procesar eventos de cobro exitoso
    // status: 1=pendiente, 2=pagado, 3=rechazado, 4=anulado
    if (data.status !== '2' && data.status !== 2) {
      return res.status(200).json({ ok: true, msg: 'Evento ignorado' });
    }

    const {
      customerId,
      planId,
      subscriptionId,
      amount,
      currency,
    } = data;

    const planNombre = PLAN_NAMES[planId] || planId;
    const entrega    = proximoLunes();
    const monto      = Number(amount).toLocaleString('es-CL');

    // ── Notificar al Apps Script para registrar en Sheets y enviar correo ──
    if (GMAIL_URL) {
      await fetch(GMAIL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'nueva_suscripcion',
          email: customerId,
          plan: planNombre,
          planId,
          subscriptionId,
          monto,
          currency,
          proximaEntrega: entrega,
        }),
      });
    }

    console.log(`Suscripción confirmada: ${customerId} → ${planNombre}`);
    return res.status(200).json({ ok: true });

  } catch (err) {
    console.error('Error en webhook:', err);
    return res.status(500).json({ error: 'Error interno' });
  }
};
