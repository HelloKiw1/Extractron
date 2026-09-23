// Extractron - normalização, datas, nomes e detecção de tipos

        function isTipoDiario(tipoDocumento) {
            const nome = String(tipoDocumento || '').toLowerCase();
            return /di[aá]rio\s+oficial/.test(nome);
        }

        function normalizarSemAcentos(valor) {
            return String(valor || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '');
        }

        function isTipoOficio(tipoDocumento) {
            const nome = normalizarSemAcentos(tipoDocumento).toLowerCase();
            return /\boficio\b/.test(nome);
        }

        function isTipoProjetoPoliticoPedagogico(tipoDocumento) {
            const nome = normalizarSemAcentos(tipoDocumento).toLowerCase();
            return /projeto\s+politico\s+pedagogico|\bppp\b/.test(nome);
        }

        function isTipoResolucao(tipoDocumento) {
            const nome = normalizarSemAcentos(tipoDocumento).toLowerCase();
            return /\bresoluc(?:ao|oes)\b|\bprojeto\s+de\s+resoluc(?:ao|oes)\b/.test(nome);
        }

        function isTipoPortaria(tipoDocumento) {
            const nome = normalizarSemAcentos(tipoDocumento).toLowerCase();
            return /\bportarias?\b/.test(nome);
        }

        function isTipoDecreto(tipoDocumento) {
            const nome = normalizarSemAcentos(tipoDocumento).toLowerCase();
            return /\bdecretos?\b/.test(nome);
        }

        function isTipoDeclaracao(tipoDocumento) {
            const nome = normalizarBusca(tipoDocumento);
            return /\bdeclaracoes?\b|\bdeclaracao\b/.test(nome);
        }

        function isTipoJulgamentoContas(tipoDocumento) {
            const nome = normalizarSemAcentos(tipoDocumento).toLowerCase().replace(/[_\-]+/g, ' ');
            const compacto = nome.replace(/[^a-z0-9]+/g, '');
            return /\bjulgamento\b.*\bcontas?\b|\bcontas?\b.*\bjulgamento\b/.test(nome)
                || /julgamento(?:de)?contas?/.test(compacto);
        }

        function isContextoJulgamentoContas(...valores) {
            const texto = normalizarSemAcentos(valores.filter(Boolean).join(' ')).toLowerCase().replace(/[_\-]+/g, ' ');
            const compacto = texto.replace(/[^a-z0-9]+/g, '');
            return /\bjulgamento\b.*\bcontas?\b|\bcontas?\b.*\bjulgamento\b/.test(texto)
                || /julgamento(?:de)?contas?/.test(compacto);
        }

        function normalizarTextoCompleto(texto) {
            return String(texto || '')
                .replace(/\u00a0/g, ' ')
                .replace(/[ \t]+/g, ' ')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
        }

        function extrairDataPadrao(texto, nomeArquivo) {
            const fonte = `${nomeArquivo || ''} ${texto || ''}`;
            const meses = {
                'janeiro': '01', 'fevereiro': '02', 'marco': '03', 'março': '03', 'abril': '04',
                'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08',
                'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
            };

            const normalizarAno = (valorAno) => String(valorAno || '').replace(/\D/g, '').slice(0, 4);

            const matchDiaMesExtenso = fonte.match(/\b(\d{1,2})\s+dias?\s+do\s+m[e\u00ea]s\s+de\s+([A-Za-z\u00C0-\u00FF]+)\s+de\s+((?:\d[\s\.,]*){4})\b/i);
            if (matchDiaMesExtenso) {
                const dia = String(parseInt(matchDiaMesExtenso[1], 10)).padStart(2, '0');
                const mesNome = normalizarSemAcentos(matchDiaMesExtenso[2]).toLowerCase().replace(/\s+/g, '');
                const mes = meses[mesNome] || meses[matchDiaMesExtenso[2].toLowerCase()];
                const ano = normalizarAno(matchDiaMesExtenso[3]);
                if (mes && ano.length === 4) return `${dia}/${mes}/${ano}`;
            }

            // Ex.: "Plenária das Sessões ... Amazonas, 11 de fevereiro de 2025."
            const matchExtensoComLocal = fonte.match(/(?:[A-Za-zÀ-ÿ\s\-]+,\s*)?(\d{1,2})\s+de\s+([A-Za-zçÇãÃõÕáÁéÉíÍóÓúÚâÂêÊôÔàÀ]+)\s+de\s+((?:\d[\s\.,]*){4})/i);
            if (matchExtensoComLocal) {
                const dia = String(parseInt(matchExtensoComLocal[1], 10)).padStart(2, '0');
                const mesNome = matchExtensoComLocal[2].toLowerCase().replace(/\s+/g, '');
                const mes = meses[mesNome];
                const ano = normalizarAno(matchExtensoComLocal[3]);
                if (mes && ano.length === 4) return `${dia}/${mes}/${ano}`;
            }

            const matchExtenso = fonte.match(/(\d{1,2})\s+de\s+([A-Za-zçÇãÃõÕáÁéÉíÍóÓúÚâÂêÊôÔàÀ]+)\s+de\s+(\d{4})/i);
            if (matchExtenso) {
                const dia = String(parseInt(matchExtenso[1], 10)).padStart(2, '0');
                const mesNome = matchExtenso[2].toLowerCase().replace(/\s+/g, '');
                const mes = meses[mesNome];
                const ano = matchExtenso[3];
                if (mes) return `${dia}/${mes}/${ano}`;
            }

            // Ex.: "13 de fevereiro - 2025" ou "13 de fevereiro 2025"
            const matchExtensoComSeparador = fonte.match(/(\d{1,2})\s+de\s+([A-Za-zçÇãÃõÕáÁéÉíÍóÓúÚâÂêÊôÔàÀ]+)\s*(?:de|[-–—]|\s)\s*((?:\d[\s\.,]*){4})/i);
            if (matchExtensoComSeparador) {
                const dia = String(parseInt(matchExtensoComSeparador[1], 10)).padStart(2, '0');
                const mesNome = matchExtensoComSeparador[2].toLowerCase().replace(/\s+/g, '');
                const mes = meses[mesNome];
                const ano = normalizarAno(matchExtensoComSeparador[3]);
                if (mes && ano.length === 4) return `${dia}/${mes}/${ano}`;
            }

            const matchNumerico = fonte.match(/\b(\d{1,2})[\.\/-](\d{1,2})[\.\/-]((?:\d[\s\.,]*){4})\b/);
            if (matchNumerico) {
                const dia = String(parseInt(matchNumerico[1], 10)).padStart(2, '0');
                const mes = String(parseInt(matchNumerico[2], 10)).padStart(2, '0');
                const ano = normalizarAno(matchNumerico[3]);
                if (ano.length === 4) return `${dia}/${mes}/${ano}`;
            }

            const matchExtensoSemDe = fonte.match(/\b(\d{1,2})\s+([A-Za-zçÇãÃõÕáÁéÉíÍóÓúÚâÂêÊôÔàÀ]+)\s+((?:\d[\s\.,]*){4})\b/i);
            if (matchExtensoSemDe) {
                const dia = String(parseInt(matchExtensoSemDe[1], 10)).padStart(2, '0');
                const mesNome = matchExtensoSemDe[2].toLowerCase().replace(/\s+/g, '');
                const mes = meses[mesNome];
                const ano = normalizarAno(matchExtensoSemDe[3]);
                if (mes && ano.length === 4) return `${dia}/${mes}/${ano}`;
            }

            return null;
        }

        function isTipoRegimentoOuEmenda(tipoDocumento) {
            const nome = normalizarSemAcentos(tipoDocumento).toLowerCase();
            return /regimento|emenda/.test(nome);
        }

        function isTipoProjetoDeLei(tipoDocumento) {
            const nome = normalizarSemAcentos(tipoDocumento).toLowerCase();
            return /projeto\s*de\s*lei|\bproj\b|\bp\s*\.?\s*l\s*\.?\b/.test(nome);
        }

        function limparDescricaoArquivo(nomeArquivo) {
            return String(nomeArquivo || '')
                .replace(/\.pdf$/i, '')
                .replace(/^[a-f0-9]{32}[_\-]/i, '')
                .replace(/^\d{4}_[^_]+_/, '')
                .replace(/[_\-]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }

        function removerPrefixoHashNomeArquivo(nomeArquivo) {
            return String(nomeArquivo || '')
                .replace(/^[a-f0-9]{32}[_\-]/i, '')
                .trim();
        }

        function extrairAnoDoNomeArquivo(nomeArquivo) {
            const nome = String(nomeArquivo || '');
            const candidatos = [
                nome.match(/(?:^|[^A-Za-z0-9])(?:leis?|lei|atas?|decretos?|portarias?)(\d{4})(?=$|[^A-Za-z0-9])/i),
                nome.match(/(?:^|[^A-Za-z0-9])((?:20|19)\d{2})(?=$|[^A-Za-z0-9])/)
            ].filter(Boolean);

            if (!candidatos.length) return null;

            const valor = candidatos[0][1] || candidatos[0][0];
            const ano = String(valor || '').replace(/\D/g, '').slice(0, 4);
            return ano.length === 4 ? ano : null;
        }

        function escaparRegex(valor) {
            return String(valor || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        }

        function extrairDataLeiContextual(texto, nomeArquivo, numeroLei) {
            const numero = String(numeroLei || '').replace(/\D/g, '');
            if (!numero) return null;

            const fonte = normalizarTextoCompleto(`${nomeArquivo || ''} ${texto || ''}`);
            const numeroRegex = escaparRegex(numero).split('').join('\\s*');
            const padroes = [
                new RegExp(`LEI\\s+N[º°ª\\s\\.]*${numeroRegex}\\s*[,\\-]?\\s*(?:DE\\s+)?[^\\n\\.]{0,140}`, 'i'),
                new RegExp(`L\\s*E\\s*I\\s+N[º°ª\\s\\.]*${numeroRegex}\\s*[,\\-]?\\s*(?:DE\\s+)?[^\\n\\.]{0,140}`, 'i'),
                new RegExp(`N[º°ª\\s\\.]*${numeroRegex}\\s*[,\\-]?\\s*(?:DE\\s+)?[^\\n\\.]{0,140}`, 'i')
            ];

            for (const regex of padroes) {
                const match = fonte.match(regex);
                if (!match) continue;

                const data = extrairDataPadrao(match[0], '');
                if (data) return data;
            }

            return null;
        }

        function extrairDatasPadraoOrdenadas(texto) {
            const fonte = String(texto || '');
            const meses = {
                'janeiro': '01', 'fevereiro': '02', 'marco': '03', 'marÃ§o': '03', 'março': '03',
                'abril': '04', 'maio': '05', 'junho': '06', 'julho': '07', 'agosto': '08',
                'setembro': '09', 'outubro': '10', 'novembro': '11', 'dezembro': '12'
            };
            const datas = [];
            const normalizarAno = (valorAno) => String(valorAno || '').replace(/\D/g, '').slice(0, 4);

            const adicionar = (index, dia, mes, ano) => {
                const d = Number(dia);
                const m = Number(mes);
                const a = Number(ano);
                if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && a >= 1900 && a <= 2100) {
                    datas.push({
                        index,
                        data: `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${String(a).padStart(4, '0')}`,
                        ano: String(a).padStart(4, '0')
                    });
                }
            };

            for (const match of fonte.matchAll(/\b(\d{1,2})[\/\.-](\d{1,2})[\/\.-]((?:\d[\s\.,]*){4})\b/g)) {
                adicionar(match.index || 0, match[1], match[2], normalizarAno(match[3]));
            }

            for (const match of fonte.matchAll(/\b(\d{1,2})\s+dias?\s+do\s+m[e\u00ea]s\s+de\s+([A-Za-z\u00C0-\u00FF]+)\s+de\s+((?:\d[\s\.,]*){4})\b/gi)) {
                const mesNome = normalizarSemAcentos(match[2]).toLowerCase().replace(/\s+/g, '');
                const mes = meses[mesNome] || meses[match[2].toLowerCase()];
                if (mes) adicionar(match.index || 0, match[1], mes, normalizarAno(match[3]));
            }

            for (const match of fonte.matchAll(/\b(\d{1,2})\s+(?:de\s+)?([A-Za-z\u00C0-\u00FF]+)\s+(?:de\s+)?((?:\d[\s\.,]*){4})\b/gi)) {
                const mesNome = normalizarSemAcentos(match[2]).toLowerCase().replace(/\s+/g, '');
                const mes = meses[mesNome] || meses[match[2].toLowerCase()];
                if (mes) adicionar(match.index || 0, match[1], mes, normalizarAno(match[3]));
            }

            return datas.sort((a, b) => a.index - b.index);
        }

        function obterDataCompetenciaArquivo(nomeArquivo) {
            const nome = normalizarSemAcentos(nomeArquivo).toLowerCase();
            const nomePalavras = nome.replace(/[^a-z0-9]+/g, ' ');
            const meses = {
                janeiro: '01', fevereiro: '02', marco: '03', abril: '04',
                maio: '05', junho: '06', julho: '07', agosto: '08',
                setembro: '09', outubro: '10', novembro: '11', dezembro: '12',
                jan: '01', fev: '02', mar: '03', abr: '04', mai: '05',
                jun: '06', jul: '07', ago: '08', set: '09', out: '10',
                nov: '11', dez: '12'
            };
            const ultimoDiaMes = (ano, mes) => {
                const ultimoDia = new Date(Number(ano), Number(mes), 0).getDate();
                return `${String(ultimoDia).padStart(2, '0')}/${mes}/${ano}`;
            };

            const dataValida = (dia, mes, ano) => {
                const d = Number(dia);
                const m = Number(mes);
                const a = Number(ano);
                if (!Number.isInteger(d) || !Number.isInteger(m) || !Number.isInteger(a)) return false;
                if (a < 1900 || a > 2100) return false;
                if (m < 1 || m > 12) return false;
                if (d < 1 || d > 31) return false;
                const data = new Date(Date.UTC(a, m - 1, d));
                return data.getUTCFullYear() === a && (data.getUTCMonth() + 1) === m && data.getUTCDate() === d;
            };

            // Se o nome do arquivo contiver uma data de 8 dígitos (ex.: 02092025 ou 20250902), usar como fallback.
            // Evita falsos positivos como "CCF02092025" virando competência 02/2092.
            const token8 = nome.match(/(?:^|[^0-9])(\d{8})(?=[^0-9]|$)/);
            if (token8) {
                const digits = token8[1];
                const ymd = digits.match(/^((?:19|20)\d{2})(0[1-9]|1[0-2])([0-3]\d)$/);
                if (ymd && dataValida(ymd[3], ymd[2], ymd[1])) {
                    return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
                }

                const dmy = digits.match(/^([0-3]\d)(0[1-9]|1[0-2])((?:19|20)\d{2})$/);
                if (dmy && dataValida(dmy[1], dmy[2], dmy[3])) {
                    return `${dmy[1]}/${dmy[2]}/${dmy[3]}`;
                }
            }

            const semestre = nome.match(/((?:19|20)\d{2})[_\-\s]+0?([12])\s*semestre\b/i)
                || nome.match(/((?:19|20)\d{2}).{0,12}\b([12])(?:o|º)?\s*semestre\b/i);
            if (semestre) {
                const ano = semestre[1];
                const numeroSemestre = semestre[2];
                return numeroSemestre === '1' ? `30/06/${ano}` : `31/12/${ano}`;
            }

            const matchAnoMesCompacto = nome.match(/(?:^|[^0-9])((?:19|20)\d{2})(0[1-9]|1[0-2])(?=[^0-9]|$)/);
            if (matchAnoMesCompacto) {
                const ano = matchAnoMesCompacto[1];
                const mes = matchAnoMesCompacto[2];
                return ultimoDiaMes(ano, mes);
            }

            const matchAnoMesSeparado = nome.match(/(?:^|[^0-9])((?:19|20)\d{2})[_\-\s]+(0?[1-9]|1[0-2])(?=[^0-9]|$)/);
            if (matchAnoMesSeparado) {
                const ano = matchAnoMesSeparado[1];
                const mes = String(parseInt(matchAnoMesSeparado[2], 10)).padStart(2, '0');
                return ultimoDiaMes(ano, mes);
            }

            const match = nome.match(/(?:^|[^0-9])((?:19|20)\d{2})[_\-\s]+(\d{1,2})?\s*([a-z]+)?/i);
            if (match) {
                const ano = match[1];
                let mes = match[2] ? String(parseInt(match[2], 10)).padStart(2, '0') : null;
                const mesNome = String(match[3] || '').replace(/[^a-z]/g, '');

                if (!mes && mesNome) {
                    mes = meses[mesNome] || null;
                }

                if (mes && Number(mes) >= 1 && Number(mes) <= 12) {
                    return ultimoDiaMes(ano, mes);
                }
            }

            const anoSolto = nomePalavras.match(/\b((?:19|20)\d{2})\b/);
            const mesSolto = nomePalavras.match(/\b(janeiro|jan|fevereiro|fev|marco|mar|abril|abr|maio|mai|junho|jun|julho|jul|agosto|ago|setembro|set|outubro|out|novembro|nov|dezembro|dez)\b/);

            if (anoSolto && mesSolto) {
                const ano = anoSolto[1];
                const mes = meses[mesSolto[1]];
                if (mes) return ultimoDiaMes(ano, mes);
            }

            return null;
        }

        function tipoDocumentoSemNumero(tipoDocumento) {
            const nome = normalizarBusca(tipoDocumento);
            return /\b(declaracoes?|declaracao|despesas|receitas|diarias|estornos|empenhos|liquidacoes|balancetes|relatorio|rgf|ldo|ppa|plano\s+plurianual|procedimentos?\s+licitatorios?|homologacao|ata\s+de\s+registro\s+de\s+precos?)\b/.test(nome);
        }

        function detectarTipoDespesaPeloNome(nomeArquivo) {
            const nome = normalizarBusca(nomeArquivo).replace(/[^a-z0-9]+/g, ' ');

            if (/informacao\s+financeiras?|balanco\s*anual|balancoanual|balancetes?\s*mensais|balancetesmensais|relatorio\s*de\s*gestao\s*fiscal|relatoriodegestaofiscal|\brgf\b|lei\s*de\s*diretrizes\s*orcamentarias|leidediretrizesorcamentarias|\bldo\b|plano\s*plurianual|planoplurianual|\bppa\b/.test(nome)) return 'Balancetes';
            if (/\bpor\s+credores?\b|\bcredores?\b|pagamentos?\s+efetuados?|\bordens?\s+de\s+pagamento\b|listagem\s+(?:das?\s+)?ordens?\s+de\s+pagamento/.test(nome)) return 'Despesas';
            if (/\bpag(?:amento)?\b|\bpags?\b|\bsal[aá]rios?\b|\bfolha\s+de\s+pagamento\b|\bpens[aã]o\b|\bconsignad[oa]\b|\bdarf\b|\binss\b|\birrf\b|\benergia\b|\btaxas?\b|\bremessa\b/.test(nome)) return 'Despesas';
            if (/\breceitas?\b|listagem\s+(?:das?\s+)?receitas?/.test(nome)) return 'Receitas';
            if (/\bextratos?\b|\bextratos?\s+bancarios?\b|\brepasses?\b|repasse\s+mensal|\blancamento\s+(?:dif\s+)?repasse\b/.test(nome)) return 'Receitas';
            if (/\bdiarias?\b|diarias?/.test(nome)) return 'Diarias';
            if (/\bestornos?\b|estorno/.test(nome)) return 'Estornos';
            if (nome.includes('balancete') || /\bisolado\b|balanco/.test(nome)) return 'Balancetes';
            if (nome.includes('lstemp') || /listagem\s+(?:de\s+)?emp|listagem\s+de\s+empenhos|empenhos?/.test(nome)) return 'Empenhos';
            if (nome.includes('razliq') || /razao\s+de\s+liquidacao|liquidacoes?/.test(nome)) return 'Liquidacoes';
            if (nome.includes('lstord') || nome.includes('dsptot') || /despesa|listagem\s+de\s+op|ordens?|demonstrativo\s+da\s+despesa/.test(nome)) return 'Despesas';

            return null;
        }

        function detectarTipoProcedimentoPeloNome(nomeArquivo) {
            const nome = normalizarBusca(nomeArquivo).replace(/[^a-z0-9]+/g, ' ');

            if (/\baditivo\b.*\bcontrato\b|\btermo\s+aditivo\b/.test(nome)) return 'Aditivo de Contrato';
            if (/\bextrato\s+de\s+contrato\b/.test(nome)) return 'Extrato de Contrato';
            if (/\bata\b.*\b(?:registro|resgistro)\b.*\bp?precos?\b/.test(nome)) return 'Ata de Registro de Preços';
            if (/\bhomologacao\b/.test(nome)) return 'Homologação';
            if (/\bcontratos?\b|\bcontarto\b|\btermo\s+de\s+contrato\b|\bcontrato\s+(?:de\s+)?dispensa\b|\bcontrato\s+pregao\b|(?:^|\s)ct\s*\d+/.test(nome)) return 'Contrato';
            if (/\blicita(?:cao|coes)\b|\bpregao\b|\bdispensa\b|\bprocedimentos?\s+licitatorios?\b/.test(nome)) return 'Procedimentos Licitatorios';

            return null;
        }

        function detectarTipoProcedimentoPeloConteudo(texto) {
            const inicio = normalizarBusca(texto).replace(/[^a-z0-9]+/g, ' ').substring(0, 2500);

            if (/\bextrato\s+de\s+contrato\b/.test(inicio)) return 'Extrato de Contrato';
            if (/\bata\b.*\b(?:registro|resgistro)\b.*\bp?precos?\b/.test(inicio)) return 'Ata de Registro de Preços';
            if (/\bhomologacao\s+(?:do|da)?\s*(?:pregao|dispensa)?\b/.test(inicio)) return 'Homologação';
            if (/\btermo\s+de\s+contrato\b|\bnumero\s+de\s+contrato\b|\bcontratada\b|\bcontratante\b/.test(inicio)) return 'Contrato';
            if (/\bpregao\s+presencial\b|\bprocesso\s+licitatorio\b|\blicita(?:cao|coes)\b/.test(inicio)) return 'Procedimentos Licitatorios';

            return null;
        }

        function detectarTipoDespesaPeloConteudo(texto) {
            const inicio = normalizarBusca(texto).replace(/[^a-z0-9]+/g, ' ').substring(0, 2500);

            if (/balancete\s+da\s+despesa|demonstrativo\s+da\s+despesa|pagamentos?\s+efetuados?|listagem\s+(?:das?\s+)?ordens?\s+de\s+pagamento|ordens?\s+de\s+pagamento|comprovante\s+de\s+pagamento|pag\s+salario|data\s+do\s+pagamento|despesa\s+de\s+(?:janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)/.test(inicio)) return 'Despesas';
            if (/\breceitas?\b|listagem\s+(?:das?\s+)?receitas?/.test(inicio)) return 'Receitas';
            if (/\bextratos?\b|\bextratos?\s+bancarios?\b|\brepasses?\b|repasse\s+mensal|\blancamento\s+(?:dif\s+)?repasse\b/.test(inicio)) return 'Receitas';
            if (/\bdiarias?\b/.test(inicio)) return 'Diarias';
            if (/\bestornos?\b/.test(inicio)) return 'Estornos';
            if (/\bempenhos?\b|listagem\s+de\s+empenhos?/.test(inicio)) return 'Empenhos';
            if (/razao\s+de\s+liquidacao|\bliquidacoes?\b/.test(inicio)) return 'Liquidacoes';
            if (/\bdespesas?\b/.test(inicio)) return 'Despesas';
            if (/\bbalancetes?\b|\bbalanco\b/.test(inicio)) return 'Balancetes';

            return null;
        }

