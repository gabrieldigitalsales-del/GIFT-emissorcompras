# GIFT CONTROL - Quadro de Tarefas Inteligente

Sistema web simples para a GIFT EXCELLENCE, estilo Trello, com cards coloridos, períodos Dia/Semana/Mês/Ano e agora com aba separada de Histórico.

## Rodar localmente

```bash
npm install
npm run dev
```

Senha inicial:

```text
asd123
```

## Novidade desta versão

- Aba **Quadro** para tarefas.
- Aba **Histórico** separada.
- Registra automaticamente:
  - tarefa criada;
  - tarefa editada;
  - tarefa movida de coluna;
  - observação adicionada;
  - tarefa apagada.
- Botão para **baixar histórico em JSON**.
- Botão para **baixar histórico em CSV**, que abre no Excel.
- Botão para **limpar histórico** sem apagar tarefas.
- Busca dentro do histórico.
- Cards de resumo do histórico.

## Supabase

1. Crie um projeto no Supabase.
2. Rode o arquivo:

```text
supabase/schema.sql
```

3. Configure o `.env` com base no `.env.example`:

```text
VITE_SUPABASE_URL=sua_url
VITE_SUPABASE_ANON_KEY=sua_chave_anon
VITE_LOGIN_PASSWORD=asd123
```

Sem Supabase configurado, o sistema funciona em modo local usando `localStorage`.

## Reset

Para limpar tarefas e histórico:

```text
supabase/reset.sql
```

Esse reset não apaga arquivos diretamente de `storage.objects`.

## Deploy na Vercel

- Suba o projeto no GitHub.
- Importe na Vercel.
- Adicione as variáveis de ambiente:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_LOGIN_PASSWORD`
- Build command: `npm run build`
- Output: `dist`
