# BUS.AI — Documentação da API (backend)

Guia para integração do aplicativo mobile com o backend do BUS.AI.

- **Formato:** todas as requisições e respostas usam JSON (`Content-Type: application/json`).
- **Erros:** sempre no formato `{ "erro": "mensagem" }`. Erros de validação trazem também
  `"detalhes": [{ "campo": "...", "mensagem": "..." }]`.
- **Horários:** sempre em `"HH:MM"` (24 h), no horário de Brasília.
- **Dias da semana:** `0` = domingo, `1` = segunda … `6` = sábado.
- **Datas (timestamps):** texto ISO 8601 (ex.: `2026-11-03T18:42:34.125Z`).

---

## 1. Como acessar o backend

| Situação | URL base |
|---|---|
| Computador onde o backend roda | `http://localhost:3333` |
| Celular na **mesma rede Wi-Fi** do computador | `http://<IP-do-computador>:3333` (ex.: `http://192.168.0.15:3333`) |
| Testes fora de casa (ex.: dentro do ônibus) | Endereço do túnel da Cloudflare (ver seção 9) |

> No celular, `localhost` é o próprio celular, não o computador. Use o IP do computador ou a URL pública.

Teste de conexão: `GET /health` → `{ "status": "ok", "servico": "BUS.AI backend" }`.

---

## 2. Autenticação (JWT)

Rotas marcadas com 🔒 exigem o cabeçalho:

```
Authorization: Bearer <token>
```

O token é obtido no login e vale **7 dias**. Sem token, ou com token inválido/expirado, a resposta é `401`.
Ao receber `401`, o app deve levar o usuário de volta para a tela de login.

### `POST /auth/cadastro`

```json
{ "nome": "Maria Silva", "email": "maria@email.com", "senha": "minimo8caracteres", "curso": "Sistemas de Informação" }
```

`curso` é opcional. Senha com no mínimo 8 caracteres.

| Código | Significado |
|---|---|
| `201` | `{ "usuario": { "id", "nome", "email", "curso", "criadoEm" } }` |
| `400` | Dados inválidos |
| `409` | E-mail já cadastrado |

### `POST /auth/login`

```json
{ "email": "maria@email.com", "senha": "minimo8caracteres" }
```

| Código | Significado |
|---|---|
| `200` | `{ "token": "eyJ...", "usuario": { ... } }` |
| `401` | E-mail ou senha inválidos (mensagem genérica de propósito) |

---

## 3. Perfil 🔒

### `GET /usuarios/me`

```json
{
  "usuario": {
    "id": 1, "nome": "Maria Silva", "email": "maria@email.com", "curso": null,
    "linhaId": 1, "consentiuLocalizacaoEm": "2026-11-03T17:25:30.078Z", "criadoEm": "..."
  }
}
```

- `linhaId`: ônibus que o aluno costuma usar (`null` = não escolheu).
- `consentiuLocalizacaoEm`: quando autorizou o uso da localização (`null` = não autorizou).

### `PUT /usuarios/me/linha`

Define o ônibus do aluno. Envie `null` para remover.

```json
{ "linhaId": 1 }
```

Respostas: `200` com o perfil atualizado · `404` linha não encontrada.

### `POST /usuarios/me/consentimento-localizacao`

Registra que o aluno **autorizou** o uso da localização. Sem corpo. Resposta: `200` com o perfil.

> O app deve mostrar uma tela explicando **para que** a localização é usada antes de chamar esta rota.

### `DELETE /usuarios/me/consentimento-localizacao`

**Revoga** a autorização e encerra na hora qualquer compartilhamento em andamento. Resposta: `204` (sem corpo).

---

## 4. Compromissos (horários de aula) 🔒

Um compromisso é semanal: repete-se todo `diaSemana`.

### `GET /compromissos`

```json
{
  "compromissos": [
    { "id": 1, "titulo": "Engenharia de Software", "tipo": "AULA", "diaSemana": 1,
      "inicio": "19:00", "fim": "20:40", "localId": 1 }
  ]
}
```

