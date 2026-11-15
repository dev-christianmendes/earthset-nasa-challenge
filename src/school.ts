// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Textos do modo escola (B3.4): rótulos curtos e explicações de cada recurso, em inglês e português.
// Sem DOM e sem regra de jogo; a tela (src/ui/hud.ts) aplica estes textos.
import type { Lang } from './i18n';

/** Rótulo curto para o modo escola, pelo identificador (`data-label` em index.html). */
export const SCHOOL_LABELS: Record<string, Record<Lang, string>> = {
  battery: { en: 'Energy', pt: 'Energia' },
  air: { en: 'Air', pt: 'Ar' },
  water: { en: 'Water', pt: 'Água' },
  food: { en: 'Food', pt: 'Comida' },
  panels: { en: 'Solar panels', pt: 'Painéis solares' },
  robot: { en: 'Robot tasks', pt: 'Tarefas do robô' },
  greenhouse: { en: 'Greenhouse', pt: 'Estufa' },
  ice: { en: 'Ice (water)', pt: 'Gelo (água)' },
  panel: { en: 'Solar panel', pt: 'Painel solar' },
  antenna: { en: 'Antenna', pt: 'Antena' },
};

export interface Explanation {
  /** O que é, em uma frase. */
  what: string;
  /** Por que o valor sobe ou cai. */
  why: string;
  /** De onde vem o dado. Dado real é Sol, relevo e clima; o resto é regra do jogo. */
  source: string;
}

/** Títulos das três linhas de explicação. */
export const HINT_TITLES: Record<Lang, { what: string; why: string; source: string }> = {
  en: { what: 'What it is: ', why: 'Why it changes: ', source: 'Source: ' },
  pt: { what: 'O que é: ', why: 'Por que muda: ', source: 'Fonte: ' },
};

/** Explicações ao lado de cada recurso (`data-hint` em index.html). */
export const EXPLANATIONS: Record<string, Record<Lang, Explanation>> = {
  battery: {
    pt: {
      what: 'Guarda a energia dos painéis solares.',
      why: 'Cai com o gasto da base, da estufa, da eletrólise e do robô. Sem bateria, a base esfria.',
      source: 'Sol real (NASA/JPL Horizons). O resto é regra do jogo.',
    },
    en: {
      what: 'Stores the energy from the solar panels.',
      why: 'Drops with the base, greenhouse, electrolysis and robot. With no battery, the base gets cold.',
      source: 'Real Sun (NASA/JPL Horizons). The rest is a game rule.',
    },
  },
  air: {
    pt: {
      what: 'O ar que a tripulação respira.',
      why: 'Cai com o tempo. A eletrólise separa a água e devolve ar.',
      source: 'Regra do jogo, ilustrativa.',
    },
    en: {
      what: 'The air the crew breathes.',
      why: 'Drops over time. Electrolysis splits water and gives air back.',
      source: 'Game rule, illustrative.',
    },
  },
  water: {
    pt: {
      what: 'Água para beber e para a eletrólise.',
      why: 'Cai devagar. O robô traz gelo de crateras para repor.',
      source: 'Regra do jogo. O gelo de crateras é ilustrativo.',
    },
    en: {
      what: 'Water to drink and for electrolysis.',
      why: 'Drops slowly. The robot brings ice from craters to refill it.',
      source: 'Game rule. The crater ice is illustrative.',
    },
  },
  food: {
    pt: {
      what: 'O que a tripulação come. Vem da estufa.',
      why: 'Cai com o tempo. A estufa só produz com energia e água.',
      source: 'Regra do jogo, ilustrativa.',
    },
    en: {
      what: 'What the crew eats. It comes from the greenhouse.',
      why: 'Drops over time. The greenhouse only produces with energy and water.',
      source: 'Game rule, illustrative.',
    },
  },
  panels: {
    pt: {
      what: 'Cada painel gera energia quando o Sol está no céu.',
      why: 'O robô instala um painel por vez, até 12.',
      source: 'Regra do jogo. O Sol que os painéis usam é real.',
    },
    en: {
      what: 'Each panel makes energy while the Sun is up.',
      why: 'The robot installs one panel at a time, up to 12.',
      source: 'Game rule. The Sun the panels use is real.',
    },
  },
  robot: {
    pt: {
      what: 'O robô faz as tarefas da fila, uma depois da outra.',
      why: 'Gasta energia enquanto trabalha. Sem bateria, ele para.',
      source: 'Regra do jogo, ilustrativa.',
    },
    en: {
      what: 'The robot does the tasks in the queue, one after another.',
      why: 'Uses energy while it works. With no battery, it stops.',
      source: 'Game rule, illustrative.',
    },
  },
  greenhouse: {
    pt: {
      what: 'A estufa produz comida.',
      why: 'Gasta energia e água. No modo "só com sobra", liga com a bateria acima de 50%.',
      source: 'Regra do jogo, ilustrativa.',
    },
    en: {
      what: 'The greenhouse produces food.',
      why: 'Uses energy and water. In "only with surplus" mode it runs above 50% battery.',
      source: 'Game rule, illustrative.',
    },
  },
  space: {
    pt: {
      what: 'O clima do Sol: tempestades e partículas que chegam à Lua.',
      why: 'A radiação para o robô e manda a tripulação para dentro. A antena avisa com antecedência.',
      source: 'NASA DONKI, cenário de 09/10/2024. Dado real de uma janela histórica.',
    },
    en: {
      what: 'Space weather: storms and particles from the Sun that reach the Moon.',
      why: 'Radiation stops the robot and sends the crew inside. The antenna gives warnings ahead of time.',
      source: 'NASA DONKI, 9 Oct 2024 scenario. Real data from a past window.',
    },
  },
  hearts: {
    pt: {
      what: 'Você começa com 3 corações.',
      why: 'Perde 1 a cada 6 horas com energia, ar, água ou comida zerados. Chegar às 708 horas com 1 ou mais vence.',
      source: 'Regra do jogo. O dia lunar de 708 horas é aproximado (29,5 dias da Lua).',
    },
    en: {
      what: 'You start with 3 hearts.',
      why: 'You lose 1 every 6 hours with power, air, water or food at zero. Reach hour 708 with 1 or more to win.',
      source: 'Game rule. The 708-hour lunar day is approximate (29.5 Earth days).',
    },
  },
};
