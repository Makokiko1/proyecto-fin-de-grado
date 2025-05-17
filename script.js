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
  // Mostrar saludo personalizado
const userInfo = JSON.parse(localStorage.getItem("user"));
if (userInfo && userInfo.username) {
  const userWelcome = document.getElementById("user-welcome");
  if (userWelcome) {
    userWelcome.textContent = `¡Hola, ${userInfo.username}!`;
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
        <p class="fw-bold text-success">$${parseFloat(item.price).toFixed(2)}</p>
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
  const productoParaCesta = {
    ...producto,
    personalizacion,
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
              cantidad: 0,
              extra: 0,
            });
          }
        } else {
          if (existe) {
            existe.cantidad = ingredienteRel.cantidad_default;
          } else {
            ingredientesPersonalizados.push({
              ingredienteId: ingrediente.id,
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
        "<br><small>Personalización: " +
        item.personalizacion
          .map(
            (p) =>
              "Ingrediente " +
              p.ingredienteId +
              " -> Cantidad: " +
              (p.cantidad + (p.extra || 0))
          )
          .join(", ") +
        "</small>";
    }
    li.innerHTML = `
      ${item.name} x ${item.quantity} ${personalizacionText}
      <span>$${(item.price * item.quantity).toFixed(2)}</span>
    `;
    // Botón para eliminar el producto
    const deleteBtn = document.createElement("button");
    deleteBtn.classList.add("btn", "btn-danger", "btn-sm");
    deleteBtn.innerHTML = `<i class="bi bi-trash"></i>`;
    deleteBtn.addEventListener("click", () => eliminarDeCesta(item.id));
    li.appendChild(deleteBtn);

    cartItemsList.appendChild(li);
  });

  const totalPrice = cartItems.reduce((acc, item) => {
    let extrasCost = 0;
  
    if (item.personalizacion) {
      extrasCost = item.personalizacion.reduce((sum, ing) => sum + (ing.extra || 0), 0);
    }
  
    return acc + (item.price + extrasCost) * item.quantity;
  }, 0);
  
  document.getElementById("total-precio").textContent = `$${totalPrice.toFixed(2)}`;

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
          <p class="fw-bold text-success">$${parseFloat(item.price).toFixed(2)}</p>
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
    if (cartItems.length === 0) return alert("Tu cesta está vacía.");

    // 1) Obtener usuario
    const userData = JSON.parse(localStorage.getItem("user"));
    if (!userData) return alert("Debes iniciar sesión para pedir.");

    const { data: usuario, error: userErr } = await supabaseClient
      .from("usuarios")
      .select("id")
      .eq("email", userData.email)
      .single();
    if (userErr) {
      console.error(userErr);
      return alert("Error identificando usuario.");
    }

    // 2) Contar pedidos del mes
    const now = new Date();
    const mes  = now.getMonth() + 1;
    const anio = now.getFullYear();
    const fechaInicio = `${anio}-${mes.toString().padStart(2, "0")}-01`;

    const { data: pedidosMes, error: countErr } = await supabaseClient
      .from("pedidos")
      .select("id", { count: "exact" })
      .eq("usuario_id", usuario.id)
      .gte("fecha", fechaInicio);
    if (countErr) {
      console.error(countErr);
      return alert("No se pudo comprobar historial de pedidos.");
    }

    const pedidosPrevios = pedidosMes.length;
    const numeroPedido = pedidosPrevios + 1;

// Condición extra: si el usuario es el Invitado, no hay descuento
const esInvitado = (
  userData.email === 'invitado@restaurante.com' || 
  userData.username === 'Invitado'
);

// Aplicar 30% solo si es múltiplo de 10 **y** NO es el usuario Invitado
const aplicaDescuento = (numeroPedido % 10 === 0) && !esInvitado;


    // 3) Calcular totales y descuento
    const totalOriginal = cartItems.reduce((sum, itm) => sum + itm.price * itm.quantity, 0);
    let descuentoValor  = 0;
    let totalFinal      = totalOriginal;

    if (aplicaDescuento) {
      descuentoValor = totalOriginal * 0.30;
      totalFinal     = totalOriginal - descuentoValor;
    }


  // ———————— RELEER mesa_id just antes del INSERT ————————
  const mesaParamUrl = new URLSearchParams(window.location.search).get("table");
  // si no viene en la URL, cae en la variable superior (de localStorage o URL inicial)
  const mesaToUse     = mesaParamUrl
    ? parseInt(mesaParamUrl, 10)
    : mesaId;

  // 4) Insertar en pedidos, usando mesaToUse
  const { data, error: insertErr } = await supabaseClient
    .from("pedidos")
    .insert([{
      usuario_id:       usuario.id,
      mesa_id:          mesaToUse,
      total:            totalFinal.toFixed(2),
      aplica_descuento: aplicaDescuento,
      descuento_aplicado: descuentoValor.toFixed(2),
      items:            cartItems
    }])
    .select();

  if (insertErr) {
    console.error("Error al guardar el pedido:", insertErr);
    return alert("Error al guardar el pedido. Comprueba la consola.");
  }

  console.log("✅ Pedido insertado:", data);


  if (insertErr) {
    console.error(insertErr);
    return alert("Error al guardar el pedido.");
  }


    // 5) Actualizar UI y mensaje
    const importeTexto = `$${totalFinal.toFixed(2)}`;
    if (aplicaDescuento) {
      // Mostrar precio tachado y nuevo precio con estilo
      const totalSpan = document.getElementById("total-precio");
      totalSpan.innerHTML = `
        <del>$${totalOriginal.toFixed(2)}</del>
        <span class="text-success fw-bold ms-2">${importeTexto}</span>
      `;
      showToast(`🎉 ¡Pedido #${numeroPedido}! 30% de descuento aplicado. A pagar: ${importeTexto}`);
    } else {
      alert(`Pedido #${numeroPedido} realizado. Total a pagar: ${importeTexto}`);
    }

    // Limpiar carrito
    cartItems = [];
    saveCartToLocalStorage();
    updateCartDisplay();
  });

  billButton.addEventListener("click", () => {
    if (cartItems.length === 0) return alert("No hay nada que cobrar.");
    const total = document.getElementById("total-precio").textContent;
    alert(`Total a pagar: ${total}`);
    cartItems = [];
    saveCartToLocalStorage();
    updateCartDisplay();
  });
}