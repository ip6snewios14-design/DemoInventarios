const currentRole = document.getElementById('app-role').content;
let loans = [], history = [], reports = [], notifications = [];

const initialLoans = [
    { id: "LN-001", equipmentId: "LAP-002", employee: "Juan Pérez", warehousePerson: "Ana Martínez", conditionOut: "Bueno", conditionIn: "", durationValue: 14, durationUnit: "dias", startDate: "2025-06-01", returnDate: "", status: "Activo", notes: "", area: "TI" },
    { id: "LN-002", equipmentId: "KEY-001", employee: "María García", warehousePerson: "Ana Martínez", conditionOut: "Regular", conditionIn: "", durationValue: 1, durationUnit: "meses", startDate: "2025-06-03", returnDate: "", status: "Activo", notes: "", area: "Ventas" }
];
const initialHistory = [
    { id: "TR-001", type: "Préstamo", equipmentId: "LAP-002", employee: "Juan Pérez", warehousePerson: "Ana Martínez", details: "Préstamo registrado", date: "2025-06-01 10:30", status: "Completado" }
];
const initialReports = [
    { id: "RP-001", equipmentId: "CPU-001", type: "Equipo Fallado", description: "CPU no enciende", reporter: "Roberto Fernández", priority: "Alta", date: "2025-06-02", status: "Pendiente" }
];
const initialNotifications = [
    { id: "NT-001", type: "Préstamo", message: "Préstamo registrado: LAP-002 para Juan Pérez", date: "2025-06-01 10:30", read: true },
    { id: "NT-002", type: "Anuncio", message: "Bienvenido al sistema de gestión", date: new Date().toLocaleString('es-ES'), read: false }
];

const appData = {
    priorityColors: { "Alta": "bg-red-100 text-red-800", "Media": "bg-amber-100 text-amber-800", "Baja": "bg-green-100 text-green-800" }
};

function loadData() {
    loans = JSON.parse(localStorage.getItem('warehouse-loans')) || JSON.parse(JSON.stringify(initialLoans));
    history = JSON.parse(localStorage.getItem('warehouse-history')) || JSON.parse(JSON.stringify(initialHistory));
    reports = JSON.parse(localStorage.getItem('warehouse-reports')) || JSON.parse(JSON.stringify(initialReports));
    notifications = JSON.parse(localStorage.getItem('warehouse-notifications')) || JSON.parse(JSON.stringify(initialNotifications));
}

function saveData() {
    localStorage.setItem('warehouse-loans', JSON.stringify(loans));
    localStorage.setItem('warehouse-history', JSON.stringify(history));
    localStorage.setItem('warehouse-reports', JSON.stringify(reports));
    localStorage.setItem('warehouse-notifications', JSON.stringify(notifications));
    updateStats();
    updateNotificationCount();
    renderNotifications();
    renderDashboardKanban();
    renderDashLog();
}

function updateStats() {
    const totals = dbBase.equipos.reduce((acc, eq) => {
        const estado = getEstado(eq.id).estado;
        acc.total++;
        if (estado === 'Disponible') acc.disponible++;
        else if (estado === 'Asignado') acc.prestamo++;
        else if (estado === 'En Mantenimiento' || estado === 'Baja Definitiva') acc.reportado++;
        return acc;
    }, { total: 0, disponible: 0, prestamo: 0, reportado: 0 });
    document.getElementById('total-equipment').innerText = totals.total;
    document.getElementById('available-equipment').innerText = totals.disponible;
    document.getElementById('loaned-equipment').innerText = totals.prestamo;
    document.getElementById('reported-equipment').innerText = totals.reportado;
}

function updateNotificationCount() {
    document.getElementById('notification-count').innerText = notifications.length > 0 ? Math.min(notifications.length, 4) : 0;
    document.getElementById('total-notifications').innerText = notifications.length;
    document.getElementById('loan-notifications').innerText = notifications.filter(n => n.type === 'Préstamo').length;
    document.getElementById('return-notifications').innerText = notifications.filter(n => n.type === 'Devolución').length;
    document.getElementById('report-notifications').innerText = notifications.filter(n => n.type === 'Reporte').length;
}

function renderNotifications(filterType = 'todos') {
    document.querySelectorAll('.notif-filter-btn').forEach(btn => {
        const isActive = btn.dataset.filter === filterType;
        btn.classList.toggle('bg-navy', isActive);
        btn.classList.toggle('text-white', isActive);
        btn.classList.toggle('border-navy', isActive);
        btn.classList.toggle('bg-white', !isActive && !btn.closest('.lg\\:col-span-2') === false);
        btn.classList.toggle('text-gray-600', !isActive && btn.closest('.lg\\:col-span-2') !== null);
        btn.classList.toggle('border-gray-300', !isActive && btn.closest('.lg\\:col-span-2') !== null);
    });

    const container = document.getElementById('speech-messages');
    if (!container) return;

    const filtered = filterType === 'todos'
        ? notifications
        : notifications.filter(n => n.type === filterType);

    if (filtered.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 py-8">Sin notificaciones</div>';
        return;
    }

    const tagColor = type =>
        type === 'Préstamo' ? 'bg-amber-100 text-amber-800' :
            type === 'Devolución' ? 'bg-green-100 text-green-800' :
                'bg-red-100 text-red-800';

    container.innerHTML = filtered.slice(0, 15).map(n => `
        <div class="speech-bubble flex justify-between items-start gap-2">
            <div class="flex-1">
                <p class="text-gray-700">${n.message}</p>
                <p class="text-xs text-gray-500 mt-1">${n.date}</p>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
                <span class="px-2 py-1 text-xs rounded ${tagColor(n.type)}">${n.type}</span>
                <button data-id="${n.id}" class="notif-delete-btn text-gray-300 hover:text-red-400 transition text-xs">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>`).join('');
}

