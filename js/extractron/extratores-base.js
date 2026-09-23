// Extractron - extratores de regimento, resolução, diário e PPP

        function extrairNumeroRegimentoEmenda(texto, nomeArquivo) {
            const fonte = `${nomeArquivo || ''} ${texto || ''}`;
            const normalizarAno = (valorAno) => String(valorAno || '').replace(/\D/g, '').slice(0, 4);

            const padroes = [
                /EMENDA(?:\s+[A-ZÇÃÕÁÉÍÓÚÂÊÔÀ]+){0,3}\s+N[º°ª\s\.]*?(\d{1,4})(?:\s*[-\/]\s*((?:\d[\s\.,]*){4}))?/i,
                /REGIMENTO(?:\s+INTERNO)?\s+N[º°ª\s\.]*?(\d{1,4})(?:\s*[-\/]\s*((?:\d[\s\.,]*){4}))?/i,
                /(?:EMENDA|REGIMENTO)[^\n\r\d]{0,40}(\d{1,4})(?:\s*[-\/]\s*((?:\d[\s\.,]*){4}))?/i
            ];

            for (const regex of padroes) {
                const match = fonte.match(regex);
                if (match) {
                    const numero = match[1] ? String(parseInt(match[1], 10)) : null;
                    const ano = normalizarAno(match[2]);
                    if (numero && ano.length === 4) return `${numero}/${ano}`;
                    if (numero) return numero;
                }
            }

            const nomeLimpo = limparDescricaoArquivo(nomeArquivo);
            const matchNome = nomeLimpo.match(/(?:EMENDA|REGIMENTO)[^\d]{0,30}(\d{1,4})(?:\s*[-\/]\s*((?:\d[\s\.,]*){4}))?/i);
            if (matchNome) {
                const numero = matchNome[1] ? String(parseInt(matchNome[1], 10)) : null;
                const ano = normalizarAno(matchNome[2]);
                if (numero && ano.length === 4) return `${numero}/${ano}`;
                if (numero) return numero;
            }

            return null;
        }

        function extrairDescricaoRegimentoEmenda(texto, nomeArquivo) {
            const fonte = normalizarTextoCompleto(texto);
            const candidatos = [
                /(?:EMENTA|DISP[ÕO]E\s+SOBRE)\s*[:\-]?\s*([^\n\.]{20,320})/i,
                /(EMENDA\s+[A-ZÇÃÕÁÉÍÓÚÂÊÔÀ\s\-]{6,220})/i,
                /(REGIMENTO\s+INTERNO[ A-ZÇÃÕÁÉÍÓÚÂÊÔÀ\s\-]{0,220})/i
            ];

            for (const regex of candidatos) {
                const match = fonte.match(regex);
                if (match && match[1]) {
                    return match[1].replace(/\s+/g, ' ').trim().toUpperCase();
                }
            }

            const nomeLimpo = limparDescricaoArquivo(nomeArquivo);
            return nomeLimpo ? nomeLimpo.toUpperCase() : null;
        }

        function extrairInformacoesRegimentoEmenda(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento) {
            const fonteTipo = `${nomeArquivo || ''} ${texto || ''}`;
            let tipoFinal = tipoDocumento;

            if (!tipoFinal) {
                if (/emenda/i.test(fonteTipo)) {
                    tipoFinal = resolverTipoNome('Emenda Parlamentar') || 'Emenda Parlamentar';
                } else {
                    tipoFinal = resolverTipoNome('Regimentos') || 'Regimentos';
                }
            }

            return {
                numero: numeroDocumento,
                arquivo: nomeArquivo,
                numeroDoDocumento: extrairNumeroRegimentoEmenda(texto, nomeArquivo),
                data: extrairDataPadrao(texto, nomeArquivo),
                letra: null,
                descricao: extrairDescricaoRegimentoEmenda(texto, nomeArquivo),
                url: `${urlDocumentos}${encodeURIComponent(nomeArquivo)}`,
                tipoDocumento: tipoFinal
            };
        }

        function normalizarNomeArquivoResolucao(nomeArquivo) {
            return removerPrefixoHashNomeArquivo(nomeArquivo)
                .replace(/\.pdf$/i, '')
                .replace(/%20/gi, ' ')
                .replace(/_20/g, ' ')
                .replace(/_C3_A7/gi, 'c')
                .replace(/_C3_87/gi, 'c')
                .replace(/_C3_A3/gi, 'a')
                .replace(/_C3_83/gi, 'a')
                .replace(/_C2_BA/gi, ' ')
                .replace(/[_.\-]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }

        function normalizarAnoResolucao(valorAno) {
            const digitos = String(valorAno || '').replace(/\D/g, '');
            if (!digitos) return null;
            if (digitos.length === 2) return `20${digitos}`;
            const ano = digitos.slice(0, 4);
            return /^(19|20)\d{2}$/.test(ano) ? ano : null;
        }

        function extrairNumeroAnoResolucao(texto, nomeArquivo) {
            const nomeLimpo = normalizarNomeArquivoResolucao(nomeArquivo);
            const fonte = `${nomeLimpo} ${texto || ''}`;
            const fonteNormal = normalizarSemAcentos(fonte)
                .replace(/\u00a0/g, ' ')
                .replace(/\s+/g, ' ');

            const padroes = [
                /(?:PROJETO\s+DE\s+)?R\s*E\s*S\s*O\s*L\s*U\s*(?:C\s*)?A\s*O\s*(?:\s*(?:N\s*[oº°ª\.]*|NUMERO|[:\-])){0,4}\s*0*(\d{1,4})(?:\s*[.\/\-]\s*((?:\d[\s\.,]*){2,4}))?/i,
                /\bRES(?:OLUCAO|OLUCOES|OLUAO)?\b[^\d]{0,30}0*(\d{1,4})(?:\s*[.\/\-]\s*((?:\d[\s\.,]*){2,4}))?/i,
                /\bPROJ\b[^\d]{0,80}\bRES[^\d]{0,30}0*(\d{1,4})(?:\s*[.\/\-]\s*((?:\d[\s\.,]*){2,4}))?/i,
                /\bN\s*[oº°ª\.]*\s*0*(\d{1,4})(?:\s*[.\/\-]\s*((?:\d[\s\.,]*){2,4}))?/i
            ];

            let numeroSemAno = null;
            for (const regex of padroes) {
                const match = fonteNormal.match(regex);
                if (!match) continue;

                const numero = match[1] ? String(parseInt(match[1], 10)) : null;
                const ano = normalizarAnoResolucao(match[2]);
                if (numero && ano) return { numero, ano };
                if (numero && !numeroSemAno) numeroSemAno = numero;
            }

            const matchNomeCompacto = nomeLimpo.match(/\b0*(\d{1,4})[\s.\/\-]+((?:19|20)?\d{2})\b/)
                || nomeLimpo.match(/\b0*(\d{1,2})((?:19|20)\d{2})\b/);
            if (matchNomeCompacto) {
                return {
                    numero: String(parseInt(matchNomeCompacto[1], 10)),
                    ano: normalizarAnoResolucao(matchNomeCompacto[2])
                };
            }

            return { numero: numeroSemAno, ano: null };
        }

        function extrairDescricaoResolucao(texto, nomeArquivo) {
            const fonte = normalizarTextoCompleto(texto);
            const nomeLimpo = normalizarNomeArquivoResolucao(nomeArquivo);

            const limpar = (valor) => String(valor || '')
                .replace(/\s+/g, ' ')
                .replace(/^[\s:;,\-."']+|[\s:;,\-."']+$/g, '')
                .trim()
                .toUpperCase();

            const cortarMarcadores = (valor) => {
                const normal = normalizarSemAcentos(valor).toUpperCase();
                const marcadores = [' FACO SABER', ' CONSIDERANDO', ' DECRETA', ' RESOLVE', ' ART. 1'];
                let fim = valor.length;
                for (const marcador of marcadores) {
                    const idx = normal.indexOf(marcador);
                    if (idx > 20 && idx < fim) fim = idx;
                }
                return valor.slice(0, fim);
            };

            const aspas = fonte.match(/["\u201c\u201d]\s*([^"\u201c\u201d]{20,360})\s*["\u201c\u201d]/);
            if (aspas && aspas[1]) {
                const descricao = limpar(cortarMarcadores(aspas[1]));
                if (descricao.length >= 8) return descricao;
            }

            const normal = normalizarSemAcentos(fonte).toUpperCase();
            const marcadorIdx = normal.search(/\b(EMENTA|DISPOE\s+SOBRE)\b/);
            if (marcadorIdx >= 0) {
                const trecho = cortarMarcadores(fonte.slice(marcadorIdx, marcadorIdx + 420));
                const descricao = limpar(trecho.replace(/^(EMENTA|DISP\S+\s+SOBRE)\s*[:\-]?\s*/i, ''));
                if (descricao.length >= 8) return descricao;
            }

            return nomeLimpo ? limpar(nomeLimpo) : null;
        }

        function extrairInformacoesResolucao(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento) {
            const numeroAno = extrairNumeroAnoResolucao(texto, nomeArquivo);
            const data = extrairDataPadrao(texto, nomeArquivo)
                || (numeroAno.ano ? `01/01/${numeroAno.ano}` : null);

            return {
                numero: numeroDocumento,
                arquivo: nomeArquivo,
                numeroDoDocumento: numeroAno.numero,
                data: data,
                letra: null,
                descricao: extrairDescricaoResolucao(texto, nomeArquivo),
                url: `${urlDocumentos}${encodeURIComponent(nomeArquivo)}`,
                tipoDocumento: tipoDocumento || resolverTipoNome('Resolucoes') || 'Resolucoes'
            };
        }

        function extrairTipoEdicaoDiario(texto, nomeArquivo) {
            const fonte = `${nomeArquivo || ''} ${texto || ''}`;

            const codeMatch = fonte.match(/tipo\s+de\s+edi[cç][aã]o\s*[:\-]?\s*(0?[123])\b/i);
            if (codeMatch) {
                return String(parseInt(codeMatch[1], 10)).padStart(2, '0');
            }

            if (/\bedi[cç][aã]o\s+suplemento|\bsuplemento\b/i.test(fonte)) return '03';
            if (/\bedi[cç][aã]o\s+extra|\bextra\b/i.test(fonte)) return '02';
            if (/\bedi[cç][aã]o\s+normal|\bnormal\b|\bordin[aá]ri[ao]\b/i.test(fonte)) return '01';

            // Diario sem marcador explicito assume edicao normal por padrao.
            return '01';
        }

        function extrairNumeroEdicaoDiario(texto, nomeArquivo) {
            const fonte = `${nomeArquivo || ''} ${texto || ''}`;
            const padroes = [
                /\bano\s+[ivxlcdm]+\b[^\n\r]{0,260}?\b(?:n\s*[º°o]?|n[º°o])\s*(\d{1,8})\b/i,
                /(?:^|[\s\-])(?:n\s*[º°o]?|n[º°o])\s*(\d{1,8})\s*(?:di[aá]rio\s+oficial|eletr[oô]nico)/i,
                /edi[cç][aã]o\s*(?:n[º°o]\s*)?(\d{1,8})\b/i,
                /\bed\.?\s*(\d{1,8})\b/i,
                /\bdi[aá]rio\s+oficial\b[^\d]{0,40}(\d{1,8})\b/i
            ];

            for (const regex of padroes) {
                const match = fonte.match(regex);
                if (match && match[1]) return match[1];
            }

            const matchArquivo = String(nomeArquivo || '').match(/\bdoem\s*0*(\d{1,8})\b/i);
            if (matchArquivo && matchArquivo[1]) return matchArquivo[1];

            return null;
        }

        function extrairInformacoesDiario(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento) {
            const conteudo = normalizarTextoCompleto(texto);
            const tipoEdicao = extrairTipoEdicaoDiario(conteudo, nomeArquivo);
            const edicao = extrairNumeroEdicaoDiario(conteudo, nomeArquivo);
            const data = extrairDataPadrao(conteudo, nomeArquivo);

            const mapaTipo = {
                '01': 'Normal',
                '02': 'Extra',
                '03': 'Suplemento'
            };

            const descricaoBase = `DIARIO OFICIAL - EDICAO ${edicao || 'N/A'} - TIPO ${tipoEdicao ? `${tipoEdicao} (${mapaTipo[tipoEdicao]})` : 'N/A'}`;

            return {
                numero: numeroDocumento,
                arquivo: nomeArquivo,
                numeroDoDocumento: edicao,
                edicao: edicao,
                tipoEdicao: tipoEdicao,
                tipoEdicaoDescricao: tipoEdicao ? mapaTipo[tipoEdicao] : null,
                data: data,
                letra: null,
                descricao: descricaoBase,
                conteudo: conteudo || null,
                url: `${urlDocumentos}${encodeURIComponent(nomeArquivo)}`,
                tipoDocumento: tipoDocumento
            };
        }

        function extrairAnoPPP(texto, nomeArquivo) {
            const anoAtual = new Date().getFullYear();
            const primeiraPagina = normalizarTextoCompleto(String(texto || '').slice(0, 3500));
            const fonteCompleta = normalizarTextoCompleto(`${nomeArquivo || ''} ${texto || ''}`);

            const escolherAno = (trecho) => {
                const anos = Array.from(String(trecho || '').matchAll(/\b(19|20)\d{2}\b/g))
                    .map((m) => parseInt(m[0], 10))
                    .filter((ano) => ano >= 2000 && ano <= (anoAtual + 2));

                if (!anos.length) return null;
                if (anos.includes(anoAtual)) return String(anoAtual);
                return String(Math.max(...anos));
            };

            const padroesContextuais = [
                /projeto\s+pol[ií]tico\s+pedag[óo]gico[^\d]{0,120}((?:19|20)\d{2})/i,
                /\b(?:ano\s+letivo|vig[eê]ncia|exerc[ií]cio|refer[eê]ncia)\s*[:\-]?\s*((?:19|20)\d{2})\b/i
            ];

            // Prioriza a primeira página do PDF, que é onde normalmente fica o ano do PPP.
            for (const regex of padroesContextuais) {
                const matchPrimeira = primeiraPagina.match(regex);
                if (matchPrimeira && matchPrimeira[1]) return matchPrimeira[1];
            }

            const anoPrimeiraPagina = escolherAno(primeiraPagina);
            if (anoPrimeiraPagina) return anoPrimeiraPagina;

            for (const regex of padroesContextuais) {
                const matchCompleto = fonteCompleta.match(regex);
                if (matchCompleto && matchCompleto[1]) return matchCompleto[1];
            }

            const anoCompleto = escolherAno(fonteCompleta);
            return anoCompleto || String(anoAtual);
        }

        function limparDescricaoPPP(descricao) {
            let valor = String(descricao || '')
                .replace(/\s+/g, ' ')
                .replace(/^[\-–—:;,.\s]+/, '')
                .replace(/[\-–—:;,.\s]+$/, '')
                .replace(/\s+[Ee]\s*$/, '')
                .replace(/\b(?:ano\s+letivo|vig[eê]ncia|vers[aã]o|revis[aã]o)\b.*$/i, '')
                .trim();

            // Corta informacoes de cabecalho/rodape que costumam vir apos o nome da escola.
            const indiceCorte = valor.search(/\b(?:PROJETO\s+POL[IÍ]TICO\s+PEDAG[ÓO]GICO|\bPPP\b|ARAGUA[IÍ]NA|ENDERE[CÇ]O|RUA|AVENIDA|AV\.?\b|BAIRRO|CEP|TELEFONE|FONE|TEL\.?\b|E\s*-?\s*MAIL|EMAIL|HOTMAIL|GMAIL|OUTLOOK|GESTOR(?:A)?|DIRETOR(?:A)?|SECRETARIA|MUNIC[IÍ]PIO|SEMED)\b|\b\d{2}\s*\d{4,5}\s*[-\.]?\s*\d{4}\b/i);
            if (indiceCorte > 0) {
                valor = valor.substring(0, indiceCorte).trim();
            }

            // Remove caudas comuns de contato/OCR apos o nome.
            valor = valor
                .replace(/\b\d{2}\s*\d{4,5}\s*[-\.]?\s*\d{4}.*$/i, '')
                .replace(/\b(?:TEL\.?|TELEFONE|FONE|E\s*-?\s*MAIL|EMAIL|HOTMAIL|GMAIL|OUTLOOK)\b.*$/i, '')
                .replace(/\bESC\s*-\s*.*$/i, '')
                .trim();

            // Remove repeticao exata de nome causada por OCR (ex.: "ESCOLA X ESCOLA X").
            valor = valor.replace(/\b(ESCOLA(?:\s+MUNICIPAL|\s+PAROQUIAL|\s+DE\s+TEMPO\s+INTEGRAL)?\s+[A-ZÀ-Ú0-9'\-\s]{8,120}?)\s+\1\b/i, '$1');

            return valor
                .replace(/\s+/g, ' ')
                .replace(/[\-–—:;,.\s]+$/, '')
                .trim();
        }

        function extrairPrimeiraPaginaAproximada(texto, limite = 5000) {
            return normalizarTextoCompleto(String(texto || '').slice(0, limite));
        }

        function extrairNomeEscolaPPP(texto, nomeArquivo) {
            const primeiraPagina = extrairPrimeiraPaginaAproximada(texto);
            const primeiraPaginaUpper = primeiraPagina.toUpperCase()
                .replace(/[^A-ZÀ-Ú0-9\s'\-]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            const delimitador = '(?=\\s+(?:PROJETO\\s+POL[IÍ]TICO\\s+PEDAG[ÓO]GICO|PPP|ARAGUA[IÍ]NA|ENDERE[CÇ]O|RUA|AVENIDA|AV\\.?|BAIRRO|CEP|TELEFONE|FONE|TEL\\.?|EMAIL|E\\s*-?\\s*MAIL|HOTMAIL|GMAIL|OUTLOOK|GESTOR(?:A)?|DIRETOR(?:A)?|SECRETARIA|MUNIC[IÍ]PIO|SEMED)\\b|\\s+\\d{2}\\s*\\d{4,5}\\s*[-\\.]?\\s*\\d{4}\\b|$)';

            const padroesPrimeiraPagina = [
                new RegExp(`\\b(ESCOLA\\s+MUNICIPAL(?:\\s+DE\\s+TEMPO\\s+INTEGRAL)?\\s+[A-ZÀ-Ú0-9'\\-\\s]{6,140}?)${delimitador}`),
                new RegExp(`\\b(ESCOLA\\s+PAROQUIAL\\s+[A-ZÀ-Ú0-9'\\-\\s]{6,140}?)${delimitador}`),
                new RegExp(`\\b(CMEI\\s+[A-ZÀ-Ú0-9'\\-\\s]{6,120}?)${delimitador}`),
                new RegExp(`\\b(EMEI\\s+[A-ZÀ-Ú0-9'\\-\\s]{6,120}?)${delimitador}`),
                new RegExp(`\\b(EMEF\\s+[A-ZÀ-Ú0-9'\\-\\s]{6,120}?)${delimitador}`),
                new RegExp(`\\b(COL[EÉ]GIO\\s+[A-ZÀ-Ú0-9'\\-\\s]{6,140}?)${delimitador}`),
                new RegExp(`\\b(INSTITUTO\\s+[A-ZÀ-Ú0-9'\\-\\s]{6,140}?)${delimitador}`),
                new RegExp(`\\b(ESCOLA\\s+[A-ZÀ-Ú0-9'\\-\\s]{6,140}?)${delimitador}`)
            ];

            for (const regex of padroesPrimeiraPagina) {
                const match = primeiraPaginaUpper.match(regex);
                if (match && match[1]) {
                    const escola = limparDescricaoPPP(match[1]);
                    if (escola.length >= 8) {
                        return escola;
                    }
                }
            }

            const contextoPPP = primeiraPaginaUpper.match(/PROJETO\s+POL[IÍ]TICO\s+PEDAG[ÓO]GICO\s+(?:DA|DO|DE)\s+([^\.\n;:]{8,140})/);
            if (contextoPPP && contextoPPP[1]) {
                const escola = limparDescricaoPPP(contextoPPP[1]);
                if (escola.length >= 8) {
                    return escola;
                }
            }

            const nomeBase = String(nomeArquivo || '')
                .replace(/\.pdf$/i, '')
                .replace(/[_\-]+/g, ' ')
                .replace(/\bppp\b/ig, '')
                .replace(/\b(?:19|20)\d{2}\b/g, '')
                .replace(/\s+/g, ' ')
                .trim();

            return nomeBase ? nomeBase.toUpperCase() : null;
        }

        function extrairInformacoesPPP(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento) {
            const anoOuData = extrairAnoPPP(texto, nomeArquivo);
            const anoAtual = String(new Date().getFullYear());
            const hoje = new Date();
            const dataHoje = `${String(hoje.getDate()).padStart(2, '0')}/${String(hoje.getMonth() + 1).padStart(2, '0')}/${hoje.getFullYear()}`;
            const data = /^\d{4}$/.test(String(anoOuData)) && String(anoOuData) === anoAtual
                ? dataHoje
                : anoOuData;
            const descricao = extrairNomeEscolaPPP(texto, nomeArquivo);
            const url = `${urlDocumentos}${encodeURIComponent(nomeArquivo)}`;

            return {
                numero: numeroDocumento,
                arquivo: nomeArquivo,
                data: data,
                descricao: descricao || null,
                url: url,
                tipoDocumento: tipoDocumento || 'Projeto Politico Pedagogico'
            };
        }

