from rembg import remove
from PIL import Image
import os

folder = "public/segments"
files = ["pizza.png","burger.png","marmita.png","acai.png","conveniencia.png","padaria.png","restaurante.png","espetinho.png","cafe.png"]

for filename in files:
    path = os.path.join(folder, filename)
    if not os.path.exists(path):
        print(f"  SKIP: {filename} not found")
        continue

    print(f"  Processing {filename}...")
    with open(path, "rb") as f:
        img_bytes = f.read()

    result_bytes = remove(img_bytes)

    # Convert to RGBA then paste on white background
    img_no_bg = Image.open(__import__("io").BytesIO(result_bytes)).convert("RGBA")
    white_bg = Image.new("RGBA", img_no_bg.size, (255, 255, 255, 255))
    white_bg.paste(img_no_bg, mask=img_no_bg.split()[3])
    final = white_bg.convert("RGB")
    final.save(path, "PNG")
    print(f"  Done: {filename}")

print("\nAll images processed!")