function renderTables() {
    const iconos = { Laptop: '💻', Monitor: '🖥️', Mouse: '🖱️', Teclado: '⌨️', CPU: '🖥', 'Audífonos': '🎧', Asistente: '🔊', Tablet: '📱', Impresora: '🖨️', Otro: '📦' };

    const lnBody = document.getElementById('loans-table-body');
    if (lnBody)
        lnBody.innerHTML = loans.filter(l => l.status === 'Activo').map(l => {
            const eq = dbBase.equipos.find(e => e.id === l.equipmentId);
            const tipo = eq ? eq.tipo : '-';
            return `<tr class="hover:bg-gray-50 transition">
                <td class="px-4 py-3 font-semibold text-navy">${l.id}</td>
                <td class="px-4 py-3 font-medium">${l.equipmentId}</td>
                <td class="px-4 py-3">${iconos[tipo] || '📦'} ${tipo}</td>
                <td class="px-4 py-3">${l.employee}</td>
                <td class="px-4 py-3 text-gray-500">${l.area || '-'}</td>
                <td class="px-4 py-3">${l.conditionOut}</td>
                <td class="px-4 py-3 text-gray-500">${l.startDate}</td>
                <td class="px-4 py-3">${l.durationUnit === 'indefinido' ? 'Indefinido' : l.durationValue + ' ' + l.durationUnit}</td>
                <td class="px-4 py-3"><span class="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">Activo</span></td>
                <td class="px-4 py-3 flex gap-2">
                    <button data-id="${l.id}" class="return-btn px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700">Devolver</button>
                    <button data-eq="${l.equipmentId}" class="loan-qr-row-btn px-3 py-1 text-xs bg-gray-800 text-white rounded hover:bg-black"><i class="fas fa-qrcode"></i></button>
                </td>
            </tr>`;
        }).join('') || '<tr><td colspan="10" class="text-center py-8 text-gray-400">Sin préstamos activos</td></tr>';

    const hiBody = document.getElementById('history-table-body');
    if (hiBody) {
        const searchH = document.getElementById('search-history');
        const filterH = document.getElementById('filter-history');
        const search = searchH ? searchH.value.toLowerCase() : '';
        const filter = filterH ? filterH.value : 'todos';
        const typeBadge = t =>
            t === 'Préstamo' ? 'bg-amber-100 text-amber-800' :
                t === 'Devolución' ? 'bg-green-100 text-green-800' :
                    t === 'Reporte' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600';
        const filtered = history.filter(h => {
            if (filter !== 'todos' && h.type !== filter) return false;
            if (search && !(h.equipmentId.toLowerCase().includes(search) || h.employee.toLowerCase().includes(search))) return false;
            return true;
        });
        hiBody.innerHTML = filtered.map(h => `
            <tr class="hover:bg-gray-50 transition">
                <td class="px-4 py-3 font-semibold text-navy">${h.id}</td>
                <td class="px-4 py-3"><span class="px-3 py-1 rounded-full text-xs font-bold ${typeBadge(h.type)}">${h.type}</span></td>
                <td class="px-4 py-3 font-medium">${h.equipmentId}</td>
                <td class="px-4 py-3">${h.employee}</td>
                <td class="px-4 py-3 text-gray-500">${h.warehousePerson}</td>
                <td class="px-4 py-3 text-gray-500 max-w-xs truncate">${h.details}</td>
                <td class="px-4 py-3 text-gray-500">${h.date}</td>
                <td class="px-4 py-3">
                    <button data-eq="${h.equipmentId}" class="hist-qr-btn px-3 py-1 text-xs bg-gray-800 text-white rounded hover:bg-black">
                        <i class="fas fa-qrcode"></i>
                    </button>
                </td>
            </tr>`).join('') || '<tr><td colspan="8" class="text-center py-8 text-gray-400">Sin resultados</td></tr>';
    }

    const rpBody = document.getElementById('reports-table-body');
    if (rpBody) {
        const searchR = document.getElementById('search-reports');
        const filterR = document.getElementById('filter-reports');
        const search = searchR ? searchR.value.toLowerCase() : '';
        const filter = filterR ? filterR.value : 'todos';

        const prioClass = p =>
            p === 'Alta' ? 'bg-red-100 text-red-800' :
                p === 'Media' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800';

        const statusBadge = s =>
            s === 'Pendiente' ? 'bg-amber-100 text-amber-800' :
                s === 'Aprobado' ? 'bg-blue-100 text-blue-800' :
                    s === 'Rechazado' ? 'bg-red-100 text-red-800' :
                        'bg-green-100 text-green-800';

        const filtered = reports.filter(r => {
            if (filter !== 'todos' && r.status !== filter) return false;
            if (search && !(r.equipmentId.toLowerCase().includes(search) || r.reporter.toLowerCase().includes(search))) return false;
            return true;
        });

        rpBody.innerHTML = filtered.map(r => {
            const eq = dbBase.equipos.find(e => e.id === r.equipmentId);
            const esSolicitud = r.type === 'Solicitud de prestamo';
            const botones = esSolicitud && r.status === 'Pendiente'
                ? `<button data-id="${r.id}" class="aprobar-solicitud-btn px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Aprobar</button>
                   <button data-id="${r.id}" class="rechazar-solicitud-btn px-3 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200">Rechazar</button>`
                : `<button data-id="${r.id}" class="resolve-btn px-3 py-1 text-xs ${r.status === 'Pendiente' ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-100 text-gray-500 cursor-default'} rounded">${r.status === 'Pendiente' ? 'Resolver' : r.status}</button>`;

            return `<tr class="hover:bg-gray-50 transition">
                <td class="px-4 py-3 font-semibold text-navy">${r.id}</td>
                <td class="px-4 py-3">
                    <p class="font-medium">${r.equipmentId}</p>
                    <p class="text-xs text-gray-400">${eq ? eq.marca + ' ' + eq.modelo : '-'}</p>
                </td>
                <td class="px-4 py-3 text-gray-600">${r.type}</td>
                <td class="px-4 py-3 text-gray-500 max-w-xs truncate">${r.description}</td>
                <td class="px-4 py-3">${r.reporter}</td>
                <td class="px-4 py-3"><span class="px-3 py-1 rounded-full text-xs font-bold ${prioClass(r.priority)}">${r.priority}</span></td>
                <td class="px-4 py-3"><span class="px-3 py-1 rounded-full text-xs font-bold ${statusBadge(r.status)}">${r.status}</span></td>
                <td class="px-4 py-3 flex gap-2">
                    ${botones}
                    <button data-eq="${r.equipmentId}" class="rep-qr-btn px-3 py-1 text-xs bg-gray-800 text-white rounded hover:bg-black"><i class="fas fa-qrcode"></i></button>
                </td>
            </tr>`;
        }).join('') || '<tr><td colspan="8" class="text-center py-8 text-gray-400">Sin resultados</td></tr>';
    }
}

