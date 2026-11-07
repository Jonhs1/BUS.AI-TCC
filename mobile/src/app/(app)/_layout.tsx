import { Stack } from "expo-router";
import { cores } from "@/theme";
import { ProvedorViagem } from "@/viagem/compartilhamento";

// Com login: as abas ficam por baixo, e as telas de ajuste abrem por cima delas.
// O ProvedorViagem envolve tudo, para o envio da localização continuar ao trocar de tela.
export default function LayoutApp() {
  return (
    <ProvedorViagem>
      <Stack screenOptions={{ contentStyle: { backgroundColor: cores.fundo } }}>
        <Stack.Screen name="(abas)" options={{ headerShown: false }} />
        <Stack.Screen
          name="escolher-onibus"
          options={{
            title: "Meu ônibus",
            presentation: "modal",
            headerShadowVisible: false,
            headerStyle: { backgroundColor: cores.fundo },
            headerTintColor: cores.texto,
          }}
        />
        <Stack.Screen name="permitir-localizacao" options={{ headerShown: false, presentation: "modal" }} />
        <Stack.Screen
          name="aula"
          options={{
            presentation: "modal",
            headerShadowVisible: false,
            headerStyle: { backgroundColor: cores.fundo },
            headerTintColor: cores.texto,
          }}
        />
      </Stack>
    </ProvedorViagem>
  );
}
