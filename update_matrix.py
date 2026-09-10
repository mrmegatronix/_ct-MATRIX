import re
import os

base_dir = "/run/media/zeus/6TB-1/__GITHUB NUC/_ct-MATRIX"
core_js_path = os.path.join(base_dir, "matrix-core.js")
css_path = os.path.join(base_dir, "matrix-styles.css")

with open(core_js_path, "r") as f:
    core_content = f.read()

# Uncomment the ct-flame-logo block
core_content = re.sub(
    r"//\s*queue\.push\(\{\n\s*//\s*id:\s*'ct-flame-logo',\n\s*//\s*type:\s*'EVENT',\n\s*//\s*subType:\s*'Logo',\n\s*//\s*isLogo:\s*true,\n\s*//\s*title:\s*'',\n\s*//\s*subtitle:\s*'',\n\s*//\s*bgImage:\s*'images/GOLD-FLAME-LOGO-BLACK-CLEAN\.png',\n\s*//\s*flamePosition:\s*'60%',\n\s*//\s*flameLeft:\s*'50%',\n\s*//\s*duration:\s*getModDur\('ct-flame-logo',\s*20\),\n\s*//\s*pinned:\s*true,\n\s*//\s*priority:\s*2\n\s*//\s*\}\);",
    r"""queue.push({
    id: 'ct-flame-logo',
    type: 'EVENT',
    subType: 'Logo',
    isLogo: true,
    title: '',
    subtitle: '',
    bgImage: 'images/GOLD-FLAME-LOGO-BLACK-CLEAN.png',
    flamePosition: '58%',
    flameLeft: '50%',
    duration: getModDur('ct-flame-logo', 20),
    pinned: true,
    priority: 2
  });""",
    core_content
)

# Update isLogo branch rendering
# Find the if (isLogo) block
is_logo_pattern = re.compile(
    r"if \(isLogo\) \{([\s\S]*?)<div class=\"slide-bg-overlay\"",
    re.MULTILINE
)

new_is_logo = r"""if (isLogo) {
        slideEl.innerHTML = `
          <div class="slide-bg" style="display:flex; justify-content:center; align-items:center; background-color: ${bgColor}; height: 100vh; width: 100vw; overflow: hidden; margin: 0; padding: 0;">
            <div class="logo-wrapper" style="position:relative; height: 85vh; width: 100%; display: flex; justify-content: center; align-items: center; animation: cinematicZoom 1.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;">
              ${bgImg ? `<img src="${bgImg}" alt="Flame Lantern" class="logo-image-glow" style="height: 100%; width: auto; z-index: 2; position:relative; animation: logo-reflection 0.5s infinite alternate;" />` : ''}
              
              <div class="flame-anchor" style="position: absolute; left: ${slide.flameLeft || '50%'}; top: ${slide.flamePosition || '58%'}; width: 0; height: 0; z-index: 3; transform: scale(1.5);">
                <!-- Ultra Realistic Teardrop Flame -->
                <div class="fire-outer"></div>
                <div class="fire-inner"></div>
                <div class="fire-core"></div>
                <!-- Ambient Reflection Glow on Logo -->
                <div class="ambient-glow"></div>
              </div>
            </div>
            <div class="slide-bg-overlay" """

core_content = is_logo_pattern.sub(new_is_logo, core_content)

with open(core_js_path, "w") as f:
    f.write(core_content)


with open(css_path, "r") as f:
    css_content = f.read()

# Add the new css at the end of the file
new_css = """
/* ==========================================================================
   REALISTIC TEARDROP FLAME CSS
   ========================================================================== */

.logo-image-glow {
  filter: drop-shadow(0 0 40px rgba(255,100,0,0.6));
}

@keyframes logo-reflection {
  0% { filter: drop-shadow(0 0 30px rgba(255,100,0,0.5)) drop-shadow(0 0 10px rgba(255,200,0,0.2)); }
  100% { filter: drop-shadow(0 0 50px rgba(255,120,0,0.8)) drop-shadow(0 0 20px rgba(255,220,0,0.4)); }
}

.fire-outer {
  position: absolute;
  bottom: 0; left: -25px;
  width: 50px; height: 50px;
  background-color: #ff6000;
  border-radius: 50% 0 50% 50%;
  transform: rotate(-45deg);
  box-shadow: 0 0 20px #ff6000, 0 0 40px #ff6000, 0 0 60px #ff0000, 0 0 80px #ff0000;
  animation: flicker-outer 0.1s infinite alternate;
  mix-blend-mode: screen;
}

.fire-inner {
  position: absolute;
  bottom: 5px; left: -15px;
  width: 30px; height: 30px;
  background-color: #ffcc00;
  border-radius: 50% 0 50% 50%;
  transform: rotate(-45deg);
  box-shadow: 0 0 10px #ffcc00, 0 0 20px #ffcc00, 0 0 30px #ffffff;
  animation: flicker-inner 0.15s infinite alternate;
  mix-blend-mode: screen;
}

.fire-core {
  position: absolute;
  bottom: 8px; left: -8px;
  width: 16px; height: 16px;
  background-color: #ffffff;
  border-radius: 50% 0 50% 50%;
  transform: rotate(-45deg);
  box-shadow: 0 0 5px #ffffff;
  animation: flicker-core 0.12s infinite alternate;
  mix-blend-mode: screen;
}

@keyframes flicker-outer {
  0% { transform: rotate(-45deg) scale(0.95); opacity: 0.9; }
  100% { transform: rotate(-45deg) scale(1.05); opacity: 1; }
}

@keyframes flicker-inner {
  0% { transform: rotate(-45deg) scale(0.9); }
  100% { transform: rotate(-45deg) scale(1.1); }
}

@keyframes flicker-core {
  0% { transform: rotate(-45deg) scale(0.95); }
  100% { transform: rotate(-45deg) scale(1.05); }
}

.ambient-glow {
  position: absolute;
  top: -20px; left: 0;
  width: 300px; height: 300px;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(255, 120, 0, 0.4) 0%, rgba(255, 50, 0, 0.1) 40%, transparent 70%);
  border-radius: 50%;
  z-index: 4;
  pointer-events: none;
  mix-blend-mode: color-dodge;
  animation: ambient-flicker 0.2s infinite alternate;
}

@keyframes ambient-flicker {
  0% { opacity: 0.8; transform: translate(-50%, -50%) scale(0.95); }
  100% { opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
}
"""
if "REALISTIC TEARDROP FLAME CSS" not in css_content:
    with open(css_path, "a") as f:
        f.write("\n" + new_css)