function showSection(sectionId) {
    document.querySelectorAll('[id$="-section"]').forEach(s => s.classList.add('hidden'));
    const sec = document.getElementById(sectionId + '-section');
    if (sec) sec.classList.remove('hidden');
    if (['loans', 'history', 'reports'].includes(sectionId)) renderTables();
    if (sectionId === 'monitoring') renderInventory();
    if (sectionId === 'alexa') renderNotifications();
}

function renderNavigation() {
    const items = [
        { id: "dashboard", label: "Dashboard", icon: "fas fa-tachometer-alt" },
        { id: "monitoring", label: "Inventario", icon: "fas fa-desktop", adminOnly: true },
        { id: "loans", label: "EquipaTE", icon: "fas fa-exchange-alt", adminOnly: true },
        { id: "history", label: "Historial", icon: "fas fa-history", adminOnly: true },
        { id: "reports", label: "Reportes", icon: "fas fa-exclamation-triangle" },
        { id: "alexa", label: "Notificaciones", icon: "fas fa-bell" }
    ];
    const filtered = currentRole === 'admin' ? items : items.filter(i => !i.adminOnly);
    document.getElementById('nav-tabs').innerHTML = filtered.map(i =>
        `<li class="flex-shrink-0">
            <button data-section="${i.id}" class="nav-tab px-6 py-3 text-white font-medium whitespace-nowrap hover:bg-navy-light transition">
                <i class="${i.icon} mr-2"></i>${i.label}
            </button>
        </li>`).join('');
}

