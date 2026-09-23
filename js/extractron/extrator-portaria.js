// Extractron - extrator de portaria

        function extrairInformacoesPortaria(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento) {
            const textoCompleto = normalizarTextoCompleto(texto);
            const nomeArquivoSemHash = removerPrefixoHashNomeArquivo(nomeArquivo);

            // Extrair número da portaria - MÚLTIPLOS PADRÕES para maior cobertura
            const regexPatterns = [
                // Padrão 1: PORTARIA [MUNICIPAL] N° 123/2024 ou N° 123-A
                /PORTARIA(?:\s+MUNICIPAL)?\s+N[°ºª\s]*[\s.]*(\d+)(?:[-\/]((?:\d[\s\.,]*){4}))?(?:[-\/]([A-Z]))?/i,
                
                // Padrão 2: PORTARIA [MUNICIPAL] No 123 (letra O maiúscula)
                /PORTARIA(?:\s+MUNICIPAL)?\s+N[oO][\s.]*(\d+)(?:[-\/]((?:\d[\s\.,]*){4}))?(?:[-\/]([A-Z]))?/i,
                
                // Padrão 3: Com quebras de linha entre PORTARIA e número
                /PORTARIA(?:\s+MUNICIPAL)?[\s\n]+N[°ºªoO\s.]*[\s\n]*(\d+)(?:[-\/]((?:\d[\s\.,]*){4}))?/i,
                
                // Padrão 4: Variante abreviada mas ainda exigindo contexto de PORTARIA
                /PORTARIA[^\n\r]{0,140}\bN[°ºª\s]*[\s.]*(\d+)\/[\s.]*(?:((?:\d[\s\.,]*){4}))(?:-([A-Z]))?/i,
                
                // Padrão 5: Número no nome do arquivo (fallback)
                null // Será tratado separadamente
            ];
            
            let numeroDoDocumento = null;
            let anoPortaria = null;
            let letraPortaria = null;
            let matchNumero = null;
            let padraoUsado = -1;
            
            // Tentar cada padrão
            for (let i = 0; i < regexPatterns.length - 1; i++) {
                matchNumero = textoCompleto.match(regexPatterns[i]);
                if (matchNumero) {
                    padraoUsado = i + 1;
                    numeroDoDocumento = matchNumero[1];
                    anoPortaria = matchNumero[2] ? String(matchNumero[2]).replace(/\D/g, '').slice(0, 4) : null;
                    letraPortaria = matchNumero[3];
                    break;
                }
            }
            
            // Fallback: Tentar extrair do nome do arquivo (N13.pdf, N110-A.pdf, etc)
            if (!numeroDoDocumento) {
                const regexNomeArquivo = /\bN[\s._-]*0*(\d{1,6})(?:[-_\s]*([A-Z]))?(?:[.\-\/]((?:19|20)\d{2}))?/i;
                const matchArquivo = nomeArquivoSemHash.match(regexNomeArquivo);
                if (matchArquivo) {
                    numeroDoDocumento = matchArquivo[1];
                    letraPortaria = matchArquivo[2]; // Captura a letra do arquivo
                    anoPortaria = matchArquivo[3];
                    padraoUsado = 6; // Padrão do nome do arquivo
                }
            }

            // Fallback adicional: "portaria19.pdf" -> 19
            if (!numeroDoDocumento) {
                const nomeBase = String(nomeArquivoSemHash || '').replace(/\.pdf$/i, '');

                const matchPortariaNoNome = nomeBase.match(/(?:^|[^A-Za-z])PORTARIA[\s._\-]*0*(\d{1,6})(?:[.\-\/]((?:19|20)\d{2}))?(?:[-_\s]*([A-Z]))?\b/i);
                if (matchPortariaNoNome) {
                    numeroDoDocumento = matchPortariaNoNome[1];
                    anoPortaria = matchPortariaNoNome[2] || null;
                    letraPortaria = matchPortariaNoNome[3] || null;
                    padraoUsado = 7;
                } else {
                    const matchPortariaSimples = nomeBase.match(/(?:^|[^A-Za-z])PORTARIA[\s._\-]*0*(\d{1,6})\b/i);
                    if (matchPortariaSimples) {
                        numeroDoDocumento = matchPortariaSimples[1];
                        padraoUsado = 8;
                    }
                }
            }
            
            // Guardar o número original antes de montar número completo
            const numeroOriginal = numeroDoDocumento;
            
            // Montar número completo apenas para numeroDoDocumento
            if (numeroDoDocumento) {
                if (anoPortaria) {
                    numeroDoDocumento = `${numeroDoDocumento}/${anoPortaria}`;
                }
                // NÃO incluir a letra no numeroDoDocumento - ela vai no campo 'letra' separado
            }

            const anoReferenciaPortaria = (anoPortaria && /^(19|20)\d{2}$/.test(String(anoPortaria)))
                ? String(anoPortaria)
                : extrairAnoDoNomeArquivo(nomeArquivoSemHash);
            const aceitarDataPortaria = (valor) => {
                if (!valor) return null;
                const anoData = String(valor).match(/(?:^|[\/\-])((?:19|20)\d{2})$/)?.[1] || null;
                if (anoReferenciaPortaria && anoData && anoData !== anoReferenciaPortaria) return null;
                return valor;
            };
            
            // Mapa de meses em português
            const meses = {
                'janeiro': '01', 'fevereiro': '02', 'marco': '03', 'março': '03', 'abril': '04',
                'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08',
                'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
            };
            
            // Extrair data no formato "DE 08 DE JANEIRO DE 2025" ou ", 08 DE JANEIRO DE 2025"
            const regexDataExtenso = /(?:DE\s+|,\s*)(\d{1,2})\s+DE\s+([A-ZÇÃÕÁÉÍÓÚÂÊÔÀ]+)\s+DE\s+((?:\d[\s\.,]*){4})/i;
            const matchDataExtenso = textoCompleto.match(regexDataExtenso);

            let data = null;

            if (matchDataExtenso) {
                const dia = parseInt(matchDataExtenso[1], 10);
                const mesNome = String(matchDataExtenso[2] || '').toLowerCase();
                const mes = meses[mesNome] || '01';
                const ano = String(matchDataExtenso[3] || '').replace(/\D/g, '').slice(0, 4);
                if (ano.length === 4) data = aceitarDataPortaria(`${String(dia).padStart(2, '0')}/${mes}/${ano}`);
            }

            // Fallback: tentar pegar a última data encontrada no documento (normalmente no rodapé)
            if (!data) {
                const datasOrdenadas = extrairDatasPadraoOrdenadas(textoCompleto);
                const datasMesmoAno = anoReferenciaPortaria
                    ? datasOrdenadas.filter(item => item.ano === anoReferenciaPortaria)
                    : datasOrdenadas;
                if (datasMesmoAno.length) data = datasMesmoAno[datasMesmoAno.length - 1].data;
            }

            // Fallback final: regras genéricas de data
            if (!data) {
                data = aceitarDataPortaria(extrairDataPadrao(textoCompleto, nomeArquivo));
            }

            // Se não encontrou dia/mês mas existe ano no nome/extração, usar 01/01/ANO como último fallback.
            if (!data) {
                const anoFallback = anoReferenciaPortaria;
                if (anoFallback) {
                    data = `01/01/${anoFallback}`;
                }
            }
            
            // Descrição - melhorada para capturar o conteúdo principal
            let descricao = '';
            
            // Procurar palavras-chave comuns em portarias
            const palavrasChave = [
                'dispõe sobre',
                'dispoe sobre',
                'dispõe',
                'dispoe',
                'altera',
                'revoga',
                'autorizada',
                'estabelece',
                'institui',
                'regulamenta',
                'aprova',
                'autoriza',
                'nomeia',
                'exonera',
                'designa',
                'fixa',
                'cria',
                'extingue',
                'torna',
                'dispensa',
                'declara',
                'determina',
                'ementa',
                'concede'
            ];
            
            let inicioDescricao = -1;
            let palavraEncontrada = '';
            
            for (const palavra of palavrasChave) {
                const index = textoCompleto.toLowerCase().indexOf(palavra.toLowerCase());
                if (index !== -1 && (inicioDescricao === -1 || index < inicioDescricao)) {
                    inicioDescricao = index;
                    palavraEncontrada = palavra;
                }
            }
            
            if (inicioDescricao !== -1) {
                // Extrair do início da descrição
                let textoDescricao = textoCompleto.substring(inicioDescricao);
                
                // Limpar espaços extras e quebras de linha
                textoDescricao = textoDescricao.replace(/\s+/g, ' ').trim();
                
                // Procurar o fim da descrição (antes de "e dá outras providências" ou artigo 1)
                const marcadoresFim = [
                    ', e dá outras providências',
                    ' e dá outras providências',
                    'e dá outras providências',
                    ', e outras providências'
                ];
                
                let fimDescricao = textoDescricao.length;
                let marcadorUsado = '';
                
                for (const marcador of marcadoresFim) {
                    const index = textoDescricao.toLowerCase().indexOf(marcador.toLowerCase());
                    if (index !== -1 && index < fimDescricao) {
                        fimDescricao = index;
                        marcadorUsado = marcador;
                    }
                }
                
                // Se não encontrou nenhum marcador, pegar até o primeiro ponto seguido de maiúscula
                if (fimDescricao === textoDescricao.length) {
                    const matchPonto = textoDescricao.match(/\.\s+[A-Z]/);
                    if (matchPonto && matchPonto.index < 500) {
                        fimDescricao = matchPonto.index + 1;
                    }
                }

                // Se não encontrou nenhum marcador, pegar até os 4 números seguidos de ponto
                if (fimDescricao === textoDescricao.length) {
                    const matchPonto = textoDescricao.match(/[0-9]{4}\./);
                    if (matchPonto && matchPonto.index < 500) {
                        fimDescricao = matchPonto.index + String(matchPonto[0] || '').length;
                    }
                }
                
                descricao = textoDescricao.substring(0, fimDescricao).trim() + marcadorUsado;
                
                // Garantir que termina com pontuação
                if (descricao && !/[.!?,;]$/.test(descricao)) {
                    const ultimoPonto = Math.max(
                        descricao.lastIndexOf('.'),
                        descricao.lastIndexOf(','),
                        descricao.lastIndexOf(';')
                    );
                    if (ultimoPonto > 50) {
                        descricao = descricao.substring(0, ultimoPonto + 1);
                    } else {
                        descricao += '.';
                    }
                }
            }

            // Fallback: se não achou palavra-chave, tenta capturar a linha/título do documento
            if (!descricao) {
                const matchLinha = textoCompleto.match(/^\s*PORTARIA[^\n\r]{0,220}/im)
                    || textoCompleto.match(/^\s*DISP[ÕO]E[^\n\r]{0,220}/im)
                    || textoCompleto.match(/^\s*DISPOE[^\n\r]{0,220}/im);

                if (matchLinha && matchLinha[0]) {
                    descricao = matchLinha[0].replace(/\s+/g, ' ').trim();
                }
            }

            // Fallback: se OCR não trouxe texto, derive do nome do arquivo (sem hash).
            if (!descricao || String(descricao).trim().length < 8) {
                const descNome = limparDescricaoArquivo(nomeArquivoSemHash);
                if (descNome) descricao = descNome;
            }

            if ((!descricao || String(descricao).trim().length < 8) && numeroOriginal) {
                descricao = `PORTARIA Nº ${String(parseInt(numeroOriginal, 10))}`;
                if (anoPortaria) descricao += `/${anoPortaria}`;
            }
            
            return {
                numero: numeroDocumento,
                arquivo: nomeArquivo,
                numeroDoDocumento: numeroDoDocumento,
                data: data,
                letra: letraPortaria || null,
                descricao: descricao.toUpperCase() || null,
                url: `${urlDocumentos}${encodeURIComponent(nomeArquivo)}`,
                tipoDocumento: tipoDocumento
            };
        }

