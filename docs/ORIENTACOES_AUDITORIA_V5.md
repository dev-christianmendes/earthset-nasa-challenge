<!-- Registro fiel das orientações do autor (Christian Mendes), recebidas em 14/11/2026, depois do pedido de auditoria da jogabilidade. O texto abaixo do separador foi colado pelo autor e fica sem alteração. Os comentários do agente ficam no backlog e no diário, nunca dentro do texto. -->

# Orientações do autor · Auditoria funcional, jogabilidade e tempestades solares (v5)

- **Origem:** mensagem do autor, 14/11/2026, na sessão do Claude Code.
- **Motivo:** o autor abriu o jogo na porta 5180 e não encontrou as interações de estufa e astronautas que o registro dizia concluídas.
- **Estado:** em execução. Acompanhamento no Bloco 9 de `docs/backlog.md` e no diário `docs/execution-log.md`.
- **Restrição do autor:** nada de commit, push ou deploy sem autorização explícita (vale mesmo havendo regra de commit automático em memória).

---

# EARTHSET — AUDITORIA FUNCIONAL, JOGABILIDADE E TEMPESTADES SOLARES REAIS DA NASA

## Objetivo

Você afirmou que as melhorias de jogabilidade do Earthset foram implementadas. Entretanto, ao executar o jogo, várias funcionalidades não estão visíveis ou acessíveis.

Precisamos auditar o que realmente existe, corrigir as lacunas e implementar uma nova mecânica central: **tempestades solares fundamentadas em dados reais da NASA**.

O Earthset é um jogo de sobrevivência e gerenciamento de uma base no polo sul da Lua, com uma missão de 708 horas simuladas.

A base já possui habitat, estufa, astronautas, rover, painéis solares, antena e equipamentos. Preserve a qualidade visual existente.

Não considere uma funcionalidade concluída apenas porque existem classes, métodos, documentação ou testes unitários. Ela precisa funcionar no navegador e ser acessível ao jogador.

## 1. Auditoria funcional obrigatória

Leia AGENTS.md, CLAUDE.md, a arquitetura, o backlog e os testes existentes.

Inspecione os módulos reais do motor, renderização, interface, integração e pipelines científicos.

Para cada funcionalidade, determine:

- Se existe implementação no motor.
- Se está conectada ao estado da partida.
- Se existe interface acessível.
- Se pode ser acionada pelo jogador.
- Se há animação e feedback.
- Se produz consequências reais.
- Se foi testada no navegador.

Classifique como:

- IMPLEMENTADA E VALIDADA
- IMPLEMENTADA, MAS INACESSÍVEL
- PARCIALMENTE IMPLEMENTADA
- APENAS VISUAL
- NÃO IMPLEMENTADA
- COM DEFEITO

Apresente evidências com arquivos, linhas e resultados de testes.

## 2. Funcionalidades que devem existir

### Estufa

Permitir selecionar a estufa, consultar os cultivos, ajustar irrigação e iluminação, atribuir astronautas, acompanhar crescimento, colher alimentos e realizar manutenção.

As ações precisam consumir ou produzir recursos conforme as regras do motor.

### Astronautas

Permitir selecionar tripulantes, atribuir tarefas, acompanhar deslocamento, executar trabalhos, descansar, retornar ao habitat e buscar abrigo durante eventos perigosos.

Os estados precisam ser visíveis e sincronizados com a simulação.

### Rover

Permitir selecionar o rover, escolher missão, definir destino, iniciar deslocamento, acompanhar exploração, coletar gelo, retornar, descarregar e processar os recursos.

### Energia

Permitir inspecionar painéis solares, consultar geração e consumo, instalar novos módulos, realizar manutenção e visualizar consequências energéticas.

### Habitat

Permitir consultar sistemas vitais, acompanhar tripulação, gerenciar descanso, segurança e proteção contra radiação.

### Antena

Permitir consultar estado operacional, diagnosticar falhas, executar reparos e restabelecer comunicações.

### Processamento de gelo

Permitir processar gelo coletado, consumir energia, produzir água e acompanhar o progresso.

### Missões

Garantir objetivos claros, interações descobríveis, progressão, animações, consequências e integração com a narrativa.

## 3. NOVO SISTEMA — TEMPESTADES SOLARES BASEADAS EM DADOS REAIS DA NASA

Implemente um sistema de clima espacial que transforme eventos solares em desafios reais de sobrevivência.

Não quero tempestades fictícias apresentadas como dados científicos.

### 3.1 Fontes científicas

