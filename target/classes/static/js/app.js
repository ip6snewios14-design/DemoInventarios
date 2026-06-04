// Lee el rol que Spring inyectó en el <meta> tag
const currentRole = document.getElementById('app-role').content;

// ---------- DATOS ----------
let equipment = [], loans = [], history = [], reports = [], notifications = [];

const initialEquipment = [
    { id: "LAP-001", type: "Laptop", brand: "Dell", model: "Latitude 5420", status: "Disponible", condition: "Excelente", location: "Almacén A" },
    { id: "LAP-002", type: "Laptop", brand: "HP", model: "EliteBook 840", status: "En Préstamo", condition: "Bueno", location: "Juan Pérez" },
    { id: "MON-001", type: "Monitor", brand: "Samsung", model: "24\" FHD", status: "Disponible", condition: "Excelente", location: "Almacén B" },
    { id: "MOU-001", type: "Mouse", brand: "Logitech", model: "MX Master 3", status: "Disponible", condition: "Excelente", location: "Almacén A" },
    { id: "KEY-001", type: "Teclado", brand: "Logitech", model: "K380", status: "En Préstamo", condition: "Regular", location: "María García" },
    { id: "CPU-001", type: "CPU", brand: "Dell", model: "OptiPlex 3090", status: "Reportado", condition: "Dañado", location: "Taller" },
    { id: "LAP-003", type: "Laptop", brand: "Apple", model: "MacBook Pro", status: "Disponible", condition: "Excelente", location: "Almacén A" },
    { id: "MON-002", type: "Monitor", brand: "Dell", model: "27\" 4K", status: "En Préstamo", condition: "Bueno", location: "Carlos López" }
];
const initialLoans = [
    { id: "LN-001", equipmentId: "LAP-002", employee: "Juan Pérez", warehousePerson: "Ana Martínez", conditionOut: "Bueno", conditionIn: "", durationValue: 14, durationUnit: "dias", startDate: "2025-06-01", returnDate: "", status: "Activo", notes: "" },
    { id: "LN-002", equipmentId: "KEY-001", employee: "María García", warehousePerson: "Ana Martínez", conditionOut: "Regular", conditionIn: "", durationValue: 1, durationUnit: "meses", startDate: "2025-06-03", returnDate: "", status: "Activo", notes: "" }
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
    statusColors: { "Disponible": "bg-green-100 text-green-800", "En Préstamo": "bg-amber-100 text-amber-800", "Reportado": "bg-red-100 text-red-800" },
    priorityColors: { "Alta": "bg-red-100 text-red-800", "Media": "bg-amber-100 text-amber-800", "Baja": "bg-green-100 text-green-800" }
};

// ---------- PERSISTENCIA ----------
function loadData() {
    equipment = JSON.parse(localStorage.getItem('warehouse-equipment')) || JSON.parse(JSON.stringify(initialEquipment));
    loans = JSON.parse(localStorage.getItem('warehouse-loans')) || JSON.parse(JSON.stringify(initialLoans));
    history = JSON.parse(localStorage.getItem('warehouse-history')) || JSON.parse(JSON.stringify(initialHistory));
    reports = JSON.parse(localStorage.getItem('warehouse-reports')) || JSON.parse(JSON.stringify(initialReports));
    notifications = JSON.parse(localStorage.getItem('warehouse-notifications')) || JSON.parse(JSON.stringify(initialNotifications));
}

function saveData() {
    localStorage.setItem('warehouse-equipment', JSON.stringify(equipment));
    localStorage.setItem('warehouse-loans', JSON.stringify(loans));
    localStorage.setItem('warehouse-history', JSON.stringify(history));
    localStorage.setItem('warehouse-reports', JSON.stringify(reports));
    localStorage.setItem('warehouse-notifications', JSON.stringify(notifications));
    updateStats();
    updateNotificationCount();
    renderNotifications();
    renderDashboardKanban();  // ← agrega
    renderDashLog();   
}

