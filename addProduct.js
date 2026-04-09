const API_BASE = '';
let products = [];
let _resolveReady;
window.productsReady = new Promise(res => { _resolveReady = res; });

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function renderSkeletons(con, count = 8) {
  if (!con) return;
  con.innerHTML = Array(count).fill(`
    <div class="card">
      <div class="card-img-wrap"><div class="skeleton skeleton-img"></div></div>
      <div class="skeleton skeleton-title"></div>
      <div class="skeleton skeleton-price"></div>
      <div class="skeleton skeleton-btn"></div>
    </div>
  `).join('');
}

async function fetchAndRender() {
  const container = document.getElementById('productContainer');
  renderSkeletons(container);

  const cache = sessionStorage.getItem('store_cache');
  if (cache) {
    products = shuffle(JSON.parse(cache));
    renderCards(container);
    _resolveReady(products);
  }

  try {
    const res = await fetch(`${API_BASE}/public/products`);
    const data = await res.json();
    if (data.success) {
      const freshData = data.products.map(p => ({
        _id:      p._id,
        title:    p.name,
        image:    p.imageUrl,
        price:    p.price,
        desc:     p.description,
        category: p.category || '',
        quantity: p.quantity ?? 0,
        mfgDate:  p.mfgDate || '',
        expDate:  p.expDate || '',
      }));
      sessionStorage.setItem('store_cache', JSON.stringify(freshData));
      if (!cache) {
        products = shuffle(freshData);
        renderCards(container);
        _resolveReady(products);
      } else {
        _resolveReady(products);
      }
    }
  } catch (e) { console.error(e); }
}

function renderCards(con) {
  if (!con) return;
  con.innerHTML = products.map(p => `
    <div class="card" onclick="location.href='productPage.html?id=${p._id}'">
      <div class="card-img-wrap">
        <img src="${p.image}" loading="lazy" alt="${p.title}">
      </div>
      <h3>${p.title}</h3>
      <p>₹${Number(p.price).toLocaleString('en-IN')}</p>
      <button class="btn">View Details</button>
    </div>
  `).join('');
}

fetchAndRender();
