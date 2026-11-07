import { useEffect, useRef } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import MapView, { Circle, Marker } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLinhas } from "@/api/linhas";
import { INTERVALO_MAPA_S, nomeDescarte, usePosicaoOnibus } from "@/api/posicao";
import { useSessao } from "@/auth/sessao";
import { Botao } from "@/components/botao";
import { Icone } from "@/components/icone";
import { cores } from "@/theme";
import { PRECISAO_MAXIMA_M, useViagem } from "@/viagem/compartilhamento";

// Mesmas coordenadas do local "UEMG Unidade 5" em backend/prisma/seed.ts
const UEMG = { latitude: -20.734877429956306, longitude: -46.62568049632971 };
const ZOOM_INICIAL = { latitudeDelta: 0.06, longitudeDelta: 0.06 }; // ~6 km de altura
const ZOOM_ONIBUS = { latitudeDelta: 0.012, longitudeDelta: 0.012 }; // ~1,3 km

// No Android, o mapa embutido usa o Google Maps, que exige uma chave paga do Google Cloud:
// sem ela, aparece em branco no Expo Go e FECHA o app no APK. Por isso só é desenhado no iPhone
// (Apple Maps). No Android, o painel de cima e o botão "Abrir no app de mapas" fazem o papel do mapa.
const MAPA_EMBUTIDO = Platform.OS === "ios";

