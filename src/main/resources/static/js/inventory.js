/* =========================================================================
   EVENT SOURCING — Estado calculado
   ========================================================================= */
const statusColors = {
    'Disponible': 'bg-green-100 text-green-800',
    'Asignado': 'bg-amber-100 text-amber-800',
    'En Mantenimiento': 'bg-red-100 text-red-800',
    'Baja Definitiva': 'bg-gray-200 text-gray-800',
    'Desconocido': 'bg-gray-100 text-gray-600'
};

function getHistorial(equipoId) {
    return dbBase.eventos
        .filter(e => e.equipoId === equipoId)
        .sort((a, b) => {
            const d = new Date(b.fecha) - new Date(a.fecha);
            return d !== 0 ? d : b.id.localeCompare(a.id);
        });
}

function calcularEstado(historial) {
    if (!historial.length) return { estado: 'Desconocido', css: 'bg-gray-100 text-gray-600', user: 'N/A', area: 'Almacén', fecha: '' };
    const u = historial[0];
    let estado = '', user = 'N/A', area = 'Almacén';
    switch (u.tipo) {
        case 'alta': case 'devolucion': case 'regreso_mantenimiento':
            estado = 'Disponible'; break;
        case 'asignacion': case 'reasignacion':
            estado = 'Asignado'; user = u.usuario || 'N/A'; area = u.area || 'N/A'; break;
        case 'envio_mantenimiento':
            estado = 'En Mantenimiento'; break;
        case 'baja':
            estado = 'Baja Definitiva'; break;
        default: estado = 'Desconocido';
    }
    return { estado, css: statusColors[estado] || 'bg-gray-100', user, area, fecha: u.fecha };
}

function getEstado(equipoId) {
    return calcularEstado(getHistorial(equipoId));
}

/* =========================================================================
   RENDER TABLA
   ========================================================================= */
function renderInventory() {
    const tbody = document.getElementById('inventory-table-body');
    if (!tbody) return;
    const searchEl = document.getElementById('search-inventory');
    const filterEl = document.getElementById('filter-inventory');
    if (!filterEl) return;
    const search = searchEl ? searchEl.value.toLowerCase() : '';
    const filter = filterEl.value;
    let html = '';
    dbBase.equipos.forEach(eq => {
        const info = getEstado(eq.id);

        // Filtro estado
        const estadoKey = info.estado.toLowerCase().replace(/ /g, '_');
        if (filter !== 'todos' && estadoKey !== filter) return;

        // Filtro búsqueda
        if (search && !(
            eq.id.toLowerCase().includes(search) ||
            eq.nombre.toLowerCase().includes(search) ||
            eq.marca.toLowerCase().includes(search)
        )) return;

        html += `
        <tr class="hover:bg-gray-50 transition">
            <td class="px-4 py-3 font-semibold text-navy">${eq.id}</td>
            <td class="px-4 py-3">${eq.nombre}</td>
            <td class="px-4 py-3">${eq.marca} ${eq.modelo}</td>
            <td class="px-4 py-3 text-gray-600">${info.user}</td>
            <td class="px-4 py-3 text-gray-600">${info.area}</td>
            <td class="px-4 py-3">
                <span class="px-3 py-1 rounded-full text-xs font-bold ${info.css}">${info.estado}</span>
            </td>
            <td class="px-4 py-3 text-gray-500">${info.fecha || 'N/A'}</td>
            <td class="px-4 py-3">
                <button data-id="${eq.id}" class="inv-action-btn px-3 py-1 text-xs bg-navy text-white rounded hover:bg-navy-dark transition">
                    Evento
                </button>
            </td>
        </tr>`;
    });

    tbody.innerHTML = html || '<tr><td colspan="8" class="text-center py-8 text-gray-400">Sin resultados</td></tr>';
}

/* =========================================================================
   MODAL ALTA DE EQUIPO
   ========================================================================= */
