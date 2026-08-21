import re

modules = [
    ('ct-matrix', '📺 MATRIX', 'MATRIX'),
    ('ct-ace', '🃏 ACE', 'ACE'),
    ('ct-mmr', '🥩 MMR', 'MMR'),
    ('ct-quiz', '🧠 QUIZ', 'QUIZ'),
    ('ct-wea1', '🌦 WEA1', 'WEA1'),
    ('ct-fir', '🔥 FIR', 'FIR'),
    ('ct-soc', '🤝 SOC', 'SOC'),
    ('ct-tik', '🎵 TIK', 'TIK'),
    ('ct-loyalty', '💳 LOYALTY', 'LOYALTY'),
]

html = ""
for id_lower, icon_name, raw_id in modules:
    html += f"""    <!-- {raw_id} -->
    <div class="mod-card" id="row-{id_lower}">
      <div class="mod-header">
        <div class="mod-name">{icon_name}</div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <label style="position:relative; width:44px; height:24px; cursor:pointer;">
             <input type="checkbox" class="mod-switch-cb" id="switch-{id_lower}" onchange="toggleModule('{raw_id}', this.checked)" style="opacity:0; width:0; height:0; position:absolute;">
             <div class="mod-switch-bg" style="position:absolute; inset:0; background:rgba(255,255,255,0.1); border-radius:24px; transition:0.3s; border: 1px solid rgba(255,255,255,0.1);">
                <div class="mod-switch-knob" style="position:absolute; top:1px; left:2px; width:20px; height:20px; background:#fff; border-radius:50%; transition:0.3s; box-shadow:0 1px 3px rgba(0,0,0,0.3);"></div>
             </div>
          </label>
          <button class="gear-btn" onclick="document.getElementById('settings-{id_lower}').classList.toggle('open')">⚙️</button>
        </div>
      </div>
      <div class="mod-settings" id="settings-{id_lower}">
         <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.05);">
            <label style="display:flex; align-items:center; gap: 6px; font-size: 0.75rem; color: #aaa; cursor: pointer;">
                <input type="checkbox" id="all-{id_lower}" style="margin: 0; width: 14px; height: 14px; accent-color: var(--accent);" onchange="toggleRemotePlayAll('{id_lower}', this.checked)">
                <span>Play All (Loop)</span>
            </label>
            <div class="mod-dur-wrapper" id="dur-wrap-{id_lower}" style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 0.65rem; color: #666; font-weight: 800;">SEC</span>
                <input type="number" class="mod-dur" id="dur-{id_lower}" placeholder="s">
            </div>
         </div>
      </div>
    </div>
"""

with open('remote.html', 'r') as f:
    content = f.read()

start_marker = '  <div class="modules">\n'
end_marker = '  </div>\n\n  <button class="save-btn"'

start_idx = content.find(start_marker) + len(start_marker)
end_idx = content.find(end_marker)

new_content = content[:start_idx] + html + content[end_idx:]

with open('remote.html', 'w') as f:
    f.write(new_content)

print("Updated remote.html successfully.")
