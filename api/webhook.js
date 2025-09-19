export default async function handler(req, res) {
  // ---- VERIFY (GET /api/webhook?hub.mode=...&hub.verify_token=...&hub.challenge=...) ----
  if (req.method === 'GET') {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }

  // ---- RECEBER EVENTO (POST /api/webhook) ----
  if (req.method === 'POST') {
    res.status(200).end(); // responde rápido pro Meta

    try {
      const entry = req.body?.entry?.[0];
      const change = entry?.changes?.[0];
      const msg = change?.value?.messages?.[0];
      if (!msg) return;

      const toSend = msg.from; // telefone do usuário (E.164, sem "whatsapp:")
      const type = msg.type;

      // se usuário digitar oi/menu → envia o menu mínimo
      if (type === 'text') {
        const body = (msg.text?.body || '').trim().toLowerCase();
        if (body === 'oi' || body === 'menu') {
          await sendMainMenu(toSend);
        } else {
          await sendText(toSend, 'Digite "menu" para começar.');
        }
        return;
      }

      // se usuário clicou no List → vem list_reply.id
      if (type === 'interactive' && msg.interactive?.type === 'list_reply') {
        const choiceId = msg.interactive.list_reply.id;
        switch (choiceId) {
          case 'MAIN_ESTETICA':
            await sendText(toSend, 'Estética — teste ok. (Depois abrimos o submenu aqui)');
            break;
          case 'BACK_HOME':
          default:
            await sendMainMenu(toSend);
        }
        return;
      }

      // outros tipos
      await sendText(toSend, 'Recebi sua mensagem. Digite "menu".');

    } catch (e) {
      console.error('Erro no webhook:', e);
    }
    return;
  }

  // método não suportado
  res.setHeader('Allow', 'GET, POST');
  return res.status(405).send('Method Not Allowed');
}

// --------- helpers de envio ----------
async function sendText(to, text) {
  await fetch(`https://graph.facebook.com/v20.0/${process.env.PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text }
    })
  });
}

async function sendMainMenu(to) {
  await fetch(`https://graph.facebook.com/v20.0/${process.env.PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
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
    })
  });
}