function openAltaModal() {
    document.getElementById('modal-alta').classList.remove('hidden');
    // Limpia el form
    document.getElementById('alta-tipo').value = '';
    document.getElementById('alta-nombre').value = '';
    document.getElementById('alta-marca').value = '';
    document.getElementById('alta-modelo').value = '';
    document.getElementById('alta-serie').value = '';
    document.getElementById('alta-obs').value = '';
    document.getElementById('alta-estrategia').value = 'disponible';
    document.getElementById('alta-campos-asignacion').classList.add('hidden');
    document.getElementById('alta-usuario').value = '';
    document.getElementById('alta-celula').value = '';
    // Muestra el ID autogenerado como preview
    document.getElementById('alta-id').value = '(se asignará al guardar)';

    // Toggle campos asignación
    document.getElementById('alta-estrategia').onchange = function () {
        document.getElementById('alta-campos-asignacion').classList.toggle('hidden', this.value !== 'asignar');
    };

    // Submit del form
    document.getElementById('alta-form').onsubmit = function (e) {
        e.preventDefault();
        saveAlta();
    };
}

function closeAltaModal() {
    document.getElementById('modal-alta').classList.add('hidden');
}


function saveAlta() {
    const tipo = document.getElementById('alta-tipo').value;
    const nombre = document.getElementById('alta-nombre').value.trim();
    const marca = document.getElementById('alta-marca').value.trim();
    const modelo = document.getElementById('alta-modelo').value.trim();
    const serie = document.getElementById('alta-serie').value.trim();
    const obs = document.getElementById('alta-obs').value.trim();
    const estrategia = document.getElementById('alta-estrategia').value;
    const usuario = document.getElementById('alta-usuario').value.trim();
    const celula = document.getElementById('alta-celula').value.trim();

    if (!tipo || !nombre || !marca || !modelo) {
        alert('Tipo, nombre, marca y modelo son obligatorios.'); return;
    }
    if (estrategia === 'asignar' && (!usuario || !celula)) {
        alert('Usuario y célula son obligatorios para asignación inmediata.'); return;
    }

    const prefijos = {
        Laptop: 'LAP', Monitor: 'MON', Mouse: 'MOU', Teclado: 'KEY',
        CPU: 'CPU', Audífonos: 'AUD', Asistente: 'ALE',
        Tablet: 'TAB', Impresora: 'IMP', Otro: 'EQ'
    };
    const prefix = prefijos[tipo] || 'EQ';
    const mismoTipo = dbBase.equipos.filter(e => e.id.startsWith(prefix));
    const newId = nextId(prefix, mismoTipo);
    const hoy = new Date().toISOString().split('T')[0];

    // Alta del equipo
    dbBase.equipos.push({ id: newId, nombre, marca, modelo, tipo, serie });
    dbBase.eventos.push({
        id: nextId('EVT', dbBase.eventos),
        equipoId: newId, tipo: 'alta', fecha: hoy,
        usuario: '', area: 'Almacén', notas: obs || 'Alta de equipo'
    });

    // Asignación inmediata si eligió esa opción
    if (estrategia === 'asignar') {
        dbBase.eventos.push({
            id: nextId('EVT', dbBase.eventos),
            equipoId: newId, tipo: 'asignacion', fecha: hoy,
            usuario, area: celula, notas: 'Asignación en alta'
        });
    }

    saveDB();
    closeAltaModal();
    renderInventory();
    syncDashboard();
    setTimeout(() => openQrModal(newId), 300);
}

/* =========================================================================
   MODAL EVENTO (Asignar / Devolver / Mantenimiento / Baja)
   ========================================================================= */
