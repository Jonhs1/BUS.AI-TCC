import type { z } from "zod";

// Transforma os erros do Zod em uma lista simples: campo + mensagem
export function errosDeValidacao(erro: z.ZodError) {
  return {
    erro: "Dados inválidos",
    detalhes: erro.issues.map((i) => ({ campo: i.path.join("."), mensagem: i.message })),
  };
}