function bindEvents() {

    document.addEventListener('click', e => {
        if (e.target.closest('.nav-tab'))
            showSection(e.target.closest('.nav-tab').dataset.section);

        if (e.target.closest('#generate-qr-btn')) {
            const id = document.getElementById('equipment-id').innerText;
            if (id && id !== '-') openQrModal(id);
        }

        if (e.target.closest('.hist-qr-btn'))
            openQrModal(e.target.closest('.hist-qr-btn').dataset.eq);

        if (e.target.closest('.loan-qr-row-btn'))
            openQrModal(e.target.closest('.loan-qr-row-btn').dataset.eq);

        if (e.target.closest('.return-btn')) {
            const loanId = e.target.closest('.return-btn').dataset.id;
            const loan = loans.find(l => l.id === loanId);
            if (loan) {
                const condition = prompt("Estado al regresar (Excelente/Bueno/Regular/Malo):", "Bueno");
                if (condition) {
                    loan.status = "Devuelto";
                    loan.conditionIn = condition;
                    loan.returnDate = new Date().toISOString().split('T')[0];
                    dbBase.eventos.push({ id: nextId('EVT', dbBase.eventos), equipoId: loan.equipmentId, tipo: 'devolucion', fecha: new Date().toISOString().split('T')[0], usuario: loan.employee, area: 'Almacén', notas: `Devuelto en estado: ${condition}` });
                    saveDB();
                    history.unshift({ id: 'TR-' + Date.now(), type: "Devolución", equipmentId: loan.equipmentId, employee: loan.employee, warehousePerson: "Admin", details: `Devuelto en estado: ${condition}`, date: new Date().toLocaleString('es-ES'), status: "Completado" });
                    notifications.unshift({ id: 'NT-' + Date.now(), type: "Devolución", message: `Devolución: ${loan.equipmentId} de ${loan.employee}`, date: new Date().toLocaleString('es-ES'), read: false });
                    saveData(); renderTables(); syncDashboard();
                }
            }
        }

        if (e.target.closest('.resolve-btn')) {
            const rid = e.target.closest('.resolve-btn').dataset.id;
            const rep = reports.find(r => r.id === rid);
            if (rep && rep.status === "Pendiente") openResolveModal(rid);
        }

        if (e.target.closest('.rep-qr-btn'))
            openQrModal(e.target.closest('.rep-qr-btn').dataset.eq);

        if (e.target.id === 'quick-loan-btn') {
            showSection('loans');
            openLoanModal();
        }

        if (e.target.id === 'quick-return-btn') {
            const eqId = document.getElementById('equipment-id').innerText;
            if (!eqId || eqId === '-') return;
            const condition = prompt("Estado al regresar (Excelente/Bueno/Regular/Malo):", "Bueno");
            if (!condition) return;
            const loan = loans.find(l => l.equipmentId === eqId && l.status === 'Activo');
            if (loan) {
                loan.status = "Devuelto";
                loan.conditionIn = condition;
                loan.returnDate = new Date().toISOString().split('T')[0];
                history.unshift({ id: 'TR-' + Date.now(), type: "Devolución", equipmentId: eqId, employee: loan.employee, warehousePerson: "Admin", details: `Devuelto en estado: ${condition}`, date: new Date().toLocaleString('es-ES'), status: "Completado" });
                notifications.unshift({ id: 'NT-' + Date.now(), type: "Devolución", message: `Devolución: ${eqId} de ${loan.employee}`, date: new Date().toLocaleString('es-ES'), read: false });
            }
            dbBase.eventos.push({ id: nextId('EVT', dbBase.eventos), equipoId: eqId, tipo: 'devolucion', fecha: new Date().toISOString().split('T')[0], usuario: loan ? loan.employee : '', area: 'Almacén', notas: `Devuelto en estado: ${condition}` });
            saveDB();
            saveData();
            syncDashboard();
            const scanBtn = document.getElementById('scan-btn');
            if (scanBtn) scanBtn.click();
        }

        if (e.target.id === 'repair-btn') {
            const eqId = document.getElementById('equipment-id').innerText;
            if (!eqId || eqId === '-') return;
            dbBase.eventos.push({ id: nextId('EVT', dbBase.eventos), equipoId: eqId, tipo: 'regreso_mantenimiento', fecha: new Date().toISOString().split('T')[0], usuario: '', area: 'Almacén', notas: 'Regreso de mantenimiento desde inventario' });
            saveDB();
            saveData();
            syncDashboard();
            const scanBtn = document.getElementById('scan-btn');
            if (scanBtn) scanBtn.click();
        }

        // Aprobar solicitud de prestamo
        if (e.target.closest('.aprobar-solicitud-btn')) {
            const rid = e.target.closest('.aprobar-solicitud-btn').dataset.id;
            const rep = reports.find(r => r.id === rid);
            if (!rep) return;
            rep.status = 'Aprobado';
            const perfil = Object.values(userProfiles).find(p => p.nombre === rep.reporter);
            dbBase.eventos.push({
                id: nextId('EVT', dbBase.eventos),
                equipoId: rep.equipmentId,
                tipo: 'asignacion',
                fecha: new Date().toISOString().split('T')[0],
                usuario: rep.reporter,
                area: perfil ? perfil.area : 'N/A',
                notas: 'Solicitud aprobada por administrador'
            });
            saveDB();
            notifications.unshift({
                id: 'NT-' + Date.now(),
                type: 'Préstamo',
                message: 'Solicitud aprobada: ' + rep.equipmentId + ' asignado a ' + rep.reporter,
                date: new Date().toLocaleString('es-ES'),
                read: false
            });
            const eventosUser = JSON.parse(localStorage.getItem('user-eventos') || '[]');
            eventosUser.push({
                equipmentId: rep.equipmentId,
                reporter: rep.reporter,
                tipo: 'aprobado',
                fecha: new Date().toLocaleString('es-ES')
            });
            localStorage.setItem('user-eventos', JSON.stringify(eventosUser));
            saveData();
            renderTables();
            syncDashboard();
            showReportSuccess('Solicitud aprobada', rep.equipmentId + ' asignado a ' + rep.reporter);
        }

        // Rechazar solicitud de prestamo
        if (e.target.closest('.rechazar-solicitud-btn')) {
            const rid = e.target.closest('.rechazar-solicitud-btn').dataset.id;
            const rep = reports.find(r => r.id === rid);
            if (!rep) return;
            rep.status = 'Rechazado';
            notifications.unshift({
                id: 'NT-' + Date.now(),
                type: 'Reporte',
                message: 'Solicitud rechazada: ' + rep.equipmentId + ' para ' + rep.reporter,
                date: new Date().toLocaleString('es-ES'),
                read: false
            });
            const eventosUser = JSON.parse(localStorage.getItem('user-eventos') || '[]');
            eventosUser.push({
                equipmentId: rep.equipmentId,
                reporter: rep.reporter,
                tipo: 'rechazado',
                fecha: new Date().toLocaleString('es-ES')
            });
            localStorage.setItem('user-eventos', JSON.stringify(eventosUser));
            saveData();
            renderTables();
            syncDashboard();
        }

        // Filtro notificaciones
        const filterBtn = e.target.closest('.notif-filter-btn');
        if (filterBtn) {
            renderNotifications(filterBtn.dataset.filter);
            return;
        }

        // Borrar notificacion individual
        const delBtn = e.target.closest('.notif-delete-btn');
        if (delBtn) {
            notifications = notifications.filter(n => n.id !== delBtn.dataset.id);
            saveData();
            const activeBtn = document.querySelector('.notif-filter-btn.bg-navy');
            renderNotifications(activeBtn ? activeBtn.dataset.filter : 'todos');
        }
    });

    // QR Inventario
    const scanBtn = document.getElementById('scan-btn');
    if (scanBtn) scanBtn.addEventListener('click', () => {
        const id = document.getElementById('qr-input').value.trim().toUpperCase();
        const eq = dbBase.equipos.find(e => e.id === id);
        if (eq) {
            const info = getEstado(eq.id);
            document.getElementById('equipment-info').classList.remove('hidden');
            document.getElementById('equipment-id').innerText = eq.id;
            document.getElementById('equipment-type').innerText = eq.tipo;
            document.getElementById('equipment-model').innerText = `${eq.marca} ${eq.modelo}`;
            document.getElementById('equipment-status').innerText = info.estado;
            document.getElementById('equipment-status').className = `px-3 py-1 rounded-full text-xs ${statusColors[info.estado] || 'bg-gray-100'}`;
            document.getElementById('equipment-actions').innerHTML =
                info.estado === 'Disponible'
                    ? `<button id="quick-loan-btn" class="w-full px-4 py-2 bg-navy text-white rounded-lg text-sm">Asignar equipo</button>`
                    : info.estado === 'Asignado'
                        ? `<button id="quick-return-btn" class="w-full px-4 py-2 bg-green-600 text-white rounded-lg text-sm">Registrar devolución</button>`
                        : `<button id="repair-btn" class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">Regreso de mantenimiento</button>`;
        } else {
            alert('Equipo no encontrado.');
        }
    });

    const clearBtn = document.getElementById('clear-btn');
    if (clearBtn) clearBtn.addEventListener('click', () => {
        document.getElementById('qr-input').value = '';
        document.getElementById('equipment-info').classList.add('hidden');
    });

    const si = document.getElementById('search-inventory');
    if (si) si.addEventListener('keyup', renderInventory);

    const loanQrScanBtn = document.getElementById('loan-qr-scan-btn');
    if (loanQrScanBtn) loanQrScanBtn.addEventListener('click', () => {
        const id = document.getElementById('loan-qr-input').value.trim().toUpperCase();
        const eq = dbBase.equipos.find(e => e.id === id);
        if (!eq) { alert('Equipo no encontrado.'); return; }
        const info = getEstado(eq.id);
        const iconos = { Laptop: '💻', Monitor: '🖥️', Mouse: '🖱️', Teclado: '⌨️', CPU: '🖥', 'Audífonos': '🎧', Asistente: '🔊', Tablet: '📱', Impresora: '🖨️', Otro: '📦' };
        document.getElementById('loan-qr-result').classList.remove('hidden');
        document.getElementById('loan-qr-icon').textContent = iconos[eq.tipo] || '📦';
        document.getElementById('loan-qr-id').textContent = eq.id;
        document.getElementById('loan-qr-nombre').textContent = `${eq.marca} ${eq.modelo}`;
        document.getElementById('loan-qr-status').textContent = info.estado;
        document.getElementById('loan-qr-status').className = `px-2 py-1 rounded-full text-xs font-bold ${statusColors[info.estado] || 'bg-gray-100'}`;
        const assignBtn = document.getElementById('loan-qr-assign-btn');
        const viewBtn = document.getElementById('loan-qr-view-btn');
        assignBtn.classList.toggle('hidden', info.estado !== 'Disponible');
        viewBtn.classList.remove('hidden');
        assignBtn.onclick = () => {
            loanEquipoSeleccionado = eq.id;
            openLoanModal();
            setTimeout(() => {
                loanEquipoSeleccionado = eq.id;
                document.getElementById('loan-next-btn').disabled = false;
            }, 300);
        };
        viewBtn.onclick = () => openQrModal(eq.id);
    });

    const loanQrClearBtn = document.getElementById('loan-qr-clear-btn');
    if (loanQrClearBtn) loanQrClearBtn.addEventListener('click', () => {
        document.getElementById('loan-qr-input').value = '';
        document.getElementById('loan-qr-result').classList.add('hidden');
    });

    document.getElementById('new-loan-btn').onclick = () => openLoanModal();
    document.getElementById('new-report-btn').onclick = () => openReportModal();

    const sr = document.getElementById('search-reports');
    const fr = document.getElementById('filter-reports');
    if (sr) sr.addEventListener('keyup', renderTables);
    if (fr) fr.addEventListener('change', renderTables);

    const rqsBtn = document.getElementById('report-qr-scan-btn');
    if (rqsBtn) rqsBtn.addEventListener('click', () => {
        const id = document.getElementById('report-qr-input').value.trim().toUpperCase();
        const eq = dbBase.equipos.find(e => e.id === id);
        if (!eq) { alert('Equipo no encontrado.'); return; }
        const info = getEstado(eq.id);
        const iconos = { Laptop: '💻', Monitor: '🖥️', Mouse: '🖱️', Teclado: '⌨️', CPU: '🖥', 'Audífonos': '🎧', Asistente: '🔊', Tablet: '📱', Impresora: '🖨️', Otro: '📦' };
        document.getElementById('report-qr-result').classList.remove('hidden');
        document.getElementById('report-qr-icon').textContent = iconos[eq.tipo] || '📦';
        document.getElementById('report-qr-id').textContent = eq.id;
        document.getElementById('report-qr-nombre').textContent = `${eq.marca} ${eq.modelo}`;
        document.getElementById('report-qr-status').textContent = info.estado;
        document.getElementById('report-qr-status').className = `px-2 py-1 rounded-full text-xs font-bold ${statusColors[info.estado] || 'bg-gray-100'}`;
        document.getElementById('report-qr-new-btn').onclick = () => openReportModal(eq.id);
    });

    const rqcBtn = document.getElementById('report-qr-clear-btn');
    if (rqcBtn) rqcBtn.addEventListener('click', () => {
        document.getElementById('report-qr-input').value = '';
        document.getElementById('report-qr-result').classList.add('hidden');
    });

    document.getElementById('clear-notifications-btn').onclick = () => {
        if (confirm("¿Borrar historial de notificaciones?")) {
            notifications = [];
            saveData();
            renderNotifications();
        }
    };

    document.getElementById('notification-bell').onclick = (e) => {
        e.stopPropagation();
        const dropdown = document.getElementById('notif-dropdown');
        const isOpen = !dropdown.classList.contains('hidden');
        dropdown.classList.toggle('hidden', isOpen);
        if (!isOpen) renderNotifDropdown();
    };

    document.getElementById('notif-dropdown-ver-todas').onclick = (e) => {
        e.stopPropagation();
        document.getElementById('notif-dropdown').classList.add('hidden');
        showSection('alexa');
        notifications.forEach(n => n.read = true);
        saveData();
        updateNotificationCount();
    };

    document.addEventListener('click', () => {
        const dropdown = document.getElementById('notif-dropdown');
        if (dropdown) dropdown.classList.add('hidden');
    });

    const refreshBtn = document.getElementById('refresh-equipment');
    if (refreshBtn) refreshBtn.onclick = () => renderInventory();

    const sh = document.getElementById('search-history');
    const fh = document.getElementById('filter-history');
    if (sh) sh.addEventListener('keyup', renderTables);
    if (fh) fh.addEventListener('change', renderTables);
}

