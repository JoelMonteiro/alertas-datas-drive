# 🤖 ALERTS-BOT ⏰

**Agenda partilhada de entregas, testes e exames, com email diário via Google Apps Script.**

Script em **Google Apps Script** que lê um Google Doc partilhado com as datas do mestrado e **envia todos os dias um email** com o que há hoje, amanhã e nas próximas semanas, em contagem decrescente.

O ficheiro fica partilhado no Drive e o email chega a todos os colegas com acesso de edição, sem configuração extra.

![Email do ALERTS-BOT](email-mestrado.png)

---

## ✨ Funcionalidades

- 📄 Lê **Google Docs** ou ficheiros **.txt** do Google Drive
- 📬 **Email todos os dias**, mesmo quando não há nada para hoje, para ver o que vem a seguir
- 🗓️ **5 secções:** Hoje · Amanhã · Próximos 7 dias · Próximos 15 dias · Próximos 30 dias
- ⏳ **Contagem decrescente** em cada evento (`T-06`), com o dia da semana (`sex 27/11`)
- 🔴 **Hoje em destaque**, num painel próprio, mesmo quando está vazio
- 📊 **Painel de contadores:** hoje, amanhã, 7 dias, 30 dias e total
- 👥 Envia para ti e para **todos os editores do ficheiro**, que são detetados automaticamente
- 🧪 **Teste só para ti** (`testarSoParaMim`), para experimentar sem incomodar os colegas
- 🎨 **Formatação mantida:** o negrito, itálico, sublinhado, rasurado, cor e links do Doc aparecem no email
- 🏫 **Visual "ISCTE-tech":** tema claro, cabeçalho azul-marinho, legível em qualquer cliente de email

---

## 📝 Formato do ficheiro

Uma linha por evento, com a data no início:

```text
DATA - EVENTO
```

```text
📚 DATAS DO MESTRADO
23/11/2026 - Entrega do trabalho de Criptografia (SRSI)
27/11/2026 - Exame de Aprendizagem Automática
03/12/2026 - Apresentação de ADS
```

- A data aceita `dd/mm/aaaa`, `dd-mm-aaaa` ou `dd.mm.aa`. O ano é opcional: se faltar, o script assume a próxima ocorrência desse dia e mês. Mesmo assim, recomenda-se pôr **sempre o ano**.
- O ` - ` entre a data e o evento é opcional, mas facilita a leitura. A data não é repetida no texto do email, porque já aparece formatada por baixo.
- Escreve as horas com "h" (`às 10h30`), nunca `10.30` ou `10/30`, para não serem confundidas com datas.
- **Linhas ignoradas:** linhas sem data (títulos e notas), texto dentro de tabelas, datas impossíveis (ex.: `31/02`), eventos que já passaram e o bloco de comentário `/* ... */`, se existir.

Cada evento aparece no email todos os dias desde que faltem 30 dias até ao próprio dia.

---

## 📬 O email

**Assunto:** `🤖 ALERTS-BOT ⏰ · sáb 21/11 · 1 hoje`

A data no assunto impede que o Gmail agrupe os emails de vários dias numa única conversa. Podes desligá-la com `ASSUNTO_COM_DATA = false`.

| Secção | Dias que faltam |
|---|---|
| **Hoje** (painel destacado) | 0 |
| **Amanhã** | 1 |
| **Próximos 7 dias** | 2 a 7 |
| **Próximos 15 dias** | 8 a 15 |
| **Próximos 30 dias** | 16 a 30 |

As secções vazias ficam escondidas (`MOSTRAR_SECOES_VAZIAS`), exceto o Hoje. O painel de contadores mostra sempre todos os números, incluindo os zeros.

---

## 🚀 Instalação

