/*
  Este archivo incluye el código existente y las nuevas funciones para que,
  al pulsar “Añadir”, se abra un modal que permita personalizar el plato
  (quitando o sumando extras a los ingredientes) antes de agregar a la cesta.
*/

// ========================
// Configuración de Supabase
// ========================
// Al tope de script.js
const urlParams    = new URLSearchParams(window.location.search);
const mesaParamUrl = urlParams.get("table");
// si viene en la URL, resérvalo en localStorage
if (mesaParamUrl) {
  localStorage.setItem("mesaId", mesaParamUrl);
}

const mesaIdParam  = urlParams.get("table") || localStorage.getItem("mesaId");
const mesaId       = mesaIdParam ? parseInt(mesaIdParam, 10) : null;

const supabaseUrl = "https://slopghtwuyodfycfwngv.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsb3BnaHR3dXlvZGZ5Y2Z3bmd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM3ODE3NDYsImV4cCI6MjA1OTM1Nzc0Nn0.fvKYIoFQt46We1-27DlFxYqvp3Kkdi7KFK76JwXUTCg";
  const { createClient } = window.supabase;
  const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// ========================
// Variables globales
// ========================
let allCategories = [];
let allMenuItems = [];
let cartItems = JSON.parse(localStorage.getItem("cartItems")) || [];

// Variables para la personalización del plato
let productoPersonalizando = null;
let ingredientesPersonalizados = [];

// ========================
// Inicializar al cargar el DOM
// ========================
document.addEventListener("DOMContentLoaded", async () => {
  // ———————————————————————————————————————————
  // 0) GESTIÓN DE GOOGLE OAUTH: busca/crea usuario
  // ———————————————————————————————————————————
  // 0.1) Atiende a cambios de auth (redir de OAuth o login manual)
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    if (event === "SIGNED_IN") {
      await handleGoogleUser(session);
    }
  });

  // 0.2) Si ya hay sesión activa al cargar la página, también la procesamos
  const { data: { session }, error: getErr } = await supabaseClient.auth.getSession();
  if (!getErr && session) {
    await handleGoogleUser(session);
  }
  await fetchCategories();
  await fetchMenuItems();
  displayMenuItems("all");
  setupCartButton();
  setupSearchBar();
  updateCartDisplay();
  setupOrderButtons();
// Mostrar saludo personalizado solo si NO es invitado
const userInfo = JSON.parse(localStorage.getItem("user"));
if (userInfo && userInfo.username && userInfo.email !== "invitado@restaurante.com") {
  const userWelcome = document.getElementById("user-welcome");
  if (userWelcome) {
    try {
      // Busca el ID del usuario autenticado
      const { data: usuario, error: usuarioErr } = await supabaseClient
        .from("usuarios")
        .select("id")
        .eq("email", userInfo.email)
        .single();

      if (usuarioErr) throw usuarioErr;

      // Cuenta solo los pedidos COMPLETOS de ese usuario
      const { count: pedidosCompletos, error: countError } = await supabaseClient
        .from("pedido_mesa_completo")
        .select("id", { count: "exact", head: true })
        .eq("usuario_id", usuario.id);  

      if (!countError) {
        const restantes = 10 - (pedidosCompletos % 10 || 10);
        userWelcome.textContent = `¡Hola, ${userInfo.username}! Te quedan ${restantes} visita${restantes === 1 ? '' : 's'} para obtener un descuento.`;
      }
    } catch (e) {
      console.error("No se pudo calcular las visitas restantes:", e);
    }
  }
}




  // Configurar el botón de guardar personalización
  document
    .getElementById("save-customization")
    .addEventListener("click", guardarPersonalizacion);
});
// ———————————————————————————————————————————
// Función que busca/crea el usuario en tu tabla “usuarios”
// ———————————————————————————————————————————
async function handleGoogleUser(session) {
  const user = session.user;
  // solo nos interesa Google OAuth
  const isGoogle = user.identities?.some(i => i.provider === "google");
  if (!isGoogle) return;

  // comprueba email verificado
  if (!user.email_confirmed_at) {
    alert("Confirma tu email de Google antes de continuar.");
    return;
  }

  const email = user.email;
  const defaultName = user.user_metadata.name || email.split("@")[0];

  // 1) busca en la tabla
  const { data: existing, error: selErr } = await supabaseClient
    .from("usuarios")
    .select("id, username, email")
    .eq("email", email);

  if (selErr && selErr.code !== "PGRST116") {
    console.error("Error comprobando usuario:", selErr);
    return;
  }

  let perfil;
  if (!existing || existing.length === 0) {
    // 2) si no existe, lo creamos **definitivamente**
    const { data: inserted, error: insErr } = await supabaseClient
      .from("usuarios")
      .insert([{
        username: defaultName,
        email,
        role: "cliente",
        oauth_provider: "google",
        oauth_id: user.id
      }])
      .select("id, username, email")
      .single();

    if (insErr) {
      console.error("Error creando usuario OAuth:", insErr);
      return;
    }
    perfil = inserted;
  } else {
    perfil = existing[0];
  }

  // 3) guarda en localStorage para el resto de la app
  localStorage.setItem("user", JSON.stringify({
    username: perfil.username,
    email: perfil.email
  }));
}

