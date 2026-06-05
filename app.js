// ==================== VIVO PLENO - PWA para vida plena ====================
// Basado en psicología positiva, TCC, mindfulness y hábitos atómicos
// Offline first, instalable, exportar/importar datos, consejos rotativos

// ==================== VARIABLES GLOBALES ====================
let appData = {
    // Configuración del usuario
    config: {
        tema: "calido",          // calido / frio
        pilaresPrioritarios: ["propósito", "conexión", "crecimiento", "gratitud"],
        duracionPreferida: "mixta", // corta / mixta / profunda
        ultimoConsejoId: null,
        ultimaFechaCambioConsejo: null
    },
    // Historial de tareas completadas por día
    // Formato: { "2025-06-06": [idTarea1, idTarea2, ...] }
    historialCompletadas: {},
    // Tareas personalizadas del usuario
    tareasPropias: [], // { id, texto, categoria, duracionMinutos, esPropia: true }
    // Logros destacados
    logros: [], // { id, fecha, texto }
    // Racha actual y mejor racha
    rachaActual: 0,
    mejorRacha: 0,
    // Última fecha con actividad
    ultimaFechaActiva: null
};

// Bancos de datos (se cargarán desde JSON)
let bancoConsejos = [];
let bancoTareas = [];

// Elementos DOM
let mainScreen, progresoScreen, logrosScreen, ajustesScreen;
let radarChart = null; // para el canvas

// ==================== INICIALIZACIÓN ====================
document.addEventListener('DOMContentLoaded', async () => {
    // Obtener referencias a pantallas
    mainScreen = document.getElementById('mainScreen');
    progresoScreen = document.getElementById('progresoScreen');
    logrosScreen = document.getElementById('logrosScreen');
    ajustesScreen = document.getElementById('ajustesScreen');
    
    // Cargar datos desde localStorage
    cargarDatosLocales();
    
    // Cargar consejos y tareas desde archivos JSON
    await cargarArchivosJSON();
    
    // Aplicar tema visual
    aplicarTema(appData.config.tema);
    
    // Configurar event listeners
    configurarEventListeners();
    
    // Actualizar UI del día
    actualizarFechaUI();
    mostrarConsejoDelDia();
    cargarTareasDelDia();
    actualizarEstadisticasRapidas();
    
    // Mostrar pantalla principal
    mostrarPantalla('main');
    
    // Registrar Service Worker para offline
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(err => console.log('SW error:', err));
    }
});

// ==================== CARGA DE DATOS ====================
async function cargarArchivosJSON() {
    try {
        // Cargar consejos
        const resConsejos = await fetch('/consejos.json');
        bancoConsejos = await resConsejos.json();
        if (bancoConsejos.consejos) bancoConsejos = bancoConsejos.consejos;
        
        // Cargar tareas
        const resTareas = await fetch('/tareas.json');
        bancoTareas = await resTareas.json();
        if (bancoTareas.tareas) bancoTareas = bancoTareas.tareas;
    } catch (e) {
        console.log("Error cargando JSON, usando datos por defecto");
        // Datos por defecto en caso de error
        bancoConsejos = [
            { id: 1, pilar: "propósito", texto: "Define una intención para el día de hoy.", autor: "Viktor Frankl" },
            { id: 2, pilar: "conexión", texto: "Conecta genuinamente con alguien.", autor: "Psicología positiva" }
        ];
        bancoTareas = [
            { id: 1, categoria: "mindfulness", texto: "Respira 5 minutos", duracionMinutos: 5, dificultad: "inicial" }
        ];
    }
}

function cargarDatosLocales() {
    const guardado = localStorage.getItem('vivoPleno_data');
    if (guardado) {
        try {
            const data = JSON.parse(guardado);
            appData = { ...appData, ...data };
        } catch(e) {}
    }
    
    // Asegurar estructuras
    if (!appData.historialCompletadas) appData.historialCompletadas = {};
    if (!appData.tareasPropias) appData.tareasPropias = [];
    if (!appData.logros) appData.logros = [];
    if (!appData.config) appData.config = appData.config || {};
}

