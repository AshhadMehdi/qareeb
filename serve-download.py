"""Serve a source ZIP inside Arena's authenticated live preview."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import shutil
import subprocess
import sys

root = Path(__file__).resolve().parents[1]
archive = root.parent / 'qareeb.zip'
subprocess.run([sys.executable, str(root / 'scripts/package-download.py'), str(archive)], check=True)
PAGE = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Qareeb ZIP download</title><style>body{font:16px system-ui;background:#f3eee6;color:#1c1612;margin:0;min-height:100vh;display:grid;place-items:center}main{max-width:560px;margin:24px;padding:32px;background:white;border-radius:22px;box-shadow:0 8px 40px #1c161215}p{line-height:1.6}button,a{display:inline-block;background:#0d6b45;color:white;padding:15px 22px;border:0;border-radius:12px;font:700 16px system-ui;text-decoration:none;cursor:pointer}button:disabled{opacity:.5}textarea{width:100%;height:130px;box-sizing:border-box}details{margin-top:26px}code{overflow-wrap:anywhere}[hidden]{display:none!important}</style><main><h1>Download qareeb.zip</h1><p>Latest Qareeb source. Upload the inside of the qareeb folder to GitHub. Vercel will deploy by itself.</p><button id="prepare">1. Prepare ZIP</button><p id="status" role="status">Ready to load qareeb.zip.</p><a id="save" download="qareeb.zip" hidden>2. Save qareeb.zip</a><p>After extracting, open <strong>START-HERE.md</strong>.</p><details><summary>If Arena blocks browser downloads</summary><p>Prepare the ZIP first, then show its recovery text.</p><button id="recover" disabled>Show recovery text</button><div id="fallback" hidden><p>Click the text box, press Ctrl+A then Ctrl+C.</p><textarea id="encoded" readonly aria-label="Encoded ZIP"></textarea><p>Then paste this in Command Prompt:</p><code>powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; $t=[Windows.Forms.Clipboard]::GetText(); if ($t.Contains(',')) { $t=$t.Substring($t.LastIndexOf(',')+1) }; $t=$t -replace '\\s',''; [IO.File]::WriteAllBytes($env:USERPROFILE + '\\Downloads\\qareeb.zip',[Convert]::FromBase64String($t)); explorer ($env:USERPROFILE + '\\Downloads')"</code></div></details></main><script>
const prepare=document.getElementById('prepare'),save=document.getElementById('save'),status=document.getElementById('status'),recover=document.getElementById('recover');let zip,url;
prepare.onclick=async()=>{prepare.disabled=true;status.textContent='Loading qareeb.zip…';try{const r=await fetch('./qareeb.zip',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const data=await r.arrayBuffer(),bytes=new Uint8Array(data);if(bytes[0]!==80||bytes[1]!==75||bytes[2]!==3||bytes[3]!==4)throw Error('Response was not a ZIP');zip=new Blob([data],{type:'application/zip'});if(url)URL.revokeObjectURL(url);url=URL.createObjectURL(zip);save.href=url;save.hidden=false;recover.disabled=false;status.textContent='Ready. Click 2. Save qareeb.zip';}catch(e){status.textContent='Could not load ZIP: '+e.message+'. Refresh this preview and try again.';}finally{prepare.disabled=false;}};
save.onclick=()=>{status.textContent='Save requested. If no file appears, use the recovery option below.';};
recover.onclick=()=>{if(!zip)return;const r=new FileReader();r.onload=()=>{document.getElementById('encoded').value=String(r.result).split(',')[1];document.getElementById('fallback').hidden=false;document.getElementById('encoded').focus();document.getElementById('encoded').select();};r.readAsDataURL(zip);};
</script></html>'''.encode()

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        route = urlsplit(self.path).path
        if route == '/':
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(len(PAGE)))
            self.end_headers()
            self.wfile.write(PAGE)
        elif route == '/qareeb.zip':
            self.send_response(200)
            self.send_header('Content-Type', 'application/zip')
            self.send_header('Content-Disposition', 'attachment; filename="qareeb.zip"')
            self.send_header('Cache-Control', 'no-store')
            self.send_header('Content-Length', str(archive.stat().st_size))
            self.end_headers()
            with archive.open('rb') as source:
                shutil.copyfileobj(source, self.wfile)
        else:
            self.send_error(404)

print('Qareeb ZIP download listening on port 8088', flush=True)
ThreadingHTTPServer(('0.0.0.0', 8088), Handler).serve_forever()
