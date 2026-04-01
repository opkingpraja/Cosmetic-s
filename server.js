require('dotenv').config();

const express  = require('express');
const mongoose = require('mongoose');
const multer   = require('multer');
const ImageKit = require('imagekit');
const cors     = require('cors');
const path     = require('path');
const crypto   = require('crypto');

const app      = express();
const PORT     = process.env.PORT || 3000;
const ROOT_DIR = process.cwd();

console.log('📁 Root:', ROOT_DIR);

// ── Simple token store (memory) ───────────────────────────────────────────────
// Server restart hone par token expire ho jayega — user dobara login karega
const validTokens = new Set();

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files — admin.html aur login.html dono serve honge
app.use(express.static(ROOT_DIR));

// ── Root → login page ─────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'login.html'));
});

// ── Auth middleware — admin.html sirf logged-in users ke liye ─────────────────
app.get('/admin.html', (req, res) => {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (token && validTokens.has(token)) {
    res.sendFile(path.join(ROOT_DIR, 'admin.html'));
  } else {
    // Token nahi → login page par bhejo
    res.redirect('/');
  }
});

// ── POST /auth/login — Password check ─────────────────────────────────────────
app.post('/auth/login', (req, res) => {
  const { password } = req.body;
  const correctPass  = process.env.ADMIN_PASSWORD;

  if (!correctPass) {
    console.error('❌ ADMIN_PASSWORD .env me set nahi hai!');
    return res.status(500).json({ success: false, message: 'Server config error' });
  }

  if (password === correctPass) {
    // Secure random token generate karo
    const token = crypto.randomBytes(32).toString('hex');
    validTokens.add(token);
    console.log('✅ Admin logged in');
    res.json({ success: true, token });
  } else {
    console.warn('⚠️ Galat password attempt');
    res.status(401).json({ success: false, message: 'Galat password!' });
  }
});

// ── POST /auth/logout ─────────────────────────────────────────────────────────
app.post('/auth/logout', (req, res) => {
  const { token } = req.body;
  if (token) validTokens.delete(token);
  res.json({ success: true });
});

// ── Auth check middleware for API routes ──────────────────────────────────────
function requireAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (token && validTokens.has(token)) return next();
  res.status(401).json({ success: false, message: 'Unauthorized — pehle login karo' });
}

// ── ImageKit ───────────────────────────────────────────────────────────────────
const imagekit = new ImageKit({
  publicKey:   process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey:  process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

// ── MongoDB ────────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => { console.error('❌ MongoDB:', err.message); process.exit(1); });

const productSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  description: { type: String, required: true },
  price:       { type: Number, required: true },
  imageUrl:    { type: String, required: true },
  imageFileId: { type: String },
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);

// ── Multer — memory only ───────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Sirf image files allowed hain!'));
  },
});

// ── GET /public/products — No auth, customer-facing pages ke liye ───────────
app.get('/public/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /upload ───────────────────────────────────────────────────────────────
app.post('/upload', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { name, description, price } = req.body;
    if (!name || !description || !price || !req.file)
      return res.status(400).json({ success: false, message: 'Sab fields required hain.' });

    const ikRes = await imagekit.upload({
      file: req.file.buffer,
      fileName: `${Date.now()}_${req.file.originalname}`,
      folder: '/products',
    });

    const product = await Product.create({
      name, description,
      price: Number(price),
      imageUrl: ikRes.url,
      imageFileId: ikRes.fileId,
    });

    res.status(201).json({ success: true, message: 'Product save ho gaya!', product });
  } catch (err) {
    console.error('❌ Upload error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /products ──────────────────────────────────────────────────────────────
app.get('/products', requireAuth, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /products/:id ──────────────────────────────────────────────────────────
app.put('/products/:id', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { name, description, price } = req.body;
    if (!name || !description || !price)
      return res.status(400).json({ success: false, message: 'Fields required.' });

    const product = await Product.findById(req.params.id);
    if (!product)
      return res.status(404).json({ success: false, message: 'Product nahi mila.' });

    product.name = name;
    product.description = description;
    product.price = Number(price);

    if (req.file) {
      if (product.imageFileId) {
        try { await imagekit.deleteFile(product.imageFileId); } catch (e) {}
      }
      const ikRes = await imagekit.upload({
        file: req.file.buffer,
        fileName: `${Date.now()}_${req.file.originalname}`,
        folder: '/products',
      });
      product.imageUrl    = ikRes.url;
      product.imageFileId = ikRes.fileId;
    }

    await product.save();
    res.json({ success: true, message: 'Updated!', product });
  } catch (err) {
    console.error('❌ Update error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /products/:id ───────────────────────────────────────────────────────
app.delete('/products/:id', requireAuth, async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product)
      return res.status(404).json({ success: false, message: 'Product nahi mila.' });

    if (product.imageFileId) {
      try { await imagekit.deleteFile(product.imageFileId); } catch (e) {}
    }
    await product.deleteOne();
    res.json({ success: true, message: 'Product delete ho gaya!' });
  } catch (err) {
    console.error('❌ Delete error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Start ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));
