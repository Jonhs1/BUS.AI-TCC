// Rate limit simples para o backend único de demonstração.
// Usa o endereço da conexão, sem confiar em X-Forwarded-For fornecido pelo cliente.
export class LimitadorTentativas {
  private readonly tentativas = new Map<string, { inicio: number; contador: number }>();
  constructor(private readonly maximo: number, private readonly janelaMs: number, private readonly relogio = Date.now) {}

  permitir(chave: string): boolean {
    const agora = this.relogio();
    if (this.tentativas.size > 5000) {
      for (const [id, valor] of this.tentativas) {
        if (agora - valor.inicio >= this.janelaMs) this.tentativas.delete(id);
      }
    }
    const valor = this.tentativas.get(chave);
    if (!valor || agora - valor.inicio >= this.janelaMs) {
      this.tentativas.set(chave, { inicio: agora, contador: 1 });
      return true;
    }
    if (valor.contador >= this.maximo) return false;
    valor.contador++;
    return true;
  }
}
