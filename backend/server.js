import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import { spawn } from 'child_process';

const app = express();
const PORT = 4000;

// Setup __dirname manually (because you're using ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the frontend's public directory
const PUBLIC_DIR = path.resolve(__dirname, '../electrical-dashboard/public');

app.use(cors());
app.use(bodyParser.json());

// === API Routes ===

// Define storage and multer config
const upload = multer({ dest: path.join(__dirname, 'uploads/') });

// PDF Upload & Convert Endpoint
app.post('/api/upload', upload.single('pdf'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file uploaded' });
  }
  const pdfPath = req.file.path;
  const outputDir = PUBLIC_DIR;
  const pythonScript = path.resolve(__dirname, 'convert_pdf_to_png.py');
  const baseName = path.parse(req.file.originalname).name.replace(/\s+/g, '_');

  const py = spawn('python', [pythonScript, pdfPath, outputDir, baseName]);
  let error = '';
  py.stderr.on('data', (data) => { error += data.toString(); });
  py.on('close', (code) => {
    // Clean up the temp upload file
    try { fs.unlinkSync(pdfPath); } catch { }
    if (code === 0) {
      // List generated PNGs that match this upload
      const files = fs.readdirSync(outputDir)
        .filter(f => f.startsWith(baseName + '_page') && f.endsWith('.png'));
      // Ensure a components JSON exists for each image
      files.forEach(img => {
        const compJson = path.join(outputDir, `components_${path.parse(img).name}.json`);
        if (!fs.existsSync(compJson)) {
          fs.writeFileSync(compJson, '[]', 'utf-8');
        }
      });
      res.json({ images: files });
    } else {
      console.error('Python stderr:', error);
      res.status(500).json({ error: 'PDF conversion failed', details: error });
    }
  });
});

// Serve images and JSON from public directory with no-store cache headers
app.use('/images', express.static(PUBLIC_DIR, {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.png') || filePath.endsWith('.json')) {
      res.set('Cache-Control', 'no-store');
    }
  }
}));

// List PNGs in public (excluding CRA's built-in logos)
app.get('/api/images', (req, res) => {
  fs.readdir(PUBLIC_DIR, (err, files) => {
    if (err) return res.status(500).json({ error: 'Failed to list images' });
    const images = files.filter(
      f => f.endsWith('.png') && f !== 'logo192.png' && f !== 'logo512.png'
    );
    res.json(images);
  });
});

// Components endpoint (dynamic by image)
app.get('/api/components', (req, res) => {
  const image = req.query.image || 'page_1.png';
  const base = path.parse(image).name;
  const compPath = path.join(PUBLIC_DIR, `components_${base}.json`);
  fs.readFile(compPath, 'utf-8', (err, data) => {
    if (err) return res.json({ projectTitle: 'Untitled Project', components: [] });
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        res.json({ projectTitle: 'Untitled Project', components: parsed });
      } else {
        res.json(parsed);
      }
    } catch {
      res.status(500).json({ error: 'Invalid JSON' });
    }
  });
});

app.put('/api/components', (req, res) => {
  const image = req.query.image || 'page_1.png';
  const base = path.parse(image).name;
  const compPath = path.join(PUBLIC_DIR, `components_${base}.json`);
  let data = req.body;
  if (Array.isArray(data)) {
    data = { projectTitle: 'Untitled Project', components: data };
  }
  fs.writeFile(compPath, JSON.stringify(data, null, 2), 'utf-8', (err) => {
    if (err) return res.status(500).json({ error: 'Failed to write' });
    res.json({ success: true });
  });
});

// === Project Title Edit Endpoint ===
app.put('/api/project-title', async (req, res) => {
  try {
    const { image, title } = req.body;
    if (!image || typeof title !== 'string') {
      return res.status(400).json({ error: 'Missing image or title' });
    }
    const base = path.parse(image).name;
    const compPath = path.join(PUBLIC_DIR, `components_${base}.json`);
    let data;
    try {
      data = JSON.parse(await fs.promises.readFile(compPath, 'utf-8'));
    } catch {
      data = [];
    }
    const jsonToWrite = Array.isArray(data)
      ? { projectTitle: title, components: data }
      : { ...data, projectTitle: title };
    await fs.promises.writeFile(compPath, JSON.stringify(jsonToWrite, null, 2), 'utf-8');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update project title', details: err.message });
  }
});

// === Project Delete Endpoint ===
app.delete('/api/project', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) return res.status(400).json({ error: 'Missing image' });
    const base = path.parse(image).name;
    const imgPath = path.join(PUBLIC_DIR, image);
    const compPath = path.join(PUBLIC_DIR, `components_${base}.json`);
    try { await fs.promises.unlink(imgPath); } catch { }
    try { await fs.promises.unlink(compPath); } catch { }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete project', details: err.message });
  }
});

// === Serve React Frontend ===

const buildPath = path.resolve(__dirname, '../electrical-dashboard/build');
app.use(express.static(buildPath));

// Fallback to React index.html for non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(buildPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Backend + Frontend running at http://localhost:${PORT}`);
});