function guardarDatosLocales() {
    localStorage.setItem('vivoPleno_data', JSON.stringify(appData));
}

// ==================== FUNCIONES DE UI ====================
function mostrarPantalla(pantalla) {
    const pantallas = ['main', 'progreso', 'logros', 'ajustes'];
    pantallas.forEach(p => {
        const el = document.getElementById(`${p}Screen`);
        if (el) el.classList.remove('active');
    });
    document.getElementById(`${pantalla}Screen`).classList.add('active');
    
    if (pantalla === 'progreso') actualizarPantallaProgreso();
    if (pantalla === 'logros') cargarListaLogros();
}

function actualizarFechaUI() {
    const hoy = new Date();
    const opciones = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('fechaActual').innerText = hoy.toLocaleDateString('es-ES', opciones);
}

function aplicarTema(tema) {
    const root = document.documentElement;
    if (tema === 'calido') {
        root.style.setProperty('--bg-gradient-start', '#FFF3E0');
        root.style.setProperty('--bg-gradient-end', '#FFE0B2');
        root.style.setProperty('--primary', '#FF6B35');
        root.style.setProperty('--primary-dark', '#E55A2B');
        root.style.setProperty('--secondary', '#4CAF50');
        root.style.setProperty('--accent-warm', '#FFB74D');
    } else {
        root.style.setProperty('--bg-gradient-start', '#E3F2FD');
        root.style.setProperty('--bg-gradient-end', '#BBDEFB');
        root.style.setProperty('--primary', '#2196F3');
        root.style.setProperty('--primary-dark', '#1976D2');
        root.style.setProperty('--secondary', '#00BCD4');
        root.style.setProperty('--accent-warm', '#64B5F6');
    }
}

// ==================== CONSEJO DEL DÍA (ROTACIÓN) ====================
function mostrarConsejoDelDia() {
    if (!bancoConsejos.length) return;
    
    const hoy = new Date().toDateString();
    const ultimoCambio = appData.config.ultimaFechaCambioConsejo;
    
    // Si es un nuevo día, cambiar consejo
    if (ultimoCambio !== hoy) {
        // Seleccionar consejo según pilares prioritarios o aleatorio
        let consejosFiltrados = [...bancoConsejos];
        if (appData.config.pilaresPrioritarios.length > 0) {
            consejosFiltrados = bancoConsejos.filter(c => 
                appData.config.pilaresPrioritarios.includes(c.pilar)
            );
            if (consejosFiltrados.length === 0) consejosFiltrados = bancoConsejos;
        }
        
        const indiceAleatorio = Math.floor(Math.random() * consejosFiltrados.length);
        const consejo = consejosFiltrados[indiceAleatorio];
        
        appData.config.ultimoConsejoId = consejo.id;
        appData.config.ultimaFechaCambioConsejo = hoy;
        guardarDatosLocales();
    }
    
    // Mostrar el consejo guardado
    const consejo = bancoConsejos.find(c => c.id === appData.config.ultimoConsejoId) || bancoConsejos[0];
    document.getElementById('consejoDiario').innerHTML = `
        <p class="consejo-texto">"${consejo.texto}"</p>
        <p class="consejo-autor">— ${consejo.autor || 'Sabiduría ancestral'}</p>
    `;
}

