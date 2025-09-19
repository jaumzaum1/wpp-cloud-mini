// api/webhook.js — WhatsApp Cloud API (menu completo)
// Runtime Edge (sem servidor próprio)
export const config = { runtime: 'edge' };

// ========= CONFIG BÁSICA =========
const GRAPH_BASE = (pid) => `https://graph.facebook.com/v20.0/${pid}/messages`;
const HEADERS = () => ({
  'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
  'Content-Type': 'application/json'
});
const PHONE_ID = process.env.PHONE_NUMBER_ID;

// ========= HELPERS HTTP =========
async function postJSON(url, payload) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: HEADERS(),
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    const text = await res.text();
    if (!res.ok) {
      console.error('Graph POST non-200', res.status, text);
      throw new Error(`Graph ${res.status}: ${text}`);
    }
    return text;
  } finally {
    clearTimeout(t);
  }
}
async function sendText(to, body) {
  return postJSON(GRAPH_BASE(PHONE_ID), {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body }
  });
}
async function sendList(to, { header, body, footer, button, rows }) {
  // rows: [{id,title,description}], máx 10
  return postJSON(GRAPH_BASE(PHONE_ID), {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      header: { type: 'text', text: header },
      body:   { text: body },
      footer: { text: footer || '' },
      action: {
        button,
        sections: [{ title: 'Menu', rows }]
      }
    }
  });
}

// ========= MENUS =========
async function sendMainMenu(to) {
  return sendList(to, {
    header: 'Clínica Juliana Hortense',
    body: 'Selecione uma opção:',
    footer: 'Novidade: Longevidade & Emagrecimento com o Dr. João.',
    button: 'Abrir',
    rows: [
      { id: 'MAIN_MEDICOS',   title: 'Médicos',                 description: 'Conheça quem atende' },
      { id: 'MAIN_SERVICOS',  title: 'Serviços',                description: 'O que atendemos' },
      { id: 'MAIN_TEC',       title: 'Tecnologias - Juliana',   description: 'Laser, HIFU, RF…' },
      { id: 'MAIN_LONGE',     title: 'Longevidade & Emag.',     description: 'Dr. João' },
      { id: 'MAIN_ESTETICA',  title: 'Estética',                description: 'Facial e corporal' },
      { id: 'MAIN_CAPILAR',   title: 'Trat. capilar',           description: 'Queda/afinamento' },
      { id: 'MAIN_ATENDENTE', title: 'Atendente',               description: 'Falar com humano' }
    ]
  });
}

async function sendMedicosMenu(to) {
  return sendList(to, {
    header: 'Nossos médicos',
    body: 'Escolha um médico:',
    footer: 'Tecnologias e estética avançada.',
    button: 'Abrir',
    rows: [
      { id: 'MED_JULIANA', title: 'Dra. Juliana', description: 'Dermatologia Estética' },
      { id: 'MED_JOAO',    title: 'Dr. João',     description: 'Longevidade & Estética' },
      { id: 'BACK_HOME',   title: 'Voltar ao menu', description: 'Reabrir menu' }
    ]
  });
}

