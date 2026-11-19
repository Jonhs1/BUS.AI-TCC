import { useState } from "react";
import { ActivityIndicator, Keyboard, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSessao } from "@/auth/sessao";
import { cores } from "@/theme";

type Modo = "decidir" | "estudar";

export default function Assistente() {
  const { api } = useSessao();
  const margens = useSafeAreaInsets();
  const [modo, setModo] = useState<Modo>("decidir");
  const [pergunta, setPergunta] = useState("");
  const [conteudo, setConteudo] = useState("");
  const [resposta, setResposta] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  function trocarModo(proximo: Modo) {
    setModo(proximo);
    setPergunta("");
    setConteudo("");
    setResposta("");
    setErro("");
  }

  async function consultar() {
    if (carregando || pergunta.trim().length < 3) return;
    Keyboard.dismiss();
    setCarregando(true);
    setErro("");
    setResposta("");
    try {
      const resultado = await api<{ resposta: string }>("/assistente", {
        metodo: "POST",
        corpo: modo === "decidir"
          ? { modo, pergunta: pergunta.trim() }
          : { modo, pergunta: pergunta.trim(), conteudo: conteudo.trim() },
      });
      setResposta(resultado.resposta);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível consultar o assistente.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <ScrollView
      style={estilos.tela}
      contentContainerStyle={[estilos.conteudo, { paddingTop: margens.top + 18 }]}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={estilos.sobretitulo}>BUS.AI • Assistente inteligente</Text>
      <Text style={estilos.titulo}>Como posso te ajudar?</Text>
      <Text style={estilos.descricao}>
        Planeje melhor seu tempo ou estude um assunto com ajuda da IA.
      </Text>

      <View style={estilos.modos}>
        {(["decidir", "estudar"] as const).map((item) => (
          <TouchableOpacity
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected: modo === item }}
            style={[estilos.modo, modo === item && estilos.modoAtivo]}
            onPress={() => trocarModo(item)}
          >
            <Text style={[estilos.textoModo, modo === item && estilos.textoModoAtivo]}>
              {item === "decidir" ? "Decidir" : "Estudar"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={estilos.cartao}>
        <Text style={estilos.tituloCartao}>
          {modo === "decidir" ? "Seu próximo passo" : "Seu tutor de estudos"}
        </Text>
        <Text style={estilos.descricao}>
          {modo === "decidir"
            ? "Vou usar seus compromissos de hoje e as atividades viáveis calculadas pelo BUS.AI. Não consulto a localização do ônibus."
            : "Informe um tema ou cole um trecho do seu material para receber explicações, resumos e perguntas de revisão."}
        </Text>

        {modo === "estudar" ? (
          <>
            <Text style={estilos.rotulo}>Material de estudo (opcional)</Text>
            <TextInput
              style={[estilos.entrada, estilos.entradaLonga]}
              multiline
              value={conteudo}
              onChangeText={setConteudo}
              maxLength={6000}
              placeholder="Cole aqui suas anotações, um trecho da apostila ou um resumo..."
              placeholderTextColor={cores.textoSuave}
              textAlignVertical="top"
              accessibilityLabel="Material de estudo"
            />
          </>
        ) : null}

        <Text style={estilos.rotulo}>Sua pergunta</Text>
        <TextInput
          style={[estilos.entrada, estilos.entradaPergunta]}
          multiline
          value={pergunta}
          onChangeText={setPergunta}
          maxLength={700}
          placeholder={modo === "decidir"
            ? "O que posso fazer antes da próxima aula?"
            : "Explique este tema e prepare duas perguntas de revisão."}
          placeholderTextColor={cores.textoSuave}
          textAlignVertical="top"
          accessibilityLabel="Pergunta ao assistente"
        />
        <TouchableOpacity
          style={[estilos.botao, (carregando || pergunta.trim().length < 3) && estilos.desabilitado]}
          disabled={carregando || pergunta.trim().length < 3}
          onPress={consultar}
          accessibilityRole="button"
        >
          {carregando ? <ActivityIndicator color={cores.superficie} /> : <Text style={estilos.textoBotao}>Perguntar à IA</Text>}
        </TouchableOpacity>
      </View>

      {erro ? (
        <View style={estilos.cartao}>
          <Text style={estilos.erro}>{erro}</Text>
        </View>
      ) : null}

      {resposta ? (
        <View style={estilos.cartao}>
          <Text style={estilos.tituloCartao}>Resposta do assistente</Text>
          <Text selectable style={estilos.resposta}>{resposta}</Text>
          <Text style={estilos.nota}>A IA pode cometer erros. Confira informações importantes antes de agir ou usar nos estudos.</Text>
        </View>
      ) : null}

      <Text style={estilos.nota}>
        Suas perguntas e o material colado serão enviados ao provedor Gemini para gerar a resposta.
        Evite inserir dados pessoais, senhas ou informações confidenciais.
        Esta versão não salva o histórico do assistente.
      </Text>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { paddingHorizontal: 20, paddingBottom: 44, gap: 14 },
  sobretitulo: { fontSize: 13, fontWeight: "700", color: cores.primaria },
  titulo: { fontSize: 26, fontWeight: "700", color: cores.texto },
  descricao: { fontSize: 14, lineHeight: 21, color: cores.textoSuave },
  modos: { flexDirection: "row", padding: 4, borderRadius: 14, backgroundColor: cores.primariaSuave },
  modo: { flex: 1, paddingVertical: 12, borderRadius: 11, alignItems: "center" },
  modoAtivo: { backgroundColor: cores.primaria },
  textoModo: { fontSize: 14, fontWeight: "700", color: cores.primaria },
  textoModoAtivo: { color: cores.superficie },
  cartao: { gap: 12, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: cores.borda, backgroundColor: cores.superficie },
  tituloCartao: { fontSize: 17, fontWeight: "700", color: cores.texto },
  rotulo: { fontSize: 13, fontWeight: "600", color: cores.texto },
  entrada: { borderRadius: 12, borderColor: cores.borda, borderWidth: 1, padding: 12, color: cores.texto, fontSize: 14, lineHeight: 20, backgroundColor: cores.fundo },
  entradaLonga: { minHeight: 110 },
  entradaPergunta: { minHeight: 74 },
  botao: { borderRadius: 12, backgroundColor: cores.primaria, padding: 15, alignItems: "center", justifyContent: "center" },
  desabilitado: { opacity: 0.5 },
  textoBotao: { color: cores.superficie, fontWeight: "700", fontSize: 15 },
  resposta: { fontSize: 14, lineHeight: 23, color: cores.texto },
  erro: { fontSize: 14, lineHeight: 21, color: cores.perigo },
  nota: { fontSize: 12, lineHeight: 18, color: cores.textoSuave },
});
