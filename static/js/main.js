//Navegador
let grafoActual = null;
// Cambio: conserva la red de edición al preparar temporalmente sus terminales.
let grafoBaseEdicion = null;
let pasos = [];
let pasoActual = 0;

// Estado modo manual
let nodosManuales = [];
let flechasManuales = [];
let siguienteIdNodo = 0;
// Cambio: conserva el estado entre los dos clics que definen una arista.
let modoAgregarArista = false;
let origenAristaSeleccionado = null;

// Posiciones guardadas (para preservar al ejecutar algoritmo)
let posicionesGuardadas = {};

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const MIN_NODOS = 7;
const MAX_NODOS = 16;

// Colores para las aristas
let memoriaColoresAristas = {};
const COLOR_LLENA = '#d32f2f', COLOR_PARCIAL = '#f59e0b', COLOR_VACIA = '#848484';

const COLORES_CAMINOS = ['#2563eb','#059669','#7c3aed','#0891b2','#c026d3','#4d7c0f','#1e3a8a','#78350f'];
const colorCamino = n => COLORES_CAMINOS[(n - 1) % COLORES_CAMINOS.length]; // n = nº de paso (≥1)

const contenedor = document.getElementById('grafo');            
const contenedorPasos = document.getElementById('grafo-pasos');  
let red = null;          // superior
let redPasos = null;     // inferior
let dsNodosPasos = null;
let dsAristasPasos = null;

function destruirRedPasos() {
    if (redPasos) { redPasos.destroy(); redPasos = null; }
    dsNodosPasos = null;
    dsAristasPasos = null;
    contenedorPasos.innerHTML = '';
}

// Datasets en vivo para modo manual
let dsNodos = null;
let dsFlechas = null;

const opcionesRed = {
    physics: {
        enabled: true,
        barnesHut: {
            gravitationalConstant: 0, // Evita que los nodos se empujen entre sí
            centralGravity: 0,        // Evita que los nodos sean atraídos al centro
            springConstant: 0         // Evita que las flechas tiren de los nodos como resortes
        }
    },
    interaction: {
        dragNodes: true,
        dragView: true,
        zoomView: false,
        hover: true,
        tooltipDelay: 200
    },
    nodes: { shape: 'circle', font: { size: 16 }, borderWidth: 2 },
    edges: { font: { size: 12 }, smooth: false }
};



// ========== UTILIDADES ==========

const nombreNodo = id => {
    const n = grafoActual.nodos.find(x => x.id === id);
    return n ? n.label : String(id);
};

function guardarPosiciones() {
    if (!red) return;
    const pos = red.getPositions();
    for (const [id, p] of Object.entries(pos)) {
        posicionesGuardadas[id] = { x: p.x, y: p.y };
    }
}

function aplicarPosiciones(listaNodos) {
    return listaNodos.map(n => {
        const p = posicionesGuardadas[n.id];
        return p ? { ...n, x: p.x, y: p.y } : n;
    });
}

// ========== SELECCIÓN DE MODO ==========

document.getElementById('btn-aleatorio').addEventListener('click', () => {
    document.getElementById('elegir-modo').style.display = 'none';
    document.getElementById('modo-aleatorio').style.display = 'flex';
});

document.getElementById('btn-manual').addEventListener('click', () => {
    document.getElementById('elegir-modo').style.display = 'none';
    document.getElementById('modo-manual').style.display = 'flex';
    crearGrafoVacio();
    actualizarInfoManual();
});

// ========== CANCELAR / VOLVER ==========

function volverAMenu() {
    document.getElementById('modo-aleatorio').style.display = 'none';
    document.getElementById('modo-manual').style.display = 'none';
    document.getElementById('contenedor-algoritmo').style.display = 'none';
    document.getElementById('resultado').style.display = 'none';
    document.getElementById('form-arista').style.display = 'none';
    document.getElementById('elegir-modo').style.display = 'flex';

    grafoActual = null;
    grafoBaseEdicion = null;
    pasos = [];
    pasoActual = 0;
    nodosManuales = [];
    flechasManuales = [];
    siguienteIdNodo = 0;
    modoAgregarArista = false;
    origenAristaSeleccionado = null;
    document.getElementById('form-arista').style.display = 'none';
    posicionesGuardadas = {};

    if (red) { red.destroy(); red = null; }
    destruirRedPasos();
}