async function sendServicosMenu(to) {
  // Envia um resumo curto e abre o menu
  await sendText(to,
`*Dra. Juliana Hortense*
• Tecnologias: conjunto de plataformas a laser, ultrassom microfocado e radiofrequência para tratar textura, poros, viço, manchas, flacidez leve, contorno e qualidade de pele, com alta precisão e protocolos personalizados. Tecnologias disponíveis: Fotona®, Ulthera®, Volnewmer®, Luz Pulsada, Laser Q-switched, CoolSculpting, Emsculpt®, Emface®, e Emsella®. Ver mais detalhes em “Tecnologias (Dra. Juliana)”.
• Injetáveis: toxina botulínica, ácido hialurônico e bioestimulador.

*Dr. João Maldonado*
• Longevidade/Emagrecimento: abordagem médica integrativa com avaliação clínica completa utilizando análogos de GLP-1 (ex: Mounjaro®) para emagrecimento, reposição/implantes hormonais para ganho de massa muscular e infusão endovenosa suplementar (soroterapia), oral ou intramuscular para reposição guiada de vitaminas, antioxidantes, eletrólitos e minerais essenciais. Ver mais detalhes em “Longevidade/Emagrecimento (Dr. João)”.
• Estética facial e corporal: ampla gama de procedimentos injetáveis, como toxina botulínica, preenchedores, bioestimuladores, skinbooster, fios, peelings, enzimas, PDRN, exossomos capilar, PRP, polinucleotídeos, Profhilo e microagulhamento. Ver mais detalhes em “Estética Facial e Corporal”.
• Tratamento capilar (queda/afinamento): voltado a alopecia (androgenética, eflúvios, pós-parto, cicatriciais, areata e outras). O foco é tratar a causa e o efeito: interromper a queda, melhorar densidade/espessura e manter os resultados. O plano pode combinar minoxidil (tópico/oral), finasterida/dutasterida (inibidores da 5α-redutase, tópico/oral), microagulhamento, exossomos, PRP e PDRN, além de ajustes metabólicos/hormonais quando indicados. Ver mais detalhes em “Tratamento capilar (Dr. João)”.`);
  return sendList(to, {
    header: 'Serviços',
    body: 'Selecione um serviço para detalhes:',
    footer: 'Você pode voltar ao menu a qualquer momento.',
    button: 'Abrir',
    rows: [
      { id: 'MAIN_TEC',      title: 'Tecnologias - Juliana', description: 'Laser, HIFU, RF…' },
      { id: 'MAIN_LONGE',    title: 'Longevidade & Emag.',   description: 'Abordagem integrativa' },
      { id: 'MAIN_ESTETICA', title: 'Estética',              description: 'Facial e corporal' },
      { id: 'MAIN_CAPILAR',  title: 'Trat. capilar',         description: 'Queda/afinamento' },
      { id: 'BACK_HOME',     title: 'Voltar ao menu',        description: 'Reabrir menu' }
    ]
  });
}

async function sendTecnologiasMenu(to) {
  return sendList(to, {
    header: 'Tecnologias (Dra. Juliana)',
    body: 'Escolha uma tecnologia:',
    footer: 'Protocolos personalizados após avaliação.',
    button: 'Abrir',
    rows: [
      { id: 'TEC_FOTONA',     title: 'Fotona®',        description: 'Laser Nd:YAG/Er:YAG' },
      { id: 'TEC_ULTHERA',    title: 'Ulthera®',       description: 'Ultrassom microfocado' },
      { id: 'TEC_VOLNEWMER',  title: 'Volnewmer®',     description: 'Radiofrequência' },
      { id: 'TEC_IPL',        title: 'Luz Pulsada',    description: 'IPL' },
      { id: 'TEC_QSW',        title: 'Laser Q-switched', description: 'Pigmentos/manchas' },
      { id: 'TEC_COOLSCULPT', title: 'CoolSculpting',  description: 'Congelamento de gordura' },
      { id: 'TEC_EMSCULPT',   title: 'Emsculpt®',      description: 'HIFEM muscular' },
      { id: 'TEC_EMFACE',     title: 'Emface®',        description: 'HIFES + RF facial' },
      { id: 'TEC_EMSELLA',    title: 'Emsella®',       description: 'Assoalho pélvico' },
      { id: 'BACK_HOME',      title: 'Voltar ao menu', description: 'Reabrir menu' }
    ]
  });
}