function renderDashboardKanban() {
    const groups = { available: [], loaned: [], reported: [] };
    dbBase.equipos.forEach(eq => {
        const estado = getEstado(eq.id).estado;
        if (estado === 'Disponible') groups.available.push(eq);
        else if (estado === 'Asignado') groups.loaned.push(eq);
        else groups.reported.push(eq);
    });
    const barClass = g => g === 'available' ? 'ok' : g === 'loaned' ? 'warn' : 'crit';
    const dotColor = g => g === 'available' ? 'var(--green)' : g === 'loaned' ? 'var(--amber)' : 'var(--red)';
    const barW = g => g === 'available' ? '100%' : g === 'loaned' ? '60%' : '100%';
    const cardHtml = (eq, group) => {
        const info = getEstado(eq.id);
        return `<div class="kcard">
            <div class="kcard-top"><span class="kcard-id">${eq.id}</span><div class="kcard-sdot" style="background:${dotColor(group)}"></div></div>
            <div class="kcard-name">${eq.marca} ${eq.modelo}</div>
            <div class="bar-wrap"><div class="bar ${barClass(group)}" style="width:${barW(group)}"></div></div>
            <div class="kcard-meta">${eq.tipo} · ${info.area}</div>
        </div>`;
    };
    document.getElementById('zone-reported').innerHTML = groups.reported.map(e => cardHtml(e, 'reported')).join('') || '<div class="kcard-meta" style="text-align:center;padding:8px">Sin equipos reportados</div>';
    document.getElementById('zone-loaned').innerHTML = groups.loaned.map(e => cardHtml(e, 'loaned')).join('') || '<div class="kcard-meta" style="text-align:center;padding:8px">Sin préstamos activos</div>';
    document.getElementById('zone-available').innerHTML = groups.available.map(e => cardHtml(e, 'available')).join('') || '<div class="kcard-meta" style="text-align:center;padding:8px">Sin equipos disponibles</div>';
    document.getElementById('cnt-reported').textContent = groups.reported.length;
    document.getElementById('cnt-loaned').textContent = groups.loaned.length;
    document.getElementById('cnt-available').textContent = groups.available.length;
    document.getElementById('ai-suggestion').textContent = `${dbBase.equipos.length} equipos en sistema. ${groups.available.length} disponibles, ${groups.loaned.length} asignados.`;
    const card2 = document.getElementById('ai-card-2');
    if (groups.reported.length) {
        document.getElementById('ai-alert').textContent = `${groups.reported[0].id} requiere atención.`;
        card2.style.display = 'block';
    } else {
        card2.style.display = 'none';
    }
}