document.getElementById('cancelar-aleatorio').addEventListener('click', volverAMenu);
document.getElementById('cancelar-manual').addEventListener('click', volverAMenu);

// ========== MODO ALEATORIO ==========

document.getElementById('generar').addEventListener('click', async () => {
    const n = parseInt(document.getElementById('n').value, 10);

    const peticion = await fetch('/grafo', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({n: n})
    });
    const datos = await peticion.json();

    if (!peticion.ok) {
        alert('Error: ' + datos.error);
        return;
    }

    grafoActual = datos;
    posicionesGuardadas = {};
    mostrarGrafoCompleto(datos);
    mostrarAlgoritmo();
});

// ========== MODO MANUAL ==========

document.getElementById('agregar-nodo').addEventListener('click', () => {
    if (nodosManuales.length >= MAX_NODOS) {
        alert('Máximo ' + MAX_NODOS + ' nodos');
        return;
    }

    const id = siguienteIdNodo;
    const label = LETRAS[id % 26];
    nodosManuales.push({ id, label });
    siguienteIdNodo++;

    const x = Math.round((Math.random() - 0.5) * 600);
    const y = Math.round((Math.random() - 0.5) * 400);
    dsNodos.add({ id, label, x, y });
    posicionesGuardadas[id] = { x, y };
    actualizarInfoManual();
});

// Cambio: elimina vértices o aristas con doble clic y registra los clics usados para crear una arista.
function habilitarEliminacionDobleClic() {
    if (!red) return;
    red.on('doubleClick', params => {
        if (params.nodes.length) {
            const id = params.nodes[0];
            nodosManuales = nodosManuales.filter(n => n.id !== id);
            const eliminadas = flechasManuales.filter(f => f.origen === id || f.destino === id);
            flechasManuales = flechasManuales.filter(f => f.origen !== id && f.destino !== id);
            dsFlechas.remove(eliminadas.map(f => `${f.origen}-${f.destino}`));
            dsNodos.remove(id);
            delete posicionesGuardadas[id];
            if (origenAristaSeleccionado === id) origenAristaSeleccionado = null;
            actualizarInfoManual();
            actualizarEstadoArista(origenAristaSeleccionado === null
                ? 'Selecciona el vértice de inicio.'
                : `Inicio: ${nombreNodoManual(origenAristaSeleccionado)}. Selecciona el vértice final.`);
            return;
        }
        if (params.edges.length) {
            const ids = new Set(params.edges);
            const eliminadas = flechasManuales.filter(f => ids.has(`${f.origen}-${f.destino}`));
            flechasManuales = flechasManuales.filter(f => !ids.has(`${f.origen}-${f.destino}`));
            dsFlechas.remove([...ids]);
            actualizarInfoManual();
        }
    });
    red.on('click', params => {
        if (!modoAgregarArista || !params.nodes.length) return;
        seleccionarExtremoArista(params.nodes[0]);
    });
}

const nombreNodoManual = id => nodosManuales.find(n => n.id === id)?.label || String(id);

function actualizarEstadoArista(texto) {
    document.getElementById('estado-arista').textContent = texto;
}

function cancelarModoArista() {
    modoAgregarArista = false;
    origenAristaSeleccionado = null;
    document.getElementById('form-arista').style.display = 'none';
    actualizarEstadoArista('Indica la capacidad para empezar.');
}

