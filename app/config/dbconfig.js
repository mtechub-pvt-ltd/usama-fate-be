const Pool = require('pg').Pool;
require('dotenv').config();
const fs = require('fs');

// console.log("Fate")
//const pool = new Pool({
  //host: process.env.HOST,
 // port: process.env.PORT,
  //user: process.env.USER,
//  password: process.env.PASSWORD,
  //database: process.env.DATABASE
//});

 const pool = new Pool({
   host: 'postgres-staging-projects.mtechub.com',
   port: 5432,
   user: 'fate_user',
   password: 'mtechub123',
   database: 'fate_db'
 });

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

pool.connect((err, client, release) => {
  if (err) {
    console.error('Error connecting to database:', err);
  } else {
    console.log('Connected to database successfully');

    release();
  }
});

const initSql = fs.readFileSync("app/models/init.sql").toString();

pool.query(initSql, (err, result) => {
  if (!err) {
    console.log("All Database tables Initialized successfully.");
  } else {
    console.error("Error occurred while initializing Database tables:");
    console.error(err);
  }
});

module.exports = pool; 
