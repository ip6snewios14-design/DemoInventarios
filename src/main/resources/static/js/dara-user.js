const DARA_USER = {
    recognition: null,
    synth: window.speechSynthesis,
    listening: false,
    active: false,
    conversacion: null,
    paso: 0,
    datos: {},
    vozSeleccionada: null,

    init() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('DARA: SpeechRecognition no disponible');
            return;
        }
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SR();
        this.recognition.lang = 'es-ES';
        this.recognition.continuous = false;
        this.recognition.interimResults = false;

        this.recognition.onresult = (e) => {
            const texto = e.results[0][0].transcript.toLowerCase().trim();
            this.mostrarTranscripcion(texto);
            this.procesarInput(texto);
        };

        this.recognition.onend = () => {
            this.listening = false;
            if (this.active) {
                this.setEstado('idle');
                setTimeout(() => this.escuchar(), this.conversacion ? 600 : 400);
            } else {
                this.setEstado('off');
            }
        };

        this.recognition.onerror = (e) => {
            this.listening = false;
            if (e.error === 'no-speech' && this.active) {
                setTimeout(() => this.escuchar(), 400);
            } else if (e.error !== 'aborted') {
                this.setEstado('idle');
            }
        };

        this.cargarVoz();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = () => this.cargarVoz();
        }

        this.renderUI();
    },

    cargarVoz() {
        const voces = this.synth.getVoices();
        const preferidas = ['Microsoft Sabina', 'Microsoft Laura', 'Microsoft Helena', 'Google español', 'Paulina', 'Monica'];
        for (const nombre of preferidas) {
            const voz = voces.find(v => v.name.includes(nombre) && v.lang.startsWith('es'));
            if (voz) { this.vozSeleccionada = voz; break; }
        }
        if (!this.vozSeleccionada) {
            this.vozSeleccionada = voces.find(v => v.lang.startsWith('es')) || null;
        }
    },

    activar() {
        this.active = true;
        this.setEstado('idle');
        const perfil = getPerfil();
        this.mostrarRespuesta('Hola ' + perfil.nombre.split(' ')[0] + ', estoy lista.');
        this.hablar('Hola ' + perfil.nombre.split(' ')[0] + ', estoy lista. Puedes pedirme ver tus equipos, reportar un problema, solicitar un equipo o revisar tus reportes.');
        document.getElementById('dara-user-btn').classList.add('active');
    },

    desactivar() {
        this.active = false;
        this.conversacion = null;
        this.paso = 0;
        this.datos = {};
        this.listening = false;
        try { this.recognition.stop(); } catch(e) {}
        this.synth.cancel();
        this.setEstado('off');
        document.getElementById('dara-user-btn').classList.remove('active');
        this.mostrarRespuesta('DARA desactivada.');
        setTimeout(() => {
            const bubble = document.getElementById('dara-user-bubble');
            if (bubble) bubble.classList.remove('show');
        }, 2000);
    },

    escuchar() {
        if (this.listening || !this.active) return;
        try {
            this.recognition.start();
            this.listening = true;
            this.setEstado('listening');
        } catch(e) {}
    },

    hablar(texto, seguirEscuchando = true) {
        this.synth.cancel();
        const u = new SpeechSynthesisUtterance(texto);
        u.lang = 'es-ES';
        u.rate = 0.95;
        u.pitch = 1.05;
        if (this.vozSeleccionada) u.voice = this.vozSeleccionada;
        this.setEstado('speaking');
        this.mostrarRespuesta(texto);

        u.onend = () => {
            if (this.active && seguirEscuchando) {
                this.setEstado('idle');
                setTimeout(() => this.escuchar(), 400);
            } else {
                this.setEstado(this.active ? 'idle' : 'off');
                if (this.active) setTimeout(() => this.escuchar(), 400);
            }
        };
        this.synth.speak(u);
    },

    procesarInput(texto) {
        this.listening = false;

        if (this.conversacion) {
            this.flujos[this.conversacion].call(this, texto);
            return;
        }

        if (texto.includes('cancelar')) {
            this.terminarFlujo();
            this.hablar('Cancelado. En qué más puedo ayudarte.');
            return;
        }
        if (texto.includes('desactivar') || texto.includes('cerrar') || texto.includes('salir') || texto.includes('apagar')) {
            this.desactivar();
            return;
        }
        if (texto.includes('mis equipos') || texto.includes('qué equipos tengo') || texto.includes('que equipos tengo') || texto.includes('equipos tengo')) {
            this.consultarMisEquipos();
            return;
        }
        if (texto.includes('estado') && (texto.includes('equipo') || texto.includes('mis'))) {
            this.consultarEstadoEquipos();
            return;
        }
        if (texto.includes('mis reportes') || texto.includes('reportes') || texto.includes('mis solicitudes')) {
            this.consultarMisReportes();
            return;
        }
        if (texto.includes('reportar') || texto.includes('reporte') || texto.includes('problema') || texto.includes('falla')) {
            this.iniciarFlujo('reportarProblema');
            return;
        }
        if (texto.includes('solicitar') || texto.includes('solicitud') || texto.includes('pedir equipo') || texto.includes('necesito equipo')) {
            this.iniciarFlujo('solicitarEquipo');
            return;
        }
        if (texto.includes('devolver') || texto.includes('devolución') || texto.includes('devolucion') || texto.includes('regresar equipo')) {
            this.iniciarFlujo('devolverEquipo');
            return;
        }
        if (texto.includes('mi setup') || texto.includes('inicio') || texto.includes('principal')) {
            switchTab('setup');
            this.hablar('Mostrando tu setup.');
            return;
        }
        if (texto.includes('historial') || texto.includes('reportes') || texto.includes('mis reportes')) {
            switchTab('historial');
            this.hablar('Mostrando historial y reportes.');
            return;
        }
        if (texto.includes('ayuda') || texto.includes('que puedes') || texto.includes('qué puedes')) {
            this.hablar('Puedo mostrarte tus equipos, reportar un problema, solicitar un equipo, registrar una devolución o revisar tus reportes. ¿Qué necesitas?');
            return;
        }

        this.hablar('No entendí ese comando. Di ayuda para ver qué puedo hacer.');
    },

    iniciarFlujo(nombre) {
        this.conversacion = nombre;
        this.paso = 0;
        this.datos = {};
        this.flujos[nombre].call(this, null);
    },

    terminarFlujo() {
        this.conversacion = null;
        this.paso = 0;
        this.datos = {};
    },

    flujos: {

        reportarProblema(input) {
            const pasos = [
                () => {
                    const perfil = getPerfil();
                    const equipos = getMisEquipos();
                    if (!equipos.length) {
                        this.terminarFlujo();
                        this.hablar('No tienes equipos asignados para reportar.', false);
                        return;
                    }
                    const lista = equipos.map(e => e.id + ' ' + e.nombre).join(', ');
                    this.hablar('Tus equipos son: ' + lista + '. ¿Cuál tiene el problema?');
                    this.paso = 1;
                },
                (input) => {
                    const equipos = getMisEquipos();
                    const eq = equipos.find(e => input.toUpperCase().includes(e.id) || input.toLowerCase().includes(e.nombre.toLowerCase()) || input.toLowerCase().includes(e.tipo.toLowerCase()));
                    if (!eq) { this.hablar('No encontré ese equipo entre los tuyos. Di el identificador o el nombre.'); return; }
                    this.datos.equipo = eq;
                    this.hablar('Equipo ' + eq.id + ' seleccionado. ¿Qué tipo de problema es? Puedes decir equipo fallado, daño físico, problema con software u otro.');
                    this.paso++;
                },
                (input) => {
                    const tipos = {
                        'fallado': 'Equipo Fallado', 'falla': 'Equipo Fallado', 'no enciende': 'Equipo Fallado',
                        'daño': 'Daño Físico', 'físico': 'Daño Físico', 'roto': 'Daño Físico',
                        'software': 'Problema con Paquetería', 'programa': 'Problema con Paquetería',
                        'pérdida': 'Pérdida', 'perdido': 'Pérdida',
                        'otro': 'Otro'
                    };
                    const key = Object.keys(tipos).find(t => input.includes(t));
                    this.datos.tipo = key ? tipos[key] : 'Otro';
                    this.hablar('Tipo registrado: ' + this.datos.tipo + '. Describe brevemente el problema.');
                    this.paso++;
                },
                (input) => {
                    this.datos.descripcion = input.trim();
                    this.hablar('Voy a reportar: ' + this.datos.tipo + ' en ' + this.datos.equipo.id + '. ' + this.datos.descripcion + '. ¿Confirmas?');
                    this.paso++;
                },
                (input) => {
                    if (input.includes('sí') || input.includes('si') || input.includes('confirmo') || input.includes('correcto')) {
                        const perfil = getPerfil();
                        const eq = this.datos.equipo;
                        const reports = JSON.parse(localStorage.getItem('warehouse-reports') || '[]');
                        reports.push({
                            id: 'RP-' + Date.now(),
                            equipmentId: eq.id,
                            type: this.datos.tipo,
                            description: this.datos.descripcion,
                            reporter: perfil.nombre,
                            priority: 'Media',
                            date: new Date().toISOString().split('T')[0],
                            status: 'Pendiente'
                        });
                        localStorage.setItem('warehouse-reports', JSON.stringify(reports));

                        dbBase.eventos.push({
                            id: 'EVT-U' + Date.now(),
                            equipoId: eq.id,
                            tipo: 'envio_mantenimiento',
                            fecha: new Date().toISOString().split('T')[0],
                            usuario: perfil.nombre,
                            area: 'Taller',
                            notas: this.datos.tipo + ': ' + this.datos.descripcion.substring(0, 50)
                        });
                        saveDB();
                        if (typeof renderUserReports === 'function') renderUserReports();
                        if (typeof renderTimeline === 'function') renderTimeline();
                        switchTab('historial');
                        this.terminarFlujo();
                        this.hablar('Reporte enviado al administrador. Te notificaremos pronto.', false);
                    } else {
                        this.terminarFlujo();
                        this.hablar('Reporte cancelado.', false);
                    }
                }
            ];
            if (input === null) { pasos[0].call(this); return; }
            if (this.paso < pasos.length) pasos[this.paso].call(this, input);
        },

        solicitarEquipo(input) {
            const pasos = [
                () => {
                    this.hablar('Vamos a levantar tu solicitud. ¿Qué tipo de equipo necesitas? Laptop, Monitor, Mouse, Teclado, CPU u otro.');
                    this.paso = 1;
                },
                (input) => {
                    const tipos = {
                        'laptop': 'Laptop', 'monitor': 'Monitor', 'mouse': 'Mouse',
                        'teclado': 'Teclado', 'cpu': 'CPU', 'audifonos': 'Audifonos',
                        'tablet': 'Tablet', 'impresora': 'Impresora', 'otro': 'Otro'
                    };
                    const key = Object.keys(tipos).find(t => input.includes(t));
                    this.datos.tipo = key ? tipos[key] : this.capitalizar(input.trim());
                    this.hablar('Tipo: ' + this.datos.tipo + '. ¿Cuál es el motivo de la solicitud?');
                    this.paso++;
                },
                (input) => {
                    this.datos.motivo = input.trim();
                    this.hablar('Motivo registrado. ¿Por cuánto tiempo lo necesitas? Di por ejemplo tres dias, una semana o indefinido.');
                    this.paso++;
                },
                (input) => {
                    this.datos.duracion = input.trim();
                    this.hablar('Solicitud de ' + this.datos.tipo + ' por ' + this.datos.duracion + '. Motivo: ' + this.datos.motivo + '. ¿Confirmas?');
                    this.paso++;
                },
                (input) => {
                    if (input.includes('sí') || input.includes('si') || input.includes('confirmo') || input.includes('correcto')) {
                        const perfil = getPerfil();
                        const desc = 'Tipo: ' + this.datos.tipo + ' | Motivo: ' + this.datos.motivo + ' | Duracion: ' + this.datos.duracion;
                        const reports = JSON.parse(localStorage.getItem('warehouse-reports') || '[]');
                        reports.push({
                            id: 'RP-' + Date.now(),
                            equipmentId: 'PEDIDO',
                            type: 'Solicitud de prestamo',
                            description: desc,
                            reporter: perfil.nombre,
                            priority: 'Media',
                            date: new Date().toISOString().split('T')[0],
                            status: 'Pendiente'
                        });
                        localStorage.setItem('warehouse-reports', JSON.stringify(reports));

                        dbBase.eventos.push({
                            id: 'EVT-U' + Date.now(),
                            equipoId: 'PEDIDO',
                            tipo: 'solicitud_prestamo',
                            fecha: new Date().toISOString().split('T')[0],
                            usuario: perfil.nombre,
                            area: perfil.area,
                            notas: desc.substring(0, 80)
                        });
                        saveDB();
                        if (typeof renderTimeline === 'function') renderTimeline();
                        if (typeof renderUserReports === 'function') renderUserReports();
                        switchTab('historial');
                        this.terminarFlujo();
                        this.hablar('Solicitud enviada al administrador. Te avisaremos cuando sea aprobada.', false);
                    } else {
                        this.terminarFlujo();
                        this.hablar('Solicitud cancelada.', false);
                    }
                }
            ];
            if (input === null) { pasos[0].call(this); return; }
            if (this.paso < pasos.length) pasos[this.paso].call(this, input);
        },

        devolverEquipo(input) {
            const pasos = [
                () => {
                    const equipos = getMisEquipos();
                    if (!equipos.length) {
                        this.terminarFlujo();
                        this.hablar('No tienes equipos asignados para devolver.', false);
                        return;
                    }
                    const lista = equipos.map(e => e.id + ' ' + e.nombre).join(', ');
                    this.hablar('Tus equipos son: ' + lista + '. ¿Cuál deseas devolver?');
                    this.paso = 1;
                },
                (input) => {
                    const equipos = getMisEquipos();
                    const eq = equipos.find(e => input.toUpperCase().includes(e.id) || input.toLowerCase().includes(e.nombre.toLowerCase()));
                    if (!eq) { this.hablar('No encontré ese equipo. Di el identificador o el nombre.'); return; }
                    this.datos.equipo = eq;
                    this.hablar('Equipo ' + eq.id + ' seleccionado. ¿En qué condición lo devuelves? Excelente, bueno, regular o malo.');
                    this.paso++;
                },
                (input) => {
                    const condiciones = { 'excelente': 'Excelente', 'bueno': 'Bueno', 'regular': 'Regular', 'malo': 'Malo' };
                    const key = Object.keys(condiciones).find(c => input.includes(c));
                    this.datos.condicion = key ? condiciones[key] : 'Bueno';
                    this.hablar('Devolución de ' + this.datos.equipo.id + ' en condición ' + this.datos.condicion + '. ¿Confirmas?');
                    this.paso++;
                },
                (input) => {
                    if (input.includes('sí') || input.includes('si') || input.includes('confirmo') || input.includes('correcto')) {
                        const perfil = getPerfil();
                        const eq = this.datos.equipo;
                        const hoy = new Date().toISOString().split('T')[0];

                        dbBase.eventos.push({
                            id: 'EVT-U' + Date.now(),
                            equipoId: eq.id,
                            tipo: 'devolucion',
                            fecha: hoy,
                            usuario: perfil.nombre,
                            area: 'Almacen',
                            notas: 'Devuelto en condicion: ' + this.datos.condicion + ' via DARA'
                        });
                        saveDB();

                        const reports = JSON.parse(localStorage.getItem('warehouse-reports') || '[]');
                        reports.push({
                            id: 'RP-' + Date.now(),
                            equipmentId: eq.id,
                            type: 'Devolucion',
                            description: 'Devuelto en condicion ' + this.datos.condicion,
                            reporter: perfil.nombre,
                            priority: 'Baja',
                            date: hoy,
                            status: 'Resuelto'
                        });
                        localStorage.setItem('warehouse-reports', JSON.stringify(reports));

                        if (typeof renderSetup === 'function') renderSetup();
                        if (typeof renderTimeline === 'function') renderTimeline();
                        switchTab('historial');
                        this.terminarFlujo();
                        this.hablar('Devolución de ' + eq.id + ' registrada exitosamente.', false);
                    } else {
                        this.terminarFlujo();
                        this.hablar('Devolución cancelada.', false);
                    }
                }
            ];
            if (input === null) { pasos[0].call(this); return; }
            if (this.paso < pasos.length) pasos[this.paso].call(this, input);
        }
    },

    consultarMisEquipos() {
        const equipos = getMisEquipos();
        if (!equipos.length) {
            this.hablar('No tienes equipos asignados en este momento.', false);
            return;
        }
        const lista = equipos.map(e => e.nombre + ' ' + e.id).join(', ');
        this.hablar('Tienes ' + equipos.length + ' equipo' + (equipos.length > 1 ? 's' : '') + ' asignado' + (equipos.length > 1 ? 's' : '') + ': ' + lista, false);
    },

    consultarEstadoEquipos() {
        const equipos = getMisEquipos();
        if (!equipos.length) {
            this.hablar('No tienes equipos asignados.', false);
            return;
        }
        const detalle = equipos.map(e => {
            const info = getEstadoUser(e.id);
            return e.id + ' en estado ' + info.estado;
        }).join('. ');
        this.hablar(detalle, false);
    },

    consultarMisReportes() {
        const perfil = getPerfil();
        const mis = JSON.parse(localStorage.getItem('warehouse-reports') || '[]')
            .filter(r => r.reporter === perfil.nombre);
        if (!mis.length) {
            this.hablar('No tienes reportes registrados.', false);
            return;
        }
        const pendientes = mis.filter(r => r.status === 'Pendiente').length;
        const aprobados = mis.filter(r => r.status === 'Aprobado').length;
        const resueltos = mis.filter(r => r.status === 'Resuelto' || r.status === 'Rechazado').length;
        let resp = 'Tienes ' + mis.length + ' reporte' + (mis.length > 1 ? 's' : '') + ' en total.';
        if (pendientes) resp += ' ' + pendientes + ' pendiente' + (pendientes > 1 ? 's' : '') + '.';
        if (aprobados) resp += ' ' + aprobados + ' aprobado' + (aprobados > 1 ? 's' : '') + '.';
        if (resueltos) resp += ' ' + resueltos + ' resuelto' + (resueltos > 1 ? 's' : '') + '.';
        this.hablar(resp, false);
    },

    renderUI() {
        const el = document.createElement('div');
        el.id = 'dara-user-widget';
        el.innerHTML = `
        <style>
            #dara-user-widget {
                position: fixed;
                bottom: 28px;
                right: 28px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                align-items: flex-end;
                gap: 8px;
                font-family: 'Inter', sans-serif;
            }
            #dara-user-transcript {
                background: #EFF6FF;
                border: 1px solid #BFDBFE;
                border-radius: 12px 12px 12px 4px;
                padding: 7px 12px;
                max-width: 260px;
                font-size: 11px;
                color: #1D4ED8;
                font-style: italic;
                display: none;
                animation: dara-fadein .2s ease;
            }
            #dara-user-transcript.show { display: block; }
            #dara-user-bubble {
                background: #fff;
                border: 1px solid #E2E8F0;
                border-radius: 14px 14px 4px 14px;
                padding: 11px 14px;
                max-width: 260px;
                font-size: 12px;
                color: #334155;
                box-shadow: 0 6px 20px rgba(0,31,63,.1);
                display: none;
                line-height: 1.5;
                animation: dara-fadein .2s ease;
            }
            #dara-user-bubble.show { display: block; }
            #dara-user-bubble-label {
                font-size: 9px;
                font-weight: 800;
                color: #001f3f;
                letter-spacing: 1.5px;
                margin-bottom: 4px;
                display: block;
            }
            #dara-user-btn {
                width: 56px;
                height: 56px;
                border-radius: 50%;
                background: #001f3f;
                border: 3px solid rgba(255,255,255,.15);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 4px 16px rgba(0,31,63,.4);
                transition: all .25s;
                position: relative;
                outline: none;
            }
            #dara-user-btn:hover { transform: scale(1.08); }
            #dara-user-btn.active { border-color: rgba(255,255,255,.4); }
            #dara-user-btn.listening { background: #DC2626; animation: dara-pulse 1s ease-in-out infinite; }
            #dara-user-btn.speaking { background: #059669; animation: dara-pulse 1.4s ease-in-out infinite; }
            #dara-user-name {
                position: absolute;
                top: -9px;
                left: 50%;
                transform: translateX(-50%);
                background: #001f3f;
                color: #fff;
                font-size: 8px;
                font-weight: 800;
                letter-spacing: 2px;
                padding: 2px 7px;
                border-radius: 5px;
                white-space: nowrap;
                border: 1px solid rgba(255,255,255,.2);
            }
            #dara-user-icon { font-size: 20px; line-height: 1; }
            #dara-user-waves {
                position: absolute;
                inset: -4px;
                border-radius: 50%;
                border: 2px solid rgba(255,255,255,.3);
                display: none;
                animation: dara-wave 1.2s ease-out infinite;
            }
            #dara-user-btn.listening #dara-user-waves,
            #dara-user-btn.speaking #dara-user-waves { display: block; }
            @keyframes dara-pulse {
                0%,100% { box-shadow: 0 4px 16px rgba(0,31,63,.4); }
                50% { box-shadow: 0 4px 28px rgba(0,31,63,.6), 0 0 0 6px rgba(0,31,63,.08); }
            }
            @keyframes dara-wave {
                0% { transform: scale(1); opacity: .6; }
                100% { transform: scale(1.5); opacity: 0; }
            }
            @keyframes dara-fadein {
                from { opacity: 0; transform: translateY(4px); }
                to { opacity: 1; transform: none; }
            }
        </style>

        <div id="dara-user-transcript"></div>
        <div id="dara-user-bubble">
            <span id="dara-user-bubble-label">DARA</span>
            <span id="dara-user-text">Presiona para activarme</span>
        </div>
        <button id="dara-user-btn" title="Activar DARA">
            <div id="dara-user-name">DARA</div>
            <div id="dara-user-waves"></div>
            <span id="dara-user-icon">🤖</span>
        </button>`;

        document.body.appendChild(el);

        document.getElementById('dara-user-btn').onclick = () => {
            if (this.active) { this.desactivar(); } else { this.activar(); }
        };

        setTimeout(() => this.mostrarRespuesta('Presiona para activarme'), 1500);
    },

    setEstado(estado) {
        const btn = document.getElementById('dara-user-btn');
        const icon = document.getElementById('dara-user-icon');
        if (!btn) return;
        btn.className = '';
        if (estado === 'listening') { btn.classList.add('listening'); icon.textContent = '👂'; }
        else if (estado === 'speaking') { btn.classList.add('speaking'); icon.textContent = '💬'; }
        else if (estado === 'off') { icon.textContent = '🤖'; }
        else { if (this.active) btn.classList.add('active'); icon.textContent = '🎙️'; }
    },

    mostrarRespuesta(texto) {
        const bubble = document.getElementById('dara-user-bubble');
        const t = document.getElementById('dara-user-text');
        if (!bubble || !t) return;
        t.textContent = texto;
        bubble.classList.add('show');
        clearTimeout(this._bubbleTimer);
        this._bubbleTimer = setTimeout(() => bubble.classList.remove('show'), 7000);
    },

    mostrarTranscripcion(texto) {
        const tr = document.getElementById('dara-user-transcript');
        if (!tr) return;
        tr.textContent = '"' + texto + '"';
        tr.classList.add('show');
        clearTimeout(this._trTimer);
        this._trTimer = setTimeout(() => tr.classList.remove('show'), 3500);
    },

    capitalizar(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => DARA_USER.init());
} else {
    DARA_USER.init();
}