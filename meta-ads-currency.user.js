// ==UserScript==
// @name         Meta Ads — Conversor USD ↔ BRL
// @namespace    meta-ads-currency
// @version      7.3.0
// @description  Conversor de moedas para o Meta Ads Manager
// @author       João
// @match        https://www.facebook.com/*
// @match        https://business.facebook.com/*
// @match        https://adsmanager.facebook.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {

    'use strict';

    console.log('🚀 Meta Ads Currency Converter V7.3 iniciado');


    // ============================================================
    // CONFIGURAÇÕES
    // ============================================================

    const STORAGE = {

        rate:
            'meta_currency_rate',

        autoStart:
            'meta_currency_autostart',

        minimized:
            'meta_currency_minimized',

        position:
            'meta_currency_position'

    };


    const DEFAULT_RATE = 5.40;


    const CONVERTED_ATTR =
        'data-meta-currency-converted';

    const ORIGINAL_ATTR =
        'data-meta-currency-original';

    const VALUE_ATTR =
        'data-meta-currency-value';

    const ORIGINAL_TITLE_ATTR =
        'data-meta-currency-original-title';


    const PANEL_ID =
        'meta-currency-v7-panel';

    const MINI_ID =
        'meta-currency-v7-mini';


    // ============================================================
    // ESTADO
    // ============================================================

    let exchangeRate =
        parseFloat(
            localStorage.getItem(
                STORAGE.rate
            )
        ) || DEFAULT_RATE;


    /*
     * AutoStart é a única preferência responsável
     * por determinar se o conversor inicia ligado.
     *
     * AutoStart = true
     *     → abre o Ads Manager com conversão ativa.
     *
     * AutoStart = false
     *     → abre o Ads Manager com conversão desativada.
     *
     * O estado manual NÃO é persistido entre sessões.
     */

    let autoStart =
        localStorage.getItem(
            STORAGE.autoStart
        ) === 'true';


    let enabled =
        autoStart;


    let minimized =
        localStorage.getItem(
            STORAGE.minimized
        ) === 'true';


    // ============================================================
    // POSIÇÃO
    // ============================================================

    let position = null;


    try {

        position =
            JSON.parse(
                localStorage.getItem(
                    STORAGE.position
                )
            );

    } catch (error) {

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
    // CONTROLE INTERNO
    // ============================================================

    let processing = false;

    let observerTimer = null;

    let periodicTimer = null;


    // ============================================================
    // ESTILO
    // ============================================================

    const style =
        document.createElement(
            'style'
        );


    style.textContent = `

        #${PANEL_ID} {

            position: fixed;

            width: 270px;

            z-index: 2147483647;

            background: #ffffff;

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

            transition:
                box-shadow .15s ease;

        }


        #${PANEL_ID}:hover {

            box-shadow:
                0 15px 42px rgba(0,0,0,.23),
                0 4px 12px rgba(0,0,0,.10);

        }


        #meta-currency-v7-header {

            height: 50px;

            display: flex;

            align-items: center;

            justify-content: space-between;

            padding:
                0 10px 0 14px;

            background:
                linear-gradient(
                    135deg,
                    #1877f2,
                    #0866ff
                );

            color: white;

            cursor: move;

        }


        #meta-currency-v7-title {

            display: flex;

            align-items: center;

            gap: 9px;

            font-size: 15px;

            font-weight: 700;

        }


        #meta-currency-v7-icon {

            width: 29px;

            height: 29px;

            border-radius: 8px;

            display: flex;

            align-items: center;

            justify-content: center;

            background:
                rgba(255,255,255,.18);

            font-size: 16px;

            font-weight: 800;

        }


        #meta-currency-v7-actions {

            display: flex;

            align-items: center;

            gap: 3px;

        }


        .meta-currency-v7-action {

            width: 29px;

            height: 29px;

            border: 0;

            border-radius: 7px;

            background: transparent;

            color: white;

            cursor: pointer;

            font-size: 19px;

            display: flex;

            align-items: center;

            justify-content: center;

        }


        .meta-currency-v7-action:hover {

            background:
                rgba(255,255,255,.18);

        }


        #meta-currency-v7-body {

            padding: 16px;

        }


        #meta-currency-v7-main {

            margin-bottom: 15px;

        }


        #meta-currency-v7-mode {

            font-size: 15px;

            font-weight: 750;

            line-height: 1.3;

        }


        #meta-currency-v7-status {

            display: inline-flex;

            align-items: center;

            gap: 6px;

            margin-top: 5px;

            font-size: 12px;

            font-weight: 650;

            color: #65676b;

        }


        #meta-currency-v7-dot {

            width: 8px;

            height: 8px;

            border-radius: 50%;

            background: #31a24c;

            box-shadow:
                0 0 0 3px rgba(49,162,76,.12);

        }


        #meta-currency-v7-dot.off {

            background: #999;

            box-shadow:
                0 0 0 3px rgba(153,153,153,.12);

        }


        #meta-currency-v7-rate-label {

            display: block;

            font-size: 12px;

            font-weight: 600;

            color: #65676b;

            margin-bottom: 6px;

        }


        #meta-currency-v7-rate-row {

            display: flex;

            gap: 7px;

        }


        #meta-currency-v7-rate {

            flex: 1;

            height: 38px;

            box-sizing: border-box;

            border: 1px solid #ccd0d5;

            border-radius: 8px;

            padding: 0 10px;

            font-size: 15px;

            outline: none;

            color: #1c1e21;

        }


        #meta-currency-v7-rate:focus {

            border-color: #1877f2;

            box-shadow:
                0 0 0 2px rgba(24,119,242,.14);

        }


        #meta-currency-v7-apply {

            height: 38px;

            padding: 0 13px;

            border: 0;

            border-radius: 8px;

            background: #1877f2;

            color: white;

            font-size: 13px;

            font-weight: 700;

            cursor: pointer;

        }


        #meta-currency-v7-apply:hover {

            background: #166fe5;

        }


        #meta-currency-v7-toggle {

            width: 100%;

            height: 40px;

            margin-top: 13px;

            border: 0;

            border-radius: 9px;

            color: white;

            font-size: 14px;

            font-weight: 750;

            cursor: pointer;

            transition:
                opacity .15s ease,
                transform .1s ease;

        }


        #meta-currency-v7-toggle:active {

            transform: scale(.985);

        }


        #meta-currency-v7-toggle.active {

            background: #31a24c;

        }


        #meta-currency-v7-toggle.inactive {

            background: #65676b;

        }


        #meta-currency-v7-auto {

            display: flex;

            align-items: center;

            gap: 9px;

            margin-top: 14px;

            padding: 10px;

            border-radius: 9px;

            background: #f5f6f7;

            cursor: pointer;

        }


        #meta-currency-v7-auto input {

            width: 16px;

            height: 16px;

            margin: 0;

            cursor: pointer;

            accent-color: #1877f2;

        }


        #meta-currency-v7-auto-text {

            font-size: 13px;

            font-weight: 600;

            color: #1c1e21;

            line-height: 1.25;

        }


        #meta-currency-v7-auto-description {

            display: block;

            margin-top: 2px;

            font-size: 10px;

            font-weight: 400;

            color: #65676b;

        }


        #meta-currency-v7-info {

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

            color: white;

            box-shadow:
                0 6px 20px rgba(0,0,0,.25);

            cursor: pointer;

            font-size: 21px;

            font-weight: 800;

            display: flex;

            align-items: center;

            justify-content: center;

            transition:
                transform .15s ease;

        }


        #${MINI_ID}:hover {

            transform: scale(1.07);

        }

    `;


    if (document.head) {

        document.head.appendChild(style);

    }


    // ============================================================
    // CRIAR PAINEL
    // ============================================================

    function createPanel() {

        if (
            document.getElementById(
                PANEL_ID
            )
        ) {

            return;

        }


        const panel =
            document.createElement(
                'div'
            );


        panel.id =
            PANEL_ID;


        panel.innerHTML = `

            <div id="meta-currency-v7-header">

                <div id="meta-currency-v7-title">

                    <div id="meta-currency-v7-icon">
                        $
                    </div>

                    <span>
                        Meta Currency
                    </span>

                </div>


                <div id="meta-currency-v7-actions">

                    <button
                        type="button"
                        class="meta-currency-v7-action"
                        id="meta-currency-v7-minimize"
                        title="Minimizar"
                    >
                        −
                    </button>

                </div>

            </div>


            <div id="meta-currency-v7-body">

                <div id="meta-currency-v7-main">

                    <div id="meta-currency-v7-mode">
                        Transformar para USD
                    </div>


                    <div id="meta-currency-v7-status">

                        <span
                            id="meta-currency-v7-dot"
                            class="off"
                        ></span>

                        <span
                            id="meta-currency-v7-status-text"
                        >
                            DESATIVADO
                        </span>

                    </div>

                </div>


                <label
                    id="meta-currency-v7-rate-label"
                    for="meta-currency-v7-rate"
                >
                    Cotação do dólar
                </label>


                <div id="meta-currency-v7-rate-row">

                    <input
                        id="meta-currency-v7-rate"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value="${exchangeRate.toFixed(2)}"
                    />


                    <button
                        type="button"
                        id="meta-currency-v7-apply"
                    >
                        Aplicar
                    </button>

                </div>


                <button
                    type="button"
                    id="meta-currency-v7-toggle"
                    class="inactive"
                >
                    ○ DESATIVADO
                </button>


                <label id="meta-currency-v7-auto">

                    <input
                        id="meta-currency-v7-autostart"
                        type="checkbox"
                        ${autoStart ? 'checked' : ''}
                    >


                    <span id="meta-currency-v7-auto-text">

                        Iniciar automaticamente

                        <span id="meta-currency-v7-auto-description">

                            Ativa a conversão ao abrir o Ads Manager.

                        </span>

                    </span>

                </label>


                <div id="meta-currency-v7-info">

                    Arraste o cabeçalho para mover o painel.
                    <br>
                    Clique em − para transformar em círculo.

                </div>

            </div>

        `;


        document.body.appendChild(panel);


        applyPosition(panel);


        const minimizeButton =
            document.getElementById(
                'meta-currency-v7-minimize'
            );


        if (minimizeButton) {

            minimizeButton.addEventListener(
                'click',
                minimize
            );

        }


        const toggleButton =
            document.getElementById(
                'meta-currency-v7-toggle'
            );


        if (toggleButton) {

            toggleButton.addEventListener(
                'click',
                toggle
            );

        }


        const applyButton =
            document.getElementById(
                'meta-currency-v7-apply'
            );


        if (applyButton) {

            applyButton.addEventListener(
                'click',
                applyRate
            );

        }


        const rateInput =
            document.getElementById(
                'meta-currency-v7-rate'
            );


        if (rateInput) {

            rateInput.addEventListener(
                'keydown',
                function (event) {

                    if (
                        event.key === 'Enter'
                    ) {

                        applyRate();

                    }

                }
            );

        }


        const autoStartInput =
            document.getElementById(
                'meta-currency-v7-autostart'
            );


        if (autoStartInput) {

            autoStartInput.addEventListener(
                'change',
                function (event) {

                    autoStart =
                        event.target.checked;


                    localStorage.setItem(
                        STORAGE.autoStart,
                        String(autoStart)
                    );


                    console.log(
                        `⚙️ AutoStart: ${
                            autoStart
                                ? 'ATIVADO'
                                : 'DESATIVADO'
                        }`
                    );

                }
            );

        }


        makeDraggable(panel);

        updatePanel();

    }


    // ============================================================
    // POSIÇÃO
    // ============================================================

    function applyPosition(element) {

        if (!element) {

            return;

        }


        element.style.top =
            position.top + 'px';


        element.style.right =
            position.right + 'px';


        element.style.left =
            'auto';


        element.style.bottom =
            'auto';

    }


    // ============================================================
    // ARRASTAR PAINEL
    // ============================================================

    function makeDraggable(panel) {

        const header =
            document.getElementById(
                'meta-currency-v7-header'
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
                    event.target.closest(
                        'button'
                    )
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


                const deltaX =
                    event.clientX -
                    startX;


                const deltaY =
                    event.clientY -
                    startY;


                let newTop =
                    startTop +
                    deltaY;


                let newRight =
                    startRight -
                    deltaX;


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


                newTop =
                    Math.max(
                        5,
                        Math.min(
                            newTop,
                            maxTop
                        )
                    );


                newRight =
                    Math.max(
                        5,
                        Math.min(
                            newRight,
                            maxRight
                        )
                    );


                panel.style.top =
                    newTop + 'px';


                panel.style.right =
                    newRight + 'px';

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
    // SALVAR POSIÇÃO
    // ============================================================

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


    // ============================================================
    // MINIMIZAR
    // ============================================================

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


    // ============================================================
    // CRIAR CÍRCULO
    // ============================================================

    function createMiniButton() {

        if (
            document.getElementById(
                MINI_ID
            )
        ) {

            return;

        }


        const mini =
            document.createElement(
                'button'
            );


        mini.id =
            MINI_ID;


        mini.type =
            'button';


        mini.textContent =
            '$';


        mini.title =
            'Abrir Meta Currency';


        mini.style.top =
            position.top + 'px';


        mini.style.right =
            position.right + 'px';


        mini.dataset.moved =
            'false';


        document.body.appendChild(
            mini
        );


        makeMiniDraggable(
            mini
        );


        mini.addEventListener(
            'click',
            function () {

                if (
                    mini.dataset.moved ===
                    'true'
                ) {

                    mini.dataset.moved =
                        'false';

                    return;

                }


                restore();

            }
        );

    }


    // ============================================================
    // RESTAURAR PAINEL
    // ============================================================

    function restore() {

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

            applyPosition(
                panel
            );

        }

    }


    // ============================================================
    // ARRASTAR CÍRCULO
    // ============================================================

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


                const deltaX =
                    event.clientX -
                    startX;


                const deltaY =
                    event.clientY -
                    startY;


                if (
                    Math.abs(deltaX) > 3 ||
                    Math.abs(deltaY) > 3
                ) {

                    moved = true;

                    mini.dataset.moved =
                        'true';

                }


                let newTop =
                    startTop +
                    deltaY;


                let newRight =
                    startRight -
                    deltaX;


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


                newTop =
                    Math.max(
                        5,
                        Math.min(
                            newTop,
                            maxTop
                        )
                    );


                newRight =
                    Math.max(
                        5,
                        Math.min(
                            newRight,
                            maxRight
                        )
                    );


                mini.style.top =
                    newTop + 'px';


                mini.style.right =
                    newRight + 'px';

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

                    savePosition(
                        mini
                    );

                }

            }
        );

    }


    // ============================================================
    // TOGGLE PRINCIPAL
    // ============================================================

    function toggle() {

        enabled =
            !enabled;


        updatePanel();


        if (enabled) {

            processTable();

        } else {

            restoreOriginalValues();

        }

    }


    // ============================================================
    // ATUALIZAR PAINEL
    // ============================================================

    function updatePanel() {

        const status =
            document.getElementById(
                'meta-currency-v7-status-text'
            );


        const dot =
            document.getElementById(
                'meta-currency-v7-dot'
            );


        const button =
            document.getElementById(
                'meta-currency-v7-toggle'
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


            dot.classList.remove(
                'off'
            );


            button.textContent =
                '✓ ATIVADO';


            button.className =
                'active';

        } else {

            status.textContent =
                'DESATIVADO';


            dot.classList.add(
                'off'
            );


            button.textContent =
                '○ DESATIVADO';


            button.className =
                'inactive';

        }

    }


    // ============================================================
    // APLICAR COTAÇÃO
    // ============================================================

    function applyRate() {

        const input =
            document.getElementById(
                'meta-currency-v7-rate'
            );


        if (!input) {

            return;

        }


        const value =
            parseFloat(
                input.value
            );


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

            processTable();

        }

    }


    // ============================================================
    // RESTAURAR VALORES ORIGINAIS
    // ============================================================

    function restoreOriginalValues() {

        const converted =
            document.querySelectorAll(
                '[' +
                ORIGINAL_ATTR +
                ']'
            );


        converted.forEach(
            element => {

                const original =
                    element.getAttribute(
                        ORIGINAL_ATTR
                    );


                if (
                    original !== null
                ) {

                    element.textContent =
                        original;

                }


                /*
                 * Restaura o title original, caso existisse.
                 */

                const originalTitle =
                    element.getAttribute(
                        ORIGINAL_TITLE_ATTR
                    );


                if (
                    originalTitle !== null
                ) {

                    element.setAttribute(
                        'title',
                        originalTitle
                    );

                } else {

                    element.removeAttribute(
                        'title'
                    );

                }


                element.removeAttribute(
                    ORIGINAL_ATTR
                );


                element.removeAttribute(
                    ORIGINAL_TITLE_ATTR
                );


                element.removeAttribute(
                    CONVERTED_ATTR
                );


                element.removeAttribute(
                    VALUE_ATTR
                );

            }
        );

    }


    // ============================================================
    // IDENTIFICAR MÉTRICA MONETÁRIA
    // ============================================================

    function isMoneyCell(surface) {

        if (!surface) {

            return false;

        }


        const s =
            surface.toLowerCase();


        // ========================================================
        // EXCLUSÕES
        // ========================================================

        if (
            s.includes('purchase_roas') ||
            s.includes('roas')
        ) {

            return false;

        }


        // ========================================================
        // SPEND
        // ========================================================

        if (
            s.includes(':spend')
        ) {

            return true;

        }


        // ========================================================
        // CPM
        // ========================================================

        if (
            s.includes(':cpm')
        ) {

            return true;

        }


        // ========================================================
        // CPC / LINK CLICK
        // ========================================================

        if (
            s.includes(
                'cost_per_action_type:link_click'
            )
        ) {

            return true;

        }


        // ========================================================
        // COST PER RESULT
        // ========================================================

        if (
            s.includes('cost_per_result')
        ) {

            return true;

        }


        // ========================================================
        // INITIATE CHECKOUT
        // ========================================================

        if (
            s.includes(
                'cost_per_action_type:initiate_checkout'
            )
        ) {

            return true;

        }


        // ========================================================
        // PURCHASE
        // ========================================================

        if (
            s.includes(
                'cost_per_action_type:purchase'
            )
        ) {

            return true;

        }


        // ========================================================
        // OFFSITE CONVERSION
        // ========================================================

        if (
            s.includes(
                'cost_per_action_type:offsite_conversion'
            )
        ) {

            return true;

        }


        // ========================================================
        // OUTROS COST PER ACTION
        // ========================================================

        if (
            s.includes(
                'cost_per_action_type'
            )
        ) {

            return true;

        }


        // ========================================================
        // ORÇAMENTO
        // ========================================================

        if (
            s.includes(
                'forobjecttype(budget'
            )
        ) {

            return true;

        }


        return false;

    }


    // ============================================================
    // REGEX DE VALOR BRL
    // ============================================================

    const BRL_REGEX =
        /^R\$\s*[\d.]+(?:,\d+)?$/;


    // ============================================================
    // ELEMENTOS EDITÁVEIS
    // ============================================================

    function isEditableElement(element) {

        if (!element) {

            return false;

        }


        const tag =
            element.tagName
                ? element.tagName.toLowerCase()
                : '';


        if (
            tag === 'input' ||
            tag === 'textarea' ||
            tag === 'select'
        ) {

            return true;

        }


        if (
            element.isContentEditable
        ) {

            return true;

        }


        return false;

    }


    // ============================================================
    // LOCALIZAR ELEMENTO MONETÁRIO
    // ============================================================

    function findMoneyElement(cell) {

        if (!cell) {

            return null;

        }


        /*
         * Primeiro verificamos se a própria célula
         * possui um elemento já convertido.
         */

        const alreadyConverted =
            cell.querySelector(
                '[' +
                ORIGINAL_ATTR +
                ']'
            );


        if (alreadyConverted) {

            return alreadyConverted;

        }


        const elements =
            cell.querySelectorAll(
                'span, div'
            );


        const candidates = [];


        for (
            const element of elements
        ) {

            if (
                element.closest(
                    `#${PANEL_ID}, #${MINI_ID}`
                )
            ) {

                continue;

            }


            if (
                !element.isConnected
            ) {

                continue;

            }


            if (
                isEditableElement(element)
            ) {

                continue;

            }


            const text =
                element.textContent.trim();


            if (
                !BRL_REGEX.test(text)
            ) {

                continue;

            }


            /*
             * Se possui um filho contendo
             * exatamente o mesmo valor,
             * é um container e não o alvo.
             */

            let hasExactChild =
                false;


            for (
                const child of element.children
            ) {

                if (
                    isEditableElement(child)
                ) {

                    continue;

                }


                if (
                    BRL_REGEX.test(
                        child.textContent.trim()
                    )
                ) {

                    hasExactChild = true;

                    break;

                }

            }


            if (
                hasExactChild
            ) {

                continue;

            }


            candidates.push(
                element
            );

        }


        if (
            candidates.length === 0
        ) {

            return null;

        }


        /*
         * Priorizamos o elemento mais profundo.
         *
         * Em caso de empate, preferimos o menor
         * conteúdo textual.
         */

        candidates.sort(
            function (a, b) {

                const depthA =
                    getElementDepth(a);

                const depthB =
                    getElementDepth(b);


                if (
                    depthA !== depthB
                ) {

                    return depthB - depthA;

                }


                return (
                    a.textContent.length -
                    b.textContent.length
                );

            }
        );


        return candidates[0] || null;

    }


    // ============================================================
    // PROFUNDIDADE DO ELEMENTO
    // ============================================================

    function getElementDepth(element) {

        let depth = 0;

        let current =
            element;


        while (
            current &&
            current.parentElement
        ) {

            depth++;

            current =
                current.parentElement;

        }


        return depth;

    }


    // ============================================================
    // PARSE BRL
    // ============================================================

    function parseBRL(text) {

        if (!text) {

            return null;

        }


        const match =
            text.match(
                /R\$\s*([\d.]+(?:,\d+)?)/i
            );


        if (!match) {

            return null;

        }


        const number =
            parseFloat(
                match[1]
                    .replace(
                        /\./g,
                        ''
                    )
                    .replace(
                        ',',
                        '.'
                    )
            );


        return Number.isFinite(number)
            ? number
            : null;

    }


    // ============================================================
    // FORMATAR USD
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
    // PROCESSAR TABELA
    // ============================================================

    function processTable() {

        if (
            !enabled ||
            processing
        ) {

            return;

        }


        processing = true;


        try {

            const cells =
                document.querySelectorAll(
                    '[data-surface]'
                );


            let processed = 0;


            cells.forEach(
                cell => {

                    const surface =
                        cell.getAttribute(
                            'data-surface'
                        );


                    if (
                        !isMoneyCell(
                            surface
                        )
                    ) {

                        return;

                    }


                    /*
                     * Evita conversão duplicada.
                     */

                    const alreadyConverted =
                        cell.querySelector(
                            '[' +
                            ORIGINAL_ATTR +
                            ']'
                        );


                    if (
                        alreadyConverted
                    ) {

                        return;

                    }


                    const target =
                        findMoneyElement(
                            cell
                        );


                    if (!target) {

                        return;

                    }


                    const original =
                        target.textContent.trim();


                    const brl =
                        parseBRL(
                            original
                        );


                    if (
                        brl === null
                    ) {

                        return;

                    }


                    if (
                        !Number.isFinite(brl) ||
                        brl < 0
                    ) {

                        return;

                    }


                    if (
                        !Number.isFinite(exchangeRate) ||
                        exchangeRate <= 0
                    ) {

                        return;

                    }


                    const usd =
                        brl /
                        exchangeRate;


                    if (
                        !Number.isFinite(usd)
                    ) {

                        return;

                    }


                    /*
                     * Salvar o conteúdo original.
                     */

                    target.setAttribute(
                        ORIGINAL_ATTR,
                        original
                    );


                    /*
                     * Salvar o valor numérico original.
                     */

                    target.setAttribute(
                        VALUE_ATTR,
                        brl.toString()
                    );


                    /*
                     * Salvar o title original.
                     *
                     * Se não existir, usamos marcador
                     * vazio para saber que precisamos
                     * removê-lo na restauração.
                     */

                    if (
                        target.hasAttribute('title')
                    ) {

                        target.setAttribute(
                            ORIGINAL_TITLE_ATTR,
                            target.getAttribute('title') || ''
                        );

                    } else {

                        target.setAttribute(
                            ORIGINAL_TITLE_ATTR,
                            ''
                        );

                    }


                    target.setAttribute(
                        CONVERTED_ATTR,
                        '1'
                    );


                    /*
                     * Substituição direta.
                     *
                     * Não adicionamos elementos extras
                     * dentro da célula.
                     */

                    target.textContent =
                        formatUSD(
                            usd
                        );


                    target.title =
                        `${original} → ${formatUSD(usd)} | Câmbio R$ ${exchangeRate.toFixed(2)}`;


                    processed++;

                }
            );


            if (
                processed > 0
            ) {

                console.log(
                    `💵 ${processed} valores convertidos para USD`
                );

            }

        } catch (error) {

            console.warn(
                'Meta Currency:',
                error
            );

        } finally {

            processing = false;

        }

    }


    // ============================================================
    // MUTATION OBSERVER
    // ============================================================

    const observer =
        new MutationObserver(
            function () {

                if (!enabled) {

                    return;

                }


                clearTimeout(
                    observerTimer
                );


                observerTimer =
                    setTimeout(
                        processTable,
                        120
                    );

            }
        );


    // ============================================================
    // SCANNER PERIÓDICO
    // ============================================================

    function startPeriodicScanner() {

        clearInterval(
            periodicTimer
        );


        periodicTimer =
            setInterval(
                function () {

                    if (
                        enabled
                    ) {

                        processTable();

                    }

                },
                700
            );

    }


    // ============================================================
    // INICIALIZAÇÃO
    // ============================================================

    function init() {

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
                subtree: true
            }
        );


        startPeriodicScanner();


        // ========================================================
        // AUTO START
        // ========================================================

        if (autoStart) {

            enabled = true;


            updatePanel();


            setTimeout(
                processTable,
                500
            );

        } else {

            enabled = false;


            updatePanel();

        }


        // ========================================================
        // RESTAURAR MINIMIZAÇÃO
        // ========================================================

        if (minimized) {

            setTimeout(
                minimize,
                150
            );

        }


        console.log(
            `✅ Meta Ads Currency Converter V7.3 pronto | ` +
            `${enabled ? 'ATIVADO' : 'DESATIVADO'} | ` +
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
