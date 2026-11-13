import postgres from 'postgres';
const sql = postgres(process.env.DATABASE_URL,{max:1,onnotice:()=>{}});
const p = await sql`select name, price, badge, sold_count from products order by sold_count desc limit 5`;
const b = await sql`select name from brands`;
const home = await sql`select key,type,title from homepage_sections order by position limit 6`;
console.log(p); console.log(b.map(x=>x.name).join(', ')); console.log(home.map(h=>h.key+':'+h.title).join(' | '));
await sql.end();
