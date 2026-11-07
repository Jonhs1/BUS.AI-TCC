import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { requisitar } from "@/api/cliente";
import { Botao } from "@/components/botao";
import { Campo } from "@/components/campo";
import { carregarEnderecoSalvo, definirEnderecoServidor, ENDERECO_DO_ARQUIVO, obterApiUrl } from "@/config";
import { cores } from "@/theme";

// "Servidor: ..." na tela Entrar. Permite colar o endereço novo do túnel no celular,
// sem precisar gerar outro APK. Fica guardado no celular até ser trocado de novo.
export function CampoServidor() {
  const [aberto, setAberto] = useState(false);
  const [atual, setAtual] = useState(obterApiUrl());
  const [texto, setTexto] = useState("");
  const [mensagem, setMensagem] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [testando, setTestando] = useState(false);

  // O endereço salvo é carregado na abertura do app; garante que a tela mostre o valor certo
  useEffect(() => {
    carregarEnderecoSalvo().then(setAtual);
  }, []);

  function abrir() {
    setTexto(atual);
    setMensagem(null);
    setAberto(true);
  }

  async function salvar(endereco: string) {
    setTestando(true);
    setMensagem(null);
    try {
      const novo = await definirEnderecoServidor(endereco);
      setAtual(novo);
      // Confere na hora se o backend responde nesse endereço
      await requisitar<{ status: string }>("/health");
      setMensagem({ tipo: "ok", texto: "Servidor encontrado. Pode entrar." });
      setAberto(false);
    } catch (e) {
      setMensagem({ tipo: "erro", texto: e instanceof Error ? e.message : "Não foi possível falar com esse endereço." });
    } finally {
      setTestando(false);
    }
  }

  const exibicao = atual ? atual.replace(/^https?:\/\//, "") : "não configurado";

  return (
    <View style={estilos.container}>
      {aberto ? (
        <View style={estilos.cartao}>
          <Campo
            rotulo="Endereço do servidor"
            value={texto}
            onChangeText={setTexto}
            placeholder="https://....trycloudflare.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Botao rotulo="Salvar e testar" onPress={() => salvar(texto)} carregando={testando} />
          {ENDERECO_DO_ARQUIVO ? (
            <Botao tipo="texto" rotulo="Usar o endereço do .env.local" onPress={() => salvar("")} desabilitado={testando} />
          ) : null}
          <Botao tipo="texto" rotulo="Cancelar" onPress={() => setAberto(false)} desabilitado={testando} />
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={abrir} style={({ pressed }) => [pressed && { opacity: 0.6 }]}>
          <Text style={estilos.linha} numberOfLines={1}>
            Servidor: <Text style={estilos.endereco}>{exibicao}</Text> · alterar
          </Text>
        </Pressable>
      )}
      {mensagem ? <Text style={mensagem.tipo === "ok" ? estilos.ok : estilos.erro}>{mensagem.texto}</Text> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  container: { gap: 8, alignItems: "stretch" },
  cartao: { gap: 8, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: cores.borda, backgroundColor: cores.superficie },
  linha: { fontSize: 12, color: cores.textoSuave, textAlign: "center" },
  endereco: { fontWeight: "600", color: cores.texto },
  ok: { fontSize: 12, color: cores.sucesso, textAlign: "center" },
  erro: { fontSize: 12, color: cores.perigo, textAlign: "center" },
});
