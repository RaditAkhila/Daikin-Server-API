const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

//const {connectDB} = require('./database/db');
//const routes = require('./route/route');

const multer = require('multer')
const sharp = require('sharp')
const crypto = require('crypto')

const { PrismaClient } = require('@prisma/client')

const { uploadFile, deleteFile, getObjectSignedUrl } = require('./s3.js');

//connectDB();
const app = express();
const prisma = new PrismaClient()

const storage = multer.memoryStorage()
const upload = multer({ storage: storage })

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

app.post('/registerAkun', upload.none(), async (req, res) => {
  try {
    const { fullName, name, password } = req.body;

    // Validasi input
    if (!fullName || !name || !password) {
      return res.status(400).send({ message: 'Semua data harus diisi!' });
    }

    // Simpan data ke database
    const post = await prisma.akun_daikin.create({
      data: {
        fullname: fullName, // Primary key
        name: name,
        password: password,
      },
    });

    res.status(201).send({
      message: 'Data berhasil dikirim!',
      dbData: post,
    });
  } catch (error) {
    console.error(error);

    if (error.code === 'P2002') {
      // Error P2002: Duplikat nilai unik (misalnya, jika `fullName` sudah ada)
      res.status(409).send({ message: 'Full name sudah digunakan!' });
    } else {
      res.status(500).send({ message: 'Terjadi kesalahan pada server.' });
    }
  }
});

app.post('/loginAkun', upload.none(), async (req, res) => {
  const { fullName, password } = req.body;

  try {
    // Cari data akun berdasarkan fullName
    const user = await prisma.akun_daikin.findUnique({
      where: {
        fullname: fullName,
      },
    });

    // Periksa apakah user ditemukan
    if (!user) {
      return res.status(404).send({
        message: 'Akun tidak ditemukan!',
      });
    }

    // Periksa apakah password cocok
    if (user.password !== password) {
      return res.status(401).send({
        message: 'Password salah!',
      });
    }

    // Jika berhasil login
    res.status(200).send({
      message: 'Login berhasil!',
      user: {
        fullName: user.fullname,
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

app.post('/api/posts', upload.single('image'), async (req, res) => {
    let {photo, lat, lng} = req.body;

    // Mengonversi lat dan lng ke tipe number
    lat = parseFloat(lat);
    lng = parseFloat(lng);

    // Ambil file dari URI menggunakan fetch
    const response = await fetch(photo);
    const blob = await response.blob(); // Mengubah ke blob (binary file)

    const imageName = `image-${Date.now()}.jpg`;

    // Buat buffer dari blob (untuk diunggah ke S3)
    const arrayBuffer = await blob.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const s3_post = await uploadFile(fileBuffer, imageName, blob.type)

    const post = await prisma.absen_daikin.create({
      data: {
        photo: imageName,
        lat: lat,
        lng: lng
      }
    })

    res.status(201).send({
      message: 'Data berhasil dikirim!',
      s3Data: s3_post,  // Data dari S3
      dbData: post,     // Data yang disimpan di database
    });
})



  //app.use("/", routes);

  app.use((err, req, res, next) => {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    });

  app.listen(process.env.PORT || 5500, '0.0.0.0', () => {
      console.log(`Server Started on PORT ${process.env.PORT || 5500}`);
    });