1. Abre o [script.google.com](https://script.google.com) e cria um **Novo projeto**.
2. Apaga o código de exemplo e cola o conteúdo de [`alertas-datas.gs`](alertas-datas.gs).
3. Em `FILE_ID`, coloca o ID do teu ficheiro. É a parte do URL entre `/d/` e `/edit`:
   ```
   https://docs.google.com/document/d/ESTE_É_O_ID/edit
   ```
4. Em `EMAIL_TESTE`, coloca o teu email.
5. Em ⚙️ **Definições do projeto**, define o fuso horário (ex.: `Europe/Lisbon`).
6. Seleciona a função **`testarSoParaMim`** e clica em **Executar**. Aceita as permissões pedidas pelo Google. Vais receber o email do dia só na tua caixa, com `[TESTE]` no assunto.
7. Quando estiver tudo bem, seleciona a função **`criarAcionador`** e executa-a **uma vez**. A partir daí o script envia o email a todos, todos os dias, de forma automática.

---

## ⚙️ Configuração

As opções estão no topo do ficheiro:

| Constante | Valor por omissão | Descrição |
|---|---|---|
| `FILE_ID` | — | ID do ficheiro no Google Drive |
| `INCLUIR_PARTILHADOS` | `true` | Envia também ao dono e aos editores do ficheiro |
| `EMAILS_EXTRA` | `[]` | Outros destinatários (ex.: `['colega@iscte-iul.pt']`) |
| `EMAIL_TESTE` | — | Único destinatário de `testarSoParaMim()` |
| `HORA_DO_EMAIL` | `8` | Hora aproximada do envio diário |
| `NOME_BOT` | `'ALERTS-BOT'` | Nome do remetente e do cabeçalho |
| `MENSAGEM_BOT` | `'Agenda do Mestrado Engenharia Informática'` | Subtítulo do cabeçalho |
| `DESTAQUE_HOJE` | `true` | Secção Hoje num painel destacado |
| `MOSTRAR_SECOES_VAZIAS` | `false` | Mostra todas as secções, mesmo vazias |
| `ASSUNTO_COM_DATA` | `true` | Inclui a data no assunto |
| `JANELAS` | 0 · 1 · 2–7 · 8–15 · 16–30 | Secções de tempo, com título e nível de cor |
| `T` | tema ISCTE-tech | Cores do email: cada nível tem uma cor principal e um tom claro |

> Se alterares `HORA_DO_EMAIL`, volta a executar `criarAcionador`. A função remove o acionador antigo e cria um novo.

---

## 🧩 Funções

| Função | Para que serve |
|---|---|
| `verificarDatas()` | Função principal, chamada todos os dias pelo acionador. Envia para todos. |
| `testar()` | Envia já o email do dia para **todos** os destinatários |
| `testarSoParaMim()` | Envia o email do dia **só** para `EMAIL_TESTE` |
| `criarAcionador()` | Configura a execução diária automática |

### Como funciona por dentro

```text
lerLinhas_()   → lê o Doc, ignora tabelas e o bloco de comentário
lerItens_()    → encontra a data de cada linha, calcula os dias que faltam
recolher_()    → distribui os eventos pelas 5 secções e conta
montarHtml_()  → email HTML (tabelas + estilos inline, para o Gmail)
montarTexto_() → versão em texto simples
```

---

## ⚠️ Notas

- O formato das datas é **dia/mês**.
- Os eventos passados **não são apagados** do Doc, porque o ficheiro é partilhado. Simplesmente deixam de aparecer no email.
- Como o tema é claro, as cores muito claras do Doc (ex.: branco) são substituídas pela cor do tema para não ficarem invisíveis.
- As cores do tema são inspiradas no ISCTE e não correspondem à paleta oficial. Podem ser ajustadas no objeto `T`.
- Os emails são enviados a partir da conta Google de quem instalou o script. As contas gratuitas têm um limite diário de envios, que é largamente suficiente para este uso.
- Para desligar os envios, apaga o acionador em ⏰ **Acionadores**, no editor do Apps Script.

---

## 👤 Autor

**Joel Monteiro**: Mestrado em Engenharia Informática, ISCTE-IUL
