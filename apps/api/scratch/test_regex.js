require('dotenv').config({ path: 'd:/PJ_Workshop/Shop-Voucher/.env' });
require('dotenv').config({ path: 'd:/PJ_Workshop/Shop-Voucher/apps/api/.env' });
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DIRECT_URL });

async function main() {
  const res = await pool.query(`SELECT 'pizza 4p''s' ~ '\\y4p\\y' AS match1, 'pizza 4p''s' ~ '\\ypizza\\y' AS match2, 'thoi trang' ~ '\\ytra\\y' AS match3, 'smile beauty' ~ '\\ymi\\y' AS match4`);
  console.log(res.rows[0]);
}
main().catch(console.error).finally(() => pool.end());
