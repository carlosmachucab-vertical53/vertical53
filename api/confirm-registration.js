
// api/confirm-registration.js
// Flow llama a esta URL después que el cliente registra su tarjeta
// Recibe: token (de Flow via query param)
// Confirma el registro y redirige al sitio con mensaje de éxito

const crypto = require('crypto');

const FLOW_API_URL = 'https://www.flow.cl/api';
const API_KEY     = process.env.FLOW_API_KEY;
const SECRET_KEY  = process.env.FLOW_SECRET_KEY;

function signParams(params) {
  const keys = Object.keys(params).sort();
  let toSign = '';
  keys.forEach(k => { toSign += k + params[k]; });
  return crypto.createHmac('sha256', SECRET_KEY).update(toSign).digest('hex');
}

async function flowGet(endpoint, params) {
  const p = { ...params, apiKey: API_KEY };
  p.s = signParams(p);
  const res = await fetch(`${FLOW_API_URL}${endpoint}?${new URLSearchParams(p).toString()}`);
  return res.json();
}

module.exports = async (req, res) => {
  const { token, box, size, nombre, email, planId } = req.query;

  if (!token) {
    return res.redirect('https://www.vertical53.com?suscripcion=error');
  }

  try {
    // Verificar estado del registro de tarjeta
    const status = await flowGet('/customer/getRegisterStatus', { token });
    console.log('Register status:', JSON.stringify(status));

    // status 1 = tarjeta registrada exitosamente
    if (status.status === 1) {
      const nombreEncoded = encodeURIComponent(nombre || '');
      return res.redirect(
        `https://www.vertical53.com?suscripcion=ok&box=${box}&size=${size}&nombre=${nombreEncoded}`
      );
    } else {
      console.error('Registro de tarjeta fallido:', status);
      return res.redirect('https://www.vertical53.com?suscripcion=error');
    }

  } catch (err) {
    console.error('Error confirmando registro:', err.message);
    return res.redirect('https://www.vertical53.com?suscripcion=error');
  }
};
