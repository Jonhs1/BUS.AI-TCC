import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSessao } from "@/auth/sessao";
import { Botao } from "@/components/botao";
import { Icone } from "@/components/icone";
import { cores } from "@/theme";
import { INTERVALO_ENVIO_S, MODO_SEGUNDO_PLANO, PRECISAO_MAXIMA_M, useViagem } from "@/viagem/compartilhamento";

// Cartão "Estou no ônibus" da tela Início: o lado do app na geolocalização colaborativa
export function CartaoViagem() {
  const { usuario } = useSessao();
  const { viagem, coletando, enviadas, naFila, precisaoM, ultimoEnvio, aviso, embarcar, continuar, desembarcar } =
    useViagem();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Roda uma ação do compartilhamento mostrando carregando e o erro, se houver
  async function executar(acao: () => Promise<void>) {
    setOcupado(true);
    setErro(null);
    try {
      await acao();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível. Tente de novo.");
    } finally {
      setOcupado(false);
    }
  }

  const mensagem = erro ?? aviso;
  const gpsImpreciso = precisaoM !== null && precisaoM > PRECISAO_MAXIMA_M;

  // ───── Compartilhando agora ─────
  if (coletando) {
    return (
      <View style={[estilos.cartao, estilos.ativo]}>
        <View style={estilos.cabecalho}>
          <View style={[estilos.bolinha, { backgroundColor: cores.sucesso }]} />
          <Text style={estilos.titulo}>Compartilhando localização</Text>
        </View>
        <Text style={estilos.texto}>
          {MODO_SEGUNDO_PLANO
            ? "Pode bloquear a tela: o envio continua até você tocar em “Desci do ônibus”. Uma notificação mostra que está ligado."
            : "Deixe o app aberto na tela até descer."}{" "}
          Ninguém vê sua posição, só a do ônibus.
        </Text>

        <View style={estilos.grade}>
          <Dado rotulo="Leituras enviadas" valor={String(enviadas)} />
          <Dado rotulo="Aguardando envio" valor={String(naFila)} />
          <Dado
            rotulo="Precisão do GPS"
            valor={precisaoM === null ? "—" : `${Math.round(precisaoM)} m`}
            ruim={gpsImpreciso}
          />
          <Dado
            rotulo="Último envio"
            valor={ultimoEnvio ? ultimoEnvio.toLocaleTimeString("pt-BR") : "—"}
          />
        </View>
        <Text style={estilos.detalhe}>Uma posição a cada {INTERVALO_ENVIO_S} s · viagem #{viagem?.id} · {MODO_SEGUNDO_PLANO ? "segundo plano" : "tela ligada"}</Text>
        {gpsImpreciso ? (
          <Text style={estilos.alerta}>
            GPS impreciso (mais de {PRECISAO_MAXIMA_M} m): o servidor ignora essas leituras. Em lugar fechado é comum; perto
            de uma janela ou ao ar livre melhora.
          </Text>
        ) : null}

        {mensagem ? <Text style={estilos.aviso}>{mensagem}</Text> : null}
        <Botao tipo="secundario" rotulo="Desci do ônibus" carregando={ocupado} onPress={() => executar(desembarcar)} />
      </View>
    );
  }

  // ───── Viagem aberta, mas sem coleta (o app foi fechado no meio da viagem) ─────
  if (viagem) {
    return (
      <View style={[estilos.cartao, estilos.pendente]}>
        <View style={estilos.cabecalho}>
          <View style={[estilos.bolinha, { backgroundColor: cores.alerta }]} />
          <Text style={estilos.titulo}>Viagem em andamento</Text>
        </View>
        <Text style={estilos.texto}>Você não tocou em “Desci” na última viagem. Ainda está no ônibus?</Text>
        {mensagem ? <Text style={estilos.aviso}>{mensagem}</Text> : null}
        <Botao rotulo="Continuar compartilhando" carregando={ocupado} onPress={() => executar(continuar)} />
        <Botao tipo="texto" rotulo="Já desci, encerrar" desabilitado={ocupado} onPress={() => executar(desembarcar)} />
      </View>
    );
  }

  // ───── Parado: o que falta para poder compartilhar ─────
  const autorizado = usuario?.consentiuLocalizacaoEm != null;
  const temOnibus = usuario?.linhaId != null;

  return (
    <View style={estilos.cartao}>
      <View style={estilos.cabecalho}>
        <Icone nome="onibus" tamanho={20} cor={cores.primaria} />
        <Text style={estilos.titulo}>Está no ônibus?</Text>
      </View>
      <Text style={estilos.texto}>
        Compartilhe sua localização durante a viagem para ajudar os colegas a saber onde o ônibus está.
      </Text>
      {mensagem ? <Text style={estilos.aviso}>{mensagem}</Text> : null}
      {!autorizado ? (
        <Botao tipo="secundario" rotulo="Permitir localização" onPress={() => router.push("/permitir-localizacao")} />
      ) : !temOnibus ? (
        <Botao tipo="secundario" rotulo="Escolher meu ônibus" onPress={() => router.push("/escolher-onibus")} />
      ) : (
        <Botao rotulo="Estou no ônibus" carregando={ocupado} onPress={() => executar(embarcar)} />
      )}
      {enviadas > 0 && !mensagem ? (
        <Text style={estilos.detalhe}>Última viagem: {enviadas} leitura(s) enviadas.</Text>
      ) : null}
    </View>
  );
}

function Dado({ rotulo, valor, ruim = false }: { rotulo: string; valor: string; ruim?: boolean }) {
  return (
    <View style={estilos.dado}>
      <Text style={[estilos.valor, ruim && { color: cores.perigo }]}>{valor}</Text>
      <Text style={estilos.detalhe}>{rotulo}</Text>
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    gap: 12,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
  },
  ativo: { borderColor: cores.sucesso, backgroundColor: cores.sucessoSuave },
  pendente: { borderColor: cores.alerta, backgroundColor: cores.alertaSuave },
  cabecalho: { flexDirection: "row", alignItems: "center", gap: 8 },
  bolinha: { width: 10, height: 10, borderRadius: 5 },
  titulo: { fontSize: 16, fontWeight: "700", color: cores.texto },
  texto: { fontSize: 14, lineHeight: 20, color: cores.textoSuave },
  grade: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dado: { flexBasis: "47%", flexGrow: 1, padding: 12, borderRadius: 12, backgroundColor: cores.superficie },
  valor: { fontSize: 18, fontWeight: "700", color: cores.texto },
  detalhe: { fontSize: 12, color: cores.textoSuave },
  aviso: { fontSize: 13, lineHeight: 18, color: cores.perigo },
  alerta: { fontSize: 13, lineHeight: 18, color: cores.alerta, fontWeight: "600" },
});
