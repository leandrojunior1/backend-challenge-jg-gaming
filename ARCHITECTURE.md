# Documentação Arquitetural (ARCHITECTURE.md)

## Visão Geral

Este documento descreve as decisões arquiteturais (ADRs - *Architecture Decision Records*), os padrões de projeto e a metodologia de desenvolvimento aplicados na construção deste microsserviço financeiro voltado para o cenário de iGaming.

O objetivo principal do sistema é processar transações de apostas garantindo precisão financeira, consistência de dados em ambientes de alta concorrência e resiliência na comunicação distribuída.

---

## 1. Princípios Arquiteturais e Metodologia

### Domain-Driven Design (DDD) Tático e Arquitetura Limpa

O domínio contém entidades, Value Objects e regras de negócio, como as operações de saldo e as regras de transação, sem depender diretamente do banco de dados, ORM, HTTP ou mensageria. A camada de aplicação coordena esses elementos, mas atualmente usa entidades e `EntityManager` do MikroORM diretamente para persistência; portanto, a separação de infraestrutura não é completa nessa camada.

* **Por quê:** Manter as regras de domínio testáveis e reduzir seu acoplamento a frameworks. A dependência direta do MikroORM na camada de aplicação é uma característica atual da implementação e deve ser considerada caso o ORM ou a estratégia de persistência mudem.

### Metodologia AI-DLC (AI-Driven Development Life Cycle)

O desenvolvimento seguiu um fluxo iterativo com uso de Inteligência Artificial como co-piloto (*Pair Programming*).

* **Validação Cruzada e Self-Consistency:** A geração de código assistida foi submetida a testes de consistência e auditoria humana. Isso permitiu identificar e corrigir casos de borda precocemente — como a prevenção de acesso a referências inexistentes em fluxos de aposta perdida (`LOSS`) e a normalização de strings de moedas (ex.: `"BRL"`).

---

## 2. Decisões Arquiteturais Críticas (ADRs)

### ADR 001: Controle de Concorrência com Lock Pessimista

**Contexto:** Em um ambiente de iGaming, múltiplas requisições simultâneas podem tentar debitar do mesmo saldo (condição de corrida). Leituras concorrentes sem bloqueio poderiam permitir gastar o mesmo saldo duas vezes e produzir um saldo inválido.

**Decisão:** Utilização de **Lock Pessimista** (`SELECT ... FOR UPDATE`, via `LockMode.PESSIMISTIC_WRITE` do MikroORM) na linha da carteira durante o processamento da aposta, dentro de uma transação do banco de dados.

**Consequência:** Uma transação bloqueia a carteira enquanto atualiza seu saldo. Requisições paralelas à mesma carteira aguardam a liberação do lock e, em seguida, leem o saldo atualizado. A carteira também tem uma restrição no banco de dados que impede saldo negativo.

### ADR 002: Consistência de Mensageria com Padrão Transactional Outbox

**Contexto:** O sistema enfrenta o problema da dupla escrita (*Dual-Write Problem*): é necessário persistir alterações financeiras e notificar outros microsserviços via AWS SQS. Falhas de rede poderiam fazer com que o dinheiro fosse debitado sem que o evento fosse emitido, ou vice-versa.

**Decisão:** Implementação do padrão **Transactional Outbox**.

**Consequência:** A transação da carteira, os registros de *ledger* (quando aplicáveis) e as mensagens de Outbox correspondentes são gravados na mesma transação SQL. Um *worker* em segundo plano lê a tabela `outbox_messages` e publica os eventos no SQS, tentando novamente em caso de falha com intervalo crescente. Assim, eventos pendentes permanecem persistidos para novas tentativas quando a mensageria estiver indisponível. A publicação pode ser repetida se houver uma falha depois do envio ao SQS e antes de marcar a mensagem como publicada; consumidores devem tolerar entregas repetidas.

### ADR 003: Precisão Matemática com Value Objects para Dinheiro

**Contexto:** Operações financeiras usando tipos primitivos de ponto flutuante (`number` no JavaScript/TypeScript) podem gerar imprecisões e arredondamentos incorretos (ex.: `0.1 + 0.2 = 0.30000000000000004`).

**Decisão:** Uso de um **Value Object `Money`** que encapsula valores por meio da biblioteca `decimal.js`. Os valores são normalizados para duas casas decimais e persistidos em colunas `numeric` com escala 2.

**Consequência:** Operações de débito, crédito e verificações de invariantes da carteira não dependem da aritmética binária de ponto flutuante de JavaScript. O Value Object também impede operações entre moedas diferentes.

### ADR 004: Prevenção de Duplicidade com Reprocessamento Idempotente

**Contexto:** Falhas temporárias de rede (timeouts) podem fazer com que o cliente tente enviar a mesma requisição de aposta várias vezes, gerando cobranças duplicadas.

**Decisão:** O endpoint exige o header `Idempotency-Key` e armazena seu valor junto da transação. No estado atual, a identificação de uma transação já processada é feita pela combinação de `providerId` e `externalTransactionId`, protegida por uma restrição única no banco de dados. O sistema compara também o hash do payload: uma repetição com o mesmo identificador externo e o mesmo payload retorna a transação existente; se o payload divergir, a requisição é rejeitada com conflito.

**Consequência:** A restrição única e o replay protegem o saldo contra a aplicação duplicada da mesma transação do provedor. A `Idempotency-Key` é armazenada e usada como correlação dos eventos, mas não é, por si só, a chave consultada para detectar duplicatas. Uma implementação futura que pretenda deduplicar exclusivamente por essa chave deverá alterar a estratégia de identificação e suas restrições de persistência.
