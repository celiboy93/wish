import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req) => {
  const reqUrl = new URL(req.url);
  const targetUrl = reqUrl.searchParams.get("url");

  // ၁။ Link မပါရင် "Home Page (Generator UI)" ကို ပြမယ်
  if (!targetUrl) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>StreamWish Proxy Generator</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: sans-serif; padding: 20px; max-width: 600px; margin: 0 auto; background: #f4f4f9; }
          .card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
          h2 { text-align: center; color: #333; }
          input { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #ddd; border-radius: 8px; box-sizing: border-box; }
          button { width: 100%; padding: 12px; background: #28a745; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; font-weight: bold; }
          button:hover { background: #218838; }
          .result-box { margin-top: 20px; display: none; }
          textarea { width: 100%; height: 80px; padding: 10px; border-radius: 5px; border: 1px dashed #666; background: #e9ecef; font-family: monospace; }
          .note { font-size: 12px; color: #666; margin-top: 5px; text-align: center; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2>🚀 StreamWish Proxy Link</h2>
          <label>Paste 'hglink.to' or 'streamwish' link:</label>
          <input type="text" id="inputUrl" placeholder="https://hglink.to/e/xxxxxx">
          
          <button onclick="generate()">Generate Proxy Link 🔄</button>

          <div class="result-box" id="resultArea">
            <label>✅ Copy this link for APK:</label>
            <textarea id="outputLink" readonly></textarea>
            <p class="note">This link works WITHOUT VPN!</p>
            <button onclick="copy()" style="background:#007bff; margin-top:5px;">Copy Link</button>
          </div>
        </div>

        <script>
          function generate() {
            const input = document.getElementById('inputUrl').value.trim();
            if (!input) return alert("Please enter a link!");
            
            // Deno Link ကို ဖန်တီးခြင်း
            const currentDomain = window.location.origin;
            const finalLink = currentDomain + "/?url=" + input;
            
            document.getElementById('outputLink').value = finalLink;
            document.getElementById('resultArea').style.display = 'block';
          }

          function copy() {
            const copyText = document.getElementById("outputLink");
            copyText.select();
            document.execCommand("copy");
            alert("Copied to clipboard! 📋");
          }
        </script>
      </body>
      </html>
    `;
    return new Response(html, { headers: { "content-type": "text/html" } });
  }

  // ၂။ Link ပါလာရင် Proxy အလုပ်လုပ်မယ် (အရင်ကုဒ်အတိုင်း)
  try {
    // A. TS Segment / M3U8 Direct
    if (targetUrl.includes(".ts") || targetUrl.includes(".m3u8")) {
       const videoRes = await fetch(targetUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0.4472.124 Safari/537.36",
            "Referer": "https://streamwish.com/",
            "Origin": "https://streamwish.com/"
          }
       });
       
       if (targetUrl.includes(".m3u8")) {
         const text = await videoRes.text();
         const myDenoUrl = reqUrl.origin + "/?url=";
         
         const modifiedText = text.replace(/^(?!#)(.*)$/gm, (match) => {
            if (match.startsWith("http")) return myDenoUrl + encodeURIComponent(match);
            const baseUrl = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);
            return myDenoUrl + encodeURIComponent(baseUrl + match);
         });

         return new Response(modifiedText, {
            headers: { "Content-Type": "application/vnd.apple.mpegurl", "Access-Control-Allow-Origin": "*" }
         });
       }

       return new Response(videoRes.body, {
          status: videoRes.status,
          headers: videoRes.headers,
       });
    }

    // B. Embed Link Scraping (hglink.to)
    const embedRes = await fetch(targetUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/110.0.0.0 Safari/537.36" }
    });
    
    const html = await embedRes.text();
    const m3u8Regex = /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/;
    const match = html.match(m3u8Regex);

    if (match && match[1]) {
      const realM3u8 = match[1];
      const proxyLink = reqUrl.origin + "/?url=" + encodeURIComponent(realM3u8);
      return Response.redirect(proxyLink, 302);
    } else {
      return new Response("Error: Video Link not found via Proxy.", { status: 404 });
    }

  } catch (err) {
    return new Response("Server Error: " + err.message, { status: 500 });
  }
});
