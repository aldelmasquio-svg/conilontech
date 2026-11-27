// Reforços: Português (o que a FGV mais cobra/derruba), LEP (o que mais cai) e itens Certo/Errado no estilo Cebraspe.
(function () {
  const D = window.PCMG;
  const R = D.resumos;

  // ---------- Português: foco ----------
  R.port.unshift(['Onde a FGV mais derruba (priorize nesta ordem)', [
    'Na prova da PCMG 2025, as 10 questões foram de interpretação e semântica: cartaz (texto + imagem), linguagem figurada, tipologia textual, discurso indireto, classe/valor do adjetivo, inferência, elementos da comunicação, intensificação de sentido, precisão da informação e substituição de oração por substantivo. Quase não houve gramática "pura".',
    'Nas demais provas da FGV, concordância verbal e nominal é o assunto gramatical mais cobrado, seguido de pontuação. Coesão (conectivos e referência) vem logo depois.',
    'Pegadinhas que mais reprovam: (1) inferência que extrapola o texto; (2) "assinale a INADEQUADA/INCORRETA"; (3) reescrita que muda o sentido; (4) alternativa verdadeira, mas que não responde ao comando.',
    'Treino diário: leia o comando antes, sublinhe a palavra-chave (inferência, figurado, descritivo, intensificador) e elimine alternativas por prova textual.'
  ]]);
  R.port.splice(1, 0, ['Conceitos que a FGV cobrou na PCMG 2025', [
    'Tipologia: descritivo caracteriza (verbo de estado: "A riqueza é..."); narrativo conta ações em sequência ("Trabalhei, economizei, fiquei rico"); injuntivo orienta (imperativo: "Seja feliz!"); dissertativo defende ideia.',
    'Discurso direto reproduz a fala; indireto a relata com verbo dicendi + "que" ("Já foi dito que..."). Indireto livre mistura a fala da personagem à do narrador.',
    'Linguagem figurada: palavra fora do sentido literal (metáfora "serviço sem pagamento é castigo"; metonímia; hipérbole).',
    'Adjetivo de estado (resultado de ação: "mesa arranhada") × qualidade ("homem alto") × relação ("discurso presidencial", "produto importado"). Caiu na PCMG 2025 (Q5, resposta: "mesa arranhada").',
    'Elementos da comunicação: emissor (quem produz a mensagem — a loja/empresa, não quem afixa o cartaz), receptor, mensagem, código (palavras e imagens), canal, referente.',
    'Inferência adequada = conclusão que o texto autoriza. Inadequada = juízo de valor sem base ("muita gente vive em favelas" não implica "favelas são aprazíveis").'
  ]]);

  // ---------- LEP: o que mais cai ----------
  R.leg.push(['LEP — só o que mais cai para Investigador', [
    'Permissão de saída (arts. 120 e 121): presos dos regimes fechado e semiaberto e provisórios; COM ESCOLTA; por falecimento ou doença grave do cônjuge, companheira, ascendente, descendente ou irmão, ou para tratamento médico; concedida pelo DIRETOR do estabelecimento; dura o tempo necessário. Caiu na PCMG 2025.',
    'Saída temporária (arts. 122 a 125): só no semiaberto; SEM vigilância direta (pode haver monitoração eletrônica); concedida pelo JUIZ da execução; hoje só para estudo. Vedada a condenado por crime hediondo ou com violência ou grave ameaça contra pessoa.',
    'Progressão (art. 112): 16% primário sem violência; 20% reincidente sem violência; 25% primário com violência ou grave ameaça; 30% reincidente com violência; 40% hediondo primário; 50% hediondo com morte (primário), comando de organização criminosa ou milícia; 60% reincidente em hediondo; 70% reincidente em hediondo com morte. Exige boa conduta e exame criminológico (§1º).',
    'Remição (arts. 126 a 130): 1 dia de pena a cada 3 dias de trabalho; 1 dia a cada 12 horas de estudo, divididas em no mínimo 3 dias; +1/3 ao concluir ensino fundamental, médio ou superior; falta grave pode revogar até 1/3 do tempo remido (art. 127).',
    'Faltas graves (art. 50): incitar movimento de subversão, fugir, possuir instrumento capaz de ofender, provocar acidente, descumprir condições do regime aberto, ter aparelho celular, recusar a identificação do perfil genético.',
    'RDD (art. 52): até 2 anos, sem prejuízo de repetição por nova falta; cela individual; visitas quinzenais de 2 pessoas por 2 horas; banho de sol de 2 horas diárias.',
    'Atenção: a Lei Antifacção (15.358/2026) endureceu a execução penal para integrantes de facção. Confira no art. 112 da LEP compilada se mudou algum percentual de progressão antes da prova.',
    'Monitoração eletrônica (art. 146-B): pode ser usada na saída temporária, na prisão domiciliar, no livramento condicional e nos regimes aberto e semiaberto.'
  ]]);
  D.materias.find(m => m.id === 'leg').topicos.push('Execução Penal (LEP): saídas, progressão, remição, faltas e RDD');

  // ---------- Lei Orgânica: a prova também cobrou a Lei 5.406/1969 ----------
  const lo = D.materias.find(m => m.id === 'lo');
  lo.nome = 'Lei Orgânica da PCMG (LC 129/2013 e Lei 5.406/1969)';
  lo.topicos.push('Lei 5.406/1969: penalidades, causas de justificação, atenuantes e revisão do processo disciplinar');
  lo.lei2 = { n: 'Lei 5.406/1969 (ALMG)', u: 'https://www.almg.gov.br/legislacao-mineira/texto/LEI/5406/1969/' };
  R.lo.unshift(['O que a FGV cobrou em 2025', [
    'Das 6 questões, 3 foram da LC 129/2013 (remoção por permuta, verbas indenizatórias e afastamento para curso) e 3 da Lei Estadual 5.406/1969 (penas de demissão, causas justificantes e revisão do processo disciplinar). Estude as DUAS leis.',
    'Causa de justificação afasta a punição (ex.: motivo de força maior plenamente comprovado). Bom comportamento, serviços relevantes e confissão espontânea são atenuantes.',
    'Revisão do processo disciplinar: cabe a qualquer tempo; não agrava a pena; simples alegação de injustiça não basta; quem integrou a comissão do processo não atua na revisão; procedente, a pena é reduzida ou cancelada.'
  ]]);

  // ---------- Questões novas (FGV) ----------
  const novas = [
    ['port', 'Assinale a opção em que o adjetivo sublinhado indica uma RELAÇÃO, e não uma qualidade.', ['Investigador experiente.', 'Laudo detalhado.', 'Inquérito policial.', 'Testemunha nervosa.', 'Prova frágil.'], 2, '"Policial" relaciona o inquérito à polícia (equivale a "da polícia") e não admite grau ("muito policial"). Os demais qualificam.'],
    ['port', 'Assinale a frase em que há linguagem figurada.', ['O delegado ouviu três testemunhas.', 'A investigação andou a passos de tartaruga.', 'O suspeito fugiu pela janela dos fundos.', 'O laudo ficou pronto em dez dias.', 'A equipe cumpriu o mandado às seis horas.'], 1, 'Comparação/metáfora: a investigação não "anda" e não tem "passos". As demais estão em sentido literal.'],
    ['port', '"O investigador afirmou: — Encontrei a arma no carro." Transposta para o discurso indireto, a frase fica:', ['O investigador afirmou que encontrara a arma no carro.', 'O investigador afirmou que encontrei a arma no carro.', 'O investigador afirmou: encontrara a arma no carro.', 'O investigador afirmou que encontrará a arma no carro.', 'O investigador afirmou que tinha encontrado a arma naquele carro, ontem.'], 0, 'No indireto, o pretérito perfeito ("encontrei") passa ao mais-que-perfeito ("encontrara" ou "tinha encontrado") e a 1ª pessoa vira 3ª. (E) acrescenta informação ("ontem").'],
    ['port', '"O número de furtos caiu depois que a praça foi iluminada." A inferência ADEQUADA é:', ['A iluminação acabou com todos os crimes da cidade.', 'A iluminação pode ter contribuído para a redução dos furtos na praça.', 'Antes da iluminação, a polícia não patrulhava a praça.', 'Os furtos migraram para outros bairros.', 'A praça é o local mais seguro da cidade.'], 1, 'O texto autoriza apenas uma relação provável entre iluminação e queda de furtos naquela praça. As demais extrapolam.'],
    ['port', 'Assinale a opção em que a concordância está de acordo com a norma-padrão.', ['Fazem cinco anos que o crime ocorreu.', 'Existe muitas lacunas no depoimento.', 'Haviam provas suficientes para a prisão.', 'Seguem anexos os documentos solicitados.', 'É necessário a presença do advogado.'], 3, '"Anexos" concorda com "documentos". Faz (tempo) e havia (existir) ficam no singular; "existem lacunas"; "é necessária a presença" (com artigo, concorda).'],
    ['leg', 'Preso provisório recebe a notícia de que seu irmão está gravemente doente. Segundo a LEP, ele', ['não tem direito a sair, por ser preso provisório.', 'pode obter permissão de saída, com escolta, concedida pelo diretor do estabelecimento.', 'pode obter saída temporária, concedida pelo juiz, sem vigilância direta.', 'só pode sair com autorização do Ministério Público.', 'pode sair por até 7 dias, sem escolta.'], 1, 'Art. 120, I, e parágrafo único: permissão de saída também para presos provisórios, com escolta, concedida pelo diretor.'],
    ['leg', 'Condenado primário por roubo com grave ameaça (crime não hediondo) progride de regime após cumprir, no mínimo,', ['16% da pena.', '20% da pena.', '25% da pena.', '30% da pena.', '40% da pena.'], 2, 'Art. 112, III: 25% para primário em crime com violência ou grave ameaça.'],
    ['leg', 'Sobre a remição pela LEP, é correto afirmar:', ['Cada dia de trabalho remite um dia de pena.', 'A cada 12 horas de frequência escolar, divididas em no mínimo 3 dias, remite-se 1 dia de pena.', 'A falta grave faz perder todo o tempo remido.', 'O preso em regime aberto remite pelo trabalho.', 'A conclusão do ensino médio não gera nenhum acréscimo.'], 1, 'Art. 126, §1º, I. Trabalho: 1 dia a cada 3. Falta grave revoga até 1/3 (art. 127). Conclusão de curso: +1/3 (art. 126, §5º).'],
    ['leg', 'Constitui falta grave do condenado à pena privativa de liberdade, segundo a LEP:', ['atrasar-se para o almoço.', 'ter em sua posse aparelho telefônico que permita comunicação com outros presos ou com o ambiente externo.', 'receber visita do cônjuge.', 'recusar-se a trabalhar aos domingos.', 'reclamar formalmente ao diretor.'], 1, 'Art. 50, VII.']
  ];
  novas.forEach((q, i) => D.questoes.push({ id: 'x' + i, m: q[0], e: q[1], a: q[2], c: q[3], x: q[4] }));

  // ---------- Itens Certo/Errado (estilo Cebraspe) ----------
  const CE = [
    ['port', 'Em "Havia indícios suficientes para o indiciamento", o verbo poderia ser flexionado no plural, por concordar com "indícios".', 1, 'Haver no sentido de existir é impessoal: fica no singular.'],
    ['port', 'Em "Os agentes, que estavam de plantão, atenderam à ocorrência", a supressão das vírgulas altera o sentido do período.', 0, 'Com vírgulas, a oração é explicativa (todos estavam de plantão); sem elas, passa a restritiva (só os que estavam de plantão).'],
    ['port', 'O vocábulo "conquanto" poderia substituir "embora" em "Embora cansado, o investigador concluiu o relatório", sem prejuízo do sentido.', 0, 'Ambos são concessivos.'],
    ['rlm', 'A negação de "Se o suspeito fugiu, então ele é culpado" é "O suspeito fugiu e não é culpado".', 0, '~(p → q) ≡ p ∧ ~q.'],
    ['rlm', 'A proposição "Todo policial é concursado" é equivalente a "Nenhum policial não é concursado".', 0, 'Dizer que nenhum policial deixa de ser concursado é o mesmo que todos serem.'],
    ['rlm', 'Se um valor aumenta 10% e depois diminui 10%, ele volta ao valor original.', 1, '1,1 × 0,9 = 0,99: fica 1% menor.'],
    ['info', 'Na criptografia assimétrica, para garantir a confidencialidade, o remetente cifra a mensagem com a chave pública do destinatário.', 0, 'Só a chave privada do destinatário decifra.'],
    ['info', 'Worms dependem de que o usuário execute um programa hospedeiro para se propagar.', 1, 'Worms se autorreplicam pela rede; quem depende de execução pelo usuário é o vírus/trojan.'],
    ['info', 'No Excel, ao copiar a fórmula =$A$1+B1 de C1 para C3, obtém-se =$A$1+B3.', 0, '$A$1 é absoluta; B1 desce duas linhas.'],
    ['lo', 'As polícias civis subordinam-se aos Governadores dos Estados, do Distrito Federal e dos Territórios.', 0, 'CF, art. 144, §6º.'],
    ['lo', 'A competência para legislar sobre organização, garantias, direitos e deveres das polícias civis é privativa da União.', 1, 'É concorrente (CF, art. 24, XVI).'],
    ['lo', 'Segundo a Lei 5.406/1969, a revisão do processo disciplinar pode resultar em agravamento da pena.', 1, 'A revisão não autoriza agravar a pena.'],
    ['const', 'A casa é asilo inviolável, podendo-se nela penetrar sem consentimento do morador, durante a noite, em caso de flagrante delito.', 0, 'Art. 5º, XI: flagrante, desastre e socorro autorizam a entrada a qualquer hora.'],
    ['const', 'A União pode decretar intervenção federal em município localizado em Estado-membro para pôr termo a grave comprometimento da ordem pública.', 1, 'A União só intervém em municípios de Territórios Federais (art. 35).'],
    ['const', 'A escusa de consciência permite que a pessoa se exima de obrigação legal a todos imposta por convicção política, desde que cumpra prestação alternativa fixada em lei.', 0, 'Art. 5º, VIII.'],
    ['adm', 'A Polícia Civil de Minas Gerais é órgão da Administração direta, criado por desconcentração.', 0, 'Não tem personalidade jurídica própria.'],
    ['adm', 'Após a Lei 14.230/2021, a sentença que julga procedente a ação de improbidade está sujeita a reexame necessário.', 1, 'Art. 17-C, §3º: não há remessa necessária.'],
    ['adm', 'A responsabilidade civil do Estado por danos causados por seus agentes é objetiva, dispensando a prova de culpa do agente.', 0, 'Art. 37, §6º.'],
    ['penal', 'Pratica tráfico de influência quem solicita vantagem a pretexto de influir em ato praticado por policial civil.', 0, 'Art. 332 do CP.'],
    ['penal', 'O roubo se consuma apenas quando o agente obtém a posse mansa e pacífica da coisa.', 1, 'Súmula 582 do STJ: basta a inversão da posse, ainda que breve.'],
    ['penal', 'A lesão corporal dolosa contra policial civil no exercício da função tem a pena aumentada de 1/3 a 2/3.', 0, 'Art. 129, §12.'],
    ['pp', 'Arquivado o inquérito por falta de base para a denúncia, a autoridade policial poderá proceder a novas pesquisas se tiver notícia de outras provas.', 0, 'Art. 18 do CPP.'],
    ['pp', 'O auto de prisão em flagrante deve ser encaminhado ao juiz em até 48 horas após a prisão.', 1, 'Prazo de 24 horas (art. 306, §1º).'],
    ['pp', 'Segundo o STF, a competência do juiz das garantias cessa com o recebimento da denúncia.', 1, 'Cessa com o OFERECIMENTO da denúncia (ADIs 6298 e outras).'],
    ['leg', 'A infiltração de agentes prevista na Lei 12.850/2013 pode ser autorizada por até seis meses, admitidas renovações, desde que comprovada a necessidade.', 0, 'Art. 10, §3º.'],
    ['leg', 'Na Lei de Drogas, na falta de perito oficial, o laudo de constatação pode ser firmado por pessoa idônea.', 0, 'Art. 50, §1º.'],
    ['leg', 'A permissão de saída é concedida pelo juiz da execução e dispensa escolta.', 1, 'É concedida pelo diretor do estabelecimento e exige escolta (arts. 120 e 121 da LEP).'],
    ['dh', 'Todos os tratados internacionais de direitos humanos ratificados pelo Brasil possuem hierarquia constitucional.', 1, 'Só os aprovados pelo rito do art. 5º, §3º; os demais são supralegais.'],
    ['dh', 'A pessoa que tem direito humano violado pode acionar diretamente a Corte Interamericana de Direitos Humanos.', 1, 'Petições individuais vão à Comissão; só a Comissão e os Estados submetem casos à Corte.'],
    ['dh', 'Os direitos humanos são inalienáveis, irrenunciáveis e imprescritíveis.', 0, 'Características clássicas.'],
    ['ml', 'O anel de Fisch é formado pelas orlas de contusão, escoriação e enxugo e está presente no orifício de entrada independentemente da distância do disparo.', 0, 'Efeito primário do projétil.'],
    ['ml', 'A rigidez cadavérica é o primeiro sinal de certeza da morte.', 1, 'Os sinais das primeiras horas são de probabilidade (período de incerteza de Tourdes).'],
    ['ml', 'O juiz não fica adstrito ao laudo pericial, podendo rejeitá-lo no todo ou em parte.', 0, 'Art. 182 do CPP.'],
    ['crim', 'Cifra amarela designa os crimes praticados por funcionários públicos contra vítimas que não os denunciam por medo de represálias.', 0, 'Conceito cobrado na PCMG 2025.'],
    ['crim', 'A teoria do Direito Penal do Inimigo foi formulada por Claus Roxin.', 1, 'Günther Jakobs.'],
    ['crim', 'A prevenção terciária volta-se ao condenado, buscando evitar a reincidência.', 0, 'Primária: causas; secundária: grupos de risco; terciária: o apenado.']
  ];
  CE.forEach((q, i) => D.questoes.push({ id: 'ce' + i, m: q[0], e: q[1], a: ['Certo', 'Errado'], c: q[2], x: q[3], ce: true }));
  // ---------- Constitucional: emendas recentes e PEC da Segurança ----------
  R.const.push(['Emendas constitucionais que importam para a prova', [
    'EC 104/2019: criou as polícias penais (art. 144, VI e §5º-A), vinculadas ao órgão administrador do sistema penal. Caiu na PCMG 2025.',
    'EC 115/2022: proteção de dados pessoais, inclusive nos meios digitais, virou direito fundamental (art. 5º, LXXIX). Compete à União organizar e fiscalizar a proteção de dados (art. 21, XXVI) e legislar privativamente sobre o tema (art. 22, XXX).',
    'EC 45/2004 (sempre cobrada): tratados de direitos humanos com rito especial equivalem a emenda (art. 5º, §3º); incidente de deslocamento de competência (art. 109, §5º).',
    'Emendas de 2025 e 2026 (EC 136 a EC 140) trataram de precatórios, IPVA, acumulação de cargos de professor, Tribunais de Contas e aposentadoria de agentes de saúde. Fora a EC 138 (acumulação de cargos), não têm relação com o edital de Investigador.'
  ]]);
  R.const.push(['PEC da Segurança Pública (PEC 18/2025) — aprovada, aguardando promulgação', [
    'Situação: aprovada na Câmara (mar/2026) e no Senado em dois turnos (03/11/2026). Até o fim de novembro de 2026 não encontrei a promulgação. Só vira texto da Constituição quando promulgada pelas Mesas da Câmara e do Senado; até lá, o art. 144 em vigor é o atual. Se o novo edital sair depois da promulgação, ela entra com força em Constitucional.',
    'SUSP na Constituição: novo art. 144-A. Os órgãos de segurança atuam de forma integrada no Sistema Único de Segurança Pública, para a prevenção, a persecução penal e a execução das penas.',
    'Polícias municipais: os municípios PODEM criar polícia municipal (não é automático), cumpridos requisitos de formação, capacidade financeira e fiscalização, com controle externo do Ministério Público e ouvidorias.',
    'Polícia Federal: passa a investigar também crimes de organizações criminosas e milícias de repercussão interestadual ou internacional e crimes ambientais.',
    'PRF: absorve a antiga Polícia Ferroviária Federal e atua também em ferrovias e hidrovias federais.',
    'Fundos: FNSP, Funpen e Funapol protegidos contra bloqueio e desvio de finalidade; parte do Fundo Social (pré-sal) vai para a segurança pública; repasse de parte dos fundos aos estados e ao DF.',
    'Competência legislativa: segundo as reportagens, segurança pública, organização das polícias, guardas municipais e sistema socioeducativo passam a ser matéria de legislação compartilhada entre os entes. Confira a redação exata após a promulgação.',
    'A redução da maioridade penal ficou FORA do texto (destaque aprovado no Senado). Continua 18 anos (art. 228).',
    'Atenção: esses pontos vêm de reportagens sobre o texto aprovado. Quando a emenda for promulgada, a redação oficial no Planalto prevalece. Me peça para revisar este resumo nessa data.'
  ]]);
  D.materias.find(m => m.id === 'const').topicos.push('Emendas recentes (EC 104, EC 115) e PEC da Segurança Pública');
  [
    ['const', 'A proteção dos dados pessoais, inclusive nos meios digitais, é direito fundamental expresso na Constituição Federal.', 0, 'Art. 5º, LXXIX (EC 115/2022).'],
    ['const', 'Compete aos Estados legislar sobre proteção e tratamento de dados pessoais.', 1, 'Competência privativa da União (art. 22, XXX, EC 115/2022).'],
    ['const', 'As polícias penais integram o rol de órgãos de segurança pública do art. 144 da Constituição desde a EC 104/2019.', 0, 'Art. 144, VI.']
  ].forEach((q, i) => D.questoes.push({ id: 'ce-ec' + i, m: q[0], e: q[1], a: ['Certo', 'Errado'], c: q[2], x: q[3], ce: true }));
  // ---------- Atualizações 2025–2026 (processo penal e penal) ----------
  R.pp.push(['Novidades de 2025 e 2026 no CPP (alta chance de prova)', [
    'Lei 15.272/2025 — art. 312, §4º: é INCABÍVEL a preventiva com base na gravidade abstrata do delito; é preciso demonstrar concretamente a periculosidade e o risco à ordem pública ou econômica, à instrução ou à aplicação da lei penal.',
    'Lei 15.272/2025 — art. 312, §3º: critérios para aferir a periculosidade, entre eles o modus operandi (violência ou grave ameaça reiterada, premeditação), a participação em organização criminosa, a natureza e quantidade de drogas, armas ou munições apreendidas e o receio fundado de reiteração.',
    'Lei 15.272/2025 — art. 310, §§5º e 6º: circunstâncias que RECOMENDAM (não obrigam) converter o flagrante em preventiva, e o juiz deve examiná-las expressamente na audiência de custódia.',
    'Lei 15.272/2025 — art. 310-A: coleta de material biológico (DNA) do preso em flagrante por crimes graves.',
    'Lei 15.358/2026 (Lei Antifacção) — art. 310: a audiência de custódia continua em até 24 horas, mas passa a ser, em regra, por VIDEOCONFERÊNCIA, com presença do preso, da defesa e do MP e entrevista prévia reservada com o defensor. A presencial fica para situações excepcionais, com decisão justificada.',
    'Lei 15.358/2026 — art. 313, VI: nova hipótese de admissibilidade da preventiva ligada aos crimes de facção (organização criminosa ultraviolenta). Há divergência sobre se dispensa os requisitos do art. 312, e a lei é questionada no STF (ADI 7952).',
    'A Lei Antifacção também prevê bloqueio de ativos digitais, perdimento de bens e um Banco Nacional de Dados de Organizações Criminosas.'
  ]]);
  R.leg.push(['Lei Antifacção (Lei 15.358/2026 — "Lei Raul Jungmann")', [
    'Em vigor desde 25/03/2026; alterou o CP, o CPP, a LEP, a Lei de Crimes Hediondos e outras leis.',
    'Cria a figura da organização criminosa ultraviolenta (facção) e os crimes de domínio social estruturado e de favorecimento ao domínio social estruturado, considerados hediondos.',
    'Endurece a execução penal para integrantes de facção e veda o auxílio-reclusão aos dependentes dos condenados por esses crimes.',
    'Pontos questionados no STF (ADI 7952): aumento automático de penas, preventiva automática e confisco de bens sem condenação. Acompanhe o julgamento.',
    'As penas exatas variam entre as fontes que consultei. Leia os arts. 2º e 3º da lei no Planalto antes da prova.'
  ]]);
  R.penal.push(['Lei 15.397/2026 — crimes patrimoniais (em vigor desde maio/2026)', [
    'Furto simples (art. 155): reclusão de 1 a 6 anos (era 1 a 4). Furto de celular, computador ou tablet: 4 a 10 anos.',
    'Roubo (art. 157): reclusão de 6 a 10 anos (era 4 a 10). Latrocínio: 24 a 30 anos (mínimo era 20).',
    'Receptação (art. 180): reclusão de 2 a 6 anos (era 1 a 4). Novo art. 180-A: receptação de animal doméstico, 3 a 8 anos.',
    'Estelionato: ação penal pública incondicionada (o §5º do art. 171 foi revogado). A lei também trata da cessão de conta bancária para golpes (conta laranja).',
    'Com o furto simples chegando a 6 anos, passa a caber preventiva (art. 313, I: pena máxima superior a 4 anos).',
    'Houve veto parcial. Confira no CP compilado do Planalto se o veto foi mantido ou derrubado.'
  ]]);
  D.materias.find(m => m.id === 'pp').topicos.push('Novidades: Lei 15.272/2025 (preventiva) e Lei 15.358/2026 (custódia por videoconferência)');
  D.materias.find(m => m.id === 'leg').topicos.push('Lei Antifacção (Lei 15.358/2026)');
  D.materias.find(m => m.id === 'penal').topicos.push('Lei 15.397/2026: novas penas de furto, roubo, receptação e estelionato');
  [
    ['pp', 'Segundo o CPP, com a redação da Lei 15.272/2025, é incabível a decretação da prisão preventiva com base em alegações de gravidade abstrata do delito.', 0, 'Art. 312, §4º.'],
    ['pp', 'Após a Lei 15.358/2026, a audiência de custódia passou a ser realizada, em regra, por videoconferência, no prazo de até 24 horas da prisão.', 0, 'Art. 310, com a redação da Lei Antifacção; presencial só em situação excepcional justificada.'],
    ['pp', 'As circunstâncias do art. 310, §5º, do CPP obrigam o juiz a converter a prisão em flagrante em preventiva.', 1, 'Elas RECOMENDAM a conversão; o juiz deve examiná-las expressamente (§6º), mas a decisão continua dependendo do art. 312.'],
    ['penal', 'Após a Lei 15.397/2026, o estelionato comum voltou a ser crime de ação penal pública incondicionada.', 0, 'Revogação do §5º do art. 171.'],
    ['penal', 'A pena mínima do roubo simples, após a Lei 15.397/2026, é de 4 anos de reclusão.', 1, 'Passou a 6 anos (6 a 10).']
  ].forEach((q, i) => D.questoes.push({ id: 'ce-26-' + i, m: q[0], e: q[1], a: ['Certo', 'Errado'], c: q[2], x: q[3], ce: true }));
  // ---------- Lei Orgânica: resumo pela letra da lei (LC 129/2013 e Lei 5.406/1969, textos atualizados da ALMG) ----------
  const baseCF = R.lo.find(x => x[0] === 'Base constitucional');
  R.lo = [
    ['O que a FGV cobrou em 2025 (e como)', [
      '6 questões: 3 da LC 129/2013 (competência para remoção por permuta, verbas indenizatórias, afastamento para curso) e 3 da Lei 5.406/1969 (penas de demissão, causa justificativa, revisão do processo disciplinar).',
      'Padrão da banca: copiar o artigo e trocar UM número (45 → 30 dias; 3 → 6 meses; 3 → 5 anos) ou UMA palavra ("ex officio" → "a pedido"; "permite" → "vedada"). Decore os números.',
      'Por que a Lei 5.406/1969 cai: a LC 129/2013 revogou quase toda a lei antiga, MAS manteve os arts. 142 a 205 (regime disciplinar) até sair o Estatuto Disciplinar próprio (LC 129, art. 116, parágrafo único).'
    ]],
    ['LC 129/2013 — natureza, princípios e competência (arts. 1º a 16)', [
      'Art. 2º: PCMG é órgão AUTÔNOMO, essencial à segurança pública, à realização da justiça e à defesa das instituições democráticas.',
      'Art. 3º: princípios do art. 37 da CF (LIMPE) + promoção dos direitos humanos, participação comunitária, mediação de conflitos, uso proporcional da força, hierarquia e disciplina, transparência e controle, integração com o Sistema de Defesa Social.',
      'Art. 4º (investigação e polícia judiciária): indisponibilidade do interesse público, obrigatoriedade, oficialidade, sigilo, imparcialidade; inevitabilidade, inafastabilidade, indeclinabilidade, INDELEGABILIDADE, INDIVISIBILIDADE e interdisciplinaridade da investigação.',
      'Art. 5º: autonomia administrativa e financeira (programação financeira, contabilidade própria, compra de viaturas e equipamentos).',
      'Art. 11: a direção da polícia judiciária cabe aos Delegados de Polícia de carreira; os atos de polícia judiciária são fiscalizados pelo Corregedor-Geral.',
      'Art. 13: carteira funcional válida em todo o território nacional.',
      'Art. 14: polícia judiciária e apuração de infrações penais e ATOS INFRACIONAIS, exceto militares. Atividades PRIVATIVAS: polícia técnico-científica, identificação civil e criminal, registro e licenciamento de veículos e habilitação de condutor.',
      'Art. 15: subordina-se DIRETAMENTE ao Governador e integra, para fins operacionais, o Sistema de Defesa Social.',
      'Art. 16, parágrafo único: funções constitucionais da PCMG são INDELEGÁVEIS e só exercidas pelas carreiras que a integram.'
    ]],
    ['LC 129/2013 — estrutura (arts. 17 a 38)', [
      'Administração SUPERIOR (art. 17, I): Chefia da PCMG, Chefia Adjunta, Conselho Superior e Corregedoria-Geral.',
      'Administração (art. 17, II): Gabinete da Chefia, Academia de Polícia Civil e as Superintendências de Investigação e Polícia Judiciária, de Informações e Inteligência Policial, de Polícia Técnico-Científica e de Planejamento, Gestão e Finanças. (O Detran saiu da estrutura em 2023, pela Lei 24.313.)',
      'Subordinações (art. 17, §§2º e 3º): Departamentos, Polinter e Casa de Custódia → Superintendência de Investigação e Polícia Judiciária; Instituto de Criminologia e Colégio Ordem e Progresso → Academia; IC, IML e postos de perícia → Superintendência de Polícia Técnico-Científica; Instituto de Identificação → Superintendência de Informações e Inteligência.',
      'Chefe da PCMG (art. 18): nomeado pelo Governador dentre Delegados do nível final, em atividade, com no mínimo VINTE anos de serviço policial. Tem status de Secretário de Estado (art. 19). Chefe Adjunto: também 20 anos, escolhido pelo Chefe e nomeado pelo Governador (art. 23).',
      'Substituição do Chefe (art. 20): Chefe Adjunto → Corregedor-Geral → Superintendente de Investigação e Polícia Judiciária → Chefe de Gabinete → Diretor da Academia → Sup. de Informações e Inteligência → Sup. de Planejamento → Delegado Assistente.',
      'Diretores de Superintendências, Academia, Corregedoria etc.: Delegados-Gerais com no mínimo QUINZE anos de serviço (art. 17, §§7º e 8º).',
      'Conselho Superior (arts. 24 a 31): presidido pelo Chefe; estrutura: Órgão Especial, Câmara Disciplinar (presidida pelo Chefe ADJUNTO, julga recursos contra atos do Corregedor) e Câmara de Planejamento e Orçamento. Inclui os Inspetores-Gerais de Escrivães e de Investigadores. Delibera sobre promoções, estabilidade, afastamento para curso e propõe remoção ex officio.',
      'Corregedoria-Geral (arts. 32 a 34): órgão orientador, fiscalizador e correicional; pode avocar inquéritos; propõe afastamento preliminar de servidor por até NOVENTA dias (acima de 90 e abaixo de 180 dias, por ato do Chefe com deliberação do Conselho Superior); acompanha o estágio probatório.',
      'Superintendência de Investigação e Polícia Judiciária (art. 38): pode incumbir Delegado ou policial de diligências por até 30 dias; remove Investigadores e Escrivães A PEDIDO OU POR PERMUTA dentro do mesmo Departamento (inciso V — caiu em 2025).'
    ]],
    ['LC 129/2013 — prerrogativas e direitos (arts. 45 a 51)', [
      'Prerrogativas (art. 45): distintivo e identidade funcional válidos em todo o país; PORTE LIVRE de arma em todo o território nacional; livre acesso a locais sujeitos a intervenção policial; prioridade em transporte e comunicação em serviço urgente; busca pessoal e veicular com fundada suspeita; requisição de bens em iminente perigo público (com indenização); prisão especial; receber arma, munição, colete, algemas e distintivo na primeira designação.',
      'Art. 47: preso provisoriamente, o policial é afastado SEM prejuízo da remuneração até o trânsito em julgado; condenado sem demissão, recebe só UM TERÇO da remuneração enquanto cumpre pena privativa de liberdade (salvo se puder exercer a função).',
      'Verbas (art. 49): ajuda de custo (remoção EX OFFICIO ou designação que mude o domicílio, valor de UM mês de vencimento); diárias; transporte de dependentes (remoção ex officio); auxílio-funeral (até um mês de vencimento); translado quando ferido, acidentado ou falecido em serviço; 13º; 1/3 de férias; indenização securitária (20 vezes a remuneração, com teto); auxílio-natalidade (valor da remuneração, uma única percepção se pai e mãe forem da PCMG).',
      'Art. 50: indenização de vestimenta = 40% do vencimento básico do nível I de Investigador, paga anualmente.',
      'Art. 51, parágrafo único: reposições ao erário em parcelas de no máximo 1/10 dos vencimentos (salvo má-fé).'
    ]],
    ['LC 129/2013 — remoção, jornada, licenças e afastamentos (arts. 52 a 70)', [
      'Remoção entre municípios (art. 52): com edital e vaga; hipóteses: a pedido ou permuta; acompanhar cônjuge servidor removido ex officio; saúde; ex officio no interesse do serviço (motivada); conveniência da disciplina (independe de vaga). Remoções a pedido/permuta, por cônjuge e por disciplina NÃO geram indenização (§1º).',
      'Remoção durante férias ou licença saúde só produz efeito depois do afastamento (art. 56).',
      'Jornada (arts. 58 e 82): 40 h semanais; máximo de 8 h diárias e plantão de no máximo 12 h ininterruptas; descanso mínimo de 12 h após plantão; dever de atuar ao presenciar infração, mesmo de folga ou férias; tempo em trânsito para diligência conta como trabalhado.',
      'Licenças (art. 59): saúde, doença em pessoa da família, maternidade/paternidade/adoção, acidente em serviço, mandato sindical.',
      'Licenciado para saúde não pode ter atividade remunerada (art. 61) — e isso é causa de DEMISSÃO (Lei 5.406, art. 158, VI).',
      'Doença em pessoa da família (art. 65): até 90 dias com vencimentos + prorrogação sem remuneração por até 120 dias; não renovável em 12 meses. Acidente em serviço (art. 66): até 2 anos; prova em 30 dias.',
      'Afastamento de 8 dias consecutivos (art. 67): casamento (comunicar antes) e falecimento de cônjuge/companheiro, ascendente, descendente ou irmão.',
      'Curso (art. 68 — caiu em 2025): concedido pelo CHEFE da PCMG por TRÊS meses, prorrogável por mais TRÊS; vedado em estágio probatório ou com sindicância/PAD; relatório em 30 dias, senão não conta como tempo de serviço; depois, servir mais TRÊS anos ou ressarcir; exterior ou curso no país acima de SEIS meses depende do GOVERNADOR. Art. 69: afastado não pode exercer outra função, sob pena de cassação do afastamento.',
      'Interesses particulares (art. 70, IV): até 2 anos, sem vencimentos, não conta como efetivo exercício; vedado a quem responde PAD, está em estágio probatório ou já pode se aposentar.'
    ]],
    ['LC 129/2013 — carreiras, ingresso, estágio e promoção (arts. 76 a 101)', [
      'Carreiras (art. 76): Delegado, Escrivão, INVESTIGADOR, Médico-Legista e Perito Criminal. Não há hierarquia entre Escrivão, Investigador, Médico-Legista e Perito (art. 81, §6º).',
      'O Investigador pode fazer busca pessoal e veicular com fundada suspeita e efetuar prisões (art. 79, §1º, I). Local de crime: coleta de vestígios com primazia do Perito; depois de liberado, análise pelos Investigadores (art. 79, §3º).',
      'Concurso (art. 84): provas e títulos; psicotécnico; exames biomédicos; exames biofísicos (testes físicos); investigação social. Só a 1ª etapa é eliminatória E classificatória; as demais são eliminatórias. Realizado privativamente pela Academia (pode terceirizar).',
      'Nível superior: Delegado = Direito; Médico-Legista = Medicina; Escrivão, Investigador e Perito = conforme o edital (art. 85).',
      'Estágio probatório (art. 87): TRÊS anos a partir da POSSE. Comissão de policiais estáveis avalia; a estabilidade é deliberada pelo Conselho Superior; o Corregedor pode impugnar a permanência a qualquer tempo (suspende o estágio) e dá parecer até 90 dias antes do fim; o ato declaratório de estabilidade é do Chefe da PCMG (art. 91).',
      'Progressão = grau seguinte no mesmo nível (1 ano no grau). Promoção = nível seguinte (2 anos no nível); por antiguidade, merecimento, ato de bravura, invalidez e post mortem; em junho e dezembro (art. 94).',
      'Promoção especial de Escrivão e Investigador (art. 96): 8 anos no mesmo nível + avaliações satisfatórias + aperfeiçoamento.',
      'Perde progressão/promoção no período quem for suspenso por 30 dias ou mais (art. 99).',
      'Aposentadoria (art. 72): homem 30 anos de contribuição com 20 de cargo policial; mulher 30/20 ou 25/25. Compulsória aos 70 (art. 71).'
    ]],
    ['Lei 5.406/1969 — regime disciplinar (arts. 142 a 205, ainda em vigor)', [
      'Ordens superiores: cumpridas prontamente salvo se MANIFESTAMENTE ilegais; responde quem ordenou, e o agente pelos excessos (art. 146).',
      'Proibições (art. 148): atividade político-partidária (salvo licenciado para interesses particulares), aceitar presentes por missão policial, quebrar sigilo que prejudique investigação, censurar autoridades na imprensa, fomentar antagonismo entre carreiras.',
      'Transgressões (art. 150): 35 incisos — ex.: faltar com a verdade, anonimato, frequentar lugares incompatíveis com o decoro, usar violência desnecessária, indicar advogado a investigado, apresentar-se embriagado, cobrar custas sem base legal.',
      'Classificação (art. 151): leves, médias e graves. Sempre grave a infamante, ofensiva à dignidade policial, atentatória às instituições, deliberada contra o serviço ou contra a hierarquia (art. 152, §2º).',
      'Causas JUSTIFICATIVAS (art. 153, §1º) — excluem a punição (§4º): ignorância comprovada; FORÇA MAIOR comprovada; ação meritória no interesse do serviço; obediência a ordem superior; legítima defesa; uso imperativo de meios violentos para compelir subordinado em perigo/calamidade.',
      'ATENUANTES (§2º): bom comportamento, serviços relevantes, falta de prática, defesa própria ou de direitos, EVITAR MAL MAIOR, participação de somenos importância, ignorância aceitável, reparar o dano, CONFISSÃO espontânea.',
      'AGRAVANTES (§3º): reincidência, mau comportamento, concurso de transgressões ou de agentes, abuso de autoridade, premeditação, presença de subordinados, lugar público, dificultar a apuração.',
      'Penas (art. 154): repreensão, suspensão, multa, demissão, demissão a bem do serviço público e cassação de aposentadoria ou disponibilidade — sem sequência obrigatória.',
      'Suspensão: até NOVENTA dias, por falta grave ou reincidência; pode ser convertida em multa de 50% por dia, ficando o servidor em serviço (art. 156).',
      'DEMISSÃO (art. 158): abandono de cargo (mais de 30 dias CONSECUTIVOS); procedimento irregular grave; ineficiência (se impossível readaptar); aplicação indevida de dinheiro público; ausência sem justa causa por mais de QUARENTA E CINCO dias INTERPOLADOS em um ano; atividade remunerada durante licença para tratamento de saúde.',
      'DEMISSÃO A BEM DO SERVIÇO PÚBLICO (art. 159): embriaguez habitual/drogas, crime contra a administração, revelar segredo dolosamente, insubordinação grave, ofensa física em serviço (salvo legítima defesa), receber propina, advocacia administrativa, contumácia em transgressões, usura, greve/sabotagem.',
      'Competência (art. 161, texto original): Governador em qualquer caso; Corregedor-Geral até suspensão de 30 dias; Delegados de carreira até 5 dias (limitado aos subordinados). Hoje a LC 129 atribui ao Chefe da PCMG e ao Corregedor-Geral a instauração de PAD e a aplicação de sanções.',
      'PAD obrigatório quando couber demissão (art. 166); sindicância quando faltarem elementos. "Verdade sabida" (art. 167): conhecimento pessoal e direto da falta pela autoridade.',
      'Prazos do PAD: início em 8 dias da portaria; conclusão em 60 dias da citação; julgamento em 30 dias, prorrogáveis por igual período; publicação em 8 dias; não fica sobrestado aguardando ação penal (arts. 178, 188, 189, 191, 192).',
      'REVISÃO (arts. 195 a 204 — caiu em 2025): a qualquer tempo; não agrava a pena; cabe quando a decisão contraria lei expressa ou a evidência dos autos, se funda em prova falsa, ou surgem novas provas de inocência; simples alegação de injustiça não basta; pedida pelo punido, procurador ou, se morto, cônjuge, ascendente, descendente ou irmão; quem integrou a comissão do PAD fica impedido; procedente → redução ou cancelamento da pena.'
    ]]
  ];
  if (baseCF) R.lo.push(baseCF);
  [
    ['lo', 'Nos termos da LC 129/2013, o Chefe da PCMG é nomeado pelo Governador do Estado dentre integrantes, em atividade, do nível final da carreira de Delegado de Polícia que possuam, no mínimo,', ['dez anos de efetivo serviço policial.', 'quinze anos de efetivo serviço policial.', 'vinte anos de efetivo serviço policial.', 'vinte e cinco anos de efetivo serviço policial.', 'trinta anos de serviço público.'], 2, 'Art. 18, parágrafo único. Diretores de Superintendências e da Academia: quinze anos (art. 17, §8º).'],
    ['lo', 'De acordo com a LC 129/2013, são atividades PRIVATIVAS da PCMG:', ['o policiamento ostensivo e a segurança de presídios.', 'a polícia técnico-científica, o processamento e arquivo de identificação civil e criminal, o registro e licenciamento de veículo automotor e a habilitação de condutor.', 'a apuração de infrações penais militares.', 'a fiscalização de trânsito nas rodovias estaduais.', 'a execução das penas privativas de liberdade.'], 1, 'Art. 14, parágrafo único.'],
    ['lo', 'Segundo a LC 129/2013, o estágio probatório do policial civil tem duração de', ['dois anos, contados da nomeação.', 'três anos, contados do ato da posse.', 'três anos, contados do início do curso de formação.', 'dois anos, contados da posse.', 'quatro anos, contados da nomeação.'], 1, 'Art. 87. A estabilidade é deliberada pelo Conselho Superior (art. 88, §2º) e declarada pelo Chefe da PCMG (art. 91).'],
    ['lo', 'Investigador da PCMG pretende remoção de um município para outro, a pedido. Segundo a LC 129/2013, essa remoção', ['independe de vaga e gera ajuda de custo.', 'depende de prévio edital e de vaga, e não gera direito a auxílio ou indenização.', 'gera ajuda de custo no valor de um mês de vencimento.', 'é vedada durante os dois primeiros anos de exercício.', 'depende de deliberação do Governador.'], 1, 'Art. 52, caput, I, e §1º. Ajuda de custo só na remoção ex officio (art. 49, I).'],
    ['lo', 'Considerando a Lei 5.406/1969, constitui causa JUSTIFICATIVA da transgressão disciplinar, que afasta a punição:', ['ter o transgressor bom comportamento anterior.', 'ter sido a transgressão cometida em obediência a ordem superior.', 'ter o transgressor confessado espontaneamente a falta.', 'ter o transgressor reparado o dano antes da pena.', 'ter sido de somenos importância a participação do indiciado.'], 1, 'Art. 153, §1º, IV. As demais são atenuantes (§2º).'],
    ['lo', 'Segundo a Lei 5.406/1969, considera-se abandono de cargo, punível com demissão, o não comparecimento do servidor ao serviço por mais de', ['quinze dias consecutivos.', 'trinta dias consecutivos.', 'quarenta e cinco dias interpolados.', 'sessenta dias interpolados.', 'noventa dias consecutivos.'], 1, 'Art. 158, §1º. Mais de 45 dias INTERPOLADOS em um ano também gera demissão (art. 158, V), mas é hipótese diferente.'],
    ['lo', 'Policial civil de MG, sem justificativa, recebeu propina em razão de missão policial. Segundo a Lei 5.406/1969, a pena cabível é', ['suspensão de até noventa dias.', 'demissão.', 'demissão a bem do serviço público.', 'repreensão por escrito.', 'multa, convertida da suspensão.'], 2, 'Art. 159, VII.'],
    ['lo', 'Pela LC 129/2013, o policial civil preso provisoriamente pela prática de infração penal', ['é demitido sumariamente.', 'é afastado do exercício das funções, sem prejuízo da remuneração, até decisão final transitada em julgado.', 'é afastado com um terço da remuneração.', 'continua no exercício das funções.', 'tem a remuneração suspensa até a sentença.'], 1, 'Art. 47, caput. Um terço da remuneração só após condenação que não implique demissão, durante o cumprimento da pena (art. 47, §2º, I).']
  ].forEach((q, i) => D.questoes.push({ id: 'lo-n' + i, m: q[0], e: q[1], a: q[2], c: q[3], x: q[4] }));
  [
    ['lo', 'A PCMG subordina-se diretamente ao Governador do Estado e integra, para fins operacionais, o Sistema de Defesa Social.', 0, 'LC 129/2013, art. 15.'],
    ['lo', 'O afastamento do policial civil para frequentar curso relacionado ao cargo pode ser concedido ao servidor em estágio probatório.', 1, 'Vedado (art. 68, §1º).'],
    ['lo', 'Pela Lei 5.406/1969, a pena de suspensão não pode exceder noventa dias e pode ser convertida em multa de cinquenta por cento por dia de vencimento.', 0, 'Art. 156, caput e §2º.'],
    ['lo', 'Não há subordinação hierárquica entre o Escrivão de Polícia, o Investigador de Polícia, o Médico-Legista e o Perito Criminal.', 0, 'LC 129/2013, art. 81, §6º.']
  ].forEach((q, i) => D.questoes.push({ id: 'ce-lo' + i, m: q[0], e: q[1], a: ['Certo', 'Errado'], c: q[2], x: q[3], ce: true }));
  [
    ['lo', 'Chefe da PCMG: requisitos', 'Delegado do nível final, em atividade, 20 anos de serviço policial; nomeado pelo Governador; status de Secretário de Estado.'],
    ['lo', 'Afastamento para curso (LC 129)', '3 meses + 3; Chefe da PCMG concede; depois servir 3 anos ou ressarcir; exterior ou mais de 6 meses: Governador.'],
    ['lo', 'Ajuda de custo (LC 129)', 'Remoção EX OFFICIO ou designação que mude o domicílio: 1 mês de vencimento. A pedido não gera.'],
    ['lo', 'Demissão por faltas (Lei 5.406)', 'Abandono: + de 30 dias consecutivos. Inassiduidade: + de 45 dias interpolados em 1 ano.'],
    ['lo', 'Causa justificativa × atenuante', 'Justificativa afasta a pena (força maior, ordem superior, legítima defesa...). Atenuante só reduz (confissão, bom comportamento, evitar mal maior...).'],
    ['lo', 'Revisão do PAD (Lei 5.406)', 'A qualquer tempo; não agrava; injustiça só não basta; morto → cônjuge, ascendente, descendente ou irmão; membro da comissão do PAD impedido.'],
    ['lo', 'Por que a Lei 5.406/1969 ainda vale?', 'LC 129, art. 116, parágrafo único: arts. 142 a 205 seguem até o Estatuto Disciplinar próprio.']
  ].forEach((f, i) => D.flash.push({ id: 'flo' + i, m: f[0], f: f[1], v: f[2] }));
})();
