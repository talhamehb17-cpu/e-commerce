import { AwsClient } from 'aws4fetch';
const endpoint = process.env.AWS_ENDPOINT_URL_S3;
const client = new AwsClient({ accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY, region: process.env.AWS_REGION, service: 's3' });
const url = `${endpoint}/${process.env.S3_BUCKET}/test/ping.txt`;
try {
  const res = await client.fetch(url, { method: 'PUT', body: 'hello aurelle', headers: { 'content-type': 'text/plain' } });
  console.log('PUT', res.status, (await res.text()).slice(0,300));
  const g = await client.fetch(url);
  console.log('GET', g.status, await g.text());
} catch (e) { console.log('ERR', e.message, e.cause?.message); }
