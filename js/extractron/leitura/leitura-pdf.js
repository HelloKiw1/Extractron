// Extractron - leitura de PDF e OCR

        function detectarTipoPeloNome(nomeArquivo) {
            const nome = String(nomeArquivo || '');
            const nomeNormalizado = normalizarBusca(nomeArquivo);
            const nomeDecodificado = nome
                .replace(/%20/gi, ' ')
                .replace(/_20/g, ' ')
                .replace(/[_.\-]+/g, ' ');
            const nomeDecodificadoNormalizado = normalizarSemAcentos(nomeDecodificado).toLowerCase();
            const nomeResolucaoNormalizado = normalizarBusca(normalizarNomeArquivoResolucao(nomeArquivo));
            const tipoProcedimento = detectarTipoProcedimentoPeloNome(nomeArquivo);
            if (tipoProcedimento) return tipoProcedimento;
            const tipoDespesa = detectarTipoDespesaPeloNome(nomeArquivo);
            if (tipoDespesa) return tipoDespesa;
            if (/\bof[ií]cio\b/i.test(nome) || /^of[_\-\s\.]*\d{3,6}[\.\-_](?:19|20)\d{2}/i.test(nome)) return 'Ofício';
            if (/requerimento/i.test(nome) || /requerimento/.test(nomeNormalizado)) return 'Requerimento';
            if (/declara/i.test(nome) || /\bdeclaracoes?\b|\bdeclaracao\b/.test(nomeNormalizado)) return 'Declaracao';
            if (/folha[\s_\-]*de[\s_\-]*pagamento|folhadepagamento|\bfopag\b/i.test(nome) || /folha\s*de\s*pagamento|folhadepagamento|\bfopag\b/.test(nomeNormalizado)) return 'Folha de Pagamento';
            if (/quadro[\s_\-]*atual[\s_\-]*de[\s_\-]*servidores|quadroatualdeservidores/i.test(nome) || /quadro\s*atual\s*de\s*servidores|quadroatualdeservidores/.test(nomeNormalizado)) return 'Quadro Atual de Servidores';
            if (/di[aá]rio[\s_\-]?oficial/i.test(nome) || /\bdoem\b/i.test(nome)) return 'Diario Oficial';
            if (/projeto[\s_\-]?pol[ií]tico[\s_\-]?pedag[óo]gico|\bppp\b/i.test(nome)) return 'Projeto Politico Pedagogico';
            if (/relat[oó]rio[\s_\-]?de[\s_\-]?gest[aã]o[\s_\-]?fiscal|\brgf\b/i.test(nome) || /relatorio\s*de\s*gestao\s*fiscal|relatoriodegestaofiscal|\brgf\b/.test(nomeNormalizado)) return 'Relatório de Gestão Fiscal - RGF';
            if (/lei[\s_\-]?de[\s_\-]?diretrizes[\s_\-]?or[cç]ament[aá]rias|\bldo\b/i.test(nome) || /lei\s*de\s*diretrizes\s*orcamentarias|leidediretrizesorcamentarias|\bldo\b/.test(nomeNormalizado)) return 'Lei de Diretrizes Orçamentárias (LDO)';
            if (/plano[\s_\-]?plurianual|\bppa\b/i.test(nome) || /plano\s*plurianual|planoplurianual|\bppa\b/.test(nomeNormalizado)) return 'Plano Plurianual (PPA)';
            if (/emenda/i.test(nome)) return 'Emenda Parlamentar';
            if (/regimento/i.test(nome)) return 'Regimentos';
            if (isContextoJulgamentoContas(nomeDecodificadoNormalizado)) return 'Julgamento de Contas';
            if (/\bresoluc(?:ao|oes)\b|\bresoluao\b|\bres\b/.test(nomeResolucaoNormalizado) || /\bprojeto\s+de\s+resoluc(?:ao|oes)\b/.test(nomeDecodificadoNormalizado)) return 'Resolucoes';

            // Detectar PROJETO DE LEI antes da regra genérica de LEI.
            // (Muitos arquivos vêm como "PROJ_20LEI_20001.2023.pdf" e seriam classificados como "Lei" se cair na regra abaixo.)
            if (
                /projeto\s*de\s*lei/.test(nomeDecodificadoNormalizado)
                || /\bproj(?:eto)?\b\s*(?:de\s*)?lei\b/.test(nomeDecodificadoNormalizado)
                || /\bp\.?\s*l\.?\b\s*\d{1,4}/.test(nomeDecodificadoNormalizado)
            ) return 'Projeto de Lei';

            if (/(^|[_\-\s])leis?(?:\d{2,4})?(?=$|[_\-\s])/i.test(nome) || /^lei[\s_\-]/i.test(nome) || /[\s_\-]lei[\s_\-]/i.test(nome) || /(^|[_\-\s])leis?\d{4}[_\-\s]\d+/i.test(nome) || /(^|[_\-\s])leis?[_\-\s]*\d{1,4}/i.test(nome) || /\blei\b|\bleis\b/.test(nomeNormalizado)) return 'Lei';
            if (/^portaria[\s_\-]/i.test(nome) || /portaria/i.test(nome) || /^[Nn]\d+/i.test(nome)) return 'Portaria';
            if (/^decreto[\s_\-]/i.test(nome) || /decreto/i.test(nome)) return 'Decreto';
            if (/^ata[\s_\-]/i.test(nome) || /\bata\b/i.test(nome) || /(^|[_\-\s]|\d)atas?(?=$|[_\-\s]|\d)/i.test(nome) || /\bata\b|\batas\b/.test(nomeNormalizado)) return 'Ata';
            return null;
        }

        async function processarPDF(file, numeroDocumento, urlDocumentos, tipoDocumento) {
            const inicio = performance.now();
            const deadline = inicio + TEMPO_MAXIMO_POR_ARQUIVO_MS;
            const restanteMs = () => Math.max(0, deadline - performance.now());
            const garantirTempo = (etapa) => {
                if (performance.now() > deadline) {
                    throw new Error(`Timeout de ${Math.round(TEMPO_MAXIMO_POR_ARQUIVO_MS / 1000)}s ao processar ${file?.name || 'arquivo'} (${etapa})`);
                }
            };

            const arrayBuffer = await withTimeout(
                file.arrayBuffer(),
                Math.min(TEMPO_MAXIMO_PDFJS_POR_ETAPA_MS, restanteMs()),
                `Timeout lendo arquivo: ${file?.name || 'arquivo'}`
            );

            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdf = await withTimeout(
                loadingTask.promise,
                restanteMs(),
                `Timeout abrindo PDF: ${file?.name || 'arquivo'}`,
                () => {
                    try { loadingTask.destroy(); } catch (_) {}
                }
            );
            
            let textoCompleto = '';
            // Em modo auto, tentar detectar o tipo pelo nome do arquivo para poder
            // aplicar otimizações (ex: PPP só precisa da 1ª página).
            const tipoEfetivo = tipoDocumento || detectarTipoPeloNome(file.name);
            const processarSomentePrimeiraPagina = isTipoProjetoPoliticoPedagogico(tipoEfetivo);
            const isProjetoLei = isTipoProjetoDeLei(tipoEfetivo);
            const isResolucao = isTipoResolucao(tipoEfetivo);
            const isPortaria = isTipoPortaria(tipoEfetivo) || /PORTARIA/i.test(file.name);
            const isDecreto = isTipoDecreto(tipoEfetivo) || /DECRETO/i.test(file.name);
            const isDeclaracao = isTipoDeclaracao(tipoEfetivo);
            const isJulgamentoContas = isTipoJulgamentoContas(tipoEfetivo) || isContextoJulgamentoContas(file.name);

            // Alguns tipos carregam número/data/ementa no início. Limitar páginas evita
            // timeouts em PDFs digitalizados com anexos longos.
            const maxPaginas = processarSomentePrimeiraPagina
                ? 1
                : ((isJulgamentoContas || isDeclaracao) ? 1 : ((isProjetoLei || isResolucao || isPortaria || isDecreto) ? Math.min(3, pdf.numPages) : pdf.numPages));

            // Ler páginas (limitadas para PPP e Projeto de Lei)
            for (let i = 1; i <= maxPaginas; i++) {
                garantirTempo(`getPage(${i}/${pdf.numPages})`);
                const page = await withTimeout(
                    pdf.getPage(i),
                    Math.min(TEMPO_MAXIMO_PDFJS_POR_ETAPA_MS, restanteMs()),
                    `Timeout carregando página ${i}: ${file.name}`
                );
                const textContent = await withTimeout(
                    page.getTextContent(),
                    Math.min(TEMPO_MAXIMO_PDFJS_POR_ETAPA_MS, restanteMs()),
                    `Timeout extraindo texto da página ${i}: ${file.name}`
                );
                const pageText = textContent.items.map(item => item.str).join(' ');
                
                // Se a página tem pouco ou nenhum texto, usar OCR
                if (pageText.trim().length < 50) {
                    const prefixo = processarSomentePrimeiraPagina ? 'PPP' : (isProjetoLei ? 'Projeto de Lei' : (isPortaria ? 'Portaria' : (isDecreto ? 'Decreto' : 'Página')));
                    console.log(`${prefixo} ${i} de ${file.name} sem texto - usando OCR...`);
                    garantirTempo(`OCR página ${i}/${pdf.numPages}`);
                    try {
                        const ocrText = await withTimeout(
                            extrairTextoComOCR(page),
                            Math.min(TEMPO_MAXIMO_OCR_POR_PAGINA_MS, restanteMs()),
                            `Timeout OCR (página ${i}): ${file.name}`
                        );
                        textoCompleto += ocrText + ' ';
                    } catch (e) {
                        console.warn(`[TIMEOUT] OCR página ${i} ignorado (${file.name}):`, e);
                        // Segue adiante sem OCR dessa página.
                    }
                } else {
                    textoCompleto += pageText + ' ';
                }
            }
            
            // Extrair informações usando regex
            const decreto = extrairInformacoes(textoCompleto, file.name, numeroDocumento, urlDocumentos, tipoEfetivo);
            return decreto;
        }

        async function extrairTextoComOCR(page) {
            try {
                // Renderizar a página como imagem
                const viewport = page.getViewport({ scale: 2.0 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;

                await page.render({
                    canvasContext: context,
                    viewport: viewport
                }).promise;

                // Converter canvas para imagem e aplicar OCR
                const imageData = canvas.toDataURL('image/png');
                
                const result = await Tesseract.recognize(
                    imageData,
                    'por', // Português
                );

                return result.data.text;
            } catch (error) {
                console.error('Erro no OCR:', error);
                return '';
            }
        }

