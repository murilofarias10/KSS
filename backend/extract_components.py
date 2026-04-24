import pytesseract
from PIL import Image
import json
from datetime import datetime
import re

IMAGE_PATH = 'page_1.png'
OUTPUT_JSON = 'components.json'

# Regex for component IDs (adjust as needed)
COMPONENT_REGEX = re.compile(r'(LL|LD|DTI|DTS|Q|07A|07B|07C|07D|07E|07F|07G|07H|07I|07J|07K|07L|07M|07N|07O|07P|07Q|07R|07S|07T|07U|07V|07W|07X|07Y|07Z|\d{2,4})[-_]?\d{1,3}', re.IGNORECASE)

components = []

# OCR: Extract all text from the image
img = Image.open(IMAGE_PATH)
ocr_result = pytesseract.image_to_string(img)
lines = ocr_result.split('\n')
for line in lines:
    text = line.strip()
    if not text:
        continue
    match = COMPONENT_REGEX.search(text)
    if match:
        comp_id = match.group(0)
        comp_name = text.replace(comp_id, '').strip() or 'Component'
        components.append({
            'name': comp_name,
            'id': comp_id,
            'status': 'To Do',
            'date_modified': datetime.utcnow().isoformat() + 'Z',
            'responsible_person': ''
        })

with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
    json.dump(components, f, indent=2, ensure_ascii=False)

print(f'Extracted {len(components)} components to {OUTPUT_JSON}') 