// Cambio: crea la arista dirigida con la capacidad elegida y los dos vértices pulsados.
function seleccionarExtremoArista(id) {
    if (origenAristaSeleccionado === null) {
        origenAristaSeleccionado = id;
        actualizarEstadoArista(`Inicio: ${nombreNodoManual(id)}. Selecciona el vértice final.`);
        return;
    }
    const origen = origenAristaSeleccionado;
    const destino = id;
    const inputCapacidad = document.getElementById('arista-capacidad');
    const capacidad = Number(inputCapacidad.value);
    if (origen === destino) {
        alert('El vértice de inicio y el final deben ser distintos.');
        origenAristaSeleccionado = null;
        actualizarEstadoArista('Selecciona el vértice de inicio.');
        return;
    }
    if (!Number.isInteger(capacidad) || capacidad < 1) {
        alert('La capacidad debe ser un número entero mayor a 0.');
        origenAristaSeleccionado = null;
        actualizarEstadoArista('Selecciona el vértice de inicio.');
        inputCapacidad.focus();
        return;
    }
    if (flechasManuales.some(f => f.origen === origen && f.destino === destino)) {
        alert('Esa arista ya existe.');
        origenAristaSeleccionado = null;
        actualizarEstadoArista('Selecciona el vértice de inicio.');
        return;
    }

    flechasManuales.push({ origen, destino, capacidad });
    dsFlechas.add({
        id: `${origen}-${destino}`,
        from: origen,
        to: destino,
        label: String(capacidad),
        title: 'capacidad ' + capacidad,
        arrows: 'to'
    });
    actualizarInfoManual();
    cancelarModoArista();
    inputCapacidad.value = 1;
}

// Cambio: detecta entradas/salidas y genera superterminales antes de iniciar el algoritmo.
function prepararTerminales(grafo) {
    const preparado = {
        ...grafo,
        nodos: grafo.nodos.map(n => ({ ...n })),
        flechas: grafo.flechas.map(f => ({ ...f }))
    };
    const idsEntrada = new Set(preparado.flechas.map(f => f.destino));
    const idsSalida = new Set(preparado.flechas.map(f => f.origen));
    const entradas = preparado.nodos.filter(n => !idsEntrada.has(n.id) && idsSalida.has(n.id));
    const salidas = preparado.nodos.filter(n => !idsSalida.has(n.id) && idsEntrada.has(n.id));

    if (!entradas.length || !salidas.length) {
        return { error: 'La red debe tener al menos una entrada con aristas salientes y una salida con aristas entrantes.' };
    }

    const maxId = Math.max(...preparado.nodos.map(n => Number(n.id)));
    let idNuevo = maxId + 1;
    const capacidadInfinita = Math.max(1, preparado.flechas.reduce((total, f) => total + Number(f.capacidad), 0) + 1);
    const posicion = id => posicionesGuardadas[id] || preparado.nodos.find(n => n.id === id) || { x: 0, y: 0 };

    if (entradas.length === 1) {
        preparado.fuente = entradas[0].id;
    } else {
        const puntos = entradas.map(n => posicion(n.id));
        const id = idNuevo++;
        const nodo = { id, label: 'S*', x: Math.min(...puntos.map(p => p.x)) - 180,
            y: puntos.reduce((s, p) => s + p.y, 0) / puntos.length };
        preparado.nodos.push(nodo);
        posicionesGuardadas[id] = { x: nodo.x, y: nodo.y };
        for (const entrada of entradas) preparado.flechas.push({
            origen: id, destino: entrada.id, capacidad: capacidadInfinita, infinita: true
        });
        preparado.fuente = id;
    }

    if (salidas.length === 1) {
        preparado.sumidero = salidas[0].id;
    } else {
        const puntos = salidas.map(n => posicion(n.id));
        const id = idNuevo++;
        const nodo = { id, label: 'T*', x: Math.max(...puntos.map(p => p.x)) + 180,
            y: puntos.reduce((s, p) => s + p.y, 0) / puntos.length };
        preparado.nodos.push(nodo);
        posicionesGuardadas[id] = { x: nodo.x, y: nodo.y };
        for (const salida of salidas) preparado.flechas.push({
            origen: salida.id, destino: id, capacidad: capacidadInfinita, infinita: true
        });
        preparado.sumidero = id;
    }
    if (preparado.fuente === preparado.sumidero) {
        return { error: 'La fuente y el sumidero deben ser vértices distintos.' };
    }
    return { grafo: preparado };
}

document.getElementById('agregar-arista').addEventListener('click', () => {
    if (nodosManuales.length < 2) {
        alert('Agrega al menos 2 nodos primero');
        return;
    }
    modoAgregarArista = false;
    origenAristaSeleccionado = null;
    document.getElementById('form-arista').style.display = 'flex';
    document.getElementById('arista-capacidad').focus();
    actualizarEstadoArista('Indica la capacidad para empezar.');
});

document.getElementById('cancelar-arista').addEventListener('click', () => {
    cancelarModoArista();
});

