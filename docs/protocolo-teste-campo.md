# Protocolo do teste de campo — Geolocalização colaborativa

**Projeto:** BUS.AI — TCC II, Sistemas de Informação, UEMG Passos
**Tipo de avaliação:** teste real em campo (não confundir com a simulação de dados sintéticos)
**Trajeto:** Ônibus Prefeitura de Bom Jesus da Penha → UEMG (Passos)
**Instrumento de coleta:** aplicativo BUS.AI (botão "Estou no ônibus"), em dois modos:
- **Android: APK** (EAS Build), com coleta **em segundo plano**: continua com a tela bloqueada.
- **iPhone: Expo Go**, com coleta **só com a tela ligada**.

Plano B: página coletora (`coletor.html`). Todos usam as mesmas rotas da API e o mesmo intervalo de 5 s;
registrar o instrumento e o modo de cada aparelho.

---

## 1. Objetivo

Avaliar, em condições reais, a posição do ônibus estimada pelo BUS.AI a partir dos smartphones dos alunos, respondendo:

1. Qual o erro da posição estimada com **1, 2 e 3 smartphones**?
2. Com que frequência o sistema consegue informar a posição durante o trajeto (**disponibilidade**)?
3. Quanto tempo as leituras levam para chegar ao servidor (**atraso de rede**), considerando trechos sem sinal?
4. O tratamento de outliers é acionado em condições reais? Com que frequência?

## 2. Ideia central do desenho

**Uma única viagem com 3 smartphones gera os três cenários.** Todas as leituras brutas ficam gravadas no banco.
Na análise, a posição é recalculada com o mesmo algoritmo do sistema usando:

- cada smartphone sozinho (cenário de 1 dispositivo);
- cada par de smartphones (cenário de 2 dispositivos);
- os três juntos (cenário de 3 dispositivos).

Assim, os três cenários são comparados **nas mesmas condições** (mesmo trajeto, horário, clima e trânsito).

## 3. Posição de referência (como saber onde o ônibus realmente estava)

Usaremos **pontos de controle**: locais fixos do trajeto, com coordenadas conhecidas, onde um observador anota o
**horário exato (com segundos)** em que o ônibus passa ao lado deles.

- Escolher de **6 a 10 pontos** ao longo do trajeto: pontos de parada, entrada de cidade, trevos, quebra-molas,
  portões, a entrada da UEMG. **Preferir locais onde o ônibus reduz a velocidade ou para**, porque um atraso de
  2 segundos na anotação, a 60 km/h, já representa cerca de 33 m.
- Coordenadas obtidas no Google Maps (botão direito → copiar coordenadas).
- Limitação a declarar na monografia: as coordenadas do Google Maps e a anotação manual do horário têm erro próprio
  (alguns metros e alguns segundos).

**Momentos de ônibus parado** (por exemplo, embarque de alunos) são especialmente valiosos: a posição real não muda
e o erro do GPS pode ser medido sem a influência do movimento. Anotar horário de início e fim de cada parada.

### Planilha de pontos de controle (preencher antes do teste)

| # | Ponto de controle | Latitude | Longitude |
|---|---|---|---|
| 1 | | | |
| 2 | | | |
| 3 | | | |
| 4 | | | |
| 5 | | | |
| 6 | | | |

## 4. Materiais e participantes

| Item | Detalhe |
|---|---|
| Smartphones | 3 aparelhos, de preferência de **modelos diferentes** (registrar modelo e sistema de cada um), com o **Expo Go** instalado e **dados móveis** funcionando |
| Contas | **Uma conta real por aparelho** (ex.: `campo1@...`, `campo2@...`, `campo3@...`). Nunca usar as contas `simulador...` |
| Participantes | Membros da equipe ou colegas que **concordaram** em participar. Nenhum dado de outros passageiros é coletado |
| Energia | Bateria acima de 80% e **carregador portátil obrigatório** para cada aparelho (a tela fica ligada a viagem inteira) |
| Observador | 1 pessoa responsável por anotar os horários nos pontos de controle |
| PC de casa | Ligado, com backend, PostgreSQL, túnel e Expo em execução, e suspensão desativada |

### Registro dos aparelhos

| Aparelho | Conta | Modelo / sistema | Instrumento (APK segundo plano, Expo Go tela ligada ou coletor) | Posição no ônibus |
|---|---|---|---|---|
| A | | | | ex.: frente, janela esquerda |
| B | | | | ex.: meio, corredor |
| C | | | | ex.: fundo, janela direita |

Na análise, os aparelhos aparecem como A, B e C, na ordem alfabética do identificador `usuario-<id>` mostrado na
exportação (seção 6). Anote essa correspondência nesta tabela.

