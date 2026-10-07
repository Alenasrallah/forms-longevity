/**
 * ============================================================
 * CANDIDATURAS · VAGA NA CLÍNICA
 * Instituto Longevity
 * ------------------------------------------------------------
 * Recebe o formulário de formulario/index.html e grava uma linha
 * por candidatura na planilha.
 * Passo a passo de instalação: ver LEIA-ME.md na pasta formulario.
 * ============================================================
 */

/* ---------- CONFIGURAÇÃO ---------- */

// Deixe vazio se este script foi criado de dentro da planilha
// (Extensões → Apps Script). Se for um script separado, cole aqui o ID
// da planilha: o trecho entre /d/ e /edit na URL do Google Sheets.
var ID_PLANILHA = '';

// Aba onde as candidaturas são gravadas. Criada sozinha se não existir.
var ABA = 'Candidaturas';

// Avisar por e-mail a cada candidatura nova. Lista vazia = sem aviso.
var AVISAR = [];  // ex.: ['rh@suaclinica.com.br']

// Teto por resposta, para um envio malicioso não lotar a célula.
var LIMITE_CARACTERES = 2000;

// Uma entrada por coluna, na ordem da planilha:
// [nome do campo na página, título da coluna, obrigatório?]
var CAMPOS = [
  ['nome', 'Nome completo', true],
  ['idade', 'Idade', true],
  ['cidade', 'Bairro ou cidade', true],
  ['whatsapp', 'WhatsApp', true],
  ['curso', 'Curso', true],
  ['instituicao', 'Instituição', true],
  ['ano_conclusao', 'Ano de conclusão', true],
  ['empresa_atual', 'Empresa atual (ou última)', true],
  ['cargo_atual', 'Cargo atual (ou último)', true],
  ['tempo_atual', 'Tempo na empresa atual', true],
  ['exp1_empresa', 'Experiência 1 · empresa', true],
  ['exp1_cargo', 'Experiência 1 · cargo', true],
  ['exp1_tempo', 'Experiência 1 · tempo', true],
  ['exp2_empresa', 'Experiência 2 · empresa', false],
  ['exp2_cargo', 'Experiência 2 · cargo', false],
  ['exp2_tempo', 'Experiência 2 · tempo', false],
  ['saude', 'Já trabalhou em saúde ou clínica', true],
  ['saude_detalhe', 'Saúde · onde e fazendo o quê', false],
  ['vendas', 'Experiência com vendas', true],
  ['vendas_detalhe', 'Vendas · como foi', false],
  ['coordenacao', 'Já coordenou equipe', true],
  ['coordenacao_detalhe', 'Equipe · quantas pessoas e por quanto tempo', false],
  ['ferramentas', 'Ferramentas que usa bem', false],
  ['ferramentas_outras', 'Outras ferramentas', false],
  ['pretensao', 'Pretensão salarial', true],
  ['inicio', 'Quando pode começar', true],
  ['motivacao', 'Por que quer a vaga e o que traria', true]
];

/* ---------- ENTRADA HTTP ---------- */

function doPost(e) {
  var trava = LockService.getScriptLock();
  try {
    var dados = lerCorpo(e);

    // Honeypot: campo invisível na página. Se veio preenchido, é robô.
    // Respondemos ok para não dar pista ao script, mas não gravamos nada.
    if (dados.empresa_fax) return responder({ ok: true, ignorado: true });

    var faltando = camposFaltando(dados);
    if (faltando.length) {
      return responder({ ok: false, erro: 'Campos obrigatórios em branco: ' + faltando.join(', ') });
    }

    // Sem a trava, dois envios simultâneos podem gravar na mesma linha.
    trava.waitLock(20000);
    abaDeCandidaturas().appendRow(montarLinha(dados, new Date()));
    avisarEquipe(dados);
    return responder({ ok: true });

  } catch (erro) {
    return responder({ ok: false, erro: String(erro && erro.message || erro) });
  } finally {
    try { trava.releaseLock(); } catch (ignorado) {}
  }
}

// Abrir a URL /exec no navegador cai aqui. Serve só para conferir se a
// implantação está no ar.
function doGet() {
  return responder({ ok: true, servico: 'Candidaturas · Instituto Longevity' });
}

