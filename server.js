require('dotenv').config();

const cron = require('node-cron');
const nodemailer = require('nodemailer');
const axios = require('axios');
const express  = require('express');
const mongoose = require('mongoose');
const multer   = require('multer');
const ImageKit = require('imagekit');
const cors     = require('cors');
const path     = require('path');
const crypto   = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { GoogleGenAI } = require('@google/genai');
// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });


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

// ── GET /products/meta (Path fixed for admin.html) ──────────────────────────
app.get('/products/meta', requireAuth, async (req, res) => {
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


// ── POST /api/smart-scan (OPTIONAL AI SCAN) ───────────────────────────────────
app.post('/api/smart-scan', requireAuth, upload.array('scanImages', 4), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'Koi image nahi mili!' });
    }

    // Multer ki memory images ko Base64 mein convert karna (Gemini ke liye)
    const imageParts = req.files.map(file => ({
      inlineData: {
        data: file.buffer.toString("base64"),
        mimeType: file.mimetype
      }
    }));

    // AI ke liye strict instruction
    const prompt = `Aap ek expert product label scanner hain. Main aapko **ek hi product ki alag-alag angles se li gayi multiple photos** bhej raha hoon. In sabhi photos ko mila kar dhyan se padho aur details nikal kar STRICTLY ek valid JSON object return karo. Koi extra text, explanation ya markdown block (\`\`\`json) mat dena.

    Extraction Rules:
    1. "name": Product ka brand ya main naam nikalo. (Agar alag photos mein aadha-aadha naam dikhe, toh unhe combine karke poora naam bana lo).
    2. "price": MRP dhoondho. Sirf number return karna (Jaise: "299" ya "150"). Rs ya ₹ mat lagana.
    3. "mfgDate": Manufacturing Date (MFD, MFG, PKD, Packed on) dhoondho. Format STRICTLY "DD/MM/YYYY" hona chahiye. Agar sirf month aur year likha ho (Jaise 10/24 ya Oct 2024), toh 01 lagakar "01/10/2024" likho.
    4. "expDate": Expiry Date (EXP, Use Before, Best Before) dhoondho. Format STRICTLY "DD/MM/YYYY" hona chahiye. 
       *Important Logic:* Agar label par likha ho "Best before 24 months" ya "Use within 36 months", toh pehle MFD date dhoondho aur usme utne months jod kar khud Expiry date calculate karo (e.g. MFD 01/10/2024 hai aur 24 months likha hai, toh expDate "01/10/2026" do). Agar dates bilkul na mile toh empty string "" dena.

    Output Format:
    {
      "name": "",
      "price": "",
      "mfgDate": "",
      "expDate": ""
    }`;

    // Gemini 2.5 Flash model call
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [prompt, ...imageParts],
        config: {
            responseMimeType: "application/json", // Yeh ensure karega ki output hamesha JSON hi aaye
        }
    });

    const parsedData = JSON.parse(response.text);
    res.json({ success: true, data: parsedData });

  } catch (err) {
    console.error('❌ Smart Scan Error:', err.message);
    res.status(500).json({ success: false, message: 'AI scan fail ho gaya.' });
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


// 1. Separate connection for Users Database
// ══════════════════════════════════════════════════════════════════════════
//  NEW USER SYSTEM (LOGIN / SIGNUP / OTP)
// ══════════════════════════════════════════════════════════════════════════

// 1. Separate connection for Users Database
console.log('⏳ User Database (MongoDB) se connect hone ki koshish kar raha hai...');

const userDb = mongoose.createConnection(process.env.MONGO_URI_USERDB);

// Jab successfully connect ho jayega
userDb.on('connected', () => {
  console.log('✅ USER MONGODB CONNECTED SUCCESSFUL! 🎉');
});

// Agar connect hone me koi error aayega
userDb.on('error', (err) => {
  console.error('❌ USER MONGODB CONNECTION ERROR:', err.message);
});


// 2. User Schema
const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  phone:    { type: String, required: true },
  state:    { type: String },
  city:     { type: String },
  address:  { type: String },
  password: { type: String, required: true }
}, { timestamps: true });

// 3. Order Schema (Database me orders save karne ke liye)
const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: Array,
  totalAmount: Number,
  userDetails: Object,
  createdAt: { type: Date, default: Date.now }
});
const Order = userDb.model('Order', orderSchema);

// 4. OTP Schema (Auto delete after 5 mins)
const otpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp:   { type: String, required: true },
  createdAt: { type: Date, expires: '5m', default: Date.now } 
});

