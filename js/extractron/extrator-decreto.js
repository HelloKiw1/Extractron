// Extractron - extrator de decreto

        function extrairInformacoesDecreto (texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento) {
            const textoCompleto = normalizarTextoCompleto(texto);
            const nomeArquivoSemHash = removerPrefixoHashNomeArquivo(nomeArquivo);
            const fonteInicial = normalizarTextoCompleto(`${nomeArquivoSemHash || ''} ${textoCompleto.substring(0, 5000)}`);

            const normalizarAno = (valor) => String(valor || '').replace(/\D/g, '').slice(0, 4);
            const decretoRegex = 'D\\s*E\\s*C\\s*R\\s*E\\s*T\\s*[O0]';

            const numeroDoNome = (() => {
                const match = nomeArquivoSemHash.match(/(?:^|[^A-Za-z])DECRETO[\s._-]*0*(\d{1,6})(?=$|[^0-9])/i);
                return match ? String(parseInt(match[1], 10)) : null;
            })();

            const numeroDoTexto = (() => {
                const padroes = [
                    new RegExp(`\\b${decretoRegex}\\b\\s*(?:N\\s*[.º°ªO0]*\\s*)?0*(\\d{1,6})(?:\\s*[\\/.-]\\s*((?:19|20)\\d{2}))?`, 'i'),
                    new RegExp(`\\b${decretoRegex}\\b[\\s\\S]{0,80}?\\bN\\s*[.º°ªO0]*\\s*0*(\\d{1,6})(?:\\s*[\\/.-]\\s*((?:19|20)\\d{2}))?`, 'i')
                ];

                for (const regex of padroes) {
                    const match = fonteInicial.match(regex);
                    if (!match) continue;
                    const numero = match[1] ? String(parseInt(match[1], 10)) : null;
                    if (numero && !/^(19|20)\d{2}$/.test(numero)) return numero;
                }

                return null;
            })();

            let numeroDoDocumento = numeroDoNome || numeroDoTexto;

            const obterMes = (valor) => {
                const chave = normalizarSemAcentos(valor)
                    .toLowerCase()
                    .replace(/0/g, 'o')
                    .replace(/[^a-z]/g, '');

                if (chave.startsWith('jan')) return '01';
                if (chave.startsWith('fev')) return '02';
                if (chave.startsWith('mar')) return '03';
                if (chave.startsWith('abr')) return '04';
                if (chave.startsWith('mai')) return '05';
                if (chave.startsWith('jun')) return '06';
                if (chave.startsWith('jul')) return '07';
                if (chave.startsWith('ago')) return '08';
                if (chave.startsWith('set')) return '09';
                if (chave.startsWith('out')) return '10';
                if (chave.startsWith('nov')) return '11';
                if (chave.startsWith('dez')) return '12';
                return null;
            };

            const montarData = (dia, mes, ano) => {
                const d = Number(String(dia || '').replace(/\D/g, ''));
                const m = Number(String(mes || '').replace(/\D/g, ''));
                const a = Number(normalizarAno(ano));
                if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(a)) return null;
                if (a < 1900 || a > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
                const data = new Date(Date.UTC(a, m - 1, d));
                if (data.getUTCFullYear() !== a || data.getUTCMonth() + 1 !== m || data.getUTCDate() !== d) return null;
                return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${String(a)}`;
            };

            const montarDataExtenso = (dia, mesTexto, ano) => {
                const mes = obterMes(mesTexto);
                return mes ? montarData(dia, mes, ano) : null;
            };

            const buscarDataEmFonte = (fonte, preferirUltima = false) => {
                const candidatos = [];
                const adicionar = (index, data) => {
                    if (data) candidatos.push({ index: index || 0, data });
                };

                for (const match of String(fonte || '').matchAll(/\b(\d{1,2})\s*(?:[º°ªoO.]|\([^)]+\))?\s*(?:DE|D[EI])\s+([A-Za-zÀ-ÿ0]+)\s+(?:DE|D[EI])\s*((?:\d[\s.,]*){4})\b/gi)) {
                    adicionar(match.index, montarDataExtenso(match[1], match[2], match[3]));
                }

                for (const match of String(fonte || '').matchAll(/\bAOS?\s+(\d{1,2})\s*(?:[º°ªoO.]|\([^)]+\))?(?:\s+DIAS?)?\s+(?:DE|DO)\s+(?:MES\s+DE\s+)?([A-Za-zÀ-ÿ0]+)\s+(?:DE|DO\s+ANO\s+DE)\s*((?:\d[\s.,]*){4})\b/gi)) {
                    adicionar(match.index, montarDataExtenso(match[1], match[2], match[3]));
                }

                for (const match of String(fonte || '').matchAll(/\b(\d{1,2})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*((?:\d[\s.,]*){4})\b/g)) {
                    adicionar(match.index, montarData(match[1], match[2], match[3]));
                }

                for (const match of String(fonte || '').matchAll(/\b((?:19|20)\d{2})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{1,2})\b/g)) {
                    adicionar(match.index, montarData(match[3], match[2], match[1]));
                }

                if (!candidatos.length) return null;
                candidatos.sort((a, b) => a.index - b.index);
                return preferirUltima ? candidatos[candidatos.length - 1].data : candidatos[0].data;
            };

            const trechoCabecalhoDecreto = fonteInicial.match(new RegExp(`\\b${decretoRegex}\\b[\\s\\S]{0,260}`, 'i'))?.[0] || '';
            const trechoGabinete = textoCompleto.match(/\bGABINETE\b[\s\S]{0,360}/i)?.[0] || '';
            let data = buscarDataEmFonte(trechoCabecalhoDecreto)
                || buscarDataEmFonte(trechoGabinete, true)
                || buscarDataEmFonte(fonteInicial)
                || extrairDataPadrao(textoCompleto, nomeArquivoSemHash);

            const limparDescricao = (valor) => {
                let descricao = String(valor || '')
                    .replace(/\s+/g, ' ')
                    .replace(/^[\s"'“”.,;:\-]+|[\s"'“”.,;:\-]+$/g, '')
                    .trim();

                const normal = normalizarSemAcentos(descricao).toUpperCase();
                const marcadores = [
                    ' O PREFEITO',
                    ' PREFEITO ',
                    ' CONSIDERANDO',
                    ' D E C R E T A',
                    ' DECRETA:',
                    ' ART. 1',
                    ' ART 1',
                    ' GABINETE',
                    ' AVENIDA'
                ];

                let fim = descricao.length;
                for (const marcador of marcadores) {
                    const idx = normal.indexOf(marcador);
                    if (idx > 12 && idx < fim) fim = idx;
                }

                descricao = descricao.slice(0, fim)
                    .replace(/\s+/g, ' ')
                    .replace(/^[\s"'“”.,;:\-]+|[\s"'“”.,;:\-]+$/g, '')
                    .trim();

                if (descricao && !/[.!?]$/.test(descricao)) descricao += '.';
                return descricao;
            };

            const extrairDescricao = () => {
                const aposCabecalho = fonteInicial.match(new RegExp(`\\b${decretoRegex}\\b[\\s\\S]{0,220}?(?:19|20)\\d{2}\\.?\\s*([\\s\\S]{10,360}?)(?=(?:\\b[O0]\\s+PREF|\\bPREFEIT|CONSIDERANDO|D\\s*E\\s*C\\s*R\\s*E\\s*T\\s*A|\\bART\\.?\\s*1|$))`, 'i'));
                if (aposCabecalho && aposCabecalho[1]) {
                    const descricao = limparDescricao(aposCabecalho[1]);
                    if (descricao.length >= 8) return descricao;
                }

                const aspas = textoCompleto.match(/["“”]\s*([^"“”]{10,360})\s*["“”]/);
                if (aspas && aspas[1]) {
                    const descricao = limparDescricao(aspas[1]);
                    if (descricao.length >= 8) return descricao;
                }

                const palavraChave = textoCompleto.match(/\b(?:DISP[ÕO]E\s+SOBRE|DISPOE\s+SOBRE|DECRETA|NOMEIA|EXONERA|CONCEDE|PRORROGA|DETERMINA|ESTABELECE|REVOGA|INSTITUI|REGULAMENTA|AUTORIZA|DECLARA|DESIGNA|FIXA|CRIA|EXTINGUE|TORNA|DISPENSA|EMENTA)\b[\s\S]{0,420}/i);
                if (palavraChave && palavraChave[0]) {
                    const descricao = limparDescricao(palavraChave[0]);
                    if (descricao.length >= 8) return descricao;
                }

                const nomeLimpo = limparDescricaoArquivo(nomeArquivoSemHash);
                return nomeLimpo || null;
            };

            const descricao = extrairDescricao();

            return {
                numero: numeroDocumento,
                arquivo: nomeArquivo,
                numeroDoDocumento: numeroDoDocumento || null,
                data: data || null,
                letra: null,
                descricao: descricao ? descricao.toUpperCase().substring(0, 300) : null,
                url: `${urlDocumentos}${encodeURIComponent(nomeArquivo)}`,
                tipoDocumento: tipoDocumento
            };
        }

