// Converte "14:30" em 870 (minutos desde 00:00)
export function horaParaMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

// Converte 870 em "14:30"
export function minutosParaHora(minutos: number): string {
  const h = Math.floor(minutos / 60).toString().padStart(2, "0");
  const m = (minutos % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

// Dia da semana (0 = domingo) e minutos desde 00:00 no horário de Brasília,
// independentemente do fuso configurado no servidor
export function agoraEmSaoPaulo(data: Date = new Date()) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(data);

  const valor = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  const dias = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return {
    diaSemana: dias.indexOf(valor("weekday")),
    minutos: Number(valor("hour")) * 60 + Number(valor("minute")),
  };
}