import type { TestMatrix } from "@prisma/client";

// Textos padrão administráveis da proposta (item 35-36 do requisito).
// Conteúdo transcrito literalmente da especificação fornecida — não deve
// ser alterado aqui. É usado apenas para popular ProposalTextTemplate na
// primeira execução; depois disso, a fonte da verdade passa a ser o banco
// (editável via painel administrativo), preservando o valor atual em
// reexecuções (upsert só cria, nunca sobrescreve edições já feitas).
export interface ProposalTextDefault {
  category:
    | "FORMA_PAGAMENTO_30"
    | "FORMA_PAGAMENTO_15_30"
    | "DECLARACAO_CONFORMIDADE"
    | "VALIDADE_PROPOSTA"
    | "PRAZO_ENTREGA_RELATORIO"
    | "OBSERVACAO_IMPORTANTE"
    | "PROTECAO_PROPRIEDADE_CLIENTE"
    | "CONFIRMACAO_PROPOSTA"
    | "OUTRAS_INFORMACOES";
  name: string;
  matrix: TestMatrix | null;
  order: number;
  content: string;
}

export const PROPOSAL_TEXT_DEFAULTS: ProposalTextDefault[] = [
  {
    category: "FORMA_PAGAMENTO_30",
    name: "Pagamento — 30 dias",
    matrix: null,
    order: 0,
    content:
      "O pagamento será realizado mediante Nota Fiscal com envio de boleto bancário, para 30 dias emitidos assim que for finalizado os trabalhos de campo",
  },
  {
    category: "FORMA_PAGAMENTO_15_30",
    name: "Pagamento — 15/30 dias",
    matrix: null,
    order: 1,
    content:
      "O pagamento será realizado mediante Nota Fiscal com boleto bancário, para 15 dias e o restante para 30 dias, emitido assim que o trabalho for realizado ou a combinar",
  },
  {
    category: "DECLARACAO_CONFORMIDADE",
    name: "Declaração da Conformidade e Regra de Decisão",
    matrix: null,
    order: 0,
    content:
      "O laboratório tem como padrão em NÃO emitir a declaração de conformidade em relatórios com o símbolo da CGCRE. Será emitido a declaração de conformidade quando o cliente solicitar formalmente, a regra de decisão adotada será somar o resultado à incerteza de medição para posterior comparação com os limites da legislação vigente.\n• Risco Associado: Esta regra elimina o risco de aceitar um resultado falso perante o órgão ambiental (PFA < 2,5%, baseada em distribuição normal com 95% de confiança). Contudo, ela aumenta o risco de reprovar sua amostra caso o valor bruto com a incerteza ultrapasse o limite legal.",
  },
  {
    category: "VALIDADE_PROPOSTA",
    name: "Validade da Proposta",
    matrix: null,
    order: 0,
    content:
      "Validade desta proposta é de 20 (vinte) dias contados a partir da presente data ou a partir da data de alteração da proposta acordada entre cliente e AirTech Emissões Atmosféricas Ltda.",
  },
  {
    category: "PRAZO_ENTREGA_RELATORIO",
    name: "Prazo de Entrega do Relatório",
    matrix: null,
    order: 0,
    content:
      "- Será enviado para o e-mail do solicitante no prazo de 20 dias uteis após o encerramento das coletas de campo um relatório com ART. - Será disponibilizada a cópia impressa via solicitação no e-mail: airtech@labairtech.com, juntamente com os dados de envio",
  },
  {
    category: "OBSERVACAO_IMPORTANTE",
    name: "Emissões Atmosféricas em Duto ou Chaminé",
    matrix: "EMISSOES_ATMOSFERICAS",
    order: 0,
    content:
      "CONTRATANTE\n• Para a realização dos ensaios das emissões atmosféricas em Dutos ou chaminé o equipamento deverá estar operando com pelo menos 90% da sua capacidade nominal, ou com a capacidade licenciada na data de amostragem.\n• O Duto ou chaminé deverá dispor furações no corpo da chaminé para a realização da amostragem, caso a empresa nunca tenha realizado estes serviços, favor entrar em contato com a AirTech Emissões Atmosféricas Ltda para que possamos avaliar e orientar na realização conforme estabelece a Norma Técnica da CETESB L9.221.\n• Disponibilizar acesso seguro aos furos com plataforma fixa, andaime, plataforma elevatória ou caminhão muck com o cesto de pelo menos 1,00 por 1,00 m.\n• Caso o acesso seja pelo telhado a contratante deve disponibilizar tabuas para que possamos se deslocar com segurança no local de amostragem.\n• Dispor de pontos de energia elétrica 220 V, para a realização dos serviços contratados.\n• Disponibilizar pessoal responsável para auxiliar a equipe técnica de amostragem no registro de dados referente ao processo.\n• Comunicar a equipe técnica de amostragem sobre qualquer parada planejada ou acidental do processo, para que a amostragem seja devidamente planejada e/ou interrompida.\n\nCONTRATADA\n• A AirTech Emissões Atmosféricas Ltda disponibiliza uma visita técnica e material de orientação para a realização dos furos e plataforma, conforme estabelecido na CETESB L9.221.\n• Será realizado o registro fotográfico do ponto de coleta.\n• Será emitido uma ART.\n• Disponibiliza de extensão elétrica de 30 mts para conectar a rede elétrica, bem com adaptador para conexão elétrica industrial do tipo 2p+t16.\n• Disponibiliza fita zebrada para isolar a área da amostragem de chaminé.\n• Caso ocorra de chover no início da amostragem e impossibilite a sua realização o serviço será cancelado e reagendado para uma nova data sem custos adicionais.\n• Caso ocorra de chover durante a terceira amostragem e impossibilite a sua realização o serviço será considerado concretizado com as duas amostragens validas conforme a CONAMA e ABNT.",
  },
  {
    category: "OBSERVACAO_IMPORTANTE",
    name: "Monitoramento da Qualidade do Ar",
    matrix: "QUALIDADE_AR",
    order: 1,
    content:
      "CONTRATANTE\n• O ponto a ser monitorado deve se dispor de energia elétrica 220 V para a realização dos serviços contratados.\n• Caso ocorra a retirada dos equipamentos da rede elétrica os trabalhos serão mantidos e será relatado no relatório.\n• Caso no dia agendado houver uma incidência de chuva a AirTech Emissões Atmosféricas Ltda entrará em contato com a contratada pelo menos 24h antes solicitando a continuidade ou não dos trabalhos.\n• Caso ocorra chuva após a instalação dos equipamentos ou durante os monitoramentos os trabalhos serão considerados validos.\n• A segurança e responsabilidade dos equipamentos nos pontos monitorados é da contratada. (Este item é avaliado pelo técnico da AirTech Emissões Atmosféricas Ltda e e informado ao responsável da empresa).\n\nCONTRATADA\n• O ponto deve ficar a pelo menos 20 metros de distância de qualquer obstáculo (arvores, prédios, casas etc.) que possam influenciar no monitoramento.\n• O ponto deve ficar na área de maior predominância dos ventos conforme o estudo.\n• Caso houver mais de um parâmetro a ser analisado os amostradores devem ficar a uma distância um do outro de pelo menos 1,5m.\n• A base superior do amostrador deve ficar a pelo menos 2m do nível do solo.\n• Será realizado o registro fotográfico do ponto bem como as coordenadas geográficas para serem anexadas ao relatório.\n• Equipamentos utilizados na coleta serão os Amostrador de Grande Volume(AGV).\n• Profissional que estará executando a atividade será um Técnico em química ou Engenheiro Químico.\n• Será emitido uma ART.\n• O trabalho será realizado durante 24h por dia (a quantidade de dias está descrita no item 1 da proposta).",
  },
  {
    category: "OBSERVACAO_IMPORTANTE",
    name: "Avaliação de Pressão Sonora (Ruído)",
    matrix: "RUIDO_AMBIENTAL",
    order: 2,
    content:
      "CONTRATANTE\n• Para a realização da avaliação da pressão sonora (ruído) a empresa deverá estar operando com pelo menos 90% da sua capacidade nominal, ou com a capacidade licenciada na data em que foi agendada.\n• Para a realização da avaliação da pressão sonora de fundo a empresa deverá estar totalmente parada.\n• A distribuição se dá no entorno do empreendimento preferencialmente nas residências próximas ao empreendimento quando houver.\n• A empresa deve disponibilizar pessoal responsável para que o técnico avaliador possa obter informações sobre o processo.\n• Caso houver a avaliação de pressão sonora no período noturno a empresa deverá disponibilizar uma lista com os equipamentos que funcionam neste período caso seja diferente do período diurno.\n• Comunicar o pessoal nas áreas a serem monitoradas para não haver ruídos intrusivos que possam prejudicar a avaliação.\n\nCONTRATADA\n• Tempo por ponto é de 5 min.\n• O equipamento faz registros a cada 1 s.\n• Será emitido uma ART.\n• O equipamento fica suspenso em um tripé a cerca de 1,5m de altura e pelo menos a 2m de distância de qualquer superfície refletora como paredes.\n• Será realizado o registro fotográfico de cada ponto bem como as coordenadas geográficas para serem anexadas ao relatório.\n• Caso ocorra de chover no início da avaliação e impossibilite a sua realização o serviço será cancelado e reagendado para uma nova data sem custos adicionais.",
  },
  {
    category: "PROTECAO_PROPRIEDADE_CLIENTE",
    name: "Proteção da Propriedade do Cliente",
    matrix: null,
    order: 0,
    content:
      "Todos os documentos e registros obtidos na realização dos serviços e ensaio serão mantidos armazenados e seguro sob nossa custódia. Nenhuma informação será divulgada a terceiros sem autorização prévia por escrito, exceto por obrigação legal, hipótese em que o cliente será previamente notificado.",
  },
  {
    category: "CONFIRMACAO_PROPOSTA",
    name: "Confirmação da Proposta / Dúvidas",
    matrix: null,
    order: 0,
    content:
      "- Solicitação de visita técnica e agendamentos devem ser solicitados por e-mail: airtech@labairtech.com ou no WhatsApp (48)99940-0405.\n- O aceite da proposta deve ser realizado assinando o final da proposta e enviar para o e-mail airtech@labairtech.com ou pelo WhatsApp (48)9 9940-0405.",
  },
  {
    category: "OUTRAS_INFORMACOES",
    name: "Outras Informações",
    matrix: null,
    order: 0,
    content:
      "- Caso a contratante não consiga realizar as adaptações na chaminé para data prevista de realização dos trabalhos informar a AirTech Emissões atmosféricas Ltda com pelo menos 48h antecedência pelo WhatsApp (48)9 9940-0405 ou no e-mail: airtech@labairtech.com.\n- Caso ocorrer algum contratempo para o não funcionamento da empresa no dia da avaliação informar a AirTech Emissões Atmosféricas Ltda o mais breve possível pelo WhatsApp (48)9 9940-0405 ou no e-mail: airtech@labairtech.com.\n- Todos os custos de deslocamento, alimentação e hospedagem estão inclusos no valor proposto.",
  },
];