async function sendEsteticaMenu1(to) {
  return sendList(to, {
    header: 'Estética (1/2)',
    body: 'Escolha um procedimento:',
    footer: 'Toque em Próximo p/ mais opções.',
    button: 'Abrir',
    rows: [
      { id: 'EST_BOTOX', title: 'Toxina botulínica',      description: 'linhas, sorriso, bruxismo' },
      { id: 'EST_AH',    title: 'Ácido hialurônico',      description: 'preenchedores' },
      { id: 'EST_BIO',   title: 'Bioestimuladores',       description: 'neocolagênese' },
      { id: 'EST_SKINB', title: 'Skinbooster',            description: 'hidratação dérmica' },
      { id: 'EST_FIOS',  title: 'Fios de sustentação',    description: 'vetores e suporte' },
      { id: 'EST_PEEL',  title: 'Peelings químicos',      description: 'sup/med/prof' },
      { id: 'EST_EMPT',  title: 'Enzimas (emptiers)',     description: 'gordura localizada' },
      { id: 'EST_PDRN',  title: 'PDRN',                   description: 'biomodulação' },
      { id: 'EST_EXOS',  title: 'Exossomos capilar',      description: 'biotecnologia' },
      { id: 'EST_NEXT2', title: 'Próximo (2/2)',          description: 'mais opções' }
    ]
  });
}
async function sendEsteticaMenu2(to) {
  return sendList(to, {
    header: 'Estética (2/2)',
    body: 'Mais procedimentos:',
    footer: 'Você pode voltar ao menu.',
    button: 'Abrir',
    rows: [
      { id: 'EST_PRP',   title: 'PRP',             description: 'plasma rico em plaquetas' },
      { id: 'EST_POLI',  title: 'Polinucleotídeos',description: 'elasticidade/hidratação' },
      { id: 'EST_PROF',  title: 'Profhilo',        description: 'biorremodelador AH' },
      { id: 'EST_MICRO', title: 'Microagulhamento',description: 'colágeno/couro cabeludo' },
      { id: 'EST_BACK1', title: 'Voltar (1/2)',    description: 'retornar' },
      { id: 'BACK_HOME', title: 'Voltar ao menu',  description: 'reabrir menu' }
    ]
  });
}

// ========= TEXTOS (DETALHES) =========
// Médicos
async function sendMedicoJuliana(to) {
  return sendText(to,
`*Dra. Juliana Hortense*
Dermatologista com mais de 20 anos de experiência. Formada pela Universidade Estadual de Londrina (UEL), com residência médica pela Faculdade de Medicina de Botucatu (UNESP). Membro da Sociedade Brasileira e Europeia de Dermatologia. Especialista no que há de mais novo em tecnologias médicas na área de Dermatologia Estética facial e corporal. Atua também com injetáveis (toxina botulínica, preenchedores faciais e bioestimuladores).`);
}
async function sendMedicoJoao(to) {
  await sendText(to,
`*Dr. João Maldonado*
Médico e Engenheiro, formado pela Universidade Federal de Brasília (UnB) e pelo Instituto Tecnológico de Aeronáutica (ITA), pós-graduado em Medicina Estética Avançada e em Farmacologia Clínica, especializado em Medicina da Longevidade e do Emagrecimento, e com MBA em Healthtech. Atua com análogos de GLP-1 (Mounjaro®), terapia de reposição hormonal/implantes hormonais, infusão endovenosa suplementar (soroterapia), tratamento de queda capilar, e uma ampla gama de procedimentos estéticos faciais e corporais.`);
  return sendText(to,
`*Como funciona minha consulta (Longevidade & Emagrecimento)*
Minha consulta é integrativa em Estética, Longevidade e Emagrecimento. Começamos com anamnese, exame físico e registro por fotos/medidas; exames laboratoriais são obrigatórios e, quando indicado, pedimos imagem. A partir disso, montamos um plano em fases com metas realistas e acompanhamento próximo (revisões e ajustes). Trabalho com análogos de GLP-1 (Mounjaro®), reposição hormonal (incluindo implantes hormonais), infusão endovenosa suplementar (soroterapia) de vitaminas, minerais, eletrólitos e antioxidantes quando há déficit ou sintomas, tratamento para queda capilar, além de procedimentos estéticos faciais e corporais — sempre com prescrição após avaliação médica individual.`);
}