// ========================
//  Obtener y mostrar categorías
// ========================
async function fetchCategories() {
  try {
    const { data, error } = await supabaseClient.from("categories").select("*");
    if (error) throw error;
    allCategories = data;
    renderCategoryMenu();
  } catch (err) {
    console.error("Error al obtener categorías:", err.message);
  }
}

function renderCategoryMenu() {
  const categoryMenu = document.getElementById("category-menu");
  categoryMenu.innerHTML = "";

  // Botón "Todos"
  const todosButton = document.createElement("button");
  todosButton.classList.add("list-group-item", "list-group-item-action", "active");
  todosButton.textContent = "Todos";
  todosButton.setAttribute("data-category-id", "all");
  todosButton.addEventListener("click", () => {
    displayMenuItems("all");
    setActiveCategoryButton("all");
  });
  categoryMenu.appendChild(todosButton);

  // Botones para cada categoría
  allCategories.forEach((cat) => {
    const button = document.createElement("button");
    button.classList.add("list-group-item", "list-group-item-action");
    button.textContent = cat.name;
    button.setAttribute("data-category-id", cat.id);
    button.addEventListener("click", () => {
      displayMenuItems(cat.id);
      setActiveCategoryButton(cat.id);
    });
    categoryMenu.appendChild(button);
  });
}

function setActiveCategoryButton(categoryId) {
  const buttons = document.querySelectorAll("#category-menu button");
  buttons.forEach((btn) => {
    btn.classList.remove("active");
    if (btn.getAttribute("data-category-id") == categoryId) {
      btn.classList.add("active");
    }
  });
}

// ========================
//  Obtener productos
// ========================
async function fetchMenuItems() {
  try {
    const { data, error } = await supabaseClient.from("menu_items").select("*");
    if (error) throw error;
    allMenuItems = data;
  } catch (err) {
    console.error("Error al obtener productos:", err.message);
  }
}

// ========================
// Mostrar productos por categoría
// ========================
function displayMenuItems(categoryId) {
  const menuContainer = document.getElementById("menu-container");
  menuContainer.innerHTML = "";

  const filteredItems =
    categoryId === "all"
      ? allMenuItems
      : allMenuItems.filter((item) => item.category_id === categoryId);

  if (filteredItems.length === 0) {
    menuContainer.innerHTML = `<p class="text-center">No hay productos en esta categoría.</p>`;
    return;
  }

 filteredItems.forEach((item) => {
  const itemDiv = document.createElement("div");
  itemDiv.classList.add("col-md-4", "mb-4");
  itemDiv.innerHTML = `
    <div class="card h-100 shadow">
      <img
        src="${item.image_url}"
        class="card-img-top"
        alt="${item.name}"
      />
      <div class="card-body d-flex flex-column">
        <h5 class="card-title">${item.name}</h5>
        <p class="card-text">${item.description}</p>
        <p class="fw-bold text-success">€${parseFloat(item.price).toFixed(2)}</p>
        <button class="btn btn-primary mt-auto"
                onclick="mostrarPersonalizacion(${item.id})">
          Añadir
        </button>
      </div>
    </div>
  `;
  menuContainer.appendChild(itemDiv);
});

}

