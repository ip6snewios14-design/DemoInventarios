const DARA = {
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
                if (this.conversacion) {
                    setTimeout(() => this.escuchar(), 600);
                } else {
                    setTimeout(() => this.escuchar(), 400);
                }
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

        // Cargar voces
        this.cargarVoz();
        if (speechSynthesis.onvoiceschanged !== undefined) {
            speechSynthesis.onvoiceschanged = () => this.cargarVoz();
        }

        this.renderUI();
    },

    cargarVoz() {
        const voces = this.synth.getVoices();
        const preferidas = [
            'Microsoft Sabina', 'Microsoft Laura', 'Microsoft Helena',
            'Google español', 'Paulina', 'Monica', 'Diego'
        ];
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
        this.mostrarRespuesta('Escuchando... di un comando.');
        setTimeout(() => this.escuchar(), 300);
        document.getElementById('dara-btn').classList.add('active');
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
        document.getElementById('dara-btn').classList.remove('active');
        this.mostrarRespuesta('DARA desactivada.');
        setTimeout(() => {
            const bubble = document.getElementById('dara-bubble');
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
            } else if (!seguirEscuchando) {
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

        if (texto.includes('desactivar') || texto.includes('cerrar') || texto.includes('salir') || texto.includes('apagar')) {
            this.desactivar();
            return;
        }
        if (texto.includes('dashboard') || texto.includes('inicio')) {
            showSection('dashboard'); this.hablar('Mostrando el dashboard.'); return;
        }
        if (texto.includes('inventario') || texto.includes('monitoreo')) {
            showSection('monitoring'); this.hablar('Mostrando inventario.'); return;
        }
        if (texto.includes('préstamos') || texto.includes('prestamos')) {
            showSection('loans'); this.hablar('Mostrando préstamos.'); return;
        }
        if (texto.includes('historial')) {
            showSection('history'); this.hablar('Mostrando historial.'); return;
        }
        if (texto.includes('reporte') || texto.includes('reportes')) {
            showSection('reports'); this.hablar('Mostrando reportes.'); return;
        }
        if (texto.includes('notificaciones')) {
            showSection('alexa'); this.hablar('Mostrando notificaciones.'); return;
        }
        if (texto.includes('registrar') || texto.includes('nuevo equipo') || texto.includes('alta')) {
            this.iniciarFlujo('registrarEquipo'); return;
        }
        if (texto.includes('asignar') || texto.includes('préstamo') || texto.includes('prestamo')) {
            this.iniciarFlujo('asignarEquipo'); return;
        }
        if (texto.includes('disponible')) {
            this.iniciarFlujo('consultarDisponibles'); return;
        }
        if (texto.includes('préstamos activos') || texto.includes('prestamos activos') || texto.includes('en campo')) {
            this.consultarPrestamosActivos(); return;
        }
        if (texto.includes('pendiente') || texto.includes('reporte pendiente')) {
            this.consultarReportesPendientes(); return;
        }
        if (texto.includes('ayuda') || texto.includes('qué puedes') || texto.includes('que puedes')) {
            this.hablar('Puedo registrar equipos, asignar equipos, consultar disponibles por categoría, ver préstamos activos, reportes pendientes y navegar entre secciones. ¿Qué necesitas?');
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
        registrarEquipo(input) {
            const pasos = [
                () => {
                    showSection('monitoring');
                    this.hablar('Vamos a registrar un nuevo equipo. ¿Cuál es el tipo? Laptop, Monitor, Mouse, Teclado, CPU, Audífonos, Tablet o Impresora.');
                },
                (input) => {
                    const tipos = {
                        'laptop': 'Laptop', 'monitor': 'Monitor', 'mouse': 'Mouse',
                        'teclado': 'Teclado', 'cpu': 'CPU', 'audifonos': 'Audífonos',
                        'audífonos': 'Audífonos', 'tablet': 'Tablet', 'impresora': 'Impresora'
                    };
                    const tipo = Object.keys(tipos).find(t => input.includes(t));
                    if (!tipo) { this.hablar('No reconocí ese tipo. Di Laptop, Monitor, Mouse, Teclado o CPU.'); return; }
                    this.datos.tipo = tipos[tipo];
                    this.hablar('Tipo ' + this.datos.tipo + ' registrado. ¿Cuál es la marca?');
                    this.paso++;
                },
                (input) => {
                    this.datos.marca = this.capitalizar(input.replace(/[^a-záéíóúüñ\s]/gi, '').trim());
                    this.hablar('Marca ' + this.datos.marca + '. ¿Cuál es el modelo?');
                    this.paso++;
                },
                (input) => {
                    this.datos.modelo = this.capitalizar(input.trim());
                    this.hablar('Modelo ' + this.datos.modelo + '. ¿Cómo se llama descriptivamente este equipo?');
                    this.paso++;
                },
                (input) => {
                    this.datos.nombre = this.capitalizar(input.trim());
                    this.hablar('Listo. Voy a registrar un ' + this.datos.tipo + ' ' + this.datos.marca + ' ' + this.datos.modelo + '. ¿Confirmas? Di sí o no.');
                    this.paso++;
                },
                (input) => {
                    if (input.includes('sí') || input.includes('si') || input.includes('confirmo') || input.includes('correcto')) {
                        const prefijos = { Laptop: 'LAP', Monitor: 'MON', Mouse: 'MOU', Teclado: 'KEY', CPU: 'CPU', 'Audífonos': 'AUD', Tablet: 'TAB', Impresora: 'IMP', Otro: 'EQ' };
                        const prefix = prefijos[this.datos.tipo] || 'EQ';
                        const mismoTipo = dbBase.equipos.filter(e => e.id.startsWith(prefix));
                        const newId = nextId(prefix, mismoTipo);
                        const hoy = new Date().toISOString().split('T')[0];

                        dbBase.equipos.push({ id: newId, nombre: this.datos.nombre, marca: this.datos.marca, modelo: this.datos.modelo, tipo: this.datos.tipo, serie: '' });
                        dbBase.eventos.push({ id: nextId('EVT', dbBase.eventos), equipoId: newId, tipo: 'alta', fecha: hoy, usuario: '', area: 'Almacén', notas: 'Alta por DARA' });
                        saveDB();
                        if (typeof syncDashboard === 'function') syncDashboard();
                        if (typeof renderInventory === 'function') renderInventory();

                        this.terminarFlujo();
                        this.hablar('Equipo ' + newId + ' registrado exitosamente.', false);
                        setTimeout(() => openQrModal(newId), 2500);
                    } else {
                        this.terminarFlujo();
                        this.hablar('Registro cancelado.', false);
                    }
                }
            ];
            if (input === null) { pasos[0].call(this); this.paso = 1; return; }
            if (this.paso < pasos.length) pasos[this.paso].call(this, input);
        },

        asignarEquipo(input) {
            const pasos = [
                () => {
                    showSection('loans');
                    const disponibles = dbBase.equipos.filter(eq => getEstado(eq.id).estado === 'Disponible');
                    if (!disponibles.length) {
                        this.terminarFlujo();
                        this.hablar('No hay equipos disponibles en este momento.', false);
                        return;
                    }
                    const lista = disponibles.slice(0, 5).map(e => e.id).join(', ');
                    this.hablar('Disponibles: ' + lista + '. ¿Cuál deseas asignar?');
                    this.paso = 1;
                },
                (input) => {
                    const eq = dbBase.equipos.find(e => input.toUpperCase().includes(e.id));
                    if (!eq) { this.hablar('No encontré ese equipo. Di el identificador, por ejemplo LAP-001.'); return; }
                    if (getEstado(eq.id).estado !== 'Disponible') { this.hablar('Ese equipo no está disponible.'); return; }
                    this.datos.equipo = eq;
                    this.hablar('Equipo ' + eq.id + ' seleccionado. ¿A qué empleado lo asignamos?');
                    this.paso++;
                },
                (input) => {
                    this.datos.empleado = this.capitalizar(input.trim());
                    this.hablar('Empleado ' + this.datos.empleado + '. ¿En qué área trabaja?');
                    this.paso++;
                },
                (input) => {
                    this.datos.area = this.capitalizar(input.trim());
                    this.hablar('Asignando ' + this.datos.equipo.id + ' a ' + this.datos.empleado + ' del área ' + this.datos.area + '. ¿Confirmas?');
                    this.paso++;
                },
                (input) => {
                    if (input.includes('sí') || input.includes('si') || input.includes('confirmo') || input.includes('correcto')) {
                        const eq = this.datos.equipo;
                        const hoy = new Date().toISOString().split('T')[0];
                        dbBase.eventos.push({ id: nextId('EVT', dbBase.eventos), equipoId: eq.id, tipo: 'asignacion', fecha: hoy, usuario: this.datos.empleado, area: this.datos.area, notas: 'Asignado por DARA' });
                        saveDB();
                        loans.push({ id: 'LN-' + Date.now(), equipmentId: eq.id, employee: this.datos.empleado, warehousePerson: 'DARA', conditionOut: 'Bueno', conditionIn: '', durationValue: null, durationUnit: 'indefinido', startDate: hoy, returnDate: '', status: 'Activo', notes: 'Asignado por voz', area: this.datos.area });
                        notifications.unshift({ id: 'NT-' + Date.now(), type: 'Préstamo', message: 'Asignación por DARA: ' + eq.id + ' a ' + this.datos.empleado, date: new Date().toLocaleString('es-ES'), read: false });
                        saveData();
                        if (typeof renderTables === 'function') renderTables();
                        if (typeof syncDashboard === 'function') syncDashboard();
                        this.terminarFlujo();
                        this.hablar(eq.id + ' asignado a ' + this.datos.empleado + ' exitosamente.', false);
                    } else {
                        this.terminarFlujo();
                        this.hablar('Asignación cancelada.', false);
                    }
                }
            ];
            if (input === null) { pasos[0].call(this); return; }
            if (this.paso < pasos.length) pasos[this.paso].call(this, input);
        },

        consultarDisponibles(input) {
            const pasos = [
                () => {
                    this.hablar('¿De qué categoría? Laptop, Monitor, Mouse, Teclado, CPU o todos.');
                    this.paso = 1;
                },
                (input) => {
                    const tipos = { 'laptop': 'Laptop', 'monitor': 'Monitor', 'mouse': 'Mouse', 'teclado': 'Teclado', 'cpu': 'CPU', 'audifonos': 'Audífonos', 'audífonos': 'Audífonos', 'tablet': 'Tablet', 'todos': null, 'todo': null };
                    const key = Object.keys(tipos).find(t => input.includes(t));
                    if (!key) { this.hablar('No reconocí esa categoría. Di Laptop, Monitor, Mouse, Teclado, CPU o todos.'); return; }
                    const tipoBuscado = tipos[key];

                    const disp = dbBase.equipos.filter(eq => getEstado(eq.id).estado === 'Disponible' && (tipoBuscado === null || eq.tipo === tipoBuscado));
                    const asig = dbBase.equipos.filter(eq => getEstado(eq.id).estado === 'Asignado' && (tipoBuscado === null || eq.tipo === tipoBuscado));
                    const mant = dbBase.equipos.filter(eq => getEstado(eq.id).estado === 'En Mantenimiento' && (tipoBuscado === null || eq.tipo === tipoBuscado));

                    let r = tipoBuscado ? ('Para ' + tipoBuscado + ': ') : 'En total: ';
                    r += disp.length + ' disponibles';
                    if (asig.length) r += ', ' + asig.length + ' asignados';
                    if (mant.length) r += ', ' + mant.length + ' en mantenimiento';
                    if (disp.length) r += '. Los disponibles son: ' + disp.map(e => e.id).join(', ');

                    this.terminarFlujo();
                    this.hablar(r, false);
                }
            ];
            if (input === null) { pasos[0].call(this); return; }
            if (this.paso < pasos.length) pasos[this.paso].call(this, input);
        }
    },

    consultarPrestamosActivos() {
        const activos = loans.filter(l => l.status === 'Activo');
        if (!activos.length) { this.hablar('No hay préstamos activos.', false); return; }
        const lista = activos.slice(0, 4).map(l => l.equipmentId + ' con ' + l.employee).join('. ');
        this.hablar('Hay ' + activos.length + ' préstamos activos. ' + lista, false);
    },

    consultarReportesPendientes() {
        const pend = reports.filter(r => r.status === 'Pendiente');
        if (!pend.length) { this.hablar('No hay reportes pendientes.', false); return; }
        const lista = pend.slice(0, 3).map(r => r.equipmentId + ' por ' + r.reporter).join('. ');
        this.hablar('Hay ' + pend.length + ' reportes pendientes. ' + lista, false);
    },

    renderUI() {
        const el = document.createElement('div');
        el.id = 'dara-widget';
        el.innerHTML = `
        <style>
            #dara-widget {
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
            #dara-transcript {
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
            #dara-transcript.show { display: block; }
            #dara-bubble {
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
            #dara-bubble.show { display: block; }
            #dara-bubble-label {
                font-size: 9px;
                font-weight: 800;
                color: #001f3f;
                letter-spacing: 1.5px;
                margin-bottom: 4px;
                display: block;
            }
            #dara-btn {
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
            #dara-btn:hover { transform: scale(1.08); box-shadow: 0 6px 24px rgba(0,31,63,.5); }
            #dara-btn.active { border-color: rgba(255,255,255,.4); }
            #dara-btn.listening { background: #DC2626; animation: dara-pulse 1s ease-in-out infinite; }
            #dara-btn.speaking { background: #059669; animation: dara-pulse 1.4s ease-in-out infinite; }
            #dara-name {
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
            #dara-icon { font-size: 20px; line-height: 1; }
            #dara-waves {
                position: absolute;
                inset: -4px;
                border-radius: 50%;
                border: 2px solid rgba(255,255,255,.3);
                display: none;
                animation: dara-wave 1.2s ease-out infinite;
            }
            #dara-btn.listening #dara-waves,
            #dara-btn.speaking #dara-waves { display: block; }
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

        <div id="dara-transcript"></div>
        <div id="dara-bubble">
            <span id="dara-bubble-label">DARA</span>
            <span id="dara-text">Presiona para activarme</span>
        </div>
        <button id="dara-btn" title="Activar / Desactivar DARA">
            <div id="dara-name">DARA</div>
            <div id="dara-waves"></div>
            <span id="dara-icon">🤖</span>
        </button>`;

        document.body.appendChild(el);

        document.getElementById('dara-btn').onclick = () => {
            if (this.active) {
                this.desactivar();
            } else {
                this.activar();
            }
        };

        // Mostrar burbuja de bienvenida sin voz
        setTimeout(() => {
            this.mostrarRespuesta('Presiona para activarme');
        }, 1500);
    },

    setEstado(estado) {
        const btn = document.getElementById('dara-btn');
        const icon = document.getElementById('dara-icon');
        if (!btn) return;
        btn.className = '';
        if (estado === 'listening') { btn.classList.add('listening'); icon.textContent = '👂'; }
        else if (estado === 'speaking') { btn.classList.add('speaking'); icon.textContent = '💬'; }
        else if (estado === 'off') { icon.textContent = '🤖'; }
        else { if (this.active) btn.classList.add('active'); icon.textContent = '🎙️'; }
    },

    mostrarRespuesta(texto) {
        const bubble = document.getElementById('dara-bubble');
        const t = document.getElementById('dara-text');
        if (!bubble || !t) return;
        t.textContent = texto;
        bubble.classList.add('show');
        clearTimeout(this._bubbleTimer);
        this._bubbleTimer = setTimeout(() => bubble.classList.remove('show'), 7000);
    },

    mostrarTranscripcion(texto) {
        const tr = document.getElementById('dara-transcript');
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
    document.addEventListener('DOMContentLoaded', () => DARA.init());
} else {
    DARA.init();
}