// Tecnologias (detalhes)
async function sendTecDetalhe(to, id) {
  const textos = {
    TEC_FOTONA:
`*Fotona (Nd:YAG/Er:YAG)*
Tecnologia de múltiplos comprimentos de onda que trata textura, poros, viço, manchas e flacidez leve, com alta precisão. Sessões de 30–60 min. Pode gerar vermelhidão e descamação leve por 1–5 dias. Em geral 3–6 sessões com intervalos de 4 semanas. Resultados progressivos nas 4–12 semanas após início.`,
    TEC_ULTHERA:
`*Ulthera (HIFU)*
Focaliza calor em camadas profundas para lift e definição sem cortes, estimulando colágeno. Sessão de 45–90 min. Usualmente 1 sessão, com reforço semestral/anual. Pico de resposta de 2–3 meses.`,
    TEC_VOLNEWMER:
`*Volnewmer (radiofrequência)*
Radiofrequência aquece a derme de forma controlada para melhorar flacidez e qualidade de pele. Sessões de 30–60 min. Em geral manutenção semestral/anual conforme avaliação.`,
    TEC_IPL:
`*Luz Pulsada (IPL)*
Luz de amplo espectro para manchas solares, vermelhidão e fotorejuvenescimento. Sessões de 20–40 min; Pode gerar hiperpigmentação temporária e descamação leve por 3–5 dias. Em média 3–5 sessões com intervalos mensais; melhora visível em 4–8 semanas.`,
    TEC_QSW:
`*Laser Q-switched*
Pulsos ultracurtos de alta energia voltados a manchas e pigmentos com mínima difusão térmica. Sessões de 10–30 min. Pode gerar hiperpigmentação temporária e pequenas crostas nos pontos tratados por 3–5 dias. Geralmente 3–8 sessões mensais; clareamento gradual.`,
    TEC_COOLSCULPT:
`*CoolSculpting*
Congela o tecido adiposo para quebrar gordura localizada de áreas como abdome, flancos, braços, coxas, culote, papada. Sessões de 35–60 min por área; pode ocorrer edema/dormência por 15–30 dias. Normalmente 1–3 ciclos por área; resultados a partir de 4 semanas, com evolução até 12 semanas.`,
    TEC_EMSCULPT:
`*Emsculpt (HIFEM muscular)*
Campos eletromagnéticos de alta intensidade provocam contrações supramáximas, ajudando tônus/volume muscular e redução de gordura. Sessões de 20–30 min, sem downtime. Protocolo típico: 4–8 sessões (2×/semana); manutenção mensal/trimestral. Sinais iniciais em 2–4 semanas.`,
    TEC_EMFACE:
`*Emface (HIFES + RF facial)*
Estimulação elétrica de alta intensidade combinada à radiofrequência para elevar e tonificar sem agulhas. Sessões de 20–30 min, sem downtime. Geralmente 4 sessões (1×/semana); manutenção semestral. Melhoras em 4–8 semanas.`,
    TEC_EMSELLA:
`*Emsella (assoalho pélvico/HIFEM)*
Estimula de forma não invasiva o assoalho pélvico, auxiliando conforto e suporte íntimo. Sessão de 28 min, sentado e vestido; sem downtime. Em média 6 sessões (2×/semana); manutenção trimestral. Evolução em 2–6 semanas.`
  };
  return sendText(to, textos[id]);
}

// Longevidade (detalhe)
async function sendLongevidade(to) {
  return sendText(to,
`*Longevidade & Emagrecimento (Dr. João)*
Abordagem integrativa com avaliação clínica completa. Opções conforme indicação: análogos de GLP-1 (Mounjaro®), reposição/implantes hormonais, infusão endovenosa suplementar (soroterapia), além de ajustes de hábitos e metas em fases com acompanhamento próximo. Exames laboratoriais obrigatórios e, quando necessário, de imagem. Tudo prescrito após avaliação médica individual.`);
}

// Capilar (detalhe)
async function sendCapilar(to) {
  return sendText(to,
`*Tratamento capilar (queda/afinamento)*
Voltado a alopecia androgenética, eflúvios, pós-parto, cicatriciais, areata e outras. Foco em tratar causa e efeito: interromper a queda, melhorar densidade/espessura e manter resultados.

*Como avaliamos*: anamnese, hábitos/estresse/sono/medicações, exame físico, dermatoscopia do couro cabeludo, exames (ferro, ferritina, vitaminas, tireoide, hormônios, marcadores inflamatórios) e fotos/medidas para acompanhar.

*Plano terapêutico*: pode combinar minoxidil (tópico/oral), finasterida/dutasterida (inibidores da 5α-redutase; tópico/oral), microagulhamento, exossomos, PRP e PDRN, além de ajustes metabólicos/hormonais quando indicados.`);
}