// ========================
// Añadir producto a la cesta (sin personalización directa)
// ========================
function agregarACesta(producto, personalizacion = null) {
  // Si hay personalización se adjunta a producto
let totalExtras = 0;
if (personalizacion) {
  totalExtras = personalizacion.reduce((sum, ing) => sum + ((ing.extra || 0) * 1), 0);
}

const productoParaCesta = {
  ...producto,
  personalizacion,
  price: parseFloat(producto.price) + totalExtras // 👈 ya con los extras sumados
};


  // Verificar si ya existe en la cesta (se compara el id y la personalización)
  const indexExistente = cartItems.findIndex(
    (item) =>
      item.id === producto.id &&
      JSON.stringify(item.personalizacion) === JSON.stringify(personalizacion)
  );

  if (indexExistente >= 0) {
    cartItems[indexExistente].quantity += 1;
  } else {
    cartItems.push({ ...productoParaCesta, quantity: 1 });
  }
  saveCartToLocalStorage();
  updateCartDisplay();
  showToast(`"${producto.name}" añadido a la cesta`);
}

// ========================
// Funciones para el Modal de Personalización
// ========================

// Mostrar modal de personalización del plato
async function mostrarPersonalizacion(menuItemId) {
  const producto = allMenuItems.find((item) => item.id === menuItemId);
  if (!producto) return;

  productoPersonalizando = producto;

  try {
    // Se consulta la tabla de relación con la información de los ingredientes
    const { data, error } = await supabaseClient
      .from("menu_item_ingredientes")
      .select("*, ingredientes(*)")
      .eq("menu_item_id", menuItemId);
    if (error) throw error;

    // Reiniciar la configuración personalizada
    ingredientesPersonalizados = [];
    renderIngredientesPersonalizacion(data);

    // Mostrar el modal de personalización
    const customizationModal = new bootstrap.Modal(
      document.getElementById("customizationModal")
    );
    customizationModal.show();
  } catch (err) {
    console.error("Error al obtener ingredientes: ", err.message);
    alert("No se pudieron cargar los ingredientes del plato.");
  }
}

