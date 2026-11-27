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
    'Adjetivo de estado (resultado de ação: "mesa arranhada") × qualidade ("homem alto") × relação ("discurso presidencial", "produto importado"). Essa questão foi anulada na PCMG 2025, mas o conceito cai em outras provas.',
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
})();
