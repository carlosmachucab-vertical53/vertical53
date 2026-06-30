// api/gracias.js
// Sirve la página de gracias directamente como función serverless
// Esto evita problemas de routing estático en webviews

module.exports = (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).send(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>Pago confirmado · Vertical 53°</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#001A2B;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
.card{background:#fff;border-radius:24px;padding:48px 32px;max-width:420px;width:100%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3)}
.icon{font-size:52px;margin-bottom:16px}
.title{font-size:24px;font-weight:700;color:#001A2B;margin-bottom:8px}
.sub{font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#176663;margin-bottom:20px}
.rule{width:36px;height:3px;background:#70BA5E;border-radius:2px;margin:0 auto 20px}
.body{font-size:15px;font-weight:300;line-height:1.85;color:#6B7280;margin-bottom:28px}
.body strong{color:#001A2B;font-weight:600}
.btn{display:inline-block;background:#70BA5E;color:#fff;padding:14px 32px;border-radius:12px;font-size:14px;font-weight:600;text-decoration:none}
.footer{margin-top:20px;font-size:10px;letter-spacing:1.5px;color:#9CA3AF;text-transform:uppercase}
</style>
</head>
<body>
<div class="card">
  <div class="icon">🌱</div>
  <div class="title">¡Pago confirmado!</div>
  <div class="sub">Vertical 53° · Punta Arenas</div>
  <div class="rule"></div>
  <p class="body">
    Gracias por tu compra.<br/><br/>
    Te enviaremos un correo con el <strong>detalle de tu pedido</strong> y la <strong>fecha y horario de entrega</strong> confirmados.<br/><br/>
    Tus microgreens serán cosechados el mismo día de la entrega para garantizar la máxima frescura.
  </p>
  <a href="https://www.vertical53.com" class="btn">Volver al inicio →</a>
  <div class="footer" style="margin-top:20px">¿Dudas? hola@vertical53.com · +56 9 8968 0810</div>
</div>
</body>
</html>`);
};