## 5. Procedimento

### 5.1 Antes de sair de casa

1. No PC: `npm run dev` (pasta `backend`) e, em outro terminal, `cloudflared tunnel --url http://localhost:3333`.
2. Anotar o endereço do túnel. Ele **muda** a cada vez que o túnel é reiniciado.
3. Colocar o endereço em `mobile/.env.local` (`EXPO_PUBLIC_API_URL=...`).
4. Em um terceiro terminal, na pasta `mobile`: `npx expo start --tunnel -c`.
   O `--tunnel` é necessário porque, fora de casa, os celulares não estão na mesma rede Wi-Fi do PC.
   Sem ele, o Expo Go só carrega o app pela rede local.
5. Desativar a suspensão do PC: `powercfg /change standby-timeout-ac 0`.
   Nos smartphones, desligar o **modo de economia de bateria** (ele pode pausar o GPS e o app).
6. Nos **Android com o APK**: na tela Entrar, tocar em **"Servidor · alterar"**, colar o endereço do túnel e conferir
   "Servidor encontrado". Em Configurações → Apps → BUS.AI → Bateria, escolher **"Sem restrições"**.
   Os passos 4 e 8 (Expo com `--tunnel`, não fechar o Expo Go) valem só para os iPhones.
7. Em cada smartphone, **com o Wi-Fi desligado** (só dados móveis):
   - escanear o QR code e abrir o app no Expo Go;
   - entrar com a conta do aparelho (`campo1@...`, `campo2@...`, `campo3@...`);
   - no **Perfil**, conferir o ônibus escolhido e a localização autorizada.
8. **Não fechar o Expo Go depois disso.** Se o app for fechado no ônibus, ele precisa carregar de novo pela internet,
   o que pode falhar na estrada. Nesse caso, usar o plano B.

**Plano B (página coletora):** no `backend/.env`, colocar `HABILITAR_COLETOR="true"` e reiniciar o `npm run dev`.
No aparelho, abrir `<endereço-do-túnel>/coletor.html` no navegador e fazer login.

### 5.2 No embarque

1. Em todos os aparelhos, tocar **"Estou no ônibus"** na tela Início ao mesmo tempo
   (no coletor: selecionar o ônibus, intervalo de 5 segundos, marcar a autorização e tocar no botão).
2. Permitir o acesso à localização se o celular pedir.
3. Conferir em cada aparelho o cartão verde **"Compartilhando localização"** e o contador "Leituras enviadas" subindo
   a cada ~5 s (no coletor: "Tela sempre ligada: sim").
4. Anotar o **horário de partida**.

### 5.3 Durante o trajeto

- **iPhone (Expo Go) e coletor: app aberto e tela ligada durante toda a viagem.** Não bloquear a tela, não trocar
  de aplicativo e não guardar o celular no bolso: o envio **para** quando o app sai da tela (ver o teste piloto na seção 9).
- **Android (APK):** pode bloquear a tela. Conferir que a notificação "BUS.AI: compartilhando a localização do ônibus"
  continua visível.
- Manter o celular na mão, no colo ou num suporte, ligado ao carregador portátil.
- Em cada ponto de controle, o observador confere se os cartões dos aparelhos continuam **verdes** e com o contador
  "Leituras enviadas" subindo. Se um aparelho saiu da tela, anotar o horário e o aparelho.
- Se o cartão mostrar **"GPS impreciso"** (precisão acima de 100 m), anotar o horário: essas leituras são descartadas.
- O observador anota o horário (HH:MM:SS, pelo relógio do celular) da passagem por cada ponto de controle.
- Anotar ocorrências: trechos sem sinal, paradas, desvios, um aparelho que travou ou apagou a tela.

### Planilha do observador

| Ponto de controle | Horário (HH:MM:SS) | Ônibus parado? | Observação |
|---|---|---|---|
| | | | |

### 5.4 No desembarque

1. Tocar **"Desci do ônibus"** em todos os aparelhos.
2. Anotar, de cada aparelho, a mensagem final: "Última viagem: N leitura(s) enviadas" ou
   "N leitura(s) não puderam ser enviadas".

### 5.5 De volta ao PC

1. Exportar as leituras da viagem e rodar a análise (ver seção 6).
2. Desligar o túnel (Ctrl+C) e restaurar a suspensão: `powercfg /change standby-timeout-ac 30`.
3. Guardar as planilhas preenchidas (foto ou digitação) junto com o CSV exportado.

**Repetições:** realizar o teste **pelo menos em 2 viagens** (por exemplo, ida e volta), para ter mais dados.

