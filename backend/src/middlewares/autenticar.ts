import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Confere o token JWT e guarda o id do usuário em res.locals.usuarioId
export function autenticar(req: Request, res: Response, next: NextFunction) {
  const cabecalho = req.headers.authorization;

  if (!cabecalho?.startsWith("Bearer ")) {
    res.status(401).json({ erro: "Token não informado" });
    return;
  }

  const token = cabecalho.slice(7); // remove o "Bearer "

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!);
    if (typeof payload === "string" || !payload.sub) throw new Error();

    res.locals.usuarioId = Number(payload.sub);
    next();
  } catch {
    res.status(401).json({ erro: "Token inválido ou expirado" });
  }
}