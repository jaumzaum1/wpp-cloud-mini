// api/webhook.js
const WPP_API = (phoneId) => `https://graph.facebook.com/v20.0/${phoneId}/messages`;
const AUTH = () => ({ 'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}` });

async function postJSON(url, payload) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000); // timeout 15s
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...AUTH(), 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const text = await res.text();
    if (!res.ok) {
      console.error('Graph POST non-200', res.status, text);
      throw new Error(`Graph ${res.status}: ${text}`);
    }
    return text;
  } catch (e) {
    console.error('Graph POST failed:', e);
    throw e;
  } finally {
    clearTimeout(t);
  }
}

async function sendText(to, body) {
  return postJSON(WPP_API(process.env.PHONE_NUMBER_ID), {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body }
  });
}

async function sendMainMenu(to) {
  return postJSON(WPP_API(process.env.PHONE_NUMBER_ID), {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      header: { type: 'text', text: 'Clínica Juliana Hortense' },
      body:   { text: 'Selecione uma opção:' },
      footer: { text: 'Novidade: Longevidade e Emagrecimento com o Dr. João.' },
      action: {
        button: 'Abrir',
        sections: [{
          title: 'Menu',
          rows: [
            { id: 'MAIN_ESTETICA', title: 'Estética',        description: 'Procedimentos' },
            { id: 'BACK_HOME',     title: 'Voltar ao menu', description: 'Reabrir menu' }
          ]
        }]
      }
    }
  });
}

// --- Healthcheck: chama o Graph pra ver se credenciais/conectividade OK ---
export async function GET(req, res) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  // Webhook verify
  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  // Ping opcional: GET /api/webhook?ping=1&to=5561996531507
  if (url.searchParams.get('ping') === '1') {
    const to = url.searchParams.get('to');
    try {
      const resp = await sendText(to || '5561996531507', 'PING ✅');
      return new Response(`PING_OK ${resp}`, { status: 200 });
    } catch (e) {
      return new Response(`PING_FAIL ${e}`, { status: 500 });
    }
  }

  return new Response('OK', { status: 200 });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const msg = change?.value?.messages?.[0];

    // responda rápido pro Meta
    const ack = new Response('', { status: 200 });

    if (!msg) return ack;

    const from = msg.from; // e.g. 5561996531507
    const type = msg.type;

    // debug básico
    console.log('INBOUND type:', type, 'from:', from);

    if (type === 'text') {
      const txt = (msg.text?.body || '').trim().toLowerCase();
      if (txt === 'oi' || txt === 'menu') {
        // tente enviar o menu
        try {
          const r = await sendMainMenu(from);
          console.log('MENU_SENT', r);
        } catch (e) {
          console.error('MENU_SEND_ERROR', e);
        }
      } else {
        try {
          const r = await sendText(from, 'Digite "menu" para começar.');
          console.log('TEXT_SENT', r);
        } catch (e) {
          console.error('TEXT_SEND_ERROR', e);
        }
      }
      return ack;
    }

    if (type === 'interactive' && msg.interactive?.type === 'list_reply') {
      const choiceId = msg.interactive.list_reply.id;
      console.log('CHOICE_ID', choiceId);
      try {
        if (choiceId === 'MAIN_ESTETICA') {
          await sendText(from, 'Estética — teste ok. (Depois abrimos o submenu aqui)');
        } else {
          await sendMainMenu(from);
        }
      } catch (e) {
        console.error('REPLY_SEND_ERROR', e);
      }
      return ack;
    }

    // outros tipos
    try {
      await sendText(from, 'Recebi sua mensagem. Digite "menu".');
    } catch (e) {
      console.error('FALLBACK_SEND_ERROR', e);
    }
    return ack;

  } catch (e) {
    console.error('Webhook handler error:', e);
    return new Response('', { status: 200 });
  }
}
