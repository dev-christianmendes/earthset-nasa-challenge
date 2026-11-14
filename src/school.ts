// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Textos do modo escola (B3.4): rótulos curtos e explicações de cada recurso. Sem DOM e sem regra de jogo;
// a tela (src/main.ts) aplica estes textos. Números e regras continuam em docs/regras-recursos.md.

/** Rótulo curto para o modo escola, pelo identificador do elemento (`data-label` em index.html). */
export const SCHOOL_LABELS: Record<string, string> = {
  battery: 'Energia',
  air: 'Ar',
  water: 'Água',
  food: 'Comida',
  panels: 'Painéis solares',
  robot: 'Tarefas do robô',
  greenhouse: 'Estufa',
  ice: 'Gelo (água)',
  panel: 'Painel solar',
  antenna: 'Antena',
};

export interface Explanation {
  /** O que é, em uma frase. */
  what: string;
  /** Por que o valor sobe ou cai. */
  why: string;
  /** De onde vem o dado. Só o Sol é dado real; o resto é regra do jogo. */
  source: string;
}

/** Explicações ao lado de cada recurso (`data-hint` em index.html). */
export const EXPLANATIONS: Record<string, Explanation> = {
  battery: {
    what: 'Guarda a energia dos painéis solares.',
    why: 'Cai com o gasto da base, da estufa, da eletrólise e do robô. Sem bateria, a base esfria.',
    source: 'Sol real (NASA/JPL Horizons). O resto é regra do jogo.',
  },
  air: {
    what: 'O ar que a tripulação respira.',
    why: 'Cai com o tempo. A eletrólise separa a água e devolve ar.',
    source: 'Regra do jogo, ilustrativa.',
  },
  water: {
    what: 'Água para beber e para a eletrólise.',
    why: 'Cai devagar. O robô traz gelo de crateras para repor.',
    source: 'Regra do jogo. O gelo de crateras é ilustrativo.',
  },
  food: {
    what: 'O que a tripulação come. Vem da estufa.',
    why: 'Cai com o tempo. A estufa só produz com energia e água.',
    source: 'Regra do jogo, ilustrativa.',
  },
  panels: {
    what: 'Cada painel gera energia quando o Sol está no céu.',
    why: 'O robô instala um painel por vez, até 12.',
    source: 'Regra do jogo. O Sol que os painéis usam é real.',
  },
  robot: {
    what: 'O robô faz as tarefas da fila, uma depois da outra.',
    why: 'Gasta energia enquanto trabalha. Sem bateria, ele para.',
    source: 'Regra do jogo, ilustrativa.',
  },
  greenhouse: {
    what: 'A estufa produz comida.',
    why: 'Gasta energia e água. No modo "só com sobra", liga com a bateria acima de 50%.',
    source: 'Regra do jogo, ilustrativa.',
  },
  space: {
    what: 'O clima do Sol: tempestades e partículas que chegam à Lua.',
    why: 'Uma tempestade G reduz a energia dos painéis. A radiação para o robô enquanto dura.',
    source: 'NASA DONKI, cenário de 08/10/2024. Dado real de uma janela histórica.',
  },
  hearts: {
    what: 'Você começa com 3 corações.',
    why: 'Perde 1 a cada 6 horas com energia, ar, água ou comida zerados. Chegar às 708 horas com 1 ou mais vence.',
    source: 'Regra do jogo. O dia lunar de 708 horas é aproximado (29,5 dias da Lua).',
  },
};