// Cambio: valida la capacidad y activa la selección de origen y destino sobre el grafo.
document.getElementById('confirmar-arista').addEventListener('click', () => {
    const capacidad = Number(document.getElementById('arista-capacidad').value);
    if (!Number.isInteger(capacidad) || capacidad < 1) {
        alert('La capacidad debe ser un número entero mayor a 0.');
        return;
    }
    modoAgregarArista = true;
    origenAristaSeleccionado = null;
    actualizarEstadoArista('Selecciona el vértice de inicio.');
});

document.getElementById('usar-red').addEventListener('click', () => {
    if (nodosManuales.length < MIN_NODOS) {
        alert('Necesitas al menos ' + MIN_NODOS + ' nodos (tienes ' + nodosManuales.length + ')');
        return;
    }
    if (flechasManuales.length < 1) {
        alert('Necesitas al menos 1 arista');
        return;
    }

    cancelarModoArista();
    guardarPosiciones();
    grafoActual = {
        nodos: nodosManuales.slice(),
        flechas: flechasManuales.slice(),
        fuente: nodosManuales[0].id,
        sumidero: nodosManuales[nodosManuales.length - 1].id
    };

    mostrarAlgoritmo();
});

function crearGrafoVacio() {
    dsNodos = new vis.DataSet([]);
    dsFlechas = new vis.DataSet([]);
    if (red) red.destroy();
    red = new vis.Network(contenedor, { nodes: dsNodos, edges: dsFlechas }, opcionesRed);
    red.on('dragEnd', guardarPosiciones);
    habilitarEliminacionDobleClic();

}

// Cambio: muestra las entradas y salidas detectadas en la red manual.
function actualizarInfoManual() {
    const listaNodos = nodosManuales
        .map(n => `${n.label}(${n.id})`)
        .join(', ');
    const listaFlechas = flechasManuales
        .map(f => {
            const o = nodosManuales.find(n => n.id === f.origen);
            const d = nodosManuales.find(n => n.id === f.destino);
            return `${o ? o.label : f.origen}→${d ? d.label : f.destino}(${f.infinita ? '∞' : f.capacidad})`;
        })
        .join(', ');

    const destinos = new Set(flechasManuales.map(f => f.destino));
    const origenes = new Set(flechasManuales.map(f => f.origen));
    const entradas = nodosManuales.filter(n => !destinos.has(n.id) && origenes.has(n.id)).map(n => n.label).join(', ') || 'ninguna';
    const salidas = nodosManuales.filter(n => !origenes.has(n.id) && destinos.has(n.id)).map(n => n.label).join(', ') || 'ninguna';

    document.getElementById('info-manual').textContent =
        `Nodos: ${nodosManuales.length}/${MAX_NODOS} (${listaNodos || 'ninguno'}) | Entradas: ${entradas} | Salidas: ${salidas} | Aristas: ${listaFlechas || 'ninguna'}`;
}

// ========== GRAFO (compartido) ==========

function mostrarGrafoCompleto(datos) {
    const nodos = new vis.DataSet(aplicarPosiciones(datos.nodos.map(nodo => ({
        id: nodo.id,
        label: nodo.label,
        x: nodo.x,
        y: nodo.y
    }))));

    const aristas = new vis.DataSet(datos.flechas.map(flecha => ({
        from: flecha.origen,
        to: flecha.destino,
        label: String(flecha.capacidad),
        title: 'capacidad ' + flecha.capacidad,
        arrows: 'to'
    })));

    if (red) red.destroy();
    red = new vis.Network(contenedor, { nodes: nodos, edges: aristas }, opcionesRed);
    red.fit();
    red.on('dragEnd', guardarPosiciones);

}

