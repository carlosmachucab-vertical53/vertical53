// api/haulmer-boleta.js
// Emite boleta electrónica via Haulmer OpenFactura API
// Endpoint: POST https://api.haulmer.com/v2/dte/document
// Tipo documento 39 = Boleta Electrónica

const HAULMER_API_URL = 'https://api.haulmer.com/v2/dte/document';

/**
 * Emite una boleta electrónica en Haulmer
 * @param {object} params
 * @param {string} params.nombre     - Nombre del cliente
 * @param {string} params.email      - Email del cliente
 * @param {number} params.qty        - Cantidad de bandejas
 * @param {string} params.brotes     - Descripción de brotes seleccionados
 * @param {number} params.total      - Monto total en CLP (con IVA incluido)
 * @param {string} params.orderId    - ID de la orden (ej: V53-1234567890)
 * @returns {object} respuesta de Haulmer con folio y PDF
 */
async function emitirBoleta({ nombre, email, qty, brotes, total, orderId }) {
  const apiKey = process.env.HAULMER_API_KEY;
  if (!apiKey) throw new Error('HAULMER_API_KEY no configurada');

  // Boleta electrónica: tipo 39
  // Monto total incluye IVA — para boletas de consumidor final
  // el SII acepta MntTotal directamente sin desglosar neto/IVA
  const descripcionItem = `Microgreens Vertical 53° · ${qty} bandeja${qty > 1 ? 's' : ''} · ${brotes}`.substring(0, 80);

  const body = {
    "Documento": {
      "Encabezado": {
        "IdDoc": {
          "TipoDTE": 39,
          "FchVenc": null,
          "MedioPago": "EF"  // Efectivo/Transferencia — requerido desde Feb 2026
        },
        "Receptor": {
          "RUTRecep": "66666666-6",        // RUT consumidor final para boletas B2C
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
          "PrcItem": Math.round(total / qty),
          "MontoItem": total
        }
      ]
    },
    "options": {
      "sendEmail": true,   // Haulmer envía la boleta al email del receptor
      "returnPdf": false
    }
  };

  const idempotencyKey = orderId || `V53-${Date.now()}`;

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
  let data;
  try { data = JSON.parse(text); } catch(e) { data = { _raw: text }; }

  if (!res.ok) {
    console.error('Haulmer error:', res.status, text);
    throw new Error(`Haulmer ${res.status}: ${data.message || text}`);
  }

  return data;
}

module.exports = { emitirBoleta };