Ordenados por dia e horário.

### `POST /compromissos`

```json
{ "titulo": "Banco de Dados", "tipo": "AULA", "diaSemana": 1, "inicio": "21:00", "fim": "22:40", "localId": 1 }
```

- `tipo`: `"AULA"` (padrão) ou `"OUTRO"` — opcional.
- `localId`: **obrigatório**. Use o id da "UEMG Unidade 5" (atualmente `1`) para as aulas.

| Código | Significado |
|---|---|
| `201` | `{ "compromisso": { ... } }` |
| `400` | Dados inválidos (horário fora do formato, fim antes do início, local inexistente) |
| `409` | Conflito com outro compromisso — a resposta traz `"conflito": { ... }` com o compromisso que bate |

### `PUT /compromissos/:id`

Mesmo corpo do `POST` (todos os campos). Respostas: `200` · `400` · `404` · `409`.

### `DELETE /compromissos/:id`

Respostas: `204` (sem corpo) · `404`.

---

## 5. Recomendações 🔒

### `GET /recomendacoes`

Parâmetros opcionais na URL:

| Parâmetro | Exemplo | Uso |
|---|---|---|
| `lat`, `lng` | `lat=-20.7348&lng=-46.6256` | Posição atual do celular (melhora o cálculo do deslocamento) |
| `dia`, `hora` | `dia=1&hora=20:40` | **Simulação**: calcula como se fosse esse dia/hora (para testes e demonstração) |

Sem `dia`/`hora`, usa o momento atual.

```json
{
  "diaSemana": 2,
  "agora": "14:00",
  "janela": { "inicio": "14:00", "fim": "15:30", "minutosLivres": 90, "proximoCompromisso": "Aula da tarde" },
  "recomendacoes": [
    {
      "atividadeId": 1, "titulo": "Estudar na biblioteca", "categoria": "ESTUDO",
      "local": "Biblioteca UEMG Unidade 5", "pontuacao": 69,
      "idaMin": 1, "voltaMin": 1, "totalMin": 52, "folgaMin": 38,
      "justificativa": "45 min de atividade, 1 min até Biblioteca UEMG Unidade 5, 1 min até \"Aula da tarde\"; sobram 38 min"
    }
  ],
  "descartadas": [
    { "titulo": "Resolver pendências na Secretaria Geral", "motivo": "Não cabe no intervalo: precisa de 97 min, há 90 min" }
  ]
}
```

- `recomendacoes` já vem **ordenada** da maior para a menor pontuação (0–100).
- Se não houver próximo compromisso no dia: `"janela": null` e `"mensagem": "Nenhum compromisso restante neste dia"`.
- Sugestão de tela: mostrar `titulo`, `local` e `justificativa`; `descartadas` pode ficar num "ver mais".

---

## 6. Linhas de ônibus 🔒

### `GET /linhas`

```json
{
  "linhas": [
    { "id": 1, "codigo": "BJP-UEMG", "nome": "Ônibus Prefeitura de Bom Jesus da Penha → UEMG",
      "cidadeOrigem": "Bom Jesus da Penha", "operador": "PREFEITURA" }
  ]
}
```

`operador`: `PREFEITURA`, `EMPRESA_PRIVADA` ou `TRANSPORTE_URBANO`.

### `GET /linhas/:id/posicao`

Posição **estimada** do ônibus, combinando os celulares dos alunos que estão nele agora.

```json
{
  "linha": { "id": 1, "nome": "Ônibus Prefeitura de Bom Jesus da Penha → UEMG" },
  "posicao": {
    "latitude": -20.7334, "longitude": -46.62616,
    "precisaoEstimadaM": 8,
    "dispositivosUsados": 1,
    "dispositivosDescartados": [],
    "atualizadaHaSegundos": 12
  }
}
```

- Sem ninguém compartilhando nos últimos 60 s: `"posicao": null` e uma `"mensagem"`.
- Sugestão para o mapa: marcador na posição + círculo com raio `precisaoEstimadaM`;
  texto "atualizado há X s · N aluno(s) compartilhando".
