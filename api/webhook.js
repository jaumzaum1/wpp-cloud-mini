// api/webhook.js — WhatsApp Cloud API (menu completo com regras solicitadas)
export const config = { runtime: 'edge' };

/** ===================== CONFIG & HELPERS ===================== **/
const GRAPH = (pid) => `https://graph.facebook.com/v20.0/${pid}/messages`;
const HEADERS = () => ({
  'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
  'Content-Type': 'application/json'
});
const PHONE_ID = process.env.PHONE_NUMBER_ID;

// estado leve por contato (best-effort em Edge; ideal depois: KV/DB)
const SESSION = new Map(); // key: from (string) -> {suppressUntil:number, attendant:boolean, err:number}

/** utils de sessão **/
const now = () => Date.now();
const dayMs = 24 * 60 * 60 * 1000;
function getState(from) {
  const s = SESSION.get(from) || { suppressUntil: 0, attendant: false, err: 0 };
  return s;
}
function setState(from, patch) {
  const s = { ...getState(from), ...patch };
  SESSION.set(from, s);
  return s;
}
function clearSuppression(from) {
  return setState(from, { suppressUntil: 0, attendant: false, err: 0 });
}
function isSuppressed(from) {
  const s = getState(from);
  return s.attendant || now() < s.suppressUntil;
}

/** HTTP helpers **/
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
  return postJSON(GRAPH(PHONE_ID), {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body }
  });
}

function clampFooter(s) { return (s || '').slice(0, 60); }

async function sendList(to, { header, body, footer, button, rows }) {
  // rows: [{id,title,description}], máx 10 por mensagem
  return postJSON(GRAPH(PHONE_ID), {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      header: { type: 'text', text: header },
      body:   { text: body },
      footer: { text: clampFooter(footer || 'Escolha uma opção.') },
      action: {
        button,
        sections: [{ title: 'Menu', rows }]
      }
    }
  });
}

/** linhas padrão (para quase todos os menus) **/
function stdActionRows() {
  return [
    { id: 'AGENDAR_OPEN',   title: 'Agendar consulta', description: 'Escolher médico' },
    { id: 'MAIN_ATENDENTE', title: 'Atendente',        description: 'Falar com atendente' },
    { id: 'BACK_HOME',      title: 'Voltar ao menu',   description: '' }
  ];
}

async function sendActionsMini(to) {
  // mini menu de ações (quando não cabe no menu principal, ex.: Tecnologias)
  return sendList(to, {
    header: 'Ações',
    body: 'Selecione:',
    footer: 'Dica: digite "menu" a qualquer momento.',
    button: 'Abrir',
    rows: stdActionRows()
  });
}

/** ===================== MENUS ===================== **/
// Menu principal
async function sendMainMenu(to) {
  return sendList(to, {
    header: 'Clínica Juliana Hortense',
    body: 'Selecione uma opção:',
    footer: 'Toque em Abrir.',
    button: 'Abrir',
    rows: [
      { id: 'MAIN_MEDICOS',    title: 'Médicos',               description: 'Conheça quem atende' },
      { id: 'MAIN_SERVICOS',   title: 'Serviços',              description: 'O que atendemos' },
      { id: 'MAIN_TEC',        title: 'Tecnologias',           description: 'Dra. Juliana Hortense' },
      { id: 'MAIN_LONGE',      title: 'Longevidade & Emag.',   description: 'Dr. João Maldonado' },
      { id: 'MAIN_ESTETICA',   title: 'Estética',              description: 'Facial e corporal' },
      { id: 'MAIN_CAPILAR',    title: 'Trat. capilar',         description: 'Dr. João Maldonado' },
      { id: 'AGENDAR_OPEN',    title: 'Agendar consulta',      description: 'Escolher médico' },
      { id: 'MAIN_ATENDENTE',  title: 'Atendente',             description: 'Falar com atendente' }
    ]
  });
}

// Médicos
async function sendMedicosMenu(to) {
  return sendList(to, {
    header: 'Nossos médicos',
    body: 'Escolha:',
    footer: 'Você pode agendar depois.',
    button: 'Abrir',
    rows: [
      { id: 'MED_JULIANA', title: 'Dra. Juliana', description: 'Dermatologia Estética' },
      { id: 'MED_JOAO',    title: 'Dr. João',     description: 'Longevidade & Estética' },
      ...stdActionRows()
    ]
  });
}

