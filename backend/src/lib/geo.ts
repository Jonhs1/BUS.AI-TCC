export interface Ponto {
  latitude: number;
  longitude: number;
}

const RAIO_TERRA_METROS = 6_371_000;

// Fator de correção: ruas não são linha reta (estimativa declarada)
export const FATOR_ROTA = 1.3;

// Velocidade média de caminhada: ~4,8 km/h = 80 m/min (estimativa declarada)
export const METROS_POR_MINUTO = 80;

// Distância em linha reta entre duas coordenadas (fórmula de Haversine)
export function distanciaMetros(a: Ponto, b: Ponto): number {
  const rad = (graus: number) => (graus * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAIO_TERRA_METROS * Math.asin(Math.sqrt(h));
}

// Tempo estimado de caminhada entre dois pontos, arredondado para cima
export function minutosDeCaminhada(a: Ponto, b: Ponto): number {
  const metros = distanciaMetros(a, b) * FATOR_ROTA;
  return Math.ceil(metros / METROS_POR_MINUTO);
}

const METROS_POR_GRAU_LATITUDE = 111_320;

// Desloca um ponto alguns metros para o norte/leste (aproximação válida para curtas distâncias).
// Usado nos testes e na simulação.
export function deslocarMetros(p: Ponto, norteMetros: number, lesteMetros: number): Ponto {
  const metrosPorGrauLongitude = METROS_POR_GRAU_LATITUDE * Math.cos((p.latitude * Math.PI) / 180);
  return {
    latitude: p.latitude + norteMetros / METROS_POR_GRAU_LATITUDE,
    longitude: p.longitude + lesteMetros / metrosPorGrauLongitude,
  };
}