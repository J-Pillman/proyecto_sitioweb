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

// Colores para las aristas y el corte mínimo
const COLOR_LLENA = '#d32f2f', COLOR_PARCIAL = '#f59e0b', COLOR_VACIA = '#848484';
const COLOR_CORTE_ARISTA = '#15803d';
const COLOR_CORTE_LINEA = '#b91c1c';

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
    document.getElementById('arista-capacidad').value = 1;
    actualizarEstadoArista('Indica la capacidad para empezar.');
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
    actualizarEstadoArista('Indica la capacidad para empezar.');
}

function buscarCaminoManual(inicio, fin, listaAristas = flechasManuales) {
    const nodoInicio = Number(inicio);
    const nodoFin = Number(fin);
    const cola = [[nodoInicio]];
    const visitados = new Set([nodoInicio]);
    while (cola.length > 0) {
        const camino = cola.shift();
        const actual = camino[camino.length - 1];
        if (actual === nodoFin) return camino;
        for (const f of listaAristas) {
            const orig = Number(f.origen);
            const dest = Number(f.destino);
            if (orig === actual && !visitados.has(dest)) {
                visitados.add(dest);
                cola.push([...camino, dest]);
            }
        }
    }
    return null;
}

function detectarCicloEnGrafo(nodos, flechas) {
    for (const f of flechas) {
        if (Number(f.origen) === Number(f.destino)) {
            return [Number(f.origen), Number(f.destino)];
        }
        const resto = flechas.filter(x => !(Number(x.origen) === Number(f.origen) && Number(x.destino) === Number(f.destino)));
        const camino = buscarCaminoManual(f.destino, f.origen, resto);
        if (camino) {
            return [...camino, Number(f.destino)];
        }
    }
    return null;
}