// Após escolher médico: bio + ações (conhecer serviços, agendar, atendente, voltar)
async function postBioActions(to) {
  return sendList(to, {
    header: 'O que deseja fazer?',
    body: 'Selecione:',
    footer: 'Dica: menu a qualquer momento digitando "menu".',
    button: 'Abrir',
    rows: [
      { id: 'MAIN_SERVICOS',   title: 'Conhecer serviços', description: 'Ver tratamentos' },
      ...stdActionRows()
    ]
  });
}

// Bios
async function sendMedicoJuliana(to) {
  await sendText(to,
`*Dra. Juliana Hortense*
Dermatologista com mais de 20 anos de experiência. Formada pela Universidade Estadual de Londrina (UEL), com residência médica pela Faculdade de Medicina de Botucatu (UNESP). Membro da Sociedade Brasileira e Europeia de Dermatologia. Especialista no que há de mais novo em tecnologias médicas na área de Dermatologia Estética facial e corporal. Atua também com injetáveis (toxina botulínica, preenchedores faciais e bioestimuladores).`);
  return postBioActions(to);
}
async function sendMedicoJoao(to) {
  await sendText(to,
`*Dr. João Maldonado*
Médico e Engenheiro, formado pela Universidade Federal de Brasília (UnB) e pelo Instituto Tecnológico de Aeronáutica (ITA), pós-graduado em Medicina Estética Avançada e em Farmacologia Clínica, especializado em Medicina da Longevidade e do Emagrecimento, e com MBA em Healthtech. Atua com análogos de GLP-1 (Mounjaro®), terapia de reposição hormonal/implantes hormonais, infusão endovenosa suplementar (soroterapia), tratamento de queda capilar, e uma ampla gama de procedimentos estéticos faciais e corporais.`);
  await sendText(to,
`*Como funciona minha consulta (Longevidade & Emagrecimento)*
Minha consulta é integrativa em Estética, Longevidade e Emagrecimento. Começamos com anamnese, exame físico e registro por fotos/medidas; exames laboratoriais são obrigatórios e, quando indicado, pedimos imagem. A partir disso, montamos um plano em fases com metas realistas e acompanhamento próximo (revisões e ajustes). Trabalho com análogos de GLP-1 (Mounjaro®), reposição hormonal (incluindo implantes hormonais), infusão endovenosa suplementar (soroterapia) de vitaminas, minerais, eletrólitos e antioxidantes quando há déficit ou sintomas, tratamento para queda capilar, além de procedimentos estéticos faciais e corporais — sempre com prescrição após avaliação médica individual.`);
  return postBioActions(to);
}

// Serviços (resumo + menu)
async function sendServicosResumo(to) {
  return sendText(to,
`*Dra. Juliana Hortense*
• Tecnologias: conjunto de plataformas a laser, ultrassom microfocado e radiofrequência para tratar textura, poros, viço, manchas, flacidez leve, contorno e qualidade de pele, com alta precisão e protocolos personalizados. Tecnologias disponíveis: Fotona®, Ulthera®, Volnewmer®, Luz Pulsada, Laser Q-switched, CoolSculpting, Emsculpt®, Emface®, e Emsella®. Ver mais detalhes em “Tecnologias (Dra. Juliana)”.
• Injetáveis: toxina botulínica, ácido hialurônico e bioestimulador.

*Dr. João Maldonado*
• Longevidade/Emagrecimento: abordagem médica integrativa com avaliação clínica completa utilizando análogos de GLP-1 (ex: Mounjaro®) para emagrecimento, reposição/implantes hormonais para ganho de massa muscular e infusão endovenosa suplementar (soroterapia), oral ou intramuscular para reposição guiada de vitaminas, antioxidantes, eletrólitos e minerais essenciais. Ver mais detalhes em “Longevidade/Emagrecimento (Dr. João)”.
• Estética facial e corporal: ampla gama de procedimentos injetáveis, como toxina botulínica, preenchedores, bioestimuladores, skinbooster, fios, peelings, enzimas, PDRN, exossomos capilar, PRP, polinucleotídeos, Profhilo e microagulhamento. Ver mais detalhes em “Estética Facial e Corporal”.
• Tratamento capilar (queda/afinamento): voltado a alopecia (androgenética, eflúvios, pós-parto, cicatriciais, areata e outras). O foco é tratar a causa e o efeito: interromper a queda, melhorar densidade/espessura e manter os resultados. O plano pode combinar minoxidil (tópico/oral), finasterida/dutasterida (inibidores da 5α-redutase, tópico/oral), microagulhamento, exossomos, PRP e PDRN, além de ajustes metabólicos/hormonais quando indicados. Ver mais detalhes em “Tratamento capilar (Dr. João)”.`);
}
async function sendServicosMenu(to) {
  await sendServicosResumo(to);
  return sendList(to, {
    header: 'Serviços',
    body: 'Selecione:',
    footer: 'Opções adicionais abaixo.',
    button: 'Abrir',
    rows: [
      { id: 'MAIN_TEC',      title: 'Tecnologias',           description: 'Dra. Juliana Hortense' },
      { id: 'MAIN_LONGE',    title: 'Longevidade & Emag.',   description: 'Dr. João Maldonado' },
      { id: 'MAIN_ESTETICA', title: 'Estética',              description: 'Facial e corporal' },
      { id: 'MAIN_CAPILAR',  title: 'Trat. capilar',         description: 'Queda/afinamento' },
      ...stdActionRows()
    ]
  });
}