// ==================== TAREAS DEL DÍA ====================
function cargarTareasDelDia() {
    const hoy = new Date().toISOString().slice(0,10);
    const completadasHoy = appData.historialCompletadas[hoy] || [];
    
    // Combinar tareas del banco + tareas propias
    let todasTareas = [
        ...bancoTareas.map(t => ({ ...t, esPropia: false })),
        ...appData.tareasPropias.map(t => ({ ...t, esPropia: true }))
    ];
    
    // Filtrar según duración preferida
    if (appData.config.duracionPreferida === 'corta') {
        todasTareas = todasTareas.filter(t => t.duracionMinutos <= 5);
    } else if (appData.config.duracionPreferida === 'profunda') {
        todasTareas = todasTareas.filter(t => t.duracionMinutos >= 10);
    }
    
    // Seleccionar 4-5 tareas aleatorias (priorizando pilares)
    const tareasSeleccionadas = seleccionarTareasDelDia(todasTareas, 4);
    
    const container = document.getElementById('listaTareas');
    container.innerHTML = '';
    
    tareasSeleccionadas.forEach(tarea => {
        const completada = completadasHoy.includes(tarea.id);
        const tareaDiv = document.createElement('div');
        tareaDiv.className = `tarea-item ${completada ? 'tarea-completada' : ''}`;
        tareaDiv.innerHTML = `
            <input type="checkbox" class="tarea-check" data-id="${tarea.id}" ${completada ? 'checked' : ''}>
            <div class="tarea-contenido">
                <div class="tarea-texto">${escapeHtml(tarea.texto)}</div>
                <div class="tarea-meta">⏱️ ${tarea.duracionMinutos} min • ${tarea.categoria || 'personal'}</div>
            </div>
            ${tarea.esPropia ? `<button class="btn-eliminar-tarea" data-id="${tarea.id}">🗑️</button>` : ''}
        `;
        container.appendChild(tareaDiv);
    });
    
    // Actualizar contador
    const completadasCount = tareasSeleccionadas.filter(t => completadasHoy.includes(t.id)).length;
    document.getElementById('contadorCompletadas').innerHTML = `✅ Completadas: ${completadasCount}/${tareasSeleccionadas.length}`;
    
    // Guardar las tareas del día en memoria para referencia
    appData.tareasDelDiaActual = tareasSeleccionadas;
    
    // Agregar event listeners a los checkboxes
    document.querySelectorAll('.tarea-check').forEach(cb => {
        cb.addEventListener('change', (e) => toggleTarea(e.target.dataset.id, e.target.checked));
    });
    document.querySelectorAll('.btn-eliminar-tarea').forEach(btn => {
        btn.addEventListener('click', (e) => eliminarTareaPropia(btn.dataset.id));
    });
}

function seleccionarTareasDelDia(todas, cantidad) {
    // Priorizar tareas no completadas recientemente
    const ultimos7Dias = obtenerUltimos7Dias();
    const idsCompletadasRecientes = new Set();
    
    ultimos7Dias.forEach(fecha => {
        const completadas = appData.historialCompletadas[fecha] || [];
        completadas.forEach(id => idsCompletadasRecientes.add(id));
    });
    
    // Separar tareas no completadas recientemente
    const tareasNuevas = todas.filter(t => !idsCompletadasRecientes.has(t.id));
    const tareasVistas = todas.filter(t => idsCompletadasRecientes.has(t.id));
    
    // Mezclar y seleccionar
    const mezcladas = [...tareasNuevas, ...tareasVistas].sort(() => Math.random() - 0.5);
    return mezcladas.slice(0, cantidad);
}

function obtenerUltimos7Dias() {
    const fechas = [];
    for (let i = 0; i < 7; i++) {
        const fecha = new Date();
        fecha.setDate(fecha.getDate() - i);
        fechas.push(fecha.toISOString().slice(0,10));
    }
    return fechas;
}

function toggleTarea(tareaId, completada) {
    const hoy = new Date().toISOString().slice(0,10);
    if (!appData.historialCompletadas[hoy]) appData.historialCompletadas[hoy] = [];
    
    if (completada) {
        if (!appData.historialCompletadas[hoy].includes(parseInt(tareaId))) {
            appData.historialCompletadas[hoy].push(parseInt(tareaId));
        }
    } else {
        appData.historialCompletadas[hoy] = appData.historialCompletadas[hoy].filter(id => id != tareaId);
    }
    
    guardarDatosLocales();
    actualizarRacha();
    actualizarEstadisticasRapidas();
    cargarTareasDelDia(); // recargar para actualizar checkboxes
}