function renderDashLog() {
    const log = document.getElementById('dash-log');
    if (!log) return;
    const recent = [...dbBase.eventos].sort((a, b) => new Date(b.fecha) - new Date(a.fecha)).slice(0, 8);
    if (!recent.length) { log.innerHTML = '<div class="log-item">Sin actividad reciente</div>'; return; }
    log.innerHTML = recent.map(ev => `<div class="log-item"><span class="ts">${ev.fecha}</span>${ev.equipoId} → ${ev.tipo}${ev.usuario ? ' · ' + ev.usuario : ''}</div>`).join('');
}

function showWelcome() {
    const w = document.getElementById('wcard');
    const p = document.getElementById('wprog');
    document.getElementById('wtitle').textContent = 'END TO END';
    document.getElementById('wsub').textContent = 'management platform · iniciando sistema...';
    w.classList.add('show');
    setTimeout(() => p.style.width = '100%', 150);
    setTimeout(() => w.classList.remove('show'), 2800);
}

let loanEquipoSeleccionado = null;

function openLoanModal() {
    loanEquipoSeleccionado = null;
    document.getElementById('modal-loan').classList.remove('hidden');
    loanGoStep1();
    filtrarDisponibles(document.querySelector('.tipo-btn[data-tipo=""]'));
}

function closeLoanModal() {
    document.getElementById('modal-loan').classList.add('hidden');
    loanEquipoSeleccionado = null;
}

function filtrarDisponibles(btn) {
    document.querySelectorAll('.tipo-btn').forEach(b => {
        b.classList.remove('bg-navy', 'text-white', 'border-navy');
        b.classList.add('bg-white', 'text-gray-600', 'border-gray-300');
    });
    btn.classList.add('bg-navy', 'text-white', 'border-navy');
    btn.classList.remove('bg-white', 'text-gray-600', 'border-gray-300');
    const tipo = btn.dataset.tipo;
    const disponibles = dbBase.equipos.filter(eq => {
        const estado = getEstado(eq.id).estado;
        return estado === 'Disponible' && (tipo === '' || eq.tipo === tipo);
    });
    const grid = document.getElementById('loan-equipos-grid');
    const noDisp = document.getElementById('loan-no-disponibles');
    if (disponibles.length === 0) { grid.innerHTML = ''; noDisp.classList.remove('hidden'); return; }
    noDisp.classList.add('hidden');
    const iconos = { Laptop: '💻', Monitor: '🖥️', Mouse: '🖱️', Teclado: '⌨️', CPU: '🖥', 'Audífonos': '🎧', Asistente: '🔊', Tablet: '📱', Impresora: '🖨️', Otro: '📦' };
    grid.innerHTML = disponibles.map(eq => `
        <div data-id="${eq.id}" onclick="seleccionarEquipoLoan(this)"
            class="loan-eq-card border-2 border-gray-200 rounded-xl p-3 cursor-pointer hover:border-navy transition select-none">
            <div class="text-2xl mb-2">${iconos[eq.tipo] || '📦'}</div>
            <p class="font-bold text-navy text-xs">${eq.id}</p>
            <p class="text-gray-600 text-xs mt-0.5">${eq.nombre}</p>
            <p class="text-gray-400 text-xs">${eq.marca} ${eq.modelo}</p>
        </div>`).join('');
}

function seleccionarEquipoLoan(card) {
    document.querySelectorAll('.loan-eq-card').forEach(c => {
        c.classList.remove('border-navy', 'bg-blue-50');
        c.classList.add('border-gray-200');
    });
    card.classList.add('border-navy', 'bg-blue-50');
    card.classList.remove('border-gray-200');
    loanEquipoSeleccionado = card.dataset.id;
    document.getElementById('loan-next-btn').disabled = false;
}

function loanGoStep2() {
    if (!loanEquipoSeleccionado) return;
    const eq = dbBase.equipos.find(e => e.id === loanEquipoSeleccionado);
    const iconos = { Laptop: '💻', Monitor: '🖥️', Mouse: '🖱️', Teclado: '⌨️', CPU: '🖥', 'Audífonos': '🎧', Asistente: '🔊', Tablet: '📱', Impresora: '🖨️', Otro: '📦' };
    document.getElementById('loan-eq-icon').textContent = iconos[eq.tipo] || '📦';
    document.getElementById('loan-eq-id-label').textContent = eq.id;
    document.getElementById('loan-eq-nombre-label').textContent = `${eq.marca} ${eq.modelo}`;
    document.getElementById('loan-step-1').classList.add('hidden');
    document.getElementById('loan-step-2').classList.remove('hidden');
    document.getElementById('step-1-indicator').classList.remove('bg-navy', 'text-white');
    document.getElementById('step-1-indicator').classList.add('bg-green-500', 'text-white');
    document.getElementById('step-2-indicator').classList.remove('bg-gray-200', 'text-gray-500');
    document.getElementById('step-2-indicator').classList.add('bg-navy', 'text-white');
    document.getElementById('loan-employee').value = '';
    document.getElementById('loan-area').value = '';
    document.getElementById('loan-notes').value = '';
}

