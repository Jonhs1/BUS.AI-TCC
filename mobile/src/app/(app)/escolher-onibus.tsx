import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ErroApi } from "@/api/cliente";
import { nomeOperador, useLinhas } from "@/api/linhas";
import { useSessao, type Usuario } from "@/auth/sessao";
import { Botao } from "@/components/botao";
import { Icone } from "@/components/icone";
import { cores } from "@/theme";

// Escolha do ônibus que o aluno costuma usar (PUT /usuarios/me/linha)
export default function EscolherOnibus() {
  const { usuario, api, atualizarUsuario } = useSessao();
  const { linhas, carregando, erro, recarregar } = useLinhas();
  const margens = useSafeAreaInsets();
  // id da linha sendo salva agora ("nenhuma" = removendo a escolha)
  const [salvando, setSalvando] = useState<number | "nenhuma" | null>(null);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  async function escolher(linhaId: number | null) {
    setSalvando(linhaId ?? "nenhuma");
    setErroSalvar(null);
    try {
      const resposta = await api<{ usuario: Usuario }>("/usuarios/me/linha", { metodo: "PUT", corpo: { linhaId } });
      atualizarUsuario(resposta.usuario);
      router.back();
    } catch (e) {
      setErroSalvar(e instanceof ErroApi ? e.message : "Não foi possível salvar. Tente de novo.");
      setSalvando(null);
    }
  }

  if (carregando) {
    return (
      <View style={estilos.centro}>
        <ActivityIndicator color={cores.primaria} />
      </View>
    );
  }

  if (erro) {
    return (
      <View style={[estilos.centro, { gap: 16, padding: 20 }]}>
        <Text style={estilos.erro}>{erro}</Text>
        <Botao tipo="secundario" rotulo="Tentar de novo" onPress={recarregar} />
      </View>
    );
  }

  return (
    <ScrollView style={estilos.tela} contentContainerStyle={[estilos.conteudo, { paddingBottom: margens.bottom + 24 }]}>
      <Text style={estilos.ajuda}>Escolha o ônibus que você pega para vir à faculdade. Ele aparece no Início e no mapa.</Text>

      {linhas.map((linha) => {
        const escolhida = usuario?.linhaId === linha.id;
        return (
          <Pressable
            key={linha.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: escolhida, busy: salvando === linha.id }}
            disabled={salvando !== null}
            onPress={() => escolher(linha.id)}
            style={({ pressed }) => [estilos.opcao, escolhida && estilos.opcaoEscolhida, pressed && { opacity: 0.85 }]}
          >
            <View style={estilos.iconeLinha}>
              <Icone nome="onibus" tamanho={22} cor={cores.primaria} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={estilos.nome}>{linha.nome}</Text>
              <Text style={estilos.detalhe}>
                {linha.cidadeOrigem} · {nomeOperador[linha.operador]}
              </Text>
            </View>
            {salvando === linha.id ? (
              <ActivityIndicator color={cores.primaria} />
            ) : (
              <Icone nome={escolhida ? "marcado" : "desmarcado"} tamanho={24} cor={escolhida ? cores.primaria : cores.borda} />
            )}
          </Pressable>
        );
      })}

      {linhas.length === 0 ? <Text style={estilos.ajuda}>Nenhuma linha cadastrada ainda.</Text> : null}
      {erroSalvar ? <Text style={estilos.erro}>{erroSalvar}</Text> : null}

      {usuario?.linhaId != null ? (
        <Botao tipo="texto" rotulo="Não uso ônibus" onPress={() => escolher(null)} carregando={salvando === "nenhuma"} />
      ) : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: cores.fundo },
  ajuda: { fontSize: 14, lineHeight: 20, color: cores.textoSuave, marginBottom: 4 },
  opcao: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
  },
  opcaoEscolhida: { borderColor: cores.primaria, borderWidth: 2, padding: 15 },
  iconeLinha: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: cores.primariaSuave,
    alignItems: "center",
    justifyContent: "center",
  },
  nome: { fontSize: 15, fontWeight: "600", color: cores.texto },
  detalhe: { fontSize: 13, color: cores.textoSuave },
  erro: { fontSize: 14, color: cores.perigo, textAlign: "center" },
});
