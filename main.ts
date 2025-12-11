import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

serve(async (req) => {
  const reqUrl = new URL(req.url);
  const urlParam = reqUrl.searchParams.get("url");

  // ၁။ UI - Link Generator
  if (!urlParam) {
     const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>HgLink/StreamWish Unblocker</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: sans-serif; padding: 20px; background: #111; color: white; text-align: center; }
          input { width: 90%; padding: 12px; border-radius: 5px; border: none; margin-bottom: 10px; }
          button { padding: 12px 20px; background: #e50914; color: white; border: none; border-radius: 5px; font-weight: bold; }
          textarea { width: 90%; height: 100px; margin-top: 20px; background: #222; color: #0f0; border: 1px solid #444; }
        </style>
      </head>
      <body>
        <h3>🚀 StreamWish/HgLink Proxy</h3>
        <input type="text" id="inputUrl" placeholder="Paste link here (e.g., https://hglink.to/e/xxxx)">
        <br>
        <button onclick="generate()">Generate APK Link</button>
        <div id="result" style="display:none;">
          <p>👇 Copy this link for your APK:</p>
          <textarea id="output"></textarea>
          <p style="color:yellow; font-size:12px;">No VPN Needed!</p>
        </div>
        <script>
          function generate() {
            const raw = document.getElementById('inputUrl').value.trim();
            if(!raw) return alert("Link ထည့်ပါ!");
            const final = window.location.origin + "/?url=" + raw;
            document.getElementById('output').value = final;
            document.getElementById('result').style.display = 'block';
          }
        </script>
      </body>
      </html>
    `;
    return new Response(html, { headers: { "content-type": "text/html" } });
  }

  // ၂။ Proxy Engine Start
  try {
    let targetUrl = urlParam;

    // 🔥 HGLINK ဖြစ်နေရင် StreamWish ID ကို ဆွဲထုတ်ပြီး URL အစစ်ပြောင်းမယ်
    // (ဒါမှ အခွံကို ကျော်ပြီး Video ဆီ တန်းရောက်မှာပါ)
    if (targetUrl.includes("hglink.to")) {
        // ID ကို ယူမယ် (ဥပမာ: 3p4kyioul8pg)
        const idMatch = targetUrl.match(/\/e\/([a-zA-Z0-9]+)/);
        if (idMatch && idMatch[1]) {
            // StreamWish Embed Link အစစ်ကို ပြောင်းမယ်
            targetUrl = `https://streamwish.com/e/${idMatch[1]}`; 
        }
    }

    // A. အကယ်၍ M3U8 ဖိုင် (သို့) TS ဖိုင် ဖြစ်နေရင် Proxy လုပ်ပေးမယ်
    if (targetUrl.includes(".m3u8") || targetUrl.includes(".ts")) {
        const videoRes = await fetch(targetUrl, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/100.0.0.0 Safari/537.36",
                "Referer": "https://streamwish.com/",
                "Origin": "https://streamwish.com/"
            }
        });

        if (targetUrl.includes(".m3u8")) {
            const text = await videoRes.text();
            const myDomain = reqUrl.origin + "/?url=";
            // M3U8 ထဲက လင့်ခ်တွေကို Deno Proxy ဆီ လမ်းကြောင်းလွှဲမယ်
            const fixedText = text.replace(/^(?!#)(.*)$/gm, (m) => {
                if (m.startsWith("http")) return myDomain + encodeURIComponent(m);
                return myDomain + encodeURIComponent(targetUrl.substring(0, targetUrl.lastIndexOf('/')+1) + m);
            });
            return new Response(fixedText, { 
                headers: { "Content-Type": "application/vnd.apple.mpegurl", "Access-Control-Allow-Origin": "*" } 
            });
        }
        return new Response(videoRes.body, { headers: videoRes.headers });
    }

    // B. Website (Embed Page) ဖြစ်နေရင် HTML ထဲက M3U8 ကို ရှာမယ်
    const pageRes = await fetch(targetUrl, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/100.0.0.0 Safari/537.36",
            "Referer": "https://hglink.to/" // Referer လိမ်ထည့်မယ်
        }
    });
    
    const html = await pageRes.text();

    // Regular Expression နဲ့ .m3u8 ကို ရှာမယ်
    const regex = /file\s*:\s*["']([^"']+\.m3u8[^"']*)["']/;
    const match = html.match(regex);

    if (match && match[1]) {
        // တွေ့ပြီ! M3U8 Link အစစ်ကို Deno Proxy နဲ့ ပြန်ထုတ်ပေးမယ်
        const realVideoLink = match[1];
        const finalProxyLink = reqUrl.origin + "/?url=" + encodeURIComponent(realVideoLink);
        
        // Player ဆီကို Redirect လုပ်ပေးလိုက်မယ် (Play တန်းဖြစ်သွားအောင်)
        return Response.redirect(finalProxyLink, 302);
    } else {
        // မတွေ့ရင် HTML ကို ပြန်ထုတ်ကြည့်မယ် (Debug ရအောင်)
        console.log("Failed HTML:", html.substring(0, 500)); // Logs မှာ ကြည့်ဖို့
        return new Response("❌ Error: StreamWish က Link ကို ဝှက်ထားပါတယ်။ (Packed JS Detected)", { status: 404 });
    }

  } catch (e) {
    return new Response("Server Error: " + e.message, { status: 500 });
  }
});
