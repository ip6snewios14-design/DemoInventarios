console.log('user.js cargado, versión 2');
let currentUsername = '';

const iconos = {
    Laptop: '💻', Monitor: '🖥️', Mouse: '🖱️', Teclado: '⌨️',
    CPU: '🖥', 'Audífonos': '🎧', Asistente: '🔊', Tablet: '📱',
    Impresora: '🖨️', Otro: '📦'
};

const statusColors = {
    'Disponible': 'bg-green-100 text-green-800',
    'Asignado': 'bg-amber-100 text-amber-800',
    'En Mantenimiento': 'bg-red-100 text-red-800',
    'Baja Definitiva': 'bg-gray-200 text-gray-800'
};

function getHistorial(equipoId) {
    return dbBase.eventos
        .filter(e => e.equipoId === equipoId)
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
}

function calcularEstado(historial) {
    if (!historial.length) return { estado: 'Desconocido', user: 'N/A', area: 'N/A', fecha: '' };
    const u = historial[0];
    let estado = '';
    switch (u.tipo) {
        case 'alta': case 'devolucion': case 'regreso_mantenimiento': estado = 'Disponible'; break;
        case 'asignacion': case 'reasignacion': estado = 'Asignado'; break;
        case 'envio_mantenimiento': estado = 'En Mantenimiento'; break;
        case 'baja': estado = 'Baja Definitiva'; break;
        default: estado = 'Desconocido';
    }
    return { estado, user: u.usuario || '', area: u.area || '', fecha: u.fecha };
}

function getEstadoUser(equipoId) {
    return calcularEstado(getHistorial(equipoId));
}

function getPerfil() {
    return userProfiles[currentUsername] || {
        nombre: currentUsername,
        area: 'Empleado',
        equiposAsignados: []
    };
}

function getMisEquipos() {
    const perfil = getPerfil();
    return dbBase.equipos.filter(eq => {
        const info = getEstadoUser(eq.id);
        return info.estado === 'Asignado' && info.user === perfil.nombre;
    });
}

function getEquiposDisponibles() {
    return dbBase.equipos.filter(eq => {
        const info = getEstadoUser(eq.id);
        return info.estado === 'Disponible';
    });
}

