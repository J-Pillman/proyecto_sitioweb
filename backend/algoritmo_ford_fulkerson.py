from collections import deque


# Cambio: valida la red antes de iniciar Ford-Fulkerson para rechazar datos ambiguos o inválidos.
def validar_entrada(nodos, flechas, fuente, sumidero):
    if not isinstance(nodos, list) or not nodos:
        raise ValueError('La red debe incluir al menos un vértice.')
    if not isinstance(flechas, list):
        raise ValueError('Las aristas deben enviarse como una lista.')

    ids = []
    for nodo in nodos:
        if not isinstance(nodo, dict) or 'id' not in nodo or 'label' not in nodo:
            raise ValueError('Cada vértice debe incluir id y etiqueta.')
        identificador = nodo['id']
        if isinstance(identificador, bool) or not isinstance(identificador, int):
            raise ValueError('Los identificadores de vértice deben ser enteros.')
        ids.append(identificador)
    if len(ids) != len(set(ids)):
        raise ValueError('Los identificadores de vértice no pueden repetirse.')
    ids_validos = set(ids)

    if isinstance(fuente, bool) or not isinstance(fuente, int) or fuente not in ids_validos:
        raise ValueError('La fuente debe ser un vértice existente.')
    if isinstance(sumidero, bool) or not isinstance(sumidero, int) or sumidero not in ids_validos:
        raise ValueError('El sumidero debe ser un vértice existente.')
    if fuente == sumidero:
        raise ValueError('La fuente y el sumidero deben ser vértices distintos.')

    pares = set()
    for arista in flechas:
        if not isinstance(arista, dict) or not all(k in arista for k in ('origen', 'destino', 'capacidad')):
            raise ValueError('Cada arista debe incluir origen, destino y capacidad.')
        origen, destino, capacidad = arista['origen'], arista['destino'], arista['capacidad']
        if (isinstance(origen, bool) or not isinstance(origen, int) or
                isinstance(destino, bool) or not isinstance(destino, int)):
            raise ValueError('Los extremos de las aristas deben ser identificadores enteros.')
        if origen not in ids_validos or destino not in ids_validos:
            raise ValueError('Cada arista debe conectar vértices existentes.')
        if origen == destino:
            raise ValueError('No se permiten aristas que conecten un vértice consigo mismo.')
        par = (origen, destino)
        if par in pares:
            raise ValueError('No se permiten aristas duplicadas con la misma dirección.')
        pares.add(par)
        if isinstance(capacidad, bool) or not isinstance(capacidad, int) or capacidad < 0:
            raise ValueError('Las capacidades deben ser enteros no negativos.')


