# Assistente IA — controle de uso sem faturamento

O assistente é **opcional**. Ele não é necessário para o cadastro, horários,
recomendações por regras ou rastreamento do ônibus.

## Pré-requisito externo

1. No Google AI Studio, confirme que **a chave pertence a um projeto Free e sem conta de faturamento vinculada**.
2. **Não habilite billing, plano pago, créditos pré-pagos ou upgrade** para esta chave/projeto.
3. Verifique no painel do Google as cotas e o consumo real do modelo. O aplicativo **não verifica o estado de faturamento do Google automaticamente**.
4. Respeite os Termos e a política de dados do Free Tier. Evite material pessoal ou sigiloso.

O controle do BUS.AI é uma camada adicional: **não é um teto monetário nem garante custo zero caso alguém ative faturamento externo**.

## Habilitação deliberada

No arquivo privado `backend/.env`, após confirmar o Free Tier:

```dotenv
ASSISTENTE_IA_HABILITADO="true"
GEMINI_API_KEY="CHAVE_PRIVADA"
GEMINI_MODEL="gemini-2.5-flash"
```

Por padrão, `ASSISTENTE_IA_HABILITADO` ausente ou diferente de `true` bloqueia a IA (503).
Sem chave, também é bloqueada. Nunca coloque a chave no `mobile/`, nunca faça commit do `.env`.

Para desativar imediatamente: altere para `ASSISTENTE_IA_HABILITADO="false"` e reinicie o backend.
O modelo aceito é explicitamente `gemini-2.5-flash` nesta versão; reavalie a disponibilidade gratuita antes de alterar.

## Limites internos conservadores

| Limite | Valor |
|---|---:|
| Consultas totais por dia (UTC) | 20 |
| Consultas por usuário por dia (UTC) | 6 |
| Consultas por usuário a cada 15 minutos | 3 |
| Requisições simultâneas | 2 |

A reserva é gravada em `backend/.cache/limites-ia.json` **antes** de consultar a API. O
arquivo está no `.gitignore`. Reiniciar o processo **não zera** a cota já registrada.
Erros e timeouts também consomem uma reserva, intencionalmente.

Se não for possível acessar/gravar o contador, o assistente falha sem enviar a requisição
ao Gemini. HTTP 429 do Google é apresentado como cota externa atingida, não repetido automaticamente.

**Limitações:** o controle funciona para uma única instância do backend que preserva o mesmo
diretório em disco. Não compartilha a cota entre múltiplas réplicas/servidores; apagar o arquivo
reinicia o contador. Não protege outros serviços, clientes ou aplicações que usem a mesma chave.
Para produção distribuída, use um controle transacional centralizado e credenciais isoladas.

O Gemini pode limitar a própria cota gratuita antes dos 20 pedidos; nesse caso o assistente
ficará indisponível sem afetar os recursos locais do aplicativo.

## Validação

```powershell
cd backend
npm test
npx tsc --noEmit
```

Teste que o assistente retorna 503 quando `ASSISTENTE_IA_HABILITADO=false`, depois
habilite a chave Free e faça consultas no app. Verifique que o arquivo
`backend/.cache/limites-ia.json` aparece e aumenta os contadores (sem expor a chave).