/* ---------- APOIO ---------- */

// A página envia JSON como text/plain para não disparar o preflight de CORS,
// mas aceitamos também form-urlencoded caso o envio venha de outro lugar.
function lerCorpo(e) {
  if (!e) return {};
  if (e.postData && e.postData.contents) {
    try {
      var json = JSON.parse(e.postData.contents);
      if (json && typeof json === 'object' && !Array.isArray(json)) return json;
    } catch (ignorado) {}
  }
  return e.parameter || {};
}

function camposFaltando(dados) {
  return CAMPOS
    .filter(function (campo) { return campo[2] && !limpar(dados[campo[0]]); })
    .map(function (campo) { return campo[1]; });
}

function montarLinha(dados, quando) {
  return [quando].concat(CAMPOS.map(function (campo) { return limpar(dados[campo[0]]); }));
}

// Corta no limite e neutraliza fórmulas: no Sheets, texto que começa com
// = + - @ vira fórmula. O apóstrofo na frente força texto puro.
function limpar(valor) {
  if (valor === null || valor === undefined) return '';
  var texto = String(valor).trim().slice(0, LIMITE_CARACTERES);
  if (/^[=+\-@]/.test(texto)) texto = "'" + texto;
  return texto;
}

function abaDeCandidaturas() {
  var planilha = ID_PLANILHA
    ? SpreadsheetApp.openById(ID_PLANILHA)
    : SpreadsheetApp.getActiveSpreadsheet();

  if (!planilha) throw new Error('Planilha não encontrada. Preencha ID_PLANILHA.');

  var aba = planilha.getSheetByName(ABA) || planilha.insertSheet(ABA);
  if (aba.getLastRow() === 0) {
    var cabecalho = ['Data/Hora'].concat(CAMPOS.map(function (campo) { return campo[1]; }));
    aba.appendRow(cabecalho);
    aba.getRange(1, 1, 1, cabecalho.length)
       .setFontWeight('bold')
       .setBackground('#050505')
       .setFontColor('#f5f5f3');
    aba.setFrozenRows(1);
    aba.setColumnWidth(1, 150);
    aba.setColumnWidth(2, 220);
    aba.setColumnWidth(cabecalho.length, 420);
  }
  return aba;
}

function avisarEquipe(dados) {
  if (!AVISAR.length) return;
  try {
    MailApp.sendEmail({
      to: AVISAR.join(','),
      subject: 'Nova candidatura · Instituto Longevity',
      htmlBody:
        '<p><strong>Nome:</strong> ' + escapar(limpar(dados.nome)) + '<br>' +
        '<strong>WhatsApp:</strong> ' + escapar(limpar(dados.whatsapp)) + '<br>' +
        '<strong>Bairro ou cidade:</strong> ' + escapar(limpar(dados.cidade)) + '<br>' +
        '<strong>Pretensão:</strong> ' + escapar(limpar(dados.pretensao)) + '</p>' +
        '<p>A candidatura completa está na aba ' + ABA + ' da planilha.</p>'
    });
  } catch (erro) {
    // Falha no aviso não pode derrubar a gravação da candidatura.
    console.error('Falha ao enviar aviso: ' + erro);
  }
}

function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function responder(objeto) {
  return ContentService
    .createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ---------- TESTE MANUAL ---------- */

// Rode esta função uma vez pelo editor para autorizar o script e conferir
// se a linha aparece na planilha. Apague a linha de teste depois.
function testarGravacao() {
  var resposta = doPost({
    postData: {
      contents: JSON.stringify({
        nome: 'Teste Longevity', idade: '30', cidade: 'Pinheiros', whatsapp: '(11) 90000-0000',
        curso: 'Administração', instituicao: 'Teste', ano_conclusao: '2020',
        empresa_atual: 'Teste', cargo_atual: 'Teste', tempo_atual: '1 ano',
        exp1_empresa: 'Teste', exp1_cargo: 'Teste', exp1_tempo: '1 ano',
        saude: 'Não', vendas: 'Não', coordenacao: 'Não',
        ferramentas: 'Excel ou Planilhas', pretensao: 'R$ 1', inicio: 'Imediato',
        motivacao: 'Linha de teste, pode apagar.'
      })
    }
  });
  console.log(resposta.getContent());
}
