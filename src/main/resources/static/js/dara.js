/**
 * DARA — Asistente de voz (Admin)
 * Fix principal: recognition se recrea en cada ciclo de escucha.
 * La Web Speech API deja la instancia en estado "zombie" después de abort/error;
 * recrearla es la única solución robusta cross-browser.
 */

const DARA = (() => {

    const STATE = { OFF:'off', IDLE:'idle', LISTENING:'listening', SPEAKING:'speaking' };
    let state  = STATE.OFF;
    let synth  = window.speechSynthesis;
    let vozSel = null;
    let SR     = null;   // clase SpeechRecognition guardada

    let flujoActivo = null;
    let paso        = 0;
    let datos       = {};

    let _bubbleTimer   = null;
    let _trTimer       = null;
    let _relistenTimer = null;
    let _recInstance   = null;   // instancia activa (se recrea cada vez)

    /* ─── ESTADO ─────────────────────────────────────── */
    function setState(next) {
        state = next;
        _renderEstado(next);
    }

    /* ─── INIT (solo una vez) ────────────────────────── */
    function init() {
        SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { console.warn('DARA: SpeechRecognition no disponible'); return; }
        _cargarVoz();
        if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = _cargarVoz;
        _renderUI();
    }

    /* ─── VOZ ────────────────────────────────────────── */
    function _cargarVoz() {
        const voces = synth.getVoices();
        const pref  = ['Microsoft Sabina','Microsoft Laura','Microsoft Helena',
                       'Google español','Paulina','Monica','Diego'];
        for (const n of pref) {
            const v = voces.find(v => v.name.includes(n) && v.lang.startsWith('es'));
            if (v) { vozSel = v; return; }
        }
        vozSel = voces.find(v => v.lang.startsWith('es')) || null;
    }

    /* ─── CREAR INSTANCIA FRESCA ─────────────────────── */
    function _newRecognition() {
        // Destruir instancia anterior limpiamente
        if (_recInstance) {
            try { _recInstance.onresult = null; _recInstance.onend = null;
                  _recInstance.onerror  = null; _recInstance.abort(); } catch(e) {}
            _recInstance = null;
        }

        const rec = new SR();
        rec.lang            = 'es-ES';
        rec.continuous      = false;
        rec.interimResults  = false;
        rec.maxAlternatives = 1;

        rec.onresult = (e) => {
            const texto = e.results[0][0].transcript.toLowerCase().trim();
            _mostrarTranscripcion(texto);
            // Pasar a IDLE antes de procesar para que _hablar pueda arrancar
            setState(STATE.IDLE);
            _procesarInput(texto);
        };

        rec.onend = () => {
            // Si seguimos en LISTENING es que no hubo resultado (silencio o corte)
            if (state === STATE.LISTENING) {
                setState(STATE.IDLE);
                _scheduleRelisten(400);
            }
            // Si ya pasamos a IDLE/SPEAKING (por onresult), no hacer nada aquí
        };

        rec.onerror = (e) => {
            if (e.error === 'no-speech') {
                setState(STATE.IDLE);
                _scheduleRelisten(350);
            } else if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                setState(STATE.OFF);
                _mostrarRespuesta('Sin permiso de micrófono. Revisa la configuración del navegador.');
            } else if (e.error !== 'aborted') {
                // network, audio-capture, etc. — reintentar después
                setState(STATE.IDLE);
                _scheduleRelisten(700);
            }
            // 'aborted' = lo abortamos nosotros a propósito, ignorar
        };

        _recInstance = rec;
        return rec;
    }

    /* ─── ESCUCHAR ───────────────────────────────────── */
    function _escuchar() {
        if (state !== STATE.IDLE) return;
        clearTimeout(_relistenTimer);
        const rec = _newRecognition();   // instancia fresca siempre
        try {
            rec.start();
            setState(STATE.LISTENING);
        } catch(e) {
            setState(STATE.IDLE);
            _scheduleRelisten(500);
        }
    }

    function _scheduleRelisten(ms) {
        clearTimeout(_relistenTimer);
        if (state === STATE.OFF) return;
        _relistenTimer = setTimeout(() => {
            if (state === STATE.IDLE) _escuchar();
        }, ms);
    }

    /* ─── HABLAR ─────────────────────────────────────── */
    function _hablar(texto, callbackDespues = null) {
        clearTimeout(_relistenTimer);
        // Abortar recognition activo antes de hablar
        if (_recInstance) {
            try { _recInstance.abort(); } catch(e) {}
        }
        synth.cancel();
        setState(STATE.SPEAKING);
        _mostrarRespuesta(texto);

        const u    = new SpeechSynthesisUtterance(texto);
        u.lang     = 'es-ES';
        u.rate     = 0.93;
        u.pitch    = 1.05;
        if (vozSel) u.voice = vozSel;

        u.onend = () => {
            if (state === STATE.OFF) return;
            setState(STATE.IDLE);
            if (callbackDespues) { callbackDespues(); return; }
            _scheduleRelisten(500);
        };
        u.onerror = () => {
            if (state === STATE.OFF) return;
            setState(STATE.IDLE);
            _scheduleRelisten(500);
        };

        synth.speak(u);
    }

    /* ─── ACTIVAR / DESACTIVAR ───────────────────────── */
    function activar() {
        setState(STATE.IDLE);
        document.getElementById('dara-btn')?.classList.add('active');
        _hablar('Sistema DARA activo. Di un comando o "ayuda" para ver opciones.');
    }

    function desactivar() {
        clearTimeout(_relistenTimer);
        if (_recInstance) {
            try { _recInstance.onresult = null; _recInstance.onend = null;
                  _recInstance.onerror  = null; _recInstance.abort(); } catch(e) {}
            _recInstance = null;
        }
        synth.cancel();
        _terminarFlujo();
        setState(STATE.OFF);
        document.getElementById('dara-btn')?.classList.remove('active');
        _mostrarRespuesta('DARA desactivada.');
        setTimeout(() => document.getElementById('dara-bubble')?.classList.remove('show'), 2500);
    }

    /* ─── COMANDOS ───────────────────────────────────── */
    function _procesarInput(texto) {
        if (flujoActivo) { FLUJOS[flujoActivo](texto); return; }

        if (/desactivar|cerrar|salir|apagar/.test(texto))               { desactivar(); return; }
        if (/dashboard|inicio/.test(texto))                              { showSection('dashboard'); _hablar('Mostrando el dashboard.'); return; }
        if (/inventario|monitoreo/.test(texto))                         { showSection('monitoring'); _hablar('Mostrando inventario.'); return; }
        if (/equipate|equipa te|pr[eé]stamos?\b(?!.*activo)/.test(texto)){ showSection('loans'); _hablar('Mostrando EquipaTE.'); return; }
        if (/historial/.test(texto))                                     { showSection('history'); _hablar('Mostrando historial.'); return; }
        if (/reportes?/.test(texto))                                     { showSection('reports'); _hablar('Mostrando reportes.'); return; }
        if (/notificaciones/.test(texto))                                { showSection('alexa'); _hablar('Mostrando notificaciones.'); return; }
        if (/registrar|nuevo equipo|alta/.test(texto))                   { _iniciarFlujo('registrarEquipo'); return; }
        if (/asignar/.test(texto))                                       { _iniciarFlujo('asignarEquipo'); return; }
        if (/disponible/.test(texto))                                    { _iniciarFlujo('consultarDisponibles'); return; }
        if (/asignaciones? activas?|en campo/.test(texto))               { _consultarPrestamosActivos(); return; }
        if (/pendientes?|reporte pendiente/.test(texto))                 { _consultarReportesPendientes(); return; }
        if (/ayuda|qu[eé] puedes/.test(texto)) {
            _hablar('Puedo registrar equipos, asignar equipos, consultar disponibles, ver asignaciones activas, reportes pendientes y navegar entre secciones. ¿Qué necesitas?');
            return;
        }
        _hablar('No entendí ese comando. Di ayuda para ver qué puedo hacer.');
    }

    /* ─── FLUJOS ─────────────────────────────────────── */
    function _iniciarFlujo(nombre) {
        flujoActivo = nombre; paso = 0; datos = {};
        FLUJOS[nombre](null);
    }
    function _terminarFlujo() {
        flujoActivo = null; paso = 0; datos = {};
    }
    function _preguntar(texto) { paso++; _hablar(texto); }

    const FLUJOS = {

        registrarEquipo(input) {
            const TIPOS = { laptop:'Laptop', monitor:'Monitor', mouse:'Mouse', teclado:'Teclado',
                            cpu:'CPU', 'audífonos':'Audífonos', audifonos:'Audífonos',
                            tablet:'Tablet', impresora:'Impresora' };
            if (input === null) {
                showSection('monitoring');
                _hablar('Vamos a registrar un nuevo equipo. ¿Cuál es el tipo? Laptop, Monitor, Mouse, Teclado, CPU, Audífonos, Tablet o Impresora.');
                paso = 1; return;
            }
            switch (paso) {
                case 1: {
                    const key = Object.keys(TIPOS).find(t => input.includes(t));
                    if (!key) { _hablar('No reconocí ese tipo. Di Laptop, Monitor, Mouse, Teclado o CPU.'); return; }
                    datos.tipo = TIPOS[key];
                    _preguntar(`Tipo ${datos.tipo} registrado. ¿Cuál es la marca?`); break;
                }
                case 2:
                    datos.marca = _cap(input.replace(/[^a-záéíóúüñ\s]/gi,'').trim());
                    _preguntar(`Marca ${datos.marca}. ¿Cuál es el modelo?`); break;
                case 3:
                    datos.modelo = _cap(input.trim());
                    _preguntar(`Modelo ${datos.modelo}. ¿Cómo se llama descriptivamente este equipo?`); break;
                case 4:
                    datos.nombre = _cap(input.trim());
                    _preguntar(`Listo. Voy a registrar un ${datos.tipo} ${datos.marca} ${datos.modelo}. ¿Confirmas? Di sí o no.`); break;
                case 5: {
                    if (/s[ií]|confirmo|correcto/.test(input)) {
                        const PREF = { Laptop:'LAP', Monitor:'MON', Mouse:'MOU', Teclado:'KEY',
                                       CPU:'CPU', 'Audífonos':'AUD', Tablet:'TAB', Impresora:'IMP' };
                        const prefix = PREF[datos.tipo] || 'EQ';
                        const mismo  = dbBase.equipos.filter(e => e.id.startsWith(prefix));
                        const newId  = nextId(prefix, mismo);
                        const hoy    = new Date().toISOString().split('T')[0];
                        dbBase.equipos.push({ id:newId, nombre:datos.nombre, marca:datos.marca,
                            modelo:datos.modelo, tipo:datos.tipo, serie:'' });
                        dbBase.eventos.push({ id:nextId('EVT',dbBase.eventos), equipoId:newId,
                            tipo:'alta', fecha:hoy, usuario:'', area:'Almacén', notas:'Alta por DARA' });
                        saveDB();
                        if (typeof syncDashboard  === 'function') syncDashboard();
                        if (typeof renderInventory === 'function') renderInventory();
                        _terminarFlujo();
                        _hablar(`Equipo ${newId} registrado exitosamente.`, () => openQrModal(newId));
                    } else {
                        _terminarFlujo();
                        _hablar('Registro cancelado. ¿En qué más puedo ayudarte?');
                    }
                    break;
                }
            }
        },

        asignarEquipo(input) {
            if (input === null) {
                showSection('loans');
                const disp = dbBase.equipos.filter(eq => getEstado(eq.id).estado === 'Disponible');
                if (!disp.length) { _terminarFlujo(); _hablar('No hay equipos disponibles en este momento.'); return; }
                const lista = disp.slice(0,5).map(e => e.id).join(', ');
                _hablar(`Equipos disponibles: ${lista}. ¿Cuál deseas asignar?`);
                paso = 1; return;
            }
            switch (paso) {
                case 1: {
                    const eq = dbBase.equipos.find(e => input.toUpperCase().includes(e.id));
                    if (!eq) { _hablar('No encontré ese equipo. Di el identificador, por ejemplo LAP-001.'); return; }
                    if (getEstado(eq.id).estado !== 'Disponible') { _hablar('Ese equipo no está disponible actualmente.'); return; }
                    datos.equipo = eq;
                    _preguntar(`Equipo ${eq.id} seleccionado. ¿A qué colaborador se lo asignamos?`); break;
                }
                case 2:
                    datos.colaborador = _cap(input.trim());
                    _preguntar(`Colaborador ${datos.colaborador}. ¿A qué célula pertenece?`); break;
                case 3:
                    datos.celula = _cap(input.trim());
                    _preguntar(`Asignando ${datos.equipo.id} a ${datos.colaborador} de la célula ${datos.celula}. ¿Confirmas?`); break;
                case 4: {
                    if (/s[ií]|confirmo|correcto/.test(input)) {
                        const hoy = new Date().toISOString().split('T')[0];
                        dbBase.eventos.push({ id:nextId('EVT',dbBase.eventos), equipoId:datos.equipo.id,
                            tipo:'asignacion', fecha:hoy, usuario:datos.colaborador, area:datos.celula,
                            notas:'Asignado por DARA' });
                        saveDB();
                        loans.push({ id:'LN-'+Date.now(), equipmentId:datos.equipo.id,
                            employee:datos.colaborador, warehousePerson:'DARA', conditionOut:'Bueno',
                            conditionIn:'', durationValue:null, durationUnit:'indefinido',
                            startDate:hoy, returnDate:'', status:'Activo',
                            notes:'Asignado por voz', area:datos.celula });
                        notifications.unshift({ id:'NT-'+Date.now(), type:'Préstamo',
                            message:`Asignación por DARA: ${datos.equipo.id} a ${datos.colaborador}`,
                            date:new Date().toLocaleString('es-MX'), read:false });
                        saveData();
                        if (typeof renderTables  === 'function') renderTables();
                        if (typeof syncDashboard === 'function') syncDashboard();
                        _terminarFlujo();
                        _hablar(`${datos.equipo.id} asignado a ${datos.colaborador} de la célula ${datos.celula} exitosamente. ¿Algo más?`);
                    } else {
                        _terminarFlujo();
                        _hablar('Asignación cancelada. ¿En qué más puedo ayudarte?');
                    }
                    break;
                }
            }
        },

        consultarDisponibles(input) {
            if (input === null) {
                _hablar('¿De qué categoría? Laptop, Monitor, Mouse, Teclado, CPU o todos.');
                paso = 1; return;
            }
            const TIPOS = { laptop:'Laptop', monitor:'Monitor', mouse:'Mouse', teclado:'Teclado',
                            cpu:'CPU', audifonos:'Audífonos', 'audífonos':'Audífonos',
                            tablet:'Tablet', todos:null, todo:null };
            const key  = Object.keys(TIPOS).find(t => input.includes(t));
            if (!key) { _hablar('No reconocí esa categoría. Di Laptop, Monitor o todos.'); return; }
            const tipo = TIPOS[key];
            const fil  = eq => !tipo || eq.tipo === tipo;
            const disp = dbBase.equipos.filter(eq => getEstado(eq.id).estado === 'Disponible'       && fil(eq));
            const asig = dbBase.equipos.filter(eq => getEstado(eq.id).estado === 'Asignado'         && fil(eq));
            const mant = dbBase.equipos.filter(eq => getEstado(eq.id).estado === 'En Mantenimiento' && fil(eq));
            let r = tipo ? `Para ${tipo}: ` : 'En total: ';
            r += `${disp.length} disponible${disp.length !== 1 ? 's' : ''}`;
            if (asig.length) r += `, ${asig.length} asignado${asig.length !== 1 ? 's' : ''}`;
            if (mant.length) r += `, ${mant.length} en mantenimiento`;
            if (disp.length) r += `. Disponibles: ${disp.map(e => e.id).join(', ')}`;
            _terminarFlujo();
            _hablar(r);
        }
    };

    function _consultarPrestamosActivos() {
        const activos = loans.filter(l => l.status === 'Activo');
        if (!activos.length) { _hablar('No hay asignaciones activas en este momento.'); return; }
        const lista = activos.slice(0,4).map(l => `${l.equipmentId} asignado a ${l.employee}${l.area ? ' de la célula ' + l.area : ''}`).join('. ');
        _hablar(`Hay ${activos.length} asignación${activos.length !== 1 ? 'es' : ''} activa${activos.length !== 1 ? 's' : ''}: ${lista}.`);
    }

    function _consultarReportesPendientes() {
        const pend = reports.filter(r => r.status === 'Pendiente');
        if (!pend.length) { _hablar('No hay reportes pendientes.'); return; }
        const lista = pend.slice(0,3).map(r => `${r.equipmentId} por ${r.reporter}`).join(', ');
        _hablar(`Hay ${pend.length} reporte${pend.length !== 1 ? 's' : ''} pendiente${pend.length !== 1 ? 's' : ''}: ${lista}.`);
    }

    function _cap(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : str; }

    /* ─── UI ─────────────────────────────────────────── */
    function _renderUI() {
        const el = document.createElement('div');
        el.id = 'dara-widget';
        el.innerHTML = `
        <style>
            #dara-widget {
                position:fixed; bottom:28px; right:28px; z-index:9999;
                display:flex; flex-direction:column; align-items:flex-end; gap:10px;
                font-family:'Inter',sans-serif;
            }
            #dara-transcript {
                background:#EFF6FF; border:1px solid #BFDBFE;
                border-radius:12px 12px 12px 4px; padding:7px 12px;
                max-width:270px; font-size:11px; color:#1D4ED8; font-style:italic;
                opacity:0; transform:translateY(4px); transition:opacity .2s,transform .2s;
                pointer-events:none;
            }
            #dara-transcript.show { opacity:1; transform:none; }
            #dara-bubble {
                background:#fff; border:1px solid #E2E8F0;
                border-radius:14px 14px 4px 14px; padding:12px 15px;
                max-width:270px; font-size:12.5px; color:#334155;
                box-shadow:0 8px 24px rgba(0,31,63,.12); line-height:1.55;
                opacity:0; transform:translateY(4px); transition:opacity .25s,transform .25s;
                pointer-events:none;
            }
            #dara-bubble.show { opacity:1; transform:none; }
            #dara-bubble-label {
                font-size:9px; font-weight:800; color:#001f3f;
                letter-spacing:1.5px; margin-bottom:5px; display:block;
            }
            #dara-btn {
                width:58px; height:58px; border-radius:50%;
                background:#001f3f; border:3px solid rgba(255,255,255,.15);
                cursor:pointer; display:flex; align-items:center; justify-content:center;
                box-shadow:0 4px 18px rgba(0,31,63,.45); transition:transform .2s,box-shadow .2s;
                position:relative; outline:none; padding:0;
            }
            #dara-btn:hover { transform:scale(1.07); box-shadow:0 6px 26px rgba(0,31,63,.55); }
            #dara-btn.active    { border-color:rgba(255,255,255,.35); }
            #dara-btn.listening { background:#DC2626; }
            #dara-btn.speaking  { background:#059669; }
            #dara-name {
                position:absolute; top:-10px; left:50%; transform:translateX(-50%);
                background:#001f3f; color:#fff; font-size:8px; font-weight:800;
                letter-spacing:2px; padding:2px 8px; border-radius:5px;
                white-space:nowrap; border:1px solid rgba(255,255,255,.2);
            }
            #dara-icon { font-size:22px; line-height:1; user-select:none; }
            #dara-waves, #dara-pulse-ring {
                position:absolute; inset:-5px; border-radius:50%;
                border:2px solid rgba(255,255,255,.35); opacity:0;
                animation:dara-wave 1.3s ease-out infinite;
            }
            #dara-pulse-ring { animation-delay:.45s; }
            #dara-btn.listening #dara-waves, #dara-btn.speaking #dara-waves,
            #dara-btn.listening #dara-pulse-ring, #dara-btn.speaking #dara-pulse-ring { opacity:1; }
            @keyframes dara-wave {
                0%   { transform:scale(1); opacity:.55; }
                100% { transform:scale(1.65); opacity:0; }
            }
        </style>
        <div id="dara-transcript"></div>
        <div id="dara-bubble">
            <span id="dara-bubble-label">DARA · ADMIN</span>
            <span id="dara-text">Presiona para activarme</span>
        </div>
        <button id="dara-btn" title="Activar / Desactivar DARA">
            <div id="dara-name">DARA</div>
            <div id="dara-waves"></div>
            <div id="dara-pulse-ring"></div>
            <span id="dara-icon">🤖</span>
        </button>`;
        document.body.appendChild(el);
        document.getElementById('dara-btn').onclick = () =>
            state === STATE.OFF ? activar() : desactivar();
        setTimeout(() => _mostrarRespuesta('Presiona para activarme'), 1500);
    }

    function _renderEstado(s) {
        const btn  = document.getElementById('dara-btn');
        const icon = document.getElementById('dara-icon');
        if (!btn) return;
        btn.className = '';
        switch (s) {
            case STATE.LISTENING: btn.classList.add('listening'); icon.textContent = '👂'; break;
            case STATE.SPEAKING:  btn.classList.add('speaking');  icon.textContent = '💬'; break;
            case STATE.IDLE:      btn.classList.add('active');    icon.textContent = '🎙️'; break;
            case STATE.OFF:                                        icon.textContent = '🤖'; break;
        }
    }

    function _mostrarRespuesta(texto) {
        const bubble = document.getElementById('dara-bubble');
        const t      = document.getElementById('dara-text');
        if (!bubble || !t) return;
        t.textContent = texto;
        bubble.classList.add('show');
        clearTimeout(_bubbleTimer);
        _bubbleTimer = setTimeout(() => bubble.classList.remove('show'), 7500);
    }

    function _mostrarTranscripcion(texto) {
        const tr = document.getElementById('dara-transcript');
        if (!tr) return;
        tr.textContent = `"${texto}"`;
        tr.classList.add('show');
        clearTimeout(_trTimer);
        _trTimer = setTimeout(() => tr.classList.remove('show'), 3500);
    }

    return { init, activar, desactivar };

})();

if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', () => DARA.init());
else
    DARA.init();