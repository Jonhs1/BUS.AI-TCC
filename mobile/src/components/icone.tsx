import { SymbolView } from "expo-symbols";
import type { ColorValue } from "react-native";

// Cada ícone tem um nome no iPhone (SF Symbols) e outro no Android (Material Symbols)
const icones = {
  onibus: { ios: "bus.fill", android: "directions_bus", web: "directions_bus" },
  voltar: { ios: "chevron.left", android: "arrow_back", web: "arrow_back" },
  sair: { ios: "rectangle.portrait.and.arrow.right", android: "logout", web: "logout" },
  construcao: { ios: "hammer.fill", android: "construction", web: "construction" },
  seta: { ios: "chevron.right", android: "chevron_right", web: "chevron_right" },
  marcado: { ios: "checkmark.circle.fill", android: "check_circle", web: "check_circle" },
  desmarcado: { ios: "circle", android: "radio_button_unchecked", web: "radio_button_unchecked" },
  escudo: { ios: "checkmark.shield.fill", android: "verified_user", web: "verified_user" },
  pessoas: { ios: "person.2.fill", android: "group", web: "group" },
  ligar: { ios: "power", android: "power_settings_new", web: "power_settings_new" },
  localizacao: { ios: "location.fill", android: "location_on", web: "location_on" },
  mais: { ios: "plus", android: "add", web: "add" },
  brilho: { ios: "sparkles", android: "auto_awesome", web: "auto_awesome" },
  lixeira: { ios: "trash", android: "delete", web: "delete" },
  mira: { ios: "scope", android: "my_location", web: "my_location" },
  abrir: { ios: "arrow.up.right.square", android: "open_in_new", web: "open_in_new" },
  escola: { ios: "building.columns.fill", android: "school", web: "school" },
} as const;

export type NomeIcone = keyof typeof icones;

export function Icone({ nome, tamanho = 24, cor }: { nome: NomeIcone; tamanho?: number; cor: ColorValue }) {
  return <SymbolView name={icones[nome]} size={tamanho} tintColor={cor} />;
}