// Cambio: prepara automáticamente las terminales y guarda la red base para volver a editar.
function mostrarAlgoritmo() {
    grafoBaseEdicion = grafoActual;
    const resultadoTerminales = prepararTerminales(grafoActual);
    if (resultadoTerminales.error) {
        grafoActual = grafoBaseEdicion;
        grafoBaseEdicion = null;
        alert(resultadoTerminales.error);
        return false;
    }
    grafoActual = resultadoTerminales.grafo;
    destruirRedPasos();
    pasos = [];
    pasoActual = 0;
    memoriaColoresAristas = {};
    document.getElementById('paso-detalle').innerHTML = '';
    document.getElementById('paso-info').textContent = '';
    document.getElementById('flujo-total-num').textContent = '0';
    document.getElementById('flujo-total-max').textContent = '';
    document.getElementById('barra-fill').style.width = '0%';
    document.getElementById('chips').innerHTML = '';
    document.getElementById('anterior').disabled = true;
    document.getElementById('siguiente').disabled = true;
    document.getElementById('contenedor-algoritmo').style.display = 'block';
    document.getElementById('modo-manual').style.display = 'none';
    document.getElementById('modo-aleatorio').style.display = 'none';
    document.getElementById('pasos-algoritmo').style.display = 'none';
    document.getElementById('resultado').style.display = 'none';
    document.getElementById('ejecutar').style.display = 'inline-block';
    document.getElementById('volver-edicion').style.display = 'none';
    return true;

}

// ========== FORD-FULKERSON ==========

document.getElementById('ejecutar').addEventListener('click', async () => {
    if (!grafoActual) { alert('Primero crea un grafo'); return; }
    if (grafoActual.fuente === grafoActual.sumidero) { alert('La fuente y el sumidero deben ser vértices distintos.'); return; }
    guardarPosiciones();
    const peticion = await fetch('/algoritmo', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(grafoActual)
    });
    const datos = await peticion.json();
    if (!peticion.ok) { alert('Error: ' + datos.error); return; }
    pasos = datos.pasos;
    pasoActual = 0;

    document.getElementById('ejecutar').style.display = 'none';
    document.getElementById('volver-edicion').style.display = 'inline-block';

    document.getElementById('pasos-algoritmo').style.display = 'block';
    document.getElementById('resultado').style.display = 'none';
   
    renderizarPaso();
});

document.getElementById('anterior').addEventListener('click', () => {
    if (pasoActual > 0) { pasoActual--; renderizarPaso(); }
});

document.getElementById('siguiente').addEventListener('click', () => {
    if (pasoActual < pasos.length - 1) { pasoActual++; renderizarPaso(); }
});

document.getElementById('volver-edicion').addEventListener('click', () => {
    document.getElementById('contenedor-algoritmo').style.display = 'none';
    document.getElementById('pasos-algoritmo').style.display = 'none';
    document.getElementById('resultado').style.display = 'none';
    document.getElementById('ejecutar').style.display = 'inline-block';
    document.getElementById('volver-edicion').style.display = 'none';

    destruirRedPasos();
    pasos = [];
    pasoActual = 0;
    if (grafoBaseEdicion) grafoActual = grafoBaseEdicion;
    grafoBaseEdicion = null;

    const panel = nodosManuales.length > 0 ? 'modo-manual' : 'modo-aleatorio';
    document.getElementById(panel).style.display = 'flex';
});

document.getElementById('ir-final').addEventListener('click', () => {
    pasoActual = pasos.length - 1;
    renderizarPaso();
});

document.getElementById('reiniciar').addEventListener('click', () => {
    pasoActual = 0;
    renderizarPaso();
});

