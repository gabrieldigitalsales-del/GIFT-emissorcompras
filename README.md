# GIFT Emissor de Pedido de Compra

Sistema simples em React + Vite para emissão interna de pedidos de compra da GIFT.

## Fluxo do sistema

1. O setor de compras monta o pedido com os itens, links e valores.
2. O pedido é salvo como **Pendente** no histórico.
3. O PDF pode ser gerado e enviado ao financeiro.
4. O financeiro entra no mesmo web app, aprova ou recusa.
5. Quando a compra for paga, o financeiro anexa o comprovante. Ao anexar comprovante, o pedido é marcado como **Aprovado** automaticamente.

## O que tem no projeto

- Login simples com senha padrão `asd123`
- Visual empresarial em preto, branco, cinza e vermelho
- Fonte genérica do sistema: Arial/Helvetica
- Cadastro de itens com link manual
- Campo de quantidade livre para aparecer no PDF
- Campo separado para cálculo: quantidade de kits/produtos x valor do kit/produto
- Cálculo automático de subtotal e total
- Editar/apagar itens
- Histórico no Supabase
- Status: Pendente, Aprovado e Recusado
- Upload de comprovante no Supabase Storage
- PDF simples com logo no canto superior esquerdo, tabela e total estimado

## Como rodar

```bash
npm install
npm run dev
```

Depois acesse o endereço que aparecer no terminal.

## Supabase

1. Crie um projeto no Supabase.
2. Vá em **SQL Editor**.
3. Rode o arquivo:

```txt
supabase/schema.sql
```

Esse SQL cria:

- Tabela de pedidos
- Tabela de itens
- Numeração automática
- Campos de comprovante
- Bucket `gift-pedido-comprovantes`
- Policies para leitura, gravação e atualização

## Configurar variáveis

Copie o arquivo `.env.example` para `.env` e preencha:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon
VITE_APP_PASSWORD=asd123
```

## Resetar pedidos

Para limpar pedidos e itens e começar do zero, rode:

```txt
supabase/reset.sql
```

Observação: o reset não apaga arquivos do Storage. O Supabase não permite apagar diretamente pela tabela `storage.objects`. Se quiser limpar comprovantes, apague pelo painel do Storage no Supabase.

## Deploy na Vercel

- Envie o projeto para o GitHub.
- Importe na Vercel.
- Configure as mesmas variáveis de ambiente do `.env`.
- Build command: `npm run build`
- Output: `dist`
