/**
 * Sonic Journey - Node.js Server for Audio Processing
 * Handles bass track generation server-side for better performance
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { processAudioFile } from './audioProcessor.js';
import { generateJourney } from './journeyGenerator.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/flac', 'audio/aac', 'audio/ogg', 'audio/x-wav', 'audio/wave'];
    if (allowedTypes.includes(file.mimetype) || file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only audio files are allowed.'));
    }
  },
});

// Middleware
app.use(cors());
app.use(express.json());

// Error handling for multer
const handleUpload = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  upload.single('audio')(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({ error: 'File too large', message: 'Maximum file size is 500MB' });
        }
        return res.status(400).json({ error: 'Upload error', message: err.message });
      }
      return res.status(400).json({ error: 'Upload error', message: err.message });
    }
    next();
  });
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Generate journey endpoint
app.post('/api/generate-journey', async (req: express.Request, res: express.Response) => {
  const { prompt, duration } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  if (!duration || typeof duration !== 'number' || duration < 5 || duration > 180) {
    return res.status(400).json({ error: 'Duration must be between 5 and 180 minutes' });
  }

  console.log(`Generating journey: "${prompt}" (${duration} minutes)`);

  try {
    const journey = await generateJourney({ prompt, duration });
    
    console.log(`Journey generated: ${journey.name} with ${journey.phases.length} phases`);
    
    res.json({
      success: true,
      journey,
    });
  } catch (error) {
    console.error('Journey generation error:', error);
    res.status(500).json({
      error: 'Journey generation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Serve output files
const outputDir = path.join(__dirname, '../output');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}
app.use('/output', express.static(outputDir));

// Process audio endpoint
app.post('/api/process', handleUpload, async (req: express.Request, res: express.Response) => {
  const startTime = Date.now();
  
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file provided' });
  }

  const fileSizeMB = req.file.size / 1024 / 1024;
  console.log(`Processing file: ${req.file.originalname} (${fileSizeMB.toFixed(2)} MB)`);

  try {
    // Parse config from request body
    const config = req.body.config ? JSON.parse(req.body.config) : {};
    
    // Process the audio file
    const result = await processAudioFile(req.file.path, config, (progress) => {
      console.log(`Progress: ${progress.stage} - ${progress.progress.toFixed(1)}%`);
    });

    // Clean up uploaded file
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Error deleting temp file:', err);
    });

    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Processing complete in ${processingTime}s`);

    // For large files (>50MB output), save to disk and return URLs
    const outputSizeMB = result.bassBuffer.length / 1024 / 1024;
    
    if (outputSizeMB > 50) {
      // Save files to output directory
      const timestamp = Date.now();
      const bassFileName = `bass-${timestamp}.wav`;
      const mixedFileName = `mixed-${timestamp}.wav`;
      
      fs.writeFileSync(path.join(outputDir, bassFileName), result.bassBuffer);
      fs.writeFileSync(path.join(outputDir, mixedFileName), result.mixedBuffer);
      
      // Clean up old files (keep only last 10)
      const files = fs.readdirSync(outputDir)
        .filter(f => f.endsWith('.wav'))
        .map(f => ({ name: f, time: fs.statSync(path.join(outputDir, f)).mtime.getTime() }))
        .sort((a, b) => b.time - a.time);
      
      if (files.length > 10) {
        files.slice(10).forEach(f => {
          fs.unlinkSync(path.join(outputDir, f.name));
        });
      }
      
      console.log(`Large file - saved to disk: ${bassFileName}, ${mixedFileName}`);
      
      res.json({
        success: true,
        processingTime: parseFloat(processingTime),
        analysis: result.analysis,
        // Return URLs instead of base64 for large files
        bassAudioUrl: `/output/${bassFileName}`,
        mixedAudioUrl: `/output/${mixedFileName}`,
        format: 'wav',
        streamMode: true,
      });
    } else {
      // Small files - return as base64
      res.json({
        success: true,
        processingTime: parseFloat(processingTime),
        analysis: result.analysis,
        bassAudio: result.bassBuffer.toString('base64'),
        mixedAudio: result.mixedBuffer.toString('base64'),
        format: 'wav',
        streamMode: false,
      });
    }

  } catch (error) {
    console.error('Processing error:', error);
    
    // Clean up on error
    if (req.file?.path) {
      fs.unlink(req.file.path, () => {});
    }
    
    res.status(500).json({ 
      error: 'Audio processing failed', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🎵 Sonic Journey Server running on http://localhost:${PORT}`);
  console.log(`   POST /api/process - Upload and process audio`);
  console.log(`   POST /api/generate-journey - Generate journey from prompt`);
  console.log(`   GET /api/health - Health check`);
});
