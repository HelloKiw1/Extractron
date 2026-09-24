        // Configurar o PDF.js
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        const LIMITE_MINIMO_LOTE = 1;
        const LIMITE_MAXIMO_LOTE = 100;
        const LOTE_PADRAO = 50;

        // Fail-safe: evita travar o processamento em PDFs problemáticos (ex.: OCR que nunca termina)
        // ou tarefas do PDF.js que ficam penduradas. Em caso de timeout, o arquivo é marcado como falha
        // e o processamento segue para os próximos.
        const TEMPO_MAXIMO_POR_ARQUIVO_MS = 3 * 60 * 1000; // 3 min
        const TEMPO_MAXIMO_OCR_POR_PAGINA_MS = 60 * 1000; // 1 min
        const TEMPO_MAXIMO_PDFJS_POR_ETAPA_MS = 60 * 1000; // 1 min

        let inicioProcessamento = null;
        let intervaloCronometro = null;

        function formatarDuracao(duracaoMs) {
            const totalSegundos = Math.max(0, Math.floor(Number(duracaoMs || 0) / 1000));
            const horas = Math.floor(totalSegundos / 3600);
            const minutos = Math.floor((totalSegundos % 3600) / 60);
            const segundos = totalSegundos % 60;
            const partes = [minutos, segundos].map((valor) => String(valor).padStart(2, '0'));
            if (horas > 0) partes.unshift(String(horas).padStart(2, '0'));
            return partes.join(':');
        }

        function atualizarCronometro() {
            if (!inicioProcessamento) return;
            const elapsed = formatarDuracao(Date.now() - inicioProcessamento);
            const dashElapsed = document.getElementById('dashElapsed');
            if (dashElapsed) dashElapsed.textContent = elapsed;
        }

        function iniciarCronometro() {
            if (intervaloCronometro) clearInterval(intervaloCronometro);
            inicioProcessamento = Date.now();
            atualizarCronometro();
            intervaloCronometro = setInterval(atualizarCronometro, 1000);
        }

        function finalizarCronometro() {
            if (intervaloCronometro) clearInterval(intervaloCronometro);
            intervaloCronometro = null;
            const duracao = inicioProcessamento ? formatarDuracao(Date.now() - inicioProcessamento) : '00:00';
            const dashElapsed = document.getElementById('dashElapsed');
            if (dashElapsed) dashElapsed.textContent = duracao;
            return duracao;
        }

        function limparOcorrenciasAoVivo() {
            const liveErrors = document.getElementById('liveErrors');
            const liveErrorsList = document.getElementById('liveErrorsList');
            const liveErrorsCount = document.getElementById('liveErrorsCount');
            if (liveErrors) liveErrors.classList.add('hidden');
            if (liveErrorsList) liveErrorsList.innerHTML = '';
            if (liveErrorsCount) liveErrorsCount.textContent = '0';
        }

        function registrarOcorrenciaAoVivo(arquivo, motivos) {
            const liveErrors = document.getElementById('liveErrors');
            const liveErrorsList = document.getElementById('liveErrorsList');
            const liveErrorsCount = document.getElementById('liveErrorsCount');
            if (!liveErrors || !liveErrorsList) return;

            const listaMotivos = Array.isArray(motivos) && motivos.length ? motivos : ['Erro não especificado'];
            const item = document.createElement('div');
            item.className = 'rounded-lg border border-error/20 bg-base-300 p-3 text-sm';

            const titulo = document.createElement('p');
            titulo.className = 'font-semibold text-error';
            titulo.textContent = arquivo || 'Arquivo não identificado';
            item.appendChild(titulo);

            const detalhe = document.createElement('p');
            detalhe.className = 'mt-1 text-xs opacity-80';
            detalhe.textContent = listaMotivos.join(' · ');
            item.appendChild(detalhe);

            liveErrorsList.prepend(item);
            liveErrors.classList.remove('hidden');
            if (liveErrorsCount) {
                liveErrorsCount.textContent = String(liveErrorsList.children.length);
            }
        }

        function withTimeout(promise, timeoutMs, message, onTimeout) {
            const ms = Number(timeoutMs);
            if (!Number.isFinite(ms) || ms <= 0) {
                const err = new Error(message || 'Timeout');
                if (typeof onTimeout === 'function') {
                    try { onTimeout(err); } catch (_) {}
                }
                return Promise.reject(err);
            }

            let timeoutId = null;
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    const err = new Error(message || `Timeout (${ms}ms)`);
                    if (typeof onTimeout === 'function') {
                        try { onTimeout(err); } catch (_) {}
                    }
                    reject(err);
                }, ms);
            });

            return Promise.race([Promise.resolve(promise), timeoutPromise]).finally(() => {
                if (timeoutId) clearTimeout(timeoutId);
            });
        }

        function normalizarTamanhoLote(valor) {
            const lote = Number.parseInt(valor, 10);
            if (Number.isNaN(lote)) return LOTE_PADRAO;
            return Math.min(LIMITE_MAXIMO_LOTE, Math.max(LIMITE_MINIMO_LOTE, lote));
        }

        function sincronizarControleLote(valor) {
            const lote = normalizarTamanhoLote(valor);
            const input = document.getElementById('batchSizeInput');
            const label = document.getElementById('batchSizeValue');

            if (input) input.value = String(lote);
            if (label) label.textContent = String(lote);

            return lote;
        }

        function obterTamanhoLoteSelecionado() {
            const input = document.getElementById('batchSizeInput');
            return sincronizarControleLote(input ? input.value : LOTE_PADRAO);
        }

        const batchSizeInput = document.getElementById('batchSizeInput');
        if (batchSizeInput) {
            batchSizeInput.addEventListener('change', function(e) {
                sincronizarControleLote(e.target.value);
            });

            batchSizeInput.addEventListener('blur', function(e) {
                sincronizarControleLote(e.target.value);
            });
        }

        sincronizarControleLote(LOTE_PADRAO);

        async function processarArquivosEmLotes(files, tamanhoLote, processarArquivo, onBatchStart) {
            const resultados = [];
            const totalLotes = Math.ceil(files.length / tamanhoLote);

            for (let inicio = 0; inicio < files.length; inicio += tamanhoLote) {
                const indiceLote = Math.floor(inicio / tamanhoLote) + 1;
                const lote = files.slice(inicio, inicio + tamanhoLote);

                if (typeof onBatchStart === 'function') {
                    onBatchStart({
                        indiceLote,
                        totalLotes,
                        quantidadeNoLote: lote.length
                    });
                }

                const resultadosLote = await Promise.all(lote.map(processarArquivo));
                resultados.push(...resultadosLote);
            }

            return resultados;
        }

        async function calcularHashArquivo(file) {
            const buffer = await file.arrayBuffer();
            if (!globalThis.crypto?.subtle) {
                let hash = 2166136261;
                const bytes = new Uint8Array(buffer);
                for (const byte of bytes) {
                    hash ^= byte;
                    hash = Math.imul(hash, 16777619);
                }
                return `fnv-${file.size}-${(hash >>> 0).toString(16).padStart(8, '0')}`;
            }

            const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', buffer);
            return Array.from(new Uint8Array(hashBuffer))
                .map((byte) => byte.toString(16).padStart(2, '0'))
                .join('');
        }

        async function separarArquivosDuplicadosPorConteudo(files, onProgress) {
            const arquivosUnicos = [];
            const documentosDuplicados = [];
            const vistos = new Map();

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (typeof onProgress === 'function') {
                    onProgress(i, files.length, file.name);
                }

                const hash = await calcularHashArquivo(file);
                const original = vistos.get(hash);

                if (original) {
                    documentosDuplicados.push({
                        arquivo: file.name,
                        arquivo_duplicado_de: original.file.name,
                        motivo: 'Documento duplicado por conteudo',
                        hash_sha256: hash,
                        tamanho_bytes: file.size,
                        ultima_modificacao: file.lastModified ? new Date(file.lastModified).toISOString() : null,
                        indice_original: original.index + 1,
                        indice_duplicado: i + 1
                    });
                } else {
                    vistos.set(hash, { file, index: i });
                    arquivosUnicos.push(file);
                }
            }

            if (typeof onProgress === 'function') {
                onProgress(files.length, files.length, null);
            }

            return { arquivosUnicos, documentosDuplicados };
        }

        document.getElementById('pdfInput').addEventListener('change', async function(e) {
            const files = Array.from(e.target.files);
            const totalFiles = files.length;
            let processedCount = 0;
            let errorCount = 0;
            const tamanhoLote = obterTamanhoLoteSelecionado();
            const numeroDocumento = document.getElementById('select').value;
            const urlDocumentos = document.getElementById('urlDocumentos').value.trim();

            if (totalFiles === 0) {
                return;
            }

            // Determinar o tipo do documento a partir da lista carregada
            let tipoDocumento = null;
            const modoAutoDetectar = numeroDocumento === 'auto';
            if (!modoAutoDetectar) {
                try {
                    if (window.tiposDeDocumentos && Array.isArray(window.tiposDeDocumentos)) {
                        const found = window.tiposDeDocumentos.find(t => String(t.id) === String(numeroDocumento));
                        if (found) tipoDocumento = found.nome;
                    }
                    // fallback: usar texto do option (formato "id - nome")
                    if (!tipoDocumento) {
                        const option = document.getElementById('select').selectedOptions?.[0];
                        if (option && option.textContent) {
                            const parts = option.textContent.split(' - ');
                            tipoDocumento = parts.length > 1 ? parts.slice(1).join(' - ').trim() : option.textContent.trim();
                        }
                    }
                } catch (e) {
                    console.error('Erro determinando tipoDocumento:', e);
                }
            }
            
            // Validar se o ID foi preenchido
            if (!numeroDocumento) {
                const resultsDiv = document.getElementById('results');
                resultsDiv.innerHTML = `
                    <div class="card bg-base-100 shadow-xl fade-in">
                        <div class="card-body">
                            <div class="alert alert-error">
                                <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div>
                                    <h3 class="font-bold">Erro: ID de Documentação Obrigatório</h3>
                                    <div class="text-xs">É obrigatório preencher o ID de Documentação antes de selecionar os arquivos. Este ID identifica o tipo de documento.</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                // Limpar seleção de arquivo
                document.getElementById('pdfInput').value = '';
                return;
            }
            
            const resultsDiv = document.getElementById('results');
            // O painel superior é a única fonte de status durante o processamento.
            resultsDiv.innerHTML = '';
            limparOcorrenciasAoVivo();
            iniciarCronometro();
            updateProgress(0, totalFiles, `Iniciando processamento em lotes de ${tamanhoLote}...`);

            
            // Obter campos obrigatórios
            const camposObrigatorios = {
                numero: document.getElementById('obrigatorio_numero').checked,
                data: document.getElementById('obrigatorio_data').checked,
                descricao: document.getElementById('obrigatorio_descricao').checked,
                arquivo: document.getElementById('obrigatorio_arquivo').checked,
                letra: document.getElementById('obrigatorio_letra').checked
            };
            const configuracaoSaida = obterConfiguracaoSaida(numeroDocumento);
            updateProgress(0, totalFiles, 'Verificando documentos duplicados...');
            const { arquivosUnicos, documentosDuplicados } = await separarArquivosDuplicadosPorConteudo(
                files,
                (atual, total, nomeArquivoAtual) => {
                    const sufixo = nomeArquivoAtual ? ` (${nomeArquivoAtual})` : '';
                    updateProgress(atual, total, `Verificando duplicados${sufixo}`, errorCount);
                }
            );
            const totalProcessamento = arquivosUnicos.length || 1;
            processedCount = 0;
            
            // Processar arquivos em lotes com limite de concorrência configurável
            const decretos = await processarArquivosEmLotes(
                arquivosUnicos,
                tamanhoLote,
                async (file) => {
                    try {
                        const decreto = await processarPDF(file, numeroDocumento, urlDocumentos, tipoDocumento);

                        if (decreto) {
                            const validacaoParcial = validarDocumentos([decreto], camposObrigatorios);
                            if (validacaoParcial.documentosFalhos.length > 0) {
                                const motivos = validacaoParcial.documentosFalhos.flatMap((doc) => doc.motivos_falha || []);
                                errorCount += validacaoParcial.documentosFalhos.length;
                                registrarOcorrenciaAoVivo(file.name, motivos);
                            }
                        }

                        processedCount++;
                        updateProgress(processedCount, totalProcessamento, `Processados: ${processedCount}/${arquivosUnicos.length}` , errorCount);
                        return decreto;
                    } catch (error) {
                        console.error(`Erro ao processar ${file.name}:`, error);
                        processedCount++;
                        errorCount++;
                        registrarOcorrenciaAoVivo(file.name, [error?.message || String(error)]);
                        updateProgress(processedCount, totalProcessamento, `Processados: ${processedCount}/${arquivosUnicos.length}` , errorCount);
                        return {
                            arquivo: file.name,
                            numeroDoDocumento: 'Erro no processamento',
                            data: 'Erro',
                            descricao: error?.message || String(error),
                            erro: true
                        };
                    }
                },
                ({ indiceLote, totalLotes, quantidadeNoLote }) => {
                    updateProgress(
                        processedCount,
                        totalProcessamento,
                        `Processando lote ${indiceLote}/${totalLotes} (${quantidadeNoLote} arquivo${quantidadeNoLote > 1 ? 's' : ''})`,
                        errorCount
                    );
                }
            );
            
            // Filtrar valores nulos
            const decretosValidos = decretos.filter(d => d !== null);
            
            // Validar conforme campos obrigatórios
            const { documentosValidos, documentosFalhos } = validarDocumentos(decretosValidos, camposObrigatorios);

            errorCount = documentosFalhos.length;
            updateProgress(totalProcessamento, totalProcessamento, `Finalizado: ${documentosValidos.length} ok, ${documentosFalhos.length} falhas, ${documentosDuplicados.length} duplicados`, errorCount);

            const tempoProcessamento = finalizarCronometro();
            const downloadsDisponiveis = downloadArquivos(documentosValidos, documentosFalhos, configuracaoSaida, documentosDuplicados);
            limparOcorrenciasAoVivo();

            // Preparar os arquivos para download manual
            exibirResultados(documentosValidos, documentosFalhos, documentosDuplicados, downloadsDisponiveis, tempoProcessamento);
            hideProgress();
            
            console.log('ID de Documentação:', numeroDocumento);
            console.log('Documentos válidos:', documentosValidos);
            console.log('Documentos com falhas:', documentosFalhos);
            console.log('Documentos duplicados:', documentosDuplicados);
        });

        function updateProgress(current, total, message, errors = 0) {
            const processingDashboard = document.getElementById('processingDashboard');
            const dashStatus = document.getElementById('dashStatus');
            const dashPercent = document.getElementById('dashPercent');
            const dashCounts = document.getElementById('dashCounts');
            const dashFill = document.getElementById('dashProgressFill');
            const dashElapsed = document.getElementById('dashElapsed');
            const statTotal = document.getElementById('statTotal');
            const statDone = document.getElementById('statDone');
            const statPending = document.getElementById('statPending');
            const statErrors = document.getElementById('statErrors');

            const percentage = Math.round((current / total) * 100);

            if (processingDashboard) processingDashboard.classList.remove('hidden');
            const configurationCard = document.getElementById('configurationCard');
            if (configurationCard) configurationCard.classList.add('hidden');

            // Painel principal de progresso
            if (dashStatus) dashStatus.textContent = message;
            if (dashPercent) dashPercent.textContent = `${percentage}%`;
            if (dashCounts) dashCounts.textContent = `${current} / ${total}`;
            if (dashElapsed && inicioProcessamento) dashElapsed.textContent = formatarDuracao(Date.now() - inicioProcessamento);
            if (dashFill) dashFill.style.width = `${percentage}%`;
            if (statTotal) statTotal.textContent = total;
            if (statDone) statDone.textContent = current;
            if (statPending) statPending.textContent = Math.max(0, total - current);
            if (statErrors) statErrors.textContent = errors;
        }

        function hideProgress() {
            const processingDashboard = document.getElementById('processingDashboard');
            const dashStatus = document.getElementById('dashStatus');
            if (processingDashboard) processingDashboard.classList.add('hidden');
            if (dashStatus) dashStatus.textContent = 'Concluído';
        }

        function exibirResultados(documentosValidos, documentosFalhos, documentosDuplicados = [], downloadsDisponiveis = [], tempoProcessamento = '00:00') {
            const resultsDiv = document.getElementById('results');
            const duplicatasPorOriginal = new Map();
            const duplicatasExatasPorOriginal = new Map();
            const documentosPorArquivo = new Map(
                [...documentosValidos, ...documentosFalhos]
                    .map((documento) => [String(documento?.arquivo || ''), documento])
                    .filter(([arquivo]) => arquivo)
            );

            documentosDuplicados.forEach((duplicado) => {
                const original = String(duplicado?.arquivo_duplicado_de || '');
                if (!original) return;
                if (!duplicatasPorOriginal.has(original)) duplicatasPorOriginal.set(original, []);
                duplicatasPorOriginal.get(original).push(String(duplicado.arquivo || 'Arquivo não identificado'));
                if (!duplicatasExatasPorOriginal.has(original)) duplicatasExatasPorOriginal.set(original, []);
                duplicatasExatasPorOriginal.get(original).push(duplicado);
            });

            const possiveisDuplicatasPorArquivo = new Map();
            const gruposPorChave = new Map();
            [...documentosValidos, ...documentosFalhos].forEach((documento) => {
                const tipo = String(documento?.tipoDocumento || '').trim();
                const numero = String(documento?.numeroDoDocumento || '').trim();
                const data = String(documento?.data || '').trim();
                if (!tipo || !numero || !data || numero === 'N/A' || data === 'N/A' || data === 'Erro') return;

                const chave = [tipo, numero, data].map((valor) => normalizarBusca(valor)).join('|');
                if (!gruposPorChave.has(chave)) gruposPorChave.set(chave, []);
                gruposPorChave.get(chave).push(documento);
            });

            gruposPorChave.forEach((grupo) => {
                if (grupo.length < 2) return;
                grupo.forEach((documento) => {
                    const arquivo = String(documento?.arquivo || '');
                    const relacionados = grupo
                        .filter((outro) => String(outro?.arquivo || '') !== arquivo)
                        .map((outro) => String(outro?.arquivo || 'Arquivo não identificado'));
                    if (arquivo && relacionados.length) possiveisDuplicatasPorArquivo.set(arquivo, relacionados);
                });
            });

            const detalhesDuplicidade = new Map();
            let proximoIdDuplicidade = 0;

            const criarTagDuplicidade = (texto, arquivos, descricao, documentoAtual) => {
                if (!arquivos?.length) return '';
                const id = `duplicidade-${++proximoIdDuplicidade}`;
                const relacionados = arquivos.map((item) => {
                    const arquivo = typeof item === 'string' ? item : String(item?.arquivo || 'Arquivo não identificado');
                    const documento = documentosPorArquivo.get(arquivo);
                    return documento ? { ...documento } : { ...(typeof item === 'object' ? item : {}), arquivo };
                });
                detalhesDuplicidade.set(id, {
                    titulo: texto,
                    descricao,
                    atual: documentoAtual ? { ...documentoAtual } : null,
                    relacionados
                });
                return `<span class="tooltip tooltip-warning shrink-0" data-tip="Clique para ver os documentos"><button type="button" data-duplicate-tag="${id}" class="badge badge-warning cursor-pointer whitespace-nowrap px-2 py-2 text-xs font-semibold text-warning-content transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-warning" title="Clique para ver os documentos relacionados" aria-label="${escaparHtml(texto)}"><span>${escaparHtml(texto)} · ${arquivos.length}</span></button></span>`;
            };
            
            let html = `<div class="card bg-base-100 shadow-xl fade-in"><div class="card-body">`;

            const totalDocumentos = documentosValidos.length + documentosFalhos.length + documentosDuplicados.length;
            const tiposResultado = [...new Set([
                ...documentosValidos.map((doc) => doc?.tipoDocumento),
                ...documentosFalhos.map((doc) => doc?.tipoDocumento)
            ].map((tipo) => String(tipo || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
            const opcoesTipo = tiposResultado
                .map((tipo) => `<option value="${codificarFiltro(tipo)}">${escaparHtml(tipo)}</option>`)
                .join('');

            html += `
                <div class="flex flex-col gap-4 border-b border-base-300 pb-5 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p class="text-xs font-semibold uppercase tracking-wider text-primary">Processamento concluído</p>
                        <h2 class="mt-1 text-2xl font-bold">Resultado final</h2>
                        <p class="mt-1 text-sm opacity-70">Resumo dos arquivos analisados e dos arquivos disponíveis para download.</p>
                    </div>
                    <div class="rounded-lg border border-base-300 bg-base-200 px-4 py-3 text-left md:text-right">
                        <div class="text-xs uppercase tracking-wider opacity-60">Tempo total</div>
                        <div class="text-xl font-bold text-cyan-300">${tempoProcessamento}</div>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3 py-5 md:grid-cols-4">
                    <div class="stat-tile"><span class="stat-label">Analisados</span><span class="stat-value">${totalDocumentos}</span></div>
                    <div class="stat-tile"><span class="stat-label">Válidos</span><span class="stat-value text-emerald-300">${documentosValidos.length}</span></div>
                    <div class="stat-tile"><span class="stat-label">Falhas</span><span class="stat-value text-rose-300">${documentosFalhos.length}</span></div>
                    <div class="stat-tile"><span class="stat-label">Duplicados</span><span class="stat-value text-amber-300">${documentosDuplicados.length}</span></div>
                </div>
            `;

            html += `
                <div class="mb-6 rounded-xl border border-base-300 bg-base-200 p-4">
                    <div class="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h3 class="font-semibold">Filtros de pesquisa</h3>
                            <p class="text-xs opacity-60">Preencha um ou mais campos para localizar os resultados.</p>
                        </div>
                        <span id="resultFilterSummary" class="text-xs opacity-60">Todos os resultados</span>
                    </div>
                    <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_12rem_12rem_auto]">
                        <label class="form-control">
                            <span class="label-text mb-1 text-xs opacity-70">Número:</span>
                            <input id="resultNumberFilter" type="search" class="input input-bordered input-sm" placeholder="Número do documento" autocomplete="off">
                        </label>
                        <label class="form-control">
                            <span class="label-text mb-1 text-xs opacity-70">Data:</span>
                            <input id="resultDateFilter" type="search" class="input input-bordered input-sm" placeholder="Data" autocomplete="off">
                        </label>
                        <label class="form-control">
                            <span class="label-text mb-1 text-xs opacity-70">Descrição:</span>
                            <input id="resultDescriptionFilter" type="search" class="input input-bordered input-sm" placeholder="Trecho da descrição" autocomplete="off">
                        </label>
                        <label class="form-control">
                            <span class="label-text mb-1 text-xs opacity-70">Tipo:</span>
                            <select id="resultTypeFilter" class="select select-bordered select-sm">
                                <option value="all">Todos os tipos</option>
                                ${opcoesTipo}
                            </select>
                        </label>
                        <label class="form-control">
                            <span class="label-text mb-1 text-xs opacity-70">Situação:</span>
                            <select id="resultStatusFilter" class="select select-bordered select-sm">
                                <option value="all">Todos</option>
                                <option value="valid">Válidos</option>
                                <option value="failed">Com falhas</option>
                            </select>
                        </label>
                        <button id="clearResultFilters" type="button" class="btn btn-ghost btn-sm action-button self-end">Limpar</button>
                    </div>
                    <p id="resultFilterEmpty" class="mt-3 hidden rounded-lg bg-base-300 p-3 text-center text-sm opacity-70">Nenhum resultado corresponde aos filtros.</p>
                </div>
            `;
            
            if (documentosDuplicados.length > 0) {
                html += `
                    <div class="alert alert-warning mb-6">
                        <div>
                            <h3 class="font-bold">${documentosDuplicados.length} documento${documentosDuplicados.length > 1 ? 's' : ''} duplicado${documentosDuplicados.length > 1 ? 's' : ''}</h3>
                            <div class="text-xs">Eles nao entraram nos JSONs principais.</div>
                        </div>
                    </div>
                `;
            }

            // Área principal e coluna lateral de ações
            html += '<div class="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">';
            html += '<div class="space-y-6">';
            html += '<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">';
            
            // Coluna 1: Documentos válidos
            html += '<div class="space-y-4">';
            if (documentosValidos.length > 0) {
                html += `
                    <div class="flex items-center gap-2 mb-4">
                        <h2 class="text-2xl font-bold flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Válidos
                        </h2>
                        <div class="badge badge-success badge-lg">${documentosValidos.length}</div>
                    </div>
                `;
                
                documentosValidos.forEach((documento, index) => {
                    const arquivo = String(documento.arquivo || '');
                    const duplicatasDoDocumento = duplicatasPorOriginal.get(arquivo) || [];
                    const possiveisDoDocumento = possiveisDuplicatasPorArquivo.get(arquivo) || [];
                    const tagsDuplicidade = [
                        criarTagDuplicidade('Possui duplicata exata', duplicatasExatasPorOriginal.get(arquivo) || [], 'Arquivos com mesmo conteúdo', documento),
                        criarTagDuplicidade('Possível duplicata', possiveisDoDocumento, 'Mesmo tipo, número e data', documento)
                    ].join('');

                    html += `
                        <div data-result-item data-result-status="valid" data-result-type="${codificarFiltro(documento.tipoDocumento)}" data-result-number="${codificarFiltro(documento.numeroDoDocumento)}" data-result-date="${codificarFiltro(documento.data)}" data-result-description="${codificarFiltro(documento.descricao)}" class="card bg-base-200 shadow-md hover:shadow-xl transition-all hover:scale-[1.02]">
                            <div class="card-body p-4">
                                <div class="flex items-start justify-between gap-3">
                                    <h3 class="flex min-w-0 items-start gap-2 text-sm font-semibold">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span class="break-words">${documento.arquivo}</span>
                                </h3>
                                    <div class="flex flex-wrap justify-end gap-1">${tagsDuplicidade}</div>
                                </div>
                                <div class="divider my-2"></div>
                                <div class="text-sm space-y-2">
                                    <div class="flex justify-between">
                                        <span class="opacity-70">Número:</span>
                                        <span class="badge badge-outline">${documento.numeroDoDocumento || 'N/A'}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="opacity-70">Data:</span>
                                        <span class="badge badge-outline">${documento.data || 'N/A'}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="opacity-70">Tipo:</span>
                                        <span class="badge badge-primary">${documento.tipoDocumento || 'DECRETO'}</span>
                                    </div>
                                    ${documento.tipoEdicao ? `
                                    <div class="flex justify-between">
                                        <span class="opacity-70">Tipo de Edição:</span>
                                        <span class="badge badge-secondary">${documento.tipoEdicao} ${documento.tipoEdicaoDescricao ? `- ${documento.tipoEdicaoDescricao}` : ''}</span>
                                    </div>
                                    ` : ''}
                                    ${documento.edicao ? `
                                    <div class="flex justify-between">
                                        <span class="opacity-70">Edição:</span>
                                        <span class="badge badge-outline">${documento.edicao}</span>
                                    </div>
                                    ` : ''}
                                    ${documento.descricao ? `
                                    <div class="mt-3">
                                        <p class="opacity-70 text-xs mb-1">Descrição:</p>
                                        <p class="text-xs bg-base-300 p-2 rounded">${documento.descricao}</p>
                                    </div>
                                    ` : ''}
                                    ${documento.conteudo ? `
                                    <div class="mt-3">
                                        <p class="opacity-70 text-xs mb-1">Conteúdo (prévia):</p>
                                        <p class="text-xs bg-base-300 p-2 rounded">${documento.conteudo.substring(0, 500)}${documento.conteudo.length > 500 ? '...' : ''}</p>
                                    </div>
                                    ` : ''}
                                </div>
                            </div>
                        </div>
                    `;
                });
            } else {
                html += `
                    <div class="text-center py-12 opacity-50">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        <p>Nenhum documento válido</p>
                    </div>
                `;
            }
            html += '</div>';
            
            // Coluna 2: Documentos com falhas
            html += '<div class="space-y-4">';
            if (documentosFalhos.length > 0) {
                html += `
                    <div class="flex items-center gap-2 mb-4">
                        <h2 class="text-2xl font-bold flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Com Falhas
                        </h2>
                        <div class="badge badge-error badge-lg">${documentosFalhos.length}</div>
                    </div>
                `;
                
                documentosFalhos.forEach((documento, index) => {
                    const motivos = documento.motivos_falha.map(m => `<li class="text-xs">${m}</li>`).join('');
                    const arquivo = String(documento.arquivo || '');
                    const duplicatasDoDocumento = duplicatasPorOriginal.get(arquivo) || [];
                    const possiveisDoDocumento = possiveisDuplicatasPorArquivo.get(arquivo) || [];
                    const tagsDuplicidade = [
                        criarTagDuplicidade('Possui duplicata exata', duplicatasExatasPorOriginal.get(arquivo) || [], 'Arquivos com mesmo conteúdo', documento),
                        criarTagDuplicidade('Possível duplicata', possiveisDoDocumento, 'Mesmo tipo, número e data', documento)
                    ].join('');
                    html += `
                        <div data-result-item data-result-status="failed" data-result-type="${codificarFiltro(documento.tipoDocumento)}" data-result-number="${codificarFiltro(documento.numeroDoDocumento)}" data-result-date="${codificarFiltro(documento.data)}" data-result-description="${codificarFiltro(documento.motivos_falha?.join(' ') || documento.descricao)}" class="card bg-error bg-opacity-10 border border-error shadow-md hover:shadow-xl transition-all">
                            <div class="card-body p-4">
                                <div class="flex items-start justify-between gap-3">
                                    <h3 class="flex min-w-0 items-start gap-2 text-sm font-semibold text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span class="break-words">${documento.arquivo}</span>
                                    </h3>
                                    <div class="flex flex-wrap justify-end gap-1">${tagsDuplicidade}</div>
                                </div>
                                <div class="divider my-2"></div>
                                <div class="text-sm space-y-2">
                                    <div class="flex justify-between">
                                        <span class="opacity-70">Número:</span>
                                        <span class="badge badge-outline badge-white">${documento.numeroDoDocumento || 'N/A'}</span>
                                    </div>
                                    <div class="flex justify-between">
                                        <span class="opacity-70">Data:</span>
                                        <span class="badge badge-outline badge-white">${documento.data || 'N/A'}</span>
                                    </div>
                                    <div class="mt-3">
                                        <p class="opacity-70 text-xs mb-2 font-semibold">Motivos da Falha:</p>
                                        <ul class="list-disc list-inside space-y-1 text-white">
                                            ${motivos}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                });
            } else {
                html += `
                    <div class="text-center py-12 opacity-50">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p>Nenhum documento com falhas</p>
                    </div>
                `;
            }
            html += '</div>';
            
            // Fechar área principal e criar coluna lateral de ações
            html += '</div></div>';

            const linhasDownload = downloadsDisponiveis.length > 0
                ? downloadsDisponiveis.map((download) => `
                    <tr>
                        <td>
                            <div class="font-medium">${download.titulo}</div>
                            <div class="text-xs opacity-60">${download.nomeArquivo}</div>
                            <div class="text-xs opacity-60">${download.quantidade} registro${download.quantidade === 1 ? '' : 's'}</div>
                        </td>
                        <td class="text-right">
                            <button type="button" class="btn btn-primary btn-sm action-button" data-download-id="${download.id}">
                                Baixar
                            </button>
                        </td>
                    </tr>
                `).join('')
                : `
                    <tr><td colspan="2" class="py-6 text-center text-sm opacity-60">Nenhum arquivo disponível.</td></tr>
                `;

            html += `
                <aside class="space-y-4 xl:sticky xl:top-4">
                    <div class="card border border-base-300 bg-base-200 shadow-md">
                        <div class="card-body p-4">
                            <div class="flex items-center justify-between gap-3">
                                <div>
                                    <h2 class="card-title text-base">Downloads</h2>
                                    <p class="text-xs opacity-60">Clique em um botão para baixar o arquivo.</p>
                                </div>
                                <span class="badge badge-outline">${downloadsDisponiveis.length}</span>
                            </div>
                            <div class="overflow-x-auto">
                                <table class="table table-sm">
                                    <thead><tr><th>Arquivo</th><th class="text-right">Ação</th></tr></thead>
                                    <tbody>${linhasDownload}</tbody>
                                </table>
                            </div>
                            <div class="mt-2 grid gap-2">
                                <button id="showConfigBtn" type="button" class="btn btn-outline btn-sm action-button">Ver configuração</button>
                                <button id="newProcessingBtn" type="button" class="btn btn-ghost btn-sm action-button">Nova extração</button>
                            </div>
                        </div>
                    </div>
                </aside>
            </div></div></div>
            `;
            
            if (documentosValidos.length === 0 && documentosFalhos.length === 0 && documentosDuplicados.length === 0) {
                html = `
                    <div class="card bg-base-100 shadow-xl fade-in">
                        <div class="card-body text-center">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 mx-auto mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <p class="opacity-50">Nenhum documento foi processado.</p>
                        </div>
                    </div>
                `;
            }
            
            resultsDiv.innerHTML = html;
            configurarFiltrosResultados();
            document.querySelectorAll('[data-duplicate-tag]').forEach((tag) => {
                tag.addEventListener('click', () => abrirDetalhesDuplicidade(detalhesDuplicidade.get(tag.dataset.duplicateTag)));
            });
            document.querySelectorAll('[data-download-id]').forEach((botao) => {
                botao.addEventListener('click', () => {
                    const download = downloadsDisponiveis.find((item) => item.id === botao.dataset.downloadId);
                    if (download) baixarJson(download.nomeArquivo, download.payload);
                });
            });

            const showConfigBtn = document.getElementById('showConfigBtn');
            if (showConfigBtn) showConfigBtn.addEventListener('click', abrirResumoConfiguracao);

            const newProcessingBtn = document.getElementById('newProcessingBtn');
            if (newProcessingBtn) newProcessingBtn.addEventListener('click', iniciarNovaExtracao);

        }

        function configurarFiltrosResultados() {
            const numberFilter = document.getElementById('resultNumberFilter');
            const dateFilter = document.getElementById('resultDateFilter');
            const descriptionFilter = document.getElementById('resultDescriptionFilter');
            const statusFilter = document.getElementById('resultStatusFilter');
            const typeFilter = document.getElementById('resultTypeFilter');
            const clearButton = document.getElementById('clearResultFilters');
            const summary = document.getElementById('resultFilterSummary');
            const emptyMessage = document.getElementById('resultFilterEmpty');
            const cards = Array.from(document.querySelectorAll('[data-result-item]'));

            if (!numberFilter || !dateFilter || !descriptionFilter || !statusFilter || !typeFilter || !summary || !emptyMessage) return;

            const aplicarFiltros = () => {
                const numero = codificarFiltro(numberFilter.value);
                const data = codificarFiltro(dateFilter.value);
                const descricao = codificarFiltro(descriptionFilter.value);
                const status = statusFilter.value;
                const tipo = typeFilter.value;
                let visiveis = 0;

                cards.forEach((card) => {
                    const correspondeNumero = !numero || card.dataset.resultNumber?.toLowerCase().includes(numero.toLowerCase());
                    const correspondeData = !data || card.dataset.resultDate?.toLowerCase().includes(data.toLowerCase());
                    const correspondeDescricao = !descricao || card.dataset.resultDescription?.toLowerCase().includes(descricao.toLowerCase());
                    const correspondeStatus = status === 'all' || card.dataset.resultStatus === status;
                    const correspondeTipo = tipo === 'all' || card.dataset.resultType === tipo;
                    const visivel = correspondeNumero && correspondeData && correspondeDescricao && correspondeStatus && correspondeTipo;

                    card.classList.toggle('hidden', !visivel);
                    if (visivel) visiveis++;
                });

                summary.textContent = `${visiveis} de ${cards.length} resultado${cards.length === 1 ? '' : 's'}`;
                emptyMessage.classList.toggle('hidden', visiveis > 0 || cards.length === 0);
            };

            numberFilter.addEventListener('input', aplicarFiltros);
            dateFilter.addEventListener('input', aplicarFiltros);
            descriptionFilter.addEventListener('input', aplicarFiltros);
            statusFilter.addEventListener('change', aplicarFiltros);
            typeFilter.addEventListener('change', aplicarFiltros);
            if (clearButton) {
                clearButton.addEventListener('click', () => {
                    numberFilter.value = '';
                    dateFilter.value = '';
                    descriptionFilter.value = '';
                    statusFilter.value = 'all';
                    typeFilter.value = 'all';
                    aplicarFiltros();
                });
            }

            aplicarFiltros();
        }

        function abrirDetalhesDuplicidade(detalhes) {
            if (!detalhes) return;

            const modal = document.getElementById('duplicateModal');
            const title = document.getElementById('duplicateModalTitle');
            const description = document.getElementById('duplicateModalDescription');
            const content = document.getElementById('duplicateModalContent');
            if (!modal || !title || !description || !content) return;

            const documentos = [
                detalhes.atual ? { rotulo: 'Documento exibido', documento: detalhes.atual } : null,
                ...(detalhes.relacionados || []).map((documento) => ({ rotulo: 'Documento relacionado', documento }))
            ].filter(Boolean);

            const valor = (campo, fallback = 'Não informado') => {
                const valorCampo = campo === null || campo === undefined ? '' : String(campo).trim();
                return escaparHtml(valorCampo || fallback);
            };

            title.textContent = detalhes.titulo || 'Documentos relacionados';
            description.textContent = `${detalhes.descricao || 'Documentos identificados como relacionados'} — clique em Fechar para voltar aos resultados.`;
            content.innerHTML = documentos.map(({ rotulo, documento }) => {
                const motivos = Array.isArray(documento.motivos_falha) ? documento.motivos_falha : [];
                const metadados = documento.hash_sha256 || documento.tamanho_bytes || documento.motivo
                    ? `<div class="mt-3 border-t border-base-300 pt-3 text-xs opacity-70">
                        ${documento.motivo ? `<p><strong>Motivo:</strong> ${valor(documento.motivo)}</p>` : ''}
                        ${documento.tamanho_bytes ? `<p><strong>Tamanho:</strong> ${valor(documento.tamanho_bytes)} bytes</p>` : ''}
                        ${documento.hash_sha256 ? `<p class="break-all"><strong>Hash:</strong> ${valor(documento.hash_sha256)}</p>` : ''}
                    </div>`
                    : '';
                const listaMotivos = motivos.length
                    ? `<div class="mt-3"><p class="text-xs font-semibold opacity-70">Motivos da falha</p><ul class="mt-1 list-disc space-y-1 pl-4 text-xs">${motivos.map((motivo) => `<li>${valor(motivo)}</li>`).join('')}</ul></div>`
                    : '';

                return `<article class="rounded-lg border border-base-300 bg-base-200 p-4">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <span class="text-xs font-semibold uppercase tracking-wide text-warning">${escaparHtml(rotulo)}</span>
                        <span class="text-sm font-semibold break-all">${valor(documento.arquivo)}</span>
                    </div>
                    <dl class="mt-3 grid gap-2 text-sm sm:grid-cols-3">
                        <div><dt class="text-xs opacity-60">Número</dt><dd>${valor(documento.numeroDoDocumento)}</dd></div>
                        <div><dt class="text-xs opacity-60">Data</dt><dd>${valor(documento.data)}</dd></div>
                        <div><dt class="text-xs opacity-60">Tipo</dt><dd>${valor(documento.tipoDocumento)}</dd></div>
                    </dl>
                    ${documento.descricao ? `<p class="mt-3 rounded bg-base-300 p-2 text-xs">${valor(documento.descricao)}</p>` : ''}
                    ${listaMotivos}
                    ${metadados}
                </article>`;
            }).join('');

            if (modal.showModal) modal.showModal();
            else modal.setAttribute('open', '');
        }

        function abrirResumoConfiguracao() {
            const select = document.getElementById('select');
            const optionSelecionada = select?.selectedOptions?.[0];
            const tipo = optionSelecionada?.textContent?.trim() || 'Não informado';
            const url = document.getElementById('urlDocumentos')?.value.trim();
            const lote = document.getElementById('batchSizeInput')?.value || '50';
            const regras = [
                ['Número', 'obrigatorio_numero'],
                ['Data', 'obrigatorio_data'],
                ['Descrição', 'obrigatorio_descricao'],
                ['Arquivo', 'obrigatorio_arquivo'],
                ['Letra', 'obrigatorio_letra']
            ]
                .filter(([, id]) => document.getElementById(id)?.checked)
                .map(([nome]) => nome);

            const resumoTipo = document.getElementById('configSummaryType');
            const resumoUrl = document.getElementById('configSummaryUrl');
            const resumoLote = document.getElementById('configSummaryBatch');
            const resumoRegras = document.getElementById('configSummaryRules');

            if (resumoTipo) resumoTipo.textContent = tipo;
            if (resumoUrl) resumoUrl.textContent = url || 'Não informada (referência local)';
            if (resumoLote) resumoLote.textContent = `${lote} arquivo${Number(lote) === 1 ? '' : 's'} por lote`;
            if (resumoRegras) resumoRegras.textContent = regras.length ? regras.join(', ') : 'Nenhum campo adicional';

            const modal = document.getElementById('configModal');
            if (modal?.showModal) {
                modal.showModal();
            } else if (modal) {
                modal.setAttribute('open', '');
            }
        }

        function iniciarNovaExtracao() {
            const configurationCard = document.getElementById('configurationCard');
            const resultsDiv = document.getElementById('results');
            const processingDashboard = document.getElementById('processingDashboard');
            const pdfInput = document.getElementById('pdfInput');

            if (configurationCard) configurationCard.classList.remove('hidden');
            if (resultsDiv) resultsDiv.innerHTML = '';
            if (processingDashboard) processingDashboard.classList.add('hidden');
            if (pdfInput) pdfInput.value = '';

            const dashStatus = document.getElementById('dashStatus');
            const dashPercent = document.getElementById('dashPercent');
            const dashCounts = document.getElementById('dashCounts');
            const dashFill = document.getElementById('dashProgressFill');
            const dashElapsed = document.getElementById('dashElapsed');
            const statTotal = document.getElementById('statTotal');
            const statDone = document.getElementById('statDone');
            const statPending = document.getElementById('statPending');
            const statErrors = document.getElementById('statErrors');

            if (dashStatus) dashStatus.textContent = 'Aguardando seleção de arquivos...';
            if (dashPercent) dashPercent.textContent = '0%';
            if (dashCounts) dashCounts.textContent = '0 / 0';
            if (dashFill) dashFill.style.width = '0%';
            if (dashElapsed) dashElapsed.textContent = '00:00';
            if (statTotal) statTotal.textContent = '0';
            if (statDone) statDone.textContent = '0';
            if (statPending) statPending.textContent = '0';
            if (statErrors) statErrors.textContent = '0';

            configurationCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        let tiposDocumentosCache = [];

        function escaparHtml(valor) {
            return String(valor ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        function codificarFiltro(valor) {
            return encodeURIComponent(String(valor ?? ''));
        }

        function normalizarBusca(valor) {
            return String(valor || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase()
                .trim();
        }

        function labelTipoDocumento(item) {
            return `${item.id} - ${item.nome}`;
        }

        function renderizarOpcoesTipo(items, manterSelecionado = true) {
            const select = document.getElementById('select');
            const valorAtual = manterSelecionado ? String(select.value || '') : '';

            select.innerHTML = `
                <option value="auto" selected>🔍 Auto-detectar (pelo nome/conteúdo)</option>
                <option value="">Selecione um documento...</option>
            `;

            items.forEach((item) => {
                const option = document.createElement('option');
                option.value = String(item.id);
                option.textContent = labelTipoDocumento(item);
                select.appendChild(option);
            });

            if (valorAtual) {
                select.value = valorAtual;
            }

            if (!select.value && items.length === 1) {
                select.value = String(items[0].id);
            }
        }

        function filtrarTiposDocumento(termo) {
            const termoNormalizado = normalizarBusca(termo);

            if (!termoNormalizado) {
                return tiposDocumentosCache;
            }

            return tiposDocumentosCache.filter((item) => {
                const id = String(item.id);
                const nome = normalizarBusca(item.nome);
                return id.includes(termoNormalizado) || nome.includes(termoNormalizado);
            });
        }

        function buscarTipoPorValor(termo) {
            const termoNormalizado = normalizarBusca(termo);
            if (!termoNormalizado) return null;

            return tiposDocumentosCache.find((item) => String(item.id) === termoNormalizado)
                || tiposDocumentosCache.find((item) => normalizarBusca(item.nome) === termoNormalizado)
                || null;
        }

        const dropdownList = async () => {
            const el = document.getElementById('tiposDeDocumentos');
            const buscaInput = document.getElementById('buscarDocumento');
            const select = document.getElementById('select');
            let items = [];

            if (window.tiposDeDocumentos && Array.isArray(window.tiposDeDocumentos)) {
                items = window.tiposDeDocumentos;
            } else {
                try {
                    items = JSON.parse(el.textContent || '[]');
                } catch {
                    items = [];
                }
            }

            tiposDocumentosCache = items;
            renderizarOpcoesTipo(tiposDocumentosCache, false);

            buscaInput.addEventListener('input', (event) => {
                const termo = event.target.value || '';
                const filtrados = filtrarTiposDocumento(termo);
                renderizarOpcoesTipo(filtrados);

                const tipoExato = buscarTipoPorValor(termo);
                if (tipoExato) {
                    select.value = String(tipoExato.id);
                    selecionarTipo(tipoExato);
                } else if (filtrados.length === 1) {
                    select.value = String(filtrados[0].id);
                    selecionarTipo(filtrados[0]);
                } else if (select.value) {
                    const atual = tiposDocumentosCache.find((item) => String(item.id) === String(select.value));
                    selecionarTipo(atual);
                }
            });

            buscaInput.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();

                const tipoExato = buscarTipoPorValor(buscaInput.value || '');
                if (tipoExato) {
                    select.value = String(tipoExato.id);
                    buscaInput.value = labelTipoDocumento(tipoExato);
                    selecionarTipo(tipoExato);
                    return;
                }

                const filtrados = filtrarTiposDocumento(buscaInput.value || '');
                if (filtrados.length === 1) {
                    select.value = String(filtrados[0].id);
                    buscaInput.value = labelTipoDocumento(filtrados[0]);
                    selecionarTipo(filtrados[0]);
                }
            });

            select.addEventListener('change', () => {
                if (select.value === 'auto') {
                    buscaInput.value = '';
                    selecionarTipo(null);
                    return;
                }
                const selecionado = tiposDocumentosCache.find((item) => String(item.id) === String(select.value));
                if (selecionado) {
                    buscaInput.value = labelTipoDocumento(selecionado);
                    selecionarTipo(selecionado);
                }
            });
        }

        const selecionarTipo = (tipo) => {
            const numero = document.getElementById('obrigatorio_numero');
            const letra = document.getElementById('obrigatorio_letra');
            const publicarTransparencia = document.getElementById('portal');
            const publicarOficial = document.getElementById('diario');

            if (tipo?.aceitar_letra)
                letra.checked = true;

            if (tipo?.possui_numero)
                numero.checked = true;

            if (tipo?.publicar_portal && publicarTransparencia)
                publicarTransparencia.checked = true;

            if (tipo?.publicar_diario && publicarOficial)
                publicarOficial.checked = true;
        }

        dropdownList();
