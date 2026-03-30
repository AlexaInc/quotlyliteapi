import gradio as gr
import asyncio
import io
import os
import re
import json
import base64
import requests
from PIL import Image
from playwright.async_api import async_playwright

# --- RENDERING CONSTANTS ---
SCALE = 4.5
PP_SIZE = 38 * SCALE
NAME_FS = 16 * SCALE
MSG_FS = 16 * SCALE
MSG_IN = '#111112'

# --- HELPERS ---
def get_telegram_color(user_id):
    colors = ['#FF516A', '#FF9442', '#C66FFF', '#50D892', '#64D4F5', '#5095ED', '#FF66A6', '#FF8280', '#EDD64E', '#C66FFF']
    try:
        idx = int(user_id) % 10 if user_id and str(user_id).isdigit() else 0
    except:
        idx = 0
    return colors[idx]

def to_apple_emoji_url(emoji):
    codepoints = [f"{ord(c):x}" for c in emoji]
    cp_str = "-".join(codepoints)
    if '200d' not in cp_str:
        cp_str = cp_str.replace('-fe0f', '')
    return f"https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/{cp_str}.png"

def escape_html(text):
    return text.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;').replace("'", '&apos;')

# --- CACHING & EMOJI ---
EMOJI_CACHE = {}
BOT_TOKEN = os.getenv("BOT_TOKEN", "")

def get_premium_emoji_b64(emoji_id):
    """Downloads and converts premium stickers/emojis from Telegram."""
    if emoji_id in EMOJI_CACHE:
        return EMOJI_CACHE[emoji_id]
    
    if not BOT_TOKEN:
        return None
        
    try:
        # Step 1: Get File ID
        url1 = f"https://api.telegram.org/bot{BOT_TOKEN}/getCustomEmojiStickers"
        r1 = requests.post(url1, json={"custom_emoji_ids": [emoji_id]}).json()
        sticker = r1.get('result', [{}])[0]
        if not sticker: return None
        
        # Step 2: Get File Path
        file_id = sticker.get('thumbnail', {}).get('file_id') or sticker.get('file_id')
        url2 = f"https://api.telegram.org/bot{BOT_TOKEN}/getFile"
        r2 = requests.post(url2, json={"file_id": file_id}).json()
        file_path = r2.get('result', {}).get('file_path')
        if not file_path: return None
        
        # Step 3: Download and Process
        url3 = f"https://api.telegram.org/file/bot{BOT_TOKEN}/{file_path}"
        raw = requests.get(url3).content
        
        img = Image.open(io.BytesIO(raw))
        img = img.resize((128, 128), Image.Resampling.LANCZOS)
        
        buffered = io.BytesIO()
        img.save(buffered, format="PNG")
        b64 = "data:image/png;base64," + base64.b64encode(buffered.getvalue()).decode()
        
        EMOJI_CACHE[emoji_id] = b64
        return b64
    except Exception as e:
        print(f"⚠️ Emoji download failed: {str(e)}")
        return None

def msg_to_html(text, entities=None):
    if not text: return ""
    if not entities: return escape_html(text).replace('\n', '<br/>')
    
    sorted_tags = []
    for e in entities:
        sorted_tags.append({'pos': e['offset'], 'type': 'open', 'info': e})
        sorted_tags.append({'pos': e['offset'] + e['length'], 'type': 'close', 'info': e})
    
    sorted_tags = sorted(sorted_tags, key=lambda x: (x['pos'], 0 if x['type'] == 'close' else 1))
    
    html = ""
    cursor = 0
    for i, t in enumerate(sorted_tags):
        if t['pos'] > cursor:
            html += escape_html(text[cursor:t['pos']])
            cursor = t['pos']
            
        e = t['info']
        if t['type'] == 'open':
            if e['type'] == 'bold': html += '<b>'
            elif e['type'] == 'italic': html += '<i>'
            elif e['type'] == 'underline': html += '<u>'
            elif e['type'] == 'strikethrough': html += '<s>'
            elif e['type'] == 'code': html += '<code class="mono">'
            elif e['type'] == 'pre': html += '<pre>'
            elif e['type'] == 'spoiler': html += '<span class="spoiler">'
            elif e['type'] == 'blockquote': html += '<span class="blockquote">'
            elif e['type'] == 'custom_emoji':
                b64 = get_premium_emoji_b64(e['custom_emoji_id'])
                if b64: html += f'<img src="{b64}" class="msg-emoji"/>'
                # Skip the text that would have been here
                cursor = e['offset'] + e['length']
                # Skip the closing tag for this custom emoji
                # We do this by filtering or just check in loop
        else:
            # Check if this is a closing tag for an entity we already handled or want to close
            if e['type'] == 'bold': html += '</b>'
            elif e['type'] == 'italic': html += '</i>'
            elif e['type'] == 'underline': html += '</u>'
            elif e['type'] == 'strikethrough': html += '</s>'
            elif e['type'] == 'code': html += '</code>'
            elif e['type'] == 'pre': html += '</pre>'
            elif e['type'] == 'spoiler': html += '</span>'
            elif e['type'] == 'blockquote': html += '</span>'
            
    html += escape_html(text[cursor:])
    return html.replace('\n', '<br/>')

