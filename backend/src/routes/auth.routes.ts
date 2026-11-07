import { errosDeValidacao } from "../lib/validacao";
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../lib/prisma";


export const authRoutes = Router();

// Formato esperado do corpo de cada requisição
const cadastroSchema = z.object({
  nome: z.string().trim().min(2, "Nome muito curto"),
  email: z.email("E-mail inválido"),
  senha: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
  curso: z.string().trim().optional(),
});

const loginSchema = z.object({
  email: z.email("E-mail inválido"),
  senha: z.string().min(1, "Informe a senha"),
});


// POST /auth/cadastro
authRoutes.post("/cadastro", async (req, res) => {
  const resultado = cadastroSchema.safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json(errosDeValidacao(resultado.error));
    return;
  }

  const { nome, senha, curso } = resultado.data;
  const email = resultado.data.email.toLowerCase();

  const existente = await prisma.usuario.findUnique({ where: { email } });
  if (existente) {
    res.status(409).json({ erro: "E-mail já cadastrado" });
    return;
  }

  const senhaHash = await bcrypt.hash(senha, 10);

  const usuario = await prisma.usuario.create({
    data: { nome, email, senhaHash, curso },
    select: { id: true, nome: true, email: true, curso: true, criadoEm: true },
  });

  res.status(201).json({ usuario });
});

// POST /auth/login
authRoutes.post("/login", async (req, res) => {
  const resultado = loginSchema.safeParse(req.body);
  if (!resultado.success) {
    res.status(400).json(errosDeValidacao(resultado.error));
    return;
  }

  const email = resultado.data.email.toLowerCase();
  const usuario = await prisma.usuario.findUnique({ where: { email } });

  // Mesma mensagem nos dois casos para não revelar quais e-mails existem
  const senhaConfere = usuario && (await bcrypt.compare(resultado.data.senha, usuario.senhaHash));
  if (!usuario || !senhaConfere) {
    res.status(401).json({ erro: "E-mail ou senha inválidos" });
    return;
  }

  const token = jwt.sign({}, process.env.JWT_SECRET!, {
    subject: String(usuario.id),
    expiresIn: "7d",
  });

  const { senhaHash: _, ...usuarioPublico } = usuario; // nunca devolver o hash
  res.json({ token, usuario: usuarioPublico });
});