function openEventoModal(equipoId) {
    const eq = dbBase.equipos.find(e => e.id === equipoId);
    const info = getEstado(equipoId);
    if (!eq) return;

    document.getElementById('modal-evento').classList.remove('hidden');
    document.getElementById('evento-equipo-id').value = equipoId;
    document.getElementById('evento-equipo-label').textContent = `${eq.id} — ${eq.nombre} (${info.estado})`;

    // Mostrar/ocultar campos según estado actual
    const showUsuario = ['disponible', 'asignado', 'desconocido'].includes(info.estado.toLowerCase());
    document.getElementById('evento-usuario-row').style.display = showUsuario ? '' : 'none';
    document.getElementById('evento-area-row').style.display = showUsuario ? '' : 'none';

    // Opciones de tipo de evento según estado
    const tipoSelect = document.getElementById('evento-tipo');
    tipoSelect.innerHTML = '';
    const opciones = getOpcionesEvento(info.estado);
    opciones.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.value; opt.textContent = o.label;
        tipoSelect.appendChild(opt);
    });
    toggleEventoFields();
}
function drawQrCanvas(text) {
    const canvas = document.getElementById('qr-canvas');
    const ctx = canvas.getContext('2d');
    const size = 160, cell = 8, cols = size / cell;
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, size, size);
    const seed = text.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const rand = (i) => ((seed * 9301 + i * 49297 + 233) % 233280) / 233280;
    ctx.fillStyle = '#001f3f';
    for (let r = 0; r < cols; r++) {
        for (let c = 0; c < cols; c++) {
            const inFinder = (r < 7 && c < 7) || (r < 7 && c >= cols - 7) || (r >= cols - 7 && c < 7);
            if (inFinder) {
                const fr = r % 7, fc = c % 7;
                if (fr === 0 || fr === 6 || fc === 0 || fc === 6 || (fr >= 2 && fr <= 4 && fc >= 2 && fc <= 4))
                    ctx.fillRect(c * cell, r * cell, cell - 1, cell - 1);
            } else {
                if (rand(r * cols + c) > 0.5) ctx.fillRect(c * cell, r * cell, cell - 1, cell - 1);
            }
        }
    }
    ctx.fillStyle = '#001f3f';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(text, size / 2, size - 2);
}

function openQrModal(equipoId) {
    const eq = dbBase.equipos.find(e => e.id === equipoId);
    if (!eq) return;
    document.getElementById('modal-qr').classList.remove('hidden');
    document.getElementById('qr-generating').classList.remove('hidden');
    document.getElementById('qr-ready').classList.add('hidden');
    document.getElementById('qr-progress').style.width = '0';
    document.getElementById('qr-gen-label').textContent = `Preparando código para ${equipoId}`;
    setTimeout(() => {
        document.getElementById('qr-progress').style.width = '60%';
        document.getElementById('qr-gen-label').textContent = 'Codificando datos...';
    }, 300);
    setTimeout(() => {
        document.getElementById('qr-progress').style.width = '100%';
        document.getElementById('qr-gen-label').textContent = '¡Listo!';
    }, 900);
    setTimeout(() => {
        document.getElementById('qr-generating').classList.add('hidden');
        document.getElementById('qr-ready').classList.remove('hidden');
        document.getElementById('qr-equipo-id').textContent = eq.id;
        document.getElementById('qr-equipo-nombre').textContent = `${eq.marca} ${eq.modelo}`;
        drawQrCanvas(eq.id);
    }, 1300);
}

function closeQrModal() {
    document.getElementById('modal-qr').classList.add('hidden');
}

function printQr() {
    const canvas = document.getElementById('qr-canvas');
    const eqId = document.getElementById('qr-equipo-id').textContent;
    const eqNombre = document.getElementById('qr-equipo-nombre').textContent;
    const dataUrl = canvas.toDataURL('image/png');
    const win = window.open('', '_blank');
    win.document.write(`<!DOCTYPE html><html><head><title>QR - ${eqId}</title>
    <style>body{font-family:monospace;text-align:center;padding:40px}img{display:block;margin:0 auto 12px;width:200px;height:200px;image-rendering:pixelated}h2{font-size:22px;color:#001f3f;margin:0}p{color:#64748b;font-size:13px;margin-top:4px}.border{border:2px solid #001f3f;border-radius:12px;padding:20px;display:inline-block}</style>
    </head><body><div class="border"><img src="${dataUrl}" alt="QR ${eqId}"><h2>${eqId}</h2><p>${eqNombre}</p><p>End to End Management</p></div>
    <script>window.onload=()=>{window.print();window.close()}<\/script></body></html>`);
    win.document.close();
}