function actualizarRacha() {
    const hoy = new Date().toISOString().slice(0,10);
    let racha = 0;
    let fechaCheck = new Date();
    
    while (true) {
        const fechaStr = fechaCheck.toISOString().slice(0,10);
        const completadas = appData.historialCompletadas[fechaStr] || [];
        if (completadas.length > 0) {
            racha++;
            fechaCheck.setDate(fechaCheck.getDate() - 1);
        } else {
            break;
        }
    }
    
    appData.rachaActual = racha;
    if (racha > appData.mejorRacha) appData.mejorRacha = racha;
    guardarDatosLocales();
}

function actualizarEstadisticasRapidas() {
    document.getElementById('rachaActual').innerText = appData.rachaActual;
    document.getElementById('mejorRacha').innerText = appData.mejorRacha;
}

function agregarTareaPropia() {
    const texto = prompt("Escribe tu tarea personal:");
    if (!texto) return;
    
    const categoria = prompt("Categoría (ej. autocuidado, aprendizaje, etc.):", "personal");
    const duracion = parseInt(prompt("Duración en minutos:", "5"));
    
    const nuevaTarea = {
        id: Date.now(),
        texto: texto,
        categoria: categoria || "personal",
        duracionMinutos: isNaN(duracion) ? 5 : duracion,
        dificultad: "intermedio",
        esPropia: true
    };
    
    appData.tareasPropias.push(nuevaTarea);
    guardarDatosLocales();
    cargarTareasDelDia();
}

function eliminarTareaPropia(id) {
    if (confirm("¿Eliminar esta tarea personal?")) {
        appData.tareasPropias = appData.tareasPropias.filter(t => t.id != id);
        guardarDatosLocales();
        cargarTareasDelDia();
    }
}

// ==================== PROGRESO (RADAR + MAPA DE CALOR) ====================
function actualizarPantallaProgreso() {
    const periodoActual = document.querySelector('.periodo-btn.active')?.innerText === "Este mes" ? "mes" : "semana";
    if (periodoActual === "semana") {
        actualizarRadarSemana();
        document.getElementById('mapaCalorContainer').style.display = 'none';
    } else {
        actualizarRadarMes();
        actualizarMapaCalor();
        document.getElementById('mapaCalorContainer').style.display = 'block';
    }
    actualizarResumenPeriodo(periodoActual);
}

function obtenerDatosPorRango(fechaInicio, fechaFin) {
    const categorias = { mindfulness:0, gratitud:0, bondad:0, crecimiento:0, conexion:0, autocuidado:0, proposito:0, aceptacion:0, flow:0 };
    let diasActivos = 0;
    let totalTareas = 0;
    
    let current = new Date(fechaInicio);
    while (current <= fechaFin) {
        const fechaStr = current.toISOString().slice(0,10);
        const completadas = appData.historialCompletadas[fechaStr] || [];
        if (completadas.length > 0) diasActivos++;
        totalTareas += completadas.length;
        
        completadas.forEach(tareaId => {
            const tarea = [...bancoTareas, ...appData.tareasPropias].find(t => t.id == tareaId);
            if (tarea && tarea.categoria && categorias[tarea.categoria] !== undefined) {
                categorias[tarea.categoria]++;
            }
        });
        
        current.setDate(current.getDate() + 1);
    }
    
    return { categorias, diasActivos, totalTareas };
}

function actualizarRadarSemana() {
    const hoy = new Date();
    const inicioSemana = new Date(hoy);
    inicioSemana.setDate(hoy.getDate() - hoy.getDay());
    const finSemana = new Date(inicioSemana);
    finSemana.setDate(inicioSemana.getDate() + 6);
    
    const { categorias } = obtenerDatosPorRango(inicioSemana, finSemana);
    dibujarRadar(categorias);
}

