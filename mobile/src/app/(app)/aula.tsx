import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ErroApi } from "@/api/cliente";
import {
  diasCurtos,
  diasLongos,
  LOCAL_UEMG_ID,
  paraMinutos,
  type Compromisso,
  type DadosCompromisso,
} from "@/api/compromissos";
import { useSessao } from "@/auth/sessao";
import { Botao } from "@/components/botao";
import { Campo } from "@/components/campo";
import { CampoHorario } from "@/components/campo-horario";
import { Icone } from "@/components/icone";
import { cores } from "@/theme";

type Erros = Partial<Record<"titulo" | "inicio" | "fim", string>>;
const ordemDias = [1, 2, 3, 4, 5, 6, 0];

// Adicionar (sem id) ou editar (com id) um horário. Abre por cima das abas.
export default function Aula() {
  const { id, dia } = useLocalSearchParams<{ id?: string; dia?: string }>();
  const editando = id !== undefined;
  const { api } = useSessao();
  const margens = useSafeAreaInsets();

  const [carregando, setCarregando] = useState(editando);
  const [dados, setDados] = useState<DadosCompromisso>({
    titulo: "",
    tipo: "AULA",
    diaSemana: dia ? Number(dia) : 1,
    inicio: "19:00",
    fim: "20:40",
    localId: LOCAL_UEMG_ID,
  });
  const [erros, setErros] = useState<Erros>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);

  // Editando: o backend não tem GET por id, então busca a lista e acha o compromisso
  useEffect(() => {
    if (!editando) return;
    (async () => {
      try {
        const resposta = await api<{ compromissos: Compromisso[] }>("/compromissos");
        const achado = resposta.compromissos.find((c) => c.id === Number(id));
        if (!achado) {
          Alert.alert("Horário não encontrado", "Ele pode ter sido excluído.");
          router.back();
          return;
        }
        const { id: _, ...resto } = achado;
        setDados({ ...resto, localId: resto.localId ?? LOCAL_UEMG_ID });
      } catch (e) {
        setErroGeral(e instanceof ErroApi ? e.message : "Não foi possível carregar este horário.");
      } finally {
        setCarregando(false);
      }
    })();
  }, [api, editando, id]);

  function mudar<K extends keyof DadosCompromisso>(campo: K, valor: DadosCompromisso[K]) {
    setDados((atual) => ({ ...atual, [campo]: valor }));
  }

  async function salvar() {
    // Mesmas regras do backend: título obrigatório e fim depois do início
    const encontrados: Erros = {};
    if (!dados.titulo.trim()) encontrados.titulo = "Informe o nome da aula.";
    if (paraMinutos(dados.fim) <= paraMinutos(dados.inicio)) encontrados.fim = "O fim precisa ser depois do início.";
    setErros(encontrados);
    setErroGeral(null);
    if (Object.keys(encontrados).length > 0) return;

    setSalvando(true);
    try {
      await api(editando ? `/compromissos/${id}` : "/compromissos", {
        metodo: editando ? "PUT" : "POST",
        corpo: { ...dados, titulo: dados.titulo.trim() },
      });
      router.back();
    } catch (e) {
      if (e instanceof ErroApi && e.status === 409) {
        // O backend devolve qual compromisso já ocupa esse horário
        const c = e.corpo.conflito as Compromisso | undefined;
        setErroGeral(
          c
            ? `Esse horário bate com “${c.titulo}” (${diasLongos[c.diaSemana].toLowerCase()}, ${c.inicio}–${c.fim}).`
            : e.message,
        );
      } else if (e instanceof ErroApi && e.detalhes) {
        setErros(Object.fromEntries(e.detalhes.map((d) => [d.campo, d.mensagem])));
      } else {
        setErroGeral(e instanceof ErroApi ? e.message : "Não foi possível salvar. Tente de novo.");
      }
      setSalvando(false);
    }
  }

  function confirmarExclusao() {
    Alert.alert("Excluir horário?", `“${dados.titulo}” sai da sua semana.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: excluir },
    ]);
  }

  async function excluir() {
    setExcluindo(true);
    try {
      await api(`/compromissos/${id}`, { metodo: "DELETE" });
      router.back();
    } catch (e) {
      setErroGeral(e instanceof ErroApi ? e.message : "Não foi possível excluir. Tente de novo.");
      setExcluindo(false);
    }
  }

  return (
    <KeyboardAvoidingView style={estilos.tela} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Stack.Screen options={{ title: editando ? "Editar horário" : "Novo horário" }} />
      {carregando ? (
        <ActivityIndicator color={cores.primaria} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          contentContainerStyle={[estilos.conteudo, { paddingBottom: margens.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <Campo
            rotulo="Nome"
            value={dados.titulo}
            onChangeText={(t) => mudar("titulo", t)}
            placeholder="Ex.: Banco de Dados"
            autoCapitalize="sentences"
            erro={erros.titulo}
          />

          <View style={{ gap: 6 }}>
            <Text style={estilos.rotulo}>Tipo</Text>
            <View style={estilos.opcoes}>
              {(["AULA", "OUTRO"] as const).map((tipo) => (
                <Pressable
                  key={tipo}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: dados.tipo === tipo }}
                  onPress={() => mudar("tipo", tipo)}
                  style={[estilos.opcao, dados.tipo === tipo && estilos.opcaoAtiva]}
                >
                  <Text style={[estilos.textoOpcao, dados.tipo === tipo && { color: cores.superficie }]}>
                    {tipo === "AULA" ? "Aula" : "Outro"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={estilos.rotulo}>Dia da semana</Text>
            <View style={estilos.opcoes}>
              {ordemDias.map((d) => (
                <Pressable
                  key={d}
                  accessibilityRole="radio"
                  accessibilityLabel={diasLongos[d]}
                  accessibilityState={{ checked: dados.diaSemana === d }}
                  onPress={() => mudar("diaSemana", d)}
                  style={[estilos.opcao, dados.diaSemana === d && estilos.opcaoAtiva]}
                >
                  <Text style={[estilos.textoOpcao, dados.diaSemana === d && { color: cores.superficie }]}>{diasCurtos[d]}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={estilos.horarios}>
            <CampoHorario rotulo="Começa" valor={dados.inicio} onChange={(h) => mudar("inicio", h)} erro={erros.inicio} />
            <CampoHorario rotulo="Termina" valor={dados.fim} onChange={(h) => mudar("fim", h)} erro={erros.fim} />
          </View>

          <View style={estilos.local}>
            <Icone nome="localizacao" tamanho={16} cor={cores.textoSuave} />
            <Text style={estilos.textoLocal}>Local: UEMG Unidade 5</Text>
          </View>

          {erroGeral ? <Text style={estilos.erro}>{erroGeral}</Text> : null}

          <Botao rotulo={editando ? "Salvar alterações" : "Adicionar horário"} onPress={salvar} carregando={salvando} />

          {editando ? (
            <Pressable
              accessibilityRole="button"
              onPress={confirmarExclusao}
              disabled={excluindo}
              style={({ pressed }) => [estilos.excluir, pressed && { opacity: 0.7 }]}
            >
              {excluindo ? (
                <ActivityIndicator color={cores.perigo} />
              ) : (
                <>
                  <Icone nome="lixeira" tamanho={18} cor={cores.perigo} />
                  <Text style={estilos.textoExcluir}>Excluir horário</Text>
                </>
              )}
            </Pressable>
          ) : null}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { paddingHorizontal: 20, paddingTop: 8, gap: 18 },
  rotulo: { fontSize: 13, fontWeight: "500", color: cores.textoSuave },
  opcoes: { flexDirection: "row", gap: 6 },
  opcao: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
  },
  opcaoAtiva: { backgroundColor: cores.primaria, borderColor: cores.primaria },
  textoOpcao: { fontSize: 14, fontWeight: "600", color: cores.texto },
  horarios: { flexDirection: "row", gap: 12 },
  local: { flexDirection: "row", alignItems: "center", gap: 6 },
  textoLocal: { fontSize: 13, color: cores.textoSuave },
  erro: { fontSize: 14, lineHeight: 20, color: cores.perigo },
  excluir: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 48 },
  textoExcluir: { fontSize: 15, fontWeight: "600", color: cores.perigo },
});
