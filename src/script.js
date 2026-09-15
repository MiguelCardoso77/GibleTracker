const TARGET_URL = '/api/proxy';

async function loadPayload() {
  const res = await fetch('payload.json');
  return res.json();
}

document.getElementById('send-btn').addEventListener('click', async () => {
  const output = document.getElementById('output');
  output.textContent = 'A enviar...';

  try {
    const payload = await loadPayload();

    const res = await fetch(TARGET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    let formatted = text;
    try {
      formatted = JSON.stringify(JSON.parse(text), null, 2);
    } catch (_) {
      // resposta não é JSON válido, mostra o texto tal como veio
    }
    output.textContent = `Status: ${res.status}\n\n${formatted}`;
  } catch (err) {
    output.textContent = `Erro: ${err.message}\n\n(Provavelmente CORS - ver nota no README/servidor)`;
  }
});
