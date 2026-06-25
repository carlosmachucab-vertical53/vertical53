// api/notify-transfer.js
// Notifica pedido por transferencia bancaria via Apps Script
// Reemplaza el flujo de Formspree para transferencias

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { nombre, email, telefono, direccion, cantidad, brotes, horario, total, despacho, nota } = req.body;

    console.log('Pedido transferencia:', JSON.stringify(req.body));

    if (APPS_SCRIPT_URL && APPS_SCRIPT_URL !== 'https://api.example.com') {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo:      'pedido_transferencia',
          nombre,
          email,
          telefono,
          direccion,
          cantidad,
          brotes,
          horario,
          total,
          despacho,
          nota: nota || '—',
        }),
      }).catch(e => console.error('Apps Script error:', e.message));
    }

    return res.status(200).json({ ok: true });
  } catch(err) {
    console.error('notify-transfer error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
