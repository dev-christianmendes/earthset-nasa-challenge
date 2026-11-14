// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Textos da interface em inglês (padrão, para o vídeo e os jurados) e em português do Brasil.
// Chaves iguais nos dois idiomas (tests/i18n.test.ts). Motivos de recusa vêm do motor como códigos (reason.*).

export type Lang = 'en' | 'pt';

const DICT: Record<string, Record<Lang, string>> = {
  'page.title': { en: 'Earthset · South-pole Moon base', pt: 'Earthset · Base no polo sul da Lua' },
  'hud.title': { en: 'South-pole Moon base', pt: 'Base no polo sul da Lua' },
  'hud.hour': { en: 'Game hour', pt: 'Hora de jogo' },
  'hud.of': { en: 'of 708', pt: 'de 708' },
  'hud.hearts': { en: 'hearts', pt: 'corações' },
  'hud.battery': { en: 'Battery', pt: 'Bateria' },
  'hud.air': { en: 'Air', pt: 'Ar' },
  'hud.water': { en: 'Water', pt: 'Água' },
  'hud.food': { en: 'Food', pt: 'Comida' },
  'hud.panels': { en: 'Solar panels', pt: 'Painéis' },
  'hud.queue': { en: 'Robot · queue', pt: 'Robô · fila' },
  'hud.idle': { en: 'Robot idle', pt: 'Robô ocioso' },
  'hud.ask': { en: 'Ask the robot', pt: 'Pedir ao robô' },
  'hud.greenhouse': { en: 'Greenhouse', pt: 'Estufa' },
  'hud.greenhouse.aria': { en: 'Greenhouse mode', pt: 'Modo da estufa' },
  'hud.cancel': { en: 'Cancel {task}', pt: 'Cancelar {task}' },
  'hud.queueItem': { en: '{n}. {task} · {hours} h', pt: '{n}. {task} · {hours} h' },
  'hud.reset': { en: 'Base view', pt: 'Visão da base' },
  'pause.button': { en: 'Pause', pt: 'Pausar' },
  'pause.title': { en: 'Paused', pt: 'Pausado' },
  'pause.resume': { en: 'Resume', pt: 'Continuar' },
  'pause.controls': { en: 'Controls', pt: 'Controles' },
  'pause.menu': { en: 'Main menu', pt: 'Menu principal' },
  'pause.controls.text': {
    en: 'Drag to rotate the view. Mouse wheel or pinch to zoom. "Base view" returns to the base. Esc pauses and resumes.',
    pt: 'Arraste para girar a visão. Roda do mouse ou pinça para aproximar. "Visão da base" volta à base. Esc pausa e retoma.',
  },
  'luma.name': { en: 'LUMA', pt: 'LUMA' },
  'luma.title': { en: 'LUMA · your base guide', pt: 'LUMA · guia da base' },
  'luma.radiation': { en: 'Radiation is hitting the surface. The robot is paused. Keep the crew inside.', pt: 'Radiação atingindo a superfície. O robô está parado. Mantenha a tripulação dentro.' },
  'luma.lastHeart': { en: 'Only one heart left. Stabilise the lowest resource now.', pt: 'Resta só um coração. Estabilize o recurso mais baixo agora.' },
  'luma.storm': { en: 'A geomagnetic storm starts in {hours} h. Solar panels will lose output. Consider sheltering the crew.', pt: 'Uma tempestade geomagnética começa em {hours} h. Os painéis vão perder energia. Considere abrigar a tripulação.' },
  'luma.low.battery': { en: 'Battery is low. Turn the greenhouse to "off" or wait for sunlight.', pt: 'A bateria está baixa. Desligue a estufa ou espere o Sol.' },
  'luma.low.air': { en: 'Air is running out. Electrolysis needs water and battery.', pt: 'O ar está acabando. A eletrólise precisa de água e de bateria.' },
  'luma.low.water': { en: 'Water is low. Send the rover for ice.', pt: 'A água está baixa. Mande o robô buscar gelo.' },
  'luma.low.food': { en: 'Food is low. The greenhouse needs energy and water to grow food.', pt: 'A comida está baixa. A estufa precisa de energia e de água para produzir.' },
  'luma.next.panels': { en: 'Next goal: install 4 solar panels. Ask the robot for a panel.', pt: 'Próximo objetivo: instalar 4 painéis solares. Peça um painel ao robô.' },
  'luma.next.ice': { en: 'Next goal: keep water at 70 or more. Ask the robot for ice.', pt: 'Próximo objetivo: manter a água em 70 ou mais. Peça gelo ao robô.' },
  'luma.next.antenna': { en: 'Next goal: install the antenna. It warns you about storms six hours ahead.', pt: 'Próximo objetivo: instalar a antena. Ela avisa tempestades com seis horas de antecedência.' },
  'luma.next.survive': { en: 'Next goal: reach hour 100 with at least one heart.', pt: 'Próximo objetivo: chegar à hora 100 com pelo menos um coração.' },
  'luma.greenhouseOn': { en: 'The greenhouse is running and the crew is harvesting food. Keep it going.', pt: 'A estufa está funcionando e a tripulação colhe comida. Mantenha assim.' },
  'luma.calm': { en: 'All systems are stable. Keep watching the storm warnings.', pt: 'Todos os sistemas estáveis. Fique de olho nos avisos de tempestade.' },
  'objective.title': { en: 'Mission goals', pt: 'Objetivos da missão' },
  'objective.panels': { en: 'Install 4 solar panels', pt: 'Instalar 4 painéis solares' },
  'objective.ice': { en: 'Keep water at 70 or more', pt: 'Manter a água em 70 ou mais' },
  'objective.antenna': { en: 'Install the antenna', pt: 'Instalar a antena' },
  'objective.survive': { en: 'Reach hour 100 alive', pt: 'Chegar à hora 100 vivo' },
  'brief.title': { en: 'Your mission', pt: 'Sua missão' },
  'brief.body': { en: 'You run a small base at the Moon\'s south pole for one lunar day (708 hours). Keep power, air, water and food up, and keep your crew alive. LUMA, your guide, will point out what matters next.', pt: 'Você administra uma pequena base no polo sul da Lua por um dia lunar (708 horas). Mantenha energia, ar, água e comida, e mantenha a tripulação viva. A LUMA, sua guia, mostra o que importa a seguir.' },
  'brief.controls': { en: 'Ask the robot for ice, panels and the antenna. Set the crew to shelter when a storm comes. Esc pauses.', pt: 'Peça ao robô gelo, painéis e a antena. Mande a tripulação abrigar quando vier tempestade. Esc pausa.' },
  'brief.start': { en: 'Start mission', pt: 'Começar missão' },
  'hud.crew': { en: 'Crew', pt: 'Tripulação' },
  'hud.crew.auto': { en: 'Auto', pt: 'Automática' },
  'hud.crew.shelter': { en: 'Shelter', pt: 'Abrigar' },
  'title.tagline': { en: 'A small base. A hostile world. One lunar day.', pt: 'Uma base pequena. Um mundo hostil. Um dia lunar.' },
  'title.start': { en: 'New mission', pt: 'Nova missão' },
  'title.credits': { en: 'Credits', pt: 'Créditos' },
  'title.back': { en: 'Back', pt: 'Voltar' },
  'title.credits.text': {
    en: 'Sun ephemeris: NASA/JPL Horizons. Terrain: LRO LOLA (NASA), LDEM 80S 20 m. Space weather: NASA DONKI, historical scenario of 9 Oct 2024; not a forecast. Software: three.js (MIT), Vite, Vitest, Blender (GPL). 3D models are generated by this project’s own script; no third-party models. Earthset is not affiliated with or endorsed by NASA.',
    pt: 'Efemérides do Sol: NASA/JPL Horizons. Relevo: LRO LOLA (NASA), LDEM 80S 20 m. Clima espacial: NASA DONKI, cenário histórico de 9/10/2024; não é previsão. Software: three.js (MIT), Vite, Vitest, Blender (GPL). Os modelos 3D são gerados pelo script deste projeto; nenhum modelo de terceiros. Earthset não é afiliado nem endossado pela NASA.',
  },
  'hud.school': { en: 'School mode', pt: 'Modo escola' },
  'hud.lang': { en: 'Português', pt: 'English' },
  'task.ice': { en: 'Ice', pt: 'Gelo' },
  'task.panel': { en: 'Panel', pt: 'Painel' },
  'task.antenna': { en: 'Antenna', pt: 'Antena' },
  'task.ice.title': { en: 'Brings 12 water', pt: 'Traz 12 de água' },
  'task.panel.title': { en: 'Installs 1 solar panel', pt: 'Instala 1 painel solar' },
  'task.antenna.title': { en: 'Installs the communication antenna', pt: 'Instala a antena de comunicação' },
  'greenhouse.off': { en: 'Off', pt: 'Desligada' },
  'greenhouse.always': { en: 'Always on', pt: 'Sempre ligada' },
  'greenhouse.surplus': { en: 'Only with surplus', pt: 'Só com sobra' },
  'overlay.title': { en: 'Game over', pt: 'Fim da partida' },
  'overlay.lost.title': { en: 'The base was lost', pt: 'A base foi perdida' },
  'overlay.lost.text': {
    en: 'Hearts ran out at hour {hour}. Without power, air, water or food for too long.',
    pt: 'Os corações acabaram na hora {hour}. Sem energia, ar, água ou comida por tempo demais.',
  },
  'overlay.won.title': { en: 'One lunar day survived', pt: 'Um dia lunar sobrevivido' },
  'overlay.won.text': {
    en: 'The base reached hour {hours} with {hearts} of 3 hearts.',
    pt: 'A base chegou às {hours} horas com {hearts} de 3 corações.',
  },
  'overlay.restart': { en: 'Play again', pt: 'Jogar de novo' },
  'space.calm': { en: 'calm space weather', pt: 'clima calmo' },
  'space.storm': { en: 'G{level} storm, panels at {percent}%', pt: 'tempestade G{level}, painéis a {percent}%' },
  'space.warning': { en: 'storm in {hours} h (antenna warning)', pt: 'tempestade em {hours} h (aviso da antena)' },
  'space.radiation': { en: '{storm} · radiation: robot paused', pt: '{storm} · radiação: robô parado' },
  'horizon.title': { en: 'Real horizon', pt: 'Horizonte real' },
  'horizon.aria': { en: 'Measured horizon at the peak', pt: 'Horizonte medido no morro' },
  'horizon.svg': { en: "Measured horizon at the peak and the Sun's path", pt: 'Horizonte medido no morro e trajetória do Sol' },
  'horizon.caption': {
    en: 'Sun at the peak: {lit} of {total} h above the measured horizon. Horizon: LRO LOLA. Sun: JPL Horizons.',
    pt: 'Sol no morro: {lit} de {total} h acima do horizonte medido. Horizonte: LRO LOLA. Sol: JPL Horizons.',
  },
  'note': {
    en: 'Sun and terrain: real data (NASA/JPL Horizons, LRO LOLA). Space weather: 9 Oct 2024 scenario (NASA DONKI). Terrain vertical exaggeration 2×. Robot and greenhouse are illustrative.',
    pt: 'Sol e relevo: dados reais (NASA/JPL Horizons e LRO LOLA). Clima: cenário de 09/10/2024 (NASA DONKI). Relevo com exagero vertical de 2×. Robô e estufa são ilustrativos.',
  },
  'reason.match-over': { en: 'The match is over.', pt: 'A partida já terminou.' },
  'reason.invalid-mode': { en: 'Invalid greenhouse mode.', pt: 'Modo da estufa inválido.' },
  'reason.unknown-task': { en: 'Unknown task.', pt: 'Tarefa desconhecida.' },
  'reason.no-task-at-index': { en: 'There is no task in that position.', pt: 'Não há tarefa nessa posição.' },
  'reason.unknown-action': { en: 'Unknown action.', pt: 'Ação desconhecida.' },
  'reason.queue-full': { en: 'Queue full (max {max} tasks).', pt: 'Fila cheia (máximo de {max} tarefas).' },
  'reason.panel-limit': { en: 'Panel limit of {max} reached.', pt: 'Limite de {max} painéis atingido.' },
  'reason.antenna-exists': {
    en: 'The antenna is already installed or queued.',
    pt: 'A antena já está instalada ou na fila.',
  },
};