function renderSetup() {
    const perfil = getPerfil();
    const misEquipos = getMisEquipos();
    const disponibles = getEquiposDisponibles();

    document.getElementById('user-display-name').textContent = perfil.nombre;
    document.getElementById('user-display-area').textContent = perfil.area;
    document.getElementById('banner-name').textContent = perfil.nombre;
    document.getElementById('banner-area').textContent = perfil.area;
    document.getElementById('banner-count').textContent = misEquipos.length;
    document.getElementById('user-avatar').textContent = perfil.nombre.charAt(0).toUpperCase();

    const grid = document.getElementById('setup-grid');
    const empty = document.getElementById('setup-empty');

    if (misEquipos.length === 0 && disponibles.length === 0) {
        grid.classList.add('hidden');
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    grid.classList.remove('hidden');

    const asignadasHtml = misEquipos.map(eq => `
        <div class="device-card ok">
            <div class="absolute top-3 right-3">
                <span class="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                    ✓ Lo tengo
                </span>
            </div>
            <div class="device-icon">${iconos[eq.tipo] || '📦'}</div>
            <span class="device-id">${eq.id}</span>
            <span class="device-name">${eq.nombre}</span>
            <span class="device-model">${eq.marca} ${eq.modelo}</span>
            <span class="device-status bg-amber-100 text-amber-800">Asignado</span>
            <button onclick="openReportarModal('${eq.id}')"
                class="mt-2 w-full py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-semibold hover:bg-red-100 transition">
                <i class="fas fa-exclamation-triangle mr-1"></i>Reportar problema
            </button>
        </div>`).join('');

    const solicitudesPendientes = JSON.parse(localStorage.getItem('warehouse-reports') || '[]')
        .filter(r => r.reporter === perfil.nombre && r.type === 'Solicitud de préstamo' && r.status === 'Pendiente')
        .map(r => r.equipmentId);

    const disponiblesHtml = disponibles.map(eq => {
        const yaSolicitado = solicitudesPendientes.includes(eq.id);
        const badge = yaSolicitado
            ? '<span class="px-2 py-0.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-full">⏳ En espera</span>'
            : '<span class="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">Disponible</span>';
        const statusBadge = yaSolicitado
            ? '<span class="device-status bg-amber-100 text-amber-800">Esperando respuesta</span>'
            : '<span class="device-status bg-green-100 text-green-800">Libre</span>';
        const accion = yaSolicitado
            ? '<div class="mt-2 w-full py-1.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg text-xs font-semibold text-center"><i class="fas fa-clock mr-1"></i>Solicitud enviada</div>'
            : '<button onclick="openSolicitarModal(\'' + eq.id + '\')" class="mt-2 w-full py-1.5 bg-navy text-white rounded-lg text-xs font-semibold hover:bg-navy-dark transition"><i class="fas fa-hand-paper mr-1"></i>Solicitar</button>';
        const opacidad = yaSolicitado ? '1' : '.85';
        const filtro = yaSolicitado ? 'none' : 'grayscale(.4)';

        return `<div class="device-card" style="opacity:${opacidad}">
            <div class="absolute top-3 right-3">${badge}</div>
            <div class="device-icon" style="filter:${filtro}">${iconos[eq.tipo] || '📦'}</div>
            <span class="device-id">${eq.id}</span>
            <span class="device-name">${eq.nombre}</span>
            <span class="device-model">${eq.marca} ${eq.modelo}</span>
            ${statusBadge}
            ${accion}
        </div>`;
    }).join('');

    grid.innerHTML = asignadasHtml + disponiblesHtml;
}

function renderTimeline() {
    const perfil = getPerfil();
    const misIds = getMisEquipos().map(e => e.id);

    const solicitadosIds = dbBase.eventos
        .filter(ev => ev.tipo === 'solicitud_prestamo' && ev.usuario === perfil.nombre)
        .map(ev => ev.equipoId);

    const todosIds = [...new Set([...misIds, ...solicitadosIds])];

    const eventos = dbBase.eventos
        .filter(ev => todosIds.includes(ev.equipoId))
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .slice(0, 20);

    const dotClass = tipo => {
        if (['alta', 'regreso_mantenimiento', 'devolucion'].includes(tipo)) return 'green';
        if (['asignacion', 'reasignacion'].includes(tipo)) return 'blue';
        if (tipo === 'envio_mantenimiento') return 'red';
        if (tipo === 'solicitud_prestamo') return 'amber';
        if (tipo === 'baja') return 'amber';
        return 'amber';
    };

    const tipoLabel = tipo => ({
        alta: 'Alta de equipo',
        asignacion: 'Asignado a ti',
        reasignacion: 'Reasignado',
        devolucion: 'Devuelto',
        envio_mantenimiento: 'Enviado a mantenimiento',
        regreso_mantenimiento: 'Regreso de mantenimiento',
        baja: 'Baja definitiva',
        solicitud_prestamo: 'Solicitud de prestamo enviada'
    }[tipo] || tipo);

    const tl = document.getElementById('user-timeline');
    if (!eventos.length) {
        tl.innerHTML = '<p class="text-sm text-gray-400">Sin actividad registrada</p>';
        return;
    }

    tl.innerHTML = eventos.map(ev => {
        const eq = dbBase.equipos.find(e => e.id === ev.equipoId);
        return `
        <div class="tl-item">
            <div class="tl-dot ${dotClass(ev.tipo)}"></div>
            <div class="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <div class="flex justify-between items-start gap-2">
                    <div>
                        <p class="text-xs font-bold text-navy">${tipoLabel(ev.tipo)}</p>
                        <p class="text-xs text-gray-500 mt-0.5">${eq ? iconos[eq.tipo] + ' ' + eq.id + ' - ' + eq.nombre : ev.equipoId}</p>
                        ${ev.notas ? '<p class="text-xs text-gray-400 mt-1 italic">"' + ev.notas + '"</p>' : ''}
                    </div>
                    <span class="text-xs text-gray-400 whitespace-nowrap">${ev.fecha}</span>
                </div>
            </div>
        </div>`;
    }).join('');
}

function renderUserReports() {
    const perfil = getPerfil();
    const userReports = JSON.parse(localStorage.getItem('warehouse-reports') || '[]')
        .filter(r => r.reporter === perfil.nombre);

    const container = document.getElementById('user-reports-table');
    if (!userReports.length) {
        container.innerHTML = '<p class="text-xs text-gray-400 text-center py-4">Sin reportes previos</p>';
        return;
    }

    const prioColor = p => p === 'Alta' ? 'bg-red-100 text-red-700' :
        p === 'Media' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700';
    const statusColor = s => s === 'Pendiente' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700';

    container.innerHTML = userReports.map(r => `
        <div class="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap mb-1">
                    <span class="text-xs font-bold text-navy">${r.equipmentId}</span>
                    <span class="px-2 py-0.5 rounded-full text-xs font-medium ${prioColor(r.priority)}">${r.priority}</span>
                    <span class="px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(r.status)}">${r.status}</span>
                </div>
                <p class="text-xs text-gray-600 truncate">${r.type}: ${r.description}</p>
                <p class="text-xs text-gray-400 mt-0.5">${r.date}</p>
            </div>
            ${r.status === 'Pendiente'
                ? '<span class="text-xs text-amber-500 flex-shrink-0 mt-1"><i class="fas fa-clock"></i></span>'
                : '<span class="text-xs text-green-500 flex-shrink-0 mt-1"><i class="fas fa-check-circle"></i></span>'
            }
        </div>`).join('');
}

function populateReportSelect() {
    const equipos = getMisEquipos();
    const sel = document.getElementById('user-report-equipo');
    sel.innerHTML = equipos.length
        ? equipos.map(eq => '<option value="' + eq.id + '">' + (iconos[eq.tipo] || '📦') + ' ' + eq.id + ' - ' + eq.nombre + '</option>').join('')
        : '<option value="">Sin equipos asignados</option>';
}

function submitUserReport() {
    const perfil = getPerfil();
    const eqId = document.getElementById('user-report-equipo').value;
    const tipo = document.getElementById('user-report-tipo').value;
    const prioridad = document.getElementById('user-report-prioridad').value;
    const desc = document.getElementById('user-report-desc').value.trim();

    if (!eqId) { showToast('No tienes equipos asignados'); return; }
    if (!desc) { showToast('Describe el problema antes de enviar'); return; }

    const reports = JSON.parse(localStorage.getItem('warehouse-reports') || '[]');
    reports.push({
        id: 'RP-' + Date.now(), equipmentId: eqId, type: tipo,
        description: desc, reporter: perfil.nombre, priority: prioridad,
        date: new Date().toISOString().split('T')[0], status: 'Pendiente'
    });
    localStorage.setItem('warehouse-reports', JSON.stringify(reports));

    dbBase.eventos.push({
        id: 'EVT-U' + Date.now(), equipoId: eqId, tipo: 'envio_mantenimiento',
        fecha: new Date().toISOString().split('T')[0], usuario: perfil.nombre,
        area: 'Taller', notas: tipo + ': ' + desc.substring(0, 50)
    });
    saveDB();

    document.getElementById('user-report-desc').value = '';
    showToast('Reporte enviado correctamente');
    renderTimeline();
    renderUserReports();
    setTimeout(() => addChatMessage(
        'Recibimos tu reporte sobre ' + eqId + '. Lo revisaremos a la brevedad. Prioridad: ' + prioridad + '.', 'support'
    ), 800);
}

function openReportarModal(eqId) {
    const eq = dbBase.equipos.find(e => e.id === eqId);
    document.getElementById('modal-reportar-titulo').textContent =
        (iconos[eq.tipo] || '📦') + ' ' + eq.id + ' - ' + eq.nombre;
    document.getElementById('modal-reportar-eqid').value = eqId;
    document.getElementById('modal-reportar-desc').value = '';
    document.getElementById('modal-reportar-tipo').value = 'Equipo Fallado';
    document.getElementById('modal-reportar-prio').value = 'Media';
    document.getElementById('modal-reportar').classList.remove('hidden');
}

function closeReportarModal() {
    document.getElementById('modal-reportar').classList.add('hidden');
}

function submitReportarModal() {
    const perfil = getPerfil();
    const eqId = document.getElementById('modal-reportar-eqid').value;
    const tipo = document.getElementById('modal-reportar-tipo').value;
    const prio = document.getElementById('modal-reportar-prio').value;
    const desc = document.getElementById('modal-reportar-desc').value.trim();
    if (!desc) { showToast('Describe el problema'); return; }

    const reports = JSON.parse(localStorage.getItem('warehouse-reports') || '[]');
    reports.push({
        id: 'RP-' + Date.now(), equipmentId: eqId, type: tipo,
        description: desc, reporter: perfil.nombre, priority: prio,
        date: new Date().toISOString().split('T')[0], status: 'Pendiente'
    });
    localStorage.setItem('warehouse-reports', JSON.stringify(reports));

    dbBase.eventos.push({
        id: 'EVT-U' + Date.now(), equipoId: eqId, tipo: 'envio_mantenimiento',
        fecha: new Date().toISOString().split('T')[0], usuario: perfil.nombre,
        area: 'Taller', notas: tipo + ': ' + desc.substring(0, 50)
    });
    saveDB();
    closeReportarModal();
    showToast('Reporte enviado al administrador');
    renderTimeline();
    renderUserReports();
    setTimeout(() => addChatMessage(
        'Recibimos tu reporte sobre ' + eqId + '. Prioridad: ' + prio + '. Te notificaremos pronto.', 'support'
    ), 800);
}

function openSolicitarModal(eqId) {
    const eq = dbBase.equipos.find(e => e.id === eqId);
    document.getElementById('modal-solicitar-titulo').textContent =
        (iconos[eq.tipo] || '📦') + ' ' + eq.id + ' - ' + eq.nombre;
    document.getElementById('modal-solicitar-eqid').value = eqId;
    document.getElementById('modal-solicitar-motivo').value = '';
    document.getElementById('modal-solicitar-duracion').value = '';
    document.getElementById('modal-solicitar').classList.remove('hidden');
}

function closeSolicitarModal() {
    document.getElementById('modal-solicitar').classList.add('hidden');
}

function submitSolicitar() {
    const perfil = getPerfil();
    const eqId = document.getElementById('modal-solicitar-eqid').value;
    const motivo = document.getElementById('modal-solicitar-motivo').value.trim();
    const duracion = document.getElementById('modal-solicitar-duracion').value.trim();
    if (!motivo) { showToast('Indica el motivo de la solicitud'); return; }

    const reports = JSON.parse(localStorage.getItem('warehouse-reports') || '[]');
    reports.push({
        id: 'RP-' + Date.now(), equipmentId: eqId, type: 'Solicitud de prestamo',
        description: 'Motivo: ' + motivo + (duracion ? ' - Duracion estimada: ' + duracion : ''),
        reporter: perfil.nombre, priority: 'Media',
        date: new Date().toISOString().split('T')[0], status: 'Pendiente'
    });
    localStorage.setItem('warehouse-reports', JSON.stringify(reports));

    dbBase.eventos.push({
        id: 'EVT-U' + Date.now(), equipoId: eqId, tipo: 'solicitud_prestamo',
        fecha: new Date().toISOString().split('T')[0], usuario: perfil.nombre,
        area: perfil.area, notas: 'Solicitud: ' + motivo + (duracion ? ' - ' + duracion : '')
    });
    saveDB();
    closeSolicitarModal();
    renderTimeline();
    showToast('Solicitud enviada al administrador');
    setTimeout(() => addChatMessage(
        'Tu solicitud de ' + eqId + ' fue recibida. El administrador la revisara y te confirmara.', 'support'
    ), 800);
}

const chatResponses = [
    'Entendido! Estamos revisando tu caso.',
    'Un tecnico se pondra en contacto contigo pronto.',
    'Gracias por reportarlo. Puedes darnos mas detalles?',
    'Hemos escalado tu ticket al equipo de soporte.',
    'El tiempo estimado de respuesta es de 24 horas habiles.',
    'El problema persiste despues de reiniciar el equipo?',
];

function addChatMessage(text, who) {
    if (!who) who = 'support';
    const container = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'flex ' + (who === 'user' ? 'justify-end' : 'justify-start');
    div.innerHTML = '<div class="msg-bubble ' + (who === 'user' ? 'sent' : '') + '">'
        + (who === 'support' ? '<span class="block text-xs font-bold mb-1 text-blue-300">Soporte tecnico</span>' : '')
        + text + '</div>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    addChatMessage(text, 'user');
    input.value = '';
    setTimeout(function() {
        const resp = chatResponses[Math.floor(Math.random() * chatResponses.length)];
        addChatMessage(resp, 'support');
    }, 900 + Math.random() * 600);
}

function showToast(msg) {
    const t = document.getElementById('user-toast');
    document.getElementById('user-toast-msg').textContent = msg;
    t.classList.remove('hidden');
    setTimeout(function() { t.classList.add('hidden'); }, 3000);
}

function switchTab(tabId) {
    document.querySelectorAll('[data-tab]').forEach(function(btn) { btn.classList.remove('active'); });
    document.querySelector('[data-tab="' + tabId + '"]').classList.add('active');
    document.getElementById('tab-setup').classList.toggle('hidden', tabId !== 'setup');
    document.getElementById('tab-historial').classList.toggle('hidden', tabId !== 'historial');
    if (tabId === 'historial') { renderTimeline(); renderUserReports(); }
}

function showWelcome() {
    const perfil = getPerfil();
    const w = document.getElementById('wcard');
    const p = document.getElementById('wprog');
    document.getElementById('wtitle').textContent = 'Hola, ' + perfil.nombre.split(' ')[0] + ' !';
    document.getElementById('wsub').textContent = 'Cargando tu workspace...';
    w.classList.add('show');
    setTimeout(function() { p.style.width = '100%'; }, 150);
    setTimeout(function() { w.classList.remove('show'); }, 2600);
}

function initUser() {
    currentUsername = document.getElementById('app-username').content;
    loadDB();

    const eventos = JSON.parse(localStorage.getItem('db-eventos') || '[]');
    const tieneNuevos = eventos.some(function(e) { return e.id === 'EVT-018'; });
    if (!tieneNuevos) {
        localStorage.removeItem('db-equipos');
        localStorage.removeItem('db-eventos');
        loadDB();
    }

    renderSetup();
    populateReportSelect();
    renderTimeline();
    renderUserReports();

    addChatMessage('Hola! Soy el asistente de soporte tecnico. En que puedo ayudarte hoy?', 'support');

    document.querySelectorAll('[data-tab]').forEach(function(btn) {
        btn.addEventListener('click', function() { switchTab(btn.dataset.tab); });
    });

    document.getElementById('chat-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter') sendChatMessage();
    });

    showWelcome();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUser);
} else {
    initUser();
}