// Distância em linha reta entre dois pontos (fórmula de Haversine), em metros
function distanciaM(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const R = 6371000;
  const rad = (g: number) => (g * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatarDistancia(m: number) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1).replace(".", ",")} km`;
}

// Tela "Mapa": posição estimada do ônibus do aluno, atualizada a cada 5 s
export default function Mapa() {
  const { usuario } = useSessao();
  const margens = useSafeAreaInsets();
  const linhaId = usuario?.linhaId ?? null;
  const { linhas } = useLinhas();
  const { dados, erro, consultadoEm } = usePosicaoOnibus(linhaId);
  // O próprio aluno pode estar compartilhando: ajuda a explicar um "sem posição"
  const { coletando, precisaoM } = useViagem();
  const mapa = useRef<MapView>(null);
  const centralizou = useRef(false);

  const posicao = dados?.posicao ?? null;
  const nomeLinha = dados?.linha.nome ?? linhas.find((l) => l.id === linhaId)?.nome ?? "Seu ônibus";

  function centralizar() {
    if (!posicao) return;
    mapa.current?.animateToRegion({ latitude: posicao.latitude, longitude: posicao.longitude, ...ZOOM_ONIBUS }, 600);
  }

  // Na primeira vez que o ônibus aparece, leva o mapa até ele; depois, o aluno move à vontade
  useEffect(() => {
    if (posicao && !centralizou.current) {
      centralizou.current = true;
      centralizar();
    }
  }, [posicao]);

  // Alternativa ao mapa embutido: abre a posição no app de mapas do celular
  function abrirNoAppDeMapas() {
    if (!posicao) return;
    const { latitude, longitude } = posicao;
    const url = Platform.select({
      ios: `maps:0,0?q=${latitude},${longitude}`,
      default: `geo:0,0?q=${latitude},${longitude}(Ônibus)`,
    });
    Linking.openURL(url);
  }

  // Sem ônibus escolhido não há o que mostrar
  if (linhaId === null) {
    return (
      <View style={[estilos.tela, estilos.centro, { paddingTop: margens.top + 16 }]}>
        <Icone nome="onibus" tamanho={40} cor={cores.primaria} />
        <Text style={estilos.titulo}>Qual é o seu ônibus?</Text>
        <Text style={[estilos.suave, { textAlign: "center" }]}>Escolha o ônibus que você usa para ver onde ele está.</Text>
        <Botao rotulo="Escolher meu ônibus" onPress={() => router.push("/escolher-onibus")} />
      </View>
    );
  }

  const descartados = posicao?.dispositivosDescartados.reduce((soma, d) => soma + d.quantidade, 0) ?? 0;

  return (
    <View style={estilos.tela}>
      {/* Painel no TOPO: embaixo, a barra de abas do iPhone cobriria os botões (como aconteceu nos Horários) */}
      <View style={[estilos.painel, { paddingTop: margens.top + 12 }]}>
        <Text style={estilos.suave} numberOfLines={1}>
          {nomeLinha}
        </Text>

        {posicao ? (
          <>
            <View style={estilos.linha}>
              <View style={[estilos.bolinha, { backgroundColor: cores.sucesso }]} />
              <Text style={estilos.titulo}>Ônibus a {formatarDistancia(distanciaM(posicao, UEMG))} da UEMG</Text>
            </View>
            <Text style={estilos.suave}>
              Atualizado há {posicao.atualizadaHaSegundos} s · {posicao.dispositivosUsados} aluno(s) compartilhando · precisão
              de ~{Math.round(posicao.precisaoEstimadaM)} m
            </Text>
            {descartados > 0 ? (
              <Text style={estilos.suave}>
                {descartados} leitura(s) ignorada(s):{" "}
                {posicao.dispositivosDescartados.map((d) => `${nomeDescarte[d.motivo] ?? d.motivo} (${d.quantidade})`).join(", ")}
              </Text>
            ) : null}
            <View style={estilos.botoes}>
              {MAPA_EMBUTIDO ? <Acao icone="mira" rotulo="Centralizar" onPress={centralizar} /> : null}
              <Acao icone="abrir" rotulo="Abrir no app de mapas" onPress={abrirNoAppDeMapas} />
            </View>
          </>
        ) : dados ? (
          <>
            <View style={estilos.linha}>
              <View style={[estilos.bolinha, { backgroundColor: cores.textoSuave }]} />
              <Text style={estilos.titulo}>Sem posição no momento</Text>
            </View>
            {/* A API devolve null em dois casos: ninguém enviou nos últimos 60 s, OU todas as leituras
                recentes tinham precisão pior que 100 m e foram descartadas. O app não sabe qual dos dois. */}
            <Text style={estilos.suave}>
              {coletando
                ? `Você está compartilhando, mas nenhuma leitura recente foi precisa o bastante. O servidor só usa leituras de até ${PRECISAO_MAXIMA_M} m${
                    precisaoM !== null ? `; a sua está em ${Math.round(precisaoM)} m` : ""
                  }. Em lugar fechado é comum: perto de uma janela ou ao ar livre melhora.`
                : `Nenhuma posição confiável nos últimos 60 s: ninguém está compartilhando ou o GPS de quem está no ônibus está impreciso. Se você estiver nele, toque em “Estou no ônibus” na tela Início.`}
            </Text>
          </>
        ) : (
          <Text style={estilos.titulo}>Procurando o ônibus…</Text>
        )}

        {erro ? <Text style={estilos.erro}>{erro}</Text> : null}
        <Text style={estilos.detalhe}>
          Posição estimada a partir dos celulares dos alunos · atualiza a cada {INTERVALO_MAPA_S} s
          {consultadoEm ? ` · última consulta ${consultadoEm.toLocaleTimeString("pt-BR")}` : ""}
        </Text>
      </View>

      {MAPA_EMBUTIDO ? (
        <MapView
          ref={mapa}
          style={estilos.mapa}
          initialRegion={{ ...UEMG, ...ZOOM_INICIAL }}
          showsCompass
          toolbarEnabled={false}
        >
          {/* Referência fixa: a universidade */}
          <Marker coordinate={UEMG} title="UEMG Unidade 5" anchor={{ x: 0.5, y: 0.5 }}>
            <View style={[estilos.pino, { backgroundColor: cores.marinho }]}>
              <Icone nome="escola" tamanho={16} cor={cores.superficie} />
            </View>
          </Marker>

          {posicao ? (
            <>
              {/* Círculo de incerteza: o ônibus provavelmente está dentro dele */}
              <Circle
                center={posicao}
                radius={Math.max(posicao.precisaoEstimadaM, 10)}
                fillColor="rgba(31, 111, 235, 0.15)"
                strokeColor="rgba(31, 111, 235, 0.6)"
                strokeWidth={1}
              />
              <Marker
                coordinate={{ latitude: posicao.latitude, longitude: posicao.longitude }}
                title={nomeLinha}
                description={`Atualizado há ${posicao.atualizadaHaSegundos} s`}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={[estilos.pino, { backgroundColor: cores.primaria }]}>
                  <Icone nome="onibus" tamanho={18} cor={cores.superficie} />
                </View>
              </Marker>
            </>
          ) : null}
        </MapView>
      ) : (
        <View style={estilos.semMapa}>
          <Icone nome="localizacao" tamanho={32} cor={cores.primaria} />
          <Text style={[estilos.suave, { textAlign: "center" }]}>
            No Android, o mapa embutido não está disponível nesta versão do app. Use “Abrir no app de mapas” para ver
            a posição do ônibus no Google Maps.
          </Text>
          {posicao ? <Botao rotulo="Abrir no app de mapas" onPress={abrirNoAppDeMapas} /> : null}
        </View>
      )}
    </View>
  );
}

function Acao({ icone, rotulo, onPress }: { icone: "mira" | "abrir"; rotulo: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [estilos.acao, pressed && { opacity: 0.7 }]}
    >
      <Icone nome={icone} tamanho={16} cor={cores.primaria} />
      <Text style={estilos.textoAcao}>{rotulo}</Text>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  centro: { alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 32 },
  painel: {
    gap: 6,
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: cores.superficie,
    borderBottomWidth: 1,
    borderBottomColor: cores.borda,
  },
  linha: { flexDirection: "row", alignItems: "center", gap: 8 },
  bolinha: { width: 10, height: 10, borderRadius: 5 },
  titulo: { fontSize: 18, fontWeight: "700", color: cores.texto },
  suave: { fontSize: 13, lineHeight: 18, color: cores.textoSuave },
  detalhe: { fontSize: 11, lineHeight: 15, color: cores.textoSuave },
  erro: { fontSize: 13, color: cores.perigo },
  botoes: { flexDirection: "row", gap: 8, marginTop: 4 },
  acao: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: cores.primariaSuave,
  },
  textoAcao: { fontSize: 13, fontWeight: "600", color: cores.primaria },
  mapa: { flex: 1 },
  semMapa: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 32 },
  pino: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: cores.superficie,
  },
});