// Estética (detalhes)
async function sendEsteticaDetalhe(to, id) {
  const textos = {
    EST_BOTOX:
`*Toxina botulínica*
Suaviza linhas dinâmicas preservando a expressão natural (testa, glabela, pés-de-galinha e outras). Inclui indicações como *sorriso gengival*, *bruxismo* e *enxaqueca* quando clinicamente indicado. Procedimento de 15–30 min; início em 3–7 dias, pico em 14 dias. Duração média 3–4 meses — em geral, programa-se *≈3 aplicações/ano*.`,
    EST_AH:
`*Ácido hialurônico (preenchedores)*
Contorno, projeção e hidratação em pontos estratégicos (malar, lábios, mandíbula, olheiras, mento). Sessão de 30–60 min; downtime leve; duração 9–18 meses (varia por área).`,
    EST_BIO:
`*Bioestimuladores*
Indicado para firmeza e qualidade da pele, age estimulando colágeno gradualmente. Sessão de 20–40 min. Pode gerar leve edema/hematoma que desaparecem em poucos dias. Em geral 1–3 sessões/ano; resposta progressiva em 6–12 semanas.`,
    EST_SKINB:
`*Skinbooster*
Hidratação dérmica e viço com ácido hialurônico de baixa reticulação — inclui *lábios*. Sessões de 20–30 min; 1–3 sessões com manutenção semestral.`,
    EST_FIOS:
`*Fios de sustentação*
Vetores de suporte e estímulo de colágeno para flacidez leve. Procedimento ambulatorial; recuperação curta (edema/sensibilidade). Efeito imediato com melhora progressiva.`,
    EST_PEEL:
`*Peelings químicos*
Renovação de textura e tom. Existem *superficiais, médios e profundos*. *Tipos*: glicólico, salicílico, mandélico, Jessner, TCA e *ATA-cróton*; **não** realizamos fenol. Ciclos mensais até objetivo; downtime varia conforme profundidade.`,
    EST_EMPT:
`*Enzimas (emptiers)*
Remodelagem de pequenas áreas de gordura localizada (*abdômen, flancos, culotes, papada etc.*). Sessão de 20–40 min; pode haver edema/ardor local temporário. Protocolos em séries.`,
    EST_PDRN:
`*PDRN (polidesoxirribonucleotídeo)*
Biomodulação e suporte reparador para qualidade de pele; também pode ser aplicado em *couro cabeludo* e *feridas*, conforme avaliação. Sessões seriadas (3–5) com intervalos; downtime leve.`,
    EST_EXOS:
`*Exossomos capilar*
Vesículas de sinalização avançadas, originadas de pesquisa em biotecnologia para regeneração tecidual, que entregam sinais para micromanejo de inflamação e estímulo trófico local. Aplicados em protocolos capilares para qualidade do couro cabeludo e densidade — via de regra associados a outras terapias (minoxidil, microagulhamento, PRP).`,
    EST_PRP:
`*PRP (plasma rico em plaquetas)*
*Autólogo*: preparado a partir do seu próprio sangue em *centrífuga*, concentrando fatores de crescimento. Usado para pele e couro cabeludo. Sessões mensais iniciais (3–4), depois manutenção.`,
    EST_POLI:
`*Polinucleotídeos*
Suporte à elasticidade, hidratação e reparo cutâneo. Sessões seriadas com intervalos de 2–4 semanas; downtime leve.`,
    EST_PROF:
`*Profhilo*
Biorremodelador de ácido hialurônico para qualidade global da pele. Esquema clássico: 2 sessões com 30 dias. Pontos de aplicação em *face* (clássico) e, conforme avaliação, *pescoço*/*colo*/*mãos*. Downtime leve (pontos temporários).`,
    EST_MICRO:
`*Microagulhamento*
Indução de colágeno e possível drug delivery. Sessões mensais (3–6); downtime de 1–3 dias. *Aplicação capilar* é um dos usos principais nos protocolos de queda/afinamento.`
  };
  return sendText(to, textos[id]);
}