// Use 'userDb.model' so it saves in the NEW database!
const User = userDb.model('User', userSchema);
const Otp = userDb.model('Otp', otpSchema);

// ── API: User Signup ──
app.post('/api/user/signup', async (req, res) => {
  try {
    const { fullName, email, phone, state, city, address, password } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ success: false, message: 'Yeh Email pehle se registered hai!' });

    // Hash Password for security
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({ fullName, email, phone, state, city, address, password: hashedPassword });
    
    // YEH LINE ADD KI HAI (Taaki account bante hi token mil jaye)
    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET || 'secret123', { expiresIn: '30d' });
    
    res.json({ success: true, token, message: 'Account ban gaya!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ── API: Login with Password ──
app.post('/api/user/login-password', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    
    if (!user) return res.status(400).json({ success: false, message: 'Account nahi mila!' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Galat Password!' });

    // Create Persistent Token (Valid for 30 days)
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'secret123', { expiresIn: '30d' });
    res.json({ success: true, token, message: 'Login successful!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── API: Send OTP to Email ──
app.post('/api/user/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ success: false, message: 'Is email se koi account nahi hai!' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digit OTP

    await Otp.deleteMany({ email }); // Delete old OTP
    await Otp.create({ email, otp });

    // Send Email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    await transporter.sendMail({
      from: `"Anntya Store" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Your Login OTP is ${otp}`,
      html: `<h3>Welcome back!</h3><p>Your OTP for login is <b><span style="font-size:24px; color:#e6196a;">${otp}</span></b>.</p><p>It is valid for 5 minutes only.</p>`
    });

    res.json({ success: true, message: 'OTP bhej diya gaya hai!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── API: Verify OTP ──
app.post('/api/user/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const validOtp = await Otp.findOne({ email, otp });
    
    if (!validOtp) return res.status(400).json({ success: false, message: 'Galat ya Expired OTP!' });

    const user = await User.findOne({ email });
    let token = null;

    // YEH ERROR FIX KIYA HAI (Signup me crash nahi hoga)
    if (user) {
      token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'secret123', { expiresIn: '30d' });
    }

    await Otp.deleteOne({ _id: validOtp._id }); // Use ho gaya toh delete kar do
    res.json({ success: true, token, message: 'OTP Verified!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ══════════════════════════════════════════════════════════════════════════
//  CHECKOUT & ORDER SYSTEM + SIGNUP OTP LOGIC
// ══════════════════════════════════════════════════════════════════════════

// Middleware: Check if user is logged in
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(401).json({ success: false, message: 'Please login first!' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
    req.userId = decoded.userId;
    next();
  } catch (e) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// 1. Get Logged-in User Profile
app.get('/api/user/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password'); // Password chhod kar sab bhej do
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Place Order (Sends Email to You Silently)
app.post('/api/order/place', verifyToken, async (req, res) => {
  try {
    const { items, totalAmount, userDetails } = req.body; // Yahan ab 'items' aayega (array)
    
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    // Sabhi products ka HTML list bana rahe hain
    let productsHtml = items.map(p => `
      <div style="border-bottom: 1px dashed #ccc; padding-bottom: 15px; margin-bottom: 15px;">
        <p style="margin:0 0 5px 0;"><b>Product:</b> ${p.title}</p>
        <p style="margin:0 0 5px 0;"><b>Price:</b> ₹${p.price} x ${p.qty} (Qty)</p>
        <p style="margin:0 0 10px 0;"><b>Subtotal:</b> ₹${p.price * p.qty}</p>
        <img src="${p.image}" width="120" style="border-radius:10px; border: 1px solid #ddd;">
      </div>
    `).join('');

    const adminEmailHtml = `
      <h2 style="color: #e6196a;">🛒 Naya Order Aaya Hai!</h2>
      <hr>
      <h3 style="color: #7a5065;">👤 Customer Details:</h3>
      <p><b>Name:</b> ${userDetails.fullName}</p>
      <p><b>Email:</b> ${userDetails.email}</p>
      <p><b>Phone:</b> ${userDetails.phone}</p>
      <p><b>Address:</b> ${userDetails.address}, ${userDetails.city}</p>
      <hr>
      <h3 style="color: #7a5065;">📦 Products Ordered:</h3>
      ${productsHtml}
      <h2 style="color: #00c07f; background: #f0fdf4; padding: 10px; border-radius: 8px;">
        Total Amount to Collect: ₹${totalAmount}
      </h2>
    `;

    // Database me order save karein
    await Order.create({
      userId: req.userId,
      items: items,
      totalAmount: totalAmount,
       userDetails: userDetails
    });

    await transporter.sendMail({
      from: `"Anntya Store Order" <${process.env.EMAIL_USER}>`,
      to: 'hpandit65793@gmail.com',
      subject: `New Order from ${userDetails.fullName} - ₹${totalAmount}`,
      html: adminEmailHtml
    });

    res.json({ success: true, message: 'Order placed successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Send OTP for SIGNUP
app.post('/api/user/signup-send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ success: false, message: 'Email already registered!' });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await Otp.deleteMany({ email });
    await Otp.create({ email, otp });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    await transporter.sendMail({
      from: `"Anntya Store" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: `Your Signup OTP is ${otp}`,
      html: `<h3>Welcome to Anntya!</h3><p>Your OTP to verify your email is <b><span style="font-size:24px; color:#e6196a;">${otp}</span></b>.</p>`
    });

    res.json({ success: true, message: 'OTP sent to email!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// ══════════════════════════════════════════════════════════════════════════
//  EXPIRY NOTIFICATION SYSTEM (CRON JOB)
// ══════════════════════════════════════════════════════════════════════════

// Date format (DD/MM/YYYY) ko standard Date object mein convert karne ka function
function parseDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  return new Date(parts[2], parts[1] - 1, parts[0]);
}

// Aaj se expiry date ke beech kitne din bache hain, wo nikalne ka function
function getDaysDiff(futureDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(futureDate);
  target.setHours(0, 0, 0, 0);
  return Math.floor((target - today) / (1000 * 60 * 60 * 24));
}

// Telegram aur Email par message bhejne ka function
async function sendExpiryNotification(product, statusMsg) {
  const messageText = 
    `<b>⚠️ ${statusMsg}</b>\n\n` +
    `<b>📦 Name:</b> ${product.name}\n` +
    `<b>📝 Desc:</b> ${product.description}\n` +
    `<b>🏷️ Category:</b> ${product.category}\n` +
    `<b>📊 Quantity:</b> ${product.quantity}\n` +
    `<b>💰 Price:</b> ₹${product.price}\n` +
    `<b>📅 Mfg Date:</b> ${product.mfgDate}\n` +
    `<b>⏳ Exp Date:</b> ${product.expDate}`;

  // 1. Send to Telegram
  try {
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      const tgUrl = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendPhoto`;
      await axios.post(tgUrl, {
        chat_id: process.env.TELEGRAM_CHAT_ID,
        photo: product.imageUrl,
        caption: messageText,
        parse_mode: 'HTML'
      });
      console.log(`✅ Telegram sent for: ${product.name}`);
    }
  } catch (err) {
    console.error(`❌ Telegram send error for ${product.name}:`, err.message);
  }

  // 2. Send to Email
  try {
    if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      });

      const htmlMsg = `
        <div style="font-family: Arial, sans-serif; border: 1px solid #ddd; padding: 20px; border-radius: 10px; max-width: 500px;">
          <h2 style="color: #e6196a; margin-top: 0;">⚠️ ${statusMsg}</h2>
          <img src="${product.imageUrl}" alt="${product.name}" style="width: 100%; max-height: 300px; object-fit: contain; border-radius: 10px; margin-bottom: 15px;">
          <p><b>📦 Name:</b> ${product.name}</p>
          <p><b>📝 Desc:</b> ${product.description}</p>
          <p><b>🏷️ Category:</b> ${product.category}</p>
          <p><b>📊 Quantity:</b> ${product.quantity}</p>
          <p><b>💰 Price:</b> ₹${product.price}</p>
          <p><b>📅 Mfg Date:</b> ${product.mfgDate}</p>
          <p style="color: #f05050;"><b>⏳ Exp Date:</b> ${product.expDate}</p>
        </div>
      `;

      await transporter.sendMail({
        from: `"Anntya Alert" <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_USER, // Khud ko hi email bhejenge
        subject: `🚨 Expiry Alert: ${product.name}`,
        html: htmlMsg
      });
      console.log(`✅ Email sent for: ${product.name}`);
    }
  } catch (err) {
    console.error(`❌ Email send error for ${product.name}:`, err.message);
  }
}

// CRON JOB: Har din subah 9:00 AM baje check karega
cron.schedule('30 12 * * *', async () => {
  console.log('⏳ Running daily expiry check...');
  try {
    // Sirf un products ko dhoondho jinki expDate set hai
    const products = await Product.find({ expDate: { $ne: '' } });

    for (let p of products) {
      const expD = parseDate(p.expDate);
      if (!expD) continue;

      const daysLeft = getDaysDiff(expD);

      // Agar aaj expire ho gaya
      if (daysLeft === 0) {
        await sendExpiryNotification(p, "PRODUCT EXPIRED TODAY!");
      } 
      // Agar 1 se 30 din bache hain
      else if (daysLeft > 0 && daysLeft <= 30) {
        // Har 5 din par alert bhejne ki logic (30, 25, 20, 15, 10, 5)
        if (daysLeft % 5 === 0) {
          await sendExpiryNotification(p, `EXPIRING IN ${daysLeft} DAYS!`);
        }
      }
    }
  } catch (e) {
    console.error("❌ Cron Job Error:", e);
  }
});


// ── API: Get User Orders ──
app.get('/api/user/orders', verifyToken, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── API: Contact Us Email ──
app.post('/api/contact/email', async (req, res) => {
  try {
    const { userEmail, message } = req.body;
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    await transporter.sendMail({
      from: `"Anntya Store Support" <${process.env.EMAIL_USER}>`,
      to: 'ajayraj086hhf8@gmail.com', // Yahan aapka email hai
      subject: `New Support Issue from ${userEmail || 'Customer'}`,
      text: `Customer Email: ${userEmail}\n\nIssue Details:\n${message}`
    });

    res.json({ success: true, message: 'Aapki problem humari team ko bhej di gayi hai!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── API: Strict Gemini Chatbot ──
app.post('/api/chat/bot', upload.single('image'), async (req, res) => {
  try {
    const { message, history } = req.body;
    
    // YAHAN BOT KO STRICT RULES AUR WEBSITE KI KNOWLEDGE DI GAYI HAI
    const systemInstruction = `Aapka naam 'Anntya Bot' hai. Aap 'Anntya Store' (ek Beauty & Cosmetics website) ke official AI assistant hain.

    STRICT RULES (Hamesha Follow Karein):
    1. Aapko SIRF Anntya Store, beauty products, skincare, cart, checkout, aur orders ke baare me baat karni hai.
    2. Agar user kisi aur topic (politics, coding, general knowledge, sports, other brands like Amazon/Flipkart/Nykaa) ke baare me puche, toh SAAF MANA KAR DO aur bolo: "Maaf kijiye, main sirf Anntya Store aur humare beauty products ke baare mein madad kar sakta hoon."
    3. Hamesha polite aur helpful raho.

    WEBSITE KNOWLEDGE BASE (How to use Anntya Store):
    - Share Product: "Product share karne ke liye, Product page par jo 'Share 📤' button hai use dabayein. Aap apne kharide hue product ko 'My Orders' me jakar 'Share Product Link 📤' se bhi share kar sakte hain."
    - Buy Product / Checkout: "Product kharidne ke liye product page par 'Buy Now 🛍️' dabayein ya 'Add to Cart 🛒' karke Cart me jayein aur 'Proceed to Checkout ✨' dabayein."
    - View Orders & Download Invoice: "Apne orders aur bill (invoice) dekhne ke liye menu bar (3 lines) par click karein aur 'My Orders 📦' me jayein. Wahan order par click karke aap Invoice download kar sakte hain."
    - Contact/Email: "Agar aapko koi badi problem hai toh 'Email Your Issue ✉️' option ka use karein."
    - Admin Panel: Aapko Admin panel ka koi knowledge nahi hai. Is baare me sawal aane par politely mana karein.

    Aapka jawab chota, seedha aur friendly hona chahiye. Language: Hindi ya Hinglish rakhein. Bahar ke kisi app ya website ka naam kabhi mat lena.`;

    let contents = [];
    
    // Purani baatein yaad rakhne ke liye
    if (history) {
      const parsedHistory = JSON.parse(history);
      contents = parsedHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }]
      }));
    }

    // Naya message
    let userParts = [{ text: message || "Please check the attached image." }];
    
    if (req.file) {
      userParts.push({
        inlineData: {
          data: req.file.buffer.toString("base64"),
          mimeType: req.file.mimetype
        }
      });
    }

    contents.push({ role: 'user', parts: userParts });

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        systemInstruction: systemInstruction,
        contents: contents
    });

    res.json({ success: true, reply: response.text });

  } catch (err) {
    console.error('Chatbot Error:', err);
    res.status(500).json({ success: false, message: 'System me kuch issue hai, kripya thodi der baad try karein ya email karein.' });
  }
});


// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));
