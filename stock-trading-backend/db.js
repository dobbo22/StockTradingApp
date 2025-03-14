const sql = require('mssql/msnodesqlv8');

const config = {
  driver: 'msnodesqlv8',
  connectionString: 'DSN=Aiert' // or 'DSN=Aiert;Database=YourDBName;'
};

async function connect() {
  try {
    await sql.connect(config);
    console.log('Connected via DSN!');
  } catch (err) {
    console.error('Connection error:', err);
  }
}

connect();

