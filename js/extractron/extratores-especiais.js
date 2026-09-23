// Extractron - extratores genéricos, despesas, julgamento de contas e atas

        function extrairInformacoesDespesaGenerica(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento) {
            const contextoFinanceiro = normalizarBusca(`${nomeArquivo || ''} ${urlDocumentos || ''}`);
            const tipoDetectado = /informacao\s*financeiras?|balanco\s*anual|balancoanual|balancetes?\s*mensais|balancetesmensais/.test(contextoFinanceiro)
                ? 'Balancetes'
                : (tipoDocumento || detectarTipoDespesaPeloNome(nomeArquivo) || 'Despesas');
            const nomeLimpo = limparDescricaoArquivo(nomeArquivo)
                .replace(/^\d{4}\s+\d{1,2}\s*[A-Za-z\u00C0-\u00FF]+\s*/i, '')
                .replace(/\b(LSTORD|LSTEMP|RAZLIQ)\b/ig, (match) => {
                    const mapa = {
                        LSTORD: 'Listagem de Ordens',
                        LSTEMP: 'Listagem de Empenhos',
                        RAZLIQ: 'Razao de Liquidacao'
                    };
                    return mapa[match.toUpperCase()] || match;
                })
                .replace(/\s+/g, ' ')
                .trim();

            const fonteNumero = `${nomeArquivo || ''} ${texto || ''}`;
            const numeroMatch = fonteNumero.match(/(?:n[º°o]?\s*|numero\s+de\s+contrato\s*:?\s*|contrato\s+|ct\s*)(\d{1,4})(?:\s*[-\/]\s*((?:19|20)\d{2}))?/i)
                || String(nomeArquivo || '').match(/(?:^|[_\-\s])(\d{1,4})(?:[\.\s_\-]|$)/);
            const competencia = obterDataCompetenciaArquivo(nomeArquivo);
            const anoArquivo = extrairAnoDoNomeArquivo(nomeArquivo);
            const data = extrairDataPadrao(texto, nomeArquivo) || competencia || (anoArquivo ? `01/01/${anoArquivo}` : null);
            const descricao = nomeLimpo || tipoDetectado;

            return {
                numero: numeroDocumento,
                arquivo: nomeArquivo,
                numeroDoDocumento: numeroMatch ? String(parseInt(numeroMatch[1], 10)) : null,
                data: data,
                letra: null,
                descricao: descricao.toUpperCase(),
                url: `${urlDocumentos}${encodeURIComponent(nomeArquivo)}`,
                tipoDocumento: tipoDetectado
            };
        }

        function extrairInformacoesJulgamentoContas(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento) {
            const textoCompleto = normalizarTextoCompleto(texto);
            const nomeArquivoSemHash = removerPrefixoHashNomeArquivo(nomeArquivo);
            const fonte = normalizarTextoCompleto(`${nomeArquivoSemHash || ''} ${textoCompleto || ''}`);
            const fonteSemAcentos = normalizarSemAcentos(fonte).toUpperCase();

            const extrairAnoExercicio = () => {
                const nomeNorm = normalizarSemAcentos(nomeArquivoSemHash || '').toUpperCase();
                const textoNorm = fonteSemAcentos.substring(0, 3000);
                const matchNome = nomeNorm.match(/\b(?:DE|DO|DA|EXERCICIO(?:\s+FINANCEIRO)?)\s*((?:19|20)\d{2})\b/)
                    || nomeNorm.match(/\b((?:19|20)\d{2})\b/);
                if (matchNome) return matchNome[1];

                const matchTexto = textoNorm.match(/\bREFERENTES?\s+AO\s+EXERCICIO(?:\s+FINANCEIRO)?\s+DE\s+((?:19|20)\d{2})\b/)
                    || textoNorm.match(/\bEXERCICIO(?:\s+FINANCEIRO)?\s+DE\s+((?:19|20)\d{2})\b/);
                return matchTexto ? matchTexto[1] : null;
            };

            const normalizarAnoDocumento = (valor) => {
                const ano = String(valor || '').replace(/\D/g, '').slice(0, 4);
                return /^(19|20)\d{2}$/.test(ano) ? ano : null;
            };

            const anoExercicio = extrairAnoExercicio();
            const numeroFallbackPorAno = {
                1993: '17',
                1994: '18',
                1995: '19',
                1996: '20',
                1997: '21',
                1998: '22',
                1999: '23',
                2000: '24',
                2001: '25',
                2002: '1',
                2003: '2',
                2004: '3',
                2005: '5',
                2006: '5',
                2007: '6',
                2008: '7',
                2020: '1',
                2021: '2',
                2022: '3'
            };

            const candidatosNumero = [];
            const adicionarNumero = (numero, ano, origem, prioridade) => {
                const numeroLimpo = normalizarNumeroInteiro(numero);
                if (!numeroLimpo) return;
                candidatosNumero.push({
                    numero: numeroLimpo,
                    ano: normalizarAnoDocumento(ano),
                    origem,
                    prioridade
                });
            };

            const padroesNumero = [
                {
                    regex: /\bDECRETO\s+LEGISLATIVO\b[\s\S]{0,100}?\bN\s*[º°ªO\.]*\s*0*(\d{1,6})(?:\s*[\/\.-]\s*((?:19|20)\d{2}))?/i,
                    prioridade: 1
                },
                {
                    regex: /\bDECRETO\b[\s\S]{0,100}?\bN\s*[º°ªO\.]*\s*0*(\d{1,6})(?:\s*[\/\.-]\s*((?:19|20)\d{2}))?/i,
                    prioridade: 2
                },
                {
                    regex: /\bDECRETO\s+LEGISLATIVO\b[\s\S]{0,100}?0*(\d{1,6})\s*[\/\.-]\s*((?:19|20)\d{2})/i,
                    prioridade: 3
                }
            ];

            for (const padrao of padroesNumero) {
                const match = fonte.match(padrao.regex);
                if (match) {
                    adicionarNumero(match[1], match[2], 'texto', padrao.prioridade);
                }
            }

            if (anoExercicio && numeroFallbackPorAno[anoExercicio]) {
                const esperado = numeroFallbackPorAno[anoExercicio];
                const candidatoTexto = candidatosNumero.find((item) => Number(item.numero) === Number(esperado));

                if (!candidatoTexto) {
                    const candidatoConfiavel = candidatosNumero.find((item) => item.ano === '2025' && Number(item.numero) >= 1 && Number(item.numero) <= 40);
                    if (!candidatoConfiavel) {
                        adicionarNumero(esperado, '2025', 'fallback ano do arquivo', 0);
                    }
                }
            }

            const numeroEscolhido = candidatosNumero
                .sort((a, b) => a.prioridade - b.prioridade)[0] || null;

            let numeroDoDocumento = numeroEscolhido ? numeroEscolhido.numero : null;

            const extrairDataJulgamento = () => {
                const trechoGabinete = textoCompleto.match(/\bGabinete\s+do\s+Presidente\b[\s\S]{0,160}/i);
                if (trechoGabinete) {
                    const dataGabinete = extrairDataPadrao(trechoGabinete[0], '');
                    if (dataGabinete) return dataGabinete;
                }

                const matchCarimbo = textoCompleto.match(/\bEM\s+(\d{1,2})\s*[\/\.-]\s*(\d{1,2})\s*[\/\.-]\s*((?:\d[\s\.,]*){4})\b/i);
                if (matchCarimbo) {
                    const dia = String(parseInt(matchCarimbo[1], 10)).padStart(2, '0');
                    const mes = String(parseInt(matchCarimbo[2], 10)).padStart(2, '0');
                    const ano = String(matchCarimbo[3]).replace(/\D/g, '').slice(0, 4);
                    if (ano.length === 4) return `${dia}/${mes}/${ano}`;
                }

                const datasOrdenadas = extrairDatasPadraoOrdenadas(textoCompleto);
                if (datasOrdenadas.length) return datasOrdenadas[datasOrdenadas.length - 1].data;

                return extrairDataPadrao(textoCompleto, nomeArquivoSemHash);
            };

            const data = extrairDataJulgamento()
                || (anoExercicio ? `01/01/${anoExercicio}` : null);

            let descricao = null;
            const matchEmenta = textoCompleto.match(/\bDisp[õo]e\s+sobre[\s\S]{10,320}?(?=(?:\bO\s+PRESIDENTE\b|\bArt\.?\s*1|$))/i)
                || textoCompleto.match(/\bDispõe\s+sobre[\s\S]{10,320}?(?=(?:\bO\s+PRESIDENTE\b|\bArt\.?\s*1|$))/i);
            if (matchEmenta && matchEmenta[0]) {
                descricao = matchEmenta[0]
                    .replace(/\s+/g, ' ')
                    .replace(/\s+([,.;:])/g, '$1')
                    .trim();
            }

            if (!descricao || descricao.length < 8) {
                const aprovada = /\bFica\s+aprovada\b|\bAPROVACAO\b|\bAPROVAÇÃO\b/i.test(fonte);
                const rejeitada = /\bFica\s+rejeitada\b|\bREJEICAO\b|\bREJEIÇÃO\b/i.test(fonte);
                const situacao = rejeitada ? 'REJEICAO' : (aprovada ? 'APROVACAO' : 'JULGAMENTO');
                descricao = `${situacao} DAS CONTAS CONSOLIDADAS DO MUNICIPIO DE LIZARDA - TO${anoExercicio ? ', EXERCICIO DE ' + anoExercicio : ''}.`;
            }

            return {
                numero: numeroDocumento,
                arquivo: nomeArquivo,
                numeroDoDocumento: numeroDoDocumento,
                data: data,
                letra: null,
                descricao: descricao ? descricao.toUpperCase().substring(0, 300) : null,
                url: `${urlDocumentos}${encodeURIComponent(nomeArquivo)}`,
                tipoDocumento: tipoDocumento || 'Julgamento de Contas'
            };
        }

        function extrairInformacoesAta(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento) {
            const textoCompleto = normalizarTextoCompleto(texto);
            const fonteSemAcentos = normalizarSemAcentos(`${nomeArquivo || ''} ${textoCompleto || ''}`).toUpperCase();
            const inicioTextoAta = normalizarSemAcentos(textoCompleto.substring(0, 2600)).toUpperCase();

            const extrairDataCabecalhoAta = () => {
                const meses = {
                    JANEIRO: '01',
                    FEVEREIRO: '02',
                    MARCO: '03',
                    ABRIL: '04',
                    MAIO: '05',
                    JUNHO: '06',
                    JULHO: '07',
                    AGOSTO: '08',
                    SETEMBRO: '09',
                    OUTUBRO: '10',
                    NOVEMBRO: '11',
                    DEZEMBRO: '12'
                };

                const normalizarAnoAta = (valor) => String(valor || '').replace(/\D/g, '').slice(0, 4);
                const montarData = (match) => {
                    if (!match) return null;
                    const dia = String(parseInt(match[1], 10)).padStart(2, '0');
                    const mesNome = String(match[2] || '').replace(/[^A-Z]/g, '');
                    const mes = meses[mesNome];
                    const ano = normalizarAnoAta(match[3]);
                    if (!mes || ano.length !== 4) return null;
                    return `${dia}/${mes}/${ano}`;
                };

                const padroes = [
                    /\bAOS?\s+(\d{1,2})(?:\s*\([^)]+\))?\s+DIAS?\s+DO\s+MES\s+DE\s+([A-Z]+)\s+DE\s+((?:\d[\s\.,]*){4})\b/i,
                    /\b(\d{1,2})(?:\s*\([^)]+\))?\s+DIAS?\s+DO\s+MES\s+DE\s+([A-Z]+)\s+DE\s+((?:\d[\s\.,]*){4})\b/i,
                    /\b(\d{1,2})\s+DE\s+([A-Z]+)\s+DE\s+((?:\d[\s\.,]*){4})\b/i
                ];

                for (const padrao of padroes) {
                    const data = montarData(inicioTextoAta.match(padrao));
                    if (data) return data;
                }

                return null;
            };

            const extrairAnoProvavelDoTexto = () => {
                const candidatos = fonteSemAcentos.matchAll(/\b((?:\d[\s\.,]*){4})\b/g);
                for (const match of candidatos) {
                    const anoLimpo = String(match[1] || '').replace(/\D/g, '').slice(0, 4);
                    if (/^(19|20)\d{2}$/.test(anoLimpo)) return anoLimpo;
                }
                return null;
            };

            // Extrair número da ata/sessão.
            // Suporta padrões antigos: "ATA DA 1ª", "ATA DA IIº", etc.
            // E o padrão comum em cabeçalho: "ATA 004 DA SESSAO ...".
            const regexNumeroOrdinalOuRomano = /\bATA\s+D[AO]?\s+(?:N[\u00ba\u00aa\u00b0O.]?\s*)?0*([IVXLCDM]+|\d{1,6})\s*(?:[\u00ba\u00aa\u00b0]|[AO])?(?:\s*\([^)]+\))?(?=\s*(?:[,.;:]|\bSESS[AÃ]O\b|\bORDINARIA\b|\bEXTRAORDINARIA\b))/i;
            const regexNumeroCabecalhoComSessao = /\bATA\s*(?:N[\u00ba\u00aa\u00b0O.]?\s*)?0*(\d{1,6})\b(?=[^\n\r]{0,140}\bSESSAO\b)/i;
            const regexNumeroCabecalhoSolto = /\bATA\s*(?:N[\u00ba\u00aa\u00b0O.]?\s*)?0*(\d{1,6})\b/i;

            const matchNumero = textoCompleto.match(regexNumeroOrdinalOuRomano)
                || fonteSemAcentos.match(regexNumeroCabecalhoComSessao)
                || fonteSemAcentos.match(regexNumeroCabecalhoSolto);

            let numeroDoDocumento = null;
            if (matchNumero && matchNumero[1]) {
                const numeroTexto = String(matchNumero[1]).trim();
                const convertido = converterRomanoParaNumero(numeroTexto);
                const numeroLimpo = String(convertido || '').replace(/\D/g, '');
                if (numeroLimpo) numeroDoDocumento = String(parseInt(numeroLimpo, 10));
            }

            // Extrair data (prioriza a data próxima de "REALIZADA EM" / "REALIZADO EM" etc.)
            const regexDataContextual = /\bREALIZAD[AO]\s+(?:EM|NO\s+DIA|NA\s+DATA\s+DE)\s*(\d{1,2})\s*[\.\/\-]\s*(\d{1,2})\s*[\.\/\-]\s*((?:\d[\s\.,]*){4})\b/i;
            const regexDataSimples = /\b(\d{1,2})\s*[\.\/\-]\s*(\d{1,2})\s*[\.\/\-]\s*((?:\d[\s\.,]*){4})\b/i;

            const regexDataAnoIncompletoContextual = /\bREALIZAD[AO]\s+(?:EM|NO\s+DIA|NA\s+DATA\s+DE)\s*(\d{1,2})\s*[\.\/\-]\s*(\d{1,2})\s*[\.\/\-]\s*(\d{1,3})\b/i;
            const regexDataAnoIncompletoSimples = /\b(\d{1,2})\s*[\.\/\-]\s*(\d{1,2})\s*[\.\/\-]\s*(\d{1,3})\b/i;

            const matchData = inicioTextoAta.match(regexDataContextual) || inicioTextoAta.match(regexDataSimples);

            let data = extrairDataCabecalhoAta();

            if (!data && matchData) {
                const dia = parseInt(matchData[1], 10);
                const mes = parseInt(matchData[2], 10);
                const ano = parseInt(String(matchData[3]).replace(/\D/g, '').slice(0, 4), 10);

                if (!Number.isNaN(dia) && !Number.isNaN(mes) && !Number.isNaN(ano)) {
                    data = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${String(ano)}`;
                }
            }

            // Fallback: OCR às vezes retorna o ano truncado (ex.: ".../2").
            // Se isso acontecer, tenta inferir um ano 19xx/20xx presente em outra parte do texto.
            if (!data) {
                const matchAnoIncompleto = fonteSemAcentos.match(regexDataAnoIncompletoContextual) || fonteSemAcentos.match(regexDataAnoIncompletoSimples);
                if (matchAnoIncompleto) {
                    const dia = parseInt(matchAnoIncompleto[1], 10);
                    const mes = parseInt(matchAnoIncompleto[2], 10);
                    const anoProvavel = extrairAnoProvavelDoTexto();
                    const ano = anoProvavel ? parseInt(anoProvavel, 10) : NaN;
                    if (!Number.isNaN(dia) && !Number.isNaN(mes) && !Number.isNaN(ano)) {
                        data = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${String(ano)}`;
                    }
                }
            }

            // Fallback para datas em extenso no texto ou no nome do arquivo.
            if (!data) {
                data = extrairDataPadrao(texto, nomeArquivo);
            }

            if (!data) {
                const anoArquivo = extrairAnoDoNomeArquivo(nomeArquivo);
                if (anoArquivo) {
                    data = `01/01/${anoArquivo}`;
                    console.log(`[ATA] Data inferida pelo ano do arquivo: ${data}`);
                }
            }
            
            // Extrair descrição: tenta capturar a linha/cabeçalho onde aparece "ATA ...".
            let descricao = null;
            const matchLinhaAta = textoCompleto.match(/^\s*ATA[^\n\r]{0,220}/im);
            if (matchLinhaAta && matchLinhaAta[0]) {
                descricao = matchLinhaAta[0].replace(/\s+/g, ' ').trim();
            } else {
                const matchTrechoAta = textoCompleto.match(/\bATA\b[^\.\n\r]{0,220}/i);
                if (matchTrechoAta && matchTrechoAta[0]) {
                    descricao = matchTrechoAta[0].replace(/\s+/g, ' ').trim();
                }
            }

            if (!descricao) {
                const numeroFmt = numeroDoDocumento ? String(numeroDoDocumento).padStart(3, '0') : null;
                const partes = [];
                partes.push(numeroFmt ? `ATA ${numeroFmt}` : 'ATA');
                partes.push('DA SESSAO');
                if (data) partes.push(`REALIZADA EM ${data}`);
                descricao = partes.join(' ');
            }
            
            return {
                numero: numeroDocumento,
                arquivo: nomeArquivo,
                numeroDoDocumento: numeroDoDocumento,
                data: data,
                letra: null,
                descricao: descricao ? descricao.toUpperCase() : null,
                url: `${urlDocumentos}${encodeURIComponent(nomeArquivo)}`,
                tipoDocumento: tipoDocumento
            };
        }
        
        function converterRomanoParaNumero(romano) {
            // Se já for um número, retorna
            if (/^\d+$/.test(romano)) {
                return romano;
            }
            
            const romanos = {
                'I': 1, 'II': 2, 'III': 3, 'IV': 4, 'V': 5,
                'VI': 6, 'VII': 7, 'VIII': 8, 'IX': 9, 'X': 10,
                'XI': 11, 'XII': 12, 'XIII': 13, 'XIV': 14, 'XV': 15,
                'XVI': 16, 'XVII': 17, 'XVIII': 18, 'XIX': 19, 'XX': 20
            };
            
            return romanos[romano.toUpperCase()] || romano;
        }
        
        function converterDataParaExtenso(dia, mes, ano) {
            const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
            const dezenas = ['', 'dez', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
            const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
            
            const mesesExtenso = [
                'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
                'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
            ];
            
            const milhares = ['', 'mil', 'dois mil', 'três mil', 'quatro mil', 'cinco mil'];
            
            // Converter dia para extenso
            let diaExtenso = '';
            if (dia >= 10 && dia <= 19) {
                diaExtenso = especiais[dia - 10];
            } else {
                const dezena = Math.floor(dia / 10);
                const unidade = dia % 10;
                if (dezena > 0 && unidade > 0) {
                    diaExtenso = dezenas[dezena] + ' e ' + unidades[unidade];
                } else if (dezena > 0) {
                    diaExtenso = dezenas[dezena];
                } else {
                    diaExtenso = unidades[unidade];
                }
            }
            
            // Converter ano para extenso
            const milhar = Math.floor(ano / 1000);
            const centena = Math.floor((ano % 1000) / 100);
            const dezenasAno = Math.floor((ano % 100) / 10);
            const unidadeAno = ano % 10;
            
            let anoExtenso = '';
            if (milhar === 2 && centena === 0) {
                anoExtenso = 'dois mil';
                if (dezenasAno >= 1 && dezenasAno <= 1 && unidadeAno >= 0) {
                    if (dezenasAno === 1 && unidadeAno > 0) {
                        anoExtenso += ' e ' + especiais[unidadeAno];
                    } else if (dezenasAno === 1 && unidadeAno === 0) {
                        anoExtenso += ' e dez';
                    } else if (dezenasAno > 1) {
                        anoExtenso += ' e ' + dezenas[dezenasAno];
                        if (unidadeAno > 0) {
                            anoExtenso += ' e ' + unidades[unidadeAno];
                        }
                    }
                } else if (dezenasAno >= 2) {
                    anoExtenso += ' e ' + dezenas[dezenasAno];
                    if (unidadeAno > 0) {
                        anoExtenso += ' e ' + unidades[unidadeAno];
                    }
                } else if (unidadeAno > 0) {
                    anoExtenso += ' e ' + unidades[unidadeAno];
                }
            }
            
            return `Aos ${diaExtenso} dias do mês de ${mesesExtenso[mes - 1]} de ${anoExtenso}`;
        }

