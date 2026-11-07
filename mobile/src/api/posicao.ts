import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ErroApi } from "@/api/cliente";
import { useSessao } from "@/auth/sessao";

// Consulta a cada 5 s, dentro da faixa de 5–10 s sugerida em docs/API.md (seção 6)
export const INTERVALO_MAPA_S = 5;

// Formato de GET /linhas/:id/posicao. É a posição ESTIMADA do ônibus, combinando os celulares
// dos alunos; a API nunca devolve a posição individual de ninguém.
export type PosicaoOnibus = {
  latitude: number;
  longitude: number;
  precisaoEstimadaM: number; // raio do círculo de incerteza
  dispositivosUsados: number; // quantos celulares entraram na estimativa
  dispositivosDescartados: { motivo: "PRECISAO_RUIM" | "OUTLIER" | "DIVERGENCIA"; quantidade: number }[];
  atualizadaHaSegundos: number;
};

type Resposta = {
  linha: { id: number; nome: string };
  posicao: PosicaoOnibus | null; // null = ninguém compartilhando nos últimos 60 s
  mensagem?: string;
};

export const nomeDescarte: Record<PosicaoOnibus["dispositivosDescartados"][number]["motivo"], string> = {
  PRECISAO_RUIM: "GPS impreciso",
  OUTLIER: "posição fora do padrão",
  DIVERGENCIA: "posições divergentes",
};

// Busca a posição só enquanto a aba Mapa está aberta: ao sair da aba, para de consultar
export function usePosicaoOnibus(linhaId: number | null) {
  const { api } = useSessao();
  const [dados, setDados] = useState<Resposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [consultadoEm, setConsultadoEm] = useState<Date | null>(null);
  const emAndamento = useRef(false);

  const consultar = useCallback(async () => {
    // Com internet lenta, não empilha uma consulta em cima da outra
    if (linhaId === null || emAndamento.current) return;
    emAndamento.current = true;
    try {
      setDados(await api<Resposta>(`/linhas/${linhaId}/posicao`));
      setErro(null);
      setConsultadoEm(new Date());
    } catch (e) {
      // Mantém a última posição na tela e só avisa do problema
      setErro(e instanceof ErroApi ? e.message : "Não foi possível atualizar a posição.");
    } finally {
      emAndamento.current = false;
    }
  }, [api, linhaId]);

  useFocusEffect(
    useCallback(() => {
      consultar();
      const temporizador = setInterval(consultar, INTERVALO_MAPA_S * 1000);
      // Função de limpeza: roda quando a aba perde o foco
      return () => clearInterval(temporizador);
    }, [consultar]),
  );

  return { dados, erro, consultadoEm, atualizar: consultar };
}