- Para acompanhar em tempo real, consultar a cada **5–10 segundos** enquanto a tela do mapa estiver aberta.
- A rota nunca devolve a posição individual de nenhum aluno.

---

## 7. Compartilhamento de localização (viagens) 🔒

Fluxo no app:

```
1. Aluno autoriza a localização (uma vez)  → POST /usuarios/me/consentimento-localizacao
2. Aluno escolhe o ônibus dele (uma vez)   → PUT  /usuarios/me/linha
3. Embarcou: botão "Estou no ônibus"       → POST /viagens
4. Durante a viagem, a cada N segundos     → POST /viagens/:id/leituras
5. Desembarcou: botão "Desci"              → POST /viagens/:id/encerrar
```

### `POST /viagens`

Corpo opcional: `{ "linhaId": 1 }`. Sem corpo, usa a linha do perfil.
Se já existir uma viagem aberta, ela é encerrada automaticamente.

| Código | Significado |
|---|---|
| `201` | `{ "viagem": { "id", "iniciadaEm", "encerradaEm": null, "usuarioId", "linhaId" } }` |
| `400` | Nenhuma linha informada nem definida no perfil |
| `403` | Aluno não autorizou a localização |
| `404` | Linha não encontrada |

### `GET /viagens/atual`

`{ "viagem": { ... } }` ou `{ "viagem": null }`. Útil ao reabrir o app para saber se o compartilhamento continua ativo.

### `POST /viagens/:id/leituras`

Envia **uma ou várias** posições (até 100 por vez).

```json
{
  "leituras": [
    { "latitude": -20.73340, "longitude": -46.62616, "precisaoMetros": 8, "registradaEm": 1793736154125 }
  ]
}
```

Mapeamento direto do **Expo Location** (`LocationObject`):

| Campo da API | Expo Location |
|---|---|
| `latitude` | `location.coords.latitude` |
| `longitude` | `location.coords.longitude` |
| `precisaoMetros` | `location.coords.accuracy` (pode ser `null`) |
| `registradaEm` | `location.timestamp` (milissegundos) — ou texto ISO |

| Código | Significado |
|---|---|
| `201` | `{ "recebidas": 3 }` |
| `400` | Dados inválidos, ou leitura com horário fora do período da viagem |
| `404` | Viagem não encontrada (ou é de outro usuário) |
| `409` | Viagem já encerrada ou expirada → o app deve parar de enviar |

**Recomendações para o app:**

- **Sem internet** (comum na estrada): guardar as leituras numa fila local e enviar o lote quando a conexão voltar.
  Como cada leitura leva o horário em que foi medida, nada se perde.
- Ao receber `409`: parar o envio e mostrar "Compartilhamento encerrado".
- **Intervalo de envio:** 5 s nos testes de campo (parâmetro avaliado no TCC; a simulação também testou 10 e 15 s).
- A viagem **expira sozinha após 3 horas** sem encerramento.

### `POST /viagens/:id/encerrar`

Sem corpo. Resposta: `200` com a viagem encerrada (chamar de novo não dá erro).

---

## 8. Códigos de status — resumo

| Código | Significado |
|---|---|
| `200` / `201` | Sucesso / criado |
| `204` | Sucesso sem conteúdo |
| `400` | Dados inválidos (ver `detalhes`) |
| `401` | Sem login ou token expirado → voltar ao login |
| `403` | Ação não autorizada (ex.: sem consentimento de localização) |
| `404` | Não encontrado |
| `409` | Conflito (e-mail repetido, horário sobreposto, viagem encerrada) |
| `500` | Erro interno — avisar a equipe do backend |

---

## 9. Pendências

- [x] Acesso fora da rede Wi-Fi de casa: túnel da Cloudflare (`cloudflared tunnel --url http://localhost:3333`).
  O endereço muda a cada reinício; no app ele fica em `mobile/.env.local`.
- [x] Intervalo de envio das leituras nos testes de campo: **5 segundos** (`INTERVALO_ENVIO_S` no app).
