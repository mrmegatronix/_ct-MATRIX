import re

with open("matrix-core.js", "r") as f:
    js = f.read()

# Change z-index of image to 3, and remove the animation
js = re.sub(
    r'z-index:\s*2;\s*position:relative;\s*animation:\s*logo-reflection\s*0\.5s\s*infinite\s*alternate;',
    r'z-index: 3; position:relative;',
    js
)

# Change z-index of flame-anchor to 2
js = re.sub(
    r'width:\s*0;\s*height:\s*0;\s*z-index:\s*3;',
    r'width: 0; height: 0; z-index: 2;',
    js
)

# The ambient glow is inside flame-anchor. It provides the light. Let's make sure its z-index is correct.
# In CSS, ambient-glow has z-index: 4. So it will appear above the flame (which is good), but since flame-anchor is z-index:2, the whole flame group is behind the image (z-index 3).

with open("matrix-core.js", "w") as f:
    f.write(js)