// Renderizar controles para cada ingrediente en el modal
function renderIngredientesPersonalizacion(ingredientesData) {
  const container = document.getElementById("ingredients-container");
  container.innerHTML = "";

  ingredientesData.forEach((ingredienteRel) => {
    const ingrediente = ingredienteRel.ingredientes;

    // Contenedor por cada ingrediente
    const div = document.createElement("div");
    div.classList.add("mb-3", "border", "p-2", "rounded");

    // Título del ingrediente
    const title = document.createElement("h6");
    title.textContent = ingrediente.nombre;
    div.appendChild(title);

    // Contenedor de controles
    const controlsDiv = document.createElement("div");
    controlsDiv.classList.add("d-flex", "align-items-center");

    // Si se permite quitar, se agrega checkbox
    if (ingredienteRel.permite_quitar) {
      const quitarLabel = document.createElement("label");
      quitarLabel.classList.add("me-2");
      quitarLabel.textContent = "Quitar:";

      const quitarCheckbox = document.createElement("input");
      quitarCheckbox.type = "checkbox";
      quitarCheckbox.classList.add("ms-2");
      quitarCheckbox.dataset.ingredienteId = ingrediente.id;
      quitarCheckbox.addEventListener("change", (e) => {
        const existe = ingredientesPersonalizados.find(
          (item) => item.ingredienteId === ingrediente.id
        );
        if (e.target.checked) {
          if (existe) {
            existe.cantidad = 0;
          } else {
          ingredientesPersonalizados.push({
  ingredienteId: ingrediente.id,
  nombre: ingrediente.nombre, // 👈 nuevo
  cantidad: ingredienteRel.cantidad_default,
  extra: 0,
});

          }
        } else {
          if (existe) {
            existe.cantidad = ingredienteRel.cantidad_default;
          } else {
           ingredientesPersonalizados.push({
  ingredienteId: ingrediente.id,
  nombre: ingrediente.nombre, // 👈 nuevo
  cantidad: ingredienteRel.cantidad_default,
  extra: 0,
});
          }
        }
      });
      controlsDiv.appendChild(quitarLabel);
      controlsDiv.appendChild(quitarCheckbox);
    }

    // Mostrar cantidad por defecto
    const cantidadSpan = document.createElement("span");
    cantidadSpan.classList.add("ms-3", "me-2");
    cantidadSpan.textContent = `Cantidad: ${ingredienteRel.cantidad_default}`;
    controlsDiv.appendChild(cantidadSpan);

    // Si se permite extra, se agregan controles para sumar/restar
    if (ingredienteRel.permite_extra) {
      const extraLabel = document.createElement("span");
      extraLabel.textContent = "Extra:";
      extraLabel.classList.add("me-2");
      controlsDiv.appendChild(extraLabel);

      // Botón para restar extra
      const btnRestar = document.createElement("button");
      btnRestar.type = "button";
      btnRestar.classList.add("btn", "btn-sm", "btn-outline-secondary", "me-1");
      btnRestar.textContent = "-";
      btnRestar.dataset.ingredienteId = ingrediente.id;
      btnRestar.addEventListener("click", () => ajustarExtra(ingrediente.id, -1));
      controlsDiv.appendChild(btnRestar);

      // Mostrar cantidad extra (inicia en 0)
      const extraCountSpan = document.createElement("span");
      extraCountSpan.textContent = "0";
      extraCountSpan.id = `extra-count-${ingrediente.id}`;
      extraCountSpan.classList.add("me-1");
      controlsDiv.appendChild(extraCountSpan);

      // Botón para sumar extra
      const btnSumar = document.createElement("button");
      btnSumar.type = "button";
      btnSumar.classList.add("btn", "btn-sm", "btn-outline-secondary");
      btnSumar.textContent = "+";
      btnSumar.dataset.ingredienteId = ingrediente.id;
      btnSumar.addEventListener("click", () => ajustarExtra(ingrediente.id, 1));
      controlsDiv.appendChild(btnSumar);
    }

    div.appendChild(controlsDiv);
    container.appendChild(div);

    // Inicializar registro en la configuración personalizada si no existe
if (!ingredientesPersonalizados.find((item) => item.ingredienteId === ingrediente.id)) {
  ingredientesPersonalizados.push({
    ingredienteId: ingrediente.id,
    nombre: ingrediente.nombre, // ✅ importante
    cantidad: ingredienteRel.cantidad_default,
    extra: 0,
  });
}


  });
}

// Ajustar la cantidad de extra para un ingrediente
function ajustarExtra(ingredienteId, cambio) {
  const spanExtra = document.getElementById(`extra-count-${ingredienteId}`);
  let registro = ingredientesPersonalizados.find((item) => item.ingredienteId === ingredienteId);
  if (!registro) {
    registro = { ingredienteId: ingredienteId, cantidad: 0, extra: 0 };
    ingredientesPersonalizados.push(registro);
  }
  registro.extra = Math.max(0, registro.extra + cambio);
  spanExtra.textContent = registro.extra;
}

// Guardar la personalización y agregar el producto a la cesta
function guardarPersonalizacion() {
  agregarACesta(productoPersonalizando, ingredientesPersonalizados);
  // Cerrar el modal de personalización
  const customizationModalElement = document.getElementById("customizationModal");
  const modalInstance = bootstrap.Modal.getInstance(customizationModalElement);
  modalInstance.hide();
}

