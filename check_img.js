const https = require('https');
const sizeOf = require('image-size');

const url = "https://lh3.googleusercontent.com/aida-public/AB6AXuCKu0p1galUPP3WXC_ChaUN1-l0i0-xZudlDjE15HoEljMuql_cM20OQbd3oBxgeW6TSiVN5N4mk2kHHd7CV_QaKGjyVfR_W_ojtkgL-4_He6S29G_TW242tIZs2-rRllXQDnwaQRbx8T8yCUxvb1Ny9X34B8rQrD6rV9wdzpGftRdbCZgW0al23UerCpQ7U_9S14Ed8xqW0OZSEr0lYDCwGfpQw-Spq0QdeBDNJTOMsffdn9vsuxo21-gX-sqNYRpEIz5dlsDBxYk";

https.get(url, function(response) {
  const chunks = [];
  response.on('data', function (chunk) {
    chunks.push(chunk);
  });
  response.on('end', function () {
    const buffer = Buffer.concat(chunks);
    try {
        const dimensions = sizeOf(buffer);
        console.log(`Resolution: ${dimensions.width}x${dimensions.height}`);
        console.log(`Size: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
    } catch(err) {
        console.log("Could not determine size: " + err);
    }
  });
});