def ford_fulkerson(nodos, flechas, fuente, sumidero):
    validar_entrada(nodos, flechas, fuente, sumidero)
    letras = {n['id']: str(n['label']) for n in nodos}

    capacidad={}
    # Cambio: mantiene la marca de las aristas suplementarias que se presentan como capacidad infinita.
    capacidad_infinita=set()
    for f in flechas:
        capacidad[(f['origen'], f['destino'])] = f['capacidad']
        if f.get('infinita'):
            capacidad_infinita.add((f['origen'], f['destino']))

    # Cambio: conserva arcos residuales separados para distinguir avance y devolución incluso con aristas opuestas.
    adyacencia = {identificador: [] for identificador in letras}
    for (u, v), cap in sorted(capacidad.items()):
        indice_directo = len(adyacencia[u])
        indice_inverso = len(adyacencia[v])
        adyacencia[u].append({
            'destino': v, 'residual': cap, 'inversa': indice_inverso,
            'original': (u, v), 'sentido': 1
        })
        adyacencia[v].append({
            'destino': u, 'residual': 0, 'inversa': indice_directo,
            'original': (u, v), 'sentido': -1
        })

    flujo= {(u,v): 0 for (u,v) in capacidad}

    def snapshot(paso,camino,botella,etiquetas,desc,flujo_total):
        return {
            'paso' : paso,
            'descripcion' : desc,
            'flujo_total' : flujo_total,
            'camino': camino,
            'cuello_botella' : botella,
            'flujo': [
                {'origen': u, 'destino':v, 'flujo':flujo[(u,v)], 'capacidad':cap,
                 'infinita': (u, v) in capacidad_infinita}
                for (u,v), cap in capacidad.items()
            ],
            'etiquetas':etiquetas
        }

    pasos = []

    pasos.append(snapshot(
        0,[],0,
        [{'id':fuente, 'etiqueta': 's'}, {'id': sumidero, 'etiqueta': 't'}],
        'Estado inicial: flujo = 0 en todas las aristas',
        0
    ))

    paso_num=1
    flujo_total=0

    while True:
        padre = {fuente: None}
        arco_padre = {}
        cuello = {fuente: float('inf')}
        cola = deque([fuente])
        visitados = [fuente]

        while cola:
            u = cola.popleft()
            if u == sumidero:
                break
            aristas_ordenadas = sorted(
                enumerate(adyacencia[u]),
                key=lambda par: (par[1]['destino'], par[1]['original'], -par[1]['sentido'])
            )
            for indice, arista in aristas_ordenadas:
                v = arista['destino']
                if v not in padre and arista['residual'] > 0:
                    padre[v] = u
                    arco_padre[v] = (u, indice)
                    cuello[v] = min(cuello[u], arista['residual'])
                    cola.append(v)
                    visitados.append(v)

        if sumidero not in padre:
            break

        camino = [sumidero]
        arcos_camino = []
        nodo = sumidero
        while nodo != fuente:
            anterior, indice = arco_padre[nodo]
            arcos_camino.append((anterior, indice))
            nodo = anterior
            camino.append(nodo)
        camino.reverse()
        arcos_camino.reverse()

        botella = cuello[sumidero]

        # Cambio: asigna índices temporales y signos +/− por arco residual en cada búsqueda.
        etiquetas = []
        for indice_etiqueta, nodo_id in enumerate(visitados):
            if nodo_id == fuente:
                etiquetas.append({'id': nodo_id, 'etiqueta': 's'})
            else:
                pred= padre[nodo_id]
                _, indice_arista = arco_padre[nodo_id]
                signo = '+' if adyacencia[pred][indice_arista]['sentido'] > 0 else '-'
                marca = f'{signo}{indice_etiqueta}({letras[pred]},{cuello[nodo_id]})'
                etiquetas.append({
                    'id': nodo_id,
                    'etiqueta': f't {marca}' if nodo_id == sumidero else marca,
                    'indice': indice_etiqueta,
                    'signo': signo,
                    'predecesor': pred,
                    'capacidad_residual': cuello[nodo_id]
                })

        for u, indice in arcos_camino:
            arista = adyacencia[u][indice]
            v = arista['destino']
            inversa = adyacencia[v][arista['inversa']]
            arista['residual'] -= botella
            inversa['residual'] += botella
            flujo[arista['original']] += arista['sentido'] * botella

        flujo_total += botella

        camino_str = '→'.join(letras[n] for n in camino)
        desc = f'Camino aumentante: {camino_str}. Cuello de botella: {botella}'

        pasos.append(snapshot(
            paso_num, camino, botella, etiquetas, desc, flujo_total
        ))

        paso_num+=1

    lado_s = set(padre.keys())
    corte = []
    for (u,v),cap in capacidad.items():
        if u in lado_s and v not in lado_s:
            corte.append({'origen':u,'destino':v,'capacidad':cap,'flujo':flujo[(u,v)],
                          'infinita': (u, v) in capacidad_infinita})

    paso_final = snapshot(
        paso_num, [], 0,
        [{'id': fuente, 'etiqueta':'s'}, {'id': sumidero, 'etiqueta': 't'}],
        f'No hay mas caminos aumentantes. Flujo maximo: {flujo_total}',
        flujo_total
    )
    paso_final['corte_minimo'] = {'lado_s': sorted(lado_s), 'aristas': corte}
    pasos.append(paso_final)

    return pasos
