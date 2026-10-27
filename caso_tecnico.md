
Alcances :


tecnico hace un correctivo , registro en sistema 

manejo de repuesto 

lista de elementos para repuesto 

    -: por tipo de maquina y modelo 


    especificar para cambio , instalcion , desistalacion 

    maquina desmantelada  - no va haber devolucion de repuesto , se solcita componete que no existe . caso instalcion

    caso cambio  -  existe el compnete a reemplazar  , existe un proceso de desistalcion de pieza anterior y instalcion d epieza actual

    desistalacion - quitar un componente para devolverlo a almacen 


    REV - segundo uso de los materiale sen odoo




EXISTE :

    Marcas de reefer y modelos
    lista de repuestos por modelos de reefer 
    lista de tecnicos
    reparacion para stock  


    maquinas sueltas -  con serie distintivas 
    manuales de la maquinas por modelo 


    Solicitar al area tecnica

        Lista de Marcas de Reefer y MOdelos
        Lista de repuestos por modelo de maquinas y campos a resgitrar (nombre, part number , tipo ,etc)
        Lista de Tecnicos
        Lista de maquinas sueltas previas y campos a registrar (serie , S/N , etc)
        Manuales en PDF de las maquinas por marcas y modelos






Estructura 

El area tecnica tiene el requesito de un  sistema informatico que le permita asignara a uno d elos tecnicos que tiene en su lista la validacion del estado de las maquinas reffer del segundo uso , el tecnico recibe la designacion de la reefer va a revisar la maquina reefer y ingresa al perfil de la maquina que esta con serie y agrega todo los elementos que le hacen falta a la maquina reefer , a traves de un buscador coloca ejemplo contactor 12A y puede tomar foto y especifica la cantidad de ese elemnto y poner faltante , incompleto o inoperativo . despues de terminar su evaluacion toda la lista de elementos queda registrado y puede pasar al siguiente reefer asignado y asi va registrando cada inspeccion que realiza colcando el estado d epiezas que fatan , estan incompletas o inoperativas , al encragado del area tecnica le aparece al finalla lista de lementos de faltan por equipo  serie , luego por modelo y marca y como conglomerado final . entonces se requiere un sistema que tenga 3 perfiles de encargado , tecnico y superadmin , se tiene el modulo de tecnico  donde se agrega el nombre del tecnico se puede editar , se puede editar archivar tenemos solo un campo obligatorio que es el nombre del tecnico , donde esta en  su apellido y nombre junto , luego esta el cargo , dni , numero . luego estan el modulo de marcas y modleos de reefer el encragado puede subir la marca y los modelos que tiene esa marca el objetivo . se puede editra , archivar y agregar mas marcas modelos , ahora el encragado tambien tiene un modulo donde agrega la series de una maquina a inspeccionar y alli define qu emarca y modelo es , hay un camp de ubiacacion que es opcional y año tambien que el opcional .hay un modulo para cargar listas de respuestos por marca y modelo donde tenemos los campos  serie y descripcion de repuestos que son obligatorios , luego el tipo que es opcional , la idea de este modulo es que s epueda subir masivamente una lista , o por repuesto . luego esta el modulo del tecnio donde se vee que repuestos a seleccionado el tecnico para cada maquina y la sfotos de evidencia que muestra para cada repuesto . y tenemos un modulo rpeorte donde el encragdo pued ever por dia la smaquinas que los tecnicos han inscepcionado y por rango de tiempo puede impriir un rpeorte de que necesita cada maquina por serie , luego que repuestos se necesita en general para uan marac y modelo especifico , para que luego esto s epueda solicitar a alamcen para que se adquiera , la vista del tecnico es simplimnete las maquinas asignada spara su inspeccion y los repuestos que est aseleccionando le corresponde a cada maquina por serie la foot que esta poniendo y una nota si a si lo quiere de cada repuesto que añada a l maquian en cuestion 






