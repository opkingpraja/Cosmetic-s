// ─── addProduct.js ────────────────────────────────────────────────────────────
// MongoDB + ImageKit se real products fetch karta hai.
// UI mein koi change nahi — sirf data source badla hai.
// ─────────────────────────────────────────────────────────────────────────────

// ✅ FIXED: localhost hata kar relative path (empty string) kar diya hai
const API_BASE = '';

// Global products array — index.html search + productPage.html dono use karte hain
let products = [];

// Promise jo productPage.html wait karega
let _resolveReady;
window.productsReady = new Promise(res => { _resolveReady = res; });

// MongoDB field names → purane addProduct.js ke field names map
function mapProduct(p) {
  return {
    _id:   p._id,
    title: p.name,
    image: p.imageUrl,
    price: p.price,
    desc:  p.description,
  };
}

// ── Products fetch karo ───────────────────────────────────────────────────────
async function fetchAndRender() {
  try {
    const res  = await fetch(`${API_BASE}/public/products`);
    const data = await res.json();

    if (!data.success) return;

    products = data.products.map(mapProduct);

    // index.html ka #productContainer render karo
    const container = document.getElementById('productContainer');
    if (container) renderCards(container);

    // productPage.html ka ready signal
    _resolveReady(products);

  } catch (err) {
    console.error('Products load error:', err);
    _resolveReady([]); // fail hone pe bhi resolve karo
  }
}

// ── Card render (index.html ke liye) ─────────────────────────────────────────
function renderCards(container) {
  container.innerHTML = '';

  if (products.length === 0) {
    container.innerHTML = `<p style="text-align:center;color:#aaa;padding:20px;">Koi product nahi mila.</p>`;
    return;
  }

  products.forEach((p, index) => {
    const card = document.createElement('div');
    card.className = 'card';
    card.innerHTML = `
      <img src="${p.image}" alt="${p.title}" loading="lazy">
      <h3>${p.title}</h3>
      <p>₹${Number(p.price).toLocaleString('en-IN')}</p>
      <button class="btn" onclick="window.location.href='productPage.html?id=${p._id}'">
        View Details
      </button>
    `;
    container.appendChild(card);
  });
}

// ── Real-time polling — 30 sec mein auto-refresh ──────────────────────────────
async function pollProducts() {
  try {
    const res  = await fetch(`${API_BASE}/public/products`);
    const data = await res.json();
    if (!data.success) return;

    const newProducts = data.products.map(mapProduct);

    // Sirf tab re-render karo jab kuch change hua ho
    const changed = JSON.stringify(newProducts) !== JSON.stringify(products);
    if (changed) {
      products = newProducts;
      const container = document.getElementById('productContainer');
      if (container) renderCards(container);
      console.log('🔄 Products updated (realtime)');
    }
  } catch (e) {
    // Silently ignore poll errors
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
fetchAndRender();
setInterval(pollProducts, 30000); // Har 30 sec mein check
