const API_BASE = '';
let products = [];
let _resolveReady;
window.productsReady = new Promise(res => { _resolveReady = res; });

// 🔀 Shuffle Function
function shuffle(array) {
  return array.sort(() => Math.random() - 0.5);
}

async function fetchAndRender() {
  const container = document.getElementById('productContainer');
  
  // 1. Cache se turant uthao
  const cache = sessionStorage.getItem('store_cache');
  if (cache) {
    products = shuffle(JSON.parse(cache));
    renderCards(container);
    _resolveReady(products);
  }

  // 2. Background mein server se fresh data lao
  try {
    const res = await fetch(`${API_BASE}/public/products`);
    const data = await res.json();
    if (data.success) {
      const freshData = data.products.map(p => ({
        _id: p._id, title: p.name, image: p.imageUrl, price: p.price, desc: p.description
      }));
      sessionStorage.setItem('store_cache', JSON.stringify(freshData));
      
      // Agar cache nahi tha, tabhi refresh karo taaki user ka scroll na bigde
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
      <img src="${p.image}" loading="lazy">
      <h3>${p.title}</h3>
      <p>₹${p.price}</p>
      <button class="btn" onclick="location.href='productPage.html?id=${p._id}'">View Details</button>
    </div>
  `).join('');
}
fetchAndRender();
