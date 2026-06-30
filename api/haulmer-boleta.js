// api/haulmer-boleta.js
const HAULMER_API_URL = 'https://api.haulmer.com/v2/dte/document';

async function emitirBoleta({ nombre, email, qty, brotes, total, orderId }) {
  const apiKey = process.env.HAULMER_API_KEY;
  if (!apiKey) throw new Error('HAULMER_API_KEY no configurada');

  const descripcionItem = `Microgreens Vertical 53 ${qty} bandeja${qty > 1 ? 's' : ''} ${brotes}`.substring(0, 80);
  const precioUnitario = Math.round(total / qty);

  // Fecha de emisión en formato YYYY-MM-DD (Santiago)
  const now = new Date();
  const santiago = new Date(now.toLocaleString('en-US', { timeZone: 'America/Santiago' }));
  const pad = n => String(n).padStart(2, '0');
  const fechaEmision = `${santiago.getFullYear()}-${pad(santiago.getMonth()+1)}-${pad(santiago.getDate())}`;

  const body = {
    "dte": {
      "TipoDTE": 39,
      "Encabezado": {
        "IdDoc": {
          "TipoDTE": 39,
          "FchEmis": fechaEmision,
          "MedioPago": "EF"
        },
        "Emisor": {
          "RUTEmisor": "77466345-2"
        },
        "Receptor": {
          "RUTRecep": "66666666-6",
          "RznSocRecep": nombre || "Consumidor Final",
          "CorreoRecep": email || null
        },
        "Totales": {
          "MntTotal": total
        }
      },
      "Detalle": [
        {
          "NroLinDet": 1,
          "NmbItem": descripcionItem,
          "QtyItem": qty,
          "PrcItem": precioUnitario,
          "MontoItem": total
        }
      ]
    },
    "options": {
      "sendEmail": email ? true : false,
      "emailTo": email || null
    }
  };

  const idempotencyKey = orderId || `V53-${Date.now()}`;
  console.log('Haulmer request:', JSON.stringify(body));

  const res = await fetch(HAULMER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey,
      'Idempotency-Key': idempotencyKey
    },
    body: JSON.stringify(body)
  });

  const text = await res.text();
  console.log('Haulmer response:', res.status, text);

  let data;
  try { data = JSON.parse(text); } catch(e) { data = { _raw: text }; }

  if (!res.ok) throw new Error(`Haulmer ${res.status}: ${text}`);

  return data;
}

module.exports = { emitirBoleta };