// ---------- STATS ----------
function updateStats() {
    document.getElementById('total-equipment').innerText = equipment.length;
    document.getElementById('available-equipment').innerText = equipment.filter(e => e.status === 'Disponible').length;
    document.getElementById('loaned-equipment').innerText = equipment.filter(e => e.status === 'En Préstamo').length;
    document.getElementById('reported-equipment').innerText = equipment.filter(e => e.status === 'Reportado').length;
}

function updateNotificationCount() {
    const unread = notifications.filter(n => !n.read).length;
    document.getElementById('notification-count').innerText = unread;
    document.getElementById('total-notifications').innerText = notifications.length;
    document.getElementById('loan-notifications').innerText = notifications.filter(n => n.type === 'Préstamo').length;
    document.getElementById('return-notifications').innerText = notifications.filter(n => n.type === 'Devolución').length;
    document.getElementById('report-notifications').innerText = notifications.filter(n => n.type === 'Reporte').length;
}

// ---------- RENDER ----------
function renderNotifications() {
    const container = document.getElementById('speech-messages');
    if (!container) return;
    if (notifications.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-500 py-8">No hay notificaciones recientes</div>';
        return;
    }
    container.innerHTML = notifications.slice(0, 15).map(n => `
        <div class="speech-bubble">
            <div class="flex justify-between items-start">
                <div>
                    <p class="text-gray-700">${n.message}</p>
                    <p class="text-xs text-gray-500 mt-1">${n.date}</p>
                </div>
                <span class="px-2 py-1 text-xs rounded ${n.type === 'Préstamo' ? 'bg-amber-100' : n.type === 'Devolución' ? 'bg-green-100' : 'bg-red-100'}">${n.type}</span>
            </div>
        </div>
    `).join('');
}

function renderTables() {
    const eqBody = document.getElementById('equipment-table-body');
    if (eqBody)
        eqBody.innerHTML = equipment.map(e => `
            <tr>
                <td class="px-6 py-4 font-medium">${e.id}</td>
                <td class="px-6 py-4">${e.type}</td>
                <td class="px-6 py-4">${e.brand} ${e.model}</td>
                <td class="px-6 py-4"><span class="px-3 py-1 rounded-full text-xs ${appData.statusColors[e.status]}">${e.status}</span></td>
                <td class="px-6 py-4">${e.condition}</td>
                <td class="px-6 py-4">${e.location}</td>
                <td class="px-6 py-4"><button data-id="${e.id}" class="quick-action-btn px-3 py-1 text-sm ${e.status === 'Disponible' ? 'bg-navy text-white' : 'bg-gray-100'} rounded">${e.status === 'Disponible' ? 'Prestar' : 'Ver'}</button></td>
            </tr>`).join('');

    const lnBody = document.getElementById('loans-table-body');
    if (lnBody)
        lnBody.innerHTML = loans.filter(l => l.status === 'Activo').map(l => `
            <tr>
                <td class="px-6 py-4 font-medium">${l.id}</td>
                <td class="px-6 py-4">${l.equipmentId}</td>
                <td class="px-6 py-4">${l.employee}</td>
                <td class="px-6 py-4">${l.warehousePerson}</td>
                <td class="px-6 py-4">${l.conditionOut}</td>
                <td class="px-6 py-4">${l.startDate}</td>
                <td class="px-6 py-4">${l.durationUnit === 'indefinido' ? 'Indefinido' : l.durationValue + ' ' + l.durationUnit}</td>
                <td class="px-6 py-4"><span class="px-3 py-1 rounded-full text-xs bg-amber-100">Activo</span></td>
                <td class="px-6 py-4"><button data-id="${l.id}" class="return-btn px-3 py-1 text-sm bg-green-600 text-white rounded">Devolver</button></td>
            </tr>`).join('');

    const hiBody = document.getElementById('history-table-body');
    if (hiBody)
        hiBody.innerHTML = history.map(h => `
            <tr>
                <td class="px-6 py-4 font-medium">${h.id}</td>
                <td class="px-6 py-4">${h.type}</td>
                <td class="px-6 py-4">${h.equipmentId}</td>
                <td class="px-6 py-4">${h.employee}</td>
                <td class="px-6 py-4">${h.warehousePerson}</td>
                <td class="px-6 py-4">${h.details}</td>
                <td class="px-6 py-4">${h.date}</td>
            </tr>`).join('');

    const rpBody = document.getElementById('reports-table-body');
    if (rpBody)
        rpBody.innerHTML = reports.map(r => `
            <tr>
                <td class="px-6 py-4 font-medium">${r.id}</td>
                <td class="px-6 py-4">${r.equipmentId}</td>
                <td class="px-6 py-4">${r.type}</td>
                <td class="px-6 py-4 truncate max-w-xs">${r.description}</td>
                <td class="px-6 py-4">${r.reporter}</td>
                <td class="px-6 py-4"><span class="px-3 py-1 rounded-full text-xs ${appData.priorityColors[r.priority]}">${r.priority}</span></td>
                <td class="px-6 py-4"><button data-id="${r.id}" class="resolve-btn px-3 py-1 text-sm ${r.status === 'Pendiente' ? 'bg-green-600 text-white' : 'bg-gray-100'} rounded">${r.status === 'Pendiente' ? 'Resolver' : 'Resuelto'}</button></td>
            </tr>`).join('');
}

