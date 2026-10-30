# Distributed Wagering Processor

## Rodar localmente

1. Copie `.env.example` para `.env` e troque `API_KEY` por uma chave aleatória.
2. Instale as dependências com `npm install`.
3. Inicie PostgreSQL e LocalStack: `docker compose up -d`.
4. Crie as tabelas: `npm run migration:up`.
5. Inicie a API: `npm run start:dev`.

O guard HTTP exige `X-API-Key`. As filas SQS são criadas pelo serviço `sqs-init` do Compose.

## Testes

- `npm test` executa os testes unitários.
- `npm run test:e2e` executa o teste de concorrência contra a API já iniciada.

As credenciais e senhas do exemplo são apenas para desenvolvimento local. Use segredos fortes e HTTPS fora do ambiente local.
