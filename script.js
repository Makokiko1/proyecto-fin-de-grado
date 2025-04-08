// ========================
// Configuración de Supabase
// ========================
const supabaseUrl = "https://slopghtwuyodfycfwngv.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsb3BnaHR3dXlvZGZ5Y2Z3bmd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM3ODE3NDYsImV4cCI6MjA1OTM1Nzc0Nn0.fvKYIoFQt46We1-27DlFxYqvp3Kkdi7KFK76JwXUTCg";

const { createClient } = window.supabase;
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// ========================
// Variables globales
// ========================
let allCategories = [];
let allMenuItems = [];
let cartItems = JSON.parse(localStorage.getItem("cartItems")) || [];

// ========================
// Inicializar al cargar el DOM
// ========================
document.addEventListener("DOMContentLoaded", async () => {
  await fetchCategories();
  await fetchMenuItems();
  displayMenuItems("all");
  setupCartButton();
  setupSearchBar();
  updateCartDisplay();
  setupOrderButtons();
});

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
          src="https://loremflickr.com/300/200/${encodeURIComponent(item.name)}"
          class="card-img-top"
          alt="${item.name}"
        />
        <div class="card-body d-flex flex-column">
          <h5 class="card-title">${item.name}</h5>
          <p class="card-text">${item.description}</p>
          <p class="fw-bold text-success">$${parseFloat(item.price).toFixed(2)}</p>
          <button class="btn btn-primary mt-auto" onclick="agregarACesta(${item.id})">
            Añadir
          </button>
        </div>
      </div>
    `;
    menuContainer.appendChild(itemDiv);
  });
}

// ========================
// Añadir producto a la cesta
// ========================
function agregarACesta(id) {
  const product = allMenuItems.find((item) => item.id === id);
  if (!product) return;

  const existingItem = cartItems.find((item) => item.id === id);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cartItems.push({ ...product, quantity: 1 });
  }
  saveCartToLocalStorage();
  updateCartDisplay();
  showToast(`"${product.name}" añadido a la cesta`);
}

// ========================
//  Actualizar visualización de la cesta
// ========================
function updateCartDisplay() {
  const count = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  document.getElementById("cart-count").textContent = count;

  const cartItemsList = document.getElementById("cart-items");
  cartItemsList.innerHTML = "";

  cartItems.forEach((item) => {
    const li = document.createElement("li");
    li.classList.add("list-group-item", "d-flex", "justify-content-between", "align-items-center");
    li.innerHTML = `
      ${item.name} x ${item.quantity}
      <span>$${(item.price * item.quantity).toFixed(2)}</span>
    `;
    // Agregar botón para eliminar el item
    const deleteBtn = document.createElement("button");
    deleteBtn.classList.add("btn", "btn-danger", "btn-sm");
    deleteBtn.innerHTML = `<i class="bi bi-trash"></i>`;
    deleteBtn.addEventListener("click", () => eliminarDeCesta(item.id));
    li.appendChild(deleteBtn);

    cartItemsList.appendChild(li);
  });

  const totalPrice = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
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
  cartItems = cartItems.filter(item => item.id !== id);
  saveCartToLocalStorage();
  updateCartDisplay();
}

// ========================
//  Botón de abrir cesta 
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
  toast.className = "toast align-items-center text-bg-primary border-0 show position-fixed top-0 end-0 m-3";
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
    const filtered = allMenuItems.filter(item =>
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
          <button class="btn btn-primary mt-auto" onclick="agregarACesta(${item.id})">
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
  const billButton = document.getElementById("bill-button");

  orderButton.addEventListener("click", () => {
    if (cartItems.length === 0) return alert("Tu cesta está vacía.");
    alert("¡Pedido realizado! Gracias por tu compra.");
    cartItems = [];
    saveCartToLocalStorage();
    updateCartDisplay();
  });

  billButton.addEventListener("click", () => {
    if (cartItems.length === 0) return alert("No hay nada que cobrar.");
    alert(`Total a pagar: ${document.getElementById("total-precio").textContent}`);
    cartItems = [];
    saveCartToLocalStorage();
    updateCartDisplay();
  });
}
