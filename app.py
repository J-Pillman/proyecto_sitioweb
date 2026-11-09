#Servidor
from flask import Flask, render_template, request, jsonify 
from backend.red_de_flujo import generar_red_de_flujo
from backend.algoritmo_ford_fulkerson import ford_fulkerson

app = Flask(__name__) #Instancia de la clase Flask, crea la aplicacion Flask
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0

@app.after_request
def desactivar_cache(respuesta):
    respuesta.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    return respuesta

@app.route('/') #Ruta donde se ejecutaran las funciones GET -> pagina principal, la raiz del sitio, cuando pones en el navegador este envia un GET a la ruta /
def index():
    return render_template('index.html') #Devuelve el html

@app.route('/grafo', methods=['POST']) #Ruta que solo acepta POST
def grafo():
    try:
        # Cambio: exige que la cantidad de nodos llegue como entero JSON y evita truncar decimales.
        datos = request.get_json()
        if not isinstance(datos, dict) or isinstance(datos.get('n'), bool) or not isinstance(datos.get('n'), int):
            raise ValueError('El numero de nodos debe ser un entero.')
        num = datos['n']
        return jsonify(generar_red_de_flujo(num))  #Genera el grafo y lo devuelve como JSON
    except (ValueError, KeyError, TypeError) as error:
        return jsonify({'error':str(error)}), 400

@app.route('/algoritmo', methods=['POST'])
def algoritmo():
    try:
        datos = request.get_json()
        pasos = ford_fulkerson(datos['nodos'], datos['flechas'], datos['fuente'], datos['sumidero'])
        return jsonify({'pasos': pasos})
    except (ValueError, KeyError, TypeError) as error:
        return jsonify({'error':str(error)}), 400

if __name__=='__main__':   #Ejecuta la aplicacion
    # Cambio: deja documentado el puerto 5001 que utiliza la aplicación.
    app.run(debug=True, port=5001)
