const dbBase = {
    equipos: [
        { id: 'LAP-001', nombre: 'Laptop Dell', marca: 'Dell', modelo: 'Latitude 5420', tipo: 'Laptop', serie: 'DL5420-001' },
        { id: 'LAP-002', nombre: 'Laptop HP', marca: 'HP', modelo: 'EliteBook 840', tipo: 'Laptop', serie: 'HP840-002' },
        { id: 'LAP-003', nombre: 'MacBook Pro', marca: 'Apple', modelo: 'MacBook Pro 14"', tipo: 'Laptop', serie: 'MBP14-003' },
        { id: 'MON-001', nombre: 'Monitor Samsung', marca: 'Samsung', modelo: '24" FHD', tipo: 'Monitor', serie: 'SAM24-001' },
        { id: 'MON-002', nombre: 'Monitor Dell', marca: 'Dell', modelo: '27" 4K', tipo: 'Monitor', serie: 'DEL27-002' },
        { id: 'MOU-001', nombre: 'Mouse Logitech', marca: 'Logitech', modelo: 'MX Master 3', tipo: 'Mouse', serie: 'LMX3-001' },
        { id: 'KEY-001', nombre: 'Teclado Logitech', marca: 'Logitech', modelo: 'K380', tipo: 'Teclado', serie: 'LK380-001' },
        { id: 'CPU-001', nombre: 'CPU Dell', marca: 'Dell', modelo: 'OptiPlex 3090', tipo: 'CPU', serie: 'OPT3090-001' },
        { id: 'AUD-001', nombre: 'Audífonos Sony', marca: 'Sony', modelo: 'WH-1000XM5', tipo: 'Audífonos', serie: 'SWXM5-001' },
        { id: 'ALE-001', nombre: 'Alexa Echo', marca: 'Amazon', modelo: 'Echo Dot 5th', tipo: 'Asistente', serie: 'AED5-001' }
    ],
    eventos: [
        { id: 'EVT-001', equipoId: 'LAP-001', tipo: 'alta', fecha: '2024-01-10', usuario: '', area: '', notas: 'Alta inicial' },
        { id: 'EVT-002', equipoId: 'LAP-001', tipo: 'asignacion', fecha: '2024-02-01', usuario: 'Juan Pérez', area: 'TI', notas: 'Asignación inicial' },
        { id: 'EVT-003', equipoId: 'LAP-002', tipo: 'alta', fecha: '2024-01-10', usuario: '', area: '', notas: 'Alta inicial' },
        { id: 'EVT-004', equipoId: 'LAP-002', tipo: 'asignacion', fecha: '2024-03-15', usuario: 'María García', area: 'Finanzas', notas: '' },
        { id: 'EVT-005', equipoId: 'LAP-003', tipo: 'alta', fecha: '2024-01-15', usuario: '', area: '', notas: 'Alta inicial' },
        { id: 'EVT-006', equipoId: 'MON-001', tipo: 'alta', fecha: '2024-01-10', usuario: '', area: '', notas: 'Alta inicial' },
        { id: 'EVT-007', equipoId: 'MON-002', tipo: 'alta', fecha: '2024-01-10', usuario: '', area: '', notas: '' },
        { id: 'EVT-008', equipoId: 'MON-002', tipo: 'asignacion', fecha: '2024-04-01', usuario: 'Carlos López', area: 'RH', notas: '' },
        { id: 'EVT-009', equipoId: 'MOU-001', tipo: 'alta', fecha: '2024-01-10', usuario: '', area: '', notas: '' },
        { id: 'EVT-010', equipoId: 'KEY-001', tipo: 'alta', fecha: '2024-01-10', usuario: '', area: '', notas: '' },
        { id: 'EVT-011', equipoId: 'KEY-001', tipo: 'asignacion', fecha: '2024-05-01', usuario: 'Ana Martínez', area: 'Ventas', notas: '' },
        { id: 'EVT-012', equipoId: 'CPU-001', tipo: 'alta', fecha: '2024-01-10', usuario: '', area: '', notas: '' },
        { id: 'EVT-013', equipoId: 'CPU-001', tipo: 'envio_mantenimiento', fecha: '2025-05-20', usuario: '', area: 'Taller', notas: 'Falla de encendido' },
        { id: 'EVT-014', equipoId: 'AUD-001', tipo: 'alta', fecha: '2024-06-01', usuario: '', area: '', notas: '' },
        { id: 'EVT-015', equipoId: 'ALE-001', tipo: 'alta', fecha: '2024-06-01', usuario: '', area: '', notas: '' },
        { id: 'EVT-016', equipoId: 'MON-002', tipo: 'envio_mantenimiento', fecha: '2025-03-10', usuario: 'Carlos López', area: 'Taller', notas: 'Pantalla con líneas horizontales' },
        { id: 'EVT-017', equipoId: 'MON-002', tipo: 'regreso_mantenimiento', fecha: '2025-03-18', usuario: 'Carlos López', area: 'RH', notas: 'Panel reemplazado, regresa en buen estado' },
        { id: 'EVT-018', equipoId: 'MON-002', tipo: 'asignacion', fecha: '2025-03-19', usuario: 'Carlos López', area: 'RH', notas: 'Reasignado tras mantenimiento' }
    ]
};

const userProfiles = {
    'user': {
        nombre: 'Carlos López',
        area: 'RH',
        equiposAsignados: ['MON-002', 'MOU-001', 'KEY-001']
    }
};

function saveDB() {
    localStorage.setItem('db-equipos', JSON.stringify(dbBase.equipos));
    localStorage.setItem('db-eventos', JSON.stringify(dbBase.eventos));
}

function loadDB() {
    const eq = localStorage.getItem('db-equipos');
    const ev = localStorage.getItem('db-eventos');
    if (eq) dbBase.equipos = JSON.parse(eq);
    if (ev) dbBase.eventos = JSON.parse(ev);
}

function nextId(prefix, array) {
    const nums = array
        .map(e => parseInt(e.id.replace(prefix + '-', '')))
        .filter(n => !isNaN(n));
    const max = nums.length ? Math.max(...nums) : 0;
    return `${prefix}-${String(max + 1).padStart(3, '0')}`;
}