const API_BASE = '';
let products = [];
let _resolveReady;
window.productsReady = new Promise(res => { _resolveReady = res; });

// ✅ Fisher-Yates shuffle (proper random, sort() wala biased hota hai)
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ✅ Skeleton cards — space reserve karte hain taaki CLS na ho
function renderSkeletons(con, count = 8) {
  if (!con) return;
  con.innerHTML = Array(count).fill(`
    <div class="card">
      <div class="skeleton skeleton-img"></div>
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-price"></div>
      <div class="skeleton skeleton-btn"></div>
    </div>
  `).join('');
}

async function fetchAndRender() {
  const container = document.getElementById('productContainer');

  // 🔑 PEHLE skeleton dikhao — height reserve ho jaayegi, scroll nahi kudega
  renderSkeletons(container);

  // Cache se data hai toh turant cards dikhao
  const cache = sessionStorage.getItem('store_cache');
  if (cache) {
    products = shuffle(JSON.parse(cache));
    renderCards(container);
    _resolveReady(products);
  }

  // Background mein fresh data lao
  try {
    const res = await fetch(`${API_BASE}/public/products`);
    const data = await res.json();
    if (data.success) {
      const freshData = data.products.map(p => ({
        _id: p._id, title: p.name, image: p.imageUrl, price: p.price, desc: p.description
      }));
      sessionStorage.setItem('store_cache', JSON.stringify(freshData));

      // Sirf tab refresh karo jab cache nahi tha
      if (!cache) {
        products = shuffle(freshData);
        renderCards(container);
        _resolveReady(products);
      }
    }
  } catch (e) { console.error(e); }
}

function renderCards(con) {
  if (!con) return;
  con.innerHTML = products.map(p => `
    <div class="card">
      <img src="${p.image}" loading="lazy" alt="${p.title}">
      <h3>${p.title}</h3>
      <p>₹${Number(p.price).toLocaleString('en-IN')}</p>
      <button class="btn" onclick="location.href='productPage.html?id=${p._id}'">View Details</button>
    </div>
  `).join('');
}

fetchAndRender();
