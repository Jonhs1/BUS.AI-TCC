// Precisa ser o PRIMEIRO import: carrega o .env antes de qualquer outro arquivo
import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import { authRoutes } from "./routes/auth.routes";
import { usuarioRoutes } from "./routes/usuario.routes";
import { compromissoRoutes } from "./routes/compromisso.routes";
import { recomendacaoRoutes } from "./routes/recomendacao.routes";
import { linhaRoutes } from "./routes/linha.routes";
import { viagemRoutes } from "./routes/viagem.routes";

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET não definido no arquivo .env");
}

const app = express();

app.use(express.json());

if (process.env.HABILITAR_COLETOR === "true") {
  app.use(express.static("public"));
  console.log("Página coletora habilitada em /coletor.html");
}

app.get("/health", (req, res) => {
  res.json({ status: "ok", servico: "BUS.AI backend" });
});

app.use("/auth", authRoutes);
app.use("/usuarios", usuarioRoutes);
app.use("/compromissos", compromissoRoutes);
app.use("/recomendacoes", recomendacaoRoutes);
app.use("/linhas", linhaRoutes);
app.use("/viagens", viagemRoutes);

// Tratamento de erros inesperados: registra no terminal e não expõe detalhes ao cliente
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({ erro: "Erro interno do servidor" });
});

const PORT = 3333;

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});