function loanGoStep1() {
    document.getElementById('loan-step-1').classList.remove('hidden');
    document.getElementById('loan-step-2').classList.add('hidden');
    document.getElementById('step-1-indicator').classList.add('bg-navy', 'text-white');
    document.getElementById('step-1-indicator').classList.remove('bg-green-500');
    document.getElementById('step-2-indicator').classList.remove('bg-navy', 'text-white');
    document.getElementById('step-2-indicator').classList.add('bg-gray-200', 'text-gray-500');
    document.getElementById('loan-next-btn').disabled = true;
    loanEquipoSeleccionado = null;
}

function saveLoan() {
    const eqId = loanEquipoSeleccionado;
    const emp = document.getElementById('loan-employee').value.trim();
    const area = document.getElementById('loan-area').value.trim();
    const val = parseInt(document.getElementById('loan-duration-value').value);
    const unit = document.getElementById('loan-duration-unit').value;
    const cond = document.getElementById('loan-condition-out').value;
    const notes = document.getElementById('loan-notes').value.trim();
    if (!emp || !area) { alert('Empleado y área son obligatorios.'); return; }
    const eq = dbBase.equipos.find(e => e.id === eqId);
    dbBase.eventos.push({ id: nextId('EVT', dbBase.eventos), equipoId: eqId, tipo: 'asignacion', fecha: new Date().toISOString().split('T')[0], usuario: emp, area, notas: `Préstamo ${unit === 'indefinido' ? 'indefinido' : val + ' ' + unit} · ${cond}${notes ? ' · ' + notes : ''}` });
    saveDB();
    loans.push({ id: 'LN-' + Date.now(), equipmentId: eqId, employee: emp, warehousePerson: "Admin", conditionOut: cond, conditionIn: "", durationValue: unit === 'indefinido' ? null : val, durationUnit: unit, startDate: new Date().toISOString().split('T')[0], returnDate: "", status: "Activo", notes, area });
    history.unshift({ id: 'TR-' + Date.now(), type: "Préstamo", equipmentId: eqId, employee: emp, warehousePerson: "Admin", details: `Préstamo ${unit === 'indefinido' ? 'indefinido' : val + ' ' + unit}`, date: new Date().toLocaleString('es-ES'), status: "Completado" });
    notifications.unshift({ id: 'NT-' + Date.now(), type: "Préstamo", message: `Nuevo préstamo: ${eqId} a ${emp} (${area})`, date: new Date().toLocaleString('es-ES'), read: false });
    saveData(); renderTables(); syncDashboard();
    closeLoanModal();
    showLoanSuccess(eqId, eq ? `${eq.marca} ${eq.modelo}` : eqId, emp);
}

function showLoanSuccess(eqId, nombre, empleado) {
    const w = document.getElementById('loan-success-card');
    const p = document.getElementById('loan-success-prog');
    document.getElementById('loan-success-title').textContent = 'Asignación registrada';
    document.getElementById('loan-success-sub').textContent = `${eqId} — ${nombre} → ${empleado}`;
    p.style.width = '0';
    w.classList.add('show');
    setTimeout(() => p.style.width = '100%', 100);
    setTimeout(() => w.classList.remove('show'), 3000);
}

function openReportModal(prefilledId = '') {
    document.getElementById('modal-report').classList.remove('hidden');
    document.getElementById('report-equipment-id').value = prefilledId;
    document.getElementById('report-reporter').value = '';
    document.getElementById('report-description').value = '';
    document.getElementById('report-type').value = 'Equipo Fallado';
    document.getElementById('report-priority').value = 'Alta';
    document.getElementById('report-eq-dropdown').classList.add('hidden');

    const input = document.getElementById('report-equipment-id');
    input.addEventListener('input', function () {
        const val = this.value.toLowerCase();
        const dropdown = document.getElementById('report-eq-dropdown');
        if (!val) { dropdown.classList.add('hidden'); return; }
        const matches = dbBase.equipos.filter(eq =>
            eq.id.toLowerCase().includes(val) ||
            eq.nombre.toLowerCase().includes(val) ||
            eq.marca.toLowerCase().includes(val)
        ).slice(0, 6);
        if (matches.length === 0) { dropdown.classList.add('hidden'); return; }
        const iconos = { Laptop: '💻', Monitor: '🖥️', Mouse: '🖱️', Teclado: '⌨️', CPU: '🖥', 'Audífonos': '🎧', Asistente: '🔊', Tablet: '📱', Impresora: '🖨️', Otro: '📦' };
        dropdown.innerHTML = matches.map(eq => {
            const info = getEstado(eq.id);
            return `<div class="dropdown-item px-3 py-2 hover:bg-gray-50 cursor-pointer flex items-center gap-2 border-b last:border-0" data-id="${eq.id}">
                <span>${iconos[eq.tipo] || '📦'}</span>
                <div>
                    <p class="text-xs font-bold text-navy">${eq.id}</p>
                    <p class="text-xs text-gray-500">${eq.marca} ${eq.modelo}</p>
                </div>
                <span class="ml-auto text-xs px-2 py-0.5 rounded-full ${statusColors[info.estado] || 'bg-gray-100'}">${info.estado}</span>
            </div>`;
        }).join('');
        dropdown.classList.remove('hidden');
        dropdown.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', () => {
                document.getElementById('report-equipment-id').value = item.dataset.id;
                dropdown.classList.add('hidden');
            });
        });
    });
}

