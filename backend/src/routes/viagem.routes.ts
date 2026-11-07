import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { autenticar } from "../middlewares/autenticar";
import { errosDeValidacao } from "../lib/validacao";

export const viagemRoutes = Router();

viagemRoutes.use(autenticar);

// Viagem não encerrada expira sozinha após este tempo (proteção de privacidade)
export const DURACAO_MAXIMA_VIAGEM_MIN = 180;

// Tolerância para diferença entre o relógio do celular e o do servidor
const TOLERANCIA_RELOGIO_MS = 2 * 60 * 1000;

const idSchema = z.coerce.number().int().positive();

const iniciarSchema = z.object({
  linhaId: z.number().int().positive().optional(), // se omitido, usa a linha do perfil
});

const leiturasSchema = z.object({
  leituras: z
    .array(
      z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        precisaoMetros: z.number().nonnegative().nullable().optional(),
        registradaEm: z.coerce.date(), // aceita texto ISO ou milissegundos
      }),
    )
    .min(1, "Envie pelo menos uma leitura")
    .max(100, "Envie no máximo 100 leituras por vez"),
});

function expirou(viagem: { iniciadaEm: Date }) {
  return Date.now() - viagem.iniciadaEm.getTime() > DURACAO_MAXIMA_VIAGEM_MIN * 60 * 1000;
}

// POST /viagens — "Estou no ônibus"
viagemRoutes.post("/", async (req, res) => {
  const resultado = iniciarSchema.safeParse(req.body ?? {});
  if (!resultado.success) {
    res.status(400).json(errosDeValidacao(resultado.error));
    return;
  }

  const usuarioId: number = res.locals.usuarioId;
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) {
    res.status(404).json({ erro: "Usuário não encontrado" });
    return;
  }

  if (!usuario.consentiuLocalizacaoEm) {
    res.status(403).json({ erro: "Autorize o uso da localização antes de compartilhar" });
    return;
  }

  const linhaId = resultado.data.linhaId ?? usuario.linhaId;
  if (!linhaId) {
    res.status(400).json({ erro: "Informe a linha ou defina o seu ônibus no perfil" });
    return;
  }

  const linha = await prisma.linha.findFirst({ where: { id: linhaId, ativa: true } });
  if (!linha) {
    res.status(404).json({ erro: "Linha não encontrada" });
    return;
  }

  // Garante no máximo uma viagem aberta por usuário
  await prisma.viagem.updateMany({
    where: { usuarioId, encerradaEm: null },
    data: { encerradaEm: new Date() },
  });

  const viagem = await prisma.viagem.create({ data: { usuarioId, linhaId } });
  res.status(201).json({ viagem });
});

// GET /viagens/atual — viagem em andamento (ou null)
viagemRoutes.get("/atual", async (req, res) => {
  const viagem = await prisma.viagem.findFirst({
    where: { usuarioId: res.locals.usuarioId, encerradaEm: null },
    orderBy: { iniciadaEm: "desc" },
  });

  res.json({ viagem: viagem && !expirou(viagem) ? viagem : null });
});

// POST /viagens/:id/encerrar — "Desci do ônibus"
viagemRoutes.post("/:id/encerrar", async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ erro: "Id inválido" });
    return;
  }

  const viagem = await prisma.viagem.findFirst({
    where: { id: id.data, usuarioId: res.locals.usuarioId },
  });
  if (!viagem) {
    res.status(404).json({ erro: "Viagem não encontrada" });
    return;
  }

  if (viagem.encerradaEm) {
    res.json({ viagem });
    return;
  }

  const encerrada = await prisma.viagem.update({
    where: { id: viagem.id },
    data: { encerradaEm: new Date() },
  });
  res.json({ viagem: encerrada });
});

// POST /viagens/:id/leituras — recebe posições do celular (uma ou várias)
viagemRoutes.post("/:id/leituras", async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  const resultado = leiturasSchema.safeParse(req.body);
  if (!id.success) {
    res.status(400).json({ erro: "Id inválido" });
    return;
  }
  if (!resultado.success) {
    res.status(400).json(errosDeValidacao(resultado.error));
    return;
  }

  const usuarioId: number = res.locals.usuarioId;

  // Só o dono da viagem pode enviar leituras para ela
  const viagem = await prisma.viagem.findFirst({ where: { id: id.data, usuarioId } });
  if (!viagem) {
    res.status(404).json({ erro: "Viagem não encontrada" });
    return;
  }

  if (viagem.encerradaEm) {
    res.status(409).json({ erro: "Viagem já encerrada" });
    return;
  }

  if (expirou(viagem)) {
    await prisma.viagem.update({ where: { id: viagem.id }, data: { encerradaEm: new Date() } });
    res.status(409).json({ erro: "Viagem expirada; inicie uma nova" });
    return;
  }

  // Privacidade: só aceita posições medidas DURANTE a viagem
  const inicio = viagem.iniciadaEm.getTime() - TOLERANCIA_RELOGIO_MS;
  const limite = Date.now() + TOLERANCIA_RELOGIO_MS;
  const { leituras } = resultado.data;
  const foraDoPeriodo = leituras.some(
    (l) => l.registradaEm.getTime() < inicio || l.registradaEm.getTime() > limite,
  );
  if (foraDoPeriodo) {
    res.status(400).json({ erro: "Leitura com horário fora do período da viagem" });
    return;
  }

  const { count } = await prisma.leituraLocalizacao.createMany({
    data: leituras.map((l) => ({
      latitude: l.latitude,
      longitude: l.longitude,
      precisaoMetros: l.precisaoMetros ?? null,
      registradaEm: l.registradaEm,
      usuarioId,
      linhaId: viagem.linhaId,
      viagemId: viagem.id,
    })),
  });

  res.status(201).json({ recebidas: count });
});