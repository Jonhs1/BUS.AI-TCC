import { Router } from "express";
import { prisma } from "../lib/prisma";
import { autenticar } from "../middlewares/autenticar";
import { z } from "zod";
import { estimarPosicao, JANELA_SEGUNDOS } from "../geolocalizacao/estimativa";

export const linhaRoutes = Router();

linhaRoutes.use(autenticar);

// GET /linhas — linhas ativas, para o aluno escolher a sua
linhaRoutes.get("/", async (req, res) => {
  const linhas = await prisma.linha.findMany({
    where: { ativa: true },
    orderBy: { nome: "asc" },
    select: { id: true, codigo: true, nome: true, cidadeOrigem: true, operador: true },
  });
  res.json({ linhas });
});

const idSchema = z.coerce.number().int().positive();

// GET /linhas/:id/posicao — posição estimada do ônibus agora
linhaRoutes.get("/:id/posicao", async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ erro: "Id inválido" });
    return;
  }

  const linha = await prisma.linha.findFirst({ where: { id: id.data, ativa: true } });
  if (!linha) {
    res.status(404).json({ erro: "Linha não encontrada" });
    return;
  }

  const agoraMs = Date.now();

  // Só leituras recentes de viagens que ainda estão em andamento
  const leituras = await prisma.leituraLocalizacao.findMany({
    where: {
      linhaId: linha.id,
      registradaEm: { gte: new Date(agoraMs - JANELA_SEGUNDOS * 1000) },
      viagem: { encerradaEm: null },
    },
  });

  const estimativa = estimarPosicao(
    leituras.map((l) => ({
      dispositivoId: l.usuarioId,
      latitude: l.latitude,
      longitude: l.longitude,
      precisaoMetros: l.precisaoMetros,
      registradaEmMs: l.registradaEm.getTime(),
    })),
    agoraMs,
  );

  if (!estimativa) {
    res.json({
      linha: { id: linha.id, nome: linha.nome },
      posicao: null,
      mensagem: "Nenhum aluno compartilhando a localização deste ônibus agora",
    });
    return;
  }

  // Privacidade: devolve só a posição combinada, nunca a posição ou o id de cada aluno
  res.json({
    linha: { id: linha.id, nome: linha.nome },
    posicao: {
      latitude: estimativa.latitude,
      longitude: estimativa.longitude,
      precisaoEstimadaM: estimativa.precisaoEstimadaM,
      dispositivosUsados: estimativa.dispositivosUsados,
      dispositivosDescartados: estimativa.dispositivosDescartados,
      atualizadaHaSegundos: Math.max(0, Math.round((agoraMs - estimativa.leituraMaisRecenteMs) / 1000)),
    },
  });
});