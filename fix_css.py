import re

with open("matrix-styles.css", "r") as f:
    css = f.read()

# Replace .logo-image-glow block
css = re.sub(r"\.logo-image-glow\s*\{[^}]*\}", ".logo-image-glow {\n  mix-blend-mode: screen;\n}", css)

# Remove empty keyframes
css = re.sub(r"@keyframes logo-reflection\s*\{[^}]*\}", "", css)

with open("matrix-styles.css", "w") as f:
    f.write(css)
