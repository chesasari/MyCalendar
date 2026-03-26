import xml.etree.ElementTree as ET
import json
import os

# Paths
extracted_path = r'C:\QA-calendar\excel_extracted'
shared_strings_file = os.path.join(extracted_path, 'xl', 'sharedStrings.xml')
sheet_file = os.path.join(extracted_path, 'xl', 'worksheets', 'sheet8.xml')

# namespaces
ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}

# Load shared strings
shared_strings = []
tree = ET.parse(shared_strings_file)
root = tree.getroot()
for si in root.findall('main:si', ns):
    t = si.find('main:t', ns)
    if t is not None:
        shared_strings.append(t.text)
    else:
        # Handle rich text if necessary
        r_texts = si.findall('main:r', ns)
        text = "".join([r.find('main:t', ns).text for r in r_texts if r.find('main:t', ns) is not None])
        shared_strings.append(text)

# Find column for "エントリー(QA)"
# Based on previous view, row 6 column I had index 29 which is "エントリー(QA)"
# Row 7 starts data. B column is date (excel serial). I column is location.

schedule = []
tree = ET.parse(sheet_file)
root = tree.getroot()
sheet_data = root.find('main:sheetData', ns)

for row in sheet_data.findall('main:row', ns):
    row_idx = int(row.get('r'))
    if row_idx < 7: continue
    if row_idx > 36: break # April has 30 days
    
    date_val = None
    loc_val = ""
    
    for cell in row.findall('main:c', ns):
        r = cell.get('r')
        v = cell.find('main:v', ns)
        if v is None: continue
        
        if r.startswith('B'): # Date column
            date_val = float(v.text)
        elif r.startswith('I'): # エントリー(QA) column
            t = cell.get('t')
            if t == 's':
                loc_val = shared_strings[int(v.text)]
            else:
                loc_val = v.text
    
    if date_val:
        # Excel date to ISO 
        # 46113 is 2026-04-01
        days_offset = int(date_val - 46113)
        day = 1 + days_offset
        date_str = f"2026-04-{day:02d}"
        schedule.append({"date": date_str, "location": loc_val})

print(json.dumps(schedule, ensure_ascii=False, indent=2))
with open('data.json', 'w', encoding='utf-8') as f:
    json.dump(schedule, f, ensure_ascii=False, indent=2)
