// Reemplaza con tus valores de Supabase
const supabaseUrl = "https://slopghtwuyodfycfwngv.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsb3BnaHR3dXlvZGZ5Y2Z3bmd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM3ODE3NDYsImV4cCI6MjA1OTM1Nzc0Nn0.fvKYIoFQt46We1-27DlFxYqvp3Kkdi7KFK76JwXUTCg";

// Crear cliente de Supabase
const { createClient } = window.supabase;
const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Variables globales para categorías, productos y la cesta
let allCategories = [];
let allMenuItems = [];
let cartItems = [];

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Cargar categorías
  await fetchCategories();
  // 2. Cargar productos
  await fetchMenuItems();
  // 3. Mostrar toda la carta por defecto
  displayMenuItems("all");
});

// ========================
// 1) Obtener categorías
// ========================
async function fetchCategories() {
  try {
    const { data, error } = await supabaseClient.from("categories").select("*");
    if (error) {
      console.error("Error al obtener categorías:", error);
      return;
    }
    allCategories = data;
    renderCategoryMenu();
  } catch (err) {
    console.error("Error en fetchCategories:", err);
  }
}

// Renderiza el menú de categorías en el offcanvas
function renderCategoryMenu() {
  const categoryMenu = document.getElementById("category-menu");
  categoryMenu.innerHTML = "";

  // Botón "Todos" para mostrar toda la carta
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

// Marcar como activo el botón de la categoría seleccionada
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
// 2) Obtener productos
// ========================
async function fetchMenuItems() {
  try {
    const { data, error } = await supabaseClient.from("menu_items").select("*");
    if (error) {
      console.error("Error al obtener productos:", error);
      return;
    }
    allMenuItems = data;
  } catch (err) {
    console.error("Error en fetchMenuItems:", err);
  }
}

// ========================
// 3) Mostrar productos en la carta
// ========================
function displayMenuItems(categoryId) {
  const menuContainer = document.getElementById("menu-container");
  menuContainer.innerHTML = "";

  let filteredItems = [];
  if (categoryId === "all") {
    filteredItems = allMenuItems;
  } else {
    filteredItems = allMenuItems.filter((item) => item.category_id === categoryId);
  }

  if (filteredItems.length === 0) {
    menuContainer.innerHTML = `<p class="text-center">No hay productos en esta categoría.</p>`;
    return;
  }

  filteredItems.forEach((item) => {
    const itemDiv = document.createElement("div");
    itemDiv.classList.add("col-md-4");
    itemDiv.innerHTML = `
      <div class="card">
        <img
          src="https://loremflickr.com/300/200/${encodeURIComponent(item.name)}"
          class="card-img-top"
          alt="${item.name}"
        />
        <div class="card-body">
          <h5 class="card-title">${item.name}</h5>
          <p class="card-text">${item.description}</p>
          <p class="fw-bold">$${parseFloat(item.price).toFixed(2)}</p>
          <button class="btn btn-primary" onclick="agregarACesta(${item.id})">
            Añadir
          </button>
        </div>
      </div>
    `;
    menuContainer.appendChild(itemDiv);
  });
}

// ========================
// 4) Añadir producto a la cesta
// ========================
function agregarACesta(id) {
  // Buscar el producto en allMenuItems
  const product = allMenuItems.find(item => item.id === id);
  if (!product) return;

  // Verificar si el producto ya está en la cesta y actualizar la cantidad
  const existingItem = cartItems.find(item => item.id === id);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cartItems.push({ ...product, quantity: 1 });
  }

  updateCartDisplay();
}

// ========================
// 5) Actualizar la visualización de la cesta
// ========================
function updateCartDisplay() {
  // Actualizar el contador de productos en "Mi Cesta"
  const count = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  document.getElementById("cart-count").textContent = count;

  // Actualizar el listado de productos en el modal de la cesta
  const cartItemsList = document.getElementById("cart-items");
  cartItemsList.innerHTML = "";

  cartItems.forEach(item => {
    const li = document.createElement("li");
    li.classList.add("list-group-item", "d-flex", "justify-content-between", "align-items-center");
    li.textContent = `${item.name} x ${item.quantity}`;

    const span = document.createElement("span");
    span.textContent = `$${(item.price * item.quantity).toFixed(2)}`;
    li.appendChild(span);

    cartItemsList.appendChild(li);
  });

  // Actualizar el total de la cesta
  const totalPrice = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
  document.getElementById("total-precio").textContent = `$${totalPrice.toFixed(2)}`;

  // Mostrar o ocultar mensaje de cesta vacía
  const cartEmptyMessage = document.getElementById("cart-empty");
  cartEmptyMessage.style.display = cartItems.length === 0 ? "block" : "none";
}