// Tecnologias (9 + voltar) → e logo depois manda mini "Ações"
async function sendTecnologiasMenu(to) {
  const r = await sendList(to, {
    header: 'Tecnologias',
    body: 'Escolha uma tecnologia (Dra. Juliana Hortense):',
    footer: 'Protocolos personalizados.',
    button: 'Abrir',
    rows: [
      { id: 'TEC_FOTONA',     title: 'Fotona®',           description: 'Laser Nd:YAG/Er:YAG' },
      { id: 'TEC_ULTHERA',    title: 'Ulthera®',          description: 'Ultrassom microfocado' },
      { id: 'TEC_VOLNEWMER',  title: 'Volnewmer®',        description: 'Radiofrequência' },
      { id: 'TEC_IPL',        title: 'Luz Pulsada',       description: 'IPL' },
      { id: 'TEC_QSW',        title: 'Laser Q-switched',  description: 'Pigmentos/manchas' },
      { id: 'TEC_COOLSCULPT', title: 'CoolSculpting',     description: 'Gordura localizada' },
      { id: 'TEC_EMSCULPT',   title: 'Emsculpt®',         description: 'HIFEM muscular' },
      { id: 'TEC_EMFACE',     title: 'Emface®',           description: 'HIFES + RF facial' },
      { id: 'TEC_EMSELLA',    title: 'Emsella®',          description: 'Assoalho pélvico' },
      { id: 'BACK_HOME',      title: 'Voltar ao menu',    description: '' }
    ]
  });
  await sendActionsMini(to); // garante Agendar/Atendente/Voltar disponíveis
  return r;
}

// Estética (10 itens, sem agendar/atendente)
async function sendEsteticaMenu(to) {
  return sendList(to, {
    header: 'Estética',
    body: 'Selecione um procedimento:',
    footer: 'Explicações ao tocar.',
    button: 'Abrir',
    rows: [
      { id: 'EST_BOTOX',   title: 'Toxina Botulínica',       description: '' },
      { id: 'EST_AH',      title: 'Ácido hialurônico',       description: '' },
      { id: 'EST_BIO',     title: 'Bioestimuladores',        description: '' },
      { id: 'EST_FIOS',    title: 'Fios de sustentação',     description: '' },
      { id: 'EST_SKINB',   title: 'Skinboosters',            description: '' },
      { id: 'EST_PEEL',    title: 'Peelings',                description: '' },
      { id: 'EST_EMPT',    title: 'Enzimas (emptiers)',      description: '' },
      { id: 'EST_INJCAP',  title: 'Injetáveis capilares',    description: 'Exossomos, PDRN, PRP, microagulhamento' },
      { id: 'EST_PROF',    title: 'Profhilo',                description: '' },
      { id: 'BACK_HOME',   title: 'Voltar ao menu',          description: '' }
    ]
  });
}

