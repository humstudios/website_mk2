// /functions/zz-ping.js — Simple function to confirm Functions are active
export async function onRequest() {
  return new Response("OK: Pages Functions are running", {
    status: 200,
    headers: { "content-type": "text/plain" }
  });
}
