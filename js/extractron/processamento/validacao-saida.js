// Extractron - validação e geração dos arquivos de saída

        function validarDocumentos(documentos, camposObrigatorios) {
            const documentosValidos = [];
            const documentosFalhos = [];
            
            documentos.forEach(doc => {
                let temErro = false;
                const erros = [];
                const isPPP = isTipoProjetoPoliticoPedagogico(doc.tipoDocumento);
                const semNumero = tipoDocumentoSemNumero(doc.tipoDocumento);
                
                // Verificar se tem erro no processamento
                if (doc.erro) {
                    temErro = true;
                    erros.push('Erro no processamento do arquivo');
                }
                
                // Validar campos obrigatórios
                if (!isPPP && !semNumero && camposObrigatorios.numero && (!doc.numeroDoDocumento || doc.numeroDoDocumento === 'Erro no processamento')) {
                    temErro = true;
                    erros.push('Número do documento ausente ou inválido');
                }
                
                if (camposObrigatorios.data && (!doc.data || doc.data === 'Erro')) {
                    temErro = true;
                    erros.push('Data ausente ou inválida');
                }
                
                if (camposObrigatorios.descricao && (!doc.descricao || doc.descricao.trim() === '')) {
                    temErro = true;
                    erros.push('Descrição ausente ou vazia');
                }
                
                if (camposObrigatorios.arquivo && (!doc.arquivo || doc.arquivo.trim() === '')) {
                    temErro = true;
                    erros.push('Arquivo não informado');
                }

                // Regras obrigatorias para Diario Oficial
                if (isTipoDiario(doc.tipoDocumento) || doc.tipoEdicao || doc.edicao || doc.conteudo) {
                    if (!doc.tipoEdicao || !['01', '02', '03'].includes(String(doc.tipoEdicao))) {
                        temErro = true;
                        erros.push('Tipo de Edição ausente ou inválido (use 01, 02 ou 03)');
                    }

                    if (!doc.edicao || !/^\d+$/.test(String(doc.edicao))) {
                        temErro = true;
                        erros.push('Edição ausente ou inválida');
                    }

                    if (!doc.data || doc.data === 'Erro') {
                        temErro = true;
                        erros.push('Data ausente ou inválida');
                    }

                    if (!doc.conteudo || String(doc.conteudo).trim().length < 20) {
                        temErro = true;
                        erros.push('Conteúdo ausente ou vazio');
                    }
                }
                
                if (temErro) {
                    documentosFalhos.push({
                        ...doc,
                        motivos_falha: erros
                    });
                } else {
                    documentosValidos.push(doc);
                }
            });
            
            return { documentosValidos, documentosFalhos };
        }

        function obterConfiguracaoSaida(numeroDocumento) {
            const tipoSelecionado = tiposDocumentosCache.find((item) => String(item.id) === String(numeroDocumento));
            const publicarPortalInput = document.getElementById('portal');

            return {
                tipoDocumentoId: numeroDocumento || null,
                publicarPortal: publicarPortalInput ? Boolean(publicarPortalInput.checked) : Boolean(tipoSelecionado?.publicar_portal),
                gerarDoc: false,
                gerarOcr: false
            };
        }

        // Regra de normalização do campo "numero": deve ser inteiro puro (somente dígitos).
        // - Remove separadores ("/", "-", "—") e sufixos.
        // - Rejeita valores que parecem data ou ano.
        // - Ex.: "001/2025" -> "1".
        function normalizarNumeroInteiro(valor) {
            if (valor === null || valor === undefined) return null;

            let texto = String(valor).trim();
            if (!texto) return null;

            texto = texto.replace(/[ºª°]/g, '').replace(/\s+/g, ' ');

            // Rejeitar quando o "numero" na verdade é uma data.
            if (/\b\d{1,2}\s*[\/\.-]\s*\d{1,2}\s*[\/\.-]\s*\d{2,4}\b/.test(texto)) return null;
            if (/\b\d{4}\s*[\/\.-]\s*\d{1,2}\s*[\/\.-]\s*\d{1,2}\b/.test(texto)) return null;

            // Rejeitar anos isolados (incluindo OCR quebrado: "2.026", "2 0 2 6").
            const matchAnoIsolado = texto.match(/^((?:\d[\s\.,]*){4})$/);
            if (matchAnoIsolado) {
                const anoLimpo = String(matchAnoIsolado[1]).replace(/\D/g, '').slice(0, 4);
                if (/^(19|20)\d{2}$/.test(anoLimpo)) return null;
            }

            // Para casos como "001/2025", "001-2025", "123-A": pega só a primeira parte.
            const primeiraParte = texto.split(/[\/\-–—]/)[0];
            const matchNumero = primeiraParte.match(/\d{1,10}/);
            if (!matchNumero) return null;

            const numero = parseInt(matchNumero[0], 10);
            if (Number.isNaN(numero) || numero <= 0) return null;

            // Evitar que um token "20YYYY" (ex.: 202025, vindo de %202025) vire número de documento.
            if (matchNumero[0].length === 6 && matchNumero[0].startsWith('20')) {
                const tail = matchNumero[0].slice(2);
                if (/^(19|20)\d{2}$/.test(tail)) return null;
            }

            // Evitar que um ano apareça como número.
            if (matchNumero[0].length === 4 && numero >= 1900 && numero <= 2100) return null;

            return String(numero);
        }

        function converterDataParaISO(valor) {
            if (valor === null || valor === undefined) return null;

            const texto = String(valor).trim();
            if (!texto) return null;

            const matchBr = texto.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-]((?:\d[\s\.,]*){4})$/);
            if (matchBr) {
                const dia = Number(matchBr[1]);
                const mes = Number(matchBr[2]);
                const ano = Number(String(matchBr[3]).replace(/\D/g, '').slice(0, 4));
                const data = new Date(Date.UTC(ano, mes - 1, dia));

                if (data.getUTCFullYear() === ano && (data.getUTCMonth() + 1) === mes && data.getUTCDate() === dia) {
                    return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
                }
            }

            const matchIsoDate = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (matchIsoDate) return texto;

            const matchYmd = texto.match(/^(\d{4})[\/\.](\d{1,2})[\/\.](\d{1,2})$/);
            if (matchYmd) {
                const ano = Number(matchYmd[1]);
                const mes = Number(matchYmd[2]);
                const dia = Number(matchYmd[3]);
                const data = new Date(Date.UTC(ano, mes - 1, dia));

                if (data.getUTCFullYear() === ano && (data.getUTCMonth() + 1) === mes && data.getUTCDate() === dia) {
                    return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
                }
            }

            const matchAno = texto.match(/^\d{4}$/);
            if (matchAno) return `${texto}-01-01`;

            const matchAnoQuebrado = texto.match(/^((?:\d[\s\.,]*){4})$/);
            if (matchAnoQuebrado) {
                const ano = String(matchAnoQuebrado[1]).replace(/\D/g, '').slice(0, 4);
                if (ano.length === 4) return `${ano}-01-01`;
            }

            const dataNativa = new Date(texto);
            if (!Number.isNaN(dataNativa.getTime())) {
                return dataNativa.toISOString().slice(0, 10);
            }

            return texto;
        }

        function mapearDocumentoParaPayload(doc, configuracaoSaida) {
            const numero = doc?.numeroDoDocumento ?? null;
            let tipoDocumentoId = configuracaoSaida?.tipoDocumentoId ?? doc?.numero ?? null;
            const documentoFinanceiro = normalizarBusca(`${doc?.arquivo || ''} ${doc?.url || ''} ${doc?.descricao || ''}`);
            const tituloDocumento = `${doc?.tipoDocumento || ''} ${doc?.arquivo || doc?.arquivo_original || ''} ${doc?.descricao || ''} ${doc?.url || ''}`;

            const resolverTipoDocumentoId = (termo) => {
                const tipoNorm = normalizarBusca(termo || '');
                const tipoCompacto = tipoNorm.replace(/[^a-z0-9]+/g, '');
                if (!tipoNorm) return null;

                const encontrado = tiposDocumentosCache.find((t) => {
                    const nome = normalizarBusca(t.nome || '');
                    const nomeArquivo = normalizarBusca(t.nome_arquivo || '');
                    const nomeCompacto = nome.replace(/[^a-z0-9]+/g, '');
                    const nomeArquivoCompacto = nomeArquivo.replace(/[^a-z0-9]+/g, '');

                    return (
                        nome === tipoNorm ||
                        nome.includes(tipoNorm) ||
                        tipoNorm.includes(nome) ||
                        (nomeArquivo && (nomeArquivo === tipoNorm || nomeArquivo.includes(tipoNorm) || tipoNorm.includes(nomeArquivo))) ||
                        (nomeCompacto && (nomeCompacto === tipoCompacto || tipoCompacto.includes(nomeCompacto) || nomeCompacto.includes(tipoCompacto))) ||
                        (nomeArquivoCompacto && (nomeArquivoCompacto === tipoCompacto || tipoCompacto.includes(nomeArquivoCompacto) || nomeArquivoCompacto.includes(tipoCompacto)))
                    );
                });

                return encontrado ? encontrado.id : null;
            };

            if (tipoDocumentoId === 'auto' && /informacao\s*financeiras?|balanco\s*anual|balancoanual|balancetes?\s*mensais|balancetesmensais/.test(documentoFinanceiro)) {
                const tipoBalancetes = tiposDocumentosCache.find(t => normalizarBusca(t.nome) === 'balancetes');
                if (tipoBalancetes) {
                    tipoDocumentoId = tipoBalancetes.id;
                }
            }

            // Modo auto-detectar: resolver tipo_documento_id pelo nome do tipo detectado
            if (tipoDocumentoId === 'auto' && doc?.tipoDocumento) {
                tipoDocumentoId = resolverTipoDocumentoId(doc.tipoDocumento);
            }

            // Fallback pelo titulo do documento (arquivo/descricao/url) quando o tipo nao veio do parser
            if (tipoDocumentoId === 'auto') {
                const tipoPeloTitulo = detectarTipoPeloNome(tituloDocumento)
                    || detectarTipoDespesaPeloNome(tituloDocumento)
                    || detectarTipoProcedimentoPeloNome(tituloDocumento);

                if (tipoPeloTitulo) {
                    tipoDocumentoId = resolverTipoDocumentoId(tipoPeloTitulo) ?? null;
                }
            }

            const tipoDocumentoIdNumero = Number(tipoDocumentoId);
            const dataInferidaPorTitulo = obterDataCompetenciaArquivo(doc?.arquivo || doc?.arquivo_original || doc?.descricao || '');
            const dataFinal = converterDataParaISO(doc?.data || dataInferidaPorTitulo);
            const numeroFinal = normalizarNumeroInteiro(numero);

            return {
                publicar_portal: Boolean(configuracaoSaida?.publicarPortal),
                data: dataFinal,
                url: doc?.url || null,
                numero: numeroFinal,
                descricao: doc?.descricao || null,
                conteudo: doc?.conteudo || null,
                tipo_documento_id: Number.isNaN(tipoDocumentoIdNumero) ? (tipoDocumentoId || null) : tipoDocumentoIdNumero,
                gerar_doc: Boolean(configuracaoSaida?.gerarDoc),
                gerar_ocr: Boolean(configuracaoSaida?.gerarOcr),
                letra: doc?.letra || null
            };
        }
        
        function mapearDocumentoDuplicadoParaPayload(doc, configuracaoSaida) {
            let tipoDocumentoId = configuracaoSaida?.tipoDocumentoId ?? null;
            const tipoDocumentoIdNumero = Number(tipoDocumentoId);

            if (tipoDocumentoId === 'auto') {
                tipoDocumentoId = null;
            }

            return {
                arquivo_original: doc?.arquivo || null,
                arquivo_duplicado_de: doc?.arquivo_duplicado_de || null,
                nao_executar: true,
                motivo: doc?.motivo || 'Documento duplicado por conteudo',
                hash_sha256: doc?.hash_sha256 || null,
                tamanho_bytes: doc?.tamanho_bytes || null,
                ultima_modificacao: doc?.ultima_modificacao || null,
                indice_original: doc?.indice_original || null,
                indice_duplicado: doc?.indice_duplicado || null,
                tipo_documento_id: Number.isNaN(tipoDocumentoIdNumero) ? (tipoDocumentoId || null) : tipoDocumentoIdNumero
            };
        }

        function baixarJson(nomeArquivo, payload) {
            const file = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(file);
            a.download = nomeArquivo;
            a.click();
            setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        }

        function downloadArquivos(documentosValidos, documentosFalhos, configuracaoSaida, documentosDuplicados = []) {
            const payloadValidos = documentosValidos
                .filter((doc) => !doc?.motivos_falha?.length && !doc?.erro)
                .map((doc) => mapearDocumentoParaPayload(doc, configuracaoSaida));
            const payloadFalhos = documentosFalhos.map((doc) => ({
                ...mapearDocumentoParaPayload(doc, configuracaoSaida),
                motivos_falha: doc.motivos_falha || [],
                arquivo_original: doc.arquivo || null,
                erro: doc.erro || null
            }));
            const payloadDuplicados = documentosDuplicados.map((doc) => mapearDocumentoDuplicadoParaPayload(doc, configuracaoSaida));
            const downloadsDisponiveis = [];

            if (payloadValidos.length > 0) {
                downloadsDisponiveis.push({
                    id: 'validos',
                    titulo: 'Documentos válidos',
                    nomeArquivo: 'informações_extraidos.json',
                    quantidade: payloadValidos.length,
                    payload: payloadValidos
                });
            }

            if (payloadFalhos.length > 0) {
                downloadsDisponiveis.push({
                    id: 'falhas',
                    titulo: 'Documentos com falhas',
                    nomeArquivo: 'falha.json',
                    quantidade: payloadFalhos.length,
                    payload: payloadFalhos
                });
            }

            if (payloadDuplicados.length > 0) {
                downloadsDisponiveis.push({
                    id: 'duplicados',
                    titulo: 'Documentos duplicados',
                    nomeArquivo: 'duplicados.json',
                    quantidade: payloadDuplicados.length,
                    payload: payloadDuplicados
                });
            }

            window.extractronDownloads = downloadsDisponiveis;
            // Os arquivos ficam disponíveis na tabela lateral e só são baixados após o clique.
            return downloadsDisponiveis;
        }

        // Tenta detectar o tipo do documento pelo nome do arquivo antes de ler o conteúdo.
        // Usado no modo Auto-detectar para aplicar otimizações (ex: PPP lê só a 1ª página).