// Longevidade & Emagrecimento (itens + ações)
async function sendLongevidadeMenu(to) {
  return sendList(to, {
    header: 'Longevidade & Emag.',
    body: 'Selecione um tema (Dr. João Maldonado):',
    footer: 'Avaliação clínica individual.',
    button: 'Abrir',
    rows: [
      { id: 'LONGE_GLP1', title: 'Análogos de GLP-1',      description: '' },
      { id: 'LONGE_TRH',  title: 'Reposição hormonal',     description: 'Inclui implantes' },
      { id: 'LONGE_SORO', title: 'Soroterapia (IV)',       description: '' },
      ...stdActionRows()
    ]
  });
}

// Capilar (itens + ações)
async function sendCapilarMenu(to) {
  return sendList(to, {
    header: 'Tratamento capilar',
    body: 'Selecione um tema:',
    footer: 'Protocolos combinados por indicação.',
    button: 'Abrir',
    rows: [
      { id: 'CAP_EXOS',   title: 'Exossomos',                             description: '' },
      { id: 'CAP_PDRN',   title: 'PDRN',                                  description: '' },
      { id: 'CAP_PRP',    title: 'PRP',                                   description: '' },
      { id: 'CAP_MICRO',  title: 'Microagulhamento',                      description: '' },
      { id: 'CAP_MINOX',  title: 'Minoxidil',                             description: 'tópico/oral' },
      { id: 'CAP_5AR',    title: 'Inib. 5α-redutase',                     description: '(finasterida/dutasterida)' },
      ...stdActionRows()
    ]
  });
}

// Agendar consulta → escolher médico
async function sendAgendarMenu(to) {
  return sendList(to, {
    header: 'Agendar consulta',
    body: 'Com qual médico?',
    footer: 'Depois te encaminho ao atendimento.',
    button: 'Abrir',
    rows: [
      { id: 'AGENDAR_JULIANA', title: 'Dra. Juliana', description: '' },
      { id: 'AGENDAR_JOAO',    title: 'Dr. João',     description: '' },
      { id: 'BACK_HOME',       title: 'Voltar ao menu', description: '' }
    ]
  });
}

