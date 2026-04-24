import sys
import fitz  # PyMuPDF
import os
import json

if len(sys.argv) < 3:
    print("Usage: python convert_pdf_to_png.py <pdf_path> <output_dir>")
    sys.exit(1)

pdf_path = sys.argv[1]
output_dir = sys.argv[2]
if len(sys.argv) > 3:
    base_name = sys.argv[3]
else:
    base_name = os.path.splitext(os.path.basename(pdf_path))[0].replace(' ', '_')

doc = fitz.open(pdf_path)
for i, page in enumerate(doc):
    pix = page.get_pixmap(dpi=300)
    img_name = f'{base_name}_page-{i+1}.png'
    img_path = os.path.join(output_dir, img_name)
    pix.save(img_path)
    # Create empty components JSON for each image
    comp_json = os.path.join(output_dir, f'components_{base_name}_page-{i+1}.json')
    if not os.path.exists(comp_json):
        with open(comp_json, 'w') as f:
            json.dump([], f)
print('done') 