document.addEventListener('keydown', e => {
    if (!pasos.length || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight' && pasoActual < pasos.length - 1) { pasoActual++; renderizarPaso(); }
    if (e.key === 'ArrowLeft' && pasoActual > 0) { pasoActual--; renderizarPaso(); }
});

// ========== RENDERIZAR PASO ==========

// Cambio: resalta solo las aristas cuyo flujo cambia en la iteración mostrada.
function aristaUsadaEnPaso(arista, paso, flujoAntes) {
    if (paso.camino.length < 2) return false;
    const anterior = flujoAntes.find(f => f.origen === arista.origen && f.destino === arista.destino);
    if (!anterior) return false;
    const cambio = arista.flujo - anterior.flujo;
    return paso.camino.some((nodo, i) => {
        if (i >= paso.camino.length - 1) return false;
        const siguiente = paso.camino[i + 1];
        return (nodo === arista.origen && siguiente === arista.destino && cambio > 0) ||
            (nodo === arista.destino && siguiente === arista.origen && cambio < 0);
    });
}

// Cambio: etiqueta los avances y devoluciones según el cambio neto de flujo del paso actual.
function obtenerSegmentoFlujo(origen, destino, flujoAntes, flujoDespues) {
    const directoAntes = flujoAntes.find(f => f.origen === origen && f.destino === destino);
    const directoDespues = flujoDespues.find(f => f.origen === origen && f.destino === destino);
    const inversoAntes = flujoAntes.find(f => f.origen === destino && f.destino === origen);
    const inversoDespues = flujoDespues.find(f => f.origen === destino && f.destino === origen);

    if (directoAntes && directoDespues && directoDespues.flujo > directoAntes.flujo) {
        return {
            tramo: `${nombreNodo(origen)} → ${nombreNodo(destino)}`,
            espacio: directoAntes.capacidad - directoAntes.flujo,
            tipo: 'Tramo'
        };
    }
    if (inversoAntes && inversoDespues && inversoDespues.flujo < inversoAntes.flujo) {
        return {
            tramo: `${nombreNodo(destino)} → ${nombreNodo(origen)} (devuelve)`,
            espacio: inversoAntes.flujo,
            tipo: 'Tramo (se devuelve flujo)'
        };
    }
    return null;
}

function renderizarPaso() {
    const paso = pasos[pasoActual];
    const esPrimero = pasoActual === 0;
    const esUltimo = pasoActual === pasos.length - 1;
    const totalPasos = pasos.length - 1;

    // Flujo antes de este paso
    const flujoAntes = esPrimero
        ? paso.flujo.map(f => ({ ...f, flujo: 0 }))
        : pasos[pasoActual - 1].flujo;

    // --- Grafo ---
    // Cambio: reconstruye la etiqueta de todos los vértices para que no queden signos ni pesos del paso previo.
    const datosNodos = grafoActual.nodos.map(nodo => {
    const et = paso.etiquetas.find(e => e.id === nodo.id);
    return { id: nodo.id, label: et ? nodo.label + '\n' + et.etiqueta : nodo.label };
});

// Cambio: presenta capacidades suplementarias como ∞ y refleja el flujo del paso activo.
const datosAristas = paso.flujo.map(f => {
    const enCamino = aristaUsadaEnPaso(f, paso, flujoAntes);

    let color = COLOR_VACIA, colortexto = '#343434';
    if (enCamino)                     { color = colorCamino(pasoActual); }
    else if (f.flujo >= f.capacidad)  { color = COLOR_LLENA; colortexto = COLOR_LLENA; }
    else if (f.flujo > 0)             { color = COLOR_PARCIAL; }

    return {
        id: `${f.origen}-${f.destino}`,   
        from: f.origen, to: f.destino,
        label: f.flujo + '/' + (grafoActual.flechas.find(a => a.origen === f.origen && a.destino === f.destino)?.infinita ? '∞' : f.capacidad),
        color: { color, highlight: color },
        font: { color: colortexto },
        width: enCamino ? 3 : (f.flujo > 0 ? 2 : 1),
        arrows: 'to'
    };
});

if (!redPasos) {
    dsNodosPasos = new vis.DataSet(aplicarPosiciones(datosNodos));
    dsAristasPasos = new vis.DataSet(datosAristas);
    redPasos = new vis.Network(contenedorPasos, { nodes: dsNodosPasos, edges: dsAristasPasos }, opcionesRed);
    redPasos.fit();
} else {
    dsNodosPasos.update(datosNodos);    
    dsAristasPasos.update(datosAristas);
}

    // --- Navegación ---
    document.getElementById('paso-info').textContent =
        esPrimero ? 'Inicio' : esUltimo ? 'Terminado' : `Paso ${pasoActual} de ${totalPasos}`;
    document.getElementById('anterior').disabled = esPrimero;
    document.getElementById('siguiente').disabled = esUltimo;

    // --- Progreso ---
    const flujoTotal = paso.flujo_total;
    const flujoMax = pasos[pasos.length - 1].flujo_total;
    document.getElementById('flujo-total-num').textContent = flujoTotal;
    document.getElementById('flujo-total-max').textContent = esUltimo ? '= flujo máximo' : '';
    document.getElementById('barra-fill').style.width =
        flujoMax > 0 ? (100 * flujoTotal / flujoMax) + '%' : '0%';

    // --- Chips de caminos ---
    const chipsHTML = pasos.slice(0, pasoActual + 1)
    .filter(p => p.camino.length > 0)
    .map(p => {
        const color = colorCamino(p.paso);
        const activo = p === paso ? `background:${color}; color:#fff;` : '';
        return `<span class="chip" style="color:${color}; border-color:${color}; ${activo}">` +
               `${p.camino.map(nombreNodo).join(' → ')} (+${p.cuello_botella})</span>`;
    }).join(' ') || '<span>Ninguno</span>';

    document.getElementById('chips').innerHTML = chipsHTML;

    renderizarLeyenda(paso);

    // --- Detalle del paso ---
    document.getElementById('paso-detalle').innerHTML = generarDetallePaso(paso, flujoAntes, esPrimero, esUltimo);

    // --- Resultado final ---
    if (esUltimo) {
        mostrarResultado(paso);
    } else {
        document.getElementById('resultado').style.display = 'none';
    }
}

function renderizarLeyenda(paso) {
    const items = [
        { color: COLOR_LLENA,   texto: 'Llena (ya no admite más)' },
        { color: COLOR_PARCIAL, texto: 'Con flujo parcial' },
        { color: COLOR_VACIA,   texto: 'Vacía (flujo 0)' },
        paso.camino.length > 0
            ? { color: colorCamino(paso.paso),
                texto: `Camino ${paso.paso}: ${paso.camino.map(nombreNodo).join(' → ')} (+${paso.cuello_botella})` }
            : { color: '#cbd5e1', texto: 'Camino actual: ninguno en este paso' }
    ];
    document.getElementById('leyenda').innerHTML = items
        .map(i => `<span><i class="punto" style="background:${i.color}"></i>${i.texto}</span>`)
        .join('');
}

function generarDetallePaso(paso, flujoAntes, esPrimero, esUltimo) {
    if (esPrimero) {
        return `<div><b>Al empezar</b>, ninguna arista lleva flujo (todas muestran 0).
            El programa buscará caminos desde la fuente <b>${nombreNodo(grafoActual.fuente)}</b>
            hasta el sumidero <b>${nombreNodo(grafoActual.sumidero)}</b> por los que todavía quepa más flujo.
            Pulsa «Siguiente».</div>`;
    }

    if (esUltimo) {
        if (paso.flujo_total === 0) {
            return `<div><b>No hay ningún camino</b> de ${nombreNodo(grafoActual.fuente)} a
                ${nombreNodo(grafoActual.sumidero)} en esta red, así que no se puede enviar nada
                (flujo máximo = 0).</div>`;
        }
        const corte = paso.corte_minimo;
        let corteHTML = '';
        if (corte && corte.aristas.length > 0) {
            const filas = corte.aristas.map(a =>
                `<tr><td>${nombreNodo(a.origen)}→${nombreNodo(a.destino)}</td>
                 <td>${a.flujo}</td><td>${a.infinita ? '∞' : a.capacidad}</td></tr>`
            ).join('');
            const totalCap = corte.aristas.some(a => a.infinita) ? '∞' : corte.aristas.reduce((s, a) => s + a.capacidad, 0);
            corteHTML = `
                <h3>Corte mínimo</h3>
                <p>Nodos del lado de la fuente: <b>${corte.lado_s.map(nombreNodo).join(', ')}</b></p>
                <table>
                    <tr><th>Arista</th><th>Flujo</th><th>Capacidad</th></tr>
                    ${filas}
                    <tr><td><b>Total</b></td><td></td><td><b>${totalCap}</b></td></tr>
                </table>
                <p>Flujo máximo = <b>${paso.flujo_total}</b> = Capacidad del corte mínimo = <b>${totalCap}</b> ✓</p>`;
        }
        return `<div><b>Ya no hay ningún camino con espacio libre</b> de
            ${nombreNodo(grafoActual.fuente)} a ${nombreNodo(grafoActual.sumidero)},
            así que el flujo máximo es <b>${paso.flujo_total}</b>.${corteHTML}</div>`;
    }

    // Paso intermedio: desglose del camino
    const camino = paso.camino;
    const segmentos = [];
    for (let i = 0; i < camino.length - 1; i++) {
        const u = camino[i], v = camino[i + 1];
        const segmento = obtenerSegmentoFlujo(u, v, flujoAntes, paso.flujo);
        if (segmento) segmentos.push(segmento);
    }

    const espacios = segmentos.map(s => s.espacio);
    const menorEspacio = Math.min(...espacios);
    const flujoAntesTotal = paso.flujo_total - paso.cuello_botella;

    const segmentosHTML = segmentos.map(s =>
        `<div><b>${s.tipo}</b><div>${s.tramo}</div>
         <b>${s.tipo === 'Tramo' ? 'Espacio libre' : 'Flujo que se puede devolver'}</b>
         <div>${s.espacio}</div></div>`
    ).join('');

    return `
        <div><b>Paso ${pasoActual}: se encontró un camino con espacio libre.</b></div>
        <p>Camino: <b>${camino.map(n => nombreNodo(n)).join(' → ')}</b>
        (una flecha ← significa que en ese tramo se devuelve flujo)</p>
        <div>${segmentosHTML}</div>
        <p>El tramo más estrecho limita todo el camino: el menor espacio libre es
        <b>${menorEspacio}</b>. Por eso se envían <b>${paso.cuello_botella}</b> unidades
        por este camino. Flujo total: ${flujoAntesTotal} + ${paso.cuello_botella} =
        <b>${paso.flujo_total}</b>.</p>`;
}

// ========== RESULTADO FINAL ==========

// Cambio: presenta las capacidades infinitas en el resultado sin exponer el límite numérico interno.
function mostrarResultado(pasoFinal) {
    const flujoMax = pasoFinal.flujo_total;

    const filasAristas = pasoFinal.flujo.map(f =>
        `<tr><td>${nombreNodo(f.origen)}→${nombreNodo(f.destino)}</td>
         <td>${f.flujo}</td><td>${f.infinita ? '∞' : f.capacidad}</td></tr>`
    ).join('');

    const pasosConCamino = pasos.filter(p => p.camino.length > 0);
    const filasCaminos = pasosConCamino.map((p, i) =>
        `<tr><td>${i + 1}</td>
         <td>${p.camino.map(n => nombreNodo(n)).join(' → ')}</td>
         <td>${p.cuello_botella}</td>
         <td>${p.flujo_total}</td></tr>`
    ).join('') || '<tr><td colspan="4">Ninguno</td></tr>';

    const corte = pasoFinal.corte_minimo;
    let corteHTML = '';
    if (corte && corte.aristas.length > 0) {
        const totalCap = corte.aristas.some(a => a.infinita) ? '∞' : corte.aristas.reduce((s, a) => s + a.capacidad, 0);
        const filasCorte = corte.aristas.map(a =>
            `<tr><td>${nombreNodo(a.origen)}→${nombreNodo(a.destino)}</td>
             <td>${a.flujo}</td><td>${a.infinita ? '∞' : a.capacidad}</td></tr>`
        ).join('');
        corteHTML = `
            <div>
                <b>Corte mínimo</b>
                <p>Nodos del lado de la fuente: <b>${corte.lado_s.map(nombreNodo).join(', ')}</b></p>
                <table>
                    <tr><th>Arista del corte</th><th>Flujo</th><th>Capacidad</th></tr>
                    ${filasCorte}
                    <tr><td><b>Total</b></td><td></td><td><b>${totalCap}</b></td></tr>
                </table>
                <p>Flujo máximo = <b>${flujoMax}</b> = Capacidad del corte = <b>${totalCap}</b> ✓</p>
            </div>`;
    }

    document.getElementById('resultado-contenido').innerHTML = `
        <div>
            <label>Valor del flujo máximo</label>
            <div><b>${flujoMax}</b></div>
            <b>Flujo en cada arista</b>
            <table>
                <tr><th>Arista</th><th>Flujo</th><th>Capacidad</th></tr>
                ${filasAristas}
            </table>
        </div>
        <div>
            <b>Caminos usados</b>
            <table>
                <tr><th>#</th><th>Camino</th><th>Se envían</th><th>Flujo total</th></tr>
                ${filasCaminos}
            </table>
        </div>
        ${corteHTML}`;

    document.getElementById('resultado').style.display = 'block';
}
