const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

//const {connectDB} = require('./database/db');
//const routes = require('./route/route');

const multer = require('multer')
const sharp = require('sharp')
const crypto = require('crypto')
const cloudinary = require('cloudinary').v2;

const { PrismaClient } = require('@prisma/client')

const { uploadFile, deleteFile, getObjectSignedUrl } = require('./s3.js');

//connectDB();
const app = express();
const prisma = new PrismaClient()

const storage = multer.memoryStorage()
const upload = multer({ storage: multer.memoryStorage() });

// Konfigurasi Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET_KEY
});

const generateFileName = (bytes = 32) => crypto.randomBytes(bytes).toString('hex')

app.use(
    express.static(path.join(__dirname, 'public')),
    cors({
      origin: '*',
      credentials: true,
      exposedHeaders: ['set-cookie'],
      allowedHeaders: ['Content-Type', 'Authorization', 'set-cookie']
    })
  );

app.post('/loginAkun', upload.none(), async (req, res) => {
  const { name, gpm_id } = req.body;

  try {
    // Cari data akun berdasarkan fullName
    const user = await prisma.akun_daikin.findUnique({
      where: {
        gpm_id: gpm_id,
      },
    });

    // Periksa apakah user ditemukan
    if (!user) {
      return res.status(404).send({
        message: 'Akun tidak ditemukan!',
      });
    }

    // Periksa apakah password cocok
    if (user.name !== name) {
      return res.status(401).send({
        message: 'Nama salah!',
      });
    }

    // Jika berhasil login
    res.status(200).send({
      message: 'Login berhasil!',
      user: {
        name: user.name,
      },
    });

  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).send({
      message: 'Terjadi kesalahan pada server.',
    });
  }
});

const uploadToCloudinary = (fileBuffer, imageName) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { public_id: imageName, format: 'jpg' }, // Opsi Cloudinary
      (error, result) => {
        if (error) {
          return reject(error); // Jika error, reject Promise
        }
        resolve(result); // Jika berhasil, resolve Promise dengan hasil upload
      }
    );
    uploadStream.end(fileBuffer); // Kirimkan buffer file ke stream
  });
};


app.post('/api/posts', upload.single('image'), async (req, res) => {
  try {
    const { gpm_id, latitude, longitude } = req.body;
    console.log('Checkpoint 1');
    const file = req.file;
    console.log('File diterima:', file);
    if (!file) {
      return res.status(400).send({ message: 'File tidak ditemukan!' });
    }

    // Mendapatkan waktu dalam format biasa
    const now = new Date();
    const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; // Format: YYYY-MM-DD
    const formattedTime = `${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`; // Format: HH-MM-SS

    // Membuat imageName menggunakan gpm_id dan waktu
    const imageName = `${gpm_id}-${formattedDate}-${formattedTime}`;

  /*  const result = await cloudinary.uploader.upload(file.buffer, {
      public_id: imageName, // Nama file yang diinginkan
      format: 'jpg'             // Konversi ke JPG
    }); */

    // Unggah ke Cloudinary
    const result = await uploadToCloudinary(req.file.buffer, imageName);

    const photo_url = result.secure_url;
    console.log('URL photo: ', photo_url);

    // Simpan informasi ke database absen
    const post_absen = await prisma.absen_daikin.create({
      data: {
        gpm_id: gpm_id,
        photo: photo_url,
      },
    });

    // Simpan informasi ke database absen
    const post_lokasi = await prisma.lokasi_daikin.create({
      data: {
        gpm_id: gpm_id,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
      },
    });

    res.status(201).send({
      message: 'Data berhasil dikirim!',
      cloudinaryData: result, // Data dari S3
      dbAbsen: post_absen,    // Data yang disimpan di database absen
      dbLokasi: post_lokasi,    // Data yang disimpan di database lokasi
    });
  } catch (error) {
    console.error('Error pada server:', error);
    res.status(500).send({ message: 'Terjadi kesalahan pada server.' });
  }
});



  //app.use("/", routes);

  app.use((err, req, res, next) => {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    });

  app.listen(process.env.PORT || 5500, '0.0.0.0', () => {
      console.log(`Server Started on PORT ${process.env.PORT || 5500}`);
    });