Investigue e utilize preferencialmente:

**NASA DONKI — Space Weather Database Of Notifications, Knowledge, Information**

https://ccmc.gsfc.nasa.gov/tools/DONKI/

https://api.nasa.gov/

Considere os seguintes eventos:

- FLR: Solar Flare — erupções solares.
- CME: Coronal Mass Ejection — ejeções de massa coronal.
- SEP: Solar Energetic Particle — eventos de partículas energéticas solares.
- GST: Geomagnetic Storm — tempestades geomagnéticas.
- IPS: Interplanetary Shock — choques interplanetários, quando relevantes.

Priorize SEP e informações fisicamente pertinentes à exposição lunar.

Não use Kp terrestre como medida direta de radiação na superfície da Lua.

Não assuma que toda erupção solar ou CME necessariamente atinge a Lua.

Identifique a localização de observação, os horários UTC, as limitações e a aplicabilidade de cada registro.

### 3.2 Auditoria dos dados existentes

Antes de criar novos pipelines, investigue os dados NASA DONKI e os cenários de radiação que já existem no Earthset.

Verifique:

- Quais registros são reais.
- Quais são cenários derivados.
- Quais são aproximações de gameplay.
- Quais eventos já influenciam a simulação.
- Quais eventos possuem apenas representação visual.

Reutilize os dados válidos e evite duplicação.

### 3.3 Integração temporal

A missão possui 708 horas simuladas.

Mapeie os eventos científicos à linha do tempo da missão de forma determinística e reproduzível.

Se a janela histórica escolhida não contiver eventos relevantes, não invente um evento e o apresente como histórico.

Nesse caso, permita um cenário educacional alternativo baseado em um evento histórico real, claramente identificado como uma transposição temporal para fins de simulação.

Diferencie explicitamente:

- Evento histórico observado.
- Estimativa científica derivada.
- Regra simplificada de gameplay.
- Cenário hipotético educacional.

A aplicação deve funcionar offline com dados previamente processados e versionados. Não dependa de chamadas à NASA durante a partida.

### 3.4 Mecânica de alerta

Implemente um sistema de alerta com estados operacionais:

NORMAL → MONITORAMENTO → ALERTA → ABRIGO → RECUPERAÇÃO.

Os estados devem ser determinados por evidências científicas disponíveis e por regras documentadas, não por números arbitrários apresentados como medições reais.

Quando houver risco relevante, a LUMA deve informar:

- Tipo de evento.
- Fonte científica.
- Horário do registro.
- Nível de risco estimado para a missão.
- Incertezas.
- Ações recomendadas.
- Tempo disponível, somente quando houver base justificável para uma estimativa.

Não apresente previsões perfeitas ou avisos antecipados impossíveis.

### 3.5 Interações durante tempestades solares

**Astronautas**

- Receber ordem de retorno ao habitat.
- Interromper atividades externas.
- Buscar abrigo.
- Permanecer protegidos durante o evento.
- Retomar tarefas quando houver condições seguras.

**Rover**

- Suspender missões externas quando necessário.
- Retornar à base quando viável.
- Permanecer estacionado ou em modo seguro.
- Retomar operações posteriormente.

**Habitat**

- Ativar protocolo de proteção.
- Acompanhar segurança da tripulação.
- Gerenciar consumo de energia e recursos durante o abrigo.
- Exibir status operacional.

**Painéis solares**

- Exibir geração de energia conforme a iluminação real.
- Modelar apenas efeitos adicionais de eventos solares que possuam justificativa técnica ou sejam explicitamente declarados como simplificação.
- Não confundir radiação solar com ausência de luz solar.

**Antena e comunicações**

- Representar possíveis interferências ou limitações quando cientificamente justificadas.
- Permitir diagnósticos e recuperação.

**Estufa**

- Permitir que sistemas automáticos continuem operando durante o abrigo.
- Exigir gerenciamento de energia e água.
- Criar consequências quando recursos essenciais forem insuficientes.

### 3.6 Representação visual

Quero que os eventos solares sejam percebidos pelo jogador.

Implemente:

- Alertas de LUMA.
- Mudança discreta na interface de risco.
- Indicadores de radiação e estado de proteção.
- Astronautas retornando ao habitat.
- Rover interrompendo ou alterando a missão.
- Equipamentos entrando em estados operacionais apropriados.
- Animações de preparação, abrigo e recuperação.
- Painel com histórico de eventos.

Não represente tempestades solares como chuva, vento, nuvens ou tempestades atmosféricas na superfície lunar.