// ---------- NAVEGACIÓN ----------
function showSection(sectionId) {
    document.querySelectorAll('[id$="-section"]').forEach(s => s.classList.add('hidden'));
    const sec = document.getElementById(sectionId + '-section');
    if (sec) sec.classList.remove('hidden');
    if (['monitoring', 'loans', 'history', 'reports'].includes(sectionId)) renderTables();
    if (sectionId === 'alexa') renderNotifications();
}

function renderNavigation() {
    const items = [
        { id: "dashboard", label: "Dashboard", icon: "fas fa-tachometer-alt" },
        { id: "monitoring", label: "Monitoreo", icon: "fas fa-desktop", adminOnly: true },
        { id: "loans", label: "Préstamos", icon: "fas fa-exchange-alt", adminOnly: true },
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
        </li>`
    ).join('');
}

// ---------- EVENTOS ----------
function bindEvents() {
    // Navegación
    document.addEventListener('click', e => {
        if (e.target.closest('.nav-tab')) {
            showSection(e.target.closest('.nav-tab').dataset.section);
        }

        // Devolver préstamo
        if (e.target.closest('.return-btn')) {
            const loanId = e.target.closest('.return-btn').dataset.id;
            const loan = loans.find(l => l.id === loanId);
            if (loan) {
                const condition = prompt("Estado al regresar (Excelente/Bueno/Regular/Malo):", "Bueno");
                if (condition) {
                    loan.status = "Devuelto";
                    loan.conditionIn = condition;
                    loan.returnDate = new Date().toISOString().split('T')[0];
                    const idx = equipment.findIndex(e => e.id === loan.equipmentId);
                    if (idx !== -1) {
                        equipment[idx].status = "Disponible";
                        equipment[idx].condition = condition;
                        equipment[idx].location = "Almacén";
                    }
                    history.unshift({ id: 'TR-' + Date.now(), type: "Devolución", equipmentId: loan.equipmentId, employee: loan.employee, warehousePerson: "Admin", details: `Devuelto en estado: ${condition}`, date: new Date().toLocaleString('es-ES'), status: "Completado" });
                    notifications.unshift({ id: 'NT-' + Date.now(), type: "Devolución", message: `Devolución: ${loan.equipmentId} de ${loan.employee}`, date: new Date().toLocaleString('es-ES'), read: false });
                    saveData();
                    renderTables();
                }
            }
        }

        // Resolver reporte
        if (e.target.closest('.resolve-btn')) {
            const rid = e.target.closest('.resolve-btn').dataset.id;
            const rep = reports.find(r => r.id === rid);
            if (rep && rep.status === "Pendiente") {
                rep.status = "Resuelto";
                const idx = equipment.findIndex(e => e.id === rep.equipmentId);
                if (idx !== -1 && equipment[idx].status === "Reportado") equipment[idx].status = "Disponible";
                notifications.unshift({ id: 'NT-' + Date.now(), type: "Reporte", message: `Reporte resuelto: ${rep.equipmentId}`, date: new Date().toLocaleString('es-ES'), read: false });
                saveData();
                renderTables();
            }
        }

        // Acción rápida desde monitoreo
        if (e.target.closest('.quick-action-btn')) {
            const eqId = e.target.closest('.quick-action-btn').dataset.id;
            const eq = equipment.find(e => e.id === eqId);
            if (eq && eq.status === 'Disponible') {
                document.getElementById('qr-input').value = eqId;
                document.getElementById('scan-btn').click();
                showSection('dashboard');
            }
        }

        // Acciones rápidas del scanner QR
        if (e.target.id === 'quick-loan-btn') {
            document.getElementById('loan-equipment-id').value = document.getElementById('equipment-id').innerText;
            showSection('loans');
            document.getElementById('new-loan-form').classList.remove('hidden');
        }
        if (e.target.id === 'quick-return-btn') {
            const id = document.getElementById('equipment-id').innerText;
            const loan = loans.find(l => l.equipmentId === id && l.status === "Activo");
            if (loan) {
                const condition = prompt("Estado al regresar:");
                if (condition) {
                    loan.status = "Devuelto";
                    loan.conditionIn = condition;
                    const idx = equipment.findIndex(e => e.id === id);
                    if (idx !== -1) equipment[idx].status = "Disponible";
                    saveData();
                    renderTables();
                    document.getElementById('equipment-info').classList.add('hidden');
                }
            }
        }
        if (e.target.id === 'repair-btn') {
            const id = document.getElementById('equipment-id').innerText;
            const idx = equipment.findIndex(e => e.id === id);
            if (idx !== -1) {
                equipment[idx].status = "Disponible";
                equipment[idx].condition = "Reparado";
                saveData();
                renderTables();
            }
        }
    });

    // QR Scanner
    document.getElementById('scan-btn').onclick = () => {
        const id = document.getElementById('qr-input').value.trim();
        const eq = equipment.find(e => e.id === id);
        if (eq) {
            document.getElementById('equipment-info').classList.remove('hidden');
            document.getElementById('equipment-id').innerText = eq.id;
            document.getElementById('equipment-type').innerText = eq.type;
            document.getElementById('equipment-model').innerText = `${eq.brand} ${eq.model}`;
            document.getElementById('equipment-status').innerText = eq.status;
            document.getElementById('equipment-status').className = `px-3 py-1 rounded-full text-xs ${appData.statusColors[eq.status]}`;
            document.getElementById('equipment-actions').innerHTML =
                eq.status === 'Disponible' ? `<button id="quick-loan-btn"   class="w-full px-4 py-2 bg-navy text-white rounded-lg">Préstamo Rápido</button>` :
                    eq.status === 'En Préstamo' ? `<button id="quick-return-btn" class="w-full px-4 py-2 bg-green-600 text-white rounded-lg">Devolver</button>` :
                        `<button id="repair-btn"        class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg">Reparado</button>`;
        } else {
            alert("Equipo no encontrado");
        }
    };

    document.getElementById('clear-btn').onclick = () => {
        document.getElementById('qr-input').value = '';
        document.getElementById('equipment-info').classList.add('hidden');
    };

    // Préstamos
    document.getElementById('new-loan-btn').onclick = () =>
        document.getElementById('new-loan-form').classList.toggle('hidden');

    document.getElementById('cancel-loan-btn').onclick = () => {
        document.getElementById('new-loan-form').classList.add('hidden');
        document.getElementById('loan-equipment-id').value = '';
        document.getElementById('loan-employee').value = '';
    };

    document.getElementById('save-loan-btn').onclick = () => {
        if (currentRole !== 'admin') { alert("Solo administradores"); return; }
        const eqId = document.getElementById('loan-equipment-id').value.trim();
        const emp = document.getElementById('loan-employee').value.trim();
        const val = parseInt(document.getElementById('loan-duration-value').value);
        const unit = document.getElementById('loan-duration-unit').value;
        const cond = document.getElementById('loan-condition-out').value;
        const eq = equipment.find(e => e.id === eqId);
        if (!eq || eq.status !== 'Disponible') { alert("Equipo no disponible"); return; }
        const newLoan = { id: 'LN-' + Date.now(), equipmentId: eqId, employee: emp, warehousePerson: "Admin", conditionOut: cond, conditionIn: "", durationValue: unit === 'indefinido' ? null : val, durationUnit: unit, startDate: new Date().toISOString().split('T')[0], returnDate: "", status: "Activo", notes: "" };
        loans.push(newLoan);
        const idx = equipment.findIndex(e => e.id === eqId);
        equipment[idx].status = "En Préstamo";
        equipment[idx].location = emp;
        history.unshift({ id: 'TR-' + Date.now(), type: "Préstamo", equipmentId: eqId, employee: emp, warehousePerson: "Admin", details: `Préstamo ${unit === 'indefinido' ? 'indefinido' : val + ' ' + unit}`, date: new Date().toLocaleString('es-ES'), status: "Completado" });
        notifications.unshift({ id: 'NT-' + Date.now(), type: "Préstamo", message: `Nuevo préstamo: ${eqId} a ${emp}`, date: new Date().toLocaleString('es-ES'), read: false });
        saveData();
        renderTables();
        document.getElementById('new-loan-form').classList.add('hidden');
    };

    // Reportes
    document.getElementById('new-report-btn').onclick = () =>
        document.getElementById('new-report-form').classList.toggle('hidden');

    document.getElementById('cancel-report-btn').onclick = () => {
        document.getElementById('new-report-form').classList.add('hidden');
        document.getElementById('report-equipment-id').value = '';
        document.getElementById('report-description').value = '';
        document.getElementById('report-reporter').value = '';
    };

    document.getElementById('save-report-btn').onclick = () => {
        const eqId = document.getElementById('report-equipment-id').value.trim();
        const type = document.getElementById('report-type').value;
        const desc = document.getElementById('report-description').value.trim();
        const reporter = document.getElementById('report-reporter').value.trim();
        const priority = document.getElementById('report-priority').value;
        if (!eqId || !desc || !reporter) { alert("Complete todos los campos"); return; }
        const newReport = { id: 'RP-' + Date.now(), equipmentId: eqId, type, description: desc, reporter, priority, date: new Date().toISOString().split('T')[0], status: "Pendiente" };
        reports.push(newReport);
        const idx = equipment.findIndex(e => e.id === eqId);
        if (idx !== -1) equipment[idx].status = "Reportado";
        history.unshift({ id: 'TR-' + Date.now(), type: "Reporte", equipmentId: eqId, employee: reporter, warehousePerson: currentRole === 'admin' ? "Admin" : "Empleado", details: `${type}: ${desc.substring(0, 50)}`, date: new Date().toLocaleString('es-ES'), status: "Pendiente" });
        notifications.unshift({ id: 'NT-' + Date.now(), type: "Reporte", message: `Reporte: ${eqId} - ${type} (${priority})`, date: new Date().toLocaleString('es-ES'), read: false });
        saveData();
        renderTables();
        document.getElementById('new-report-form').classList.add('hidden');
    };

    // Notificaciones
    document.getElementById('notification-bell').onclick = () => {
        showSection('alexa');
        notifications.forEach(n => n.read = true);
        saveData();
        updateNotificationCount();
    };

    document.getElementById('clear-notifications-btn').onclick = () => {
        if (confirm("¿Borrar historial de notificaciones?")) {
            notifications = [];
            saveData();
            renderNotifications();
        }
    };

    document.getElementById('refresh-equipment').onclick = () => renderTables();
}

