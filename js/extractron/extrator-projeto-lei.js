// Extractron - extrator de projeto de lei

        function extrairInformacoesProjetoLei(texto, nomeArquivo, numeroDocumento, urlDocumentos, tipoDocumento) {
            const textoCompleto = normalizarTextoCompleto(texto);
            const primeiraPagina = extrairPrimeiraPaginaAproximada(textoCompleto, 6000);
            const rodape = textoCompleto.slice(-4000);
            const nomeArquivoSemHash = removerPrefixoHashNomeArquivo(nomeArquivo);

            const nomeFonte = String(nomeArquivoSemHash || '')
                .replace(/\.pdf$/i, '')
                .replace(/%20/gi, ' ')
                .replace(/_20/g, ' ')
                .replace(/[_.\-]+/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            const normalizarNumeroArquivo = (valor) => {
                const digits = String(valor || '').replace(/\D/g, '');
                // Ex.: %202025 -> 202025 (token de ano, não é número do documento)
                if (/^20(?:19|20)\d{2}$/.test(digits)) return null;
                // Nomes baixados com %20 viram "20" colado nos dígitos (ex.: %20009 -> 20009)
                if (/^20\d{2,5}$/.test(digits)) return digits.slice(2);
                return digits;
            };

            const normalizarAnoArquivo = (valor) => {
                const digits = String(valor || '').replace(/\D/g, '');
                if (digits.length === 2) {
                    const yy = Number(digits);
                    if (!Number.isNaN(yy) && yy >= 0 && yy <= 50) {
                        return `20${String(yy).padStart(2, '0')}`;
                    }
                }
                const ano = digits.length >= 4 ? digits.slice(-4) : digits;
                return /^(19|20)\d{2}$/.test(ano) ? ano : null;
            };

            let numeroProjeto = null;
            let anoProjeto = null;
            let letraProjeto = null;

            // 1) Extrair número/ano/letra do texto (priorizar cabeçalho / primeira página)
            const fonteNumero = String(primeiraPagina || '').substring(0, 3000);
            const padroesNumero = [
                // PROJETO DE LEI Nº 001/2025 | PROJETO DE L E I N° 1/2024
                /PROJETO\s+DE\s+L\s*E\s*[I1l]\s*(?:COMPLEMENTAR\s*)?(?:N[º°ªoO\s\.]*)?0*(\d{1,6})(?:\s*[\/\.-]\s*((?:19|20)\d{2}))?(?:\s*[\-–—\/]\s*([A-Z]))?/i,
                /PROJETO\s+DE\s+LEI\s*(?:COMPLEMENTAR\s*)?(?:N[º°ªoO\s\.]*)?0*(\d{1,6})(?:\s*[\/\.-]\s*((?:19|20)\d{2}))?(?:\s*[\-–—\/]\s*([A-Z]))?/i,
                // PROJ. LEI N° 009/2023 | PROJ LEI 009/2023
                /\bPROJ\.?\s*(?:ETO\s*)?(?:DE\s*)?LEI\b\s*(?:N[º°ªoO\s\.]*)?0*(\d{1,6})(?:\s*[\/\.-]\s*((?:19|20)\d{2}))?(?:\s*[\-–—\/]\s*([A-Z]))?/i,
                // P.L. Nº 12/2024 | PL N 12/2024
                /\bP\.?\s*L\.?\b\s*(?:N[º°ªoO\s\.]*)?0*(\d{1,6})(?:\s*[\/\.-]\s*((?:19|20)\d{2}))?(?:\s*[\-–—\/]\s*([A-Z]))?/i
            ];

            for (const r of padroesNumero) {
                const m = fonteNumero.match(r);
                if (!m) continue;
                numeroProjeto = m[1];
                anoProjeto = m[2] || null;
                letraProjeto = m[3] || null;
                break;
            }

            // 2) Fallback pelo nome do arquivo
            if (!numeroProjeto) {
                const nomeNorm = normalizarSemAcentos(nomeFonte).toLowerCase();
                const matchNoNome = nomeNorm.match(/\b(projeto\s+de\s+lei|proj\s*lei|proj\.?\s*(?:eto\s*)?(?:de\s*)?lei|proj|p\.?\s*l\.?)(?:\s+n[º°ªoO\s\.]*)?\s*0*(\d{1,8})(?:\s*(?:[\/\.-]|\s)\s*((?:19|20)\d{2}|\d{6}|\d{2})\b)?/i);
                if (matchNoNome) {
                    numeroProjeto = normalizarNumeroArquivo(matchNoNome[2]);
                    anoProjeto = normalizarAnoArquivo(matchNoNome[3]);
                }
            }

            // Ajuste: em nomes com data por extenso (ex.: "... 23 de 12 de Maio de 2006"),
            // o token "2012" pode aparecer (por causa de %2012) e ser interpretado como ano.
            // Preferir o último ano real (19xx/20xx) presente no nome do arquivo.
            if (nomeFonte) {
                // Captura qualquer ocorrência de 19xx/20xx (mesmo "embutida" em sequências numéricas)
                // e escolhe o último ano visto no filename.
                const anosNoNome = Array.from(normalizarSemAcentos(nomeFonte).matchAll(/(?:19|20)\d{2}/g)).map(m => m[0]);
                const anoUltimo = anosNoNome.length ? anosNoNome[anosNoNome.length - 1] : null;
                const anoPareceDia = anoProjeto && new RegExp(`\\bde\\s+${anoProjeto}\\b`, 'i').test(nomeFonte);
                if (anoUltimo && (!anoProjeto || (anoPareceDia && anoUltimo !== anoProjeto))) {
                    anoProjeto = anoUltimo;
                }
            }

            if (!anoProjeto) {
                anoProjeto = extrairAnoDoNomeArquivo(nomeArquivoSemHash);
            }

            let numeroDoDocumento = null;
            if (numeroProjeto) {
                const numeroLimpo = normalizarNumeroInteiro(numeroProjeto);
                numeroDoDocumento = `${numeroLimpo}${anoProjeto ? '/' + anoProjeto : ''}`;
            }

            // Data: priorizar rodapé (assinatura/local), depois primeira página, depois última data do documento
            let data = extrairDataPadrao(rodape, nomeArquivoSemHash)
                || extrairDataPadrao(primeiraPagina, nomeArquivoSemHash);

            if (!data) {
                const datasOrdenadas = extrairDatasPadraoOrdenadas(textoCompleto);
                if (datasOrdenadas.length) data = datasOrdenadas[datasOrdenadas.length - 1].data;
            }

            if (!data && anoProjeto) {
                data = `01/01/${anoProjeto}`;
            }

            // Descrição/Ementa: priorizar campo "EMENTA:" na 1ª página.
            let descricao = null;
            const fonteDescricao = String(primeiraPagina || '').substring(0, 5000);
            const matchEmenta = fonteDescricao.match(/(?:^|\n)\s*EMENTA\s*[:\-]?\s*([^\n\r]{10,300})/i);
            if (matchEmenta && matchEmenta[1]) {
                descricao = matchEmenta[1].replace(/\s+/g, ' ').trim();
            }

            // Fallback: pegar "DISPÕE/DISPOE/ALTERA/INSTITUI..." na 1ª página.
            if (!descricao || descricao.trim().length < 8) {
                const palavrasChave = [
                    'dispõe sobre',
                    'dispoe sobre',
                    'dispõe',
                    'dispoe',
                    'altera',
                    'revoga',
                    'estabelece',
                    'institui',
                    'regulamenta',
                    'aprova',
                    'autoriza',
                    'cria',
                    'extingue',
                    'declara',
                    'determina',
                    'concede'
                ];

                const fonteLower = fonteDescricao.toLowerCase();
                let inicioDescricao = -1;
                for (const palavra of palavrasChave) {
                    const idx = fonteLower.indexOf(palavra);
                    if (idx !== -1 && (inicioDescricao === -1 || idx < inicioDescricao)) {
                        inicioDescricao = idx;
                    }
                }

                if (inicioDescricao !== -1) {
                    let textoDescricao = fonteDescricao.substring(inicioDescricao).replace(/\s+/g, ' ').trim();

                    const marcadoresFim = [
                        ', e dá outras providências',
                        ' e dá outras providências',
                        'e dá outras providências',
                        ', e outras providências',
                        'art. 1',
                        'artigo 1'
                    ];

                    let fimDescricao = textoDescricao.length;
                    for (const marcador of marcadoresFim) {
                        const idx = textoDescricao.toLowerCase().indexOf(marcador);
                        if (idx !== -1 && idx < fimDescricao) fimDescricao = idx;
                    }

                    if (fimDescricao === textoDescricao.length) {
                        const matchPonto = textoDescricao.substring(0, 400).match(/\.\s+[A-Z]/);
                        if (matchPonto) fimDescricao = matchPonto.index + 1;
                    }

                    descricao = textoDescricao.substring(0, fimDescricao).trim();
                }
            }

            // Fallback final: derivar do nome do arquivo (sem hash)
            if (!descricao || String(descricao).trim().length < 8) {
                const descNome = limparDescricaoArquivo(nomeArquivoSemHash);
                if (descNome) descricao = descNome;
            }

            if ((!descricao || String(descricao).trim().length < 8) && numeroDoDocumento) {
                descricao = `Projeto de Lei n ${numeroDoDocumento}`;
            }

            if (descricao) {
                descricao = String(descricao)
                    .replace(/[:\\|_*]+/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
            }

            return {
                numero: numeroDocumento,
                arquivo: nomeArquivo,
                numeroDoDocumento: numeroDoDocumento,
                data: data,
                letra: letraProjeto || null,
                descricao: descricao ? descricao.toUpperCase().substring(0, 300) : null,
                url: `${urlDocumentos}${encodeURIComponent(nomeArquivo)}`,
                tipoDocumento: tipoDocumento
            };
        }