/** ===================== TEXTOS DE DETALHE ===================== **/
// Tecnologias detalhadas (textos enviados já foram alinhados antes)
async function sendTecDetalhe(to, id) {
  const tx = {
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
Pulsos ultracurtos de alta energia voltados a manchas e pigmentos com mínima difusão térmica. Sessões de 10–30 min. Pode gerar hiperpigmentação temporária e pequenas crostas por 3–5 dias. Geralmente 3–8 sessões mensais; clareamento gradual.`,
    TEC_COOLSCULPT:
`*CoolSculpting*
Congela o tecido adiposo para quebrar gordura localizada (abdome, flancos, braços, coxas, culote, papada). Sessões de 35–60 min por área; pode ocorrer edema/dormência por 15–30 dias. Normalmente 1–3 ciclos por área; resultados a partir de 4 semanas, com evolução até 12 semanas.`,
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
  await sendText(to, tx[id]);
}

// Estética — detalhes
async function sendEsteticaDetalhe(to, id) {
  const tx = {
    EST_BOTOX:
`*Toxina botulínica*
Suaviza linhas dinâmicas preservando a expressão natural (testa, glabela, pés-de-galinha e outras). Inclui indicações como *sorriso gengival*, *bruxismo* e *enxaqueca* quando indicado. Procedimento de 15–30 min; início em 3–7 dias, pico em 14 dias. Duração média 3–4 meses (≈3x/ano).`,
    EST_AH:
`*Ácido hialurônico (preenchedores)*
Contorno, projeção e hidratação (malar, lábios, mandíbula, olheiras, mento). Sessão de 30–60 min; downtime leve; duração 9–18 meses (varia por área).`,
    EST_BIO:
`*Bioestimuladores*
Firmeza e qualidade da pele por neocolagênese progressiva. Sessão de 20–40 min; em geral 1–3/ano; melhora em 6–12 semanas.`,
    EST_FIOS:
`*Fios de sustentação*
Vetores de suporte e estímulo de colágeno para flacidez leve. Procedimento ambulatorial; recuperação curta (edema/sensibilidade).`,
    EST_SKINB:
`*Skinboosters*
Hidratação dérmica e viço com AH de baixa reticulação — inclui *lábios*. Sessões de 20–30 min; 1–3 sessões com manutenção semestral.`,
    EST_PEEL:
`*Peelings*
Renovação de textura e tom. *Tipos*: glicólico, salicílico, mandélico, Jessner, TCA e *ATA-cróton*; **não** realizamos fenol. Ciclos mensais; downtime varia conforme profundidade.`,
    EST_EMPT:
`*Enzimas (emptiers)*
Remodelagem de pequenas áreas de gordura localizada (abdômen, flancos, culotes, papada). Sessões em série; edema/ardor local podem ocorrer temporariamente.`,
    EST_INJCAP:
`*Injetáveis capilares*
Protocolos para couro cabeludo visando densidade e qualidade: *Exossomos* (sinalização avançada), *PDRN* (biomodulação/reparo), *PRP autólogo* (fatores de crescimento) e *Microagulhamento* (indução de colágeno e drug delivery). Geralmente combinados, conforme avaliação.`,
    EST_PROF:
`*Profhilo*
Biorremodelador de AH para qualidade global da pele. Esquema clássico: 2 sessões/30 dias. Pontos em *face* e, conforme avaliação, *pescoço/colo/mãos*.`
  };
  await sendText(to, tx[id]);
}

// Longevidade — detalhes
async function sendLongeDetalhe(to, id) {
  const tx = {
    LONGE_GLP1:
`*Análogos de GLP-1 (ex.: Mounjaro®)*
Auxiliam controle de apetite e glicemia quando indicado. Monitorização clínica e laboratorial; resultados dependem de adesão ao plano de hábitos.`,
    LONGE_TRH:
`*Reposição/implantes hormonais*
Para desequilíbrios documentados e sintomas associados. Protocolos personalizados (inclui pellets com ação por 3–6 meses), com acompanhamento e segurança.`,
    LONGE_SORO:
`*Soroterapia (infusão IV)*
Vitaminas, minerais, eletrólitos e antioxidantes conforme exames/sintomas. Sessão de 30–60 min; frequência varia com objetivo.`
  };
  await sendText(to, tx[id]);
}

// Capilar — detalhes
async function sendCapilarDetalhe(to, id) {
  const tx = {
    CAP_EXOS:
`*Exossomos*
Vesículas de sinalização modernas para suporte ao folículo e couro cabeludo; normalmente combinadas a minoxidil/microagulhamento/PRP.`,
    CAP_PDRN:
`*PDRN*
Biomodulador que apoia reparo e qualidade do couro cabeludo; pode integrar protocolos capilares.`,
    CAP_PRP:
`*PRP (plasma rico em plaquetas)*
Autólogo: preparado a partir do seu sangue em centrífuga, concentrando fatores de crescimento. Usado em séries com manutenção.`,
    CAP_MICRO:
`*Microagulhamento*
Indução de colágeno e possível drug delivery no couro cabeludo; geralmente em séries.`,
    CAP_MINOX:
`*Minoxidil*
Tópico/oral conforme avaliação; objetivo: prolongar fase anágena, reduzir queda e melhorar espessura.`,
    CAP_5AR:
`*Inibidores da 5α-redutase (finasterida/dutasterida)*
Podem ser tópicos ou orais, conforme indicação, visando modular o eixo androgênico associado à alopecia androgenética.`
  };
  await sendText(to, tx[id]);
}

/** ===================== AGENDAR & ATENDENTE ===================== **/
async function handleAgendarEscolha(to, qual) {
  // aqui você pode integrar agenda; por ora, ativa "atendente" e pausa menus
  setState(to, { attendant: true, suppressUntil: now() + dayMs });
  await sendText(to,
`Perfeito! Vou encaminhar seu agendamento com *${qual}*. 
Um atendente vai te responder. 
(Para reabrir opções a qualquer momento, digite *menu*.)`);
}
async function enterAtendente(to) {
  setState(to, { attendant: true, suppressUntil: now() + dayMs });
  await sendText(to,
`Certo! Vou deixar você conversar com o atendente.
Para ver o menu novamente depois, digite *menu*.`);
}

/** ===================== WEBHOOKS ===================== **/
export async function GET(req) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  // verificação do webhook
  if (mode === 'subscribe' && token === process.env.VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }

  // ping opcional: /api/webhook?ping=1&to=5561...
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
  const ack = new Response('', { status: 200 });
  let body;
  try { body = await req.json(); } catch { return ack; }

  try {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const msg = change?.value?.messages?.[0];
    if (!msg) return ack;

    const from = msg.from;        // E164 digits-only
    const type = msg.type;

    // INTERACTIVE (List Reply)
    if (type === 'interactive' && msg.interactive?.type === 'list_reply') {
      const id = msg.interactive.list_reply.id;

      // principais
      if (id === 'MAIN_MEDICOS')  { await sendMedicosMenu(from); return ack; }
      if (id === 'MAIN_SERVICOS') { await sendServicosMenu(from); return ack; }
      if (id === 'MAIN_TEC')      { await sendTecnologiasMenu(from); return ack; }
      if (id === 'MAIN_LONGE')    { await sendLongevidadeMenu(from); return ack; }
      if (id === 'MAIN_ESTETICA') { await sendEsteticaMenu(from); return ack; }
      if (id === 'MAIN_CAPILAR')  { await sendCapilarMenu(from); return ack; }
      if (id === 'AGENDAR_OPEN')  { await sendAgendarMenu(from); return ack; }
      if (id === 'MAIN_ATENDENTE'){ await enterAtendente(from);  return ack; }
      if (id === 'BACK_HOME')     { await clearSuppression(from); await sendMainMenu(from); return ack; }

      // médicos → bios + ações
      if (id === 'MED_JULIANA') { await sendMedicoJuliana(from); return ack; }
      if (id === 'MED_JOAO')    { await sendMedicoJoao(from);    return ack; }

      // tecnologias detalhes
      if (id.startsWith('TEC_')) { await sendTecDetalhe(from, id); await sendTecnologiasMenu(from); return ack; }

      // estética detalhes
      if (id.startsWith('EST_')) { await sendEsteticaDetalhe(from, id); await sendList(from, { header: 'Ações', body: 'Selecione:', footer: 'Ou volte ao menu.', button: 'Abrir', rows: [{ id: 'BACK_HOME', title: 'Voltar ao menu', description: '' }] }); return ack; }

      // longevidade detalhes
      if (id.startsWith('LONGE_')) { await sendLongeDetalhe(from, id); await sendLongevidadeMenu(from); return ack; }

      // capilar detalhes
      if (id.startsWith('CAP_')) { await sendCapilarDetalhe(from, id); await sendCapilarMenu(from); return ack; }

      // agendar → escolha
      if (id === 'AGENDAR_JULIANA') { await handleAgendarEscolha(from, 'Dra. Juliana'); return ack; }
      if (id === 'AGENDAR_JOAO')    { await handleAgendarEscolha(from, 'Dr. João');     return ack; }

      // fallback
      await sendMainMenu(from);
      return ack;
    }

    // TEXTO
    if (type === 'text') {
      const raw = (msg.text?.body || '').trim();
      const t = raw.toLowerCase();

      // comandos
      if (t === 'menu') { clearSuppression(from); await sendMainMenu(from); return ack; }
      if (t === 'sair') {
        setState(from, { suppressUntil: now() + dayMs, attendant: false });
        await sendText(from, 'Certo! Vou pausar os menus por 24h. Quando quiser retomar, digite *menu*.');
        return ack;
      }
      if (t.includes('atendente')) { await enterAtendente(from); return ack; }

      // se está suprimido (atendente ou sair/erros), não reabrir sozinho
      if (isSuppressed(from)) {
        await sendText(from, 'Ok! Estou silencioso. Quando quiser ver opções novamente, digite *menu*.');
        return ack;
      }

      // inicia/abre menu com "oi", "olá", etc.
      if (['oi','ola','olá','bom dia','boa tarde','boa noite','start','hi','hello'].includes(t)) {
        await sendMainMenu(from);
        return ack;
      }

      // não entendi → contar erro; com 3, silencia por 24h
      const s = getState(from);
      const n = (s.err || 0) + 1;
      if (n >= 3) {
        setState(from, { err: 0, suppressUntil: now() + dayMs });
        await sendText(from, 'Não entendi. Vou pausar os menus por 24h. Digite *menu* para reabrir quando quiser.');
      } else {
        setState(from, { err: n });
        await sendText(from, 'Não entendi. Digite *menu* para abrir opções ou *sair* para pausar.');
      }
      return ack;
    }

    // outros tipos
    if (!isSuppressed(from)) {
      await sendText(from, 'Recebi sua mensagem. Digite *menu* para ver as opções.');
    }
    return ack;

  } catch (e) {
    console.error('Webhook error:', e);
    return ack; // sempre 200
  }
}