// ========================
// Actualizar visualización de la cesta
// ========================
function updateCartDisplay() {
  const count = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  document.getElementById("cart-count").textContent = count;

  const cartItemsList = document.getElementById("cart-items");
  cartItemsList.innerHTML = "";

  cartItems.forEach((item) => {
    const li = document.createElement("li");
    li.classList.add(
      "list-group-item",
      "d-flex",
      "justify-content-between",
      "align-items-center"
    );
    // Si existe personalización se muestra (aquí se muestra de forma resumida)
    let personalizacionText = "";
    if (item.personalizacion) {
     personalizacionText =
  `<ul class="mb-0 ms-3 mt-2 small text-muted">` +
item.personalizacion
  .map((p) => {
    const nombre = p.nombre || `Ingrediente ${p.ingredienteId}`;
    if (p.cantidad === 0) return `<li>Sin ${nombre}</li>`;
    if (p.extra > 0) return `<li>${nombre}: ${p.cantidad} + ${p.extra} extra</li>`;
    return `<li>${nombre}: ${p.cantidad}</li>`;
  })
  .join("") +
  `</ul>`;

    }
let totalExtras = 0;
if (item.personalizacion) {
  totalExtras = item.personalizacion.reduce((sum, ing) => sum + ((ing.extra || 0) * 1), 0);
}
const precioLinea = item.price * item.quantity;


li.innerHTML = `
  ${item.name} x ${item.quantity} ${personalizacionText}
  <span>€${precioLinea.toFixed(2)}</span>
`;
;
    // Botón para eliminar el producto
    const deleteBtn = document.createElement("button");
    deleteBtn.classList.add("btn", "btn-danger", "btn-sm");
    deleteBtn.innerHTML = `<i class="bi bi-trash"></i>`;
    deleteBtn.addEventListener("click", () => eliminarDeCesta(item.id));
    li.appendChild(deleteBtn);

    cartItemsList.appendChild(li);
  });

const totalPrice = cartItems.reduce((acc, item) => {
  return acc + item.price * item.quantity;
}, 0);

  
  document.getElementById("total-precio").textContent = `€${totalPrice.toFixed(2)}`;

  const cartEmptyMessage = document.getElementById("cart-empty");
  cartEmptyMessage.style.display = cartItems.length === 0 ? "block" : "none";
}

// ========================
// Guardar y cargar la cesta en localStorage
// ========================
function saveCartToLocalStorage() {
  localStorage.setItem("cartItems", JSON.stringify(cartItems));
}

// ========================
// Eliminar un producto de la cesta
// ========================
function eliminarDeCesta(id) {
  cartItems = cartItems.filter((item) => item.id !== id);
  saveCartToLocalStorage();
  updateCartDisplay();
}

// ========================
// Botón para abrir la cesta
// ========================
function setupCartButton() {
  const cartBtn = document.getElementById("open-cart");
  if (cartBtn) {
    cartBtn.addEventListener("click", () => {
      const modal = new bootstrap.Modal(document.getElementById("cartModal"));
      modal.show();
    });
  }
}

