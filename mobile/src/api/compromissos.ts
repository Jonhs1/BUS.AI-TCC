import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ErroApi } from "@/api/cliente";
import { useSessao } from "@/auth/sessao";

// Formato de GET /compromissos (docs/API.md, seção 4)
export type Compromisso = {
  id: number;
  titulo: string;
  tipo: "AULA" | "OUTRO";
  diaSemana: number; // 0 = domingo ... 6 = sábado
  inicio: string; // "HH:MM"
  fim: string;
  localId: number | null;
};

export type DadosCompromisso = Omit<Compromisso, "id">;

// O backend ainda não tem rota para listar locais. A documentação manda usar
// o id da "UEMG Unidade 5" (hoje 1) nas aulas; se mudar no seed, troque aqui.
export const LOCAL_UEMG_ID = 1;

export const diasCurtos = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const diasLongos = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];

export function paraMinutos(hora: string) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

// Busca os compromissos toda vez que a tela volta a aparecer (ex.: depois de salvar uma aula)
export function useCompromissos() {
  const { api } = useSessao();
  const [compromissos, setCompromissos] = useState<Compromisso[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const resposta = await api<{ compromissos: Compromisso[] }>("/compromissos");
      setCompromissos(resposta.compromissos);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : "Não foi possível carregar seus horários.");
    } finally {
      setCarregando(false);
    }
  }, [api]);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  return { compromissos, carregando, erro, recarregar: carregar };
}
