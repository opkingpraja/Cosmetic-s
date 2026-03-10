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
    desc: "hfg",
    price: 70
  },
  {
    image: "https://ik.imagekit.io/Prajapati/IMG_20260308_135553.jpg?updatedAt=1773122251432",
    title: "LABOLIA GLYCERIN",
    desc: "yyy",
    price: 70
  },
  {
    image: "https://ik.imagekit.io/Prajapati/IMG_20260308_135922.jpg",
    title: "MAKEUP SPONGE",
    desc: "hguh",
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
    desc: "gtrr",
    price: 199
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_134057.jpg?updatedAt=1773122264562",
    title: "AQUI PLUS",
    desc: "gtrr",
    price: 105
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_133741.jpg?updatedAt=1773122258190",
    title: "BLUE HEAVEN FOUNDATION",
    desc: "gtrr",
    price: 90
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_133757.jpg?updatedAt=1773122382707",
    title: "GOLDEN GLOW MASK",
    desc: "gtrr",
    price: 59
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_135824.jpg?updatedAt=1773122188314",
    title: "GLOW LOVELY BB",
    desc: "gtrr",
    price: 59
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_134622.jpg?updatedAt=1773122259735",
    title: "RAMSONS SANDY DEODORANT SPRAY",
    desc: "gtrr",
    price: 80
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_134602.jpg?updatedAt=1773122259408",
    title: "RAMSONS ONCE MORE DEODORANT",
    desc: "gtrr",
    price: 80
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_134656.jpg?updatedAt=1773122254684",
    title: "COBRA SPORT PERFUME",
    desc: "gtrr",
    price: 85
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_134542.jpg?updatedAt=1773122261393",
    title: "COBRA COOL PERFUME",
    desc: "gtrr",
    price: 85
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_134448.jpg?updatedAt=1773122262865",
    title: "COBRA EAU DE PERFUME",
    desc: "gtrr",
    price: 70
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_134233.jpg?updatedAt=1773122262901",
    title: "COBRA EAU DE PERFUME",
    desc: "gtrr",
    price: 125
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_135750.jpg?updatedAt=1773122263175",
    title: "BLUE VALLEY HAIR REMOVAL",
    desc: "gtrr",
    price: 45
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_135800.jpg?updatedAt=1773122259026",
    title: "VEET PURE HAIR REMOVAL",
    desc: "gtrr",
    price: 109
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_135949.jpg",
    title: "SOFT TUUCH HAIR REMOVAL",
    desc: "gtrr",
    price: 65
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_135949.jpg",
    title: "SOFT TUUCH HAIR REMOVAL",
    desc: "gtrr",
    price: 99
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_135632.jpg?updatedAt=1773122267889",
    title: "GOLD FEM BLEACH",
    desc: "gtrr",
    price: 45
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_135641.jpg?updatedAt=1773122267826",
    title: "NATURE'S BLAECH",
    desc: "gtrr",
    price: 35
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_135651.jpg?updatedAt=1773122266597",
    title: "FEM SAFFRON MILK BLEACH",
    desc: "gtrr",
    price: 37
  },
  {
  image: "https://ik.imagekit.io/Prajapati/IMG_20260308_133716.jpg?updatedAt=1773122257919",
    title: "GLOW LOVELY FACE WASH",
    desc: "gtrr",
    price: 89
  }
];



// Product add logic 
function renderProducts(image,title,desc,price) {
  productContainer.innerHTML = "";

  products.forEach((p, index) => {
    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <img src="${p.image}">
      <h3>${p.title}</h3>
      <button class="btn">₹${p.price}</button>
    `;

    card.addEventListener("click", () => {
      window.location.href = "productPage.html?id=" + index;
    });

    productContainer.appendChild(card);
  });
}

renderProducts();
