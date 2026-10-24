/**
 * Alertas de datas de entrega — Google Apps Script
 *
 * Lê um ficheiro de texto do Google Drive (Google Doc ou .txt) e, quando
 * uma data se aproxima, envia um email para ti e para os colegas com quem
 * o ficheiro está partilhado.
 *
 * Formato esperado: uma data por linha, em qualquer posição da linha, ex.:
 *   15/11 - Teste de ML
 *   Entrega SRSI DNS Spoofing: 03/12/2026
 *   20-01-27 Exame Redes
 * (O ano é opcional. Se faltar, assume o próximo dia/mês que ainda vem.)
 */

// ===== CONFIGURAÇÃO =====
const FILE_ID = 'COLA_AQUI_O_ID_DO_FICHEIRO'; // parte do URL entre /d/ e /edit
const DIAS_AVISO = [7, 3, 1, 0];   // avisa quando faltarem exatamente estes dias
const JANELA_RESUMO = 14;          // o email lista também tudo o que vem nos próximos N dias
const INCLUIR_PARTILHADOS = true;  // envia também para quem tem acesso de edição ao ficheiro
const EMAILS_EXTRA = [];           // ex.: ['colega@iscte-iul.pt']
const HORA_DO_EMAIL = 8;           // hora aproximada do envio diário

// ===== FUNÇÃO PRINCIPAL (corre todos os dias) =====
function verificarDatas(forcar) {
  const hoje = semHoras_(new Date());
  const itens = lerDatas_(hoje);

  const urgentes = itens.filter(i => DIAS_AVISO.includes(i.faltam));
  if (urgentes.length === 0 && forcar !== true) return; // nada a avisar hoje

  const proximos = itens.filter(i => i.faltam <= JANELA_RESUMO);
  const assunto = urgentes.length
    ? '⏰ ' + urgentes.map(i => rotulo_(i.faltam) + ': ' + i.texto).join(' | ')
    : '📅 Próximas datas (teste)';

  let corpo = 'Datas nos próximos ' + JANELA_RESUMO + ' dias:\n\n';
  corpo += proximos.length
    ? proximos.map(i => '• ' + rotulo_(i.faltam) + ' (' + formatar_(i.data) + ') — ' + i.texto).join('\n')
    : '(nenhuma)';
  corpo += '\n\nFicheiro: https://drive.google.com/open?id=' + FILE_ID;

  MailApp.sendEmail(destinatarios_().join(','), assunto.slice(0, 250), corpo);
}

// Envia já um email com a lista, mesmo sem datas "de aviso" hoje — para testar.
function testar() {
  verificarDatas(true);
}

// Corre UMA vez para o script passar a correr sozinho todos os dias.
function criarAcionador() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'verificarDatas')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('verificarDatas')
    .timeBased().everyDays(1).atHour(HORA_DO_EMAIL).create();
}

// ===== AUXILIARES =====
function lerTexto_() {
  try {
    return DocumentApp.openById(FILE_ID).getBody().getText(); // Google Doc
  } catch (e) {
    return DriveApp.getFileById(FILE_ID).getBlob().getDataAsString(); // .txt
  }
}

function lerDatas_(hoje) {
  const itens = [];
  lerTexto_().split(/\r?\n/).forEach(linha => {
    const m = linha.match(/(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?/);
    if (!m) return;
    const dia = +m[1], mes = +m[2] - 1;
    if (mes < 0 || mes > 11 || dia < 1 || dia > 31) return;

    let ano = m[3] ? +m[3] : hoje.getFullYear();
    if (ano < 100) ano += 2000;
    let data = new Date(ano, mes, dia);
    if (!m[3] && data < hoje) data = new Date(ano + 1, mes, dia); // sem ano e já passou → próximo ano

    const faltam = Math.round((data - hoje) / 86400000);
    if (faltam < 0) return; // já passou
    itens.push({ data: data, faltam: faltam, texto: linha.trim() });
  });
  return itens.sort((a, b) => a.faltam - b.faltam);
}

function destinatarios_() {
  const emails = new Set(EMAILS_EXTRA);
  const meu = Session.getEffectiveUser().getEmail();
  if (meu) emails.add(meu);
  if (INCLUIR_PARTILHADOS) {
    const f = DriveApp.getFileById(FILE_ID);
    const dono = f.getOwner();
    if (dono) emails.add(dono.getEmail());
    f.getEditors().forEach(u => emails.add(u.getEmail()));
  }
  return [...emails].filter(Boolean);
}

function semHoras_(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function rotulo_(n) {
  return n === 0 ? 'HOJE' : n === 1 ? 'AMANHÃ' : 'faltam ' + n + ' dias';
}

function formatar_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy');
}
