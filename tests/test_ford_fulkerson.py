import random
import unittest

import networkx as nx

from app import app
from backend.algoritmo_ford_fulkerson import ford_fulkerson
from backend.red_de_flujo import generar_red_de_flujo


# Cambio: añade pruebas deterministas, diferenciales, de validación y de los extremos de la API.
def crear_red(cantidad, aristas, fuente=0, sumidero=None):
    if sumidero is None:
        sumidero = cantidad - 1
    nodos = [{'id': i, 'label': str(i)} for i in range(cantidad)]
    flechas = [
        {'origen': origen, 'destino': destino, 'capacidad': capacidad}
        for origen, destino, capacidad in aristas
    ]
    return nodos, flechas, fuente, sumidero


class FordFulkersonTests(unittest.TestCase):
    def test_casos_conocidos_y_corte_minimo(self):
        casos = [
            (2, [(0, 1, 5)], 5),
            (4, [(0, 1, 3), (0, 2, 2), (1, 2, 1), (1, 3, 2), (2, 3, 3)], 5),
            (6, [(0, 1, 16), (0, 2, 13), (1, 2, 10), (2, 1, 4),
                 (1, 3, 12), (3, 2, 9), (2, 4, 14), (4, 3, 7),
                 (3, 5, 20), (4, 5, 4)], 23),
            (3, [(0, 1, 7)], 0),
            (3, [(0, 1, 0), (1, 2, 4)], 0),
        ]
        for cantidad, aristas, esperado in casos:
            with self.subTest(cantidad=cantidad, esperado=esperado):
                pasos = ford_fulkerson(*crear_red(cantidad, aristas))
                final = pasos[-1]
                self.assertEqual(final['flujo_total'], esperado)
                capacidad_corte = sum(a['capacidad'] for a in final['corte_minimo']['aristas'])
                self.assertEqual(capacidad_corte, esperado)

    def test_aristas_opuestas_conservan_capacidad_y_flujo(self):
        # Cambio: cubre la regresión donde el residual agregado superaba la capacidad de una arista opuesta.
        aristas = [
            (0, 1, 4), (0, 2, 3), (0, 6, 3), (1, 0, 2), (1, 3, 1),
            (1, 4, 3), (1, 5, 4), (1, 6, 3), (2, 0, 1), (2, 4, 4),
            (3, 2, 1), (4, 0, 2), (4, 1, 1), (4, 3, 1), (4, 6, 1),
            (5, 1, 1), (5, 3, 3), (5, 4, 3), (5, 6, 4), (6, 3, 3),
            (6, 4, 3), (6, 5, 4),
        ]
        pasos = ford_fulkerson(*crear_red(7, aristas))
        final = pasos[-1]
        self.assertEqual(final['flujo_total'], 9)
        flujo = {(a['origen'], a['destino']): a['flujo'] for a in final['flujo']}
        for origen, destino, capacidad in aristas:
            self.assertGreaterEqual(flujo[(origen, destino)], 0)
            self.assertLessEqual(flujo[(origen, destino)], capacidad)
        for vertice in range(1, 6):
            entra = sum(v for (u, w), v in flujo.items() if w == vertice)
            sale = sum(v for (u, w), v in flujo.items() if u == vertice)
            self.assertEqual(entra, sale)

    def test_camino_residual_puede_devolver_flujo_con_arista_opuesta(self):
        aristas = [
            (0, 1, 4), (0, 2, 2), (0, 3, 5), (0, 7, 2), (1, 0, 2),
            (1, 2, 4), (1, 4, 5), (1, 5, 1), (2, 0, 2), (2, 1, 3),
            (2, 6, 2), (2, 7, 4), (3, 0, 4), (3, 2, 2), (3, 4, 4),
            (4, 1, 5), (4, 2, 3), (4, 5, 4), (4, 7, 3), (5, 2, 3),
            (5, 3, 1), (5, 4, 4), (5, 6, 3), (5, 7, 5), (6, 0, 1),
            (6, 1, 1), (6, 2, 1), (6, 4, 2), (6, 5, 2), (7, 0, 3),
            (7, 6, 1),
        ]
        pasos = ford_fulkerson(*crear_red(8, aristas))
        hubo_devolucion = False
        for anterior, paso in zip(pasos, pasos[1:]):
            flujo_antes = {(a['origen'], a['destino']): a['flujo'] for a in anterior['flujo']}
            flujo_despues = {(a['origen'], a['destino']): a['flujo'] for a in paso['flujo']}
            if ((2, 1) in zip(paso['camino'], paso['camino'][1:]) and
                    flujo_despues[(1, 2)] < flujo_antes[(1, 2)]):
                hubo_devolucion = True
                self.assertEqual(flujo_despues[(2, 1)], flujo_antes[(2, 1)])
        self.assertTrue(hubo_devolucion, 'La red de regresión debe usar el residual inverso 2→1.')

    def test_etiquetas_temporales_incluyen_indice_y_signo(self):
        aristas = [
            (0, 1, 4), (0, 2, 2), (0, 3, 5), (0, 7, 2), (1, 0, 2),
            (1, 2, 4), (1, 4, 5), (1, 5, 1), (2, 0, 2), (2, 1, 3),
            (2, 6, 2), (2, 7, 4), (3, 0, 4), (3, 2, 2), (3, 4, 4),
            (4, 1, 5), (4, 2, 3), (4, 5, 4), (4, 7, 3), (5, 2, 3),
            (5, 3, 1), (5, 4, 4), (5, 6, 3), (5, 7, 5), (6, 0, 1),
            (6, 1, 1), (6, 2, 1), (6, 4, 2), (6, 5, 2), (7, 0, 3),
            (7, 6, 1),
        ]
        pasos = ford_fulkerson(*crear_red(8, aristas))
        hubo_menos = False
        for paso in pasos[1:-1]:
            indices = []
            for etiqueta in paso['etiquetas']:
                if etiqueta['id'] == 0:
                    self.assertEqual(etiqueta['etiqueta'], 's')
                    continue
                self.assertIn(etiqueta['signo'], ('+', '-'))
                self.assertGreater(etiqueta['indice'], 0)
                self.assertIn(f"{etiqueta['signo']}{etiqueta['indice']}", etiqueta['etiqueta'])
                indices.append(etiqueta['indice'])
                hubo_menos |= etiqueta['signo'] == '-'
        self.assertTrue(hubo_menos)

    def test_redes_aleatorias_contra_networkx(self):
        rng = random.Random(20261108)
        for numero_prueba in range(1000):
            cantidad = rng.randint(3, 9)
            grafo = nx.DiGraph()
            grafo.add_nodes_from(range(cantidad))
            aristas = []
            for origen in range(cantidad):
                for destino in range(cantidad):
                    if origen != destino and rng.random() < 0.35:
                        capacidad = rng.randint(1, 20)
                        aristas.append((origen, destino, capacidad))
                        grafo.add_edge(origen, destino, capacity=capacidad)

            pasos = ford_fulkerson(*crear_red(cantidad, aristas))
            final = pasos[-1]
            self.assertEqual(final['flujo_total'], nx.maximum_flow_value(grafo, 0, cantidad - 1))
            flujo = {(a['origen'], a['destino']): a['flujo'] for a in final['flujo']}
            for origen, destino, capacidad in aristas:
                self.assertGreaterEqual(flujo[(origen, destino)], 0)
                self.assertLessEqual(flujo[(origen, destino)], capacidad)
            for vertice in range(1, cantidad - 1):
                entra = sum(v for (u, w), v in flujo.items() if w == vertice)
                sale = sum(v for (u, w), v in flujo.items() if u == vertice)
                self.assertEqual(entra, sale)
            self.assertEqual(
                sum(a['capacidad'] for a in final['corte_minimo']['aristas']),
                final['flujo_total'],
            )

    def test_entrada_invalida_es_rechazada(self):
        nodos, flechas, fuente, sumidero = crear_red(2, [(0, 1, 1)])
        invalidos = [
            (nodos, flechas, 0, 0),
            (nodos, flechas, 0, 9),
            (nodos, [{'origen': 0, 'destino': 1, 'capacidad': -1}], 0, 1),
            (nodos, [{'origen': 0, 'destino': 1, 'capacidad': 1.5}], 0, 1),
            (nodos, flechas + flechas, 0, 1),
            (nodos, [{'origen': 0, 'destino': 9, 'capacidad': 1}], 0, 1),
            (nodos, [{'origen': 0, 'destino': 0, 'capacidad': 1}], 0, 1),
            ([{'id': 0, 'label': 'A'}, {'id': 0, 'label': 'B'}], flechas, 0, 1),
            (nodos, [{'origen': [], 'destino': 1, 'capacidad': 1}], 0, 1),
        ]
        for datos in invalidos:
            with self.subTest(datos=datos), self.assertRaises(ValueError):
                ford_fulkerson(*datos)

    def test_redes_generadas_y_api_flask(self):
        cliente = app.test_client()
        self.assertEqual(cliente.get('/').status_code, 200)
        for cantidad in range(7, 17):
            for _ in range(5):
                red = generar_red_de_flujo(cantidad)
                self.assertEqual(len(red['nodos']), cantidad)
                grafo = nx.DiGraph((a['origen'], a['destino']) for a in red['flechas'])
                self.assertTrue(nx.has_path(grafo, red['fuente'], red['sumidero']))
                self.assertGreater(
                    ford_fulkerson(red['nodos'], red['flechas'], red['fuente'], red['sumidero'])[-1]['flujo_total'],
                    0,
                )

        self.assertEqual(cliente.post('/grafo', json={'n': 7}).status_code, 200)
        for datos in ({'n': 6}, {'n': 7.5}, {'n': True}, {}):
            self.assertEqual(cliente.post('/grafo', json=datos).status_code, 400)

        nodos, flechas, fuente, sumidero = crear_red(2, [(0, 1, 1)])
        valido = {'nodos': nodos, 'flechas': flechas, 'fuente': fuente, 'sumidero': sumidero}
        self.assertEqual(cliente.post('/algoritmo', json=valido).status_code, 200)
        invalido = {**valido, 'sumidero': fuente}
        self.assertEqual(cliente.post('/algoritmo', json=invalido).status_code, 400)


if __name__ == '__main__':
    unittest.main()