function closeReportModal() {
    document.getElementById('modal-report').classList.add('hidden');
    document.getElementById('report-eq-dropdown').classList.add('hidden');
}

let pendingResolveId = null;

function openResolveModal(reportId) {
    const rep = reports.find(r => r.id === reportId);
    if (!rep) return;
    const eq = dbBase.equipos.find(e => e.id === rep.equipmentId);
    pendingResolveId = reportId;
    document.getElementById('resolve-eq-label').textContent = `${rep.equipmentId}${eq ? ' — ' + eq.marca + ' ' + eq.modelo : ''}`;
    document.getElementById('resolve-desc-label').textContent = rep.description.substring(0, 80);
    document.getElementById('modal-resolve').classList.remove('hidden');
}

function closeResolveModal() {
    document.getElementById('modal-resolve').classList.add('hidden');
    pendingResolveId = null;
}

function confirmResolve() {
    const rep = reports.find(r => r.id === pendingResolveId);
    if (!rep) return;
    rep.status = "Resuelto";
    dbBase.eventos.push({ id: nextId('EVT', dbBase.eventos), equipoId: rep.equipmentId, tipo: 'regreso_mantenimiento', fecha: new Date().toISOString().split('T')[0], usuario: '', area: 'Almacén', notas: `Reporte resuelto: ${rep.type}` });
    saveDB();
    notifications.unshift({ id: 'NT-' + Date.now(), type: "Reporte", message: `Reporte resuelto: ${rep.equipmentId}`, date: new Date().toLocaleString('es-ES'), read: false });
    saveData(); renderTables(); syncDashboard();
    closeResolveModal();
    const eq = dbBase.equipos.find(e => e.id === rep.equipmentId);
    showReportSuccess('Reporte resuelto', `${rep.equipmentId}${eq ? ' — ' + eq.marca + ' ' + eq.modelo : ''}`);
}

function saveReport() {
    const eqId = document.getElementById('report-equipment-id').value.trim().toUpperCase();
    const type = document.getElementById('report-type').value;
    const desc = document.getElementById('report-description').value.trim();
    const reporter = document.getElementById('report-reporter').value.trim();
    const priority = document.getElementById('report-priority').value;
    if (!eqId || !desc || !reporter) { alert("Complete todos los campos"); return; }
    const eq = dbBase.equipos.find(e => e.id === eqId);
    if (!eq) { alert("Equipo no encontrado en inventario"); return; }
    dbBase.eventos.push({ id: nextId('EVT', dbBase.eventos), equipoId: eqId, tipo: 'envio_mantenimiento', fecha: new Date().toISOString().split('T')[0], usuario: reporter, area: 'Taller', notas: `${type}: ${desc}` });
    saveDB();
    reports.push({ id: 'RP-' + Date.now(), equipmentId: eqId, type, description: desc, reporter, priority, date: new Date().toISOString().split('T')[0], status: "Pendiente" });
    history.unshift({ id: 'TR-' + Date.now(), type: "Reporte", equipmentId: eqId, employee: reporter, warehousePerson: currentRole === 'admin' ? "Admin" : "Empleado", details: `${type}: ${desc.substring(0, 50)}`, date: new Date().toLocaleString('es-ES'), status: "Pendiente" });
    notifications.unshift({ id: 'NT-' + Date.now(), type: "Reporte", message: `Reporte: ${eqId} - ${type} (${priority})`, date: new Date().toLocaleString('es-ES'), read: false });
    saveData(); renderTables(); syncDashboard();
    closeReportModal();
    showReportSuccess('Reporte registrado', `${eqId} — ${type} · Prioridad ${priority}`);
}

function showReportSuccess(mensaje, subtitulo) {
    const w = document.getElementById('loan-success-card');
    const p = document.getElementById('loan-success-prog');
    document.getElementById('loan-success-title').textContent = mensaje;
    document.getElementById('loan-success-sub').textContent = subtitulo;
    p.style.width = '0';
    w.classList.add('show');
    setTimeout(() => p.style.width = '100%', 100);
    setTimeout(() => w.classList.remove('show'), 3000);
}

function renderNotifDropdown() {
    const list = document.getElementById('notif-dropdown-list');
    if (!list) return;
    const recent = notifications.slice(0, 4);
    if (recent.length === 0) {
        list.innerHTML = '<div class="px-4 py-4 text-center text-xs text-gray-400">Sin notificaciones</div>';
        return;
    }
    const tagColor = type =>
        type === 'Préstamo' ? 'bg-amber-100 text-amber-800' :
            type === 'Devolución' ? 'bg-green-100 text-green-800' :
                'bg-red-100 text-red-800';
    list.innerHTML = recent.map(n => `
        <div class="px-4 py-3 hover:bg-gray-50 transition">
            <div class="flex items-start gap-2">
                <span class="px-2 py-0.5 text-xs rounded flex-shrink-0 ${tagColor(n.type)}">${n.type}</span>
                <div class="flex-1 min-w-0">
                    <p class="text-xs text-gray-700 truncate">${n.message}</p>
                    <p class="text-xs text-gray-400 mt-0.5">${n.date}</p>
                </div>
                ${!n.read ? '<div class="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1"></div>' : ''}
            </div>
        </div>`).join('');
    const label = document.getElementById('notif-dropdown-count-label');
    if (label) label.textContent = notifications.length > 4
        ? `Mostrando 4 de ${notifications.length}`
        : `${notifications.length} notificacion${notifications.length !== 1 ? 'es' : ''}`;
}

function initApp() {
    loadDB();
    loadData();
    initInventory();
    document.getElementById('user-role-badge').innerHTML =
        currentRole === 'admin'
            ? '<i class="fas fa-crown"></i> Administrador'
            : '<i class="fas fa-user"></i> Empleado';
    renderNavigation();
    bindEvents();
    updateStats();
    updateNotificationCount();
    renderTables();
    renderNotifications();
    renderDashboardKanban();
    renderDashLog();
    showSection('dashboard');
    showWelcome();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}