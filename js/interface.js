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
            const range = document.getElementById('batchSizeRange');
            const input = document.getElementById('batchSizeInput');
            const label = document.getElementById('batchSizeValue');

            if (range) range.value = String(lote);
            if (input) input.value = String(lote);
            if (label) label.textContent = String(lote);

            return lote;
        }

        function obterTamanhoLoteSelecionado() {
            const input = document.getElementById('batchSizeInput');
            return sincronizarControleLote(input ? input.value : LOTE_PADRAO);
        }

        document.getElementById('batchSizeRange').addEventListener('input', function(e) {
            sincronizarControleLote(e.target.value);
        });

        document.getElementById('batchSizeInput').addEventListener('change', function(e) {
            sincronizarControleLote(e.target.value);
        });

        document.getElementById('batchSizeInput').addEventListener('blur', function(e) {
            sincronizarControleLote(e.target.value);
        });

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
            
            // Validar se a URL foi preenchida
            if (!urlDocumentos) {
                const resultsDiv = document.getElementById('results');
                resultsDiv.innerHTML = `
                    <div class="card bg-base-100 shadow-xl fade-in">
                        <div class="card-body">
                            <div class="alert alert-error">
                                <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <div>
                                    <h3 class="font-bold">Erro: URL Base Obrigatória</h3>
                                    <div class="text-xs">É obrigatório preencher a URL Base dos Documentos antes de selecionar os arquivos. Exemplo: https://seu-servidor.com/documentos/</div>
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
            resultsDiv.innerHTML = `
                <div class="card bg-base-100 shadow-xl fade-in">
                    <div class="card-body">
                        <div class="flex items-center justify-center gap-3">
                            <span class="loading loading-spinner loading-lg"></span>
                            <p class="text-lg">Processando arquivos em lotes de ${tamanhoLote}...</p>
                        </div>
                        <div id="progressContainer" class="mt-4" style="display:none;">
                            <div id="progressText" class="text-sm opacity-70 mb-2"></div>
                            <progress id="progressFill" class="progress progress-primary w-full" value="0" max="100"></progress>
                        </div>
                    </div>
                </div>
            `;
            // Exibir banner global de processamento
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
                        processedCount++;
                        updateProgress(processedCount, totalProcessamento, `Processados: ${processedCount}/${arquivosUnicos.length}` , errorCount);
                        return decreto;
                    } catch (error) {
                        console.error(`Erro ao processar ${file.name}:`, error);
                        processedCount++;
                        errorCount++;
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
            
            exibirResultados(documentosValidos, documentosFalhos, documentosDuplicados);
            
            // Download automático dos arquivos
            downloadArquivos(documentosValidos, documentosFalhos, configuracaoSaida, documentosDuplicados);
            hideProgress();
            
            console.log('ID de Documentação:', numeroDocumento);
            console.log('Documentos válidos:', documentosValidos);
            console.log('Documentos com falhas:', documentosFalhos);
            console.log('Documentos duplicados:', documentosDuplicados);
        });

        function updateProgress(current, total, message, errors = 0) {
            const progressContainer = document.getElementById('progressContainer');
            const progressText = document.getElementById('progressText');
            const progressFill = document.getElementById('progressFill');

            const banner = document.getElementById('processingBanner');
            const bannerText = document.getElementById('processingText');
            const bannerFill = document.getElementById('processingProgress');

            const dashStatus = document.getElementById('dashStatus');
            const dashPercent = document.getElementById('dashPercent');
            const dashCounts = document.getElementById('dashCounts');
            const dashFill = document.getElementById('dashProgressFill');
            const statTotal = document.getElementById('statTotal');
            const statDone = document.getElementById('statDone');
            const statPending = document.getElementById('statPending');
            const statErrors = document.getElementById('statErrors');

            const percentage = Math.round((current / total) * 100);

            // Banner global no topo
            if (banner) banner.classList.remove('hidden');
            if (bannerText) bannerText.textContent = message;
            if (bannerFill) bannerFill.value = percentage;
            
            // Cartão local na página
            if (progressContainer) progressContainer.style.display = 'block';
            if (progressFill) progressFill.value = percentage;
            if (progressText) progressText.textContent = `${message} - ${percentage}%`;

            // Painel estilo Baixatron
            if (dashStatus) dashStatus.textContent = message;
            if (dashPercent) dashPercent.textContent = `${percentage}%`;
            if (dashCounts) dashCounts.textContent = `${current} / ${total}`;
            if (dashFill) dashFill.style.width = `${percentage}%`;
            if (statTotal) statTotal.textContent = total;
            if (statDone) statDone.textContent = current;
            if (statPending) statPending.textContent = Math.max(0, total - current);
            if (statErrors) statErrors.textContent = errors;
        }

        function hideProgress() {
            const banner = document.getElementById('processingBanner');
            if (banner) banner.classList.add('hidden');
            const dashStatus = document.getElementById('dashStatus');
            if (dashStatus) dashStatus.textContent = 'Concluído';
        }

        function exibirResultados(documentosValidos, documentosFalhos, documentosDuplicados = []) {
            const resultsDiv = document.getElementById('results');
            
            let html = `<div class="card bg-base-100 shadow-xl fade-in"><div class="card-body">`;
            
            // Resumo com stats
            html += `
                <div class="stats shadow mb-6 w-full">
                    <div class="stat">
                        <div class="stat-figure text-success">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-8 h-8 stroke-current">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                        <div class="stat-title">Documentos Válidos</div>
                        <div class="stat-value text-success">${documentosValidos.length}</div>
                        <div class="stat-desc">Processados com sucesso</div>
                    </div>
                    
                    ${documentosFalhos.length > 0 ? `
                    <div class="stat">
                        <div class="stat-figure text-error">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-8 h-8 stroke-current">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                        </div>
                        <div class="stat-title">Com Falhas</div>
                        <div class="stat-value text-error">${documentosFalhos.length}</div>
                        <div class="stat-desc">Requerem atenção</div>
                    </div>
                    ` : ''}
                </div>
            `;
            
            if (documentosDuplicados.length > 0) {
                html += `
                    <div class="alert alert-warning mb-6">
                        <div>
                            <h3 class="font-bold">${documentosDuplicados.length} documento${documentosDuplicados.length > 1 ? 's' : ''} duplicado${documentosDuplicados.length > 1 ? 's' : ''}</h3>
                            <div class="text-xs">Eles nao entraram nos JSONs principais.</div>
                        </div>
                        <button id="downloadDuplicadosBtn" type="button" class="btn btn-warning btn-sm">Baixar duplicados.json</button>
                    </div>
                `;
            }

            // Container com duas colunas
            html += '<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">';
            
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
                    html += `
                        <div class="card bg-base-200 shadow-md hover:shadow-xl transition-all hover:scale-[1.02]">
                            <div class="card-body p-4">
                                <h3 class="card-title text-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    ${documento.arquivo}
                                </h3>
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
                    html += `
                        <div class="card bg-error bg-opacity-10 border border-error shadow-md hover:shadow-xl transition-all">
                            <div class="card-body p-4">
                                <h3 class="card-title text-sm text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    ${documento.arquivo}
                                </h3>
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
            
            // Fechar container de colunas
            html += '</div></div></div>';
            
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
            const botaoDuplicados = document.getElementById('downloadDuplicadosBtn');
            if (botaoDuplicados) {
                botaoDuplicados.addEventListener('click', baixarDuplicadosJson);
            }
        }

        let tiposDocumentosCache = [];

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
                <option value="">Selecione um documento...</option>
                <option value="auto">🔍 Auto-detectar (pelo nome/conteúdo)</option>
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
