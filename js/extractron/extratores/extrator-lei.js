// Extractron - extrator de lei

        function extrairInformacoesLei(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento) {
            // Tentar múltiplos padrões de extração do número da lei
            let numeroDoDocumento = null;
            
            // PRIORIDADE 1: Extrair do nome do arquivo (mais confiável)
            const regexNomeArquivo = /Lei\s+n[°ºª\s]*(\d+)/i;
            const matchNomeArquivo = nomeArquivo.match(regexNomeArquivo);
            if (matchNomeArquivo) {
                numeroDoDocumento = matchNomeArquivo[1];
                console.log(`[LEI] Número extraído do nome do arquivo: ${numeroDoDocumento}`);
            }
            
            if (!numeroDoDocumento) {
                const padroesNomeArquivoLei = [
                    /leis?\d{4}[_\-\s]+(\d{1,5})/i,
                    /leis?[_\-\s]+(?:n[°ºª\s]*)?(\d{1,5})(?:[_\-\s]|\.pdf$)/i,
                    /(?:^|[_\-\s])lei[_\-\s]+(\d{1,5})(?:[_\-\s]|\.pdf$)/i
                ];

                for (const regexNomeArquivoLei of padroesNomeArquivoLei) {
                    const matchNomeArquivoLei = nomeArquivo.match(regexNomeArquivoLei);
                    if (!matchNomeArquivoLei) continue;
                    numeroDoDocumento = String(parseInt(matchNomeArquivoLei[1], 10));
                    console.log(`[LEI] Número extraído do nome do arquivo: ${numeroDoDocumento}`);
                    break;
                }
            }

            // PRIORIDADE 2: Se não achou no nome, procurar no texto
            if (!numeroDoDocumento) {
                const padroes = [
                    /LEI\s+(?:MUNICIPAL\s+)?N[°ºª\s.]+(\d+)/i,
                    /L\s*E\s*I\s+N[°ºª\s.]+(\d+)/i,
                    /LEI\s+(?:Nº|N°|NO)\s*(\d+)/i
                ];
                
                for (const regex of padroes) {
                    const match = texto.substring(0, 300).match(regex);
                    if (match) {
                        numeroDoDocumento = match[1];
                        console.log(`[LEI] Número extraído do texto: ${numeroDoDocumento}`);
                        break;
                    }
                }
            }
            
            // Mapa de meses em português
            const meses = {
                'janeiro': '01', 'fevereiro': '02', 'março': '03', 'abril': '04',
                'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08',
                'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
            };
            
            // Extrair data - MÚLTIPLOS FORMATOS
            let data = null;

            data = extrairDataLeiContextual(texto, nomeArquivo, numeroDoDocumento);
            if (data) {
                console.log(`[LEI] Data extraida pelo numero da lei: ${data}`);
            }

            if (!data) {
                const anoArquivo = extrairAnoDoNomeArquivo(nomeArquivo);
                const datasMesmoAno = extrairDatasPadraoOrdenadas(texto).filter(item => item.ano === anoArquivo);
                if (datasMesmoAno.length > 0) {
                    data = datasMesmoAno[0].data;
                    console.log(`[LEI] Data extraida pelo ano do arquivo: ${data}`);
                }
            }
            
            // Formato 1: Do nome do arquivo (ex: "22 de Agosto de 2025")
            const regexDataNomeArquivo = /(\d{1,2})\s+de\s+([A-Za-zç]+)\s+de\s+(\d{4})/i;
            const matchDataNome = nomeArquivo.match(regexDataNomeArquivo);
            if (!data && matchDataNome) {
                const dia = parseInt(matchDataNome[1]);
                const mesNome = matchDataNome[2].toLowerCase();
                const mes = meses[mesNome] || '01';
                const ano = parseInt(matchDataNome[3]);
                data = `${dia.toString().padStart(2, '0')}/${mes}/${ano}`;
                console.log(`[LEI] Data extraída do nome: ${data}`);
            }
            
            // Formato 2: Do texto (se não achou no nome)
            if (!data) {
                const padroesDatas = [
                    /(\d{1,2})\s+(?:DE\s+)?([A-ZÇÃÕÁÉÍÓÚÂÊÔÀ]+)\s+(?:DE\s+)?(\d{4})/i,
                    /(\d{1,2})\s+dias?\s+do\s+mês\s+de\s+([A-ZÇÃÕÁÉÍÓÚÂÊÔÀ]+)\s+de\s+(\d{4})/i,
                    /(\d{1,2})[\/\.](\d{1,2})[\/\.](\d{4})/
                ];
                
                for (const regex of padroesDatas) {
                    const match = texto.match(regex);
                    if (match) {
                        const dia = parseInt(match[1]);
                        const mesNome = match[2];
                        
                        // Se for número (formato dd/mm/yyyy)
                        if (/^\d+$/.test(mesNome)) {
                            const mes = parseInt(mesNome);
                            const ano = parseInt(match[3]);
                            // Validar data
                            if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) {
                                data = `${dia.toString().padStart(2, '0')}/${mes.toString().padStart(2, '0')}/${ano}`;
                                console.log(`[LEI] Data extraída do texto (numérica): ${data}`);
                                break;
                            }
                        } else {
                            // É nome de mês
                            const mes = meses[mesNome.toLowerCase()] || '01';
                            const ano = parseInt(match[3]);
                            // Validar dia
                            if (dia >= 1 && dia <= 31) {
                                data = `${dia.toString().padStart(2, '0')}/${mes}/${ano}`;
                                console.log(`[LEI] Data extraída do texto (extenso): ${data}`);
                                break;
                            }
                        }
                    }
                }
            }

            // Fallback geral para datas com variações de OCR e formatos do nome do arquivo.
            if (!data) {
                data = extrairDataPadrao(texto, nomeArquivo);
            }

            if (!data) {
                const anoArquivo = extrairAnoDoNomeArquivo(nomeArquivo);
                if (anoArquivo) {
                    data = `01/01/${anoArquivo}`;
                    console.log(`[LEI] Data inferida pelo ano do arquivo: ${data}`);
                }
            }
            
            // Descrição - melhorada para capturar o conteúdo principal
            let descricao = '';
            
            // Procurar palavras-chave comuns em leis
            const palavrasChave = [
                'dispõe sobre',
                'dispõe',
                'altera',
                'revoga',
                'autoriza',
                'estabelece',
                'institui',
                'regulamenta',
                'aprova',
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
                'concede',
                'ementa'
            ];
            
            let inicioDescricao = -1;
            let palavraEncontrada = '';
            
            for (const palavra of palavrasChave) {
                const index = texto.toLowerCase().indexOf(palavra.toLowerCase());
                if (index !== -1 && (inicioDescricao === -1 || index < inicioDescricao)) {
                    inicioDescricao = index;
                    palavraEncontrada = palavra;
                }
            }
            
            if (inicioDescricao !== -1) {
                // Extrair do início da descrição
                let textoDescricao = texto.substring(inicioDescricao);
                
                // Limpar espaços extras e quebras de linha
                textoDescricao = textoDescricao.replace(/\s+/g, ' ').trim();
                
                // Procurar o fim da descrição
                const marcadoresFim = [
                    ', e dá outras providências',
                    ' e dá outras providências',
                    'e dá outras providências',
                    ', e outras providências',
                    'art. 1',
                    'artigo 1'
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
                
                // Se não encontrou marcador, limitar a 300 caracteres
                if (fimDescricao === textoDescricao.length && textoDescricao.length > 300) {
                    const matchPonto = textoDescricao.substring(0, 300).match(/\.\s+[A-Z]/);
                    if (matchPonto) {
                        fimDescricao = matchPonto.index + 1;
                    } else {
                        fimDescricao = 300;
                    }
                }
                
                descricao = textoDescricao.substring(0, fimDescricao).trim();
                if (marcadorUsado) {
                    descricao += marcadorUsado;
                }
                
                // Limpar caracteres OCR problemáticos
                descricao = descricao
                    .replace(/[:\\|_\*]+/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                
                // Garantir que termina com pontuação
                if (descricao && !/[.!?,;]$/.test(descricao)) {
                    descricao += '.';
                }
            }

            // Fallback para anexos e arquivos sem ementa clara no OCR.
            if (!descricao || descricao.trim().length < 8) {
                const descricaoNome = limparDescricaoArquivo(nomeArquivo)
                    .replace(/^leis?\d*\s*/i, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                if (descricaoNome) {
                    descricao = descricaoNome;
                }
            }

            if ((!descricao || descricao.trim().length < 8) && numeroDoDocumento) {
                const anoArquivo = extrairAnoDoNomeArquivo(nomeArquivo);
                descricao = `Lei n ${numeroDoDocumento}${anoArquivo ? '/' + anoArquivo : ''}`;
            }
            
            console.log(`[LEI] Arquivo: ${nomeArquivo}`);
            console.log(`[LEI] Número: ${numeroDoDocumento}`);
            console.log(`[LEI] Data: ${data}`);
            console.log(`[LEI] Descrição: ${descricao ? descricao.substring(0, 50) + '...' : 'VAZIA'}`);
            
            return {
                numero: numeroDocumento,
                arquivo: nomeArquivo,
                numeroDoDocumento: numeroDoDocumento,
                data: data,
                letra: null,
                descricao: descricao ? descricao.toUpperCase().substring(0, 300) : null,
                url: `${urlDocumentos}${encodeURIComponent(nomeArquivo)}`,
                tipoDocumento: tipoDocumento
            };
        }

