import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { autenticar } from "../middlewares/autenticar";
import { errosDeValidacao } from "../lib/validacao";
import { agoraEmSaoPaulo, horaParaMinutos, minutosParaHora } from "../lib/horario";
import { recomendar } from "../recomendacao/motor";

export const recomendacaoRoutes = Router();

recomendacaoRoutes.use(autenticar);

// Parâmetros opcionais da URL: ?dia=1&hora=14:00&lat=...&lng=...
const consultaSchema = z.object({
  dia: z.coerce.number().int().min(0).max(6).optional(),
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use o formato HH:MM").optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
});

// GET /recomendacoes
recomendacaoRoutes.get("/", async (req, res) => {
  const consulta = consultaSchema.safeParse(req.query);
  if (!consulta.success) {
    res.status(400).json(errosDeValidacao(consulta.error));
    return;
  }

  const { dia, hora, lat, lng } = consulta.data;
  const agora = agoraEmSaoPaulo();
  const diaSemana = dia ?? agora.diaSemana;
  const agoraMin = hora ? horaParaMinutos(hora) : agora.minutos;
  const posicaoAtual =
    lat !== undefined && lng !== undefined ? { latitude: lat, longitude: lng } : null;

  const [compromissos, atividades] = await Promise.all([
    prisma.compromisso.findMany({
      where: { usuarioId: res.locals.usuarioId, diaSemana },
      include: { local: true },
    }),
    prisma.atividade.findMany({ where: { ativa: true }, include: { local: true } }),
  ]);

  const resultado = recomendar(
    agoraMin,
    posicaoAtual,
    compromissos.map((c) => ({
      titulo: c.titulo,
      inicioMin: c.inicioMin,
      fimMin: c.fimMin,
      local: c.local,
    })),
    atividades.map((a) => ({
      id: a.id,
      titulo: a.titulo,
      categoria: a.categoria,
      duracaoMin: a.duracaoMin,
      abreMin: a.abreMin,
      fechaMin: a.fechaMin,
      localNome: a.local.nome,
      local: a.local,
    })),
  );

  if (!resultado.janela) {
    res.json({
      diaSemana,
      agora: minutosParaHora(agoraMin),
      janela: null,
      mensagem: "Nenhum compromisso restante neste dia",
      recomendacoes: [],
      descartadas: [],
    });
    return;
  }

  const { janela } = resultado;

  res.json({
    diaSemana,
    agora: minutosParaHora(agoraMin),
    janela: {
      inicio: minutosParaHora(janela.inicioMin),
      fim: minutosParaHora(janela.fimMin),
      minutosLivres: janela.minutos,
      proximoCompromisso: janela.proximo.titulo,
    },
    recomendacoes: resultado.recomendacoes.map((r) => ({
      atividadeId: r.atividade.id,
      titulo: r.atividade.titulo,
      categoria: r.atividade.categoria,
      local: r.atividade.localNome,
      pontuacao: r.pontuacao,
      idaMin: r.idaMin,
      voltaMin: r.voltaMin,
      totalMin: r.totalMin,
      folgaMin: r.folgaMin,
      justificativa: r.justificativa,
    })),
    descartadas: resultado.descartadas.map((d) => ({
      titulo: d.atividade.titulo,
      motivo: d.motivo,
    })),
  });
});