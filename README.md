# GIFT Emissor de Pedido de Compra

Sistema simples em React + Vite para emitir pedido de compra interno da GIFT.

## O que tem

- Login simples com senha `asd123`.
- Cadastro de itens com link manual.
- Quantidade em texto livre, por exemplo: `2 kits com 10 un cada`.
- Campo separado `Qtd. para calculo`, usado para calcular subtotal.
- Calculo automatico de subtotal e total estimado.
- Botoes para adicionar, editar e apagar itens.
- PDF parecido com o modelo simples: logo no canto superior esquerdo, tabela dos itens e total estimado.
- Historico salvo no Supabase.
- Numeracao automatica: `PC-2026-0001`, `PC-2026-0002`, etc.

## Como rodar localmente

1. Instale as dependencias:

```bash
npm install
```

2. Copie o arquivo `.env.example` para `.env`:

```bash
cp .env.example .env
```

3. Preencha no `.env`:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_AQUI
VITE_APP_PASSWORD=asd123
```

4. Rode o projeto:

```bash
npm run dev
```

5. Acesse o link que aparecer no terminal.

## Supabase

No Supabase, abra o SQL Editor e rode o arquivo:

```txt
supabase/schema.sql
```

Para zerar todos os pedidos depois, rode:

```txt
supabase/reset.sql
```

## Trocar logo

Substitua o arquivo abaixo mantendo o mesmo nome:

```txt
public/logo-gift.png
```

Assim o sistema e o PDF passam a usar a logo nova.

## Deploy na Vercel

1. Suba esse projeto para o GitHub.
2. Importe na Vercel.
3. Configure as variaveis de ambiente:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_APP_PASSWORD`
4. Deploy.


## Novidades desta versão

- Dashboard com resumo de pendentes, aprovados e recusados.
- Filtro por status: todos, pendente, aprovado, recusado, com comprovante e sem comprovante.
- Botão para baixar histórico em CSV.
- Botão para baixar histórico completo em ZIP com:
  - `historico_pedidos.csv`
  - `itens_dos_pedidos.csv`
  - `historico_completo.json`
  - pasta `comprovantes/` com os anexos encontrados.
- Botão para exportar somente pedidos pendentes.
- Botão para limpar histórico com confirmação digitando `LIMPAR`.
- Motivo da recusa quando o financeiro recusar.
- Dados do pagamento ao anexar comprovante:
  - data do pagamento
  - forma de pagamento
  - responsável pelo pagamento
- Botão para reabrir pedido e voltar para pendente.
- Botão para duplicar pedido.
- ZIP enviado sem `node_modules`.

## Importante ao atualizar o Supabase

Rode novamente o arquivo:

```sql
supabase/schema.sql
```

Ele é seguro para atualização e adiciona as novas colunas e permissões necessárias para comprovantes e limpeza do histórico.
