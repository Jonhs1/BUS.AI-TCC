import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { autenticar } from "../middlewares/autenticar";
import { errosDeValidacao } from "../lib/validacao";
import { horaParaMinutos, minutosParaHora } from "../lib/horario";

export const compromissoRoutes = Router();

// Todas as rotas deste arquivo exigem login
compromissoRoutes.use(autenticar);

const horaSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use o formato HH:MM");

const compromissoSchema = z
  .object({
    titulo: z.string().trim().min(1, "Informe o título"),
    tipo: z.enum(["AULA", "OUTRO"]).default("AULA"),
    diaSemana: z.number().int().min(0).max(6), // 0 = domingo ... 6 = sábado
    inicio: horaSchema,
    fim: horaSchema,
    localId: z.number({ error: "Informe o local do compromisso" }).int().positive(),
  })
  .refine((d) => horaParaMinutos(d.fim) > horaParaMinutos(d.inicio), {
    message: "O horário de fim deve ser depois do início",
    path: ["fim"],
  });

const idSchema = z.coerce.number().int().positive();

// Formato devolvido pela API (horários em "HH:MM")
function formatar(c: {
  id: number;
  titulo: string;
  tipo: string;
  diaSemana: number;
  inicioMin: number;
  fimMin: number;
  localId: number | null;
}) {
  return {
    id: c.id,
    titulo: c.titulo,
    tipo: c.tipo,
    diaSemana: c.diaSemana,
    inicio: minutosParaHora(c.inicioMin),
    fim: minutosParaHora(c.fimMin),
    localId: c.localId,
  };
}

// Procura um compromisso do mesmo usuário, no mesmo dia, que se sobreponha ao intervalo
function buscarConflito(
  usuarioId: number,
  diaSemana: number,
  inicioMin: number,
  fimMin: number,
  ignorarId?: number,
) {
  return prisma.compromisso.findFirst({
    where: {
      usuarioId,
      diaSemana,
      inicioMin: { lt: fimMin },
      fimMin: { gt: inicioMin },
      ...(ignorarId ? { id: { not: ignorarId } } : {}),
    },
  });
}

// GET /compromissos
compromissoRoutes.get("/", async (req, res) => {
  const compromissos = await prisma.compromisso.findMany({
    where: { usuarioId: res.locals.usuarioId },
    orderBy: [{ diaSemana: "asc" }, { inicioMin: "asc" }],
  });
  res.json({ compromissos: compromissos.map(formatar) });
});

// POST /compromissos
compromissoRoutes.post("/", async (req, res) => {
  const resultado = compromissoSchema.safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json(errosDeValidacao(resultado.error));
    return;
  }

  const { titulo, tipo, diaSemana, inicio, fim, localId } = resultado.data;
  const inicioMin = horaParaMinutos(inicio);
  const fimMin = horaParaMinutos(fim);
  const usuarioId: number = res.locals.usuarioId;

  if (localId) {
    const local = await prisma.local.findUnique({ where: { id: localId } });
    if (!local) {
      res.status(400).json({ erro: "Local não encontrado" });
      return;
    }
  }

  const conflito = await buscarConflito(usuarioId, diaSemana, inicioMin, fimMin);
  if (conflito) {
    res.status(409).json({ erro: "Horário em conflito com outro compromisso", conflito: formatar(conflito) });
    return;
  }

  const criado = await prisma.compromisso.create({
    data: { titulo, tipo, diaSemana, inicioMin, fimMin, localId: localId ?? null, usuarioId },
  });

  res.status(201).json({ compromisso: formatar(criado) });
});

// PUT /compromissos/:id
compromissoRoutes.put("/:id", async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  const resultado = compromissoSchema.safeParse(req.body);
  if (!id.success) {
    res.status(400).json({ erro: "Id inválido" });
    return;
  }
  if (!resultado.success) {
    res.status(400).json(errosDeValidacao(resultado.error));
    return;
  }

  const usuarioId: number = res.locals.usuarioId;

  // Busca pelo id E pelo dono: impede alterar compromisso de outro usuário
  const existente = await prisma.compromisso.findFirst({ where: { id: id.data, usuarioId } });
  if (!existente) {
    res.status(404).json({ erro: "Compromisso não encontrado" });
    return;
  }

  const { titulo, tipo, diaSemana, inicio, fim, localId } = resultado.data;
  const inicioMin = horaParaMinutos(inicio);
  const fimMin = horaParaMinutos(fim);

  if (localId) {
    const local = await prisma.local.findUnique({ where: { id: localId } });
    if (!local) {
      res.status(400).json({ erro: "Local não encontrado" });
      return;
    }
  }

  const conflito = await buscarConflito(usuarioId, diaSemana, inicioMin, fimMin, id.data);
  if (conflito) {
    res.status(409).json({ erro: "Horário em conflito com outro compromisso", conflito: formatar(conflito) });
    return;
  }

  const atualizado = await prisma.compromisso.update({
    where: { id: id.data },
    data: { titulo, tipo, diaSemana, inicioMin, fimMin, localId: localId ?? null },
  });

  res.json({ compromisso: formatar(atualizado) });
});

// DELETE /compromissos/:id
compromissoRoutes.delete("/:id", async (req, res) => {
  const id = idSchema.safeParse(req.params.id);
  if (!id.success) {
    res.status(400).json({ erro: "Id inválido" });
    return;
  }

  const existente = await prisma.compromisso.findFirst({
    where: { id: id.data, usuarioId: res.locals.usuarioId },
  });
  if (!existente) {
    res.status(404).json({ erro: "Compromisso não encontrado" });
    return;
  }

  await prisma.compromisso.delete({ where: { id: id.data } });
  res.status(204).end();
});