# --- RENDERER CLASS ---
class PremiumQuoter:
    def __init__(self):
        self.playwright = None
        self.browser = None

    async def start(self):
        self.playwright = await async_playwright().start()
        self.browser = await self.playwright.chromium.launch(
            headless=True,
            args=['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
        )

    async def render_sticker(self, messages):
        if not self.browser:
            await self.start()
            
        page = await self.browser.new_page(viewport={'width': 3000, 'height': 3000})
        
        # Profile Data Processing
        rows = []
        for i, m in enumerate(messages):
            user_id = m.get('id', m.get('firstName', 'User'))
            color = get_telegram_color(user_id)
            
            # Grouping Logic
            prev = messages[i-1] if i > 0 else None
            next_m = messages[i+1] if i < len(messages)-1 else None
            
            same_prev = prev and prev.get('id') == user_id
            same_next = next_m and next_m.get('id') == user_id
            
            group_class = 'single-message'
            if same_prev and same_next: group_class = 'middle-in-group'
            elif same_prev: group_class = 'last-in-group'
            elif same_next: group_class = 'first-in-group'

            msg_html = msg_to_html(m.get('message', ''), m.get('entities', []))
            
            rows.append({
                **m,
                'color': color,
                'msg_html': msg_html,
                'group_class': group_class,
                'show_pp': not same_next,
                'show_name': not same_prev
            })

        # --- HTML Generator ---
        css = f"""
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=JetBrains+Mono&display=swap');
        :root {{ --r: {20 * SCALE}px; --rs: {5 * SCALE}px; }}
        body {{ font-family: 'Inter', sans-serif; background: transparent; -webkit-font-smoothing: antialiased; margin: 0; padding: 0; }}
        #wrap {{ display: inline-flex; flex-direction: column; padding: {40 * SCALE}px; background: transparent; }}
        .bubble-container {{ display: flex; align-items: flex-end; position: relative; margin: {10 * SCALE}px; gap: {10 * SCALE}px; }}
        .pp {{ width: {PP_SIZE}px; height: {PP_SIZE}px; border-radius: 50%; background: #222; background-size: cover; flex-shrink: 0; }}
        .pp.hidden {{ opacity: 0; }}
        .bubble {{ position: relative; padding: {12 * SCALE}px {24 * SCALE}px; background: {MSG_IN}; color: white; border-radius: var(--r); max-width: {450 * SCALE}px; line-height: 1.48; font-size: {MSG_FS}px; }}
        .first-in-group .bubble {{ border-bottom-left-radius: var(--rs); }}
        .middle-in-group .bubble {{ border-top-left-radius: var(--rs); border-bottom-left-radius: var(--rs); }}
        .last-in-group .bubble, .single-message .bubble {{ border-top-left-radius: var(--rs); border-bottom-left-radius: 0; }}
        .last-in-group .bubble::before, .single-message .bubble::before {{
            content: ""; position: absolute; bottom: 0; left: -{8 * SCALE}px; width: 0; height: 0;
            border-style: solid; border-width: 0 0 {10 * SCALE}px {8 * SCALE}px; border-color: transparent transparent {MSG_IN} transparent;
        }}
        .name {{ font-weight: 600; font-size: {NAME_FS}px; margin-bottom: {4 * SCALE}px; }}
        .mono {{ font-family: 'JetBrains Mono', monospace; background: rgba(255,255,255,0.1); padding: 0.1em 0.3em; border-radius: 4px; }}
        .spoiler {{ background: rgba(255,255,255,0.15); color: transparent; filter: blur(5px); border-radius: 4px; }}
        .blockquote {{ border-left: 3px solid #64b5f6; padding-left: 10px; margin: 4px 0; display: block; color: #7f91a4; font-style: italic; }}
        """

        html_body = ""
        for r in rows:
            name_div = f'<div class="name" style="color:{r["color"]}">{escape_html(r["firstName"])}</div>' if r["show_name"] else ""
            pp_class = "pp" if r["show_pp"] else "pp hidden"
            avatar_url = r.get('avatarBase64', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIA7vOOfwAAAABJRU5ErkJggg==')
            
            html_body += f"""
            <div class="bubble-container {r['group_class']}">
                <div class="{pp_class}" style="background-image:url({avatar_url})"></div>
                <div class="bubble">
                    {name_div}
                    <div class="content">{r['msg_html']}</div>
                </div>
            </div>
            """

        full_html = f"<html><head><style>{css}</style></head><body><div id='wrap'>{html_body}</div></body></html>"
        
        await page.set_content(full_html, wait_until="networkidle")
        element = await page.query_selector("#wrap")
        buffer = await element.screenshot(omit_background=True)
        await page.close()
        
        # Sharp equivalent: Crop/Trim
        img = Image.open(io.BytesIO(buffer))
        output = io.BytesIO()
        img.save(output, format="WEBP", quality=100, lossless=True)
        return output.getvalue()

# --- GRADIO INTERFACE ---
engine = PremiumQuoter()

async def generate(first_name, last_name, message, color_id, avatar):
    avatar_b64 = None
    if avatar:
        buffered = io.BytesIO()
        # Handle numpy or PIL image
        if hasattr(avatar, 'save'): 
            avatar.save(buffered, format="PNG")
        else:
            Image.fromarray(avatar).save(buffered, format="PNG")
        avatar_b64 = "data:image/png;base64," + base64.b64encode(buffered.getvalue()).decode()

    msgs = [{
        "firstName": first_name,
        "lastName": last_name,
        "message": message,
        "id": "user1",
        "avatarBase64": avatar_b64
    }]
    
    return await engine.render_sticker(msgs)

def run_generate(*args):
    return asyncio.run(generate(*args))

with gr.Blocks(theme=gr.themes.Default(primary_hue="blue"), title="Python Quoter Engine 🐍") as demo:
    gr.Markdown("# Premium Python Quoter Engine 🐍")
    gr.Markdown("Re-engineered from Node.js to pure Python & Playwright.")
    
    with gr.Row():
        with gr.Column():
            avatar = gr.Image(label="Profile Photo")
            f_name = gr.Textbox(label="First Name", value="Python")
            l_name = gr.Textbox(label="Last Name", value="User")
            msg = gr.TextArea(label="Message", value="Now running purely on Python! 🔥", lines=4)
            btn = gr.Button("Generate Premium Sticker", variant="primary")
        with gr.Column():
            output = gr.Image(label="Result", type="value")

    btn.click(fn=run_generate, inputs=[f_name, l_name, msg, gr.State(0), avatar], outputs=output)

if __name__ == "__main__":
    # Ensure Playwright browser is installed for the Gradio SDK
    try:
        print("🛠️  Checking Playwright Chromium...")
        os.system("playwright install chromium")
    except Exception as e:
        print(f"⚠️  Playwright install failed: {e}")

    if not BOT_TOKEN:
        print("\n" + "!" * 50)
        print("⚠️  WARNING: BOT_TOKEN is not set in environment variables.")
        print("ℹ️  Premium emoji downloading will NOT work.")
        print("!" * 50 + "\n")
    
    demo.launch(server_name="0.0.0.0", server_port=7860)