function actualizarRadarMes() {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    
    const { categorias } = obtenerDatosPorRango(inicioMes, finMes);
    dibujarRadar(categorias);
}

function dibujarRadar(datos) {
    const canvas = document.getElementById('radarCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    const centerX = w/2, centerY = h/2;
    const radius = Math.min(w, h) * 0.35;
    
    const categorias = Object.keys(datos);
    const valores = Object.values(datos);
    const maxValor = Math.max(...valores, 1);
    
    ctx.clearRect(0, 0, w, h);
    
    // Dibujar ejes
    const angulo = (Math.PI * 2) / categorias.length;
    for (let i = 0; i < categorias.length; i++) {
        const angle = i * angulo - Math.PI/2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.strokeStyle = "#ccc";
        ctx.stroke();
        
        // Etiquetas
        ctx.fillStyle = "#2D3436";
        ctx.font = "10px sans-serif";
        const labelX = centerX + (radius + 15) * Math.cos(angle);
        const labelY = centerY + (radius + 15) * Math.sin(angle);
        ctx.fillText(categorias[i].substring(0, 8), labelX, labelY);
    }
    
    // Dibujar área de datos
    ctx.beginPath();
    for (let i = 0; i < categorias.length; i++) {
        const angle = i * angulo - Math.PI/2;
        const valorRelativo = (valores[i] / maxValor) * radius;
        const x = centerX + valorRelativo * Math.cos(angle);
        const y = centerY + valorRelativo * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = "rgba(255, 107, 53, 0.3)";
    ctx.fill();
    ctx.strokeStyle = "#FF6B35";
    ctx.stroke();
}

function actualizarMapaCalor() {
    const hoy = new Date();
    const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    const container = document.getElementById('mapaCalor');
    if (!container) return;
    
    container.innerHTML = '';
    const diasSemana = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
    diasSemana.forEach(d => {
        const header = document.createElement('div');
        header.innerText = d;
        header.style.textAlign = 'center';
        header.style.fontWeight = 'bold';
        container.appendChild(header);
    });
    
    let current = new Date(inicioMes);
    while (current <= finMes) {
        const fechaStr = current.toISOString().slice(0,10);
        const completadas = appData.historialCompletadas[fechaStr] || [];
        const intensidad = completadas.length > 2 ? 'alto' : (completadas.length > 0 ? 'medio' : 'bajo');
        const diaDiv = document.createElement('div');
        diaDiv.className = `dia-calor ${intensidad}`;
        diaDiv.innerText = current.getDate();
        container.appendChild(diaDiv);
        current.setDate(current.getDate() + 1);
    }
}

function actualizarResumenPeriodo(periodo) {
    const hoy = new Date();
    let inicio, fin;
    if (periodo === "semana") {
        inicio = new Date(hoy);
        inicio.setDate(hoy.getDate() - hoy.getDay());
        fin = new Date(inicio);
        fin.setDate(inicio.getDate() + 6);
    } else {
        inicio = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
        fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
    }
    
    const { totalTareas, diasActivos } = obtenerDatosPorRango(inicio, fin);
    document.getElementById('totalCompletadas').innerText = totalTareas;
    document.getElementById('diasActivos').innerText = diasActivos;
}

// ==================== LOGROS ====================
function cargarListaLogros() {
    const container = document.getElementById('listaLogros');
    if (!container) return;
    
    if (appData.logros.length === 0) {
        container.innerHTML = '<p class="config-note">Aún no hay logros. ¡Escribe tu primer logro destacado!</p>';
        return;
    }
    
    container.innerHTML = appData.logros.map(logro => `
        <div class="logro-item" data-id="${logro.id}">
            <div class="logro-fecha">📅 ${new Date(logro.fecha).toLocaleDateString('es-ES')}</div>
            <div class="logro-texto">${escapeHtml(logro.texto)}</div>
            <div class="logro-acciones">
                <button class="editar-logro" data-id="${logro.id}">✏️</button>
                <button class="eliminar-logro" data-id="${logro.id}">🗑️</button>
            </div>
        </div>
    `).join('');
    
    document.querySelectorAll('.editar-logro').forEach(btn => {
        btn.addEventListener('click', () => editarLogro(btn.dataset.id));
    });
    document.querySelectorAll('.eliminar-logro').forEach(btn => {
        btn.addEventListener('click', () => eliminarLogro(btn.dataset.id));
    });
}

function agregarLogro() {
    document.getElementById('modalLogroTitle').innerText = "📝 Nuevo logro";
    document.getElementById('logroTexto').value = "";
    document.getElementById('logroModal').style.display = 'flex';
    
    const guardarBtn = document.getElementById('btnGuardarLogro');
    const cancelarBtn = document.getElementById('btnCancelarLogro');
    
    const guardarHandler = () => {
        const texto = document.getElementById('logroTexto').value.trim();
        if (texto) {
            appData.logros.unshift({
                id: Date.now(),
                fecha: new Date().toISOString(),
                texto: texto
            });
            guardarDatosLocales();
            cargarListaLogros();
        }
        cerrarModal();
    };
    
    const cerrarModal = () => {
        document.getElementById('logroModal').style.display = 'none';
        guardarBtn.removeEventListener('click', guardarHandler);
        cancelarBtn.removeEventListener('click', cerrarModal);
    };
    
    guardarBtn.addEventListener('click', guardarHandler);
    cancelarBtn.addEventListener('click', cerrarModal);
}

function editarLogro(id) {
    const logro = appData.logros.find(l => l.id == id);
    if (!logro) return;
    
    document.getElementById('modalLogroTitle').innerText = "✏️ Editar logro";
    document.getElementById('logroTexto').value = logro.texto;
    document.getElementById('logroModal').style.display = 'flex';
    
    const guardarBtn = document.getElementById('btnGuardarLogro');
    const cancelarBtn = document.getElementById('btnCancelarLogro');
    
    const guardarHandler = () => {
        const nuevoTexto = document.getElementById('logroTexto').value.trim();
        if (nuevoTexto) {
            logro.texto = nuevoTexto;
            guardarDatosLocales();
            cargarListaLogros();
        }
        cerrarModal();
    };
    
    const cerrarModal = () => {
        document.getElementById('logroModal').style.display = 'none';
        guardarBtn.removeEventListener('click', guardarHandler);
        cancelarBtn.removeEventListener('click', cerrarModal);
    };
    
    guardarBtn.addEventListener('click', guardarHandler);
    cancelarBtn.addEventListener('click', cerrarModal);
}

function eliminarLogro(id) {
    if (confirm("¿Eliminar este logro?")) {
        appData.logros = appData.logros.filter(l => l.id != id);
        guardarDatosLocales();
        cargarListaLogros();
    }
}

// ==================== EXPORTAR / IMPORTAR ====================
function exportarDatos() {
    const dataStr = JSON.stringify(appData, null, 2);
    const blob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vivo_pleno_respaldo_${new Date().toISOString().slice(0,19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importarDatos(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (data.config && data.historialCompletadas && data.logros) {
                appData = { ...appData, ...data };
                guardarDatosLocales();
                location.reload(); // Recargar para aplicar todos los cambios
            } else {
                alert("Archivo inválido. No contiene la estructura correcta.");
            }
        } catch(err) {
            alert("Error al leer el archivo.");
        }
    };
    reader.readAsText(file);
}

// ==================== CONFIGURACIÓN ====================
function cargarConfiguracionUI() {
    // Pilares
    const container = document.getElementById('pilaresChecklist');
    const pilares = [
        { id: "propósito", nombre: "🎯 Propósito y significado" },
        { id: "conexión", nombre: "🤝 Conexiones sociales" },
        { id: "autocompasión", nombre: "🫂 Autocompasión" },
        { id: "crecimiento", nombre: "📚 Crecimiento" },
        { id: "gratitud", nombre: "🙏 Gratitud" },
        { id: "descanso", nombre: "😴 Descanso" },
        { id: "reflexión", nombre: "💭 Reflexión" }
    ];
    
    container.innerHTML = pilares.map(p => `
        <label>
            <input type="checkbox" value="${p.id}" ${appData.config.pilaresPrioritarios.includes(p.id) ? 'checked' : ''}>
            ${p.nombre}
        </label>
    `).join('');
    
    document.getElementById('duracionPreferida').value = appData.config.duracionPreferida;
    
    // Botones de tema
    document.getElementById('btnTemaCalido').classList.toggle('active', appData.config.tema === 'calido');
    document.getElementById('btnTemaFrio').classList.toggle('active', appData.config.tema === 'frio');
}

function guardarConfiguracion() {
    // Guardar pilares
    const checkboxes = document.querySelectorAll('#pilaresChecklist input:checked');
    appData.config.pilaresPrioritarios = Array.from(checkboxes).map(cb => cb.value);
    
    appData.config.duracionPreferida = document.getElementById('duracionPreferida').value;
    
    guardarDatosLocales();
    alert("Preferencias guardadas");
    
    // Recargar tareas y consejo para aplicar cambios
    mostrarConsejoDelDia();
    cargarTareasDelDia();
}

// ==================== EVENT LISTENERS ====================
function configurarEventListeners() {
    // Navegación
    document.getElementById('btnVerProgreso').onclick = () => mostrarPantalla('progreso');
    document.getElementById('btnVerLogros').onclick = () => mostrarPantalla('logros');
    document.getElementById('btnAjustes').onclick = () => { cargarConfiguracionUI(); mostrarPantalla('ajustes'); };
    document.getElementById('btnBackProgreso').onclick = () => mostrarPantalla('main');
    document.getElementById('btnBackLogros').onclick = () => mostrarPantalla('main');
    document.getElementById('btnBackAjustes').onclick = () => mostrarPantalla('main');
    document.getElementById('btnConfigHeader').onclick = () => { cargarConfiguracionUI(); mostrarPantalla('ajustes'); };
    
    // Progreso
    document.getElementById('btnSemana').onclick = () => {
        document.getElementById('btnSemana').classList.add('active');
        document.getElementById('btnMes').classList.remove('active');
        actualizarPantallaProgreso();
    };
    document.getElementById('btnMes').onclick = () => {
        document.getElementById('btnMes').classList.add('active');
        document.getElementById('btnSemana').classList.remove('active');
        actualizarPantallaProgreso();
    };
    document.getElementById('btnExportarDatos').onclick = () => exportarDatos();
    
    // Logros
    document.getElementById('btnNuevoLogro').onclick = () => agregarLogro();
    
    // Ajustes
    document.getElementById('btnGuardarPilares').onclick = () => guardarConfiguracion();
    document.getElementById('btnTemaCalido').onclick = () => {
        appData.config.tema = 'calido';
        aplicarTema('calido');
        guardarDatosLocales();
        document.getElementById('btnTemaCalido').classList.add('active');
        document.getElementById('btnTemaFrio').classList.remove('active');
    };
    document.getElementById('btnTemaFrio').onclick = () => {
        appData.config.tema = 'frio';
        aplicarTema('frio');
        guardarDatosLocales();
        document.getElementById('btnTemaFrio').classList.add('active');
        document.getElementById('btnTemaCalido').classList.remove('active');
    };
    document.getElementById('btnImportarDatos').onclick = () => {
        document.getElementById('importFileInput').click();
    };
    document.getElementById('importFileInput').onchange = (e) => {
        if (e.target.files[0]) importarDatos(e.target.files[0]);
    };
    
    // Tareas propias
    document.getElementById('btnAgregarTareaPropia').onclick = () => agregarTareaPropia();
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}
