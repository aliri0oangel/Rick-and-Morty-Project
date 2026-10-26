# Ejercicio: Sistema web con autenticación y API de Rick and Morty

## Contexto

Van a construir una aplicación web completa usando **HTML, CSS, JavaScript y Tailwind CSS** (sin frameworks de JavaScript). La aplicación tiene usuarios que se registran, inician sesión, administran su cuenta y navegan un catálogo de personajes de la serie Rick and Morty consumiendo su API pública: `https://rickandmortyapi.com/api`.

El objetivo es que integren en un solo proyecto: manipulación del DOM, validación de formularios, consumo de una API con `fetch`, manejo de rutas protegidas y los tres mecanismos de almacenamiento del navegador, cada uno con un propósito distinto (LocalStorage, SessionStorage y Cookies).

## Páginas del sistema

### 1. Registro (`register.html`)

Formulario con los siguientes campos, todos obligatorios:

- Nombre
- Apellido
- Correo electrónico
- Contraseña
- Confirmar contraseña

Validaciones (con JavaScript, no solo atributos HTML):

- Ningún campo puede estar vacío ni contener solo espacios.
- El correo debe tener formato válido y no puede estar ya registrado.
- La **contraseña debe ser segura**: mínimo 8 caracteres, al menos una mayúscula, una minúscula, un número y un carácter especial.
- Contraseña y confirmación deben coincidir.
- Los errores se muestran junto a cada campo (no con `alert`), y el formulario no se envía hasta que todo sea válido.

Al registrarse con éxito, el usuario se redirige al login.

### 2. Login (`login.html`)

- Formulario de correo y contraseña, con sus validaciones.
- Si las credenciales no coinciden con un usuario registrado, mostrar un mensaje de error claro.
- Al iniciar sesión con éxito, se crea la **sesión del usuario en cookies o Session Storage** (elijan una y justifiquen su elección en un comentario del código) y se redirige a la página principal.

### 3. Página principal (`index.html`)

- Muestra **20 personajes** de la API de Rick and Morty en tarjetas (imagen, nombre, especie, estado).
- Cada tarjeta tiene un botón o ícono para **agregar o quitar el personaje de favoritos**. El estado del botón debe reflejar si ya es favorito.
- La **lista de favoritos se guarda en Local Storage** y sobrevive al cerrar el navegador.
- **Cada usuario tiene su propia lista de favoritos**: los favoritos de un usuario no deben aparecer al iniciar sesión con otra cuenta.
- Al hacer clic en un personaje, se navega a su página de detalle.
- Debe mostrar el nombre del usuario logueado y un botón de cerrar sesión.

### 4. Detalle de personaje (`character.html`)

- Recibe el id del personaje (por ejemplo, por query string: `character.html?id=7`).
- Consulta la API y muestra información ampliada: imagen grande, nombre, estado, especie, género, origen, ubicación actual y número de episodios en los que aparece.
- Desde aquí también se puede agregar o quitar de favoritos.

### 5. Mi cuenta (`account.html`)

- Muestra los datos del usuario logueado y permite **modificarlos**: nombre, apellido, correo y contraseña (con las mismas validaciones del registro).
- Los cambios se guardan y se reflejan de inmediato en toda la aplicación (por ejemplo, el nombre que se muestra en la página principal).

## Rutas protegidas

- **Ninguna página, excepto login y registro, es accesible sin sesión activa.** Si alguien entra directo a `index.html`, `character.html` o `account.html` sin estar logueado, debe ser redirigido al login.
- Si un usuario ya logueado entra a login o registro, redirigirlo a la página principal.
- Cerrar sesión elimina la sesión (cookie o Session Storage) y redirige al login. Los favoritos en Local Storage **no** se borran.

## Requisitos técnicos

1. **Tecnologías**: HTML semántico, Tailwind CSS para los estilos (pueden complementar con CSS propio) y JavaScript (ES6+).
2. **Almacenamiento con propósito**: usuarios registrados y sesión en cookies o Session Storage; favoritos en Local Storage, asociados al usuario que los guardó. Sean consistentes y no mezclen responsabilidades.
3. **Consumo de API**: usar `fetch` con `async/await`, manejar errores (API caída, id inexistente) y mostrar un estado de carga mientras llegan los datos.
4. **Código organizado**: separar el JavaScript en archivos por responsabilidad (por ejemplo: `auth.js`, `validaciones.js`, `api.js`, `favoritos.js`) en lugar de un solo archivo gigante.
5. **Diseño responsive obligatorio**: todas las páginas del sistema deben adaptarse correctamente a móvil, tablet y escritorio, aprovechando las utilidades responsive de Tailwind (`sm:`, `md:`, `lg:`).

## Puntos opcionales

- Paginación o botón "cargar más" para ver más allá de los primeros 20 personajes.
- Buscador de personajes por nombre usando el endpoint de filtrado de la API.
- Página `favorites.html` que muestre solo los personajes favoritos del usuario.
- Mostrar/ocultar contraseña e indicador visual de seguridad de la contraseña mientras se escribe.
- Modo oscuro con Tailwind.
