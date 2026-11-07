import { NativeTabs } from "expo-router/unstable-native-tabs";
import { cores } from "@/theme";

// As 4 abas do protótipo. "sf" = ícone do iPhone, "md" = ícone do Android.
export default function LayoutAbas() {
  return (
    <NativeTabs tintColor={cores.primaria}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: "house", selected: "house.fill" }} md="home" />
        <NativeTabs.Trigger.Label>Início</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="horarios">
        <NativeTabs.Trigger.Icon sf="calendar" md="calendar_month" />
        <NativeTabs.Trigger.Label>Horários</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="mapa">
        <NativeTabs.Trigger.Icon sf={{ default: "map", selected: "map.fill" }} md="map" />
        <NativeTabs.Trigger.Label>Mapa</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="perfil">
        <NativeTabs.Trigger.Icon sf={{ default: "person", selected: "person.fill" }} md="person" />
        <NativeTabs.Trigger.Label>Perfil</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
