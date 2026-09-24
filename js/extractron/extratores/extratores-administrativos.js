// Extractron - extratores de requerimento, ofício e declaração

        function extrairInformacoesRequerimento(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento) {
            const textoCompleto = normalizarTextoCompleto(texto);

            // Número: geralmente vem como "Requerimento nº 22/2026".
            let numeroDoDocumento = null;
            const matchNumero = textoCompleto.match(/\bREQUERIMENTO\b[^\n\r]{0,120}?\bN\s*[º°Oª\.]?\s*(\d{1,6})(?:\s*[\/-]\s*((?:19|20)\d{2}))?/i)
                || textoCompleto.match(/\bREQUERIMENTO\b[^\n\r]{0,120}?(\d{1,6})(?:\s*[\/-]\s*((?:19|20)\d{2}))?/i);
            if (matchNumero) {
                const n = matchNumero[1];
                const ano = matchNumero[2];
                numeroDoDocumento = ano ? `${n}/${ano}` : n;
            }

            const data = extrairDataPadrao(textoCompleto, nomeArquivo);

            // Descrição: preferir linha "ASSUNTO:" / "SOLICITO:" / "SOLICITA:".
            let descricao = null;
            const linhas = textoCompleto.split(/\r?\n/);
            const regexLinhaDescricao = /^\s*(ASSUNTO|SOLICITO|SOLICITA|SOLICITAÇÃO|SOLICITACAO|SOLICITAMOS)\s*[:\-–—]\s*(.{8,260})\s*$/i;
            const stopRegex = /^\s*(SENHOR(?:A)?\s+PRESIDENTE|AO\s+PRESIDENTE|REQUERENTE|REQUERIDO|O\s+VEREADOR|VEREADOR|C[ÂA]MARA\b|PODER\s+LEGISLATIVO)\b/i;
            for (let i = 0; i < linhas.length; i++) {
                const linha = linhas[i];
                const m = linha.match(regexLinhaDescricao);
                if (!m || !m[2]) continue;

                const partes = [m[2]];
                // Se a descrição quebrou de linha, anexar até 2 linhas seguintes,
                // parando ao encontrar marcadores típicos do corpo.
                for (let j = i + 1; j < Math.min(linhas.length, i + 4); j++) {
                    const prox = String(linhas[j] || '').trim();
                    if (!prox) break;
                    if (stopRegex.test(prox)) break;
                    if (/^\d{1,3}$/.test(prox)) break;

                    partes.push(prox);
                    if (/[.!?]$/.test(prox)) break;
                }

                descricao = partes.join(' ').replace(/\s+/g, ' ').trim();
                if (descricao.length > 260) descricao = descricao.slice(0, 260).trim();
                break;
            }

            if (!descricao) {
                const mAssunto = textoCompleto.match(/\bASSUNTO\b\s*[:\-–—]\s*([^\n\r]{8,260})/i);
                if (mAssunto && mAssunto[1]) descricao = mAssunto[1].replace(/\s+/g, ' ').trim();
            }

            if (!descricao) {
                const mSolicito = textoCompleto.match(/\bSOLICIT(?:O|A)\b\s*[:\-–—]\s*([^\n\r]{8,260})/i);
                if (mSolicito && mSolicito[1]) descricao = mSolicito[1].replace(/\s+/g, ' ').trim();
            }

            if (!descricao) {
                const mRequeiro = textoCompleto.match(/^\s*(?:REQUER|REQUEIRO|REQUEREMOS)\b\s*([^\n\r]{20,260})/im);
                if (mRequeiro && mRequeiro[1]) descricao = mRequeiro[1].replace(/\s+/g, ' ').trim();
            }

            if (!descricao) {
                descricao = limparDescricaoArquivo(nomeArquivo);
            }

            return {
                numero: numeroDocumento,
                arquivo: nomeArquivo,
                numeroDoDocumento: numeroDoDocumento,
                data: data || null,
                letra: 'R',
                descricao: descricao ? descricao.toUpperCase() : null,
                url: `${urlDocumentos}${encodeURIComponent(nomeArquivo)}`,
                tipoDocumento: tipoDocumento || 'Requerimento'
            };
        }

        function extrairInformacoesOficio(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento) {
            const textoCompleto = normalizarTextoCompleto(texto);
            const fonte = normalizarTextoCompleto(`${nomeArquivo || ''} ${textoCompleto}`);

            let numeroDoDocumento = null;
            const matchNumero = fonte.match(/\bOF[ií]CIO\b[\s\S]{0,140}?\bN\s*[º°Oª\.]?\s*(\d{1,6})(?:\s*[\/-]\s*((?:19|20)\d{2}))?/i)
                || fonte.match(/\bOF[ií]CIO\b[\s\S]{0,140}?(\d{1,6})(?:\s*[\/-]\s*((?:19|20)\d{2}))?/i);

            if (matchNumero) {
                const n = matchNumero[1];
                const ano = matchNumero[2] || extrairAnoDoNomeArquivo(nomeArquivo);
                numeroDoDocumento = ano ? `${n}/${ano}` : n;
            }

            const data = extrairDataPadrao(textoCompleto, nomeArquivo);

            let descricao = null;
            const mAssunto = textoCompleto.match(/\bASSUNTO\b\s*[:\-–—]\s*([\s\S]{8,260}?)(?=(?:\bILMO\b|\bILUSTRI\b|\bSENHOR\b|\bSR\b|\bPREZAD|\bATENCIOSAMENTE\b|\bMESA\b|\bCAMARA\b|$))/i);
            if (mAssunto && mAssunto[1]) {
                descricao = mAssunto[1].replace(/\s+/g, ' ').trim();
            }

            if (!descricao && numeroDoDocumento) {
                descricao = `OFÍCIO Nº ${numeroDoDocumento}`;
            }

            if (!descricao) {
                descricao = limparDescricaoArquivo(nomeArquivo);
            }

            return {
                numero: numeroDocumento,
                arquivo: nomeArquivo,
                numeroDoDocumento: numeroDoDocumento,
                data: data || null,
                letra: null,
                descricao: descricao ? descricao.toUpperCase() : null,
                url: `${urlDocumentos}${encodeURIComponent(nomeArquivo)}`,
                tipoDocumento: tipoDocumento || 'Ofício'
            };
        }

        // Resolve o tipo efetivo: se tipoDocumento já foi definido, mantém; senão tenta resolver
        // pelo cache de tipos, para garantir que o resultado sempre carrega o nome cadastrado.
        function extrairInformacoesDeclaracao(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento) {
            const textoCompleto = normalizarTextoCompleto(texto);
            const inicio = textoCompleto.substring(0, 2500);

            const obterDescricaoDeclaracaoPorNome = () => {
                const chaveArquivo = normalizarSemAcentos(limparDescricaoArquivo(nomeArquivo))
                    .toUpperCase()
                    .replace(/[^A-Z0-9]+/g, '');
                const descricoesPorArquivo = {
                    DECLARACAOATADEREGISTRO: 'DECLARA\u00c7\u00c3O ADES\u00c3O \u00c0 ATA DE REGISTROS DE PRE\u00c7OS',
                    DECLARACAOCONCURSO: 'DECLARA\u00c7\u00c3O SITUA\u00c7\u00c3O DO CONCURSO P\u00daBLICO E SELE\u00c7\u00d5ES P\u00daBLICAS',
                    DECLARACAOCONTAEXECUTIVO: 'DECLARA\u00c7\u00c3O CONTAS EXECUTIVO'
                };

                return descricoesPorArquivo[chaveArquivo] || null;
            };

            const limparDescricaoDeclaracao = (valor) => String(valor || '')
                .replace(/^[\s"'\u2018\u2019\u201c\u201d]+|[\s"'\u2018\u2019\u201c\u201d]+$/g, '')
                .replace(/\s+EM\s+ATEN(?:[\u00c7C][\u00c3A]O|CAO)\s+AOS?\s+PRINC[\s\S]*$/i, '')
                .replace(/\s+/g, ' ')
                .replace(/\s+([,.;:!?])/g, '$1')
                .trim();

            const corrigirDescricaoDeclaracao = (valor) => {
                const descricao = limparDescricaoDeclaracao(valor);
                const chave = normalizarSemAcentos(descricao)
                    .toUpperCase()
                    .replace(/[^A-Z0-9]+/g, '');
                const descricoesCanonicas = {
                    RESOLUCOES: 'resoluções',
                    TRANSFERENCIASRECEBIDASDECONVENIOS: 'transferências recebidas de convênios',
                    TRANSFERENCIASREALIZADASDECONVENIOS: 'transferências realizadas de convênios',
                    ACORDOSFIRMADOSSEMTRANSFERENCIADERECURSOSFINANCEIROS: 'acordos firmados sem transferência de recursos financeiros',
                    LISTADEESTAGIARIO: 'lista de estagiários',
                    LISTADEESTAGIARIOS: 'lista de estagiários',
                    LISTADETERCEIRIZADOS: 'lista de terceirizados',
                    CONCURSOSEPROCESSOSSELETIVOS: 'concursos e processos seletivos',
                    DEMAISCONCURSOSELISTADEAPROVADOS: 'demais concursos e lista de aprovados',
                    DIARIAS: 'diárias',
                    TABELADEVALORESDASDIARIAS: 'tabela de valores das diárias',
                    LICITACOES: 'licitações',
                    EDITAISDELICITACOES: 'editais de licitações',
                    ATADEADESAOSRP: 'ata de adesão - SRP',
                    PLANODECONTRATACOESANUAL: 'plano de contratações anual',
                    RELACOESDOSLICITANTESECONTRATADOSSANCIONADOSADMINISTRATIVAMENTE: 'relações dos licitantes e contratados sancionados administrativamente',
                    LISTADOSFISCAISDECONTRATOS: 'lista dos fiscais de contratos',
                    OBRAS: 'obras',
                    RELACAODEOBRASPARALISADAS: 'relação de obras paralisadas',
                    RELATORIODEGESTAOEATIVIDADES: 'relatório de gestão e atividades',
                    RESULTADODEAPRECIACAOEJULGAMENTODASCONTASPELOTRIBUNALDECONTAS: 'resultado de apreciação e julgamento das contas pelo tribunal de contas',
                    PLANOESTRATEGICOINSTITUCIONAL: 'plano estratégico institucional',
                    RELATORIOANUALESTATISTICO: 'relatório anual estatístico',
                    DOCUMENTOSCLASSIFICADOSPORGRAUDESIGILO: 'documentos classificados por grau de sigilo',
                    INFORMACOESDESCLASSIFICADAS: 'informações desclassificadas',
                    CARTADESERVICOSAOUSUARIO: 'carta de serviços ao usuário',
                    PAUTASDASSESSOESECOMISSOES: 'pautas das sessões e comissões',
                    ATASDASSESSOES: 'atas das sessões',
                    LISTADEVOTACOES: 'lista de votações',
                    RESULTADODEJULGAMENTODASCONTASDOCHEFEDOPODEREXECUTIVOPELOCHEFEDOPODERLEGISLATIVO: 'resultado de julgamento das contas do chefe do poder executivo pelo chefe do Poder Legislativo',
                    COTASPARAATIVIDADEPARLAMENTAR: 'cotas para atividade parlamentar'
                };

                return descricoesCanonicas[chave] || descricao;
            };

            const extrairDescricao = () => {
                const descricaoPorNome = obterDescricaoDeclaracaoPorNome();
                if (descricaoPorNome) return descricaoPorNome;

                const assuntoCorpo = inicio.match(/\bN[\u00c3A]O\s+possui\s+([\s\S]{3,260}?)(?=\s+(?:no\s+)?per[\u00edi]odo\s+(?:de\s*)?:|\s+no\s+per[\u00edi]odo\b|\s+durante\s+o\s+per[\u00edi]odo\b|[.;])/i);
                if (assuntoCorpo) {
                    const descricao = corrigirDescricaoDeclaracao(assuntoCorpo[1]);
                    if (descricao.length >= 3) return descricao;
                }

                const depoisTitulo = inicio.match(/\bDeclara[\u00e7c][\u00e3a]o\b\s*["'\u201c\u201d]\s*([^"'\u201c\u201d]{6,220})\s*["'\u201c\u201d]/i);
                if (depoisTitulo) {
                    const descricao = corrigirDescricaoDeclaracao(depoisTitulo[1]);
                    if (descricao.length >= 6) return descricao;
                }

                const primeiraAspa = inicio.match(/["'\u201c\u201d]\s*([^"'\u201c\u201d]{6,220})\s*["'\u201c\u201d]/);
                if (primeiraAspa) {
                    const descricao = corrigirDescricaoDeclaracao(primeiraAspa[1]);
                    if (descricao.length >= 6) return descricao;
                }

                const linhaAposTitulo = inicio.match(/\bDeclara[\u00e7c][\u00e3a]o\b\s+(.{6,220}?)(?=\bDeclaro\b|\bDeclaramos\b|$)/i);
                if (linhaAposTitulo) {
                    const descricao = corrigirDescricaoDeclaracao(linhaAposTitulo[1]);
                    if (descricao.length >= 6) return descricao;
                }

                return limparDescricaoArquivo(nomeArquivo) || null;
            };

            const extrairDataDeclaracao = () => {
                const normalizarAno = (valorAno) => String(valorAno || '').replace(/\D/g, '').slice(0, 4);
                const assinatura = textoCompleto.match(/\bDados\s*:\s*((?:\d[\s\.,]*){4})[\.\/-](\d{1,2})[\.\/-](\d{1,2})/i);
                if (assinatura) {
                    const ano = normalizarAno(assinatura[1]);
                    const mes = String(parseInt(assinatura[2], 10)).padStart(2, '0');
                    const dia = String(parseInt(assinatura[3], 10)).padStart(2, '0');
                    if (ano.length === 4) return `${dia}/${mes}/${ano}`;
                }

                const datas = extrairDatasPadraoOrdenadas(textoCompleto);
                if (datas.length) return datas[datas.length - 1].data;

                return extrairDataPadrao(textoCompleto, nomeArquivo);
            };

            const descricao = extrairDescricao();
            const data = extrairDataDeclaracao();

            return {
                numero: numeroDocumento,
                arquivo: nomeArquivo,
                numeroDoDocumento: null,
                data: data || null,
                letra: null,
                descricao: descricao ? descricao.toUpperCase().substring(0, 300) : null,
                url: `${urlDocumentos}${encodeURIComponent(nomeArquivo)}`,
                tipoDocumento: tipoDocumento || resolverTipoNome('Declaracao') || 'Declaracao'
            };
        }

