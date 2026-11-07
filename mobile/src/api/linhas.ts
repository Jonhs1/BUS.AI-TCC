import { useCallback, useEffect, useState } from "react";
import { ErroApi } from "@/api/cliente";
import { useSessao } from "@/auth/sessao";

// Formato de GET /linhas (docs/API.md, seção 6)
export type Linha = {
  id: number;
  codigo: string;
  nome: string;
  cidadeOrigem: string;
  operador: "PREFEITURA" | "EMPRESA_PRIVADA" | "TRANSPORTE_URBANO";
};

export const nomeOperador: Record<Linha["operador"], string> = {
  PREFEITURA: "Prefeitura",
  EMPRESA_PRIVADA: "Empresa privada",
  TRANSPORTE_URBANO: "Transporte urbano",
};

// Busca as linhas de ônibus uma vez ao abrir a tela
export function useLinhas() {
  const { api } = useSessao();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta = await api<{ linhas: Linha[] }>("/linhas");
      setLinhas(resposta.linhas);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível carregar as linhas.");
    } finally {
      setCarregando(false);
    }
  }, [api]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return { linhas, carregando, erro, recarregar: carregar };
}
