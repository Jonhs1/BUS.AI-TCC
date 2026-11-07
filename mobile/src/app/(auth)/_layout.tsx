import { Stack } from "expo-router";
import { cores } from "@/theme";

// Sem login, a primeira tela é sempre "entrar"
export const unstable_settings = { initialRouteName: "entrar" };

export default function LayoutEntrada() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: cores.fundo } }} />;
}