function getOpcionesEvento(estado) {
    switch (estado) {
        case 'Disponible':
            return [
                { value: 'asignacion', label: 'Asignar a usuario' },
                { value: 'envio_mantenimiento', label: 'Enviar a mantenimiento' },
                { value: 'baja', label: 'Dar de baja' }
            ];
        case 'Asignado':
            return [
                { value: 'devolucion', label: 'Registrar devolución' },
                { value: 'reasignacion', label: 'Reasignar a otro usuario' },
                { value: 'envio_mantenimiento', label: 'Enviar a mantenimiento' },
                { value: 'baja', label: 'Dar de baja' }
            ];
        case 'En Mantenimiento':
            return [
                { value: 'regreso_mantenimiento', label: 'Regreso de mantenimiento' },
                { value: 'baja', label: 'Dar de baja' }
            ];
        default:
            return [
                { value: 'asignacion', label: 'Asignar a usuario' },
                { value: 'envio_mantenimiento', label: 'Enviar a mantenimiento' },
                { value: 'baja', label: 'Dar de baja' }
            ];
    }
}

function toggleEventoFields() {
    const tipo = document.getElementById('evento-tipo').value;
    const needsUser = ['asignacion', 'reasignacion'].includes(tipo);
    document.getElementById('evento-usuario-row').style.display = needsUser ? '' : 'none';
    document.getElementById('evento-area-row').style.display = needsUser ? '' : 'none';
}

function closeEventoModal() {
    document.getElementById('modal-evento').classList.add('hidden');
}

function saveEvento() {
    const equipoId = document.getElementById('evento-equipo-id').value;
    const tipo = document.getElementById('evento-tipo').value;
    const usuario = document.getElementById('evento-usuario').value.trim();
    const area = document.getElementById('evento-area').value.trim();
    const notas = document.getElementById('evento-notas').value.trim();
    const fecha = document.getElementById('evento-fecha').value || new Date().toISOString().split('T')[0];

    if (['asignacion', 'reasignacion'].includes(tipo) && (!usuario || !area)) {
        alert('Usuario y célula son obligatorios para asignación.'); return;
    }

    dbBase.eventos.push({
        id: nextId('EVT', dbBase.eventos),
        equipoId, tipo, fecha, usuario, area, notas
    });

    saveDB();
    closeEventoModal();
    renderInventory();
    syncDashboard();
}

/* =========================================================================
   SYNC CON DASHBOARD
   ========================================================================= */
function syncDashboard() {
    if (typeof renderDashboardKanban === 'function') renderDashboardKanban();
    if (typeof renderDashLog === 'function') renderDashLog();
}

/* =========================================================================
   INIT
   ========================================================================= */
function initInventory() {
    // Búsqueda y filtro
    const si = document.getElementById('search-inventory');
    const fi = document.getElementById('filter-inventory');
    if (si) si.addEventListener('keyup', renderInventory);
    if (fi) fi.addEventListener('change', renderInventory);

    // Botón nuevo equipo
    const btnAlta = document.getElementById('open-alta-btn');
    if (btnAlta) btnAlta.addEventListener('click', openAltaModal);

    // Delegación: botón Evento en cada fila
    const tbody = document.getElementById('inventory-table-body');
    if (tbody) {
        tbody.addEventListener('click', e => {
            const btn = e.target.closest('.inv-action-btn');
            if (btn) openEventoModal(btn.dataset.id);
        });
    }

    // Cambio de tipo en modal evento
    const tipoSel = document.getElementById('evento-tipo');
    if (tipoSel) tipoSel.addEventListener('change', toggleEventoFields);

    renderInventory();
}