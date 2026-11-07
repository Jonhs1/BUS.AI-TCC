import { obterApiUrl } from "@/config";

// Erro devolvido pelo backend: sempre { "erro": "mensagem" }, às vezes com "detalhes" (ver docs/API.md)
export class ErroApi extends Error {
  constructor(
    public status: number,
    mensagem: string,
    public detalhes?: { campo: string; mensagem: string }[],
    // Resposta inteira, para erros que trazem mais dados (ex.: "conflito" no 409 de /compromissos)
    public corpo: Record<string, unknown> = {},
  ) {
    super(mensagem);
  }
}

type Opcoes = {
  metodo?: "GET" | "POST" | "PUT" | "DELETE";
  corpo?: unknown;
  token?: string | null;
};

// Todas as chamadas ao backend passam por aqui: monta a URL, envia o token
// e transforma qualquer resposta de erro em ErroApi.
export async function requisitar<T>(caminho: string, { metodo = "GET", corpo, token }: Opcoes = {}): Promise<T> {
  // Sem endereço, o fetch iria para o próprio servidor do Expo e voltaria um erro confuso
  const apiUrl = obterApiUrl();
  if (!apiUrl) {
    throw new ErroApi(0, "Endereço do servidor não configurado. Toque em “Servidor” na tela Entrar.");
  }

  let resposta: Response;
  try {
    resposta = await fetch(`${apiUrl}${caminho}`, {
      method: metodo,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    // Sem resposta: túnel desligado, endereço errado ou sem internet
    throw new ErroApi(0, "Não foi possível falar com o servidor. Verifique a internet.");
  }

  // 204 = sucesso sem corpo (ex.: DELETE)
  if (resposta.status === 204) return undefined as T;

  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    // Sem "erro" no corpo = quem respondeu não foi o backend (ex.: página de erro do túnel)
    throw new ErroApi(resposta.status, dados.erro ?? `Algo deu errado (código ${resposta.status}). Tente de novo.`, dados.detalhes, dados);
  }
  return dados as T;
}
