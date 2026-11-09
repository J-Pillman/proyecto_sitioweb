# Red de Flujo

Aplicación web en Flask que genera redes de flujo aleatorias o permite construirlas manualmente, las visualiza en el navegador con [vis-network](https://visjs.github.io/vis-network/docs/network/) y resuelve el **flujo máximo** con el algoritmo de **Ford-Fulkerson**, mostrando cada paso del algoritmo.

## Características

- Genera redes de flujo aleatorias de entre 7 y 16 nodos, libres de ciclos y ordenadas por columnas (capas) de izquierda a derecha.
- Cada red tiene una **fuente** (`s`, a la izquierda) y un **sumidero** (`t`, a la derecha), con una ruta principal entre ellos y aristas adicionales hacia adelante.
- Las aristas tienen capacidades aleatorias (1–10).
- **Modo manual**: construye tu propia red nodo a nodo.
  - Nodos etiquetados con letras (A, B, C…), entre 7 y 16.
  - Para crear una arista, indica su capacidad (se conserva mientras sigas en el modo) y pulsa el vértice inicial y luego el final.
  - Doble clic en un vértice para eliminarlo con sus aristas; doble clic en una arista para eliminarla.
  - No acepta ciclos ni vértices aislados: al elegir los extremos o al usar la red se detectan y se rechazan con un mensaje explicativo.
  - La red se dibuja en vivo mientras la construyes.
  - Antes de ejecutar, detecta automáticamente las entradas y salidas; si hay varias, agrega una superfuente o un supersumidero con aristas de capacidad infinita.
- Visualización interactiva y responsiva (PC y móvil): nodos con etiquetas, aristas dirigidas, capacidades y posiciones de nodo preservadas al arrastrar.
- **Algoritmo de Ford-Fulkerson** paso a paso (en un segundo lienzo dedicado):
  - Busca caminos aumentantes con BFS, por lo que la variante implementada es Edmonds-Karp.
  - Cada camino aumentante se resalta con su propio color distintivo; colores según el estado de cada arista (llena en rojo, parcial en ámbar o vacía en gris).
  - Flujo/capacidad en cada arista y etiquetas BFS en los nodos.
  - El avance es **arista por arista** dentro de cada camino aumentante, con leyenda dinámica sobre el lienzo.
  - Navegación con botones *Anterior* / *Siguiente* / *Ir al final* / *Reiniciar*, botón *Volver* a edición o con las flechas del teclado; debajo se listan los caminos encontrados y el flujo total en una barra de progreso.
  - Al terminar dibuja sobre el lienzo la línea divisoria del **corte mínimo** (S | T), coloreando los lados S y T y en verde las aristas que cruza.
  - Tablas de resultados con el flujo en cada arista, los caminos usados y el **corte mínimo** (verificando flujo máximo = capacidad del corte).

## Requisitos

- Python 3.x **o** Docker con Docker Compose
- Dependencias en `requirements.txt` (Flask, networkx)

## Instalación

```bash
git clone <url-del-repositorio>
cd proyecto_computacional
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Uso

```bash
python app.py
```

Abre [http://127.0.0.1:5001](http://127.0.0.1:5001) y elige un modo:

- **Generar Aleatorio**: elige el número de nodos (7–16) y pulsa **Generar Grafo**.
- **Manual**: agrega nodos con **Agregar Nodo**; para las aristas indica la capacidad, pulsa **Elegir vértices** y haz clic en el vértice inicial y en el final (doble clic elimina elementos). Al terminar pulsa **Usar Red**.

Luego pulsa **Ejecutar Ford-Fulkerson** para ver el algoritmo paso a paso.

## Guía del algoritmo

<!-- Cambio: añade la explicación de factibilidad, etiquetas residuales, aumento, terminación, corte y complejidad. -->

La red es dirigida. Cada arista tiene una capacidad entera no negativa. El flujo empieza en cero y debe cumplir dos condiciones: no superar la capacidad de ninguna arista y conservarse en cada vértice intermedio (flujo que entra = flujo que sale).

En cada iteración el sistema busca con BFS un camino desde la fuente hasta el sumidero usando aristas con capacidad residual positiva. Una arista original permite enviar `capacidad − flujo`; también existe una arista residual inversa que permite devolver flujo y reencaminarlo. El programa elige como cuello de botella la menor capacidad residual del camino y aumenta el flujo por esa cantidad.

Cuando ya no hay un camino aumentante, el flujo es máximo. Los vértices aún alcanzables desde la fuente en la red residual forman un lado del corte mínimo; la capacidad de las aristas que cruzan ese corte debe coincidir con el flujo máximo. Esta igualdad es una comprobación de corrección, no solo un dato adicional.

La búsqueda por BFS hace que esta implementación sea Edmonds-Karp, una variante de Ford-Fulkerson con tiempo de ejecución `O(V · E²)`. Para varias entradas se agrega una superfuente; para varias salidas, un supersumidero. Las capacidades «∞» se representan internamente con un entero mayor que la suma de las capacidades originales, suficiente para que esas aristas no limiten el flujo máximo.

Una red con ciclos y sin entradas o salidas identificables no se procesa automáticamente: debe tener al menos una entrada (sin aristas entrantes y con alguna saliente) y una salida (sin aristas salientes y con alguna entrante). Los vértices aislados no cuentan como terminales.

> **Nota:** `vis-network` se carga desde un CDN, por lo que se necesita conexión a internet al abrir la página.

## Ejecutar con Docker

```bash
docker compose up --build
```

Abre [http://localhost](http://localhost) (puerto 80).

Para detener el contenedor:

```bash
docker compose down
```

## API

### `POST /grafo`

Genera una red de flujo aleatoria.

**Cuerpo (JSON):**

```json
{ "n": 8 }
```

**Respuesta (200):**

```json
{
  "nodos": [{ "id": 0, "label": "A", "x": 0, "y": 0 }],
  "flechas": [{ "origen": 0, "destino": 2, "capacidad": 10 }],
  "fuente": 0,
  "sumidero": 7
}
```

**Errores (400):** si `n` no está entre 7 y 16 o el cuerpo es inválido, devuelve `{ "error": "..." }`.

### `POST /algoritmo`

Ejecuta el algoritmo de Ford-Fulkerson sobre una red de flujo.

**Cuerpo (JSON):** la respuesta de `POST /grafo` (nodos, flechas, fuente, sumidero).

**Respuesta (200):**

```json
{
  "pasos": [
    {
      "paso": 0,
      "flujo_total": 0,
      "camino": [],
      "cuello_botella": 0,
      "flujo": [{ "origen": 0, "destino": 1, "flujo": 0, "capacidad": 5 }],
      "etiquetas": [{ "id": 0, "etiqueta": "s" }]
    }
  ]
}
```

Cada paso incluye:
- `flujo`: estado actual de flujo/capacidad en cada arista.
- `camino`: nodos del camino aumentante (resaltado con un color distintivo por paso).
- `cuello_botella`: flujo mínimo del camino.
- `etiquetas`: etiquetas BFS de los nodos (formato `(predecesor,capacidad)`).
- `flujo_total`: flujo acumulado hasta ese paso.
- `corte_minimo` (solo en el último paso): `lado_s` (nodos alcanzables desde la fuente) y `aristas` del corte con su flujo y capacidad. La suma de capacidades del corte es igual al flujo máximo.

## Estructura del proyecto

```
.
├── app.py                              # Aplicación Flask (rutas)
├── backend/
│   ├── red_de_flujo.py                 # Generación de la red de flujo (networkx)
│   └── algoritmo_ford_fulkerson.py     # Algoritmo de Ford-Fulkerson
├── tests/
│   └── test_ford_fulkerson.py          # Pruebas unitarias (unittest + networkx)
├── static/
│   ├── css/style.css                   # Estilos
│   ├── js/main.js                      # Lógica del frontend (vis-network)
│   └── favicon.ico                     # Icono del sitio
├── templates/
│   └── index.html                      # Interfaz web
├── Dockerfile                          # Imagen Docker
├── docker-compose.yml                  # Servicio web con Docker Compose
├── .dockerignore
├── .gitignore
└── requirements.txt
```
