require('dotenv').config();
const { Pool } = require('pg');

const db = new Pool({
    user: "raditdb_owner",
    host: "ep-withered-mouse-a16a68e6.ap-southeast-1.aws.neon.tech",
    database: "radit_8",
    password: "sjCFz3eLy5Nl",
    port: "5432",
    ssl: { rejectUnauthorized: false }
});

const connectDB = async () => {
    try {
        await db.connect();
        console.log("Database berhasil terkoneksi");
    } catch (err) {
        console.error("Database gagal terkoneksi: " + err.message);
    }
};

module.exports = { connectDB, db };
