/**
 * DARA USER — Asistente de voz (Colaborador)
 * Fix principal: recognition se recrea en cada ciclo de escucha.
 */

const DARA_USER = (() => {

    const STATE = { OFF:'off', IDLE:'idle', LISTENING:'listening', SPEAKING:'speaking' };
    let state  = STATE.OFF;
    let synth  = window.speechSynthesis;
    let vozSel = null;
    let SR     = null;

    let flujoActivo = null;
    let paso        = 0;
    let datos       = {};

    let _bubbleTimer   = null;
    let _trTimer       = null;
    let _relistenTimer = null;
    let _recInstance   = null;

    function setState(next) { state = next; _renderEstado(next); }

    /* ─── INIT ───────────────────────────────────────── */
    function init() {
        SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { console.warn('DARA USER: SpeechRecognition no disponible'); return; }
        _cargarVoz();
        if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = _cargarVoz;
        _renderUI();
    }

    function _cargarVoz() {
        const voces = synth.getVoices();
        const pref  = ['Microsoft Sabina','Microsoft Laura','Microsoft Helena',
                       'Google español','Paulina','Monica'];
        for (const n of pref) {
            const v = voces.find(v => v.name.includes(n) && v.lang.startsWith('es'));
            if (v) { vozSel = v; return; }
        }
        vozSel = voces.find(v => v.lang.startsWith('es')) || null;
    }

    /* ─── CREAR INSTANCIA FRESCA ─────────────────────── */
    function _newRecognition() {
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
            setState(STATE.IDLE);
            _procesarInput(texto);
        };

        rec.onend = () => {
            if (state === STATE.LISTENING) {
                setState(STATE.IDLE);
                _scheduleRelisten(400);
            }
        };

        rec.onerror = (e) => {
            if (e.error === 'no-speech') {
                setState(STATE.IDLE);
                _scheduleRelisten(350);
            } else if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
                setState(STATE.OFF);
                _mostrarRespuesta('Sin permiso de micrófono.');
            } else if (e.error !== 'aborted') {
                setState(STATE.IDLE);
                _scheduleRelisten(700);
            }
        };

        _recInstance = rec;
        return rec;
    }

    /* ─── ESCUCHAR / HABLAR ──────────────────────────── */
    function _escuchar() {
        if (state !== STATE.IDLE) return;
        clearTimeout(_relistenTimer);
        const rec = _newRecognition();
        try { rec.start(); setState(STATE.LISTENING); }
        catch(e) { setState(STATE.IDLE); _scheduleRelisten(500); }
    }

    function _scheduleRelisten(ms) {
        clearTimeout(_relistenTimer);
        if (state === STATE.OFF) return;
        _relistenTimer = setTimeout(() => { if (state === STATE.IDLE) _escuchar(); }, ms);
    }

    function _hablar(texto, callbackDespues = null) {
        clearTimeout(_relistenTimer);
        if (_recInstance) {
            try { _recInstance.abort(); } catch(e) {}
        }
        synth.cancel();
        setState(STATE.SPEAKING);
        _mostrarRespuesta(texto);

        const u = new SpeechSynthesisUtterance(texto);
        u.lang  = 'es-ES'; u.rate = 0.93; u.pitch = 1.05;
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
        document.getElementById('dara-user-btn')?.classList.add('active');
        const perfil = getPerfil();
        const nombre = perfil?.nombre?.split(' ')[0] || 'usuario';
        _hablar(`Hola ${nombre}, estoy lista. Puedes pedirme ver tus equipos, reportar un problema, solicitar un equipo o revisar tus reportes.`);
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
        document.getElementById('dara-user-btn')?.classList.remove('active');
        _mostrarRespuesta('DARA desactivada.');
        setTimeout(() => document.getElementById('dara-user-bubble')?.classList.remove('show'), 2500);
    }

    /* ─── COMANDOS ───────────────────────────────────── */
    function _procesarInput(texto) {
        if (flujoActivo) { FLUJOS[flujoActivo](texto); return; }

        if (/cancelar/.test(texto))                                          { _terminarFlujo(); _hablar('Cancelado. ¿En qué más puedo ayudarte?'); return; }
        if (/desactivar|cerrar|salir|apagar/.test(texto))                    { desactivar(); return; }
        if (/mis equipos|qu[eé] equipos tengo|equipos tengo/.test(texto))    { _consultarMisEquipos(); return; }
        if (/estado.*(equipo|mis)|(equipo|mis).*estado/.test(texto))         { _consultarEstadoEquipos(); return; }
        if (/mis reportes|mis solicitudes/.test(texto))                      { _consultarMisReportes(); return; }
        if (/reportar|problema|falla/.test(texto))                           { _iniciarFlujo('reportarProblema'); return; }
        if (/solicitar|solicitud|pedir equipo|necesito equipo/.test(texto))  { _iniciarFlujo('solicitarEquipo'); return; }
        if (/devolver|devoluci[oó]n|regresar equipo/.test(texto))            { _iniciarFlujo('devolverEquipo'); return; }
        if (/mi setup|inicio|principal/.test(texto))                         { switchTab('setup'); _hablar('Mostrando tu setup.'); return; }
        if (/historial/.test(texto))                                         { switchTab('historial'); _hablar('Mostrando tu historial.'); return; }
        if (/ayuda|qu[eé] puedes/.test(texto)) {
            _hablar('Puedo mostrarte tus equipos, reportar un problema, solicitar un equipo, registrar una devolución o revisar tus reportes. ¿Qué necesitas?');
            return;
        }
        _hablar('No entendí ese comando. Di ayuda para ver qué puedo hacer.');
    }

    function _iniciarFlujo(nombre) { flujoActivo = nombre; paso = 0; datos = {}; FLUJOS[nombre](null); }
    function _terminarFlujo()      { flujoActivo = null; paso = 0; datos = {}; }
    function _preguntar(texto)     { paso++; _hablar(texto); }

    /* ─── FLUJOS ─────────────────────────────────────── */
    const FLUJOS = {

        reportarProblema(input) {
            const TIPOS = {
                'fallado':'Equipo Fallado', 'falla':'Equipo Fallado', 'no enciende':'Equipo Fallado',
                'daño':'Daño Físico', 'físico':'Daño Físico', 'roto':'Daño Físico',
                'software':'Problema con Paquetería', 'programa':'Problema con Paquetería',
                'pérdida':'Pérdida', 'perdido':'Pérdida', 'otro':'Otro'
            };
            if (input === null) {
                const equipos = getMisEquipos();
                if (!equipos.length) { _terminarFlujo(); _hablar('No tienes equipos asignados para reportar.'); return; }
                _hablar(`Tus equipos son: ${equipos.map(e => `${e.id}, ${e.nombre}`).join('. ')}. ¿Cuál tiene el problema?`);
                paso = 1; return;
            }
            switch (paso) {
                case 1: {
                    const equipos = getMisEquipos();
                    const eq = equipos.find(e =>
                        input.toUpperCase().includes(e.id) ||
                        input.toLowerCase().includes(e.nombre.toLowerCase()) ||
                        input.toLowerCase().includes(e.tipo.toLowerCase()));
                    if (!eq) { _hablar('No encontré ese equipo entre los tuyos. Di el identificador o el nombre.'); return; }
                    datos.equipo = eq;
                    _preguntar(`Equipo ${eq.id} seleccionado. ¿Qué tipo de problema es? Equipo fallado, daño físico, problema de software u otro.`); break;
                }
                case 2: {
                    const key = Object.keys(TIPOS).find(t => input.includes(t));
                    datos.tipo = key ? TIPOS[key] : 'Otro';
                    _preguntar(`Tipo: ${datos.tipo}. Describe brevemente el problema.`); break;
                }
                case 3:
                    datos.descripcion = input.trim();
                    _preguntar(`Voy a reportar: ${datos.tipo} en ${datos.equipo.id}. ${datos.descripcion}. ¿Confirmas?`); break;
                case 4: {
                    if (/s[ií]|confirmo|correcto/.test(input)) {
                        const perfil = getPerfil();
                        const reps   = JSON.parse(localStorage.getItem('warehouse-reports') || '[]');
                        reps.push({ id:'RP-'+Date.now(), equipmentId:datos.equipo.id, type:datos.tipo,
                            description:datos.descripcion, reporter:perfil.nombre,
                            priority:'Media', date:new Date().toISOString().split('T')[0], status:'Pendiente' });
                        localStorage.setItem('warehouse-reports', JSON.stringify(reps));
                        dbBase.eventos.push({ id:'EVT-U'+Date.now(), equipoId:datos.equipo.id,
                            tipo:'envio_mantenimiento', fecha:new Date().toISOString().split('T')[0],
                            usuario:perfil.nombre, area:'Taller',
                            notas:`${datos.tipo}: ${datos.descripcion.substring(0,50)}` });
                        saveDB();
                        if (typeof renderUserReports === 'function') renderUserReports();
                        if (typeof renderTimeline    === 'function') renderTimeline();
                        switchTab('historial');
                        _terminarFlujo();
                        _hablar('Reporte enviado al administrador. Te notificaremos en cuanto haya una actualización.');
                    } else {
                        _terminarFlujo();
                        _hablar('Reporte cancelado. ¿Necesitas algo más?');
                    }
                    break;
                }
            }
        },

        solicitarEquipo(input) {
            const TIPOS = { laptop:'Laptop', monitor:'Monitor', mouse:'Mouse', teclado:'Teclado',
                            cpu:'CPU', audifonos:'Audífonos', tablet:'Tablet',
                            impresora:'Impresora', otro:'Otro' };
            if (input === null) {
                _hablar('Vamos a levantar tu solicitud. ¿Qué tipo de equipo necesitas? Laptop, Monitor, Mouse, Teclado, CPU u otro.');
                paso = 1; return;
            }
            switch (paso) {
                case 1: {
                    const key = Object.keys(TIPOS).find(t => input.includes(t));
                    datos.tipo = key ? TIPOS[key] : _cap(input.trim());
                    _preguntar(`Tipo: ${datos.tipo}. ¿Cuál es el motivo de la solicitud?`); break;
                }
                case 2:
                    datos.motivo = input.trim();
                    _preguntar('Motivo registrado. ¿Por cuánto tiempo lo necesitas? Di por ejemplo tres días, una semana o indefinido.'); break;
                case 3:
                    datos.duracion = input.trim();
                    _preguntar(`Solicitud de ${datos.tipo} por ${datos.duracion}. Motivo: ${datos.motivo}. ¿Confirmas?`); break;
                case 4: {
                    if (/s[ií]|confirmo|correcto/.test(input)) {
                        const perfil = getPerfil();
                        const desc   = `Tipo: ${datos.tipo} | Motivo: ${datos.motivo} | Duración: ${datos.duracion}`;
                        const reps   = JSON.parse(localStorage.getItem('warehouse-reports') || '[]');
                        reps.push({ id:'RP-'+Date.now(), equipmentId:'PEDIDO',
                            type:'Solicitud de prestamo', description:desc,
                            reporter:perfil.nombre, priority:'Media',
                            date:new Date().toISOString().split('T')[0], status:'Pendiente' });
                        localStorage.setItem('warehouse-reports', JSON.stringify(reps));
                        dbBase.eventos.push({ id:'EVT-U'+Date.now(), equipoId:'PEDIDO',
                            tipo:'solicitud_prestamo', fecha:new Date().toISOString().split('T')[0],
                            usuario:perfil.nombre, area:perfil.area, notas:desc.substring(0,80) });
                        saveDB();
                        if (typeof renderTimeline    === 'function') renderTimeline();
                        if (typeof renderUserReports === 'function') renderUserReports();
                        switchTab('historial');
                        _terminarFlujo();
                        _hablar('Solicitud enviada al administrador. Te avisaremos cuando sea aprobada. ¿Algo más?');
                    } else {
                        _terminarFlujo();
                        _hablar('Solicitud cancelada. ¿Puedo ayudarte en algo más?');
                    }
                    break;
                }
            }
        },

        devolverEquipo(input) {
            const CONDS = { excelente:'Excelente', bueno:'Bueno', regular:'Regular', malo:'Malo' };
            if (input === null) {
                const equipos = getMisEquipos();
                if (!equipos.length) { _terminarFlujo(); _hablar('No tienes equipos asignados para devolver.'); return; }
                _hablar(`Tus equipos son: ${equipos.map(e => `${e.id}, ${e.nombre}`).join('. ')}. ¿Cuál deseas devolver?`);
                paso = 1; return;
            }
            switch (paso) {
                case 1: {
                    const equipos = getMisEquipos();
                    const eq = equipos.find(e =>
                        input.toUpperCase().includes(e.id) ||
                        input.toLowerCase().includes(e.nombre.toLowerCase()));
                    if (!eq) { _hablar('No encontré ese equipo. Di el identificador o el nombre.'); return; }
                    datos.equipo = eq;
                    _preguntar(`Equipo ${eq.id} seleccionado. ¿En qué condición lo devuelves? Excelente, bueno, regular o malo.`); break;
                }
                case 2: {
                    const key = Object.keys(CONDS).find(c => input.includes(c));
                    datos.condicion = key ? CONDS[key] : 'Bueno';
                    _preguntar(`Devolución de ${datos.equipo.id} en condición ${datos.condicion}. ¿Confirmas?`); break;
                }
                case 3: {
                    if (/s[ií]|confirmo|correcto/.test(input)) {
                        const perfil = getPerfil();
                        const hoy    = new Date().toISOString().split('T')[0];
                        dbBase.eventos.push({ id:'EVT-U'+Date.now(), equipoId:datos.equipo.id,
                            tipo:'devolucion', fecha:hoy, usuario:perfil.nombre, area:'Almacen',
                            notas:`Devuelto en condición: ${datos.condicion} vía DARA` });
                        saveDB();
                        const reps = JSON.parse(localStorage.getItem('warehouse-reports') || '[]');
                        reps.push({ id:'RP-'+Date.now(), equipmentId:datos.equipo.id,
                            type:'Devolucion', description:`Devuelto en condición ${datos.condicion}`,
                            reporter:perfil.nombre, priority:'Baja', date:hoy, status:'Resuelto' });
                        localStorage.setItem('warehouse-reports', JSON.stringify(reps));
                        if (typeof renderSetup    === 'function') renderSetup();
                        if (typeof renderTimeline === 'function') renderTimeline();
                        switchTab('historial');
                        _terminarFlujo();
                        _hablar(`Devolución de ${datos.equipo.id} registrada exitosamente. ¿Puedo ayudarte en algo más?`);
                    } else {
                        _terminarFlujo();
                        _hablar('Devolución cancelada. ¿Necesitas algo más?');
                    }
                    break;
                }
            }
        }
    };

    function _consultarMisEquipos() {
        const equipos = getMisEquipos();
        if (!equipos.length) { _hablar('No tienes equipos asignados en este momento.'); return; }
        const lista = equipos.map(e => `${e.nombre} ${e.id}`).join(', ');
        _hablar(`Tienes ${equipos.length} equipo${equipos.length !== 1 ? 's' : ''} asignado${equipos.length !== 1 ? 's' : ''}: ${lista}.`);
    }

    function _consultarEstadoEquipos() {
        const equipos = getMisEquipos();
        if (!equipos.length) { _hablar('No tienes equipos asignados.'); return; }
        _hablar(equipos.map(e => `${e.id} en estado ${getEstadoUser(e.id).estado}`).join('. ') + '.');
    }

    function _consultarMisReportes() {
        const perfil = getPerfil();
        const todos  = JSON.parse(localStorage.getItem('warehouse-reports') || '[]').filter(r => r.reporter === perfil.nombre);
        if (!todos.length) { _hablar('No tienes reportes registrados.'); return; }
        const p = todos.filter(r => r.status === 'Pendiente').length;
        const a = todos.filter(r => r.status === 'Aprobado').length;
        const re= todos.filter(r => r.status === 'Resuelto' || r.status === 'Rechazado').length;
        let r = `Tienes ${todos.length} reporte${todos.length !== 1 ? 's' : ''} en total.`;
        if (p)  r += ` ${p} pendiente${p  !== 1 ? 's' : ''}.`;
        if (a)  r += ` ${a} aprobado${a   !== 1 ? 's' : ''}.`;
        if (re) r += ` ${re} resuelto${re !== 1 ? 's' : ''}.`;
        _hablar(r);
    }

    function _cap(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : str; }

    /* ─── UI ─────────────────────────────────────────── */
    function _renderUI() {
        const el = document.createElement('div');
        el.id = 'dara-user-widget';
        el.innerHTML = `
        <style>
            #dara-user-widget {
                position:fixed; bottom:28px; right:28px; z-index:9999;
                display:flex; flex-direction:column; align-items:flex-end; gap:10px;
                font-family:'Inter',sans-serif;
            }
            #dara-user-transcript {
                background:#EFF6FF; border:1px solid #BFDBFE;
                border-radius:12px 12px 12px 4px; padding:7px 12px;
                max-width:270px; font-size:11px; color:#1D4ED8; font-style:italic;
                opacity:0; transform:translateY(4px); transition:opacity .2s,transform .2s;
                pointer-events:none;
            }
            #dara-user-transcript.show { opacity:1; transform:none; }
            #dara-user-bubble {
                background:#fff; border:1px solid #E2E8F0;
                border-radius:14px 14px 4px 14px; padding:12px 15px;
                max-width:270px; font-size:12.5px; color:#334155;
                box-shadow:0 8px 24px rgba(0,31,63,.12); line-height:1.55;
                opacity:0; transform:translateY(4px); transition:opacity .25s,transform .25s;
                pointer-events:none;
            }
            #dara-user-bubble.show { opacity:1; transform:none; }
            #dara-user-bubble-label {
                font-size:9px; font-weight:800; color:#001f3f;
                letter-spacing:1.5px; margin-bottom:5px; display:block;
            }
            #dara-user-btn {
                width:58px; height:58px; border-radius:50%;
                background:#001f3f; border:3px solid rgba(255,255,255,.15);
                cursor:pointer; display:flex; align-items:center; justify-content:center;
                box-shadow:0 4px 18px rgba(0,31,63,.45); transition:transform .2s,box-shadow .2s;
                position:relative; outline:none; padding:0;
            }
            #dara-user-btn:hover { transform:scale(1.07); }
            #dara-user-btn.active    { border-color:rgba(255,255,255,.35); }
            #dara-user-btn.listening { background:#DC2626; }
            #dara-user-btn.speaking  { background:#059669; }
            #dara-user-name {
                position:absolute; top:-10px; left:50%; transform:translateX(-50%);
                background:#001f3f; color:#fff; font-size:8px; font-weight:800;
                letter-spacing:2px; padding:2px 8px; border-radius:5px;
                white-space:nowrap; border:1px solid rgba(255,255,255,.2);
            }
            #dara-user-icon { font-size:22px; line-height:1; user-select:none; }
            #dara-user-waves, #dara-user-pulse-ring {
                position:absolute; inset:-5px; border-radius:50%;
                border:2px solid rgba(255,255,255,.35); opacity:0;
                animation:du-wave 1.3s ease-out infinite;
            }
            #dara-user-pulse-ring { animation-delay:.45s; }
            #dara-user-btn.listening #dara-user-waves, #dara-user-btn.speaking #dara-user-waves,
            #dara-user-btn.listening #dara-user-pulse-ring, #dara-user-btn.speaking #dara-user-pulse-ring { opacity:1; }
            @keyframes du-wave {
                0%   { transform:scale(1); opacity:.55; }
                100% { transform:scale(1.65); opacity:0; }
            }
        </style>
        <div id="dara-user-transcript"></div>
        <div id="dara-user-bubble">
            <span id="dara-user-bubble-label">DARA · COLABORADOR</span>
            <span id="dara-user-text">Presiona para activarme</span>
        </div>
        <button id="dara-user-btn" title="Activar DARA">
            <div id="dara-user-name">DARA</div>
            <div id="dara-user-waves"></div>
            <div id="dara-user-pulse-ring"></div>
            <span id="dara-user-icon">🤖</span>
        </button>`;
        document.body.appendChild(el);
        document.getElementById('dara-user-btn').onclick = () =>
            state === STATE.OFF ? activar() : desactivar();
        setTimeout(() => _mostrarRespuesta('Presiona para activarme'), 1500);
    }

    function _renderEstado(s) {
        const btn  = document.getElementById('dara-user-btn');
        const icon = document.getElementById('dara-user-icon');
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
        const bubble = document.getElementById('dara-user-bubble');
        const t      = document.getElementById('dara-user-text');
        if (!bubble || !t) return;
        t.textContent = texto;
        bubble.classList.add('show');
        clearTimeout(_bubbleTimer);
        _bubbleTimer = setTimeout(() => bubble.classList.remove('show'), 7500);
    }

    function _mostrarTranscripcion(texto) {
        const tr = document.getElementById('dara-user-transcript');
        if (!tr) return;
        tr.textContent = `"${texto}"`;
        tr.classList.add('show');
        clearTimeout(_trTimer);
        _trTimer = setTimeout(() => tr.classList.remove('show'), 3500);
    }

    return { init, activar, desactivar };

})();

if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', () => DARA_USER.init());
else
    DARA_USER.init();