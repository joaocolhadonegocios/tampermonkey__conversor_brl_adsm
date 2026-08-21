// ==UserScript==
// @name         Meta Ads — Conversor USD ↔ BRL
// @namespace    meta-ads-currency
// @version      8.2.1
// @description  Conversor robusto de moedas para o Meta Ads Manager
// @author       João
// @match        https://www.facebook.com/*
// @match        https://business.facebook.com/*
// @match        https://adsmanager.facebook.com/*
// @exclude      https://www.facebook.com/ads/library*
// @exclude      https://business.facebook.com/ads/library*
// @exclude      https://adsmanager.facebook.com/ads/library*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {

    'use strict';

    // ============================================================
    // BLOQUEIO — ADS LIBRARY
    // ============================================================

    /*
     * O script NÃO deve funcionar na Biblioteca de Anúncios.
     *
     * Exemplos bloqueados:
     *
     * https://www.facebook.com/ads/library/
     * https://www.facebook.com/ads/library/?...
     *
     * O bloqueio é feito antes de qualquer criação de elemento,
     * observer, listener ou alteração da página.
     */

    const pathname =
        String(location.pathname || '').toLowerCase();

    if (
        pathname === '/ads/library' ||
        pathname.startsWith('/ads/library/')
    ) {
        return;
    }

    console.log(
        '🚀 Meta Ads Currency Converter V8.2 iniciado'
    );

    // ============================================================
    // CONFIGURAÇÕES
    // ============================================================

    const STORAGE = {
        rate: 'meta_currency_rate',
        autoStart: 'meta_currency_autostart',
        minimized: 'meta_currency_minimized',
        position: 'meta_currency_position'
    };

    const DEFAULT_RATE = 5.40;

    const ATTR = {
        converted: 'data-meta-currency-converted',
        original: 'data-meta-currency-original',
        value: 'data-meta-currency-value',
        originalTitle: 'data-meta-currency-original-title',
        hadTitle: 'data-meta-currency-had-title'
    };

    const PANEL_ID = 'meta-currency-v82-panel';
    const MINI_ID = 'meta-currency-v82-mini';

    // ============================================================
    // ESTADO
    // ============================================================

    let exchangeRate =
        parseFloat(
            localStorage.getItem(STORAGE.rate)
        ) ||
        DEFAULT_RATE;

    let autoStart =
        localStorage.getItem(STORAGE.autoStart) === 'true';

    let enabled = autoStart;

    let minimized =
        localStorage.getItem(STORAGE.minimized) === 'true';

    let position = null;

    try {

        position =
            JSON.parse(
                localStorage.getItem(STORAGE.position)
            );

    } catch (e) {

        position = null;

    }

    if (
        !position ||
        typeof position.top !== 'number' ||
        typeof position.right !== 'number'
    ) {

        position = {
            top: 90,
            right: 20
        };

    }

    // ============================================================
    // CONTROLE
    // ============================================================

    let processing = false;
    let scanTimer = null;
    let queueTimer = null;
    let scrollTimer = null;
    let routeTimer = null;
    let resizeTimer = null;
    let routeInterval = null;

    const processingQueue = new Set();

    /*
     * Elementos modificados pelo próprio script.
     *
     * Evita que o MutationObserver interprete nossas próprias
     * alterações como novas alterações do Meta.
     */

    const internallyModified =
        new WeakSet();

    // ============================================================
    // ESTILO
    // ============================================================

    const style =
        document.createElement('style');

    style.textContent = `

        #${PANEL_ID} {
            position: fixed;
            width: 270px;
            z-index: 2147483647;
            background: #fff;
            border: 1px solid rgba(0,0,0,.10);
            border-radius: 15px;
            box-shadow:
                0 12px 35px rgba(0,0,0,.20),
                0 3px 10px rgba(0,0,0,.08);
            font-family:
                -apple-system,
                BlinkMacSystemFont,
                "Segoe UI",
                Roboto,
                Arial,
                sans-serif;
            color: #1c1e21;
            overflow: hidden;
            user-select: none;
        }

        #${PANEL_ID} * {
            box-sizing: border-box;
        }

        #meta-currency-v82-header {
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 10px 0 14px;
            background:
                linear-gradient(
                    135deg,
                    #1877f2,
                    #0866ff
                );
            color: #fff;
            cursor: move;
        }

        #meta-currency-v82-title {
            display: flex;
            align-items: center;
            gap: 9px;
            font-size: 15px;
            font-weight: 700;
        }

        #meta-currency-v82-icon {
            width: 29px;
            height: 29px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255,255,255,.18);
            font-size: 16px;
            font-weight: 800;
        }

        #meta-currency-v82-actions {
            display: flex;
            align-items: center;
            gap: 3px;
        }

        .meta-currency-v82-action {
            width: 29px;
            height: 29px;
            border: 0;
            border-radius: 7px;
            background: transparent;
            color: #fff;
            cursor: pointer;
            font-size: 19px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .meta-currency-v82-action:hover {
            background: rgba(255,255,255,.18);
        }

        #meta-currency-v82-body {
            padding: 16px;
        }

        #meta-currency-v82-main {
            margin-bottom: 15px;
        }

        #meta-currency-v82-mode {
            font-size: 15px;
            font-weight: 750;
            line-height: 1.3;
        }

        #meta-currency-v82-status {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            margin-top: 5px;
            font-size: 12px;
            font-weight: 650;
            color: #65676b;
        }

        #meta-currency-v82-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #31a24c;
            box-shadow:
                0 0 0 3px rgba(49,162,76,.12);
        }

        #meta-currency-v82-dot.off {
            background: #999;
            box-shadow:
                0 0 0 3px rgba(153,153,153,.12);
        }

        #meta-currency-v82-rate-label {
            display: block;
            font-size: 12px;
            font-weight: 600;
            color: #65676b;
            margin-bottom: 6px;
        }

        #meta-currency-v82-rate-row {
            display: flex;
            gap: 7px;
        }

        #meta-currency-v82-rate {
            flex: 1;
            height: 38px;
            border: 1px solid #ccd0d5;
            border-radius: 8px;
            padding: 0 10px;
            font-size: 15px;
            outline: none;
            color: #1c1e21;
        }

        #meta-currency-v82-rate:focus {
            border-color: #1877f2;
            box-shadow:
                0 0 0 2px rgba(24,119,242,.14);
        }

        #meta-currency-v82-apply {
            height: 38px;
            padding: 0 13px;
            border: 0;
            border-radius: 8px;
            background: #1877f2;
            color: #fff;
            font-size: 13px;
            font-weight: 700;
            cursor: pointer;
        }

        #meta-currency-v82-apply:hover {
            background: #166fe5;
        }

        #meta-currency-v82-toggle {
            width: 100%;
            height: 40px;
            margin-top: 13px;
            border: 0;
            border-radius: 9px;
            color: #fff;
            font-size: 14px;
            font-weight: 750;
            cursor: pointer;
        }

        #meta-currency-v82-toggle.active {
            background: #31a24c;
        }

        #meta-currency-v82-toggle.inactive {
            background: #65676b;
        }

        #meta-currency-v82-auto {
            display: flex;
            align-items: center;
            gap: 9px;
            margin-top: 14px;
            padding: 10px;
            border-radius: 9px;
            background: #f5f6f7;
            cursor: pointer;
        }

        #meta-currency-v82-auto input {
            width: 16px;
            height: 16px;
            margin: 0;
            cursor: pointer;
            accent-color: #1877f2;
        }

        #meta-currency-v82-auto-text {
            font-size: 13px;
            font-weight: 600;
            color: #1c1e21;
            line-height: 1.25;
        }

        #meta-currency-v82-auto-description {
            display: block;
            margin-top: 2px;
            font-size: 10px;
            font-weight: 400;
            color: #65676b;
        }

        #meta-currency-v82-info {
            margin-top: 12px;
            font-size: 10px;
            line-height: 1.45;
            color: #8a8d91;
            text-align: center;
        }

        #${MINI_ID} {
            position: fixed;
            width: 52px;
            height: 52px;
            z-index: 2147483647;
            border: 0;
            border-radius: 50%;
            background:
                linear-gradient(
                    135deg,
                    #1877f2,
                    #0866ff
                );
            color: #fff;
            box-shadow:
                0 6px 20px rgba(0,0,0,.25);
            cursor: pointer;
            font-size: 21px;
            font-weight: 800;
            display: flex;
            align-items: center;
            justify-content: center;
        }

    `;

    if (document.head) {
        document.head.appendChild(style);
    }

    // ============================================================
    // NORMALIZAÇÃO
    // ============================================================

    function normalizeText(text) {

        return String(text || '')
            .replace(/\u00A0/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

    }

    // ============================================================
    // REGEX
    // ============================================================

    const BRL_REGEX =
        /^R\$\s*[\d.]+(?:,\d{1,2})?$/;

    // ============================================================
    // PARSE
    // ============================================================

    function parseBRL(text) {

        const normalized =
            normalizeText(text);

        if (!BRL_REGEX.test(normalized)) {
            return null;
        }

        const match =
            normalized.match(
                /^R\$\s*([\d.]+(?:,\d{1,2})?)$/
            );

        if (!match) {
            return null;
        }

        const number =
            parseFloat(
                match[1]
                    .replace(/\./g, '')
                    .replace(',', '.')
            );

        return Number.isFinite(number)
            ? number
            : null;

    }

    // ============================================================
    // FORMATAÇÃO
    // ============================================================

    function formatUSD(value) {

        return (
            'US$ ' +
            value.toLocaleString(
                'en-US',
                {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }
            )
        );

    }

    // ============================================================
    // PRÓPRIO SCRIPT
    // ============================================================

    function isOwnElement(element) {

        if (!element || element.nodeType !== 1) {
            return false;
        }

        return !!element.closest(
            `#${PANEL_ID}, #${MINI_ID}`
        );

    }

    // ============================================================
    // EDITÁVEL
    // ============================================================

    function isEditableElement(element) {

        if (!element || element.nodeType !== 1) {
            return false;
        }

        const tag =
            element.tagName.toLowerCase();

        if (
            tag === 'input' ||
            tag === 'textarea' ||
            tag === 'select' ||
            tag === 'option' ||
            tag === 'button'
        ) {
            return true;
        }

        if (element.isContentEditable) {
            return true;
        }

        if (
            element.getAttribute('contenteditable') === 'true'
        ) {
            return true;
        }

        return false;

    }

    // ============================================================
    // CONTEXTO
    // ============================================================

    function getSurface(element) {

        let current = element;
        let depth = 0;

        while (current && depth < 15) {

            if (current.nodeType !== 1) {
                break;
            }

            const surface =
                current.getAttribute('data-surface');

            if (surface) {
                return surface.toLowerCase();
            }

            current = current.parentElement;
            depth++;

        }

        return '';

    }

    // ============================================================
    // DETECTAR ROAS
    // ============================================================

    function isROASContext(element) {

        const surface =
            getSurface(element);

        if (
            surface.includes('roas') ||
            surface.includes('purchase_roas')
        ) {
            return true;
        }

        let current = element;
        let depth = 0;

        while (current && depth < 8) {

            const aria =
                normalizeText(
                    current.getAttribute?.('aria-label')
                ).toLowerCase();

            const title =
                normalizeText(
                    current.getAttribute?.('title')
                ).toLowerCase();

            const text =
                normalizeText(
                    current.textContent
                ).toLowerCase();

            if (
                aria.includes('roas') ||
                title.includes('roas')
            ) {
                return true;
            }

            if (
                text === 'roas' ||
                text.startsWith('roas ')
            ) {
                return true;
            }

            current =
                current.parentElement;

            depth++;

        }

        return false;

    }

    // ============================================================
    // CONTEXTO MONETÁRIO
    // ============================================================

    function isMoneyContext(element) {

        if (!element) {
            return false;
        }

        if (isOwnElement(element)) {
            return false;
        }

        if (isEditableElement(element)) {
            return false;
        }

        if (isROASContext(element)) {
            return false;
        }

        const surface =
            getSurface(element);

        if (surface) {

            if (
                surface.includes('spend') ||
                surface.includes('cpm') ||
                surface.includes('cost_per') ||
                surface.includes('budget') ||
                surface.includes('amount') ||
                surface.includes('cost')
            ) {
                return true;
            }

        }

        let current = element;
        let depth = 0;

        while (current && depth < 15) {

            const tag =
                current.tagName
                    ? current.tagName.toLowerCase()
                    : '';

            const role =
                current.getAttribute
                    ? current.getAttribute('role')
                    : '';

            if (
                tag === 'tr' ||
                tag === 'td' ||
                tag === 'th' ||
                role === 'row' ||
                role === 'gridcell' ||
                role === 'cell' ||
                role === 'columnheader'
            ) {
                return true;
            }

            current =
                current.parentElement;

            depth++;

        }

        /*
         * Fallback final.
         *
         * O script só chega aqui depois de validar que
         * o conteúdo inteiro do elemento é um valor BRL.
         */

        return true;

    }

    // ============================================================
    // ENCONTRAR ELEMENTO MONETÁRIO MAIS ADEQUADO
    // ============================================================

    function getBestElementForTextNode(textNode) {

        if (
            !textNode ||
            !textNode.parentElement
        ) {
            return null;
        }

        let element =
            textNode.parentElement;

        let best = element;

        for (let i = 0; i < 5 && element; i++) {

            if (
                isOwnElement(element) ||
                isEditableElement(element)
            ) {
                return null;
            }

            const text =
                normalizeText(
                    element.textContent
                );

            if (
                BRL_REGEX.test(text)
            ) {
                best = element;
            }

            element =
                element.parentElement;

        }

        return best;

    }

    // ============================================================
    // BUSCAR TEXT NODES
    // ============================================================

    function getTextNodeCandidates(root) {

        const result = [];

        if (!root) {
            return result;
        }

        const walker =
            document.createTreeWalker(
                root,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode(node) {

                        if (!node || !node.parentElement) {
                            return NodeFilter.FILTER_REJECT;
                        }

                        const parent =
                            node.parentElement;

                        if (
                            isOwnElement(parent) ||
                            isEditableElement(parent)
                        ) {
                            return NodeFilter.FILTER_REJECT;
                        }

                        const text =
                            normalizeText(
                                node.nodeValue
                            );

                        if (
                            !BRL_REGEX.test(text)
                        ) {
                            return NodeFilter.FILTER_REJECT;
                        }

                        return NodeFilter.FILTER_ACCEPT;

                    }
                }
            );

        let node;

        while (
            (node = walker.nextNode())
        ) {

            result.push(node);

        }

        return result;

    }

    // ============================================================
    // ENCONTRAR CANDIDATOS POR ELEMENTOS
    // ============================================================

    function getElementCandidates(root) {

        const candidates = [];

        if (
            !root ||
            !root.querySelectorAll
        ) {
            return candidates;
        }

        const elements =
            root.querySelectorAll(
                'span, div, td, th, p, a, [role="gridcell"], [role="cell"]'
            );

        for (const element of elements) {

            if (
                !element.isConnected ||
                isOwnElement(element) ||
                isEditableElement(element)
            ) {
                continue;
            }

            const text =
                normalizeText(
                    element.textContent
                );

            if (
                !BRL_REGEX.test(text)
            ) {
                continue;
            }

            let exactChild = false;

            for (
                const child of element.children
            ) {

                const childText =
                    normalizeText(
                        child.textContent
                    );

                if (
                    BRL_REGEX.test(childText)
                ) {
                    exactChild = true;
                    break;
                }

            }

            if (exactChild) {
                continue;
            }

            candidates.push(element);

        }

        return candidates;

    }

    // ============================================================
    // ENCONTRAR CANDIDATOS
    // ============================================================

    function getMoneyCandidates(root) {

        const candidates = new Set();

        const textNodes =
            getTextNodeCandidates(root);

        for (const node of textNodes) {

            const element =
                getBestElementForTextNode(node);

            if (element) {
                candidates.add(element);
            }

        }

        const elements =
            getElementCandidates(root);

        for (const element of elements) {
            candidates.add(element);
        }

        return Array.from(candidates);

    }

    // ============================================================
    // RESTAURAR ELEMENTO
    // ============================================================

    function restoreElement(element) {

        if (!element) {
            return;
        }

        const original =
            element.getAttribute(
                ATTR.original
            );

        if (original !== null) {

            internallyModified.add(element);

            try {

                element.textContent =
                    original;

            } catch (e) {}

        }

        const hadTitle =
            element.getAttribute(
                ATTR.hadTitle
            );

        const originalTitle =
            element.getAttribute(
                ATTR.originalTitle
            );

        internallyModified.add(element);

        try {

            if (hadTitle === 'true') {

                element.setAttribute(
                    'title',
                    originalTitle || ''
                );

            } else {

                element.removeAttribute('title');

            }

        } catch (e) {}

        element.removeAttribute(
            ATTR.original
        );

        element.removeAttribute(
            ATTR.originalTitle
        );

        element.removeAttribute(
            ATTR.hadTitle
        );

        element.removeAttribute(
            ATTR.converted
        );

        element.removeAttribute(
            ATTR.value
        );

    }

    // ============================================================
    // RESTAURAR TODOS
    // ============================================================

    function restoreOriginalValues() {

        const elements =
            document.querySelectorAll(
                `[${ATTR.original}]`
            );

        elements.forEach(
            restoreElement
        );

    }

    // ============================================================
    // DETECTAR ELEMENTO OBSOLETO
    // ============================================================

    function refreshConvertedElement(element) {

        if (
            !element ||
            !element.hasAttribute(
                ATTR.original
            )
        ) {
            return false;
        }

        if (
            internallyModified.has(element)
        ) {

            internallyModified.delete(element);

            return false;

        }

        const current =
            normalizeText(
                element.textContent
            );

        const original =
            normalizeText(
                element.getAttribute(
                    ATTR.original
                )
            );

        if (
            BRL_REGEX.test(current)
        ) {

            restoreElement(element);

            return true;

        }

        if (
            current !==
            normalizeText(
                element.getAttribute(
                    ATTR.converted
                )
            )
        ) {

            if (
                !current.startsWith('US$')
            ) {

                restoreElement(element);

                return true;

            }

        }

        return false;

    }

    // ============================================================
    // CONVERTER
    // ============================================================

    function convertElement(element) {

        if (!element) {
            return false;
        }

        if (
            isOwnElement(element) ||
            isEditableElement(element)
        ) {
            return false;
        }

        if (
            element.hasAttribute(
                ATTR.original
            )
        ) {

            refreshConvertedElement(element);

            if (
                element.hasAttribute(
                    ATTR.original
                )
            ) {
                return false;
            }

        }

        const original =
            normalizeText(
                element.textContent
            );

        if (
            !BRL_REGEX.test(original)
        ) {
            return false;
        }

        if (
            !isMoneyContext(element)
        ) {
            return false;
        }

        const brl =
            parseBRL(original);

        if (
            brl === null ||
            !Number.isFinite(brl)
        ) {
            return false;
        }

        if (
            !Number.isFinite(exchangeRate) ||
            exchangeRate <= 0
        ) {
            return false;
        }

        const usd =
            brl / exchangeRate;

        if (
            !Number.isFinite(usd)
        ) {
            return false;
        }

        const formatted =
            formatUSD(usd);

        element.setAttribute(
            ATTR.original,
            original
        );

        element.setAttribute(
            ATTR.value,
            String(brl)
        );

        const hadTitle =
            element.hasAttribute('title');

        element.setAttribute(
            ATTR.hadTitle,
            hadTitle ? 'true' : 'false'
        );

        element.setAttribute(
            ATTR.originalTitle,
            hadTitle
                ? element.getAttribute('title') || ''
                : ''
        );

        element.setAttribute(
            ATTR.converted,
            formatted
        );

        internallyModified.add(element);

        try {

            element.textContent =
                formatted;

            element.title =
                `${original} → ${formatted} | Câmbio R$ ${exchangeRate.toFixed(2)}`;

        } catch (error) {

            restoreElement(element);

            return false;

        }

        return true;

    }

    // ============================================================
    // PROCESSAR ROOT
    // ============================================================

    function processRoot(root) {

        if (
            !enabled ||
            !root
        ) {
            return 0;
        }

        if (
            root.nodeType === 1 &&
            isOwnElement(root)
        ) {
            return 0;
        }

        let processed = 0;

        if (root.querySelectorAll) {

            const converted =
                root.querySelectorAll(
                    `[${ATTR.original}]`
                );

            converted.forEach(
                refreshConvertedElement
            );

        }

        const candidates =
            getMoneyCandidates(root);

        for (const element of candidates) {

            if (
                convertElement(element)
            ) {
                processed++;
            }

        }

        if (
            root.nodeType === 1 &&
            !isOwnElement(root) &&
            !isEditableElement(root)
        ) {

            const text =
                normalizeText(
                    root.textContent
                );

            if (
                BRL_REGEX.test(text) &&
                convertElement(root)
            ) {
                processed++;
            }

        }

        return processed;

    }

    // ============================================================
    // SCAN COMPLETO
    // ============================================================

    function processTable() {

        if (
            !enabled ||
            processing ||
            !document.body
        ) {
            return;
        }

        /*
         * Proteção adicional caso uma SPA navegue para
         * /ads/library sem recarregar a página.
         */

        const currentPath =
            String(location.pathname || '').toLowerCase();

        if (
            currentPath === '/ads/library' ||
            currentPath.startsWith('/ads/library/')
        ) {

            enabled = false;

            restoreOriginalValues();

            return;

        }

        processing = true;

        let processed = 0;

        try {

            processed =
                processRoot(
                    document.body
                );

        } catch (error) {

            console.warn(
                'Meta Currency V8.2 scan:',
                error
            );

        } finally {

            processing = false;

        }

        if (processed > 0) {

            console.log(
                `💵 ${processed} valor(es) convertido(s)`
            );

        }

    }

    // ============================================================
    // FILA
    // ============================================================

    function queueElement(element) {

        if (
            !enabled ||
            !element ||
            !element.isConnected
        ) {
            return;
        }

        if (
            isOwnElement(element)
        ) {
            return;
        }

        processingQueue.add(element);

        if (queueTimer) {
            return;
        }

        queueTimer =
            requestAnimationFrame(
                processQueue
            );

    }

    // ============================================================
    // PROCESSAR FILA
    // ============================================================

    function processQueue() {

        queueTimer = null;

        if (!enabled) {

            processingQueue.clear();

            return;

        }

        const items =
            Array.from(
                processingQueue
            );

        processingQueue.clear();

        let processed = 0;

        for (const element of items) {

            if (
                !element ||
                !element.isConnected
            ) {
                continue;
            }

            try {

                processed +=
                    processRoot(element);

            } catch (e) {}

        }

        if (processed > 0) {

            console.log(
                `⚡ ${processed} novo(s) valor(es) detectado(s)`
            );

        }

    }

    // ============================================================
    // SCAN AGENDADO
    // ============================================================

    function scheduleFullScan(delay = 100) {

        clearTimeout(scanTimer);

        scanTimer =
            setTimeout(
                processTable,
                delay
            );

    }

    // ============================================================
    // MUTATION OBSERVER
    // ============================================================

    const observer =
        new MutationObserver(
            function (mutations) {

                if (!enabled) {
                    return;
                }

                let largeUpdate = false;

                for (const mutation of mutations) {

                    if (
                        mutation.type ===
                        'characterData'
                    ) {

                        const parent =
                            mutation.target
                                ?.parentElement;

                        if (
                            parent &&
                            !isOwnElement(parent)
                        ) {

                            queueElement(parent);

                        }

                        continue;

                    }

                    if (
                        mutation.type ===
                        'attributes'
                    ) {

                        const target =
                            mutation.target;

                        if (
                            target &&
                            !isOwnElement(target) &&
                            !internallyModified.has(target)
                        ) {

                            queueElement(target);

                        }

                        continue;

                    }

                    if (
                        mutation.type ===
                        'childList'
                    ) {

                        if (
                            mutation.target &&
                            mutation.target.nodeType === 1
                        ) {

                            queueElement(
                                mutation.target
                            );

                        }

                        for (
                            const node of mutation.addedNodes
                        ) {

                            if (
                                node.nodeType !== 1
                            ) {
                                continue;
                            }

                            if (
                                isOwnElement(node)
                            ) {
                                continue;
                            }

                            queueElement(node);

                            const text =
                                normalizeText(
                                    node.textContent
                                );

                            if (
                                text.includes('R$')
                            ) {

                                largeUpdate = true;

                            }

                        }

                    }

                }

                if (largeUpdate) {

                    scheduleFullScan(120);

                }

            }
        );

    // ============================================================
    // SCROLL
    // ============================================================

    function handleScroll() {

        if (!enabled) {
            return;
        }

        clearTimeout(scrollTimer);

        scrollTimer =
            setTimeout(
                function () {

                    processTable();

                },
                100
            );

    }

    // ============================================================
    // SCANNER DE SEGURANÇA
    // ============================================================

    function startPeriodicScanner() {

        setInterval(
            function () {

                if (!enabled) {
                    return;
                }

                processTable();

            },
            1000
        );

    }

    // ============================================================
    // ROTA
    // ============================================================

    let lastUrl =
        location.href;

    function monitorRoute() {

        const current =
            location.href;

        if (
            current === lastUrl
        ) {
            return;
        }

        lastUrl =
            current;

        const currentPath =
            String(location.pathname || '').toLowerCase();

        /*
         * Se a SPA entrar na Ads Library, desativamos.
         */

        if (
            currentPath === '/ads/library' ||
            currentPath.startsWith('/ads/library/')
        ) {

            console.log(
                '🛑 Ads Library detectada — Meta Currency desativado'
            );

            enabled = false;

            processingQueue.clear();

            restoreOriginalValues();

            const panel =
                document.getElementById(PANEL_ID);

            if (panel) {
                panel.remove();
            }

            const mini =
                document.getElementById(MINI_ID);

            if (mini) {
                mini.remove();
            }

            return;

        }

        console.log(
            '🔄 Meta Ads rota alterada — reprocessando'
        );

        if (enabled) {

            clearTimeout(routeTimer);

            routeTimer =
                setTimeout(
                    processTable,
                    400
                );

        }

    }

    const originalPushState =
        history.pushState;

    history.pushState =
        function () {

            const result =
                originalPushState.apply(
                    this,
                    arguments
                );

            setTimeout(
                monitorRoute,
                50
            );

            return result;

        };

    const originalReplaceState =
        history.replaceState;

    history.replaceState =
        function () {

            const result =
                originalReplaceState.apply(
                    this,
                    arguments
                );

            setTimeout(
                monitorRoute,
                50
            );

            return result;

        };

    window.addEventListener(
        'popstate',
        function () {

            setTimeout(
                monitorRoute,
                50
            );

        }
    );

    // ============================================================
    // RESIZE
    // ============================================================

    window.addEventListener(
        'resize',
        function () {

            if (!enabled) {
                return;
            }

            clearTimeout(resizeTimer);

            resizeTimer =
                setTimeout(
                    processTable,
                    200
                );

        }
    );

    // ============================================================
    // VISIBILIDADE
    // ============================================================

    document.addEventListener(
        'visibilitychange',
        function () {

            if (
                document.visibilityState === 'visible' &&
                enabled
            ) {

                setTimeout(
                    processTable,
                    100
                );

            }

        }
    );

    // ============================================================
    // PAINEL
    // ============================================================

    function applyPosition(element) {

        if (!element) {
            return;
        }

        element.style.top =
            `${position.top}px`;

        element.style.right =
            `${position.right}px`;

        element.style.left =
            'auto';

        element.style.bottom =
            'auto';

    }

    function savePosition(element) {

        if (!element) {
            return;
        }

        const top =
            parseInt(
                element.style.top,
                10
            );

        const right =
            parseInt(
                element.style.right,
                10
            );

        position = {
            top:
                Number.isFinite(top)
                    ? top
                    : 90,

            right:
                Number.isFinite(right)
                    ? right
                    : 20
        };

        localStorage.setItem(
            STORAGE.position,
            JSON.stringify(position)
        );

    }

    function updatePanel() {

        const status =
            document.getElementById(
                'meta-currency-v82-status-text'
            );

        const dot =
            document.getElementById(
                'meta-currency-v82-dot'
            );

        const button =
            document.getElementById(
                'meta-currency-v82-toggle'
            );

        if (
            !status ||
            !dot ||
            !button
        ) {
            return;
        }

        if (enabled) {

            status.textContent =
                'ATIVADO';

            dot.classList.remove('off');

            button.textContent =
                '✓ ATIVADO';

            button.className =
                'active';

        } else {

            status.textContent =
                'DESATIVADO';

            dot.classList.add('off');

            button.textContent =
                '○ DESATIVADO';

            button.className =
                'inactive';

        }

    }

    function toggle() {

        enabled =
            !enabled;

        updatePanel();

        if (enabled) {

            scheduleFullScan(0);

        } else {

            restoreOriginalValues();

        }

    }

    function applyRate() {

        const input =
            document.getElementById(
                'meta-currency-v82-rate'
            );

        if (!input) {
            return;
        }

        const value =
            parseFloat(input.value);

        if (
            !Number.isFinite(value) ||
            value <= 0
        ) {
            return;
        }

        exchangeRate =
            value;

        localStorage.setItem(
            STORAGE.rate,
            String(exchangeRate)
        );

        restoreOriginalValues();

        if (enabled) {
            scheduleFullScan(0);
        }

    }

    // ============================================================
    // DRAG PAINEL
    // ============================================================

    function makeDraggable(panel) {

        const header =
            document.getElementById(
                'meta-currency-v82-header'
            );

        if (!header) {
            return;
        }

        let dragging = false;
        let startX = 0;
        let startY = 0;
        let startTop = 0;
        let startRight = 0;

        header.addEventListener(
            'mousedown',
            function (event) {

                if (
                    event.target.closest('button')
                ) {
                    return;
                }

                dragging = true;

                startX =
                    event.clientX;

                startY =
                    event.clientY;

                const rect =
                    panel.getBoundingClientRect();

                startTop =
                    rect.top;

                startRight =
                    window.innerWidth -
                    rect.right;

                document.body.style.userSelect =
                    'none';

            }
        );

        document.addEventListener(
            'mousemove',
            function (event) {

                if (!dragging) {
                    return;
                }

                const dx =
                    event.clientX -
                    startX;

                const dy =
                    event.clientY -
                    startY;

                let top =
                    startTop + dy;

                let right =
                    startRight - dx;

                const maxTop =
                    Math.max(
                        5,
                        window.innerHeight -
                        panel.offsetHeight -
                        5
                    );

                const maxRight =
                    Math.max(
                        5,
                        window.innerWidth -
                        panel.offsetWidth -
                        5
                    );

                top =
                    Math.max(
                        5,
                        Math.min(
                            top,
                            maxTop
                        )
                    );

                right =
                    Math.max(
                        5,
                        Math.min(
                            right,
                            maxRight
                        )
                    );

                panel.style.top =
                    `${top}px`;

                panel.style.right =
                    `${right}px`;

            }
        );

        document.addEventListener(
            'mouseup',
            function () {

                if (!dragging) {
                    return;
                }

                dragging = false;

                document.body.style.userSelect =
                    '';

                savePosition(panel);

            }
        );

    }

    // ============================================================
    // MINI
    // ============================================================

    function createMiniButton() {

        if (
            document.getElementById(MINI_ID)
        ) {
            return;
        }

        const mini =
            document.createElement('button');

        mini.id =
            MINI_ID;

        mini.type =
            'button';

        mini.textContent =
            '$';

        mini.title =
            'Abrir Meta Currency';

        mini.style.top =
            `${position.top}px`;

        mini.style.right =
            `${position.right}px`;

        mini.dataset.moved =
            'false';

        document.body.appendChild(mini);

        makeMiniDraggable(mini);

        mini.addEventListener(
            'click',
            function () {

                if (
                    mini.dataset.moved === 'true'
                ) {

                    mini.dataset.moved =
                        'false';

                    return;

                }

                restorePanel();

            }
        );

    }

    function restorePanel() {

        minimized = false;

        localStorage.setItem(
            STORAGE.minimized,
            'false'
        );

        const mini =
            document.getElementById(
                MINI_ID
            );

        if (mini) {

            savePosition(mini);

            mini.remove();

        }

        const panel =
            document.getElementById(
                PANEL_ID
            );

        if (panel) {

            panel.style.display =
                'block';

            applyPosition(panel);

        }

    }

    function minimize() {

        minimized = true;

        localStorage.setItem(
            STORAGE.minimized,
            'true'
        );

        const panel =
            document.getElementById(
                PANEL_ID
            );

        if (panel) {

            savePosition(panel);

            panel.style.display =
                'none';

        }

        createMiniButton();

    }

    function makeMiniDraggable(mini) {

        let dragging = false;
        let moved = false;

        let startX = 0;
        let startY = 0;
        let startTop = 0;
        let startRight = 0;

        mini.addEventListener(
            'mousedown',
            function (event) {

                dragging = true;
                moved = false;

                mini.dataset.moved =
                    'false';

                startX =
                    event.clientX;

                startY =
                    event.clientY;

                const rect =
                    mini.getBoundingClientRect();

                startTop =
                    rect.top;

                startRight =
                    window.innerWidth -
                    rect.right;

                event.preventDefault();

            }
        );

        document.addEventListener(
            'mousemove',
            function (event) {

                if (!dragging) {
                    return;
                }

                const dx =
                    event.clientX -
                    startX;

                const dy =
                    event.clientY -
                    startY;

                if (
                    Math.abs(dx) > 3 ||
                    Math.abs(dy) > 3
                ) {

                    moved = true;

                    mini.dataset.moved =
                        'true';

                }

                let top =
                    startTop + dy;

                let right =
                    startRight - dx;

                const maxTop =
                    Math.max(
                        5,
                        window.innerHeight -
                        mini.offsetHeight -
                        5
                    );

                const maxRight =
                    Math.max(
                        5,
                        window.innerWidth -
                        mini.offsetWidth -
                        5
                    );

                top =
                    Math.max(
                        5,
                        Math.min(
                            top,
                            maxTop
                        )
                    );

                right =
                    Math.max(
                        5,
                        Math.min(
                            right,
                            maxRight
                        )
                    );

                mini.style.top =
                    `${top}px`;

                mini.style.right =
                    `${right}px`;

            }
        );

        document.addEventListener(
            'mouseup',
            function () {

                if (!dragging) {
                    return;
                }

                dragging = false;

                if (moved) {
                    savePosition(mini);
                }

            }
        );

    }

    // ============================================================
    // CRIAR PAINEL
    // ============================================================

    function createPanel() {

        if (
            document.getElementById(PANEL_ID)
        ) {
            return;
        }

        const panel =
            document.createElement('div');

        panel.id =
            PANEL_ID;

        panel.innerHTML = `

            <div id="meta-currency-v82-header">

                <div id="meta-currency-v82-title">

                    <div id="meta-currency-v82-icon">
                        $
                    </div>

                    <span>
                        Meta Currency
                    </span>

                </div>

                <div id="meta-currency-v82-actions">

                    <button
                        type="button"
                        class="meta-currency-v82-action"
                        id="meta-currency-v82-minimize"
                        title="Minimizar"
                    >
                        −
                    </button>

                </div>

            </div>

            <div id="meta-currency-v82-body">

                <div id="meta-currency-v82-main">

                    <div id="meta-currency-v82-mode">
                        Transformar para USD
                    </div>

                    <div id="meta-currency-v82-status">

                        <span
                            id="meta-currency-v82-dot"
                            class="off"
                        ></span>

                        <span
                            id="meta-currency-v82-status-text"
                        >
                            DESATIVADO
                        </span>

                    </div>

                </div>

                <label
                    id="meta-currency-v82-rate-label"
                    for="meta-currency-v82-rate"
                >
                    Cotação do dólar
                </label>

                <div id="meta-currency-v82-rate-row">

                    <input
                        id="meta-currency-v82-rate"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value="${exchangeRate.toFixed(2)}"
                    />

                    <button
                        type="button"
                        id="meta-currency-v82-apply"
                    >
                        Aplicar
                    </button>

                </div>

                <button
                    type="button"
                    id="meta-currency-v82-toggle"
                    class="inactive"
                >
                    ○ DESATIVADO
                </button>

                <label id="meta-currency-v82-auto">

                    <input
                        id="meta-currency-v82-autostart"
                        type="checkbox"
                        ${autoStart ? 'checked' : ''}
                    >

                    <span id="meta-currency-v82-auto-text">

                        Iniciar automaticamente

                        <span id="meta-currency-v82-auto-description">

                            Ativa a conversão ao abrir o Ads Manager.

                        </span>

                    </span>

                </label>

                <div id="meta-currency-v82-info">

                    Arraste o cabeçalho para mover o painel.
                    <br>
                    Clique em − para transformar em círculo.

                </div>

            </div>

        `;

        document.body.appendChild(panel);

        applyPosition(panel);

        document
            .getElementById(
                'meta-currency-v82-minimize'
            )
            ?.addEventListener(
                'click',
                minimize
            );

        document
            .getElementById(
                'meta-currency-v82-toggle'
            )
            ?.addEventListener(
                'click',
                toggle
            );

        document
            .getElementById(
                'meta-currency-v82-apply'
            )
            ?.addEventListener(
                'click',
                applyRate
            );

        document
            .getElementById(
                'meta-currency-v82-rate'
            )
            ?.addEventListener(
                'keydown',
                function (event) {

                    if (
                        event.key === 'Enter'
                    ) {
                        applyRate();
                    }

                }
            );

        document
            .getElementById(
                'meta-currency-v82-autostart'
            )
            ?.addEventListener(
                'change',
                function (event) {

                    autoStart =
                        event.target.checked;

                    localStorage.setItem(
                        STORAGE.autoStart,
                        String(autoStart)
                    );

                }
            );

        makeDraggable(panel);

        updatePanel();

    }

    // ============================================================
    // INICIALIZAÇÃO
    // ============================================================

    function init() {

        /*
         * Proteção final antes de iniciar.
         */

        const currentPath =
            String(location.pathname || '').toLowerCase();

        if (
            currentPath === '/ads/library' ||
            currentPath.startsWith('/ads/library/')
        ) {
            return;
        }

        if (!document.body) {

            setTimeout(
                init,
                500
            );

            return;

        }

        createPanel();

        observer.observe(
            document.body,
            {
                childList: true,
                subtree: true,
                characterData: true,
                attributes: true,
                attributeFilter: [
                    'class',
                    'data-surface',
                    'aria-label',
                    'title'
                ]
            }
        );

        window.addEventListener(
            'scroll',
            handleScroll,
            {
                passive: true,
                capture: true
            }
        );

        startPeriodicScanner();

        if (autoStart) {

            enabled = true;

            updatePanel();

            setTimeout(
                processTable,
                300
            );

            setTimeout(
                processTable,
                1000
            );

            setTimeout(
                processTable,
                2500
            );

            setTimeout(
                processTable,
                5000
            );

        } else {

            enabled = false;

            updatePanel();

        }

        if (minimized) {

            setTimeout(
                minimize,
                150
            );

        }

        routeInterval =
            setInterval(
                monitorRoute,
                1000
            );

        console.log(
            `✅ Meta Ads Currency Converter V8.2 pronto | ` +
            `Status: ${enabled ? 'ATIVADO' : 'DESATIVADO'} | ` +
            `AutoStart: ${autoStart ? 'SIM' : 'NÃO'} | ` +
            `Câmbio: R$ ${exchangeRate.toFixed(2)}`
        );

    }

    // ============================================================
    // START
    // ============================================================

    setTimeout(
        init,
        1000
    );

})();
