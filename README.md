# ⏰ Alertas de Datas (Google Apps Script)

Script em **Google Apps Script** que lê um ficheiro de texto do Google Drive com datas de entregas, testes ou exames e **envia emails automáticos** quando uma dessas datas se está a aproximar.

Foi pensado para trabalhos de grupo: o ficheiro fica partilhado no Drive e o alerta chega a todos os colegas com acesso de edição, sem configuração extra.

---

## ✨ Funcionalidades

- 📄 Lê **Google Docs** ou ficheiros **.txt** do Google Drive
- 📅 Deteta datas em qualquer posição da linha (`15/11`, `03/12/2026`, `20-01-27`, `5.2`)
- 🔔 Avisa quando faltam **7, 3 e 1 dias** e no **próprio dia** (configurável)
- 📬 Envia para ti e para **todos os editores do ficheiro**, que são detetados automaticamente
- 📋 Cada email inclui um **resumo de tudo o que vem nos próximos 14 dias**
- 🔁 Corre sozinho **uma vez por dia**, através de um acionador do Apps Script
- 🤫 Não envia nada nos dias em que não há avisos

---

## 📝 Formato do ficheiro

Escreve uma data por linha, junto da descrição:

```text
15/11 - Teste de Aprendizagem Automática
Entrega SRSI (DNS Spoofing): 03/12/2026
20-01-27 Exame de Redes
```

- O **ano é opcional**. Se faltar, o script assume a próxima ocorrência desse dia e mês.
- As linhas sem data são ignoradas, por isso podes ter títulos e notas no ficheiro.
- As datas que já passaram são ignoradas.
- Se uma linha tiver duas datas, só a primeira é considerada.

---

## 🚀 Instalação

1. Abre o [script.google.com](https://script.google.com) e cria um **Novo projeto**.
2. Apaga o código de exemplo e cola o conteúdo de [`alertas-datas.gs`](alertas-datas.gs).
3. Em `FILE_ID`, coloca o ID do teu ficheiro. É a parte do URL entre `/d/` e `/edit`:
   ```
   https://docs.google.com/document/d/ESTE_É_O_ID/edit
   ```
4. Em ⚙️ **Definições do projeto**, define o fuso horário (ex.: `Europe/Lisbon`).
5. Seleciona a função **`testar`** e clica em **Executar**. Aceita as permissões pedidas pelo Google. Vais receber um email com as próximas datas.
6. Seleciona a função **`criarAcionador`** e executa-a **uma vez**. A partir daí o script corre todos os dias de forma automática.

---

## ⚙️ Configuração

As opções estão no topo do ficheiro:

| Constante | Valor por omissão | Descrição |
|---|---|---|
| `FILE_ID` | — | ID do ficheiro no Google Drive |
| `DIAS_AVISO` | `[7, 3, 1, 0]` | Número de dias antes da data em que é enviado aviso |
| `JANELA_RESUMO` | `14` | Quantos dias à frente o resumo do email mostra |
| `INCLUIR_PARTILHADOS` | `true` | Envia também aos editores do ficheiro |
| `EMAILS_EXTRA` | `[]` | Outros destinatários (ex.: `['colega@iscte-iul.pt']`) |
| `HORA_DO_EMAIL` | `8` | Hora aproximada do envio diário |

> Se alterares `HORA_DO_EMAIL`, volta a executar `criarAcionador`. A função remove o acionador antigo e cria um novo.

---

## 🧩 Funções

| Função | Para que serve |
|---|---|
| `verificarDatas()` | Função principal, chamada todos os dias pelo acionador |
| `testar()` | Envia o resumo já, mesmo que hoje não haja avisos |
| `criarAcionador()` | Configura a execução diária automática |

---

## ⚠️ Notas

- O formato das datas é **dia/mês**, como em Portugal. `03/12` é 3 de dezembro.
- Os emails são enviados a partir da conta Google de quem instalou o script. As contas gratuitas têm um limite diário de envios, que é largamente suficiente para este uso.
- Para desligar os alertas, apaga o acionador em ⏰ **Acionadores** no editor do Apps Script.

---

## 👤 Autor

**Joel Monteiro**: Mestrado em Engenharia Informática, ISCTE-IUL
