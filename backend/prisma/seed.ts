import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { horaParaMinutos } from "../src/lib/horario";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

type Categoria = "ESTUDO" | "BIBLIOTECA" | "ALIMENTACAO" | "SECRETARIA" | "OUTRO";

// Cria o local, ou atualiza se já existir um com o mesmo nome
async function garantirLocal(dados: {
  nome: string;
  descricao: string;
  latitude: number;
  longitude: number;
}) {
  const existente = await prisma.local.findFirst({ where: { nome: dados.nome } });
  if (existente) return prisma.local.update({ where: { id: existente.id }, data: dados });
  return prisma.local.create({ data: dados });
}

// Cria a atividade, ou atualiza se já existir uma com o mesmo título no mesmo local
async function garantirAtividade(dados: {
  titulo: string;
  categoria: Categoria;
  duracaoMin: number;
  abreMin: number | null;
  fechaMin: number | null;
  localId: number;
}) {
  const existente = await prisma.atividade.findFirst({
    where: { titulo: dados.titulo, localId: dados.localId },
  });
  if (existente) return prisma.atividade.update({ where: { id: existente.id }, data: dados });
  return prisma.atividade.create({ data: dados });
}

async function main() {
  // Coordenadas reais coletadas no Google Maps pela equipe
  const unidade5 = await garantirLocal({
    nome: "UEMG Unidade 5",
    descricao: "Prédio das aulas",
    latitude: -20.734877429956306,
    longitude: -46.62568049632971,
  });
  const biblioteca = await garantirLocal({
    nome: "Biblioteca UEMG Unidade 5",
    descricao: "Biblioteca da unidade",
    latitude: -20.73525500686421,
    longitude: -46.625466227646854,
  });
  const lanchonete = await garantirLocal({
    nome: "Lanchonete",
    descricao: "Lanchonete próxima à Unidade 5",
    latitude: -20.733746237624924,
    longitude: -46.62537052215952,
  });
  const secretaria = await garantirLocal({
    nome: "Secretaria Geral UEMG",
    descricao: "Secretaria acadêmica (fica em outro endereço)",
    latitude: -20.73374934823229,
    longitude: -46.60491171583834,
  });
  const embarque = await garantirLocal({
    nome: "Ponto de embarque dos ônibus",
    descricao: "Rua onde os alunos embarcam e desembarcam",
    latitude: -20.733398829934966,
    longitude: -46.62616344943692,
  });

  // PENDENTE: confirmar horários de funcionamento (null = sem restrição)
  // Durações: estimativas definidas pela equipe
  await garantirAtividade({
    titulo: "Estudar na biblioteca",
    categoria: "ESTUDO",
    duracaoMin: 45,
    abreMin: horaParaMinutos("07:00"),
    fechaMin: horaParaMinutos("22:30"),
    localId: biblioteca.id,
  });
  await garantirAtividade({
    titulo: "Retirar ou devolver livro",
    categoria: "BIBLIOTECA",
    duracaoMin: 10,
    abreMin: horaParaMinutos("07:00"),
    fechaMin: horaParaMinutos("22:30"),
    localId: biblioteca.id,
  });
  await garantirAtividade({
    titulo: "Fazer um lanche",
    categoria: "ALIMENTACAO",
    duracaoMin: 20,
    abreMin: horaParaMinutos("08:00"),
    fechaMin: horaParaMinutos("22:30"),
    localId: lanchonete.id,
  });
  await garantirAtividade({
    titulo: "Resolver pendências na Secretaria Geral",
    categoria: "SECRETARIA",
    duracaoMin: 20,
    abreMin: horaParaMinutos("07:00"),
    fechaMin: horaParaMinutos("17:00"),
    localId: secretaria.id,
  });

    // Linhas de ônibus (dados informados pela equipe)
  const linhas: {
    codigo: string;
    nome: string;
    cidadeOrigem: string;
    operador: "PREFEITURA" | "EMPRESA_PRIVADA" | "TRANSPORTE_URBANO";
  }[] = [
    {
      codigo: "BJP-UEMG", // ex.: sigla da cidade + UEMG
      nome: "Ônibus Prefeitura de Bom Jesus da Penha → UEMG",
      cidadeOrigem: "Bom Jesus da Penha",
      operador: "PREFEITURA",
    },
    {
      codigo: "ALP-UEMG", // ex.: sigla da cidade + UEMG
      nome: "Ônibus Ventania → UEMG",
      cidadeOrigem: "Alpinópolis",
      operador: "EMPRESA_PRIVADA",
    },
    {
      codigo: "PASSOS-UEMG", // ex.: sigla da cidade + UEMG
      nome: "Ônibus Público → UEMG",
      cidadeOrigem: "Passos",
      operador: "TRANSPORTE_URBANO",
    },
  ];

  for (const linha of linhas) {
    await prisma.linha.upsert({ where: { codigo: linha.codigo }, update: linha, create: linha });
  }

  console.log("Seed concluído. IDs dos locais:");
  console.table([unidade5, biblioteca, lanchonete, secretaria, embarque].map((l) => ({ id: l.id, nome: l.nome })));
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());