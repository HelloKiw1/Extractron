# Organização do JavaScript do Extractron

O código JavaScript do Extractron foi separado por responsabilidade para facilitar a leitura, a manutenção e a evolução do sistema.

## Arquivo da interface

### [`interface.js`](interface.js)

Controla a interface do sistema, incluindo:

- seleção dos arquivos PDF;
- configuração do tamanho dos lotes;
- atualização do progresso;
- exibição de resultados e erros;
- filtros e seleção dos tipos de documento;
- interação com os campos da tela.

### [`tiposDeDocumentos.js`](tiposDeDocumentos.js)

Contém o catálogo dos tipos de documento disponíveis no sistema. Para cada tipo, armazena informações como ID, nome, padrão do nome do arquivo, existência de número, aceitação de letra e configurações de publicação.

Esse catálogo é disponibilizado em `window.tiposDeDocumentos` e utilizado pela interface e pelos extratores.

## Motor de processamento

Os arquivos abaixo ficam em [`extractron/`](extractron/).

### [`normalizacao.js`](extractron/normalizacao.js)

Reúne funções auxiliares para:

- remover ou comparar acentos;
- normalizar textos;
- limpar nomes de arquivos;
- extrair e validar datas;
- identificar tipos de documento pelo nome ou pelo conteúdo.

### [`extratores-base.js`](extractron/extratores-base.js)

Contém os extratores de documentos com regras próprias para:

- regimentos e emendas;
- resoluções;
- Diário Oficial;
- Projeto Político-Pedagógico (PPP).

### [`validacao-saida.js`](extractron/validacao-saida.js)

Valida os documentos extraídos conforme os campos obrigatórios e prepara os dados de saída. Também contém a geração e o download dos arquivos JSON.

### [`leitura-pdf.js`](extractron/leitura-pdf.js)

Faz a leitura técnica dos PDFs:

- abre o arquivo com PDF.js;
- carrega as páginas necessárias;
- tenta extrair o texto nativo;
- usa OCR quando o texto encontrado é insuficiente;
- aplica limites de tempo para evitar travamentos.

### [`extratores-especiais.js`](extractron/extratores-especiais.js)

Contém regras para documentos e situações especiais:

- despesas genéricas;
- julgamento de contas;
- atas;
- conversão de números romanos e datas por extenso.

### [`extrator-projeto-lei.js`](extractron/extrator-projeto-lei.js)

Extrai número, ano, letra, data e descrição de Projetos de Lei.

### [`extrator-lei.js`](extractron/extrator-lei.js)

Extrai informações de leis, priorizando dados encontrados no nome do arquivo e no texto do documento.

### [`extrator-portaria.js`](extractron/extrator-portaria.js)

Extrai dados de portarias, incluindo número, ano, letra, data e descrição.

### [`extrator-decreto.js`](extractron/extrator-decreto.js)

Extrai informações de decretos e identifica número, data e descrição do ato.

### [`extratores-administrativos.js`](extractron/extratores-administrativos.js)

Reúne os extratores de documentos administrativos:

- requerimentos;
- ofícios;
- declarações.

### [`orquestrador.js`](extractron/orquestrador.js)

É o ponto central da extração. Ele:

- decide qual extrator deve ser usado;
- combina tipo informado, nome do arquivo e conteúdo lido;
- aplica o extrator adequado;
- faz o pós-processamento do número e da letra do documento.

## Ordem de carregamento

Os arquivos são carregados pelo [`extractron.html`](../extractron.html) nesta ordem:

1. `normalizacao.js`
2. `extratores-base.js`
3. `validacao-saida.js`
4. `leitura-pdf.js`
5. `extratores-especiais.js`
6. `extrator-projeto-lei.js`
7. `extrator-lei.js`
8. `extrator-portaria.js`
9. `extrator-decreto.js`
10. `extratores-administrativos.js`
11. `orquestrador.js`
12. `interface.js`

A ordem é importante porque os arquivos usam funções auxiliares definidas nos arquivos carregados anteriormente. Os scripts são carregados como scripts tradicionais do navegador, e não como módulos ES (`import`/`export`).
