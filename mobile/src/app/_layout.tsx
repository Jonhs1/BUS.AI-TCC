import { ActivityIndicator, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ProvedorSessao, useSessao } from "@/auth/sessao";
import { cores } from "@/theme";

export default function LayoutRaiz() {
  return (
    <ProvedorSessao>
      <Navegacao />
    </ProvedorSessao>
  );
}

function Navegacao() {
  const { usuario, carregando } = useSessao();

  // Enquanto confere o token guardado, não mostra nenhuma tela (evita "piscar" o login)
  if (carregando) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: cores.fundo }}>
        <ActivityIndicator color={cores.primaria} />
      </View>
    );
  }

  // Stack.Protected: as abas só existem com login; sem login, só as telas de entrada.
  // Quando o usuário entra ou sai, o Expo Router troca de grupo sozinho.
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cores.fundo } }}>
                {/* Sem login: qualquer tela do app redireciona para "Entrar" */}
        <Stack.Protected guard={!!usuario} redirectTo="/entrar">
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        {/* Já logado: as telas de entrada redirecionam para o Início */}
        <Stack.Protected guard={!usuario} redirectTo="/">
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
