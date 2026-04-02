// ─── addProduct.js ────────────────────────────────────────────────────────────
const API_BASE = '';

let products = [];
let _resolveReady;
window.productsReady = new Promise(res => { _resolveReady = res; });

function mapProduct(p) {
  return {
    _id:   p._id,
    title: p.name,
    image: p.imageUrl,
    price: p.price,
    desc:  p.description,
  };
}

// 🪄 NAYA FUNCTION: Loading Skeleton Dikhane Ke Liye
function renderSkeletons(container, count = 4) {
  container.innerHTML = '';
  for(let i=0; i<count; i++) {
    container.innerHTML += `
      <div class="card">
        <div class="skeleton skeleton-img"></div>
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-price"></div>
        <div class="skeleton skeleton-btn"></div>
      </div>
    `;
  }
}

// ── Products fetch karo ───────────────────────────────────────────────────────
async function fetchAndRender() {
  const container = document.getElementById('productContainer');
  
  // ⏳ Data aane se pehle Skeleton dikhao (Suspense!)
  if (container) renderSkeletons(container, 4);

  try {
    const res  = await fetch(`${API_BASE}/public/products`);
    const data = await res.json();

    if (!data.success) return;

    products = data.products.map(mapProduct);

    // 🌟 Data aate hi asli products dikhao
    if (container) renderCards(container);

    _resolveReady(products);

  } catch (err) {
    console.error('Products load error:', err);
    if (container) container.innerHTML = `<p style="text-align:center;color:#aaa;padding:20px;">Products load nahi ho paye.</p>`;
    _resolveReady([]); 
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

// ── Real-time polling ──────────────────────────────
async function pollProducts() {
  try {
    const res  = await fetch(`${API_BASE}/public/products`);
    const data = await res.json();
    if (!data.success) return;

    const newProducts = data.products.map(mapProduct);
    const changed = JSON.stringify(newProducts) !== JSON.stringify(products);
    
    if (changed) {
      products = newProducts;
      const container = document.getElementById('productContainer');
      if (container) renderCards(container);
    }
  } catch (e) {}
}

fetchAndRender();
setInterval(pollProducts, 30000);