// ========= HANDLERS =========
export async function GET(req) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  // ping opcional p/ teste rápido: /api/webhook?ping=1&to=5561...
  if (url.searchParams.get('ping') === '1') {
    const to = url.searchParams.get('to');
    try {
      const r = await sendText(to, 'PING ✅');
      return new Response(`PING_OK ${r}`, { status: 200 });
    } catch (e) {
      return new Response(`PING_FAIL ${e}`, { status: 500 });
    }
  }
  return new Response('OK', { status: 200 });
}

export async function POST(req) {
  // ACK imediato
  const ack = new Response('', { status: 200 });
  let body;
  try { body = await req.json(); } catch { return ack; }

  try {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const msg = change?.value?.messages?.[0];
    if (!msg) return ack;

    const from = msg.from;             // E164 digits only
    const type = msg.type;

    // Texto simples (abre menu)
    if (type === 'text') {
      const t = (msg.text?.body || '').trim().toLowerCase();
      if (t === 'oi' || t === 'menu' || t === 'start') {
        await sendMainMenu(from);
      } else if (t.includes('atendente')) {
        await sendText(from, 'Anotado! Um atendente vai te responder em breve.');
      } else {
        await sendText(from, 'Digite "menu" para começar ou toque nas opções quando aparecerem.');
      }
      return ack;
    }

    // Clique em LIST (roteia por ID)
    if (type === 'interactive' && msg.interactive?.type === 'list_reply') {
      const id = msg.interactive.list_reply.id;

      // MAIN
      if (id === 'MAIN_MEDICOS')  { await sendMedicosMenu(from); return ack; }
      if (id === 'MAIN_SERVICOS') { await sendServicosMenu(from); return ack; }
      if (id === 'MAIN_TEC')      { await sendTecnologiasMenu(from); return ack; }
      if (id === 'MAIN_LONGE')    { await sendLongevidade(from); await sendList(from,{header:'Opções',body:'Selecione:',button:'Abrir',rows:[{id:'BACK_HOME',title:'Voltar ao menu',description:'reabrir menu'}]}); return ack; }
      if (id === 'MAIN_ESTETICA') { await sendEsteticaMenu1(from); return ack; }
      if (id === 'MAIN_CAPILAR')  { await sendCapilar(from); await sendList(from,{header:'Opções',body:'Selecione:',button:'Abrir',rows:[{id:'BACK_HOME',title:'Voltar ao menu',description:'reabrir menu'}]}); return ack; }
      if (id === 'MAIN_ATENDENTE'){ await sendText(from,'Anotado! Um atendente vai te responder em breve.'); return ack; }

      // MÉDICOS
      if (id === 'MED_JULIANA') { await sendMedicoJuliana(from); await sendList(from,{header:'Opções',body:'Selecione:',button:'Abrir',rows:[{id:'BACK_HOME',title:'Voltar ao menu',description:'reabrir menu'}]}); return ack; }
      if (id === 'MED_JOAO')    { await sendMedicoJoao(from);    await sendList(from,{header:'Opções',body:'Selecione:',button:'Abrir',rows:[{id:'BACK_HOME',title:'Voltar ao menu',description:'reabrir menu'}]}); return ack; }

      // TECNOLOGIAS (detalhes)
      if (id.startsWith('TEC_')) { await sendTecDetalhe(from, id); await sendTecnologiasMenu(from); return ack; }

      // ESTÉTICA menus e detalhes
      if (id === 'EST_NEXT2') { await sendEsteticaMenu2(from); return ack; }
      if (id === 'EST_BACK1') { await sendEsteticaMenu1(from); return ack; }
      if (id.startsWith('EST_')) { await sendEsteticaDetalhe(from, id); await sendList(from,{header:'Estética',body:'Mais ações:',button:'Abrir',rows:[{id:'EST_NEXT2',title:'Ver mais (2/2)',description:'continuar'},{id:'BACK_HOME',title:'Voltar ao menu',description:'reabrir menu'}]}); return ack; }

      // BACK
      if (id === 'BACK_HOME') { await sendMainMenu(from); return ack; }

      // fallback
      await sendMainMenu(from);
      return ack;
    }

    // Outros tipos → instrução
    await sendText(from, 'Recebi sua mensagem. Digite "menu" para começar.');
    return ack;

  } catch (e) {
    console.error('Webhook error:', e);
    return ack; // sempre 200 pro Meta não re-tentar em loop
  }
}