// ========================
// Notificación Toast al añadir producto
// ========================
function showToast(message) {
  const toast = document.createElement("div");
  toast.className =
    "toast align-items-center text-bg-primary border-0 show position-fixed top-0 end-0 m-3";
  toast.role = "alert";
  toast.style.zIndex = 9999;
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        ${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ========================
// Búsqueda de productos
// ========================
function setupSearchBar() {
  const searchBar = document.getElementById("search-bar");
  if (!searchBar) return;
  searchBar.addEventListener("input", function (e) {
    const query = e.target.value.toLowerCase();
    const filtered = allMenuItems.filter((item) =>
      item.name.toLowerCase().includes(query)
    );
    renderSearchResults(filtered);
  });
}

function renderSearchResults(items) {
  const menuContainer = document.getElementById("menu-container");
  menuContainer.innerHTML = "";

  if (items.length === 0) {
    menuContainer.innerHTML = `<p class="text-center">No hay coincidencias.</p>`;
    return;
  }

  items.forEach((item) => {
    const itemDiv = document.createElement("div");
    itemDiv.classList.add("col-md-4", "mb-4");
    itemDiv.innerHTML = `
      <div class="card h-100 shadow">
        <img
          src="https://loremflickr.com/300/200/${encodeURIComponent(item.name)}"
          class="card-img-top"
          alt="${item.name}"
        />
        <div class="card-body d-flex flex-column">
          <h5 class="card-title">${item.name}</h5>
          <p class="card-text">${item.description}</p>
          <p class="fw-bold text-success">€${parseFloat(item.price).toFixed(2)}</p>
          <button class="btn btn-primary mt-auto" onclick="mostrarPersonalizacion(${item.id})">
            Añadir
          </button>
        </div>
      </div>
    `;
    menuContainer.appendChild(itemDiv);
  });
}


// ========================
// Botones para procesar pedido y cuenta
// ========================
function setupOrderButtons() {
  
  const orderButton = document.getElementById("order-button");
  const billButton  = document.getElementById("bill-button");

orderButton.addEventListener("click", async () => {
  if (cartItems.length === 0) 
    return alert("Tu cesta está vacía.");

  const userData = JSON.parse(localStorage.getItem("user"));
  if (!userData) 
    return alert("Debes iniciar sesión para pedir.");

  const { data: usuario, error: userErr } = await supabaseClient
    .from("usuarios")
    .select("id")
    .eq("email", userData.email)
    .single();

  if (userErr) {
    console.error(userErr);
    return alert("Error identificando usuario.");
  }

  const now = new Date();
  const totalOriginal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const { data: pedidoInsertado, error: insertErr } = await supabaseClient
    .from("pedidos")
    .insert([{
      usuario_id:         usuario.id,
      mesa_id:            mesaId,
      total:              totalOriginal.toFixed(2),
      aplica_descuento:   false,
      descuento_aplicado: 0,
      fecha:              now.toISOString(),
      estado:             "PENDIENTE",
      items:              JSON.stringify(cartItems)
    }])
    .select("id")
    .single();

  if (insertErr) {
    console.error("Error al guardar el pedido:", insertErr);
    return alert("Error al guardar el pedido.");
  }

  const pedidoId = pedidoInsertado.id;

  const itemsParaInsertar = cartItems.map(item => ({
    pedido_id:       pedidoId,
    menu_item_id:    item.id,
    cantidad:        item.quantity,
    precio_unitario: item.price
  }));

  const { error: lineasErr } = await supabaseClient
    .from("pedido_items")
    .insert(itemsParaInsertar);

  if (lineasErr) {
    console.error("Error al guardar las líneas del pedido:", lineasErr);
    return alert("Pedido guardado, pero no se guardaron las líneas.");
  }

  showToast("📦 Tu pedido ha sido enviado al restaurante. En unos segundos estará disponible.");

  cartItems = [];
  saveCartToLocalStorage();
  updateCartDisplay();
});

billButton.addEventListener("click", async () => {
  if (!mesaId) return alert("No se ha definido la mesa.");

  const userData = JSON.parse(localStorage.getItem("user"));
  if (!userData) return alert("No hay usuario autenticado.");

  // Obtener usuario_id desde la tabla
  const { data: usuario, error: userErr } = await supabaseClient
    .from("usuarios")
    .select("id")
    .eq("email", userData.email)
    .single();

  if (userErr) {
    console.error(userErr);
    return alert("No se pudo identificar al usuario.");
  }

  const usuarioId = usuario.id;

  // Obtener todos los pedidos de esa mesa y usuario
  const { data: pedidos, error: pedidosErr } = await supabaseClient
    .from("pedidos")
    .select("id, total, aplica_descuento, items")
    .eq("mesa_id", mesaId)
    .eq("usuario_id", usuarioId);

  if (pedidosErr || !pedidos || pedidos.length === 0) {
    console.error("Error al obtener pedidos:", pedidosErr);
    return alert("No hay pedidos para esta mesa.");
  }

  const pedidosYaDescontados = pedidos.filter(p => p.aplica_descuento);
  const pedidosSinDescuento  = pedidos.filter(p => !p.aplica_descuento);

  const totalYaDescontado = pedidosYaDescontados.reduce((sum, p) => sum + parseFloat(p.total), 0);
  const totalSinDescuento = pedidosSinDescuento.reduce((sum, p) => sum + parseFloat(p.total), 0);

  // Verificar si el usuario tiene derecho al descuento
  const { count: totalCompletos, error: countErr } = await supabaseClient
    .from("pedido_mesa_completo")
    .select("id", { count: "exact", head: true })
    .eq("usuario_id", usuarioId);

  const esInvitado = userData.email === "invitado@restaurante.com";
  const aplicaDescuento = !esInvitado && totalCompletos % 10 === 9;

  let totalFinal = totalYaDescontado + totalSinDescuento;
  let descuentoAplicado = 0;

  if (aplicaDescuento && pedidosSinDescuento.length > 0) {
    descuentoAplicado = totalSinDescuento * 0.30;
    const nuevoTotal = totalSinDescuento - descuentoAplicado;
    const nuevoTotalUnitario = nuevoTotal / pedidosSinDescuento.length;
    const descuentoUnitario = descuentoAplicado / pedidosSinDescuento.length;

    // Actualizar solo los pedidos sin descuento
    const updates = pedidosSinDescuento.map(async (p) => {
      const { error: updateErr } = await supabaseClient
        .from("pedidos")
        .update({
          aplica_descuento: true,
          descuento_aplicado: descuentoUnitario.toFixed(2),
          total: nuevoTotalUnitario.toFixed(2)
        })
        .eq("id", p.id);

      if (updateErr) {
        console.error("Error actualizando pedido con descuento:", updateErr);
      }
    });

    await Promise.all(updates);

    showToast("🎉 ¡Descuento aplicado! 30% a los nuevos pedidos.");
    totalFinal = nuevoTotal + totalYaDescontado;
  }

  const resumenPlatos = pedidos.map(p => {
  try {
    const items = JSON.parse(p.items);
    return items.map(i => `${i.name} x${i.quantity}`).join(", ");
  } catch (e) {
    return "[items no disponibles]";
  }
}).join(", ");

alert(`Has pedido ${resumenPlatos}.\nTotal a pagar: €${totalFinal.toFixed(2)}`);

});
const summaryButton = document.getElementById("summary-button");

if (summaryButton) {
  summaryButton.addEventListener("click", async () => {
    if (!mesaId) return alert("No se ha definido la mesa.");
    const userData = JSON.parse(localStorage.getItem("user"));
    if (!userData) return alert("No hay usuario autenticado.");

    const { data: usuario, error: userErr } = await supabaseClient
      .from("usuarios")
      .select("id")
      .eq("email", userData.email)
      .single();

    if (userErr) {
      console.error(userErr);
      return alert("No se pudo identificar al usuario.");
    }

    const usuarioId = usuario.id;

    const { data: pedidos, error: pedidosErr } = await supabaseClient
      .from("pedidos")
      .select("id, total, aplica_descuento, items")
      .eq("mesa_id", mesaId)
      .eq("usuario_id", usuarioId);

    if (pedidosErr || !pedidos || pedidos.length === 0) {
      console.error("Error al obtener pedidos:", pedidosErr);
      return alert("No hay pedidos para esta mesa.");
    }

    let total = 0;
    let resumenHTML = `<h5>🧾 Resumen de pedidos:</h5><ul style="padding-left: 1rem;">`;

    pedidos.forEach(p => {
      try {
        const items = JSON.parse(p.items);
        items.forEach(i => {
          resumenHTML += `<li>${i.name} x${i.quantity} - €${(i.price * i.quantity).toFixed(2)}</li>`;
          total += i.price * i.quantity;
        });
      } catch (e) {
        resumenHTML += `<li>[items no disponibles]</li>`;
      }
    });

    resumenHTML += `</ul><hr><p><strong>Total actual: €${total.toFixed(2)}</strong></p>`;

  const esInvitado = userData.email === "invitado@restaurante.com";

if (!esInvitado) {
  const { count: completos, error: countErr } = await supabaseClient
    .from("pedido_mesa_completo")
    .select("id", { count: "exact", head: true })
    .eq("usuario_id", usuarioId);

  if (!countErr) {
    const restantes = 10 - (completos % 10 || 10);

    if (restantes === 1) {
      const totalConDescuento = total * 0.7;
      resumenHTML += `
        <div class="alert alert-success mt-2">
          🎉 ¡Felicidades! En esta  visita recibirás un <strong>30% de descuento</strong>.<br/>
          <strong>Total con descuento: €${totalConDescuento.toFixed(2)}</strong>
        </div>
      `;
    } else if (restantes > 1) {
      resumenHTML += `<p>🔁 Te quedan <strong>${restantes}</strong> visita${restantes > 1 ? "s" : ""} para un descuento.</p>`;
    }
  }
}

    // Eliminar modal anterior si existe
const modalAntiguo = document.getElementById("summaryModal");
if (modalAntiguo) {
  modalAntiguo.parentElement.removeChild(modalAntiguo);
}

    const resumenModal = document.createElement("div");
    resumenModal.innerHTML = `
      <div class="modal fade" id="summaryModal" tabindex="-1" aria-labelledby="summaryModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-centered">
          <div class="modal-content">
            <div class="modal-header bg-info text-white">
              <h5 class="modal-title">Resumen del Pedido</h5>
              <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body">${resumenHTML}</div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(resumenModal);
    const bsModal = new bootstrap.Modal(document.getElementById("summaryModal"));
    bsModal.show();
  });
}

}