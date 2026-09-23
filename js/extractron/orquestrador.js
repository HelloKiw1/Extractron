// Extractron - roteamento final e pós-processamento

        function resolverTipoNome(tipoDetectado) {
            if (!tipoDetectado) return tipoDetectado;
            const norm = normalizarBusca(tipoDetectado);
            const encontrado = tiposDocumentosCache.find(t => normalizarBusca(t.nome) === norm)
                || tiposDocumentosCache.find(t => normalizarBusca(t.nome).includes(norm))
                || tiposDocumentosCache.find(t => norm.includes(normalizarBusca(t.nome)));
            return encontrado ? encontrado.nome : tipoDetectado;
        }

        function extrairInformacoes(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento) {
            console.log(`[DEBUG] Processando arquivo: ${nomeArquivo}`);
            console.log(`[DEBUG] Primeiros 200 chars do texto:`, texto.substring(0, 500));

            // Helper: usa o tipo fornecido se não-nulo, senão resolve pelo nome detectado
            const tipo = (nomeDetectado) => tipoDocumento || resolverTipoNome(nomeDetectado);
            const nomeArquivoNormalizado = normalizarBusca(nomeArquivo);
            const tipoDetectadoPeloNome = detectarTipoPeloNome(nomeArquivo);
            const tipoDetectadoPelaUrl = detectarTipoDespesaPeloNome(urlDocumentos);
            const tipoSelecionadoNormalizado = normalizarBusca(tipoDocumento);
            const contextoJulgamentoContas = isContextoJulgamentoContas(nomeArquivo, urlDocumentos, texto.substring(0, 1200));

            // Quando o tipo foi selecionado manualmente, prioriza esse roteamento.
            if (tipoSelecionadoNormalizado) {
                if (contextoJulgamentoContas && /\bdecreto\b/.test(tipoSelecionadoNormalizado)) {
                    console.log(`[DEBUG] ${nomeArquivo} -> Detectado como JULGAMENTO DE CONTAS pelo nome/URL com tipo Decreto selecionado`);
                    return extrairInformacoesJulgamentoContas(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento);
                }

                if (isTipoOficio(tipoDocumento)) {
                    console.log(`[DEBUG] ${nomeArquivo} -> Detectado como OFICIO pelo tipo selecionado`);
                    const res = extrairInformacoesOficio(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento);
                    return pósProcessarNumero(res, texto, nomeArquivo);
                }

                if (/\brequerimento\b/.test(tipoSelecionadoNormalizado)) {
                    console.log(`[DEBUG] ${nomeArquivo} -> Detectado como REQUERIMENTO pelo tipo selecionado`);
                    const res = extrairInformacoesRequerimento(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento);
                    return pósProcessarNumero(res, texto, nomeArquivo);
                }

                if (isTipoDeclaracao(tipoDocumento)) {
                    console.log(`[DEBUG] ${nomeArquivo} -> Detectado como DECLARACAO pelo tipo selecionado`);
                    return extrairInformacoesDeclaracao(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento);
                }

                if (tipoDocumentoSemNumero(tipoDocumento)) {
                    console.log(`[DEBUG] ${nomeArquivo} -> Detectado como DESPESA/CONTABIL pelo tipo selecionado`);
                    return extrairInformacoesDespesaGenerica(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento);
                }

                if (/\bcontrato\b|aditivo\s+de\s+contrato|extrato\s+de\s+contrato/.test(tipoSelecionadoNormalizado)) {
                    console.log(`[DEBUG] ${nomeArquivo} -> Detectado como CONTRATO pelo tipo selecionado`);
                    return extrairInformacoesDespesaGenerica(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento);
                }

                if (isTipoDiario(tipoDocumento)) {
                    console.log(`[DEBUG] ${nomeArquivo} -> Detectado como DIARIO pelo tipo selecionado`);
                    return extrairInformacoesDiario(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento);
                }

                if (isTipoProjetoPoliticoPedagogico(tipoDocumento)) {
                    console.log(`[DEBUG] ${nomeArquivo} -> Detectado como PPP pelo tipo selecionado`);
                    return extrairInformacoesPPP(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento);
                }

                if (isTipoResolucao(tipoDocumento)) {
                    console.log(`[DEBUG] ${nomeArquivo} -> Detectado como RESOLUCAO pelo tipo selecionado`);
                    return extrairInformacoesResolucao(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento);
                }

                if (isTipoJulgamentoContas(tipoDocumento)) {
                    console.log(`[DEBUG] ${nomeArquivo} -> Detectado como JULGAMENTO DE CONTAS pelo tipo selecionado`);
                    return extrairInformacoesJulgamentoContas(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento);
                }

                if (/\bata\b|\batas\b/.test(tipoSelecionadoNormalizado)) {
                    console.log(`[DEBUG] ${nomeArquivo} -> Detectado como ATA pelo tipo selecionado`);
                    const res = extrairInformacoesAta(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento);
                    return pósProcessarNumero(res, texto, nomeArquivo);
                }

                if (/\bprojeto\s+de\s+lei\b/.test(tipoSelecionadoNormalizado)) {
                    console.log(`[DEBUG] ${nomeArquivo} -> Detectado como PROJETO DE LEI pelo tipo selecionado`);
                    const res = extrairInformacoesProjetoLei(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento);
                    return pósProcessarNumero(res, texto, nomeArquivo);
                }

                if (/\bportaria\b/.test(tipoSelecionadoNormalizado)) {
                    console.log(`[DEBUG] ${nomeArquivo} -> Detectado como PORTARIA pelo tipo selecionado`);
                    const res = extrairInformacoesPortaria(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento);
                    return pósProcessarNumero(res, texto, nomeArquivo);
                }

                if (/\bdecreto\b/.test(tipoSelecionadoNormalizado)) {
                    console.log(`[DEBUG] ${nomeArquivo} -> Detectado como DECRETO pelo tipo selecionado`);
                    const res = extrairInformacoesDecreto(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento);
                    return pósProcessarNumero(res, texto, nomeArquivo);
                }

                if (/\blei\b/.test(tipoSelecionadoNormalizado)) {
                    console.log(`[DEBUG] ${nomeArquivo} -> Detectado como LEI pelo tipo selecionado`);
                    const res = extrairInformacoesLei(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento);
                    return pósProcessarNumero(res, texto, nomeArquivo);
                }

                if (isTipoRegimentoOuEmenda(tipoDocumento)) {
                    console.log(`[DEBUG] ${nomeArquivo} -> Detectado como REGIMENTO/EMENDA pelo tipo selecionado`);
                    const res = extrairInformacoesRegimentoEmenda(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento);
                    return pósProcessarNumero(res, texto, nomeArquivo);
                }
            }

            const indicioOficioPorNome = /^of[_\-\s\.]*\d{3,6}[\.\-_](?:19|20)\d{2}/i.test(String(nomeArquivo || ''));
            const indicioOficioPorTexto = /\bOF[ií]CIO\b/i.test(String(texto || '').substring(0, 1200));
            if (indicioOficioPorNome || indicioOficioPorTexto) {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como OFICIO pelo conteúdo/nome`);
                const res = extrairInformacoesOficio(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo('Ofício'));
                return pósProcessarNumero(res, texto, nomeArquivo);
            }

            if (/di[aá]rio\s+oficial/i.test(`${nomeArquivo} ${texto.substring(0, 700)}`)) {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como DIARIO pelo conteúdo/nome`);
                return extrairInformacoesDiario(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo('Diário Oficial'));
            }

            if (/projeto\s+pol[ií]tico\s+pedag[óo]gico|\bppp\b/i.test(texto.substring(0, 1200))) {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como PPP pelo conteúdo`);
                return extrairInformacoesPPP(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo('Projeto Político Pedagógico'));
            }

            if (tipoDetectadoPeloNome && /contrato|procedimentos?\s+licitatorios?|homologacao|ata\s+de\s+registro\s+de\s+precos/.test(normalizarBusca(tipoDetectadoPeloNome))) {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como PROCEDIMENTO/CONTRATO pelo detector de nome`);
                return extrairInformacoesDespesaGenerica(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo(tipoDetectadoPeloNome));
            }

            if (isTipoDeclaracao(tipoDetectadoPeloNome)) {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como DECLARACAO pelo detector de nome`);
                return extrairInformacoesDeclaracao(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo('Declaracao'));
            }

            if (tipoDetectadoPeloNome && tipoDocumentoSemNumero(tipoDetectadoPeloNome)) {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como DESPESA/CONTABIL pelo detector de nome`);
                return extrairInformacoesDespesaGenerica(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo(tipoDetectadoPeloNome));
            }

            const tipoProcedimentoDetectadoPeloConteudo = detectarTipoProcedimentoPeloConteudo(texto);
            if (tipoProcedimentoDetectadoPeloConteudo) {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como PROCEDIMENTO/CONTRATO pelo conteúdo`);
                return extrairInformacoesDespesaGenerica(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo(tipoProcedimentoDetectadoPeloConteudo));
            }

            const tipoDespesaDetectadoPeloConteudo = detectarTipoDespesaPeloConteudo(texto);
            if (tipoDespesaDetectadoPeloConteudo) {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como DESPESA/CONTABIL pelo conteúdo`);
                return extrairInformacoesDespesaGenerica(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo(tipoDespesaDetectadoPeloConteudo));
            }

            if (tipoDetectadoPelaUrl && tipoDocumentoSemNumero(tipoDetectadoPelaUrl)) {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como DESPESA/CONTABIL pela URL`);
                return extrairInformacoesDespesaGenerica(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo(tipoDetectadoPelaUrl));
            }

            if (tipoDetectadoPeloNome === 'Ata') {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como ATA pelo detector de nome`);
                const res = extrairInformacoesAta(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo('Ata'));
                return pósProcessarNumero(res, texto, nomeArquivo);
            }

            if (tipoDetectadoPeloNome === 'Projeto de Lei') {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como PROJETO DE LEI pelo detector de nome`);
                const res = extrairInformacoesProjetoLei(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo('Projeto de Lei'));
                return pósProcessarNumero(res, texto, nomeArquivo);
            }

            if (tipoDetectadoPeloNome === 'Portaria') {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como PORTARIA pelo detector de nome`);
                const res = extrairInformacoesPortaria(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo('Portaria'));
                return pósProcessarNumero(res, texto, nomeArquivo);
            }

            if (tipoDetectadoPeloNome === 'Decreto') {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como DECRETO pelo detector de nome`);
                const res = extrairInformacoesDecreto(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo('Decreto'));
                return pósProcessarNumero(res, texto, nomeArquivo);
            }

            if (tipoDetectadoPeloNome === 'Lei') {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como LEI pelo detector de nome`);
                const res = extrairInformacoesLei(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo('Lei'));
                return pósProcessarNumero(res, texto, nomeArquivo);
            }

            if (tipoDetectadoPeloNome === 'Regimentos' || tipoDetectadoPeloNome === 'Emenda Parlamentar') {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como REGIMENTO/EMENDA pelo detector de nome`);
                const res = extrairInformacoesRegimentoEmenda(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo(tipoDetectadoPeloNome));
                return pósProcessarNumero(res, texto, nomeArquivo);
            }

            if (tipoDetectadoPeloNome === 'Resolucoes') {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como RESOLUCAO pelo detector de nome`);
                return extrairInformacoesResolucao(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo('Resolucoes'));
            }

            if (tipoDetectadoPeloNome === 'Julgamento de Contas') {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como JULGAMENTO DE CONTAS pelo detector de nome`);
                return extrairInformacoesJulgamentoContas(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo('Julgamento de Contas'));
            }

            if (tipoDetectadoPeloNome === 'Requerimento') {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como REQUERIMENTO pelo detector de nome`);
                const res = extrairInformacoesRequerimento(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo('Requerimento'));
                return pósProcessarNumero(res, texto, nomeArquivo);
            }

            // PRIORIDADE 1: Verificar pelo NOME DO ARQUIVO (mais confiável)
            if (/(^|[\s_\-])leis?(?:\d{2,4})?(?:\s+n)?[°ºª\s\-\d\/]*(?=$|[\s_\-])/i.test(nomeArquivo)) {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como LEI pelo nome do arquivo`);
                const res = extrairInformacoesLei(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo('Lei'));
                return pósProcessarNumero(res, texto, nomeArquivo);
            }
            
            // PRIORIDADE 2: Verificar se é PORTARIA pelo nome
            if (/^N\d+/i.test(nomeArquivo) || /PORTARIA/i.test(nomeArquivo)) {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como PORTARIA pelo nome do arquivo`);
                const res = extrairInformacoesPortaria(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo('Portaria'));
                return pósProcessarNumero(res, texto, nomeArquivo);
            }
            
            // PRIORIDADE 3: Verificar se é DECRETO pelo nome
            if (/\bdecreto\b/i.test(nomeArquivo)) {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como DECRETO pelo nome do arquivo`);
                const res = extrairInformacoesDecreto(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo('Decreto'));
                return pósProcessarNumero(res, texto, nomeArquivo);
            }
            
            // PRIORIDADE 4: Verificar se é ATA pelo nome
            if (/(^|[\s_\-])ata(?:s)?(?=$|[\s_\-])/i.test(nomeArquivo)) {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como ATA pelo nome do arquivo`);
                const res = extrairInformacoesAta(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo('Ata'));
                return pósProcessarNumero(res, texto, nomeArquivo);
            }
            
            // FALLBACK: Verificar pelo CONTEÚDO do texto
            
            // Verificar se é uma ATA
            const isAta = /\bATA\b/i.test(texto.substring(0, 1500))
                || /(^|[\s_\-])ata(?:s)?(?=$|[\s_\-])/.test(nomeArquivoNormalizado);
            if (isAta) {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como ATA pelo conteúdo`);
                const res = extrairInformacoesAta(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo('Ata'));
                return pósProcessarNumero(res, texto, nomeArquivo);
            }

            const isRequerimento = /\bREQUERIMENTO\b/i.test(texto.substring(0, 2000))
                || /requerimento/.test(nomeArquivoNormalizado);
            if (isRequerimento) {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como REQUERIMENTO pelo conteúdo/nome`);
                const res = extrairInformacoesRequerimento(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo('Requerimento'));
                return pósProcessarNumero(res, texto, nomeArquivo);
            }

            const inicioDeclaracao = texto.substring(0, 1500);
            const inicioDeclaracaoNormalizado = normalizarBusca(inicioDeclaracao);
            const isDeclaracao = /\bDeclara[\u00e7c][\u00e3a]o\b\s*["'\u201c\u201d]/i.test(inicioDeclaracao)
                || /\bdeclaracao\b\s+[\"']?ausencia\s+de\s+declaracao\b/.test(inicioDeclaracaoNormalizado);
            if (isDeclaracao) {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como DECLARACAO pelo conteudo`);
                return extrairInformacoesDeclaracao(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo('Declaracao'));
            }
            
            // Verificar se é um PROJETO DE LEI
            const isProjetoLei = /PROJETO\s+DE\s+LEI|\bPROJ\.?\s*(?:ETO\s*)?(?:DE\s*)?LEI\b|\bP\.?\s*L\.?\b/i.test(texto.substring(0, 900));
            if (isProjetoLei) {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como PROJETO DE LEI pelo conteúdo`);
                const res = extrairInformacoesProjetoLei(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo('Projeto de Lei'));
                return pósProcessarNumero(res, texto, nomeArquivo);
            }

            // Verificar se é PORTARIA pelo conteúdo
            const inicioResolucao = normalizarSemAcentos(texto.substring(0, 1200)).toUpperCase();
            const isResolucao = /R\s*E\s*S\s*O\s*L\s*U\s*C?\s*A\s*O\s*(?:N|:|\d)/.test(inicioResolucao);
            if (isResolucao) {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como RESOLUCAO pelo conteudo`);
                return extrairInformacoesResolucao(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo('Resolucoes'));
            }

            const temPalavraPortaria = /PORTARIA/i.test(texto.substring(0, 500));
            if (temPalavraPortaria) {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como PORTARIA pelo conteúdo`);
                const res = extrairInformacoesPortaria(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo('Portaria'));
                return pósProcessarNumero(res, texto, nomeArquivo);
            }

            // Verificar se é Lei pelo conteúdo (regex mais flexível)
            const isLei = /L\s*E\s*I|LEI/i.test(texto.substring(0, 500));
            if (isLei) {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como LEI pelo conteúdo`);
                const res = extrairInformacoesLei(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo('Lei'));
                return pósProcessarNumero(res, texto, nomeArquivo);
            }
            
            // Verificar se é DECRETO pelo conteúdo
            const isDecreto = /DECRETO/i.test(texto.substring(0, 500));
            if (isDecreto) {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como DECRETO pelo conteúdo`);
                const res = extrairInformacoesDecreto(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo('Decreto'));
                return pósProcessarNumero(res, texto, nomeArquivo);
            }

            const isRegimentoOuEmenda = /\bREGIMENTO\b|\bEMENDA\b/i.test(texto.substring(0, 2000))
                || /regimento|emenda/.test(nomeArquivoNormalizado);
            if (isRegimentoOuEmenda) {
                console.log(`[DEBUG] ${nomeArquivo} -> Detectado como REGIMENTO/EMENDA pelo conteúdo`);
                const tipoSugestao = /emenda/.test(`${nomeArquivoNormalizado} ${normalizarSemAcentos(texto.substring(0, 500)).toLowerCase()}`)
                    ? 'Emenda Parlamentar'
                    : 'Regimentos';
                const res = extrairInformacoesRegimentoEmenda(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipo(tipoSugestao));
                return pósProcessarNumero(res, texto, nomeArquivo);
            }

            console.error(`[ERRO] ${nomeArquivo} -> Nenhum padrão detectado!`);
            console.error(`[ERRO] Primeiros 500 caracteres:`, texto.substring(0, 500));

            // Tentativa de inferir dados a partir do nome do arquivo (fallback)
            try {
                const arquivo = String(nomeArquivo || '');
                const arquivoNorm = arquivo.replace(/[_\-]+/g, ' ');
                const anoMatch = arquivo.match(/(19|20)\d{2}/);
                const meses = {
                    janeiro: '01', fevereiro: '02', marco: '03', marcoo: '03', 'março': '03', abril: '04', maio: '05', junho: '06',
                    julho: '07', agosto: '08', setembro: '09', outubro: '10', novembro: '11', dezembro: '12'
                };
                const mesRegex = new RegExp(Object.keys(meses).join('|'), 'i');
                const mesMatch = arquivoNorm.match(mesRegex);

                if (mesMatch && anoMatch) {
                    const mesKey = mesMatch[0].toLowerCase();
                    const mesNum = meses[mesKey] || meses[mesKey.normalize('NFD').replace(/[^a-z]/g, '')];
                    const ano = Number(anoMatch[0]);
                    const m = Number(mesNum || '01');
                    // Último dia do mês: criar Date com dia 0 do próximo mês
                    const ultimoDia = new Date(ano, m, 0).getDate();
                    const iso = `${ano}-${String(m).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

                    // Tentar inferir tipo de documento pelo nome do arquivo
                    let tiposLista = [];
                    if (typeof tiposDocumentosCache !== 'undefined' && Array.isArray(tiposDocumentosCache) && tiposDocumentosCache.length) {
                        tiposLista = tiposDocumentosCache;
                    } else if (window.tiposDeDocumentos && Array.isArray(window.tiposDeDocumentos)) {
                        tiposLista = window.tiposDeDocumentos;
                    }

                    const normalizar = (v) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
                    const normalizarCompacto = (v) => normalizar(v).replace(/[^a-z0-9]+/g, '');
                    const nomeBusca = normalizar(arquivo.replace(/\.[^.]+$/, '').replace(/[_\-]+/g, ' '));
                    const nomeBuscaCompacto = normalizarCompacto(arquivo.replace(/\.[^.]+$/, ''));

                    let tipoDetectado = null;
                    for (const t of tiposLista) {
                        const nomeNorm = normalizar(t.nome || t.nome_arquivo || '');
                        const nomeNormCompacto = normalizarCompacto(t.nome || t.nome_arquivo || '');
                        const nomeArquivoNormCompacto = normalizarCompacto(t.nome_arquivo || '');
                        if (!nomeNorm) continue;
                        if (
                            nomeBusca.includes(nomeNorm) ||
                            nomeNorm.includes(nomeBusca) ||
                            (t.nome_arquivo && nomeBusca.includes(normalizar(t.nome_arquivo))) ||
                            (nomeNormCompacto && (nomeBuscaCompacto.includes(nomeNormCompacto) || nomeNormCompacto.includes(nomeBuscaCompacto))) ||
                            (nomeArquivoNormCompacto && nomeBuscaCompacto.includes(nomeArquivoNormCompacto))
                        ) {
                            tipoDetectado = t.nome || null;
                            break;
                        }
                    }

                    return {
                        erro: null,
                        arquivo: nomeArquivo,
                        numeroDoDocumento: null,
                        data: iso,
                        descricao: arquivo,
                        tipoDocumento: tipoDetectado
                    };
                }
            } catch (e) {
                console.warn('[WARN] fallback inferencia a partir do nome do arquivo falhou', e);
            }

            return {
                erro: "Documento não possui regex",
                arquivo: nomeArquivo,
                numeroDoDocumento: null,
                data: null,
                descricao: null
            };
        }

        // Normaliza/extrai número e letra de várias fontes (campo existente, texto ou nome de arquivo)
        function pósProcessarNumero(resultado, texto, nomeArquivo) {
            // Se já tem numeroDoDocumento, normalize e separe letra
            const normalize = (raw) => {
                if (!raw) return { numero: null, letra: null };
                let s = String(raw).trim();
                s = s.replace(/[ºª°]/g, '');
                s = s.replace(/\s+/g, ' ');
                // Encontrar letra ao final: "123-A" | "123 A" | "123A"
                const m = s.match(/^(.+?)[\s\-–—]?([A-Za-z])$/);
                if (m) return { numero: m[1].trim(), letra: m[2].toUpperCase() };
                return { numero: s, letra: null };
            };

            let { numeroDoDocumento, letra } = resultado;
            let raw = numeroDoDocumento;

            if (!raw) {
                // tentar extrair do texto com padrões comuns
                const patterns = [
                    /(?:N[º°ª\s]*|Número|No\.|Nº|N\s*)\s*(\d{1,4}(?:[\/\-]\d{2,4})?)(?:[\s\-–—]+([A-Za-z])\b(?![A-Za-z]))?/i,
                    /\b(\d{1,4}\/\d{2,4})(?:[\s\-]+([A-Za-z])\b(?![A-Za-z]))?\b/
                ];

                for (const p of patterns) {
                    const m = String(texto || '').substring(0, 2500).match(p);
                    if (m) { raw = m[1]; if (m[2]) letra = m[2].toUpperCase(); break; }
                }
            }

            // fallback para nome do arquivo
            if (!raw && nomeArquivo) {
                const nomeSemHash = removerPrefixoHashNomeArquivo(nomeArquivo);
                const tipoNorm = normalizarSemAcentos(resultado?.tipoDocumento || '').toUpperCase();

                const tentarPorTipo = (tipoToken) => {
                    const r = new RegExp(`(?:^|[^A-Za-z])${tipoToken}[^0-9]{0,12}0*(\\d{1,6})(?:[.\\-\\/]((?:19|20)\\d{2}))?(?:[-_\\s]*([A-Za-z]))?\\b`, 'i');
                    const m = nomeSemHash.match(r);
                    if (!m) return null;
                    return { raw: m[1] + (m[2] ? '/' + m[2] : ''), letra: m[3] ? m[3].toUpperCase() : null };
                };

                let found = null;
                if (tipoNorm.includes('PORTARIA')) found = tentarPorTipo('PORTARIA');
                else if (tipoNorm.includes('DECRETO')) found = tentarPorTipo('DECRETO');
                else if (tipoNorm.includes('LEI')) found = tentarPorTipo('LEI');
                else if (tipoNorm.includes('ATA')) found = tentarPorTipo('ATA');
                else if (tipoNorm.includes('OFICIO') || tipoNorm.includes('OFÍCIO')) found = tentarPorTipo('OFICIO');

                if (found) {
                    raw = found.raw;
                    if (found.letra) letra = found.letra;
                } else {
                    // Último fallback: procurar números após separadores, evitando capturar prefixos (ex.: hash no início).
                    const m = nomeSemHash.match(/[\-_\s]0*(\d{1,6})(?:[.\-\/]((?:19|20)\d{2}))?(?:[-_\s]*([A-Za-z]))?\b/);
                    if (m) {
                        raw = m[1] + (m[2] ? '/' + m[2] : '');
                        if (m[3]) letra = m[3].toUpperCase();
                    }
                }
            }

            const n = normalize(raw);
            resultado.numeroDoDocumento = normalizarNumeroInteiro(n.numero);
            resultado.letra = resultado.letra || letra || n.letra || null;
            return resultado;
        }