## 6. Exportação dos dados

No PC onde o backend rodou durante a viagem, com o PostgreSQL ligado, na pasta `backend`:

1. Ver as viagens do dia (data no horário de Brasília):

   ```
   npx tsx scripts/exportar-viagens.ts --listar=2026-11-04
   ```

   A tabela mostra o número de cada viagem, a conta, a linha, o início, o fim e quantas leituras ela tem.
   O dia é considerado no horário de Brasília: uma viagem às 22:30 aparece no dia certo, embora o banco a guarde
   como 01:30 UTC do dia seguinte.

2. Exportar as viagens do teste (uma por aparelho), separando os números por vírgula:

   ```
   npx tsx scripts/exportar-viagens.ts --viagens=94,95,96
   ```

   O CSV é gravado em `scripts/resultados/campo-AAAA-MM-DD-viagens-....csv`. Ele **não leva e-mails**: cada aparelho
   aparece como `usuario-<id>`. A correspondência com as contas aparece só no terminal; anote-a no registro dos aparelhos.

### Pontos de controle em CSV

Digitar a planilha do observador em `backend/scripts/campo/pontos-AAAA-MM-DD.csv`, com o horário de Brasília:

```
ponto,latitude,longitude,data_hora
Trevo de BJP,-20.0000000,-46.0000000,2026-11-04 07:12:35
Entrada da UEMG,-20.7348774,-46.6256805,2026-11-04 07:41:10
```

Só entram as passagens efetivamente anotadas. Não completar horários faltantes.

### Rodar a análise

Na pasta `backend`:

```
npx tsx scripts/analisar-campo.ts --leituras=scripts/resultados/campo-2026-11-04-viagens-94-95-96.csv --pontos=scripts/campo/pontos-2026-11-04.csv
```

O script recalcula a posição com o **mesmo algoritmo do sistema** (`estimarPosicao`) para cada aparelho sozinho,
cada par e os três juntos. Ele considera, em cada instante, só as leituras que **já tinham chegado ao servidor**
(`recebidaEm`), como o sistema real. Resultados em `scripts/resultados/analise-campo-...-*.csv`:

| Arquivo | Conteúdo |
|---|---|
| `...-aparelhos.csv` | Precisão informada e atraso de rede de cada aparelho |
| `...-disponibilidade.csv` | Percentual da viagem com posição, por combinação de aparelhos, e descartes de outliers |
| `...-erros.csv` | Erro em cada ponto de controle, por combinação, com a idade da leitura usada |

As funções da análise têm testes automatizados em `src/geolocalizacao/analise.test.ts` (`npm test`).

## 7. Métricas da análise

| Métrica | Como é calculada |
|---|---|
| Erro da posição | Distância entre a posição estimada no horário anotado e a coordenada do ponto de controle |
| Erro por cenário | Erro médio, mediana e maior erro com 1, 2 e 3 aparelhos (recalculados a partir das leituras brutas) |
| Disponibilidade | Percentual do tempo de viagem em que havia posição estimada (leitura com menos de 60 s) |
| Atraso de rede | `recebidaEm − registradaEm` de cada leitura (mostra o efeito dos trechos sem sinal) |
| Precisão informada | Distribuição da precisão (`precisaoMetros`) relatada por cada aparelho |
| Outliers | Quantas vezes o algoritmo descartou leituras, e por qual motivo |

## 8. Cuidados de interpretação

- Os resultados valem **para este trajeto, nestes aparelhos e nestas condições**. Não generalizar para "qualquer ônibus".
- Com poucos pontos de controle e poucas viagens, a amostra é pequena: apresentar os valores observados sem
  afirmar diferenças que estejam dentro da variação.
- Registrar tudo o que deu errado: falhas também são resultado e mostram limites do sistema.
- Nunca completar dados faltantes com estimativas, nem misturar dados simulados com dados de campo.

## 9. Registro das execuções

| Data | Tipo | Trajeto | Aparelhos | Instrumento | Pontos de controle | Observações |
|---|---|---|---|---|---|---|
| 04/11/2026, 22:11–23:49 | **Teste piloto** | UEMG → cidade de origem | 1 | App | Não | 32 leituras em 97,4 min (esperadas ~1.169 a cada 5 s); disponibilidade de 4,4%; maior atraso de rede de 1.508 s. Indica que o app ficou fora da tela na maior parte da viagem, quando o Expo Go pausa a coleta. Motivou a regra "app aberto e tela ligada" da seção 5.3 |

O teste piloto **não entra** nas métricas de erro nem na comparação entre 1, 2 e 3 aparelhos: ele documenta a
limitação da coleta com o app fora da tela.

