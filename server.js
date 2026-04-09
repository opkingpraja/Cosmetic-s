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
const validTokens = new Set();

// ── Middleware ─────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
    res.redirect('/');
  }
});

// ── POST /auth/login ──────────────────────────────────────────────────────────
app.post('/auth/login', (req, res) => {
  const { password } = req.body;
  const correctPass  = process.env.ADMIN_PASSWORD;
  if (!correctPass) {
    console.error('❌ ADMIN_PASSWORD .env me set nahi hai!');
    return res.status(500).json({ success: false, message: 'Server config error' });
  }
  if (password === correctPass) {
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

// ── Auth middleware ───────────────────────────────────────────────────────────
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

// ── Category Schema (dedup) ───────────────────────────────────────────────────
const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true, lowercase: true },
}, { timestamps: true });
const Category = mongoose.model('Category', categorySchema);

// ── Date Schema (dedup: store unique date strings) ────────────────────────────
const dateEntrySchema = new mongoose.Schema({
  value: { type: String, required: true, unique: true, trim: true }, // "DD/M/YYYY"
}, { timestamps: true });
const DateEntry = mongoose.model('DateEntry', dateEntrySchema);

// ── Quantity Schema (dedup) ───────────────────────────────────────────────────
const quantitySchema = new mongoose.Schema({
  value: { type: Number, required: true, unique: true },
}, { timestamps: true });
const QuantityEntry = mongoose.model('QuantityEntry', quantitySchema);

// ── Product Schema ────────────────────────────────────────────────────────────
const productSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },
  description: { type: String, required: true },
  price:       { type: Number, required: true },
  imageUrl:    { type: String, required: true },
  imageFileId: { type: String },
  category:    { type: String, default: '' },
  quantity:    { type: Number, default: 0 },
  mfgDate:     { type: String, default: '' },  // "DD/M/YYYY"
  expDate:     { type: String, default: '' },  // "DD/M/YYYY"
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);

// ── Multer ────────────────────────────────────────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Sirf image files allowed hain!'));
  },
});

// ── Helper: save deduplicated values ─────────────────────────────────────────
async function saveCategoryIfNew(name) {
  if (!name) return;
  await Category.findOneAndUpdate(
    { name: name.toLowerCase().trim() },
    { name: name.toLowerCase().trim() },
    { upsert: true, new: true }
  );
}
async function saveDateIfNew(dateStr) {
  if (!dateStr) return;
  await DateEntry.findOneAndUpdate(
    { value: dateStr.trim() },
    { value: dateStr.trim() },
    { upsert: true, new: true }
  );
}
async function saveQuantityIfNew(qty) {
  if (qty === undefined || qty === null || qty === '') return;
  const num = Number(qty);
  if (isNaN(num)) return;
  await QuantityEntry.findOneAndUpdate(
    { value: num },
    { value: num },
    { upsert: true, new: true }
  );
}

// ── GET /public/products ──────────────────────────────────────────────────────
app.get('/public/products', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /admin/meta — categories, dates, quantities for admin panel cache ─────
app.get('/admin/meta', requireAuth, async (req, res) => {
  try {
    const [categories, dates, quantities] = await Promise.all([
      Category.find().sort({ name: 1 }).lean(),
      DateEntry.find().sort({ value: 1 }).lean(),
      QuantityEntry.find().sort({ value: 1 }).lean(),
    ]);
    res.json({
      success: true,
      categories: categories.map(c => c.name),
      dates: dates.map(d => d.value),
      quantities: quantities.map(q => q.value),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /upload ───────────────────────────────────────────────────────────────
app.post('/upload', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { name, description, price, category, quantity, mfgDate, expDate } = req.body;
    if (!name || !description || !price || !req.file)
      return res.status(400).json({ success: false, message: 'Sab required fields fill karo.' });

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
      category: category || '',
      quantity: Number(quantity) || 0,
      mfgDate: mfgDate || '',
      expDate: expDate || '',
    });

    // Save deduped meta
    await Promise.all([
      saveCategoryIfNew(category),
      saveDateIfNew(mfgDate),
      saveDateIfNew(expDate),
      saveQuantityIfNew(quantity),
    ]);

    res.status(201).json({ success: true, message: 'Product save ho gaya!', product });
  } catch (err) {
    console.error('❌ Upload error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /products ─────────────────────────────────────────────────────────────
app.get('/products', requireAuth, async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.json({ success: true, products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /products/:id ─────────────────────────────────────────────────────────
app.put('/products/:id', requireAuth, upload.single('image'), async (req, res) => {
  try {
    const { name, description, price, category, quantity, mfgDate, expDate } = req.body;
    if (!name || !description || !price)
      return res.status(400).json({ success: false, message: 'Fields required.' });

    const product = await Product.findById(req.params.id);
    if (!product)
      return res.status(404).json({ success: false, message: 'Product nahi mila.' });

    product.name        = name;
    product.description = description;
    product.price       = Number(price);
    product.category    = category || '';
    product.quantity    = Number(quantity) || 0;
    product.mfgDate     = mfgDate || '';
    product.expDate     = expDate || '';

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

    // Save deduped meta
    await Promise.all([
      saveCategoryIfNew(category),
      saveDateIfNew(mfgDate),
      saveDateIfNew(expDate),
      saveQuantityIfNew(quantity),
    ]);

    res.json({ success: true, message: 'Updated!', product });
  } catch (err) {
    console.error('❌ Update error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /products/:id ──────────────────────────────────────────────────────
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

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));
