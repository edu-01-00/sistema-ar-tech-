/* eslint-disable no-console */
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { PERMISSIONS } from "../src/lib/permissions";
import { generateParameterCode } from "../src/lib/services/test-service";
import { generateEpiOrderCode } from "../src/lib/services/epi-service";
import { createProposal, changeProposalStatus, recalculateProposalTotals } from "../src/lib/services/proposal-service";
import { getStorageDriver } from "../src/lib/storage";
import { renderHtmlToPdf } from "../src/lib/pdf/render";
import { buildEpiOrderHtml } from "../src/lib/pdf/epi-order-template";

function computeCnpjCheckDigits(base12: string): string {
  const calc = (base: string, weights: number[]) => {
    const sum = base.split("").reduce((acc, d, i) => acc + Number(d) * weights[i], 0);
    const rem = sum % 11;
    return rem < 2 ? 0 : 11 - rem;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d1 = calc(base12, w1);
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const d2 = calc(base12 + d1, w2);
  return `${base12}${d1}${d2}`;
}

function computeCpfCheckDigits(base9: string): string {
  const calc = (base: string, factorStart: number) => {
    const sum = base.split("").reduce((acc, d, i) => acc + Number(d) * (factorStart - i), 0);
    const rem = (sum * 10) % 11;
    return rem === 10 ? 0 : rem;
  };
  const d1 = calc(base9, 10);
  const d2 = calc(base9 + d1, 11);
  return `${base9}${d1}${d2}`;
}

async function makeSamplePdf(title: string, description: string): Promise<Buffer> {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    body{font-family:Arial,sans-serif;padding:40px;color:#222}
    h1{color:#1d4ed8;border-bottom:2px solid #1d4ed8;padding-bottom:8px}
  </style></head><body><h1>${title}</h1><p>${description}</p>
  <p style="margin-top:60px;color:#888;font-size:11px">Documento fictício gerado pelo seed do sistema para fins de demonstração.</p>
  </body></html>`;
  return renderHtmlToPdf(html);
}

async function main() {
  const existingCompany = await prisma.company.findFirst();
  if (existingCompany) {
    console.log("Seed já executado anteriormente (empresa encontrada). Abortando para evitar duplicidade.");
    return;
  }

  console.log("Semeando permissões...");
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description, module: permission.module },
      create: permission,
    });
  }
  const allPermissions = await prisma.permission.findMany();

  console.log("Semeando papéis (roles)...");
  const adminRole = await prisma.role.upsert({
    where: { name: "ADMINISTRADOR" },
    update: {},
    create: { name: "ADMINISTRADOR", description: "Acesso completo ao sistema.", isSystem: true },
  });
  await prisma.rolePermission.deleteMany({ where: { roleId: adminRole.id } });
  await prisma.rolePermission.createMany({
    data: allPermissions.map((p) => ({ roleId: adminRole.id, permissionId: p.id })),
  });

  const viewerPermissionKeys: string[] = [
    "company.view",
    "employees.view",
    "tests.view",
    "legislations.view",
    "clients.view",
    "collection_points.view",
    "proposals.view",
    "proposals.manage",
  ];
  const userRole = await prisma.role.upsert({
    where: { name: "USUARIO" },
    update: {},
    create: { name: "USUARIO", description: "Acesso operacional padrão, sem áreas administrativas.", isSystem: false },
  });
  await prisma.rolePermission.deleteMany({ where: { roleId: userRole.id } });
  await prisma.rolePermission.createMany({
    data: allPermissions
      .filter((p) => viewerPermissionKeys.includes(p.key))
      .map((p) => ({ roleId: userRole.id, permissionId: p.id })),
  });

  console.log("Semeando empresa...");
  const companyCnpj = computeCnpjCheckDigits("124765890001");
  const company = await prisma.company.create({
    data: {
      name: "Ar Tech Laboratório Ambiental Ltda",
      cnpj: companyCnpj,
      email: "contato@labartech.com.br",
      addressStreet: "Rua das Indústrias",
      addressNumber: "450",
      addressDistrict: "Distrito Industrial",
      addressCity: "Curitiba",
      addressState: "PR",
      addressZipCode: "81000-000",
    },
  });

  console.log("Semeando funcionários e usuários...");
  const employeeAna = await prisma.employee.create({
    data: {
      name: "Ana Souza",
      cpf: computeCpfCheckDigits("123456789"),
      email: "ana.souza@labartech.com.br",
      phone: "(41) 99999-0001",
      position: "Coordenadora Técnica",
      hiredAt: new Date("2021-03-01"),
    },
  });
  const employeeBruno = await prisma.employee.create({
    data: {
      name: "Bruno Lima",
      cpf: computeCpfCheckDigits("987654321"),
      email: "bruno.lima@labartech.com.br",
      phone: "(41) 99999-0002",
      position: "Técnico de Campo",
      hiredAt: new Date("2022-06-15"),
    },
  });
  const employeeCarla = await prisma.employee.create({
    data: {
      name: "Carla Mendes",
      cpf: computeCpfCheckDigits("456789123"),
      email: "carla.mendes@labartech.com.br",
      phone: "(41) 99999-0003",
      position: "Assistente Administrativa",
      hiredAt: new Date("2023-01-10"),
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      name: "Ana Souza",
      email: "admin@labartech.com.br",
      passwordHash: await bcrypt.hash("Admin@123", 10),
      roleId: adminRole.id,
      employeeId: employeeAna.id,
    },
  });
  await prisma.user.create({
    data: {
      name: "Bruno Lima",
      email: "usuario@labartech.com.br",
      passwordHash: await bcrypt.hash("Usuario@123", 10),
      roleId: userRole.id,
      employeeId: employeeBruno.id,
    },
  });

  console.log("Gerando documentos fictícios...");
  const storage = getStorageDriver();

  const companyDoc1 = await makeSamplePdf("Contrato Social", "Documento fictício do contrato social da empresa.");
  const companyDocKey1 = await storage.save({ category: "company", fileName: "contrato-social.pdf", buffer: companyDoc1 });
  await prisma.companyDocument.create({
    data: { companyId: company.id, fileName: "contrato-social.pdf", storageKey: companyDocKey1, mimeType: "application/pdf", size: companyDoc1.length, uploadedById: adminUser.id },
  });

  const companyDoc2 = await makeSamplePdf("Alvará de Funcionamento", "Documento fictício do alvará de funcionamento.");
  const companyDocKey2 = await storage.save({ category: "company", fileName: "alvara-funcionamento.pdf", buffer: companyDoc2 });
  await prisma.companyDocument.create({
    data: { companyId: company.id, fileName: "alvara-funcionamento.pdf", storageKey: companyDocKey2, mimeType: "application/pdf", size: companyDoc2.length, uploadedById: adminUser.id },
  });

  const asoDoc = await makeSamplePdf("ASO - Atestado de Saúde Ocupacional", `Funcionário: ${employeeBruno.name}`);
  const asoKey = await storage.save({ category: "employees", fileName: "aso-bruno-lima.pdf", buffer: asoDoc });
  await prisma.employeeDocument.create({
    data: { employeeId: employeeBruno.id, category: "EXAME", fileName: "aso-bruno-lima.pdf", storageKey: asoKey, mimeType: "application/pdf", size: asoDoc.length, uploadedById: adminUser.id },
  });

  const admissaoDoc = await makeSamplePdf("Contrato de Admissão", `Funcionário: ${employeeCarla.name}`);
  const admissaoKey = await storage.save({ category: "employees", fileName: "contrato-admissao-carla.pdf", buffer: admissaoDoc });
  await prisma.employeeDocument.create({
    data: { employeeId: employeeCarla.id, category: "CONTRATACAO", fileName: "contrato-admissao-carla.pdf", storageKey: admissaoKey, mimeType: "application/pdf", size: admissaoDoc.length, uploadedById: adminUser.id },
  });

  console.log("Semeando catálogo de EPIs e ordem de serviço...");
  const epiOculos = await prisma.epi.create({ data: { name: "Óculos de Proteção", ca: "12345" } });
  const epiLuvas = await prisma.epi.create({ data: { name: "Luvas de Nitrila", ca: "23456" } });
  await prisma.epi.create({ data: { name: "Protetor Auricular", ca: "34567" } });
  await prisma.epi.create({ data: { name: "Máscara PFF2", ca: "45678" } });
  await prisma.epi.create({ data: { name: "Capacete de Segurança", ca: "56789" } });

  const epiOrderCode = await generateEpiOrderCode(prisma);
  const acceptedAt = new Date();
  const epiOrder = await prisma.epiOrder.create({
    data: {
      code: epiOrderCode,
      employeeId: employeeBruno.id,
      createdById: adminUser.id,
      status: "ACEITO",
      acceptedAt,
      acceptedName: employeeBruno.name,
      items: {
        create: [
          { epiId: epiOculos.id, nameSnapshot: epiOculos.name },
          { epiId: epiLuvas.id, nameSnapshot: epiLuvas.name },
        ],
      },
    },
    include: { items: true },
  });
  const epiOrderPdf = await buildEpiOrderHtml(epiOrder, employeeBruno, company);
  const epiOrderBuffer = await renderHtmlToPdf(epiOrderPdf);
  const epiOrderKey = await storage.save({ category: "epi-orders", fileName: `${epiOrderCode}.pdf`, buffer: epiOrderBuffer });
  await prisma.epiOrder.update({ where: { id: epiOrder.id }, data: { storageKey: epiOrderKey } });

  console.log("Semeando ensaios...");
  const testMpt = await prisma.test.create({
    data: {
      name: "Material Particulado Total (MPT)",
      method: "NBR 12019",
      cas: null,
      quantificationLimit: "5 mg/Nm³",
      unit: "mg/Nm³",
      value: 350,
      matrix: "EMISSOES_ATMOSFERICAS",
      parameterCode: await generateParameterCode(prisma, "EMISSOES_ATMOSFERICAS"),
    },
  });
  const testNox = await prisma.test.create({
    data: {
      name: "Óxidos de Nitrogênio (NOx)",
      method: "EPA 7E",
      quantificationLimit: "10 ppm",
      unit: "ppm",
      value: 420,
      isAccredited: true,
      matrix: "EMISSOES_ATMOSFERICAS",
      parameterCode: await generateParameterCode(prisma, "EMISSOES_ATMOSFERICAS"),
    },
  });
  const testPm10 = await prisma.test.create({
    data: {
      name: "Partículas Inaláveis (PM10)",
      method: "NBR 9547",
      quantificationLimit: "2 µg/m³",
      unit: "µg/m³",
      value: 380,
      isAccredited: true,
      matrix: "QUALIDADE_AR",
      parameterCode: await generateParameterCode(prisma, "QUALIDADE_AR"),
    },
  });
  const testSo2 = await prisma.test.create({
    data: {
      name: "Dióxido de Enxofre (SO2)",
      method: "EPA 6C",
      quantificationLimit: "1 µg/m³",
      unit: "µg/m³",
      value: 300,
      matrix: "QUALIDADE_AR",
      parameterCode: await generateParameterCode(prisma, "QUALIDADE_AR"),
    },
  });
  const testLeq = await prisma.test.create({
    data: {
      name: "Nível de Pressão Sonora Equivalente (Leq)",
      method: "NBR 10151",
      quantificationLimit: "-",
      unit: "dB(A)",
      value: 250,
      matrix: "RUIDO_AMBIENTAL",
      parameterCode: await generateParameterCode(prisma, "RUIDO_AMBIENTAL"),
    },
  });

  console.log("Semeando legislações e vínculos com ensaios...");
  const legEmissoes = await prisma.legislation.create({
    data: {
      name: "Resolução CONAMA nº 382/2006",
      description: "Limites máximos de emissão de poluentes atmosféricos para fontes fixas.",
      item: "Anexo I",
      frameworkProcess: "Licenciamento ambiental",
      allowedLimit: "Variável por poluente",
      unit: "mg/Nm³",
      legislationTests: { create: [{ testId: testMpt.id }, { testId: testNox.id }] },
    },
  });
  const legQualidadeAr = await prisma.legislation.create({
    data: {
      name: "Resolução CONAMA nº 491/2018",
      description: "Padrões de qualidade do ar.",
      item: "Art. 3º",
      frameworkProcess: "Monitoramento de qualidade do ar",
      allowedLimit: "Variável por poluente",
      unit: "µg/m³",
      legislationTests: { create: [{ testId: testPm10.id }, { testId: testSo2.id }] },
    },
  });
  const legRuido = await prisma.legislation.create({
    data: {
      name: "NBR 10151:2019",
      description: "Acústica — Medição e avaliação de níveis de pressão sonora em áreas habitadas.",
      item: "Seção 6",
      frameworkProcess: "Avaliação de ruído ambiental",
      allowedLimit: "Conforme zoneamento",
      unit: "dB(A)",
      legislationTests: { create: [{ testId: testLeq.id }] },
    },
  });

  console.log("Semeando clientes e contatos...");
  const clientA = await prisma.client.create({
    data: {
      cnpj: computeCnpjCheckDigits(`11222333${"0001"}`),
      corporateName: "Indústria Metalúrgica Sul Ltda",
      tradeName: "Metalúrgica Sul",
      email: "contato@metalurgicasul.com.br",
      phone: "(41) 3333-1000",
      addressCity: "Curitiba",
      addressState: "PR",
      contacts: {
        create: [
          { name: "Marcos Andrade", email: "marcos.andrade@metalurgicasul.com.br", role: "Gerente Ambiental" },
          { name: "Juliana Prado", email: "juliana.prado@metalurgicasul.com.br", role: "Compras" },
        ],
      },
    },
    include: { contacts: true },
  });
  const clientB = await prisma.client.create({
    data: {
      cnpj: computeCnpjCheckDigits(`22333444${"0001"}`),
      corporateName: "Agroindústria Vale Verde S.A.",
      tradeName: "Vale Verde",
      email: "contato@valeverde.com.br",
      phone: "(42) 3222-2000",
      addressCity: "Ponta Grossa",
      addressState: "PR",
      contacts: {
        create: [
          { name: "Rafael Costa", email: "rafael.costa@valeverde.com.br", role: "Gestor de SSMA" },
          { name: "Patrícia Lima", email: "patricia.lima@valeverde.com.br", role: "Financeiro" },
        ],
      },
    },
    include: { contacts: true },
  });
  const clientC = await prisma.client.create({
    data: {
      cnpj: computeCnpjCheckDigits(`33444555${"0001"}`),
      corporateName: "Mineradora Serra Azul Ltda",
      tradeName: "Serra Azul Mineração",
      email: "contato@serraazul.com.br",
      phone: "(43) 3111-3000",
      addressCity: "Londrina",
      addressState: "PR",
      contacts: {
        create: [
          { name: "Eduardo Martins", email: "eduardo.martins@serraazul.com.br", role: "Diretor Industrial" },
          { name: "Fernanda Ribeiro", email: "fernanda.ribeiro@serraazul.com.br", role: "Meio Ambiente" },
        ],
      },
    },
    include: { contacts: true },
  });

  console.log("Semeando pontos de coleta...");
  const pointAQualidadeAr = await prisma.collectionPoint.create({
    data: {
      clientId: clientA.id,
      matrix: "QUALIDADE_AR",
      name: "Ponto 01 - Entrada Fabril",
      airQualityDetail: {
        create: {
          location: "Próximo à entrada principal da fábrica",
          gpsLatitude: "-25.4284",
          gpsLongitude: "-49.2733",
          mapsLink: "https://maps.google.com/?q=-25.4284,-49.2733",
          surroundingsDescription: "Área com tráfego moderado de veículos e vegetação ao redor.",
          knownSamplingDeviation: "Nenhum desvio relevante identificado.",
        },
      },
      collectionPointTests: { create: [{ testId: testPm10.id }, { testId: testSo2.id }] },
      collectionPointLegislations: { create: [{ legislationId: legQualidadeAr.id }] },
    },
  });
  const pointAEmissoes = await prisma.collectionPoint.create({
    data: {
      clientId: clientA.id,
      matrix: "EMISSOES_ATMOSFERICAS",
      name: "Ponto 02 - Chaminé Forno 1",
      atmosphericDetail: { create: { notes: "Chaminé principal do forno de fundição nº 1." } },
      collectionPointTests: { create: [{ testId: testMpt.id }, { testId: testNox.id }] },
      collectionPointLegislations: { create: [{ legislationId: legEmissoes.id }] },
    },
  });
  const pointBRuido = await prisma.collectionPoint.create({
    data: {
      clientId: clientB.id,
      matrix: "RUIDO_AMBIENTAL",
      name: "Ponto 01 - Perímetro da Unidade",
      noiseDetail: { create: { notes: "Medição no limite do terreno, junto à via de acesso." } },
      collectionPointTests: { create: [{ testId: testLeq.id }] },
      collectionPointLegislations: { create: [{ legislationId: legRuido.id }] },
    },
  });
  const pointCQualidadeAr = await prisma.collectionPoint.create({
    data: {
      clientId: clientC.id,
      matrix: "QUALIDADE_AR",
      name: "Ponto 01 - Área de Beneficiamento",
      airQualityDetail: {
        create: {
          location: "Pátio de beneficiamento de minério",
          gpsLatitude: "-23.3103",
          gpsLongitude: "-51.1628",
          mapsLink: "https://maps.google.com/?q=-23.3103,-51.1628",
          surroundingsDescription: "Área aberta, com movimentação de máquinas pesadas.",
          knownSamplingDeviation: "Possível interferência de material particulado local.",
        },
      },
      collectionPointTests: { create: [{ testId: testPm10.id }] },
      collectionPointLegislations: { create: [{ legislationId: legQualidadeAr.id }] },
    },
  });

  console.log("Semeando textos técnicos por matriz...");
  await prisma.technicalText.create({
    data: {
      matrix: "EMISSOES_ATMOSFERICAS",
      title: "Texto Técnico - Emissões Atmosféricas",
      content:
        "A avaliação de emissões atmosféricas será realizada em conformidade com as normas técnicas vigentes, " +
        "contemplando a coleta de amostras nas fontes fixas indicadas, análise laboratorial dos parâmetros " +
        "selecionados e emissão de laudo técnico com os resultados comparados aos limites legais aplicáveis.",
    },
  });
  await prisma.technicalText.create({
    data: {
      matrix: "QUALIDADE_AR",
      title: "Texto Técnico - Qualidade do Ar",
      content:
        "O monitoramento da qualidade do ar será conduzido nos pontos de amostragem definidos em conjunto com o " +
        "cliente, considerando as condições meteorológicas e o entorno de cada ponto, com posterior emissão de " +
        "relatório técnico comparando os resultados aos padrões de qualidade do ar vigentes.",
    },
  });
  await prisma.technicalText.create({
    data: {
      matrix: "RUIDO_AMBIENTAL",
      title: "Texto Técnico - Ruído Ambiental",
      content:
        "A avaliação de ruído ambiental seguirá a metodologia da NBR 10151, com medições realizadas nos períodos " +
        "diurno e/ou noturno conforme aplicável, considerando o uso e ocupação do solo no entorno dos pontos avaliados.",
    },
  });

  console.log("Semeando propostas comerciais...");

  const proposal1 = await createProposal(adminUser.id, {
    clientId: clientA.id,
    matrices: ["QUALIDADE_AR", "EMISSOES_ATMOSFERICAS"],
    contactIds: clientA.contacts.map((c) => c.id),
  });
  await prisma.proposal.update({
    where: { id: proposal1.id },
    data: {
      collectionPoints: { create: [{ collectionPointId: pointAQualidadeAr.id }, { collectionPointId: pointAEmissoes.id }] },
      tests: {
        create: [
          { testId: testPm10.id, collectionPointId: pointAQualidadeAr.id, nameSnapshot: testPm10.name, methodSnapshot: testPm10.method, unitSnapshot: testPm10.unit, codeSnapshot: testPm10.parameterCode, valueSnapshot: testPm10.value, quantity: 2 },
          { testId: testSo2.id, collectionPointId: pointAQualidadeAr.id, nameSnapshot: testSo2.name, methodSnapshot: testSo2.method, unitSnapshot: testSo2.unit, codeSnapshot: testSo2.parameterCode, valueSnapshot: testSo2.value, quantity: 2 },
          { testId: testMpt.id, collectionPointId: pointAEmissoes.id, nameSnapshot: testMpt.name, methodSnapshot: testMpt.method, unitSnapshot: testMpt.unit, codeSnapshot: testMpt.parameterCode, valueSnapshot: testMpt.value, quantity: 1 },
        ],
      },
      costs: { create: [{ description: "ART - Anotação de Responsabilidade Técnica", value: 250, type: "ART" }] },
      travelDistanceKm: 45,
      travelValuePerKm: 3.5,
      travelOtherCosts: 80,
      paymentMethod: "A_VISTA",
      additionalInfo: "Proposta válida por 15 dias. Prazo de execução: 10 dias úteis após aprovação.",
    },
  });
  await prisma.$transaction((tx) => recalculateProposalTotals(tx, proposal1.id));
  await changeProposalStatus(adminUser.id, proposal1.id, "ENVIADA");

  const proposal2 = await createProposal(adminUser.id, {
    clientId: clientB.id,
    matrices: ["RUIDO_AMBIENTAL"],
    contactIds: [clientB.contacts[0].id],
  });
  await prisma.proposal.update({
    where: { id: proposal2.id },
    data: {
      collectionPoints: { create: [{ collectionPointId: pointBRuido.id }] },
      tests: {
        create: [
          { testId: testLeq.id, collectionPointId: pointBRuido.id, nameSnapshot: testLeq.name, methodSnapshot: testLeq.method, unitSnapshot: testLeq.unit, codeSnapshot: testLeq.parameterCode, valueSnapshot: testLeq.value, quantity: 3 },
        ],
      },
      paymentMethod: "PARCELADO",
      installments: 3,
      additionalInfo: "Medições a serem realizadas em período diurno e noturno.",
    },
  });
  await prisma.$transaction((tx) => recalculateProposalTotals(tx, proposal2.id));

  const proposal3 = await createProposal(adminUser.id, {
    clientId: clientC.id,
    matrices: ["QUALIDADE_AR"],
    contactIds: clientC.contacts.map((c) => c.id),
  });
  await prisma.proposal.update({
    where: { id: proposal3.id },
    data: {
      collectionPoints: { create: [{ collectionPointId: pointCQualidadeAr.id }] },
      tests: {
        create: [
          { testId: testPm10.id, collectionPointId: pointCQualidadeAr.id, nameSnapshot: testPm10.name, methodSnapshot: testPm10.method, unitSnapshot: testPm10.unit, codeSnapshot: testPm10.parameterCode, valueSnapshot: testPm10.value, quantity: 4 },
        ],
      },
      paymentMethod: "A_VISTA",
      additionalInfo: "Cliente solicitou urgência na emissão do laudo.",
    },
  });
  await prisma.$transaction((tx) => recalculateProposalTotals(tx, proposal3.id));
  await changeProposalStatus(adminUser.id, proposal3.id, "ENVIADA");
  await changeProposalStatus(adminUser.id, proposal3.id, "APROVADA");

  console.log("Seed concluído com sucesso.");
  console.log("Login administrador: admin@labartech.com.br / Admin@123");
  console.log("Login usuário padrão: usuario@labartech.com.br / Usuario@123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
