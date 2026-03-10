// Example product data
const products = [
  {
    image: "https://ik.imagekit.io/Prajapati/IMG_20260308_135809.jpg?updatedAt=1773122245924",
    title: "POND'S BRICHT BEAUTY",
    desc: "POND's creame",
    price: 65
  },
  {
    image: "https://ik.imagekit.io/Prajapati/IMG_20260308_135542.jpg?updatedAt=1773122267739",
    title: "LIVON SERUM",
    desc: "SERUM",
    price: 70
  },
  {
    image: "https://ik.imagekit.io/Prajapati/IMG_20260308_135553.jpg?updatedAt=1773122251432",
    title: "LABOLIA GLYCERIN",
    desc: "GLYCERIN",
    price: 70
  },
  {
    image: "https://ik.imagekit.io/Prajapati/IMG_20260308_135922.jpg",
    title: "MAKEUP SPONGE",
    desc: "SPONGE",
    price: 80
  },
 {
    image: "https://ik.imagekit.io/Prajapati/IMG_20260308_133209.jpg?updatedAt=1773122382893",
    title: "CLENSTA PERFUME",
    desc: "Quty-1.",
    price: 299
  },
 {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_134820.jpg?updatedAt=1773122260848",
    title: "RIYA MELODY PERFUME",
    desc: " ",
    price: 199
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_134057.jpg?updatedAt=1773122264562",
    title: "AQUI PLUS",
    desc: "Fash-whash",
    price: 105
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_133741.jpg?updatedAt=1773122258190",
    title: "BLUE HEAVEN FOUNDATION",
    desc: "FOUNDATION",
    price: 90
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_133757.jpg?updatedAt=1773122382707",
    title: "GOLDEN GLOW MASK",
    desc: "MASK",
    price: 59
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_135824.jpg?updatedAt=1773122188314",
    title: "GLOW LOVELY BB",
    desc: "BB creame",
    price: 59
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_134622.jpg?updatedAt=1773122259735",
    title: "RAMSONS SANDY DEODORANT SPRAY",
    desc: "PERFUME",
    price: 80
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_134602.jpg?updatedAt=1773122259408",
    title: "RAMSONS ONCE MORE DEODORANT",
    desc: "PERFUME",
    price: 80
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_134656.jpg?updatedAt=1773122254684",
    title: "COBRA SPORT PERFUME",
    desc: "PERFUME",
    price: 85
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_134542.jpg?updatedAt=1773122261393",
    title: "COBRA COOL PERFUME",
    desc: "PERFUME",
    price: 85
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_134448.jpg?updatedAt=1773122262865",
    title: "COBRA EAU DE PERFUME",
    desc: "PERFUME",
    price: 70
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_134233.jpg?updatedAt=1773122262901",
    title: "COBRA EAU DE PERFUME",
    desc: "PERFUME",
    price: 125
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_135750.jpg?updatedAt=1773122263175",
    title: "BLUE VALLEY HAIR REMOVAL",
    desc: "HAIR REMOVAL",
    price: 45
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_135800.jpg?updatedAt=1773122259026",
    title: "VEET PURE HAIR REMOVAL",
    desc: "HAIR REMOVAL",
    price: 109
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_135949.jpg",
    title: "SOFT TUUCH HAIR REMOVAL",
    desc: "HAIR REMOVAL",
    price: 65
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_135949.jpg",
    title: "SOFT TUUCH HAIR REMOVAL",
    desc: "HAIR REMOVAL",
    price: 99
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_135632.jpg?updatedAt=1773122267889",
    title: "GOLD FEM BLEACH",
    desc: "BLEACH",
    price: 45
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_135641.jpg?updatedAt=1773122267826",
    title: "NATURE'S BLAECH",
    desc: "BLEACH",
    price: 35
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_135651.jpg?updatedAt=1773122266597",
    title: "FEM SAFFRON MILK BLEACH",
    desc: "BLEACH",
    price: 37
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_133716.jpg?updatedAt=1773122257919",
    title: "GLOW LOVELY FACE WASH",
    desc: "FACE WASH",
    price: 89
  }
];



// Product add logic 
function renderProducts() {
  const productContainer = document.getElementById("productContainer");
  if (!productContainer) return;

  productContainer.innerHTML = "";

  // 1. Pehle products ki ek copy banate hain aur original index save karte hain
  // Taaki shuffle hone ke baad bhi "id" galat na ho
  let shuffledProducts = products.map((p, i) => ({ ...p, originalIndex: i }));

  // 2. Fisher-Yates Shuffle Logic (Array ko random karne ke liye)
  for (let i = shuffledProducts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledProducts[i], shuffledProducts[j]] = [shuffledProducts[j], shuffledProducts[i]];
  }

  // 3. Ab random array ko display karte hain
  shuffledProducts.forEach((p) => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <img src="${p.image}">
      <h3>${p.title}</h3>
      <button class="btn">₹${p.price}</button>
    `;

    // Click karne par original index ka hi use hoga
    card.addEventListener("click", () => {
      window.location.href = "productPage.html?id=" + p.originalIndex;
    });

    productContainer.appendChild(card);
  });
}

renderProducts();
