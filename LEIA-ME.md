# Formulário · Candidatura Instituto Longevity

Formulário em etapas para a vaga na clínica, no visual do app (o mesmo
design system documentado em `../design-system.html`). Cada envio vira uma
linha na planilha do Google.

```
formulario/
├─ index.html              o formulário inteiro (HTML, CSS e JS num arquivo só)
├─ assets/                logo (completa e só o texto), favicon e ícone do iPhone
├─ apps-script/Codigo.gs   backend que grava na planilha
├─ tests/codigo.test.mjs   testes do Codigo.gs (rodam com Node)
└─ LEIA-ME.md
```

## Como o formulário está organizado

Segue o onboarding do app: boas-vindas, 6 passos com os pontinhos de progresso
no topo e a tela de confirmação. Dá para voltar e corrigir antes de enviar.

| Passo | Perguntas |
|---|---|
| 1 · Sobre você | nome completo, idade, bairro ou cidade · WhatsApp com DDD |
| 2 · Formação e trabalho atual | curso, instituição e ano de conclusão · empresa, cargo e tempo atuais |
| 3 · Experiências anteriores | duas experiências: empresa, cargo e tempo (a segunda é opcional) |
| 4 · Saúde, vendas e equipe | três perguntas Sim/Não; o "Sim" abre um campo para contar mais |
| 5 · Ferramentas e condições | chips de ferramentas + outros · pretensão salarial · quando pode começar |
| 6 · Por que você | por que quer a vaga e o que traria para a clínica |

O **WhatsApp** não estava na lista original de perguntas: entrou porque sem
ele a clínica não tem como chamar o candidato. Para tirar, apague o bloco do
WhatsApp no `index.html` e a linha `['whatsapp', ...]` do `Codigo.gs` (os
testes avisam se os dois ficarem diferentes).

## Falta 1 coisa para ir ao ar: ligar a planilha

A planilha **já existe** e o `ID_PLANILHA` já está preenchido no `Codigo.gs`:
`1EOTolgwtMJWVCW5DDzk91XvXXjG2dY0_16PrqWP0ClQ`. Ela é privada; manter assim,
porque as respostas têm dados pessoais dos candidatos.

Faça logado na conta Google dona da planilha, de preferência numa janela
anônima ou num perfil do Chrome só com essa conta (várias contas Google
logadas no mesmo navegador costumam quebrar a autorização e a implantação).
O script roda como quem implanta e precisa poder editar a planilha.

1. Abra a planilha.
2. Vá em **Extensões → Apps Script**. Apague o conteúdo do `Código.gs` e cole
   tudo o que está em `apps-script/Codigo.gs`. Salve (Ctrl+S). Com o ID
   preenchido, um projeto separado em script.google.com também funciona.
3. Opcional: preencha `AVISAR` com os e-mails que devem receber um aviso a
   cada candidatura nova. Ex.: `var AVISAR = ['rh@suaclinica.com.br'];`
4. Rode a função `testarGravacao` uma vez e autorize o acesso quando o Google
   pedir (é normal aparecer o aviso "app não verificado": **Avançado → Acessar
   projeto**). A aba **Candidaturas** é criada sozinha com o cabeçalho.
   Confira a linha de teste e apague-a.
5. **Implantar → Nova implantação → Tipo: App da Web**
   - Executar como: **Eu**
   - Quem pode acessar: **Qualquer pessoa**
   - Implante e copie a **URL do app da Web** (termina em `/exec`).
6. No `index.html`, cole a URL no atributo `data-endpoint` do formulário:

```html
<form class="onb-shell" id="candidatura" data-endpoint="https://script.google.com/macros/s/AKfy.../exec" novalidate>
```

> Sempre que editar o `Codigo.gs`, é preciso **Implantar → Gerenciar
> implantações → editar → Nova versão**. Sem isso a URL continua servindo a
> versão antiga.

Enquanto o `data-endpoint` estiver vazio, o formulário funciona até o último
passo e, no envio, avisa que ainda não está ligado à planilha.

Para os candidatos abrirem, a pasta `formulario` precisa estar publicada num
endereço público (Vercel, Netlify, GitHub Pages ou o site da clínica). Abrir o
arquivo direto no computador serve para testar.

## Colunas gravadas

`Data/Hora · Nome completo · Idade · Bairro ou cidade · WhatsApp · Curso ·
Instituição · Ano de conclusão · Empresa atual (ou última) · Cargo atual (ou
último) · Tempo na empresa atual · Experiência 1 (empresa, cargo, tempo) ·
Experiência 2 (empresa, cargo, tempo) · Já trabalhou em saúde ou clínica ·
Saúde: onde e fazendo o quê · Experiência com vendas · Vendas: como foi · Já
coordenou equipe · Equipe: quantas pessoas e por quanto tempo · Ferramentas
que usa bem · Outras ferramentas · Pretensão salarial · Quando pode começar ·
Por que quer a vaga e o que traria`

A data usa o fuso da planilha: confira em **Arquivo → Configurações** se está
em São Paulo.

## Detalhes de implementação

- **Visual:** o CSS do app foi copiado sem alteração (tokens, botões, chips,
  onboarding, perguntas e campos). O que o design system não tinha ficou num
  bloco separado no fim do `<style>`: estado de erro em `--crit`, rótulos em
  `<label>`, campo isca e o respiro de 20px no celular.
- **Sempre claro:** o formulário não tem modo escuro. As regras escuras do app
  ficaram de fora e a página declara `color-scheme: only light`, que também
  impede o escurecimento automático de navegadores no celular.
- **Logo:** `assets/` saiu da logo enviada pela clínica, com o fundo branco
  transparente. No topo vai só o texto (a marca completa ficaria ilegível em
  28px de altura); a marca completa aparece na tela de boas-vindas.
- **Validação:** cada passo só avança com os obrigatórios preenchidos. Idade
  entre 16 e 80, WhatsApp com pelo menos 10 dígitos e, quando a resposta é
  "Sim", o campo de detalhe passa a ser obrigatório. O `Codigo.gs` confere de
  novo os obrigatórios antes de gravar.
- **Antispam:** campo honeypot `empresa_fax`, invisível na tela. Se vier
  preenchido, o script responde ok e não grava.
- **Planilha segura:** respostas que começam com `= + - @` são gravadas como
  texto, para ninguém injetar fórmula. Cada resposta é cortada em 2.000
  caracteres.
- **CORS:** o Apps Script não responde ao preflight, então o envio vai como
  `text/plain`. A página só mostra "Recebemos sua candidatura" quando a
  planilha responde `{ ok: true }`. Não existe reenvio em `no-cors`: ele
  escondia recusas do Google (implantação sem acesso público, por exemplo) e
  o candidato achava que tinha enviado sem nada chegar na planilha.
- **Implantação:** "Quem pode acessar" precisa ser **Qualquer pessoa**. Com
  "Somente eu" ou "Qualquer pessoa com Conta do Google", o Google pede login
  e o envio volta com erro 401.
- **Concorrência:** `LockService` evita que dois envios simultâneos escrevam
  na mesma linha.
- **Testes:** `node --test formulario/tests/codigo.test.mjs` (rodar na pasta Sistema-Longevity).
  Eles rodam o `Codigo.gs` de verdade com a planilha simulada e conferem que
  as colunas e os obrigatórios batem com os campos do `index.html`.