// Cambio: crea la arista dirigida con la capacidad elegida y los dos vértices pulsados, verificando que no se formen bucles/ciclos.
function seleccionarExtremoArista(id) {
    const idNum = Number(id);
    if (origenAristaSeleccionado === null) {
        origenAristaSeleccionado = idNum;
        actualizarEstadoArista(`Inicio: ${nombreNodoManual(idNum)}. Selecciona el vértice final.`);
        return;
    }
    const origen = Number(origenAristaSeleccionado);
    const destino = idNum;
    const inputCapacidad = document.getElementById('arista-capacidad');
    const capacidad = Number(inputCapacidad.value);
    if (origen === destino) {
        alert(`Error: No se permite un bucle en el mismo vértice (${nombreNodoManual(origen)} → ${nombreNodoManual(destino)}).`);
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
    if (flechasManuales.some(f => Number(f.origen) === origen && Number(f.destino) === destino)) {
        alert(`Error: La arista ${nombreNodoManual(origen)} → ${nombreNodoManual(destino)} ya existe.`);
        origenAristaSeleccionado = null;
        actualizarEstadoArista('Selecciona el vértice de inicio.');
        return;
    }
    const caminoExistente = buscarCaminoManual(destino, origen);
    if (caminoExistente) {
        const cicloTexto = [...caminoExistente, destino].map(nombreNodoManual).join(' → ');
        alert(`Error: No se puede agregar la arista ${nombreNodoManual(origen)} → ${nombreNodoManual(destino)} porque se formaría un bucle (ciclo): ${cicloTexto}.`);
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
    const aislados = preparado.nodos.filter(n => !idsEntrada.has(n.id) && !idsSalida.has(n.id));
    if (aislados.length > 0) {
        return { error: `No se permiten nodos aislados sin aristas (${aislados.map(n => n.label).join(', ')}).` };
    }
    const ciclo = detectarCicloEnGrafo(preparado.nodos, preparado.flechas);
    if (ciclo) {
        const etCiclo = ciclo.map(id => preparado.nodos.find(n => Number(n.id) === Number(id))?.label || id).join(' → ');
        return { error: `No se permiten bucles (ciclos) en la red: ${etCiclo}.` };
    }
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

// Cambio: valida la capacidad y activa la selección de origen y destino sobre el grafo.
document.getElementById('confirmar-arista').addEventListener('click', () => {
    if (nodosManuales.length < 2) {
        alert('Agrega al menos 2 nodos primero.');
        return;
    }
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
    const conectados = new Set();
    for (const f of flechasManuales) {
        conectados.add(f.origen);
        conectados.add(f.destino);
    }
    const aislados = nodosManuales.filter(n => !conectados.has(n.id));
    if (aislados.length > 0) {
        alert(`Error: No se permiten nodos aislados sin aristas (${aislados.map(n => n.label).join(', ')}). Conéctalos o elimínalos con doble clic.`);
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
    document.getElementById('paso-info').textContent = '';
    document.getElementById('flujo-total-num').textContent = '0';
    document.getElementById('flujo-total-max').textContent = '';
    document.getElementById('barra-fill').style.width = '0%';
    document.getElementById('chips').innerHTML = '';
    document.getElementById('anterior').disabled = true;
    document.getElementById('siguiente').disabled = true;
    document.getElementById('contenedor-algoritmo').style.display = 'block';
    document.getElementById('modo-manual').style.display = 'none';
    document.getElementById('pasos-algoritmo').style.display = 'none';
    document.getElementById('resultado').style.display = 'none';
    document.getElementById('ejecutar').style.display = 'inline-block';
    document.getElementById('volver-edicion').style.display = 'none';
    return true;

}

// ========== FORD-FULKERSON ==========

// Desglosa cada camino aumentante en sub-pasos arista por arista.
function expandirPasosPorArista(pasosOriginales) {
    if (!pasosOriginales || pasosOriginales.length === 0) return [];
    const expandidos = [pasosOriginales[0]];

    for (let idx = 1; idx < pasosOriginales.length - 1; idx++) {
        const p = pasosOriginales[idx];
        const previo = pasosOriginales[idx - 1];
        const flujoPrevio = previo.flujo;
        const flujoTotalPrevio = previo.flujo_total;
        const totalAristas = p.camino.length - 1;

        let flujoParcial = flujoPrevio.map(a => ({ ...a }));

        for (let i = 0; i < totalAristas; i++) {
            const u = p.camino[i];
            const v = p.camino[i + 1];
            const esUltimaArista = i === totalAristas - 1;

            const directaFinal = p.flujo.find(a => a.origen === u && a.destino === v);
            const directaPrevia = flujoPrevio.find(a => a.origen === u && a.destino === v);

            if (directaFinal && directaPrevia && directaFinal.flujo !== directaPrevia.flujo) {
                flujoParcial = flujoParcial.map(a =>
                    (a.origen === u && a.destino === v) ? { ...a, flujo: directaFinal.flujo } : a
                );
            } else {
                const inversaFinal = p.flujo.find(a => a.origen === v && a.destino === u);
                if (inversaFinal) {
                    flujoParcial = flujoParcial.map(a =>
                        (a.origen === v && a.destino === u) ? { ...a, flujo: inversaFinal.flujo } : a
                    );
                }
            }

            const nodosRecorridos = new Set(p.camino.slice(0, i + 2));
            const etiquetasParciales = p.etiquetas.filter(e => nodosRecorridos.has(e.id));
            if (!nodosRecorridos.has(grafoActual.sumidero)) {
                etiquetasParciales.push({ id: grafoActual.sumidero, etiqueta: 't' });
            }

            expandidos.push({
                paso: p.paso,
                flujo_total: esUltimaArista ? p.flujo_total : flujoTotalPrevio,
                camino: [u, v],
                camino_parcial: p.camino.slice(0, i + 2),
                camino_completo: p.camino,
                arista_num: i + 1,
                arista_total: totalAristas,
                es_fin_camino: esUltimaArista,
                cuello_botella: p.cuello_botella,
                flujo: flujoParcial.map(a => ({ ...a })),
                etiquetas: etiquetasParciales
            });
        }
    }

    if (pasosOriginales.length > 1) {
        expandidos.push(pasosOriginales[pasosOriginales.length - 1]);
    }
    return expandidos;
}

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
    pasos = expandirPasosPorArista(datos.pasos);
    pasoActual = 0;

    document.getElementById('modo-aleatorio').style.display = 'none';
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

function regresarAPanelModo() {
    document.getElementById('pasos-algoritmo').style.display = 'none';
    document.getElementById('resultado').style.display = 'none';
    document.getElementById('ejecutar').style.display = 'inline-block';
    document.getElementById('volver-edicion').style.display = 'none';

    destruirRedPasos();
    pasos = [];
    pasoActual = 0;
    if (grafoBaseEdicion) grafoActual = grafoBaseEdicion;
    grafoBaseEdicion = null;

    if (nodosManuales.length > 0) {
        document.getElementById('contenedor-algoritmo').style.display = 'none';
        document.getElementById('modo-manual').style.display = 'flex';
    } else {
        document.getElementById('modo-aleatorio').style.display = 'flex';
    }
}

document.getElementById('volver-edicion').addEventListener('click', regresarAPanelModo);

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

// Dibuja la línea divisoria del corte mínimo (S | T) sobre el lienzo en el paso final.
function dibujarLineaCorte(ctx) {
    if (!pasos.length || pasoActual !== pasos.length - 1 || !redPasos) return;
    const paso = pasos[pasoActual];
    if (!paso.corte_minimo || paso.flujo_total <= 0) return;

    const ladoS = new Set(paso.corte_minimo.lado_s);
    const pos = redPasos.getPositions();
    const posFuente = pos[grafoActual.fuente] || { x: 0, y: 0 };
    const refX = posFuente.x - 60;
    const refY = posFuente.y;

    const cruces = [];
    const crucesCorteDirecto = [];
    for (const f of paso.flujo) {
        const uEnS = ladoS.has(f.origen);
        const vEnS = ladoS.has(f.destino);
        if (uEnS !== vEnS && pos[f.origen] && pos[f.destino]) {
            const pS = uEnS ? pos[f.origen] : pos[f.destino];
            const pT = uEnS ? pos[f.destino] : pos[f.origen];
            const punto = {
                x: pS.x * 0.55 + pT.x * 0.45,
                y: pS.y * 0.55 + pT.y * 0.45
            };
            cruces.push(punto);
            if (uEnS && !vEnS) {
                crucesCorteDirecto.push(punto);
            }
        }
    }
    if (!cruces.length) return;

    // Si un nodo de S tiene nodos de T en su misma vertical, agregamos un punto guía a su derecha
    // para que la curva rodee al nodo de S y nunca lo atraviese ni cruce aristas internas S->S.
    const todosNodos = Object.entries(pos).map(([id, p]) => ({ id: Number(id), x: p.x, y: p.y }));
    for (const nS of todosNodos) {
        if (!ladoS.has(nS.id) || nS.id === grafoActual.fuente) continue;
        const tieneTEnMismaColumna = todosNodos.some(
            nT => !ladoS.has(nT.id) && Math.abs(nT.x - nS.x) < 35
        );
        const yaHayCruceDerecha = cruces.some(
            c => c.x > nS.x + 20 && Math.abs(c.y - nS.y) < 35
        );
        if (tieneTEnMismaColumna && !yaHayCruceDerecha) {
            cruces.push({ x: nS.x + 55, y: nS.y });
        }
    }

    // Ordenar puntos por ángulo polar desde la fuente (de arriba hacia abajo rodeando el conjunto S)
    cruces.sort((a, b) => Math.atan2(a.y - refY, a.x - refX) - Math.atan2(b.y - refY, b.x - refX));

    // Empujar cualquier punto del corte que pase demasiado cerca del centro de algún nodo
    for (const c of cruces) {
        for (const n of todosNodos) {
            const dx = c.x - n.x;
            const dy = c.y - n.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 42) {
                if (ladoS.has(n.id)) {
                    c.x = Math.max(c.x, n.x + 44);
                } else {
                    c.x = Math.min(c.x, n.x - 44);
                }
            }
        }
    }

    const minY = Math.min(...todosNodos.map(n => n.y), ...cruces.map(c => c.y));
    const maxY = Math.max(...todosNodos.map(n => n.y), ...cruces.map(c => c.y));
    const primero = cruces[0];
    const ultimo = cruces[cruces.length - 1];
    const puntos = [
        { x: primero.x, y: minY - 50 },
        ...cruces,
        { x: ultimo.x, y: maxY + 50 }
    ];

    ctx.save();
    ctx.strokeStyle = COLOR_CORTE_LINEA;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash([10, 6]);
    ctx.beginPath();
    ctx.moveTo(puntos[0].x, puntos[0].y);

    for (let i = 0; i < puntos.length - 1; i++) {
        const actual = puntos[i];
        const sig = puntos[i + 1];
        const mx = (actual.x + sig.x) / 2;
        const my = (actual.y + sig.y) / 2;
        ctx.quadraticCurveTo(actual.x, actual.y, mx, my);
    }
    const fin = puntos[puntos.length - 1];
    ctx.lineTo(fin.x, fin.y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Marcar con un punto cada arista del corte mínimo (S -> T) que es cortada
    for (const p of crucesCorteDirecto) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = COLOR_CORTE_LINEA;
        ctx.stroke();
    }

    // Etiquetas S y T arriba de la línea de corte sin pisar ningún nodo
    ctx.font = 'italic bold 22px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText('S', puntos[0].x - 26, puntos[0].y + 8);
    ctx.strokeText('T', puntos[0].x + 26, puntos[0].y + 8);
    ctx.fillStyle = '#dc2626';
    ctx.fillText('S', puntos[0].x - 26, puntos[0].y + 8);
    ctx.fillText('T', puntos[0].x + 26, puntos[0].y + 8);
    ctx.restore();
}

function renderizarPaso() {
    const paso = pasos[pasoActual];
    const esPrimero = pasoActual === 0;
    const esUltimo = pasoActual === pasos.length - 1;
    const totalPasos = pasos.length - 1;
    const mostrarCorte = esUltimo && paso.corte_minimo && paso.flujo_total > 0;
    const ladoS = mostrarCorte ? new Set(paso.corte_minimo.lado_s) : null;

    // Flujo antes de este paso
    const flujoAntes = esPrimero
        ? paso.flujo.map(f => ({ ...f, flujo: 0 }))
        : pasos[pasoActual - 1].flujo;

    // --- Grafo ---
    // Cambio: reconstruye la etiqueta de todos los vértices y colorea los conjuntos S y T al finalizar.
    const datosNodos = grafoActual.nodos.map(nodo => {
        const et = paso.etiquetas.find(e => e.id === nodo.id);
        let colorNodo = { background: '#97c2fc', border: '#2b7ce9' };
        let colorFuenteTexto = '#343434';
        if (mostrarCorte) {
            if (nodo.id === grafoActual.fuente) {
                colorNodo = { background: '#ea580c', border: '#9a3412' };
                colorFuenteTexto = '#ffffff';
            } else if (ladoS.has(nodo.id)) {
                colorNodo = { background: '#1e3a8a', border: '#172554' };
                colorFuenteTexto = '#ffffff';
            } else {
                colorNodo = { background: '#06b6d4', border: '#0e7490' };
                colorFuenteTexto = '#0f172a';
            }
        }
        return {
            id: nodo.id,
            label: et ? nodo.label + '\n' + et.etiqueta : nodo.label,
            color: colorNodo,
            font: { color: colorFuenteTexto, size: 16 }
        };
    });

    // Cambio: presenta capacidades suplementarias como ∞ y resalta las aristas del corte mínimo al terminar.
    const datosAristas = paso.flujo.map(f => {
        const enCamino = aristaUsadaEnPaso(f, paso, flujoAntes);
        const enCorte = mostrarCorte && paso.corte_minimo.aristas.some(
            a => a.origen === f.origen && a.destino === f.destino
        );

        let color = COLOR_VACIA, colortexto = '#343434';
        if (enCorte)                      { color = COLOR_CORTE_ARISTA; colortexto = COLOR_CORTE_ARISTA; }
        else if (enCamino)                { color = colorCamino(paso.paso); }
        else if (f.flujo >= f.capacidad)  { color = COLOR_LLENA; colortexto = COLOR_LLENA; }
        else if (f.flujo > 0)             { color = COLOR_PARCIAL; }

        return {
            id: `${f.origen}-${f.destino}`,   
            from: f.origen, to: f.destino,
            label: f.flujo + '/' + (grafoActual.flechas.find(a => a.origen === f.origen && a.destino === f.destino)?.infinita ? '∞' : f.capacidad),
            color: { color, highlight: color },
            font: { color: colortexto },
            width: enCorte ? 4 : (enCamino ? 3 : (f.flujo > 0 ? 2 : 1)),
            arrows: 'to'
        };
    });

    if (!redPasos) {
        dsNodosPasos = new vis.DataSet(aplicarPosiciones(datosNodos));
        dsAristasPasos = new vis.DataSet(datosAristas);
        redPasos = new vis.Network(contenedorPasos, { nodes: dsNodosPasos, edges: dsAristasPasos }, opcionesRed);
        redPasos.on('afterDrawing', dibujarLineaCorte);
        redPasos.fit();
    } else {
        dsNodosPasos.update(datosNodos);    
        dsAristasPasos.update(datosAristas);
        redPasos.redraw();
    }

    // --- Navegación ---
    document.getElementById('paso-info').textContent =
        esPrimero ? 'Inicio' : esUltimo ? 'Terminado' : `Camino ${paso.paso} (arista ${paso.arista_num}/${paso.arista_total}) · Paso ${pasoActual}/${totalPasos}`;
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
    const caminosVistos = new Map();
    for (const p of pasos.slice(0, pasoActual + 1)) {
        if (p.camino.length > 0) {
            caminosVistos.set(p.paso, p);
        }
    }
    const chipsHTML = [...caminosVistos.values()]
    .map(p => {
        const color = colorCamino(p.paso);
        const activo = (!esPrimero && !esUltimo && p.paso === paso.paso) ? `background:${color}; color:#fff;` : '';
        const nodosMostrar = p.camino_parcial || p.camino;
        return `<span class="chip" style="color:${color}; border-color:${color}; ${activo}">` +
               `${nodosMostrar.map(nombreNodo).join(' → ')} (+${p.cuello_botella})</span>`;
    }).join(' ') || '<span>Ninguno</span>';

    document.getElementById('chips').innerHTML = chipsHTML;

    renderizarLeyenda(paso);

    // --- Resultado final ---
    if (esUltimo) {
        mostrarResultado(paso);
    } else {
        document.getElementById('resultado').style.display = 'none';
    }
}

function renderizarLeyenda(paso) {
    const esUltimo = pasoActual === pasos.length - 1;
    const items = [
        { color: COLOR_LLENA,   texto: 'Llena' },
        { color: COLOR_PARCIAL, texto: 'Con flujo parcial' },
        { color: COLOR_VACIA,   texto: 'Vacía' },
        paso.camino.length > 0
            ? { color: colorCamino(paso.paso),
                texto: `Camino ${paso.paso}: ${paso.camino.map(nombreNodo).join(' → ')} (+${paso.cuello_botella})` }
            : (esUltimo && paso.corte_minimo && paso.flujo_total > 0)
                ? { color: COLOR_CORTE_ARISTA, texto: 'Arista del corte mínimo' }
                : { color: '#cbd5e1', texto: 'Arista actual: ninguna en este paso' }
    ];
    document.getElementById('leyenda').innerHTML = items
        .map(i => `<span><i class="punto" style="background:${i.color}"></i>${i.texto}</span>`)
        .join('');
}

// ========== RESULTADO FINAL ==========

// Cambio: presenta las capacidades infinitas en el resultado sin exponer el límite numérico interno.
function mostrarResultado(pasoFinal) {
    const flujoMax = pasoFinal.flujo_total;

    const filasAristas = pasoFinal.flujo.map(f =>
        `<tr><td>${nombreNodo(f.origen)} <b class="flecha">→</b> ${nombreNodo(f.destino)}</td>
         <td>${f.flujo}</td><td>${f.infinita ? '∞' : f.capacidad}</td></tr>`
    ).join('');

    const pasosConCamino = pasos.filter(p => p.camino.length > 0 && p.es_fin_camino);
    const filasCaminos = pasosConCamino.map((p, i) =>
        `<tr><td>${i + 1}</td>
         <td>${(p.camino_completo || p.camino).map(n => nombreNodo(n)).join(' <b class="flecha">→</b> ')}</td>
         <td>${p.cuello_botella}</td>
         <td>${p.flujo_total}</td></tr>`
    ).join('') || '<tr><td colspan="4">Ninguno</td></tr>';

    const corte = pasoFinal.corte_minimo;
    let corteHTML = '';
    if (corte && corte.aristas.length > 0) {
        const totalCap = corte.aristas.some(a => a.infinita) ? '∞' : corte.aristas.reduce((s, a) => s + a.capacidad, 0);
        const filasCorte = corte.aristas.map(a =>
            `<tr><td>${nombreNodo(a.origen)} <b class="flecha">→</b> ${nombreNodo(a.destino)}</td>
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
                <p>Flujo máximo = <b>${flujoMax}</b> = Capacidad del corte = <b>${totalCap}</b></p>
            </div>`;
    }

    document.getElementById('resultado-contenido').innerHTML = `
        <div>
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