Evite efeitos cinematográficos que contradigam o ambiente lunar.

### 3.7 Decisões e consequências

O jogador deverá escolher entre:

- Continuar uma atividade externa e aceitar riscos.
- Interromper a missão e proteger a tripulação.
- Priorizar energia e suporte de vida.
- Adiar a coleta de gelo.
- Preservar os cultivos.
- Reorganizar tarefas após o evento.

Os riscos devem ser claros, equilibrados e testáveis.

Não aplique danos aleatórios sem regras explícitas.

### 3.8 Painel científico

Adicione uma interface acessível pelo módulo Ciência ou pela LUMA contendo:

- Evento registrado.
- Classificação científica.
- Data e horário UTC.
- Fonte NASA.
- Identificador original, quando disponível.
- Aplicabilidade ao cenário lunar.
- Limitações dos dados.
- Consequências simuladas.

Permita distinguir dados observados de efeitos calculados pelo jogo.

## 4. Responsividade e desempenho

Investigue atrasos nas interações com astronautas, rover e equipamentos.

Separe:

- Latência do comando.
- Tempo de inicialização da animação.
- Duração simulada da atividade.
- Travamentos de renderização.

Uma ordem válida deve produzir feedback visual praticamente imediato, com meta de até 150 ms em condições normais.

Investigue carregamentos duplicados de GLB, shaders, reconstrução de objetos, vazamentos de GPU, listeners e operações pesadas por frame.

Meça antes e depois.

## 5. Testes reais no navegador

Utilize Playwright para validar:

**Estufa:** selecionar → atribuir astronauta → executar tarefa → observar resultado.

**Rover:** selecionar → iniciar missão → acompanhar movimento → coletar → retornar.

**Energia:** selecionar equipamento → executar operação → verificar efeito.

**Tripulação:** atribuir tarefa → deslocar → executar → concluir.

**Tempestade solar:** carregar cenário histórico → detectar evento → emitir alerta → ordenar abrigo → interromper atividades → acompanhar efeitos → retomar operações.

Teste também:

- Astronauta ocupado durante alerta.
- Rover distante da base.
- Energia insuficiente.
- Tempestade durante uma colheita.
- Pausa e aceleração do tempo.
- Reinício da partida.
- Ausência de eventos na janela histórica.
- Dados NASA incompletos ou indisponíveis.
- Consistência de recursos após múltiplas operações.

Não marque testes como aprovados sem executá-los.

## 6. Documentação científica

Documente:

- Fontes NASA e URLs.
- Período histórico utilizado.
- Proveniência dos registros.
- Transformações aplicadas.
- Limitações científicas.
- Diferença entre clima espacial terrestre e ambiente lunar.
- Fórmulas e hipóteses do modelo.
- Regras de gameplay.
- Créditos e atribuições.

Preserve a transparência científica e a declaração de uso de IA exigidas pelo projeto.

## 7. Ordem de execução

**P0 — Auditoria:** verificar quais funcionalidades realmente estão disponíveis e identificar as lacunas.

**P1 — Estabilidade:** corrigir travamentos, latência e problemas de integração.

**P2 — Interatividade:** concluir estufa, astronautas, rover e gestão da base.

**P3 — Tempestades solares:** integrar os dados reais da NASA ao motor, implementar alertas, decisões e consequências.

**P4 — Validação:** testes de gameplay, desempenho, documentação e revisão científica.

Não implemente tudo de uma só vez.

## 8. Critérios de aceitação

A entrega estará concluída somente quando:

1. O jogador conseguir interagir com os equipamentos diretamente no jogo.
2. As ações dos astronautas e do rover forem visíveis e responsivas.
3. As operações produzirem consequências reais nos recursos.
4. Um evento solar baseado em registro científico verificável puder ser reproduzido.
5. A LUMA orientar a tripulação durante o evento.
6. Os astronautas puderem buscar abrigo e retomar atividades.
7. O jogador conseguir consultar a fonte NASA utilizada.
8. Os testes automatizados e os fluxos Playwright forem executados.
9. O jogo continuar compatível com o deploy estático.
10. Nenhum evento hipotético for apresentado como observação real.

Preserve a arquitetura TypeScript, Three.js e Vite, os modelos existentes e os dados científicos válidos.

Não faça commits, push ou deploy sem autorização.

**Comece auditando o código e os dados existentes. Apresente uma matriz de implementação com evidências e só então corrija as lacunas, uma etapa por vez.**