// ── DASHBOARD KANBAN ──
function renderDashboardKanban() {
    const groups = { reported: [], loaned: [], available: [] };
    equipment.forEach(e => {
        if (e.status === 'Reportado') groups.reported.push(e);
        else if (e.status === 'En Préstamo') groups.loaned.push(e);
        else if (e.status === 'Disponible') groups.available.push(e);
    });

    const barColor = s => s === 'Disponible' ? 'ok' : s === 'En Préstamo' ? 'warn' : 'crit';
    const barWidth = s => s === 'Disponible' ? '100%' : s === 'En Préstamo' ? '60%' : '100%';

    const cardHtml = e => `
        <div class="kcard">
            <div class="kcard-top">
                <span class="kcard-id">${e.id}</span>
                <div class="kcard-sdot" style="background:${e.status === 'Disponible' ? 'var(--green)' : e.status === 'En Préstamo' ? 'var(--amber)' : 'var(--red)'}"></div>
            </div>
            <div class="kcard-name">${e.brand} ${e.model}</div>
            <div class="bar-wrap"><div class="bar ${barColor(e.status)}" style="width:${barWidth(e.status)}"></div></div>
            <div class="kcard-meta">${e.type} · ${e.condition} · ${e.location}</div>
        </div>`;

    document.getElementById('zone-reported').innerHTML = groups.reported.map(cardHtml).join('') || '<div class="kcard-meta" style="text-align:center;padding:8px">Sin equipos reportados</div>';
    document.getElementById('zone-loaned').innerHTML = groups.loaned.map(cardHtml).join('') || '<div class="kcard-meta" style="text-align:center;padding:8px">Sin préstamos activos</div>';
    document.getElementById('zone-available').innerHTML = groups.available.map(cardHtml).join('') || '<div class="kcard-meta" style="text-align:center;padding:8px">Sin equipos disponibles</div>';

    document.getElementById('cnt-reported').textContent = groups.reported.length;
    document.getElementById('cnt-loaned').textContent = groups.loaned.length;
    document.getElementById('cnt-available').textContent = groups.available.length;

    // Sugerencia automática
    const total = equipment.length;
    document.getElementById('ai-suggestion').textContent =
        `${total} equipos en sistema. ${groups.available.length} disponibles, ${groups.loaned.length} en campo.`;

    const alerta = equipment.find(e => e.status === 'Reportado');
    const card2 = document.getElementById('ai-card-2');
    if (alerta) {
        document.getElementById('ai-alert').textContent = `${alerta.id} reportado en ${alerta.location}. Requiere atención.`;
        card2.style.display = 'block';
    } else {
        card2.style.display = 'none';
    }
}

function renderDashLog() {
    const log = document.getElementById('dash-log');
    if (!log) return;
    const recent = history.slice(0, 8);
    if (recent.length === 0) {
        log.innerHTML = '<div class="log-item">Sin actividad reciente</div>';
        return;
    }
    log.innerHTML = recent.map(h =>
        `<div class="log-item"><span class="ts">${h.date.split(' ')[1] || h.date}</span>${h.equipmentId} → ${h.type} · ${h.employee}</div>`
    ).join('');
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

// ---------- INIT ----------
function initApp() {
    loadData();
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
    renderDashboardKanban();  // ← agrega
    renderDashLog();           // ← agrega
    showSection('dashboard');
    showWelcome();             // ← agrega
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}