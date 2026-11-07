import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { autenticar } from "../middlewares/autenticar";
import { errosDeValidacao } from "../lib/validacao";

export const usuarioRoutes = Router();

usuarioRoutes.use(autenticar);

const camposDoPerfil = {
  id: true,
  nome: true,
  email: true,
  curso: true,
  linhaId: true,
  consentiuLocalizacaoEm: true,
  criadoEm: true,
} as const;

// GET /usuarios/me — perfil de quem está logado
usuarioRoutes.get("/me", async (req, res) => {
  const usuario = await prisma.usuario.findUnique({
    where: { id: res.locals.usuarioId },
    select: camposDoPerfil,
  });

  if (!usuario) {
    res.status(404).json({ erro: "Usuário não encontrado" });
    return;
  }

  res.json({ usuario });
});

// PUT /usuarios/me/linha — define o ônibus que o aluno costuma usar (null remove)
const linhaSchema = z.object({ linhaId: z.number().int().positive().nullable() });

usuarioRoutes.put("/me/linha", async (req, res) => {
  const resultado = linhaSchema.safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json(errosDeValidacao(resultado.error));
    return;
  }

  const { linhaId } = resultado.data;

  if (linhaId) {
    const linha = await prisma.linha.findFirst({ where: { id: linhaId, ativa: true } });
    if (!linha) {
      res.status(404).json({ erro: "Linha não encontrada" });
      return;
    }
  }

  const usuario = await prisma.usuario.update({
    where: { id: res.locals.usuarioId },
    data: { linhaId },
    select: camposDoPerfil,
  });

  res.json({ usuario });
});

// POST /usuarios/me/consentimento-localizacao — registra a autorização
usuarioRoutes.post("/me/consentimento-localizacao", async (req, res) => {
  const usuario = await prisma.usuario.update({
    where: { id: res.locals.usuarioId },
    data: { consentiuLocalizacaoEm: new Date() },
    select: camposDoPerfil,
  });

  res.json({ usuario });
});

// DELETE /usuarios/me/consentimento-localizacao — revoga e encerra o compartilhamento na hora
usuarioRoutes.delete("/me/consentimento-localizacao", async (req, res) => {
  const usuarioId: number = res.locals.usuarioId;

  // As duas operações acontecem juntas ou nenhuma acontece (transação)
  await prisma.$transaction([
    prisma.viagem.updateMany({
      where: { usuarioId, encerradaEm: null },
      data: { encerradaEm: new Date() },
    }),
    prisma.usuario.update({
      where: { id: usuarioId },
      data: { consentiuLocalizacaoEm: null },
    }),
  ]);

  res.status(204).end();
});