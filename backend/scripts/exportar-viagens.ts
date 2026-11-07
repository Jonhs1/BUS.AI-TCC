// EXPORTAÇÃO das leituras de um teste de campo, direto do banco (sem precisar do psql).
// Gera o CSV no formato que o scripts/analisar-campo.ts espera.
//
// Uso (na pasta backend, com o PostgreSQL ligado):
//
//   1. Ver as viagens de um dia (data no horário de Brasília):
//        npx tsx scripts/exportar-viagens.ts --listar=2026-11-04
//
//   2. Exportar as viagens escolhidas (ids separados por vírgula):
//        npx tsx scripts/exportar-viagens.ts --viagens=94,95,96
//
// Privacidade: o CSV não leva e-mails. Cada aparelho aparece como "usuario-<id>";
// a correspondência com as contas é mostrada só no terminal, para preencher o registro dos aparelhos.

// Precisa ser o PRIMEIRO import: carrega o DATABASE_URL do .env
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { prisma } from "../src/lib/prisma";

function argumento(nome: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${nome}=`))?.split("=")[1];
}

// O banco guarda em UTC; Brasília é UTC-3 (sem horário de verão)
const emBrasilia = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

async function listar(data: string) {
  // Um dia inteiro em Brasília vai das 03:00 UTC deste dia às 03:00 UTC do dia seguinte.
  // Assim uma viagem às 22:30 de Brasília (01:30 UTC do dia seguinte) não fica de fora.
  const inicio = new Date(`${data}T00:00:00-03:00`);
  if (Number.isNaN(inicio.getTime())) throw new Error(`Data inválida: "${data}" (use AAAA-MM-DD)`);
  const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);

  const viagens = await prisma.viagem.findMany({
    where: { iniciadaEm: { gte: inicio, lt: fim } },
    include: { usuario: { select: { email: true } }, linha: { select: { codigo: true } }, _count: { select: { leituras: true } } },
    orderBy: { iniciadaEm: "asc" },
  });

  if (viagens.length === 0) {
    console.log(`Nenhuma viagem iniciada em ${data} (horário de Brasília).`);
    return;
  }

  console.log(`\nViagens iniciadas em ${data} (horário de Brasília):\n`);
  console.table(
    viagens.map((v) => ({
      viagem: v.id,
      conta: v.usuario.email,
      linha: v.linha.codigo,
      inicio: emBrasilia(v.iniciadaEm),
      fim: v.encerradaEm ? emBrasilia(v.encerradaEm) : "não encerrada",
      leituras: v._count.leituras,
    })),
  );
  console.log("Para exportar, use: npx tsx scripts/exportar-viagens.ts --viagens=ID1,ID2,...\n");
}

async function exportar(ids: number[]) {
  const viagens = await prisma.viagem.findMany({
    where: { id: { in: ids } },
    include: { usuario: { select: { id: true, email: true } } },
  });
  const faltando = ids.filter((id) => !viagens.some((v) => v.id === id));
  if (faltando.length > 0) throw new Error(`Viagem(ns) não encontrada(s): ${faltando.join(", ")}`);

  const leituras = await prisma.leituraLocalizacao.findMany({
    where: { viagemId: { in: ids } },
    orderBy: { registradaEm: "asc" },
  });
  if (leituras.length === 0) throw new Error("Essas viagens não têm nenhuma leitura.");

  // Mesmo cabeçalho do CSV do protocolo; a coluna "email" leva um identificador sem dado pessoal
  const linhas = ["id,email,viagemId,latitude,longitude,precisaoMetros,registradaEm,recebidaEm"];
  for (const l of leituras) {
    linhas.push(
      [
        l.id,
        `usuario-${l.usuarioId}`,
        l.viagemId,
        l.latitude,
        l.longitude,
        l.precisaoMetros ?? "",
        l.registradaEm.toISOString(),
        l.recebidaEm.toISOString(),
      ].join(","),
    );
  }

  const dia = new Date(leituras[0].registradaEm).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const arquivo = argumento("saida") ?? `scripts/resultados/campo-${dia}-viagens-${ids.join("-")}.csv`;
  mkdirSync("scripts/resultados", { recursive: true });
  writeFileSync(arquivo, linhas.join("\n"), "utf8");

  console.log(`\n${leituras.length} leituras exportadas para ${arquivo}\n`);
  console.log("Correspondência (anote no registro dos aparelhos; NÃO vai para o CSV):");
  console.table(
    viagens.map((v) => ({
      viagem: v.id,
      identificador: `usuario-${v.usuario.id}`,
      conta: v.usuario.email,
      leituras: leituras.filter((l) => l.viagemId === v.id).length,
    })),
  );
  console.log(`Próximo passo: npx tsx scripts/analisar-campo.ts --leituras=${arquivo}\n`);
}

async function main() {
  const dataParaListar = argumento("listar");
  const viagens = argumento("viagens");

  if (dataParaListar) return listar(dataParaListar);
  if (viagens) {
    const ids = viagens.split(",").map((v) => Number(v.trim()));
    if (ids.some((id) => !Number.isInteger(id) || id <= 0)) throw new Error(`Ids inválidos: "${viagens}"`);
    return exportar(ids);
  }
  console.log("Use --listar=AAAA-MM-DD para ver as viagens do dia, ou --viagens=ID1,ID2 para exportar.");
}

main()
  .catch((erro) => {
    console.error(erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