/** Só para os testes: o dicionário completo. */
export const DICT_FOR_TESTS = DICT;

const STORAGE_KEY = 'earthset-lang';
let current: Lang = 'en';

/** Idioma atual. Padrão: inglês (ver docs/arquitetura.md, R-LANG). */
export function getLang(): Lang {
  return current;
}

/** Troca o idioma e guarda a escolha, se o navegador deixar (pode falhar em janela privada). */
export function setLang(lang: Lang): void {
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // sem armazenamento: a escolha vale só nesta página
  }
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
}

/** Lê a escolha guardada; sem escolha, usa inglês. */
export function loadLang(): Lang {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(STORAGE_KEY);
  } catch {
    saved = null;
  }
  setLang(saved === 'pt' ? 'pt' : 'en');
  return current;
}

/** Texto da chave no idioma atual, com {variáveis} substituídas. Chave ausente devolve a própria chave. */
export function t(key: string, vars: Record<string, string | number> = {}): string {
  const entry = DICT[key];
  if (!entry) return key;
  let text = entry[current];
  for (const [name, value] of Object.entries(vars)) {
    text = text.split(`{${name}}`).join(String(value));
  }
  return text;
}

/** Aplica os textos a elementos marcados com data-i18n (texto), data-i18n-title e data-i18n-aria. */
export function applyStatic(root: ParentNode = document): void {
  for (const node of root.querySelectorAll<HTMLElement>('[data-i18n]')) {
    node.textContent = t(node.dataset.i18n ?? '');
  }
  for (const node of root.querySelectorAll<HTMLElement>('[data-i18n-title]')) {
    node.title = t(node.dataset.i18nTitle ?? '');
  }
  for (const node of root.querySelectorAll<HTMLElement>('[data-i18n-aria]')) {
    node.setAttribute('aria-label', t(node.dataset.i18nAria ?? ''));
  }
  document.title = t('page.title');
}
